/**
 * Drives the native `home/block-slot` formSheet — the instructor's "Blocca slot"
 * flow. The parent (IstruttoreHomeScreen) seeds the day + instructor + optimistic
 * callbacks; the route builds the provisional block(s), inserts them, dismisses,
 * then runs `regloApi.createInstructorBlock` and reconciles. Same optimistic model
 * as bookings. Mirrors `sickLeaveSheetStore`.
 */
import type { InstructorBlock } from '../types/regloApi';

export type BlockSheetData = {
  /** ISO string of the day the sheet opens on. */
  initialDate: string;
  /**
   * Quick-book only: preset start (minutes from midnight) from the released
   * scrub position. When set, the form seeds the start time to it (end = +60').
   * Undefined for the FAB "Blocca slot" flow.
   */
  presetStartMinutes?: number;
  /** The instructor the block belongs to (for the provisional row + scope match). */
  instructorId: string;
  /** Insert the provisional block(s) immediately (optimistic). */
  onOptimisticInsert: (blocks: InstructorBlock[]) => void;
  /** Roll the provisional block(s) back on failure. */
  onOptimisticRemove: (provisionalIds: string[]) => void;
  /** On success: swap the provisional block(s) for the real rows (refetch). */
  onReconcile: (provisionalIds: string[]) => void;
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
