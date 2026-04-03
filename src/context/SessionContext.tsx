import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { authStorage, RegloApiError, onAuthInvalidated } from '../services/apiClient';
import { registerPushToken, unregisterPushToken } from '../services/pushNotifications';
import { regloApi } from '../services/regloApi';
import { sessionStorage } from '../services/sessionStorage';
import { AutoscuolaRole, CompanySummary, UserPublic } from '../types/regloApi';

type SessionStatus = 'loading' | 'unauthenticated' | 'company_select' | 'ready';

type SessionState = {
  status: SessionStatus;
  user: UserPublic | null;
  companies: CompanySummary[];
  activeCompanyId: string | null;
  autoscuolaRole: AutoscuolaRole | null;
  instructorId: string | null;
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
  }) => Promise<void>;
  signOut: () => Promise<void>;
  selectCompany: (companyId: string) => Promise<void>;
  refreshMe: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

const unauthenticatedState: SessionState = {
  status: 'unauthenticated',
  user: null,
  companies: [],
  activeCompanyId: null,
  autoscuolaRole: null,
  instructorId: null,
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
  });

  const setAuthenticated = useCallback((payload: {
    user: UserPublic;
    companies: CompanySummary[];
    activeCompanyId: string | null;
    autoscuolaRole?: AutoscuolaRole | null;
    instructorId?: string | null;
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
    });
  }, []);

  const clearSessionAndUnauthenticate = useCallback(async () => {
    await authStorage.clear();
    await sessionStorage.clear();
    setState(unauthenticatedState);
  }, []);

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

    setAuthenticated({
      user: me.user,
      companies: me.companies,
      activeCompanyId: me.activeCompanyId,
      autoscuolaRole: me.autoscuolaRole,
      instructorId: me.instructorId ?? null,
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

  useEffect(() => {
    if (state.status !== 'ready' || !state.user?.id) return;
    registerPushToken()
      .then((result) => {
        if (result.status === 'skipped') {
          console.info(`[Session] Push registration skipped (${result.reason})`);
        }
      })
      .catch((error) => {
        console.warn('[Session] Push registration failed', error);
      });
  }, [state.status, state.activeCompanyId, state.user?.id]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const payload = await regloApi.login({ email, password });
      if (!payload.activeCompanyId && payload.companies.length === 1) {
        const companyId = payload.companies[0].id;
        await regloApi.selectCompany({ companyId });
        payload.activeCompanyId = companyId;
        payload.autoscuolaRole = payload.companies[0].autoscuolaRole ?? null;
      }
      setAuthenticated({
        user: payload.user,
        companies: payload.companies,
        activeCompanyId: payload.activeCompanyId,
        autoscuolaRole: payload.autoscuolaRole ?? null,
        instructorId: payload.instructorId ?? null,
      });
    },
    [setAuthenticated]
  );

  const signUp = useCallback(
    async (input: {
      name: string;
      email: string;
      phone: string;
      password: string;
      confirmPassword: string;
      schoolCode: string;
    }) => {
      const payload = await regloApi.studentRegister(input);
      if (!payload.activeCompanyId && payload.companies.length === 1) {
        const companyId = payload.companies[0].id;
        await regloApi.selectCompany({ companyId });
        payload.activeCompanyId = companyId;
        payload.autoscuolaRole = payload.companies[0].autoscuolaRole ?? null;
      }
      setAuthenticated({
        user: payload.user,
        companies: payload.companies,
        activeCompanyId: payload.activeCompanyId,
        autoscuolaRole: payload.autoscuolaRole ?? null,
        instructorId: payload.instructorId ?? null,
      });
    },
    [setAuthenticated]
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
    }),
    [state, signIn, signUp, signOut, selectCompany, refreshMe]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
};

export const useSession = () => {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useSession must be used within SessionProvider');
  return context;
};
