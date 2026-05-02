import { useQuery } from '@tanstack/react-query';
import { useSession } from '../../context/SessionContext';
import { regloApi } from '../../services/regloApi';
import type { DateAvailabilityMap } from '../../types/regloApi';
import { queryKeys, STALE_TIMES } from './queryKeys';

export const useDateAvailability = (
  params: { studentId: string; from: string; to: string } | null,
) => {
  const { activeCompanyId } = useSession();

  return useQuery<DateAvailabilityMap>({
    queryKey: queryKeys.dateAvailability(activeCompanyId, params as Record<string, unknown>),
    queryFn: () => regloApi.getDateAvailability(params!),
    enabled: !!activeCompanyId && !!params,
    staleTime: STALE_TIMES.dateAvailability,
  });
};
