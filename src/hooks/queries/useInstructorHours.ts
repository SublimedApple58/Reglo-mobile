import { useQuery } from '@tanstack/react-query';
import { useSession } from '../../context/SessionContext';
import { regloApi } from '../../services/regloApi';
import type { InstructorHoursRange } from '../../types/regloApi';
import { queryKeys, STALE_TIMES } from './queryKeys';

// Cache-first per period: re-selecting an already-viewed range renders instantly.
export const useInstructorHours = (from: string, to: string) => {
  const { activeCompanyId } = useSession();

  return useQuery<InstructorHoursRange | null>({
    queryKey: queryKeys.instructorHours(activeCompanyId, { from, to }),
    queryFn: async () => {
      const result = await regloApi.getInstructorHoursRange({ from, to });
      return Array.isArray(result) && result.length > 0 ? result[0] : null;
    },
    enabled: !!activeCompanyId && !!from && !!to,
    staleTime: STALE_TIMES.instructorHours,
  });
};
