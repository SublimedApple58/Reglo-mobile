import { useCallback, useEffect, useState } from 'react';
import { useSession } from '../context/SessionContext';
import { regloApi } from '../services/regloApi';

const companySwapCache = new Map<string, boolean>();

type UseSwapEnabledResult = {
  enabled: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
};

export const useSwapEnabled = (): UseSwapEnabledResult => {
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
        const cached = companySwapCache.get(activeCompanyId);
        if (cached !== undefined) {
          setEnabled(cached);
          setLoading(false);
          return;
        }
      }

      setLoading(true);
      try {
        const settings = await regloApi.getAutoscuolaSettings();
        const nextEnabled = Boolean(settings.swapEnabled);
        companySwapCache.set(activeCompanyId, nextEnabled);
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
