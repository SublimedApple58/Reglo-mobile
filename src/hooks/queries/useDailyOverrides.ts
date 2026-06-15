import { useQuery } from '@tanstack/react-query';
import { useSession } from '../../context/SessionContext';
import { regloApi } from '../../services/regloApi';
import type { DailyAvailabilityOverride } from '../../types/regloApi';
import { queryKeys, STALE_TIMES } from './queryKeys';

/** Instructor daily availability exceptions (overrides), cache-first + persisted. */
export const useDailyOverrides = (instructorId: string | null) => {
  const { activeCompanyId } = useSession();

  return useQuery<DailyAvailabilityOverride[]>({
    queryKey: queryKeys.dailyOverrides(activeCompanyId, instructorId),
    queryFn: () => regloApi.getDailyAvailabilityOverrides({ ownerType: 'instructor', ownerId: instructorId! }),
    enabled: !!activeCompanyId && !!instructorId,
    staleTime: STALE_TIMES.availability,
  });
};
