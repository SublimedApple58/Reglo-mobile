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
 * One publication-mode week resolved to 7 DayState rows. The queryFn does the
 * composite work the screen used to do imperatively: load this week's overrides,
 * and — for a fresh, unpublished, override-less week — pre-fill from the most
 * recent published week as a template. `isPublished` is passed (not part of the
 * key) so toggling publish doesn't refetch the day rows.
 */
export const usePublicationWeek = (
  instructorId: string | null,
  weekStart: string,
  opts: { isPublished: boolean },
) => {
  const { activeCompanyId } = useSession();

  return useQuery<DayState[]>({
    queryKey: queryKeys.publicationWeek(activeCompanyId, instructorId, weekStart),
    enabled: !!activeCompanyId && !!instructorId,
    staleTime: STALE_TIMES.availability,
    queryFn: async () => {
      const id = instructorId!;
      const wsDate = new Date(weekStart + 'T00:00:00Z');
      const we = new Date(wsDate.getTime() + 6 * 86400000);
      const weStr = ymd(we);

      const overridesRes = await regloApi.getDailyAvailabilityOverrides({
        ownerType: 'instructor', ownerId: id, from: weekStart, to: weStr,
      });
      const hasAnyOverride = overridesRes.length > 0;

      let templateOverrides: typeof overridesRes = [];
      if (!hasAnyOverride && !opts.isPublished) {
        try {
          const allPublished = await regloApi.getPublishedWeeks({ instructorId: id, from: '2020-01-01', to: weekStart });
          const previous = allPublished
            .filter((pw) => pw.weekStart < weekStart)
            .sort((a, b) => b.weekStart.localeCompare(a.weekStart))[0];
          if (previous) {
            const prevWs = new Date(previous.weekStart + 'T00:00:00Z');
            const prevWe = new Date(prevWs.getTime() + 6 * 86400000);
            templateOverrides = await regloApi.getDailyAvailabilityOverrides({
              ownerType: 'instructor', ownerId: id, from: previous.weekStart, to: ymd(prevWe),
            });
          }
        } catch { /* skip pre-fill */ }
      }

      const newDays: DayState[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(wsDate.getTime() + i * 86400000);
        const dateStr = ymd(d);
        const override = overridesRes.find((o) => o.date?.slice(0, 10) === dateStr);
        if (override?.ranges?.length) {
          newDays.push({ date: dateStr, available: true, ranges: override.ranges as TimeRange[] });
        } else if (templateOverrides.length > 0) {
          const tpl = templateOverrides.find((o) => new Date(o.date?.slice(0, 10) + 'T00:00:00Z').getUTCDay() === d.getUTCDay());
          const tplRanges: TimeRange[] = tpl?.ranges?.length ? (tpl.ranges as TimeRange[]) : [];
          newDays.push({ date: dateStr, available: tplRanges.length > 0, ranges: tplRanges.length > 0 ? tplRanges : [...DEFAULT_RANGES] });
        } else {
          newDays.push({ date: dateStr, available: false, ranges: [...DEFAULT_RANGES] });
        }
      }
      return newDays;
    },
  });
};
