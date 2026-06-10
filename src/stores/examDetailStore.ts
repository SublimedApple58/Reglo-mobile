import type { AutoscuolaAppointmentWithRelations } from '../types/regloApi';

type ExamDetailData = {
  exam: AutoscuolaAppointmentWithRelations;
  countdown: { days: number; label: string } | null;
};

let _data: ExamDetailData | null = null;
const _listeners = new Set<() => void>();

export const examDetailStore = {
  set(data: ExamDetailData) {
    _data = data;
    _listeners.forEach((fn) => fn());
  },
  get(): ExamDetailData | null {
    return _data;
  },
  clear() {
    _data = null;
  },
  subscribe(fn: () => void) {
    _listeners.add(fn);
    return () => { _listeners.delete(fn); };
  },
};
