// Centralized query key factory + staleTime constants for TanStack Query.
// Keys are scoped by companyId to avoid cross-company cache collisions.

export const STALE_TIMES = {
  /** Settings change rarely — 15 min */
  settings: 15 * 60 * 1000,
  /** Booking options tied to cluster settings — 10 min */
  bookingOptions: 10 * 60 * 1000,
  /** Appointments can change — keep 2 min */
  appointments: 2 * 60 * 1000,
  /** Calendar availability dots — 5 min */
  dateAvailability: 5 * 60 * 1000,
  /** Active booking flow — must be fresh — 30 sec */
  availableSlots: 30 * 1000,
  /** Payment profile changes rarely — 15 min */
  paymentProfile: 15 * 60 * 1000,
  /** Payment history — 5 min */
  paymentHistory: 5 * 60 * 1000,
  /** Holidays almost never change — 1 hour */
  holidays: 60 * 60 * 1000,
  /** Agenda bootstrap (instructor) — 2 min */
  agendaBootstrap: 2 * 60 * 1000,
  /** Instructor cluster settings — 15 min */
  instructorSettings: 15 * 60 * 1000,
  /** Instructor blocks — 5 min */
  instructorBlocks: 5 * 60 * 1000,
  /** Driving locations change rarely — 15 min */
  locations: 15 * 60 * 1000,
  /**
   * Student phase / theory exam date — 30 sec.
   * The phase can change as soon as the owner clicks "Assegna quiz" /
   * "Cambia fase" in the web app, so we keep it short and let the
   * focusManager + refetchOnMount catch the change quickly. For
   * AWAITING students the hook also polls every 30 sec while they wait
   * on the activation screen.
   */
  studentPhase: 30 * 1000,
} as const;

export const queryKeys = {
  appointments: (companyId: string | null, params?: Record<string, unknown>) =>
    ['appointments', companyId, params] as const,

  agendaBootstrap: (companyId: string | null, params?: Record<string, unknown>) =>
    ['agenda-bootstrap', companyId, params] as const,

  autoscuolaSettings: (companyId: string | null) =>
    ['autoscuola-settings', companyId] as const,

  bookingOptions: (companyId: string | null, studentId: string | null) =>
    ['booking-options', companyId, studentId] as const,

  availableSlots: (companyId: string | null, params?: Record<string, unknown>) =>
    ['available-slots', companyId, params] as const,

  dateAvailability: (companyId: string | null, params?: Record<string, unknown>) =>
    ['date-availability', companyId, params] as const,

  paymentProfile: (companyId: string | null) =>
    ['payment-profile', companyId] as const,

  paymentHistory: (companyId: string | null, limit?: number) =>
    ['payment-history', companyId, limit] as const,

  holidays: (companyId: string | null, params?: Record<string, unknown>) =>
    ['holidays', companyId, params] as const,

  instructorSettings: (companyId: string | null) =>
    ['instructor-settings', companyId] as const,

  instructorBlocks: (companyId: string | null, params?: Record<string, unknown>) =>
    ['instructor-blocks', companyId, params] as const,

  locations: (companyId: string | null) =>
    ['locations', companyId] as const,

  studentPhase: (companyId: string | null) =>
    ['student-phase', companyId] as const,
} as const;
