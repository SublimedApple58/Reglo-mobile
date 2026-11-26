import { useQuery } from '@tanstack/react-query';
import { useSession } from '../../context/SessionContext';
import { regloApi } from '../../services/regloApi';
import type { AvailabilityMode } from '../../types/regloApi';
import { queryKeys, STALE_TIMES } from './queryKeys';

/**
 * REG-794 (B1): modalità di disponibilità di UN istruttore, letta dal titolare
 * (`instructors/[id]/availability-mode`). Per sé stessi resta `useInstructorSettings`.
 */
export const useInstructorAvailabilityMode = (instructorId: string | null) => {
  const { activeCompanyId } = useSession();

  return useQuery<AvailabilityMode>({
    queryKey: queryKeys.instructorAvailabilityMode(activeCompanyId, instructorId),
    queryFn: async () => (await regloApi.getInstructorAvailabilityMode(instructorId!)).availabilityMode,
    enabled: !!activeCompanyId && !!instructorId,
    staleTime: STALE_TIMES.availability,
  });
};
