/**
 * Guide obbligatorie: quante ore servono e quali guide ci entrano.
 *
 * Due regole diverse, per due domande diverse:
 *
 * 1. **Quanto manca all'obbligo** (contatore della lista Allievi e della scheda
 *    allievo) — dal 2026-11-07 si contano le **ore guidate**, non le guide, come
 *    sul web dal REG-726. Prima contavano solo le guide da esattamente 60
 *    minuti: un allievo con quattro guide da mezz'ora restava a 0 di 6, e una
 *    guida Road (che finisce all'orario reale, es. 55' o 65') non contava.
 *    Ora ogni guida completata vale i suoi minuti; il totale si mostra a
 *    mezz'ore (`creditedMinutes`). Quando le obbligatorie passeranno a 8 ore si
 *    cambia `REQUIRED_DRIVING_HOURS`.
 *
 * 2. **Quali guide sono «obbligatorie»** (colori dell'agenda) — resta il
 *    criterio del 2026-06-12: guide da esattamente 60 minuti
 *    (`isMandatoryLessonDuration`).
 *
 * Gemello web: `reglo/lib/autoscuole/mandatory-lessons.ts` — le due copie vanno
 * cambiate insieme.
 */

export const MANDATORY_LESSON_MINUTES = 60;

const MANDATORY_LESSON_MS = MANDATORY_LESSON_MINUTES * 60 * 1000;

/** True se la guida dura esattamente 60 minuti (colori dell'agenda). */
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

/** Ore di guida obbligatorie. Quando diventano 8, si cambia qui. */
export const REQUIRED_DRIVING_HOURS = 6;

export const REQUIRED_DRIVING_MINUTES = REQUIRED_DRIVING_HOURS * 60;

/** Il contatore avanza a mezz'ore. */
export const DRIVING_STEP_MINUTES = 30;

/**
 * Tolleranza sul gradino: le guide Road finiscono all'orario reale arrotondato
 * ai 5 minuti, quindi un'ora guidata può valere 55'. Senza tolleranza
 * risulterebbe mezz'ora.
 */
const STEP_TOLERANCE_MINUTES = 5;

/** Minuti di una guida; nessuna fine (o fine prima dell'inizio) = 0. */
export const lessonMinutes = (lesson: { startsAt: string; endsAt?: string | null }): number => {
  if (!lesson.endsAt) return 0;
  const ms = new Date(lesson.endsAt).getTime() - new Date(lesson.startsAt).getTime();
  return Number.isFinite(ms) && ms > 0 ? Math.round(ms / 60000) : 0;
};

/** Minuti totali portati a mezz'ore piene (con la tolleranza Road). */
export const creditedMinutes = (totalMinutes: number): number =>
  Math.floor((Math.max(0, totalMinutes) + STEP_TOLERANCE_MINUTES) / DRIVING_STEP_MINUTES) *
  DRIVING_STEP_MINUTES;

/** Minuti dell'obbligo in ore all'italiana: 150 → "2,5", 360 → "6". */
export const formatDrivingHours = (minutes: number): string => {
  const hours = Math.round((minutes / 60) * 10) / 10;
  return String(hours).replace('.', ',');
};

/** «Manca mezz'ora», «Manca 1 ora», «Mancano 3,5 ore». */
export const drivingHoursRemainingLabel = (minutes: number): string => {
  if (minutes === 30) return 'Manca mezz’ora';
  if (minutes === 60) return 'Manca 1 ora';
  return `Mancano ${formatDrivingHours(minutes)} ore`;
};
