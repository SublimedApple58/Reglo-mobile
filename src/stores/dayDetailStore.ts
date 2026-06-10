import type { DayPlan, DayGroupLessonGroup } from '../utils/weeklyAgenda';
import type { AutoscuolaAppointmentWithRelations, InstructorBlock } from '../types/regloApi';

// Drives the home/day-detail page sheet. The weekly overview (via the screen)
// publishes the tapped day's computed plan + the date + the same action handlers
// the day view uses, then pushes the route. Seed-and-callback pattern.
export type DayDetailStoreData = {
  date: Date;
  plan: DayPlan;
  onQuickBook: (date: Date, startMin: number, windowStart: number, windowEnd: number) => void;
  onOpenLesson: (appt: AutoscuolaAppointmentWithRelations) => void;
  onOpenExam: (appts: AutoscuolaAppointmentWithRelations[]) => void;
  onOpenGroupLesson: (group: DayGroupLessonGroup) => void;
  onOpenBlock: (block: InstructorBlock) => void;
};

let _data: DayDetailStoreData | null = null;
const _listeners = new Set<() => void>();

export const dayDetailStore = {
  set(data: DayDetailStoreData) {
    _data = data;
    _listeners.forEach((fn) => fn());
  },
  get(): DayDetailStoreData | null {
    return _data;
  },
  subscribe(fn: () => void) {
    _listeners.add(fn);
    return () => { _listeners.delete(fn); };
  },
};
