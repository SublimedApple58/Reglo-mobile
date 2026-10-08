/**
 * «Orario da definire» (REG-604).
 *
 * Un esame può esistere senza orario: l'autoscuola fissa la data e comunica
 * la convocazione a voce, a volte il giorno prima. In quel caso il backend
 * salva `startsAt` alla **mezzanotte** come segnaposto e lascia `endsAt` a
 * null — quindi chiunque formatti `startsAt` senza guardare `endsAt` scrive
 * «00:00». Era così in sei punti dell'app allievo.
 *
 * ⚠️ Non confondere con `isExamPlaceholder` (`utils/weeklyAgenda.ts`), che è
 * `type === 'esame' && !studentId`: quello è l'esame senza **allievi**, un
 * concetto diverso. Le scritte «Orario da definire» degli schermi istruttore
 * sono attaccate a quello. Il marcatore giusto qui è `!endsAt`.
 */

export const EXAM_TIME_TBD = 'Orario da definire';
export const EXAM_TIME_TBD_SHORT = 'orario da definire';

type TimedAppointment = { type?: string | null; endsAt?: string | null };

const isExam = (appt: TimedAppointment) =>
  (appt.type ?? '').trim().toLowerCase() === 'esame';

/** L'orario è stato definito dall'autoscuola? */
export const examTimeKnown = (appt: TimedAppointment) => Boolean(appt.endsAt);

/**
 * `true` solo per l'esame **senza** orario: è l'unico caso in cui l'ora va
 * sostituita da una scritta. Le guide hanno sempre `endsAt`.
 */
export const examTimeIsTbd = (appt: TimedAppointment) => isExam(appt) && !appt.endsAt;
