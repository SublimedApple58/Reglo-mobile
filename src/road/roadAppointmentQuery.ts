import { useQuery, type QueryClient } from '@tanstack/react-query';
import { regloApi } from '../services/regloApi';

/**
 * Percorso Road di una guida (dettaglio guida dell'istruttore), in cache React
 * Query: l'Agenda lo chiede già al tocco del blocco (`prefetchRoadForAppointment`)
 * così il foglio si apre con la card al suo posto, senza comparire dopo
 * (REG-639 fluidità). Fuori dalla cache su file: il tracciato pesa.
 */
export const roadAppointmentKey = (appointmentId: string) => ['road-appointment', appointmentId] as const;

const STALE_MS = 5 * 60_000;

const fetchRoad = (appointmentId: string) =>
  regloApi.getRoadForAppointment(appointmentId).then((d) => d ?? null);

/** Road ha senso solo per guide già partite. */
const hasStarted = (startsAt: string) => new Date(startsAt).getTime() <= Date.now();

export function prefetchRoadForAppointment(
  queryClient: QueryClient,
  lesson: { id: string; startsAt: string; type?: string | null; groupLessonId?: string | null },
  roadEnabled: boolean,
) {
  if (!roadEnabled || !hasStarted(lesson.startsAt) || lesson.type === 'esame' || lesson.groupLessonId) return;
  void queryClient.prefetchQuery({
    queryKey: roadAppointmentKey(lesson.id),
    queryFn: () => fetchRoad(lesson.id),
    staleTime: STALE_MS,
    meta: { persist: false },
  });
}

export function useRoadForAppointment(appointmentId: string, startsAt: string, enabled: boolean) {
  return useQuery({
    queryKey: roadAppointmentKey(appointmentId),
    queryFn: () => fetchRoad(appointmentId),
    enabled: enabled && hasStarted(startsAt),
    staleTime: STALE_MS,
    meta: { persist: false },
  });
}
