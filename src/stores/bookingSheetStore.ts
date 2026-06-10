/**
 * Drives the native `home/new-booking` modal route — the instructor's full
 * "Nuova prenotazione" flow (single + multi booking, location pick/create).
 * The parent (IstruttoreHomeScreen) seeds the available data; the route owns the
 * form + the regloApi create calls and calls `onDone` so the parent refreshes
 * its list + shows a success toast. Mirrors `quickBookStore` / `manageLessonStore`.
 */
import type { AutoscuolaAppointment } from '../types/regloApi';

export type BookingStudentOption = { value: string; label: string; subtitle: string | null };

/**
 * Minimal descriptor of a just-created booking, handed back to the parent so it
 * can insert a provisional row into its agenda immediately (optimistic) before
 * reconciliation. `id` is a `provisional-…` placeholder until the real row
 * arrives (single → `onOptimisticReplace`, batch → `onReconcile`).
 */
export type BookingResultItem = {
  id: string;
  studentId: string;
  startsAt: string;
  endsAt: string;
  vehicleId: string | null;
  locationId: string | null;
  locationName: string | null;
  locationAddress: string | null;
  type: string;
  types: string[];
};

export type BookingSheetData = {
  canBook: boolean;
  vehiclesEnabled: boolean;
  availabilityWeeks: number;
  instructorId: string;
  /** ISO string of the day the sheet opens on. */
  initialDate: string;
  /**
   * Quick-book only: preset start (minutes from midnight) from the released
   * scrub position. When set, the form seeds the start time to it instead of
   * the current clock time. Undefined for the FAB "Nuova prenotazione" flow.
   */
  presetStartMinutes?: number;
  durations: number[];
  defaultDuration: number;
  /** '' when no vehicle / vehicles disabled. */
  defaultVehicleId: string;
  vehicles: { id: string; name: string }[];
  studentOptions: BookingStudentOption[];
  defaultLocation: { id: string; name: string; address: string | null } | null;
  /** Keys `${y}-${m}-${d}` of days with bookings, for the calendar dots. */
  bookedDateKeys: string[];
  /**
   * Truly-optimistic flow: the route inserts `items` and dismisses *before* the
   * network call, so the booking shows instantly. The network then resolves:
   *  - single success → `onOptimisticReplace(provisionalId, real)` swaps the
   *    provisional row for the real appointment IN PLACE (no refetch, no reflow)
   *  - batch success → `onReconcile(ids)` does a lightweight agenda refetch and
   *    merges the real rows over the provisionals (matched by student+startsAt)
   *  - either success also calls `onDone(message)` to show the toast
   *  - failure / weekly-limit cancel → `onOptimisticRemove(ids)` rolls them back
   */
  onOptimisticInsert: (items: BookingResultItem[]) => void;
  onOptimisticRemove: (ids: string[]) => void;
  onOptimisticReplace: (provisionalId: string, real: AutoscuolaAppointment) => void;
  onReconcile: (provisionalIds: string[]) => void;
  onDone: (message: string) => void;
};

let _data: BookingSheetData | null = null;
const _listeners = new Set<() => void>();

export const bookingSheetStore = {
  set(data: BookingSheetData) {
    _data = data;
    _listeners.forEach((fn) => fn());
  },
  get(): BookingSheetData | null {
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
