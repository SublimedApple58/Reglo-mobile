import { useQuery } from '@tanstack/react-query';
import { useSession } from '../../context/SessionContext';
import { regloApi } from '../../services/regloApi';
import type { AutoscuolaSettings } from '../../types/regloApi';
import { queryKeys, STALE_TIMES } from './queryKeys';

export const autoscuolaSettingsQueryKey = queryKeys.autoscuolaSettings;

export const useAutoscuolaSettings = () => {
  const { activeCompanyId } = useSession();

  return useQuery<AutoscuolaSettings>({
    queryKey: queryKeys.autoscuolaSettings(activeCompanyId),
    queryFn: () => regloApi.getAutoscuolaSettings(),
    enabled: !!activeCompanyId,
    staleTime: STALE_TIMES.settings,
  });
};
