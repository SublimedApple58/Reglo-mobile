import type { AutoscuolaAppointmentWithRelations, RoadStudentItem } from '../types/regloApi';

/**
 * Seed del foglio «Tutte le guide» del dettaglio allievo (29/10/2026): la
 * scheda mostra solo le ultime 5, qui c'è l'elenco intero. Stesso pattern
 * seed-and-callback degli altri fogli nativi: la scheda tiene dati e chiamate
 * e ripubblica il seed a ogni ricarica, il foglio disegna.
 */
export type LessonHistoryData = {
  studentName: string | null;
  /** Prossime guide, dalla più vicina. */
  upcoming: AutoscuolaAppointmentWithRelations[];
  /** Storico (già svolte), dalla più recente. */
  past: AutoscuolaAppointmentWithRelations[];
  roadByLesson: Map<string, RoadStudentItem>;
  savingId: string | null;
  onDetails: (appt: AutoscuolaAppointmentWithRelations) => void;
  onOutcome: (appt: AutoscuolaAppointmentWithRelations) => void;
  onRoad: (appointmentId: string) => void;
};

let _data: LessonHistoryData | null = null;
const _listeners = new Set<() => void>();

export const lessonHistoryStore = {
  set(data: LessonHistoryData) {
    _data = data;
    _listeners.forEach((fn) => fn());
  },
  get(): LessonHistoryData | null {
    return _data;
  },
  subscribe(fn: () => void) {
    _listeners.add(fn);
    return () => {
      _listeners.delete(fn);
    };
  },
};
