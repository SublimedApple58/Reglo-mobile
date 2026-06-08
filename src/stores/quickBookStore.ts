/**
 * Drives the native `home/quick-book` formSheet — the instructor's fast booking
 * flow opened by releasing the hold-to-scrub gesture on a free band (or tapping
 * it). The parent seeds the preset start time + free window + options and owns
 * the create calls; the route renders the form and reports back.
 */
export type QuickBookCreateLesson = (p: {
  studentId: string;
  startMinutes: number;
  duration: number;
}) => Promise<boolean>;

export type QuickBookCreateBlock = (p: {
  reason: string;
  startMinutes: number;
  duration: number;
}) => Promise<boolean>;

export type QuickBookCreateSick = (p: {
  startMinutes: number;
}) => Promise<boolean>;

export type QuickBookData = {
  /** Day the booking lands on (time component ignored). */
  date: Date;
  /** Preset start (minutes from midnight) from the released scrub position. */
  startMinutes: number;
  /** Bookable free window the start can move within. */
  windowStartMinutes: number;
  windowEndMinutes: number;
  /** Allowed durations (minutes), ascending. */
  durations: number[];
  defaultDuration: number;
  vehiclesEnabled: boolean;
  studentOptions: { label: string; value: string }[];
  /** Whether the "Blocca slot" / "Malattia" modes are available. */
  allowBlock: boolean;
  onCreateLesson: QuickBookCreateLesson;
  onCreateBlock: QuickBookCreateBlock;
  onCreateSick: QuickBookCreateSick;
};

let _data: QuickBookData | null = null;
const _listeners = new Set<() => void>();

export const quickBookStore = {
  set(data: QuickBookData) {
    _data = data;
    _listeners.forEach((fn) => fn());
  },
  get(): QuickBookData | null {
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
