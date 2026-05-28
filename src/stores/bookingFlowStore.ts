import type { AvailableSlot, AutoscuolaInstructor } from '../types/regloApi';

type CalendarMonth = {
  year: number;
  month: number;
  label: string;
  cells: Date[];
};

export type BookingFlowState = {
  // Interactive state (owned by store)
  step: 1 | 2;
  preferredDate: Date;
  durationMinutes: number;
  selectedLessonTypes: string[];
  selectedInstructorId: string | null;
  selectedSlot: AvailableSlot | null;
  calendarOpen: boolean;

  // Business data (synced from parent)
  slots: AvailableSlot[];
  slotsLoading: boolean;
  loading: boolean;
  preferredDateAvailable: boolean;
  availableDurations: number[];
  availableLessonTypes: string[];
  canSelectLessonType: boolean;
  canSelectInstructor: boolean;
  isLockedToInstructor: boolean;
  assignedInstructorName: string | null;
  visibleInstructors: AutoscuolaInstructor[];
  creditFlowEnabled: boolean;
  creditsAvailable: number;
  autoPaymentsEnabled: boolean;
  calendarMonths: CalendarMonth[];
  bookingMaxDate: Date;
  bookedDatesSet: Set<string>;
  unavailableDatesSet: Set<string>;

  // Callbacks
  onSearchSlots: () => void;
  onConfirmBooking: () => void;
  onClose: () => void;
};

let _state: BookingFlowState | null = null;
const _listeners = new Set<() => void>();

const notify = () => _listeners.forEach((fn) => fn());

export const bookingFlowStore = {
  init(state: BookingFlowState) {
    _state = state;
    notify();
  },
  get(): BookingFlowState | null {
    return _state;
  },
  set(partial: Partial<BookingFlowState>) {
    if (!_state) return;
    _state = { ..._state, ...partial };
    notify();
  },
  clear() {
    _state = null;
  },
  subscribe(fn: () => void) {
    _listeners.add(fn);
    return () => { _listeners.delete(fn); };
  },
};
