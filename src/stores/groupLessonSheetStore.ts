/**
 * Drives the `home/create-group-lesson` route — the instructor/owner "Crea guida
 * di gruppo" flow. The parent (IstruttoreHomeScreen) seeds the initial day + a
 * success callback; the route loads its own vehicles/instructors/eligible
 * students, runs `regloApi.createGroupLesson` (optionally broadcasting an invite),
 * then on success calls `onDone` (toast) and dismisses. The home's focus listener
 * reloads the agenda so the new group lesson appears. Seed-and-callback pattern.
 */
export type GroupLessonSheetData = {
  /** ISO string of the day the sheet opens on (default lesson date). */
  initialDate: string;
  /** Success toast after the group lesson is created. */
  onDone: (message: string) => void;
};

let _data: GroupLessonSheetData | null = null;
const _listeners = new Set<() => void>();

export const groupLessonSheetStore = {
  set(data: GroupLessonSheetData) {
    _data = data;
    _listeners.forEach((fn) => fn());
  },
  get(): GroupLessonSheetData | null {
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
