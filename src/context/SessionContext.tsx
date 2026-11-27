import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { authStorage, RegloApiError, onAuthInvalidated, onCompanyMaintenance } from '../services/apiClient';
import { registerPushToken, unregisterPushToken } from '../services/pushNotifications';
import { regloApi } from '../services/regloApi';
import { sessionStorage } from '../services/sessionStorage';
import { clearUserPhotoCache } from '../services/userPhotos';
import { AuthPayload, AutoscuolaRole, CompanyMaintenance, CompanySummary, StudentOnboarding, UserPublic } from '../types/regloApi';
import { resolveOnboarding } from '../utils/onboarding';
import { isStudent } from '../utils/roles';

type SessionStatus = 'loading' | 'unauthenticated' | 'company_select' | 'ready';

type SessionState = {
  status: SessionStatus;
  user: UserPublic | null;
  companies: CompanySummary[];
  activeCompanyId: string | null;
  autoscuolaRole: AutoscuolaRole | null;
  instructorId: string | null;
  /**
   * REG-773 — manutenzione dell'autoscuola attiva, solo se blocca questo
   * membro: l'app mostra MaintenanceScreen al posto di tutto il resto.
   */
  maintenance: CompanyMaintenance | null;
  /**
   * REG-802 — step dell'onboarding dell'allievo ancora da fare (null = nessuno,
   * undefined = non ancora noto). L'AuthGate porta in `app/onboarding` finché
   * ce ne sono.
   */
  onboarding: StudentOnboarding | null | undefined;
};

type SessionContextValue = SessionState & {
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: {
    name: string;
    email: string;
    phone: string;
    password: string;
    confirmPassword: string;
    schoolCode: string;
    whatsappConsent?: boolean;
  }) => Promise<void>;
  signOut: () => Promise<void>;
  selectCompany: (companyId: string) => Promise<void>;
  refreshMe: () => Promise<void>;
  /** Establish a session directly from an AuthPayload (e.g. after a password reset auto-login). */
  applyAuthPayload: (payload: AuthPayload) => Promise<void>;
  /** REG-802 — aggiorna gli step dovuti con la risposta di `completeOnboarding`. */
  setOnboarding: (onboarding: StudentOnboarding | null) => void;
};

/** REG-802: dopo quanto, tornando nell'app, un allievo rilegge `/me`. */
const ME_STALE_MS = 30 * 60 * 1000;

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

const unauthenticatedState: SessionState = {
  status: 'unauthenticated',
  user: null,
  companies: [],
  activeCompanyId: null,
  autoscuolaRole: null,
  instructorId: null,
  maintenance: null,
  onboarding: null,
};

const resolveMaintenance = (activeCompanyId: string | null, companies: CompanySummary[]) => {
  const maintenance = companies.find((item) => item.id === activeCompanyId)?.maintenance ?? null;
  return maintenance?.blocked ? maintenance : null;
};

const resolveStatus = (activeCompanyId: string | null, companies: CompanySummary[]) => {
  if (!activeCompanyId && companies.length > 0) return 'company_select' as const;
  return 'ready' as const;
};

const resolveAutoscuolaRole = (
  activeCompanyId: string | null,
  companies: CompanySummary[],
  fallback?: AutoscuolaRole | null
) => {
  if (activeCompanyId) {
    const company = companies.find((item) => item.id === activeCompanyId);
    if (company && company.autoscuolaRole !== undefined) {
      return company.autoscuolaRole;
    }
  }
  return fallback ?? null;
};

export const SessionProvider = ({ children }: { children: React.ReactNode }) => {
  const [state, setState] = useState<SessionState>({
    status: 'loading',
    user: null,
    companies: [],
    activeCompanyId: null,
    autoscuolaRole: null,
    instructorId: null,
    maintenance: null,
    onboarding: undefined,
  });

  const setAuthenticated = useCallback((payload: {
    user: UserPublic;
    companies: CompanySummary[];
    activeCompanyId: string | null;
    autoscuolaRole?: AutoscuolaRole | null;
    instructorId?: string | null;
    onboarding?: StudentOnboarding | null;
  }) => {
    const status = resolveStatus(payload.activeCompanyId, payload.companies);
    const autoscuolaRole = resolveAutoscuolaRole(
      payload.activeCompanyId,
      payload.companies,
      payload.autoscuolaRole ?? null
    );
    setState({
      status,
      user: payload.user,
      companies: payload.companies,
      activeCompanyId: payload.activeCompanyId,
      autoscuolaRole,
      instructorId: payload.instructorId ?? null,
      maintenance: resolveMaintenance(payload.activeCompanyId, payload.companies),
      onboarding: payload.onboarding,
    });
  }, []);

  const clearSessionAndUnauthenticate = useCallback(async () => {
    await authStorage.clear();
    await sessionStorage.clear();
    clearUserPhotoCache();
    setState(unauthenticatedState);
  }, []);

  /** Ultima lettura di `/me` (per ripassarla al ritorno in app, REG-802). */
  const lastMeAt = useRef(0);

  const refreshMe = useCallback(async () => {
    const me = await regloApi.me();
    const resolvedRole = resolveAutoscuolaRole(
      me.activeCompanyId,
      me.companies,
      me.autoscuolaRole
    );

    // If the user has been removed from all companies, force a clean logout.
    if (!me.companies.length) {
      await clearSessionAndUnauthenticate();
      return;
    }

    // If an active company exists but role resolution fails, session is inconsistent:
    // force login so the user doesn't stay in a broken app state.
    if (me.activeCompanyId && !resolvedRole) {
      await clearSessionAndUnauthenticate();
      return;
    }

    lastMeAt.current = Date.now();
    setAuthenticated({
      user: me.user,
      companies: me.companies,
      activeCompanyId: me.activeCompanyId,
      autoscuolaRole: me.autoscuolaRole,
      instructorId: me.instructorId ?? null,
      onboarding: resolveOnboarding(me, resolvedRole ?? null),
    });
  }, [clearSessionAndUnauthenticate, setAuthenticated]);

  const bootstrap = useCallback(async () => {
    const token = await authStorage.getToken();
    if (!token) {
      setState(unauthenticatedState);
      return;
    }

    try {
      await refreshMe();
    } catch (error) {
      const isAuthError = error instanceof RegloApiError && error.status === 401;
      if (isAuthError) {
        console.warn('[Session] Token rejected (401), clearing session');
        await clearSessionAndUnauthenticate();
        return;
      }

      // Transient error (network, timeout, 500) — retry once after a short delay
      console.warn('[Session] Transient error restoring session, retrying...', error);
      await new Promise((r) => setTimeout(r, 2000));

      try {
        await refreshMe();
      } catch (retryError) {
        const isRetryAuthError = retryError instanceof RegloApiError && retryError.status === 401;
        if (isRetryAuthError) {
          console.warn('[Session] Token rejected on retry (401), clearing session');
          await clearSessionAndUnauthenticate();
        } else {
          // Still failing but token is valid — keep it stored, show unauthenticated
          // so the user can pull-to-refresh or reopen the app later without re-login
          console.warn('[Session] Retry failed, keeping token for next launch');
          setState(unauthenticatedState);
        }
      }
    }
  }, [clearSessionAndUnauthenticate, refreshMe]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  // Listen for 401 responses during normal app usage (not just bootstrap).
  // Any API call returning 401 means the token is invalid — clean up the session.
  const clearRef = useRef(clearSessionAndUnauthenticate);
  clearRef.current = clearSessionAndUnauthenticate;
  useEffect(() => {
    return onAuthInvalidated(() => {
      clearRef.current();
    });
  }, []);

  // REG-773: una risposta «COMPANY_MAINTENANCE» (l'autoscuola è appena
  // entrata in manutenzione) → si rilegge /me, che dice se blocca proprio noi.
  const refreshRef = useRef(refreshMe);
  refreshRef.current = refreshMe;
  useEffect(() => {
    let inFlight = false;
    return onCompanyMaintenance(() => {
      if (inFlight) return;
      inFlight = true;
      refreshRef.current().catch(() => undefined).finally(() => { inFlight = false; });
    });
  }, []);

  // In manutenzione: al ritorno in primo piano si ricontrolla, così allo
  // sblocco l'app riparte senza dover rifare il login.
  const blocked = !!state.maintenance;
  useEffect(() => {
    if (!blocked) return;
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') refreshRef.current().catch(() => undefined);
    });
    return () => sub.remove();
  }, [blocked]);

  useEffect(() => {
    // In manutenzione la registrazione verrebbe respinta: si rifà allo sblocco.
    if (state.status !== 'ready' || !state.user?.id || state.maintenance) return;
    registerPushToken()
      .then((result) => {
        if (result.status === 'skipped') {
          console.info(`[Session] Push registration skipped (${result.reason})`);
        }
      })
      .catch((error) => {
        console.warn('[Session] Push registration failed', error);
      });
  }, [state.status, state.activeCompanyId, state.user?.id, state.maintenance]);

  // Shared by signIn / signUp / password-reset auto-login: if the user has a
  // single company and none active yet, select it, then commit the session.
  const applyAuthPayload = useCallback(
    async (payload: AuthPayload) => {
      if (!payload.activeCompanyId && payload.companies.length === 1) {
        const companyId = payload.companies[0].id;
        await regloApi.selectCompany({ companyId });
        payload.activeCompanyId = companyId;
        payload.autoscuolaRole = payload.companies[0].autoscuolaRole ?? null;
      }
      // REG-802: il login non porta `onboarding`. Per un allievo lo si legge
      // subito da `/me`, così dopo «Accedi» si va dritti agli step dovuti
      // invece di passare un attimo dalla home.
      const role =
        payload.companies.find((c) => c.id === payload.activeCompanyId)?.autoscuolaRole ??
        payload.autoscuolaRole ??
        null;
      let onboarding: StudentOnboarding | null = null;
      if (isStudent(role)) {
        onboarding = await regloApi
          .me()
          .then((me) => {
            lastMeAt.current = Date.now();
            return resolveOnboarding(me, role);
          })
          // Senza `/me` vale la regola del vecchio PhoneGate (solo il cellulare).
          .catch(() => resolveOnboarding({ user: payload.user }, role));
      }
      setAuthenticated({
        user: payload.user,
        companies: payload.companies,
        activeCompanyId: payload.activeCompanyId,
        autoscuolaRole: payload.autoscuolaRole ?? null,
        instructorId: payload.instructorId ?? null,
        onboarding,
      });
    },
    [setAuthenticated]
  );

  const setOnboarding = useCallback((onboarding: StudentOnboarding | null) => {
    setState((prev) => ({ ...prev, onboarding }));
  }, []);

  // REG-802: un allievo che torna nell'app dopo un po' rilegge `/me`, così lo
  // step Disponibilità rimandato ricompare alla prima apertura dopo il rinvio
  // (l'app su iOS resta in memoria per giorni senza ripartire da zero).
  const studentReady = state.status === 'ready' && isStudent(state.autoscuolaRole);
  useEffect(() => {
    if (!studentReady) return;
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') return;
      if (Date.now() - lastMeAt.current < ME_STALE_MS) return;
      refreshRef.current().catch(() => undefined);
    });
    return () => sub.remove();
  }, [studentReady]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const payload = await regloApi.login({ email, password });
      await applyAuthPayload(payload);
    },
    [applyAuthPayload]
  );

  const signUp = useCallback(
    async (input: {
      name: string;
      email: string;
      phone: string;
      password: string;
      confirmPassword: string;
      schoolCode: string;
      whatsappConsent?: boolean;
    }) => {
      const payload = await regloApi.studentRegister(input);
      await applyAuthPayload(payload);
    },
    [applyAuthPayload]
  );

  const signOut = useCallback(async () => {
    try {
      await unregisterPushToken();
    } catch (error) {
      console.warn('[Session] Push unregister failed', error);
    }
    try {
      await regloApi.logout();
    } catch (error) {
      console.warn('[Session] Logout failed', error);
    }
    await authStorage.clear();
    await sessionStorage.clear();
    clearUserPhotoCache();
    setState(unauthenticatedState);
  }, []);

  const selectCompany = useCallback(
    async (companyId: string) => {
      await regloApi.selectCompany({ companyId });
      await refreshMe();
    },
    [refreshMe]
  );

  const value = useMemo<SessionContextValue>(
    () => ({
      ...state,
      signIn,
      signUp,
      signOut,
      selectCompany,
      refreshMe,
      applyAuthPayload,
      setOnboarding,
    }),
    [state, signIn, signUp, signOut, selectCompany, refreshMe, applyAuthPayload, setOnboarding]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
};

export const useSession = () => {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useSession must be used within SessionProvider');
  return context;
};
