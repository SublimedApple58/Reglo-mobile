import { useQuery } from '@tanstack/react-query';
import { useSession } from '../../context/SessionContext';
import { regloApi } from '../../services/regloApi';
import type { AutoscuolaLocation } from '../../types/regloApi';
import { queryKeys, STALE_TIMES } from './queryKeys';

export const useLocations = () => {
  const { activeCompanyId } = useSession();

  return useQuery<AutoscuolaLocation[]>({
    queryKey: queryKeys.locations(activeCompanyId),
    queryFn: async () => (await regloApi.getLocations()) ?? [],
    enabled: !!activeCompanyId,
    staleTime: STALE_TIMES.locations,
  });
};
