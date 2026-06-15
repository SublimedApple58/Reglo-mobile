import type { AutoscuolaAppointmentWithRelations } from '../types/regloApi';

type LessonDetailData = {
  lesson: AutoscuolaAppointmentWithRelations;
  canSwap: boolean;
  canCancel: boolean;
  vehiclesEnabled: boolean;
  /** Set when an active swap request already exists for this lesson. */
  activeSwapOfferId?: string | null;
  onSwap: (id: string) => void;
  onCancel: (id: string) => void;
  onRevokeSwap?: (offerId: string) => void;
};

let _data: LessonDetailData | null = null;
const _listeners = new Set<() => void>();

export const lessonDetailStore = {
  set(data: LessonDetailData) {
    _data = data;
    _listeners.forEach((fn) => fn());
  },
  get(): LessonDetailData | null {
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
