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
  onSick: () => void;
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
