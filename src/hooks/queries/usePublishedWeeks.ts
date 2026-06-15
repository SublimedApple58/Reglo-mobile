import { useQuery } from '@tanstack/react-query';
import { useSession } from '../../context/SessionContext';
import { regloApi } from '../../services/regloApi';
import { queryKeys, STALE_TIMES } from './queryKeys';

/** Published-weeks horizon for the publication-mode rail (list of weekStart strings). */
export const usePublishedWeeks = (instructorId: string | null, from: string, to: string) => {
  const { activeCompanyId } = useSession();

  return useQuery<string[]>({
    queryKey: queryKeys.publishedWeeks(activeCompanyId, instructorId, { from, to }),
    queryFn: async () => {
      const res = await regloApi.getPublishedWeeks({ instructorId: instructorId!, from, to });
      return res.map((w) => w.weekStart);
    },
    enabled: !!activeCompanyId && !!instructorId,
    staleTime: STALE_TIMES.availability,
  });
};
