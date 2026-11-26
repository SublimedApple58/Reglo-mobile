import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '../../context/SessionContext';
import { regloApi } from '../../services/regloApi';
import { mergeAvailabilitySlots, toDateKey } from '../../components/schoolDay/schoolDayModel';
import type { SchoolAvailability } from '../../components/schoolDay/types';
import { queryKeys, STALE_TIMES } from './queryKeys';

const addDays = (d: Date, n: number) => {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
};

const fetchWeek = async (monday: Date): Promise<SchoolAvailability> => {
  const slots = await regloApi.getAvailabilitySlots({
    ownerType: 'instructor',
    from: toDateKey(monday),
    to: toDateKey(addDays(monday, 6)),
  });
  return mergeAvailabilitySlots(Array.isArray(slots) ? slots : []);
};

/**
 * Disponibilità di TUTTI gli istruttori per la settimana di `monday` (REG-794):
 * una sola chiamata a `availability/slots` senza ownerId, in cache 5 minuti, e
 * le settimane vicine precaricate (cambiare giorno non chiama la rete).
 * Ripiego finché non c'è la rotta dedicata: vedi `mergeAvailabilitySlots`.
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
