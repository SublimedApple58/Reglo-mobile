// Published by ClusterSettingsScreen ("Il mio gruppo") so the dedicated formSheet
// sub-pages in the notes stack (notes/booking-rules, notes/limits, notes/extras)
// can bind to the live draft state + setters. Each sub-page persists on its own
// via onSave() (full updateInstructorSettings payload) then router.back().

export type ClusterCompanyDefaults = {
  bookingSlotDurations: number[];
  roundedHoursOnly: boolean;
  appBookingActors: string;
  instructorBookingMode: string;
  swapEnabled: boolean;
  studentCancellationEnabled: boolean;
  bookingCutoffEnabled: boolean;
  bookingCutoffTime: string;
  weeklyBookingLimitEnabled: boolean;
  weeklyBookingLimit: number;
  weeklyAbsenceEnabled: boolean;
  restrictedTimeRangeEnabled: boolean;
  restrictedTimeRangeStart: string;
  restrictedTimeRangeEnd: string;
};

export type ClusterSettingsStoreData = {
  companyDefaults: ClusterCompanyDefaults;

  // ── Prenotazione guide ──
  appBookingActors: string | undefined;
  setAppBookingActors: (v: string | undefined) => void;
  instructorBookingMode: string | undefined;
  setInstructorBookingMode: (v: string | undefined) => void;
  bookingSlotDurations: number[];
  toggleDuration: (d: number) => void;
  roundedHoursOnly: boolean;
  setRoundedHoursOnly: (v: boolean) => void;

  // ── Limiti e orari ──
  bookingCutoffEnabled: boolean | undefined;
  setBookingCutoffEnabled: (v: boolean) => void;
  bookingCutoffTime: string | undefined;
  setBookingCutoffTime: (v: string) => void;
  weeklyLimitEnabled: boolean | undefined;
  setWeeklyLimitEnabled: (v: boolean) => void;
  weeklyLimit: number | undefined;
  setWeeklyLimit: (v: number) => void;
  restrictedTimeEnabled: boolean | undefined;
  setRestrictedTimeEnabled: (v: boolean) => void;
  restrictedTimeStart: string | undefined;
  setRestrictedTimeStart: (v: string) => void;
  restrictedTimeEnd: string | undefined;
  setRestrictedTimeEnd: (v: string) => void;

  // ── Funzionalità extra ──
  swapEnabled: boolean | undefined;
  setSwapEnabled: (v: boolean) => void;
  studentCancellationEnabled: boolean | undefined;
  setStudentCancellationEnabled: (v: boolean) => void;
  weeklyAbsenceEnabled: boolean | undefined;
  setWeeklyAbsenceEnabled: (v: boolean) => void;

  // ── Shared ──
  openTimePicker: (current: string, onPick: (hhmm: string) => void) => void;
  saving: boolean;
  onSave: () => Promise<void>;
};

let _data: ClusterSettingsStoreData | null = null;
const _listeners = new Set<() => void>();

export const clusterSettingsStore = {
  set(data: ClusterSettingsStoreData) {
    _data = data;
    _listeners.forEach((fn) => fn());
  },
  get(): ClusterSettingsStoreData | null {
    return _data;
  },
  subscribe(fn: () => void) {
    _listeners.add(fn);
    return () => { _listeners.delete(fn); };
  },
};
