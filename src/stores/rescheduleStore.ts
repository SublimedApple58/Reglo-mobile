import type { AutoscuolaAppointmentWithRelations } from '../types/regloApi';

/**
 * Drives the `home/reschedule-lesson` formSheet ("Sposta guida"). The route owns
 * the date/time drafts + the reschedule API call; the parent provides the lesson
 * and success/error callbacks (toast + refresh of the open manage-lesson sheet).
 */
export type RescheduleData = {
  lesson: AutoscuolaAppointmentWithRelations;
  onSuccess: (newStartsAt: string) => void;
  onError: (message: string) => void;
};

let _data: RescheduleData | null = null;
const _listeners = new Set<() => void>();

export const rescheduleStore = {
  set(data: RescheduleData) {
    _data = data;
    _listeners.forEach((fn) => fn());
  },
  get(): RescheduleData | null {
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
