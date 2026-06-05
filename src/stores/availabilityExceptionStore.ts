// Published by DefaultAvailabilityEditor so the dedicated formSheet
// (role/availability-exception) can bind to the live instructor context.
// The sheet performs the override API calls itself, then calls onSaved() so the
// parent refreshes its exceptions list.

import { TimeRange } from '../types/regloApi';

export type AvailabilityExceptionStoreData = {
  instructorId: string;
  // Dates (YYYY-MM-DD) that already have an override — calendar dots.
  markedDates: string[];
  // ── Edit mode (set when tapping an existing one-off exception) ──
  editDate?: string; // present = editing this specific date
  editRanges?: TimeRange[];
  editIsAbsent?: boolean;
  // Opens the shared wheel time picker.
  openTimePicker: (current: Date, onPick: (d: Date) => void) => void;
  // Parent refresh after create / edit / delete.
  onSaved: () => void;
};

let _data: AvailabilityExceptionStoreData | null = null;
const _listeners = new Set<() => void>();

export const availabilityExceptionStore = {
  set(data: AvailabilityExceptionStoreData) {
    _data = data;
    _listeners.forEach((fn) => fn());
  },
  get(): AvailabilityExceptionStoreData | null {
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
