/**
 * Drives the native `home/sick-leave` formSheet — the instructor's "Malattia"
 * flow. The parent (IstruttoreHomeScreen) seeds the day + instructor; the route
 * runs `regloApi.createInstructorSickLeave`, awaits it, then calls `onApplied`
 * (parent refreshes its agenda from the BE, so the cancelled guides drop out) and
 * `onDone` (toast). Non-optimistic. Mirrors `blockSheetStore`.
 */
export type SickLeaveSheetData = {
  /** ISO string of the day the sheet opens on. */
  initialDate: string;
  /** The instructor the sick leave belongs to (for scope). */
  instructorId: string;
  /** After the create succeeds: refresh the parent's agenda from the BE. */
  onApplied: () => Promise<void>;
  /** Success toast. */
  onDone: (message: string) => void;
};

let _data: SickLeaveSheetData | null = null;
const _listeners = new Set<() => void>();

export const sickLeaveSheetStore = {
  set(data: SickLeaveSheetData) {
    _data = data;
    _listeners.forEach((fn) => fn());
  },
  get(): SickLeaveSheetData | null {
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
