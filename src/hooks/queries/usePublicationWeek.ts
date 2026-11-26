import { useQuery } from '@tanstack/react-query';
import { useSession } from '../../context/SessionContext';
import { regloApi } from '../../services/regloApi';
import type { TimeRange } from '../../types/regloApi';
import { queryKeys, STALE_TIMES } from './queryKeys';

export type DayState = { date: string; available: boolean; ranges: TimeRange[] };

const DEFAULT_RANGES: TimeRange[] = [{ startMinutes: 540, endMinutes: 1080 }];
const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

/**
 * One publication-mode week resolved to 7 DayState rows: ONLY what is saved in
 * this week. REG-799 (Tiziano, 26/11): ogni settimana a sé — i giorni non
 * salvati sono a riposo, niente eredità dall'ultima settimana pubblicata né
 * dalla predefinita, come fa ora `publishInstructorWeek`. Quello che si vede è
 * quello che si pubblica.
 */
export const usePublicationWeek = (
  instructorId: string | null,
  weekStart: string,
) => {
  const { activeCompanyId } = useSession();

  return useQuery<DayState[]>({
    queryKey: queryKeys.publicationWeek(activeCompanyId, instructorId, weekStart),
    enabled: !!activeCompanyId && !!instructorId,
    staleTime: STALE_TIMES.availability,
    queryFn: async () => {
      const id = instructorId!;
      const wsDate = new Date(weekStart + 'T00:00:00Z');
      const weStr = ymd(new Date(wsDate.getTime() + 6 * 86400000));

      const overridesRes = await regloApi.getDailyAvailabilityOverrides({
        ownerType: 'instructor', ownerId: id, from: weekStart, to: weStr,
      });

      const newDays: DayState[] = [];
      for (let i = 0; i < 7; i++) {
        const dateStr = ymd(new Date(wsDate.getTime() + i * 86400000));
        const ranges = (overridesRes.find((o) => o.date?.slice(0, 10) === dateStr)?.ranges ?? []) as TimeRange[];
        newDays.push({ date: dateStr, available: ranges.length > 0, ranges: ranges.length ? ranges : [...DEFAULT_RANGES] });
      }
      return newDays;
    },
  });
};
