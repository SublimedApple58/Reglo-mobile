/**
 * Drives the `home/select-date-range` formSheet — a single calendar where you
 * tap a start day then an end day to pick a range (mirrors the "Ore guida"
 * `hoursPeriodStore`/`hours-period` picker). Seed-and-callback: the caller seeds
 * the current range + optional min/max bounds and gets `onApply(from, to)`.
 */
export type DateRangeStoreData = {
  /** Current start (YYYY-MM-DD) or null. */
  from: string | null;
  /** Current end (YYYY-MM-DD) or null. */
  to: string | null;
  title?: string;
  /** Earliest selectable day inclusive (YYYY-MM-DD). Days before are disabled. */
  minISO?: string;
  /** Latest selectable day inclusive (YYYY-MM-DD). Days after are disabled. */
  maxISO?: string;
  onApply: (from: string, to: string) => void;
};

let _data: DateRangeStoreData | null = null;
const _listeners = new Set<() => void>();

export const dateRangeStore = {
  set(data: DateRangeStoreData) {
    _data = data;
    _listeners.forEach((fn) => fn());
  },
  get(): DateRangeStoreData | null {
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
