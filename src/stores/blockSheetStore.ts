/**
 * Drives the native `home/block-slot` formSheet — the instructor's "Blocca slot"
 * flow. The parent (IstruttoreHomeScreen) seeds the day + instructor; the route
 * runs `regloApi.createInstructorBlock`, awaits it, then calls `onApplied`
 * (parent refreshes its agenda from the BE) and `onDone` (toast). Non-optimistic.
 * Mirrors `sickLeaveSheetStore`.
 */
export type BlockSheetData = {
  /** ISO string of the day the sheet opens on. */
  initialDate: string;
  /**
   * Quick-book only: preset start (minutes from midnight) from the released
   * scrub position. When set, the form seeds the start time to it (end = +60').
   * Undefined for the FAB "Blocca slot" flow.
   */
  presetStartMinutes?: number;
  /** The instructor the block belongs to (for scope match). */
  instructorId: string;
  /** After the create succeeds: refresh the parent's agenda from the BE. */
  onApplied: () => Promise<void>;
  /** Success toast. */
  onDone: (message: string) => void;
};

let _data: BlockSheetData | null = null;
const _listeners = new Set<() => void>();

export const blockSheetStore = {
  set(data: BlockSheetData) {
    _data = data;
    _listeners.forEach((fn) => fn());
  },
  get(): BlockSheetData | null {
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
