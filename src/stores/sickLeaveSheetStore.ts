/**
 * Drives the native `home/sick-leave` formSheet — the instructor's "Malattia"
 * flow. The parent (IstruttoreHomeScreen) seeds the day + instructor + optimistic
 * callbacks; the route builds the provisional sick_leave block(s) (one per day),
 * inserts them, dismisses, then runs `regloApi.createInstructorSickLeave` and
 * reconciles (which also refreshes the agenda so the cancelled guides drop out).
 * Mirrors `blockSheetStore`.
 */
import type { InstructorBlock } from '../types/regloApi';

export type SickLeaveSheetData = {
  /** ISO string of the day the sheet opens on. */
  initialDate: string;
  /** The instructor the sick leave belongs to (for the provisional rows + scope). */
  instructorId: string;
  /** Insert the provisional sick_leave block(s) immediately (optimistic). */
  onOptimisticInsert: (blocks: InstructorBlock[]) => void;
  /** Roll the provisional block(s) back on failure. */
  onOptimisticRemove: (provisionalIds: string[]) => void;
  /** On success: reconcile blocks + refresh the agenda (cancelled guides drop out). */
  onReconcile: (provisionalIds: string[]) => void;
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
