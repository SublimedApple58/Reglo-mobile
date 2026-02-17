import { useCallback, useEffect, useState } from 'react';
import { useSession } from '../context/SessionContext';
import { regloApi } from '../services/regloApi';

const companyAutoPaymentsCache = new Map<string, boolean>();

type UseAutoPaymentsEnabledResult = {
  enabled: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
};

export const useAutoPaymentsEnabled = (): UseAutoPaymentsEnabledResult => {
  const { autoscuolaRole, activeCompanyId } = useSession();
  const isStudent = autoscuolaRole !== 'OWNER' && autoscuolaRole !== 'INSTRUCTOR';

  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(
    async (skipCache = false) => {
      if (!isStudent || !activeCompanyId) {
        setEnabled(false);
        setLoading(false);
        return;
      }

      if (!skipCache) {
        const cached = companyAutoPaymentsCache.get(activeCompanyId);
        if (cached !== undefined) {
          setEnabled(cached);
          setLoading(false);
          return;
        }
      }

      setLoading(true);
      try {
        const settings = await regloApi.getAutoscuolaSettings();
        const nextEnabled = Boolean(settings.autoPaymentsEnabled);
        companyAutoPaymentsCache.set(activeCompanyId, nextEnabled);
        setEnabled(nextEnabled);
      } catch {
        setEnabled(false);
      } finally {
        setLoading(false);
      }
    },
    [activeCompanyId, isStudent]
  );

  useEffect(() => {
    load();
  }, [load]);

  const refresh = useCallback(async () => {
    await load(true);
  }, [load]);

  return { enabled, loading, refresh };
};

