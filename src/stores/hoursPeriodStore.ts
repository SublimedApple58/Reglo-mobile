// Drives the more/hours-period formSheet (period selector for Ore di guida).
export type HoursPeriodStoreData = {
  from: string; // ISO YYYY-MM-DD inclusive
  to: string; // ISO YYYY-MM-DD inclusive
  onApply: (from: string, to: string) => void;
};

let _data: HoursPeriodStoreData | null = null;
const _listeners = new Set<() => void>();

export const hoursPeriodStore = {
  set(data: HoursPeriodStoreData) {
    _data = data;
    _listeners.forEach((fn) => fn());
  },
  get(): HoursPeriodStoreData | null {
    return _data;
  },
  subscribe(fn: () => void) {
    _listeners.add(fn);
    return () => { _listeners.delete(fn); };
  },
};
