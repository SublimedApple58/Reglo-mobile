import type { AutoscuolaAppointmentWithRelations } from '../types/regloApi';

/**
 * Drives the `home/exam-manage` native page-sheet route — the instructor's exam
 * detail/management sheet (header, modifica orario, allievi list, note, annulla).
 * The opener (IstruttoreHomeScreen / day-detail) seeds the exam group + an
 * `onChanged` callback (loadData refresh), then pushes the route. Seed-and-callback
 * pattern: the route owns local state and mutates via regloApi, calling onChanged
 * to refresh the opener. Sibling of the student-side `examDetailStore`.
 */
export type ExamManageData = {
  startsAt: string;
  endsAt: string | null;
  instructorId: string | null;
  instructorName: string | null;
  notes: string | null;
  appointments: AutoscuolaAppointmentWithRelations[];
  onChanged: () => void;
  /** Owner/titolare view-only: nessuna azione mutante (orario, allievi, annulla). */
  readOnly?: boolean;
};

let _data: ExamManageData | null = null;
const _listeners = new Set<() => void>();

export const examManageStore = {
  set(data: ExamManageData) {
    _data = data;
    _listeners.forEach((fn) => fn());
  },
  get(): ExamManageData | null {
    return _data;
  },
  clear() {
    _data = null;
    _listeners.forEach((fn) => fn());
  },
  subscribe(fn: () => void) {
    _listeners.add(fn);
    return () => { _listeners.delete(fn); };
  },
};
