import type { InstructorToday } from '../components/ownerToday/todayModel';

/**
 * Seed del foglio istruttore di «Oggi» (`today/instructor`, REG-794): la sua
 * giornata già calcolata, il telefono e le azioni. Il chiamante pubblica, poi
 * pusha la route.
 */
export type OwnerTodayInstructorData = {
  day: InstructorToday;
  phone: string | null;
  /** Il titolare-istruttore guarda sé stesso («la tua settimana»). */
  isMe: boolean;
  onAvailability: () => void;
  /** Per sé stessi: il foglio malattia in Agenda. */
  onSick: () => void;
  /** REG-794: per un collega, «Assenze» apre la sua disponibilità sulle Assenze. */
  onAbsences: () => void;
  /** La prossima assenza in breve («Ferie dal 22 dic»), se c'è. */
  absenceLine: string | null;
  onWeek: () => void;
};

let _data: OwnerTodayInstructorData | null = null;
const _listeners = new Set<() => void>();

export const ownerTodayInstructorStore = {
  set(data: OwnerTodayInstructorData) {
    _data = data;
    _listeners.forEach((fn) => fn());
  },
  get(): OwnerTodayInstructorData | null {
    return _data;
  },
  subscribe(fn: () => void) {
    _listeners.add(fn);
    return () => {
      _listeners.delete(fn);
    };
  },
};
