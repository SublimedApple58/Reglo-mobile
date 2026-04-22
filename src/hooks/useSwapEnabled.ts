import { useCallback, useEffect, useState } from 'react';
import { useSession } from '../context/SessionContext';
import { regloApi } from '../services/regloApi';

// Cache keyed by userId (cluster-resolved settings differ per student)
const studentSwapCache = new Map<string, boolean>();

type UseSwapEnabledResult = {
  enabled: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
};

export const useSwapEnabled = (): UseSwapEnabledResult => {
  const { autoscuolaRole, activeCompanyId, user } = useSession();
  const isStudent = autoscuolaRole !== 'OWNER' && autoscuolaRole !== 'INSTRUCTOR';
  const studentId = user?.id ?? null;

  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(
    async (skipCache = false) => {
      if (!isStudent || !activeCompanyId || !studentId) {
        setEnabled(false);
        setLoading(false);
        return;
      }

      const cacheKey = `${activeCompanyId}:${studentId}`;
      if (!skipCache) {
        const cached = studentSwapCache.get(cacheKey);
        if (cached !== undefined) {
          setEnabled(cached);
          setLoading(false);
          return;
        }
      }

      setLoading(true);
      try {
        // Prefer cluster-resolved swapEnabled from booking options
        const options = await regloApi.getBookingOptions(studentId).catch(() => null);
        let nextEnabled: boolean;
        if (options && typeof options.swapEnabled === 'boolean') {
          nextEnabled = options.swapEnabled;
        } else {
          const settings = await regloApi.getAutoscuolaSettings();
          nextEnabled = Boolean(settings.swapEnabled);
        }
        studentSwapCache.set(cacheKey, nextEnabled);
        setEnabled(nextEnabled);
      } catch {
        setEnabled(false);
      } finally {
        setLoading(false);
      }
    },
    [activeCompanyId, isStudent, studentId]
  );

  useEffect(() => {
    load();
  }, [load]);

  const refresh = useCallback(async () => {
    await load(true);
  }, [load]);

  return { enabled, loading, refresh };
};
