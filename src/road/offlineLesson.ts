import { RegloApiError } from '../services/apiClient';
import type { AppointmentEvaluation, UpdateAppointmentDetailsInput } from '../types/regloApi';
import { roadQueue } from './queue';
import { roadUploader } from './uploader';

/**
 * REG-714 Reglo Road — note e pagellino anche senza rete.
 *
 * - Il pagellino della guida si legge all'ingresso in Road e si tiene qui
 *   (`cacheRoadEvaluation`): senza rete il foglio si apre lo stesso, con i
 *   voti già messi in coda.
 * - Un salvataggio che non arriva al server per la rete (nessuna risposta,
 *   5xx, login scaduto) va in coda (`roadQueue.pushLessonOp`, vince l'ultimo)
 *   e parte da solo quando torna la rete. Un rifiuto vero (4xx) resta un errore.
 */

/** Il salvataggio è fallito per la rete (o il login scaduto): si può mettere in coda. */
export function isOfflineError(err: unknown): boolean {
  if (!(err instanceof RegloApiError)) return true;
  return !err.status || err.status >= 500 || err.status === 401;
}

const evaluations = new Map<string, AppointmentEvaluation>();

export function cacheRoadEvaluation(appointmentId: string, data: AppointmentEvaluation | null | undefined) {
  if (data) evaluations.set(appointmentId, data);
}

/** Pagellino letto in Road, con sopra i voti ancora in coda (null = mai letto). */
export function cachedRoadEvaluation(appointmentId: string): AppointmentEvaluation | null {
  const base = evaluations.get(appointmentId);
  if (!base) return null;
  const queued = roadQueue.queuedLesson(appointmentId, 'evaluations')?.evaluations;
  return queued ? { ...base, scores: queued } : base;
}

/** Note o pagellino in coda: partono appena torna la rete. */
export async function queueLessonPatch(
  appointmentId: string,
  kind: 'notes' | 'evaluations',
  patch: UpdateAppointmentDetailsInput,
) {
  await roadQueue.pushLessonOp(appointmentId, kind, patch);
  roadUploader.ensureRunning();
}
