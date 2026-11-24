/**
 * REG-782 — il limite settimanale a guide o a ore (minuti), lato app.
 * Gli spazi tra numero e unità sono indivisibili: «1 ora e 30» non va mai a capo a metà.
 */
const NBSP = ' ';

export type WeeklyLimitUnit = 'lessons' | 'minutes';

export const WEEKLY_LIMIT_MINUTES_DEFAULT = 240;
/** Stepper a mezz'ore: da 30 minuti a 50 ore (come il web: 30–3000 minuti). */
export const WEEKLY_LIMIT_HALF_HOURS_MIN = 1;
export const WEEKLY_LIMIT_HALF_HOURS_MAX = 100;

/** «1 ora e 30», «3 ore», «45 minuti». */
export function formatDrivingMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}${NBSP}minuti`;
  const hours = h === 1 ? `1${NBSP}ora` : `${h}${NBSP}ore`;
  return m ? `${hours}${NBSP}e${NBSP}${m}` : hours;
}

/** Valore compatto dello stepper: «4 h 30», «4 h». */
export function formatHalfHours(halfHours: number): string {
  const minutes = halfHours * 30;
  const h = Math.floor(minutes / 60);
  return minutes % 60 ? `${h}${NBSP}h${NBSP}30` : `${h}${NBSP}h`;
}
