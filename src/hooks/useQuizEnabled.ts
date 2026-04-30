import { useCallback, useEffect, useState } from 'react';
import { useSession } from '../context/SessionContext';
import { regloApi } from '../services/regloApi';
import { isStudent as isStudentRole } from '../utils/roles';

const cache = new Map<string, boolean>();

type UseQuizEnabledResult = {
  enabled: boolean;
  loading: boolean;
};

export const useQuizEnabled = (): UseQuizEnabledResult => {
  const { autoscuolaRole, activeCompanyId } = useSession();
  const isStudent = isStudentRole(autoscuolaRole);

  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!isStudent || !activeCompanyId) {
      setEnabled(false);
      setLoading(false);
      return;
    }

    const cached = cache.get(activeCompanyId);
    if (cached !== undefined) {
      setEnabled(cached);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const settings = await regloApi.getAutoscuolaSettings();
      const val = Boolean(settings.quizEnabled);
      cache.set(activeCompanyId, val);
      setEnabled(val);
    } catch {
      setEnabled(false);
    } finally {
      setLoading(false);
    }
  }, [activeCompanyId, isStudent]);

  useEffect(() => {
    load();
  }, [load]);

  return { enabled, loading };
};
