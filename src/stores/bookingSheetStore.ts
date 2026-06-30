/**
 * Drives the native `home/new-booking` modal route — the instructor's full
 * "Nuova prenotazione" flow (single + multi booking, location pick/create).
 * The parent (IstruttoreHomeScreen) seeds the available data; the route owns the
 * form + the regloApi create calls. After a create succeeds it calls `onApplied`
 * (parent refreshes its agenda from the BE), then `onDone` (success toast).
 */
export type BookingStudentOption = { value: string; label: string; subtitle: string | null };

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
  vehicles: { id: string; name: string; licenseCategory?: string | null }[];
  /**
   * Global follow-car rule per moto category (derived from the company's single
   * global toggle; a moto category is present+enabled when the rule is on).
   */
  followCarRules?: Partial<Record<string, { enabled: boolean }>>;
  studentOptions: BookingStudentOption[];
  defaultLocation: { id: string; name: string; address: string | null } | null;
  /** Keys `${y}-${m}-${d}` of days with bookings, for the calendar dots. */
  bookedDateKeys: string[];
  /**
   * Non-optimistic flow: the route does the network create call, awaits it, then
   * calls `onApplied()` so the parent refreshes its agenda from the BE, then
   * `onDone(message)` to show the toast, then dismisses. No provisional rows.
   */
  onApplied: () => Promise<void>;
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
