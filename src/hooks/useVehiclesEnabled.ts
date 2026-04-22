import { useCallback, useEffect, useState } from 'react';
import { useSession } from '../context/SessionContext';
import { regloApi } from '../services/regloApi';

const cache = new Map<string, boolean>();

type UseVehiclesEnabledResult = {
  enabled: boolean;
  loading: boolean;
};

export const useVehiclesEnabled = (): UseVehiclesEnabledResult => {
  const { activeCompanyId } = useSession();
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!activeCompanyId) {
      setLoading(false);
      return;
    }

    const cached = cache.get(activeCompanyId);
    if (cached !== undefined) {
      setEnabled(cached);
      setLoading(false);
      return;
    }

    try {
      const settings = await regloApi.getAutoscuolaSettings();
      const value = settings?.vehiclesEnabled !== false;
      cache.set(activeCompanyId, value);
      setEnabled(value);
    } catch {
      setEnabled(true);
    } finally {
      setLoading(false);
    }
  }, [activeCompanyId]);

  useEffect(() => {
    load();
  }, [load]);

  return { enabled, loading };
};
