import type { AutoscuolaAppointmentWithRelations } from '../types/regloApi';

type AllLessonsData = {
  lessons: AutoscuolaAppointmentWithRelations[];
  /** L'allievo aperto: serve al segmento "Annullate" per il fetch storico. */
  studentId: string | null;
  onOpenDetail: (lesson: AutoscuolaAppointmentWithRelations) => void;
};

let _data: AllLessonsData | null = null;
const _listeners = new Set<() => void>();

export const allLessonsStore = {
  set(data: AllLessonsData) {
    _data = data;
    _listeners.forEach((fn) => fn());
  },
  get(): AllLessonsData | null {
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
