import { useQuery } from '@tanstack/react-query';
import { useSession } from '../../context/SessionContext';
import { regloApi } from '../../services/regloApi';
import { queryKeys, STALE_TIMES } from './queryKeys';

type DefaultAvailabilityData = Awaited<ReturnType<typeof regloApi.getDefaultAvailability>>;

/** Instructor default-mode weekly base schedule (cache-first, persisted). */
export const useDefaultAvailability = (instructorId: string | null) => {
  const { activeCompanyId } = useSession();

  return useQuery<DefaultAvailabilityData>({
    queryKey: queryKeys.defaultAvailability(activeCompanyId, instructorId),
    queryFn: () => regloApi.getDefaultAvailability({ ownerType: 'instructor', ownerId: instructorId! }),
    enabled: !!activeCompanyId && !!instructorId,
    staleTime: STALE_TIMES.availability,
  });
};
