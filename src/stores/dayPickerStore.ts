/**
 * Drives the `home/select-date` page sheet — the Airbnb-style scrollable months
 * calendar used to jump the agenda to any day (past or future). The opener
 * provides the current selection, the marked (booked) days, the navigation
 * range, and an onSelect callback that moves the agenda.
 */
export type DayPickerData = {
  /** Currently selected day, YYYY-MM-DD. */
  selectedDate: string | null;
  /** Days to mark with a dot, YYYY-MM-DD. */
  markedDates: Set<string>;
  /** Months to render before the current month. */
  monthsBack: number;
  /** Months to render from the current month onward. */
  monthsCount: number;
  /** Whether past days are selectable. */
  allowPast: boolean;
  /** Title shown in the sheet header. */
  title?: string;
  onSelect: (date: string) => void;
};

let _data: DayPickerData | null = null;
const _listeners = new Set<() => void>();

export const dayPickerStore = {
  set(data: DayPickerData) {
    _data = data;
    _listeners.forEach((fn) => fn());
  },
  get(): DayPickerData | null {
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
