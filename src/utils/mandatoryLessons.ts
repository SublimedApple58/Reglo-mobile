/**
 * Guide obbligatorie: quante sono e quali guide ci entrano.
 *
 * Criterio (2026-06-12): **solo le guide da esattamente 60 minuti**. Una guida
 * di altra durata non è obbligatoria e non consuma uno dei 6 posti. Il
 * contatore "x/6" contava invece tutte le guide completate, comprese quelle da
 * 30 minuti — stesso bug che c'era sul web.
 *
 * `endsAt` nullo NON conta: guida senza fine registrata.
 *
 * Gemello web: `reglo/lib/autoscuole/mandatory-lessons.ts` — le due copie vanno
 * cambiate insieme.
 */

export const REQUIRED_LESSONS = 6;

export const MANDATORY_LESSON_MINUTES = 60;

const MANDATORY_LESSON_MS = MANDATORY_LESSON_MINUTES * 60 * 1000;

/** True se la guida dura esattamente 60 minuti, quindi conta per l'obbligo. */
export const isMandatoryLessonDuration = (lesson: {
  startsAt: string;
  endsAt?: string | null;
}): boolean => {
  if (!lesson.endsAt) return false;
  const start = new Date(lesson.startsAt).getTime();
  const end = new Date(lesson.endsAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
  return end - start === MANDATORY_LESSON_MS;
};
