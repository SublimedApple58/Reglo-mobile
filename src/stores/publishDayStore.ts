// Published by PublicationModeEditor so the role/publish-day formSheet can bind
// to the tapped day. The sheet edits a draft (available + ranges) and calls
// onSave(); the parent persists via setDailyAvailabilityOverride.

import { TimeRange } from '../types/regloApi';

export type PublishDayStoreData = {
  dayLabel: string; // e.g. "Lunedì 1 giugno"
  available: boolean;
  ranges: TimeRange[];
  openTimePicker: (current: Date, onPick: (d: Date) => void) => void;
  onSave: (available: boolean, ranges: TimeRange[]) => void;
};

let _data: PublishDayStoreData | null = null;
const _listeners = new Set<() => void>();

export const publishDayStore = {
  set(data: PublishDayStoreData) {
    _data = data;
    _listeners.forEach((fn) => fn());
  },
  get(): PublishDayStoreData | null {
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
