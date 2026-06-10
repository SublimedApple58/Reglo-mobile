/**
 * Drives the `home/group-lesson-detail` page sheet — the STUDENT-facing view of
 * a group lesson they are enrolled in, with the "Ritira iscrizione" action.
 *
 * Seed-and-callback: AllievoHomeScreen publishes the group lesson id (the route
 * loads the student-safe detail itself via `regloApi.getGroupLesson`, which
 * hides the other participants' names), the penalty cutoff hours (to warn about
 * a late withdrawal) and an `onChanged` callback to refresh the home after a
 * successful withdrawal.
 */
export type GroupLessonStudentData = {
  groupLessonId: string;
  /** Company penalty cutoff (hours). 0 = no late-withdrawal warning. */
  cutoffHours: number;
  /** Whether late cancellations can be charged (autoPayments || creditFlow). */
  penaltyEnabled: boolean;
  /** Called after a successful withdrawal (refresh the home). */
  onChanged: () => void;
  /** Called when the route is dismissed (popped). */
  onClosed?: () => void;
};

let _data: GroupLessonStudentData | null = null;
const _listeners = new Set<() => void>();

export const groupLessonStudentStore = {
  set(data: GroupLessonStudentData) {
    _data = data;
    _listeners.forEach((fn) => fn());
  },
  get(): GroupLessonStudentData | null {
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
