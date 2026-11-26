import { useQuery } from '@tanstack/react-query';
import { useSession } from '../../context/SessionContext';
import { regloApi } from '../../services/regloApi';
import { ABSENCE_REASON, groupAbsencePeriods, type AbsencePeriod } from '../../utils/absencePeriods';
import { queryKeys, STALE_TIMES } from './queryKeys';

/** Quanto indietro si guardano le assenze: i periodi appena passati restano in elenco. */
const BACK_DAYS = 120;
const AHEAD_DAYS = 365;

/** Date dentro i periodi: la cache persistita le riporta a stringa. Fuori dal hook: stabile, gira solo quando cambiano i dati. */
const reviveDates = (periods: AbsencePeriod[]): AbsencePeriod[] =>
  periods.map((p) => ({ ...p, start: new Date(p.start), end: new Date(p.end) }));

/**
 * REG-794: malattie e ferie come periodi (`instructor-blocks` per motivo).
 * Con `instructorId` quelle di un istruttore (sezione Assenze); con `null`
 * quelle di tutta la scuola (riga «Assenze» del foglio di Oggi).
 */
export const useInstructorAbsences = (instructorId: string | null, enabled = true) => {
  const { activeCompanyId } = useSession();

  return useQuery<AbsencePeriod[]>({
    queryKey: queryKeys.instructorAbsences(activeCompanyId, instructorId),
    queryFn: async () => {
      const now = Date.now();
      const from = new Date(now - BACK_DAYS * 86400_000).toISOString();
      const to = new Date(now + AHEAD_DAYS * 86400_000).toISOString();
      const base = { ...(instructorId ? { instructorId } : {}), from, to };
      const [sick, ferie] = await Promise.all([
        regloApi.getInstructorBlocks({ ...base, reason: ABSENCE_REASON.sick }),
        regloApi.getInstructorBlocks({ ...base, reason: ABSENCE_REASON.ferie }),
      ]);
      return groupAbsencePeriods([...sick, ...ferie]);
    },
    enabled: enabled && !!activeCompanyId,
    staleTime: STALE_TIMES.instructorBlocks,
    select: reviveDates,
  });
};
