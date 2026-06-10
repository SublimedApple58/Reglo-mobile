import type { AutoscuolaInstructor, AutoscuolaVehicle } from '../types/regloApi';

/**
 * Drives the `home/manage-group-lesson` page sheet (instructor "Gestisci guida
 * di gruppo") and its `home/manage-group-lesson-participants` roster form sheet.
 *
 * Seed-and-callback: the parent screen (IstruttoreHomeScreen) publishes the
 * group lesson id, the instructor/vehicle lists (for the pickers) and the
 * vehicles-enabled flag, plus an `onChanged` (refresh agenda) and `onClosed`
 * callback. The modal route loads the full `GroupLesson` detail itself via
 * `regloApi.getGroupLesson` and re-loads after every mutation.
 */
export type GroupLessonManageData = {
  groupLessonId: string;
  instructors: AutoscuolaInstructor[];
  vehicles: AutoscuolaVehicle[];
  vehiclesEnabled: boolean;
  /** Called after any successful mutation (refresh the agenda). */
  onChanged: () => void;
  /** Called when the main route is dismissed (popped). */
  onClosed?: () => void;
  /** Owner/titolare view-only: nessuna azione mutante (roster, istruttore, veicolo, sposta, annulla). */
  readOnly?: boolean;
};

let _data: GroupLessonManageData | null = null;
const _listeners = new Set<() => void>();

export const groupLessonManageStore = {
  set(data: GroupLessonManageData) {
    _data = data;
    _listeners.forEach((fn) => fn());
  },
  get(): GroupLessonManageData | null {
    return _data;
  },
  clear() {
    _data = null;
    _listeners.forEach((fn) => fn());
  },
  subscribe(fn: () => void) {
    _listeners.add(fn);
    return () => {
      _listeners.delete(fn);
    };
  },
};
