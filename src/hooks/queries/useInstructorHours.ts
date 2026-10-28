import { useQuery } from '@tanstack/react-query';
import { useSession } from '../../context/SessionContext';
import { regloApi } from '../../services/regloApi';
import type { InstructorHoursRange } from '../../types/regloApi';
import { queryKeys, STALE_TIMES } from './queryKeys';

// Cache-first per period: re-selecting an already-viewed range renders instantly.
// `instructorId` (facoltativo) = solo quell'istruttore: serve al titolare-istruttore,
// che senza id riceve tutti gli istruttori (es. card del mese nella tab «Tu»).
export const useInstructorHours = (from: string, to: string, instructorId?: string | null) => {
  const { activeCompanyId } = useSession();

  return useQuery<InstructorHoursRange | null>({
    queryKey: queryKeys.instructorHours(activeCompanyId, { from, to, instructorId: instructorId ?? null }),
    queryFn: async () => {
      const result = await regloApi.getInstructorHoursRange({ from, to, instructorId: instructorId ?? undefined });
      return Array.isArray(result) && result.length > 0 ? result[0] : null;
    },
    enabled: !!activeCompanyId && !!from && !!to,
    staleTime: STALE_TIMES.instructorHours,
  });
};
