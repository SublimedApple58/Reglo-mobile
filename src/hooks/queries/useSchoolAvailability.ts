import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '../../context/SessionContext';
import { regloApi } from '../../services/regloApi';
import { mergeAvailabilitySlots, toDateKey } from '../../components/schoolDay/schoolDayModel';
import type { AvailWindow, SchoolAvailability } from '../../components/schoolDay/types';
import type { AgendaInstructorAvailability } from '../../types/regloApi';
import { RegloApiError } from '../../services/apiClient';
import { queryKeys, STALE_TIMES } from './queryKeys';

const addDays = (d: Date, n: number) => {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
};

// La rotta di REG-795 può mancare (app aggiornata in OTA prima del backend):
// al primo 404 si passa al ripiego per tutta la sessione, senza riprovarla.
let agendaRouteMissing = false;

const toAvailability = (rows: AgendaInstructorAvailability[]): SchoolAvailability => {
  const out: SchoolAvailability = {};
  for (const row of rows) {
    const days: Record<string, AvailWindow[]> = {};
    for (const [day, windows] of Object.entries(row.days ?? {})) {
      days[day] = windows
        .map((w) => ({ startMinutes: w.startMinutes, endMinutes: w.endMinutes }))
        .sort((a, b) => a.startMinutes - b.startMinutes);
    }
    out[row.instructorId] = days;
  }
  return out;
};

/** Ripiego: gli slot da 30' di tutti, fusi in fasce (non vede le settimane pubblicate). */
const fetchWeekFromSlots = async (monday: Date): Promise<SchoolAvailability> => {
  const slots = await regloApi.getAvailabilitySlots({
    ownerType: 'instructor',
    from: toDateKey(monday),
    to: toDateKey(addDays(monday, 6)),
  });
  return mergeAvailabilitySlots(Array.isArray(slots) ? slots : []);
};

const fetchWeek = async (monday: Date): Promise<SchoolAvailability> => {
  if (!agendaRouteMissing) {
    try {
      const rows = await regloApi.getAgendaAvailability({
        from: toDateKey(monday),
        to: toDateKey(addDays(monday, 7)),
      });
      return toAvailability(Array.isArray(rows) ? rows : []);
    } catch (err) {
      if (!(err instanceof RegloApiError) || err.status !== 404) throw err;
      agendaRouteMissing = true;
    }
  }
  return fetchWeekFromSlots(monday);
};

/**
 * Disponibilità di TUTTI gli istruttori per la settimana di `monday` (REG-794):
 * una chiamata a `agenda/availability` (REG-795, fasce identiche al web), in
 * cache 5 minuti, e le settimane vicine precaricate (cambiare giorno non chiama
 * la rete). Se la rotta non c'è (404) ripiega su `availability/slots`.
 */
export function useSchoolAvailability(monday: Date | null): SchoolAvailability {
  const { activeCompanyId } = useSession();
  const queryClient = useQueryClient();
  const weekKey = monday ? toDateKey(monday) : '';
  const query = useQuery<SchoolAvailability>({
    queryKey: queryKeys.schoolAvailability(activeCompanyId, weekKey),
    queryFn: () => fetchWeek(monday!),
    enabled: !!activeCompanyId && !!monday,
    staleTime: STALE_TIMES.availability,
    placeholderData: (prev) => prev,
  });
  useEffect(() => {
    if (!monday || !activeCompanyId) return;
    for (const offset of [-7, 7]) {
      const m = addDays(monday, offset);
      void queryClient.prefetchQuery({
        queryKey: queryKeys.schoolAvailability(activeCompanyId, toDateKey(m)),
        queryFn: () => fetchWeek(m),
        staleTime: STALE_TIMES.availability,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekKey, activeCompanyId, queryClient]);
  return useMemo(() => query.data ?? {}, [query.data]);
}
