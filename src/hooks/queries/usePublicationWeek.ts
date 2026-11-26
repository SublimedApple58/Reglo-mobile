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
 * One publication-mode week resolved to 7 DayState rows. The queryFn loads
 * this week's overrides and, for an unpublished week, fills every day WITHOUT
 * an override the way `publishInstructorWeek` will materialize it (REG-799):
 * same weekday of the last published week BEFORE this one, else the base
 * weekly availability. Before, the pre-fill applied only to a week with no
 * override at all: after saving one day the others showed «Riposo», then
 * publishing filled them with the previous week's hours. `isPublished` is
 * passed (not part of the key) so toggling publish doesn't refetch the rows.
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
      const overrideDates = new Set(overridesRes.map((o) => o.date?.slice(0, 10)));

      // Stessa catena di publishInstructorWeek: ultima settimana pubblicata
      // precedente; se non c'è (o è vuota), la disponibilità predefinita.
      let templateFor: ((dow: number) => TimeRange[]) | null = null;
      if (!opts.isPublished && overrideDates.size < 7) {
        try {
          const allPublished = await regloApi.getPublishedWeeks({ instructorId: id, from: '2020-01-01', to: weekStart });
          const previous = allPublished
            .map((pw) => pw.weekStart.slice(0, 10))
            .filter((w) => w < weekStart)
            .sort((a, b) => b.localeCompare(a))[0];
          let templateOverrides: typeof overridesRes = [];
          if (previous) {
            const prevWs = new Date(previous + 'T00:00:00Z');
            const prevWe = new Date(prevWs.getTime() + 6 * 86400000);
            templateOverrides = await regloApi.getDailyAvailabilityOverrides({
              ownerType: 'instructor', ownerId: id, from: previous, to: ymd(prevWe),
            });
          }
          if (templateOverrides.length) {
            templateFor = (dow) => {
              const tpl = templateOverrides.find((o) => new Date(o.date?.slice(0, 10) + 'T00:00:00Z').getUTCDay() === dow);
              return tpl?.ranges?.length ? (tpl.ranges as TimeRange[]) : [];
            };
          } else {
            const base = await regloApi.getDefaultAvailability({ ownerType: 'instructor', ownerId: id });
            if (base) {
              const byDay = base.scheduleByDay && Object.keys(base.scheduleByDay).length ? base.scheduleByDay : null;
              templateFor = (dow) =>
                byDay ? byDay[dow] ?? [] : base.daysOfWeek.includes(dow) ? base.ranges : [];
            }
          }
        } catch { /* skip pre-fill */ }
      }

      const newDays: DayState[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(wsDate.getTime() + i * 86400000);
        const dateStr = ymd(d);
        const override = overridesRes.find((o) => o.date?.slice(0, 10) === dateStr);
        if (override) {
          const ranges = (override.ranges ?? []) as TimeRange[];
          newDays.push({ date: dateStr, available: ranges.length > 0, ranges: ranges.length ? ranges : [...DEFAULT_RANGES] });
        } else if (templateFor) {
          const tplRanges = templateFor(d.getUTCDay());
          newDays.push({ date: dateStr, available: tplRanges.length > 0, ranges: tplRanges.length > 0 ? tplRanges : [...DEFAULT_RANGES] });
        } else {
          newDays.push({ date: dateStr, available: false, ranges: [...DEFAULT_RANGES] });
        }
      }
      return newDays;
    },
  });
};
