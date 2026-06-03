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
    // Settings gate visible surfaces (Note/Pagamenti tabs, swap CTA, vehicles…).
    // The query cache is persisted to disk, so without this a value cached
    // within the staleTime window survives app restarts and the tabs wouldn't
    // reflect an owner-side toggle until staleTime elapses. Mirror useMyPhase:
    // refetch on every mount (app open / tab re-entry) so reopening the app
    // re-evaluates the tabs. The persisted value renders instantly; the
    // background refetch then corrects it.
    refetchOnMount: 'always',
  });
};
