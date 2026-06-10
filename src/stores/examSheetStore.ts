/**
 * Drives the native `home/create-exam` formSheet — the instructor's "Crea esame"
 * flow. The parent (IstruttoreHomeScreen) seeds the initial day + a success
 * callback; the route loads its own student list, runs `regloApi.createExam`
 * (keeping the sheet open in loading until the response), then on success calls
 * `onDone` (toast) and dismisses. The home's focus listener reloads the agenda so
 * the new exam appears. No optimistic insert (multi-student). Mirrors the lighter
 * seed-and-callback stores.
 */
export type ExamSheetData = {
  /** ISO string of the day the sheet opens on (default exam date). */
  initialDate: string;
  /** Success toast after the exam is created. */
  onDone: (message: string) => void;
};

let _data: ExamSheetData | null = null;
const _listeners = new Set<() => void>();

export const examSheetStore = {
  set(data: ExamSheetData) {
    _data = data;
    _listeners.forEach((fn) => fn());
  },
  get(): ExamSheetData | null {
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
