import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authStorage } from '../services/apiClient';
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
    companyName: string;
    name: string;
    email: string;
    password: string;
    confirmPassword: string;
  }) => Promise<void>;
  signOut: () => Promise<void>;
  selectCompany: (companyId: string) => Promise<void>;
  refreshMe: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

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

  const refreshMe = useCallback(async () => {
    const me = await regloApi.me();
    setAuthenticated({
      user: me.user,
      companies: me.companies,
      activeCompanyId: me.activeCompanyId,
      autoscuolaRole: me.autoscuolaRole,
      instructorId: me.instructorId ?? null,
    });
  }, [setAuthenticated]);

  const bootstrap = useCallback(async () => {
    const token = await authStorage.getToken();
    if (!token) {
      setState({
        status: 'unauthenticated',
        user: null,
        companies: [],
        activeCompanyId: null,
        autoscuolaRole: null,
        instructorId: null,
      });
      return;
    }

    try {
      await refreshMe();
    } catch (error) {
      console.warn('[Session] Failed to restore session', error);
      await authStorage.clear();
      await sessionStorage.clear();
      setState({
        status: 'unauthenticated',
        user: null,
        companies: [],
        activeCompanyId: null,
        autoscuolaRole: null,
        instructorId: null,
      });
    }
  }, [refreshMe]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

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
      companyName: string;
      name: string;
      email: string;
      password: string;
      confirmPassword: string;
    }) => {
      const payload = await regloApi.signup(input);
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
    setState({
      status: 'unauthenticated',
      user: null,
      companies: [],
      activeCompanyId: null,
      autoscuolaRole: null,
      instructorId: null,
    });
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
