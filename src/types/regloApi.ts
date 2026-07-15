export type IsoDate = string;
export type Uuid = string;

export type ApiSuccess<T> = { success: true; data: T };
export type ApiError = { success: false; message: string };
export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export type AutoscuolaRole = "OWNER" | "INSTRUCTOR_OWNER" | "INSTRUCTOR" | "STUDENT";

export type AutoscuolaStudentPhase = "AWAITING" | "TEORIA" | "PRATICA" | "PATENTATO";

export type StudentPhasePayload = {
  phase: AutoscuolaStudentPhase;
  theoryExamAt: IsoDate | null;
  drivingExamAt: IsoDate | null;
  /**
   * Active phases at the autoscuola level. New since the quiz-seats /
   * student-phase commercial rollout. Older backend versions may not return
   * this field — treat as `['PRATICA']` when absent.
   */
  phasesEnabled?: Array<"TEORIA" | "PRATICA">;
  /**
   * True when the student has been granted a nominal quiz license seat
   * (CompanyMember.quizSeatGrantedAt != null). Drives the quiz tab
   * visibility on mobile. Absent on legacy backends → assume false.
   */
  hasQuizAccess?: boolean;
  /**
   * Whether the autoscuola auto-assigns a quiz seat to every new student
   * at registration. Read-only on mobile (managed from the owner web app).
   * Absent on legacy backends → assume false.
   */
  autoAssignQuizOnSignup?: boolean;
  /**
   * License path the student is pursuing in PRATICA (category + transmission).
   * Set by the owner from the web app. Absent on legacy backends → treat as null.
   */
  licenseCategory?: string | null;
  transmission?: string | null;
};

export type ServiceKey = "DOC_MANAGER" | "WORKFLOWS" | "AI_ASSISTANT" | "AUTOSCUOLE";
export type CompanyServiceStatus = "ACTIVE" | "DISABLED";

export type CompanyService = {
  id: Uuid;
  companyId: Uuid;
  serviceKey: ServiceKey;
  status: CompanyServiceStatus;
  limits: Record<string, unknown> | null;
  createdAt: IsoDate;
  updatedAt: IsoDate;
};

export type CompanySummary = {
  id: Uuid;
  name: string;
  logoKey: string | null;
  logoUrl?: string | null;
  role: "admin" | "member" | string;
  autoscuolaRole: AutoscuolaRole | null;
  services: CompanyService[];
};

export type UserPublic = {
  id: Uuid;
  name: string | null;
  email: string;
  phone: string | null;
  role: string;
};

export type AuthPayload = {
  token: string;
  expiresAt: IsoDate;
  user: UserPublic;
  activeCompanyId: Uuid | null;
  autoscuolaRole: AutoscuolaRole | null;
  instructorId?: Uuid | null;
  companies: CompanySummary[];
};

export type MePayload = {
  user: UserPublic;
  activeCompanyId: Uuid | null;
  autoscuolaRole: AutoscuolaRole | null;
  instructorId?: Uuid | null;
  companies: CompanySummary[];
};

export type LogoutPayload = { success: true };
export type DeleteAccountInput = { confirm: true };
export type DeleteAccountPayload = { deleted: true };
export type SelectCompanyPayload = { activeCompanyId: Uuid };

export type AutoscuolaStudent = {
  id: Uuid;
  companyId: Uuid;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  status: string;
  notes: string | null;
  assignedInstructorId?: Uuid | null;
  // Pursued license path (category + transmission). Returned by /api/autoscuole/students.
  licenseCategory?: string | null;
  transmission?: string | null;
  // Whether the student may participate in group driving lessons (Guide di gruppo).
  groupLessonsOptIn?: boolean;
  createdAt: IsoDate;
  updatedAt: IsoDate;
};

export type AutoscuolaCase = {
  id: Uuid;
  companyId: Uuid;
  studentId: Uuid;
  category: string | null;
  status: string;
  theoryExamAt: IsoDate | null;
  drivingExamAt: IsoDate | null;
  pinkSheetExpiresAt: IsoDate | null;
  medicalExpiresAt: IsoDate | null;
  createdAt: IsoDate;
  updatedAt: IsoDate;
};

export type AutoscuolaCaseWithStudent = AutoscuolaCase & {
  student: AutoscuolaStudent;
};

export type AutoscuolaInstructor = {
  id: Uuid;
  companyId: Uuid;
  userId?: Uuid | null;
  name: string;
  phone: string | null;
  status: string;
  autonomousMode?: boolean;
  createdAt: IsoDate;
  updatedAt: IsoDate;
};

export type AutoscuolaVehicle = {
  id: Uuid;
  companyId: Uuid;
  name: string;
  plate: string | null;
  // active | inactive | maintenance.
  status: string;
  // Exclusive owner: when set, the vehicle is reserved to this instructor and
  // hidden from others. An instructor may own several exclusive vehicles.
  assignedInstructorId: Uuid | null;
  // Shared-pool membership. Empty + no exclusive owner = open to all instructors.
  poolInstructorIds: Uuid[];
  followsInstructorAvailability: boolean;
  // License category (B | AM | A1 | A2 | A) + transmission (manual | automatic)
  // this vehicle serves. Drives category-aware matching (Vehicles module).
  licenseCategory: string;
  transmission: string;
  createdAt: IsoDate;
  updatedAt: IsoDate;
};

export type AutoscuolaLocation = {
  id: Uuid;
  companyId: Uuid;
  createdByUserId: Uuid | null;
  name: string;
  address: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  placeId: string | null;
  isDefault: boolean;
  isPrecise: boolean;
};

export type AutoscuolaAppointment = {
  id: Uuid;
  companyId: Uuid;
  studentId: Uuid;
  caseId: Uuid | null;
  slotId: Uuid | null;
  type: string;
  types?: string[];
  rating?: number | null;
  startsAt: IsoDate;
  endsAt: IsoDate | null;
  status: string;
  instructorId: Uuid | null;
  vehicleId: Uuid | null;
  locationId: Uuid | null;
  // Set when this appointment is a seat of a group lesson (type === "group_lesson").
  groupLessonId?: Uuid | null;
  /** Capienza reale della guida di gruppo (libera, ≤12) — annotata dal BE sull'agenda. */
  groupLessonCapacity?: number | null;
  /** Tipo guida di gruppo ("standard" | "moto") — annotato dal BE sull'agenda. */
  groupLessonKind?: string | null;
  /** Posti occupati della guida di gruppo (per lo storico allievo: N/M). */
  groupLessonFilled?: number | null;
  notes: string | null;
  cancellationKind?: string | null;
  cancellationReason?: string | null;
  replacedByAppointmentId?: Uuid | null;
  /** Annotazioni BE per i colori della vista griglia (solo guide, non esami). */
  mandatoryLesson?: boolean;
  /** L'allievo ha l'esame di guida il giorno dopo questa guida. */
  examNextDay?: boolean;
  createdAt: IsoDate;
  updatedAt: IsoDate;
};

export type AutoscuolaAppointmentWithRelations = AutoscuolaAppointment & {
  student: AutoscuolaStudent;
  case: AutoscuolaCase | null;
  instructor: AutoscuolaInstructor | null;
  vehicle: AutoscuolaVehicle | null;
  // Follow car (auto al seguito) for moto lessons, when the school requires it.
  followVehicle?: AutoscuolaVehicle | null;
  // Extra motos a moto guida occupies beyond the primary one.
  extraMotoVehicles?: AutoscuolaVehicle[] | null;
  location: AutoscuolaLocation | null;
};

// ── Group lessons (Guide di gruppo) ──────────────────────────────────
export type GroupLessonParticipant = {
  appointmentId: Uuid;
  studentId: Uuid;
  studentName: string | null;
  /** Presence outcome of this seat: "present"/"absent" once reviewed, else
   *  "pending" (upcoming, or past-but-unconfirmed). Correctable any time. */
  attendance: 'present' | 'absent' | 'pending';
  /** Per-student note on this seat (instructor → student), null if none. */
  notes: string | null;
  /** Moto group: the moto assigned to this participant (null otherwise). */
  vehicleName?: string | null;
  licenseCategory?: string | null;
};

/** A moto in a group's fleet (kind="moto"). */
export type GroupLessonFleetVehicle = {
  id: Uuid;
  name: string;
  licenseCategory: string | null;
  transmission: string | null;
};

export type GroupLesson = {
  id: Uuid;
  startsAt: IsoDate;
  endsAt: IsoDate | null;
  capacity: number;
  status: string;
  /** "standard" (one shared vehicle) | "moto" (moto fleet + shared follow car). */
  kind?: string;
  priceAmount: number;
  notes: string | null;
  instructorId: Uuid | null;
  instructorName: string | null;
  vehicleId: Uuid | null;
  vehicleName: string | null;
  licenseCategory: string | null;
  transmission: string | null;
  /** Moto group: shared follow car. */
  followVehicleId?: Uuid | null;
  followVehicleName?: string | null;
  /** Moto group: the reserved moto fleet. */
  fleet?: GroupLessonFleetVehicle[];
  filledSeats: number;
  openSeats: number;
  participants: GroupLessonParticipant[];
};

export type GroupLessonInvite = {
  /** Null only in countOnly (badge) responses — the list flow always gets one. */
  inviteId: Uuid;
  groupLessonId: Uuid;
  startsAt: IsoDate;
  endsAt: IsoDate | null;
  capacity: number;
  /** "standard" | "moto". Moto: the specific moto is assigned only at acceptance. */
  kind?: string;
  filledSeats: number;
  openSeats: number;
  instructorName: string | null;
  vehicleName: string | null;
  notes: string | null;
  expiresAt: IsoDate;
};

export type GroupLessonInvitee = { id: Uuid; name: string | null };

export type CreateGroupLessonInput = {
  startsAt: IsoDate;
  endsAt: IsoDate;
  /** "standard" (default) | "moto" (fleet + shared follow car). */
  kind?: 'standard' | 'moto';
  vehicleId?: Uuid | null;
  /** Moto group: the chosen moto fleet. */
  vehicleIds?: Uuid[];
  /** Moto group: shared follow car (category B). */
  followVehicleId?: Uuid | null;
  instructorId?: Uuid | null;
  /** Capienza massima (3 o 4 allievi). Default BE: 3. */
  capacity?: number;
  studentIds?: Uuid[];
  notes?: string;
};

export type GetAppointmentsParams = {
  from?: IsoDate;
  to?: IsoDate;
  studentId?: Uuid;
  instructorId?: Uuid;
  status?: string;
  type?: string;
  limit?: number;
  light?: boolean;
};

export type LatestStudentAppointmentNote = {
  appointmentId: Uuid;
  startsAt: IsoDate;
  note: string;
};

export type AgendaBootstrapParams = {
  from: IsoDate;
  to: IsoDate;
  instructorId?: Uuid;
  vehicleId?: Uuid;
  status?: string;
  type?: string;
  limit?: number;
};

export type AgendaBootstrapPayload = {
  appointments: AutoscuolaAppointmentWithRelations[];
  students: AutoscuolaStudent[];
  instructors: AutoscuolaInstructor[];
  vehicles: AutoscuolaVehicle[];
  instructorBlocks?: InstructorBlock[];
  meta: {
    from: IsoDate;
    to: IsoDate;
    generatedAt: IsoDate;
    count: number;
    cache?: boolean;
  };
};

export type AutoscuolaOverview = {
  studentsCount: number;
  activeCasesCount: number;
  upcomingAppointmentsCount: number;
  overdueInstallmentsCount: number;
};

export type AutoscuolaDeadlineItem = {
  id: string;
  caseId: Uuid;
  studentId: Uuid;
  studentName: string;
  deadlineType: string;
  deadlineDate: IsoDate;
  status: "overdue" | "soon" | "ok";
  caseStatus: string;
};

export type AutoscuolaAvailabilitySlot = {
  id: Uuid;
  companyId: Uuid;
  ownerType: "student" | "instructor" | "vehicle" | string;
  ownerId: Uuid;
  startsAt: IsoDate;
  endsAt: IsoDate;
  status: "open" | "held" | "booked" | "cancelled" | string;
  createdAt: IsoDate;
  updatedAt: IsoDate;
};

export type AutoscuolaBookingRequest = {
  id: Uuid;
  companyId: Uuid;
  studentId: Uuid;
  desiredDate: IsoDate;
  status: "pending" | "matched" | "cancelled" | string;
  createdAt: IsoDate;
  updatedAt: IsoDate;
};

export type AutoscuolaWaitlistOffer = {
  id: Uuid;
  companyId: Uuid;
  slotId: Uuid;
  status: "broadcasted" | "accepted" | "expired" | string;
  sentAt: IsoDate;
  expiresAt: IsoDate;
  createdAt: IsoDate;
  updatedAt: IsoDate;
};

export type AutoscuolaWaitlistOfferWithSlot = AutoscuolaWaitlistOffer & {
  slot: AutoscuolaAvailabilitySlot;
};

export type AutoscuolaWaitlistResponse = {
  id: Uuid;
  offerId: Uuid;
  studentId: Uuid;
  status: "accepted" | "declined" | "expired" | string;
  respondedAt: IsoDate;
  createdAt: IsoDate;
  updatedAt: IsoDate;
};

export type AutoscuolaSwapOfferWithDetails = {
  id: Uuid;
  companyId: Uuid;
  appointmentId: Uuid;
  requestingStudentId: Uuid;
  requestingStudentName: string;
  status: string;
  sentAt: IsoDate;
  expiresAt: IsoDate;
  appointment: {
    startsAt: IsoDate;
    endsAt: IsoDate | null;
    type: string;
    instructorName: string | null;
    vehicleName: string | null;
  };
};

export type RespondSwapOfferInput = {
  studentId: Uuid;
  response: "accept" | "decline";
};

export type RespondSwapOfferResult =
  | { accepted: true; appointment: AutoscuolaAppointment }
  | { accepted: false };

export type InstructorSwapInput = {
  appointmentIdA: Uuid;
  appointmentIdB: Uuid;
};

export type CreateStudentInput = {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  status?: string;
  notes?: string;
};

export type CreateCaseInput = {
  studentId: Uuid;
  category?: string;
  status?: string;
  theoryExamAt?: IsoDate;
  drivingExamAt?: IsoDate;
  pinkSheetExpiresAt?: IsoDate;
  medicalExpiresAt?: IsoDate;
};

export type UpdateCaseStatusInput = { status: string };

export type CreateAppointmentInput = {
  studentId: Uuid;
  caseId?: Uuid | null;
  type: string;
  startsAt: IsoDate;
  endsAt?: IsoDate | null;
  instructorId: Uuid;
  vehicleId: Uuid;
  locationId?: Uuid | null;
  notes?: string;
};

export type UpdateAppointmentStatusInput = {
  status: string;
  lessonType?: string;
  lessonTypes?: string[];
};

export type UpdateAppointmentDetailsInput = {
  lessonType?: string;
  lessonTypes?: string[];
  rating?: number | null;
  notes?: string | null;
  locationId?: Uuid | null;
  /** Reassign the appointment to a different company vehicle (null = unassign). */
  vehicleId?: Uuid | null;
  /**
   * Replace the extra motos a moto guida occupies beyond the primary one
   * (stored as additional role="primary" join rows). Empty array clears them.
   */
  extraMotoVehicleIds?: Uuid[];
  /** Set/replace the follow car (auto al seguito). null = remove it. */
  followVehicleId?: Uuid | null;
  /**
   * Reassign the appointment to a different instructor (single-lesson
   * override; does NOT change the student's assignedInstructorId). Server
   * verifies availability and returns `INSTRUCTOR_UNAVAILABLE` on conflict.
   */
  instructorId?: Uuid;
};

export type InstructorAvailabilityResult =
  | { available: true }
  | {
      available: false;
      reason: "OVERLAP" | "BLOCK" | "HOLIDAY" | "INSTRUCTOR_INACTIVE";
      detail: string;
    };

export type CheckInstructorAvailabilityInput = {
  instructorId: Uuid;
  startsAt: IsoDate;
  endsAt: IsoDate;
  excludeAppointmentId?: Uuid;
};

export type CreateLocationInput = {
  name: string;
  isPrecise: boolean;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  placeId?: string | null;
};

export type UpdateLocationInput = Partial<CreateLocationInput>;

export type CreateInstructorInput = { name: string; phone?: string };
export type LicenseCategory = "B" | "BE" | "C" | "CE" | "D" | "DE" | "AM" | "A1" | "A2" | "A";
export type Transmission = "manual" | "automatic";
export type CreateVehicleInput = {
  name: string;
  plate?: string;
  licenseCategory?: LicenseCategory;
  transmission?: Transmission;
  assignedInstructorId?: Uuid | null;
  poolInstructorIds?: Uuid[];
  followsInstructorAvailability?: boolean;
};
export type UpdateInstructorInput = {
  name?: string;
  phone?: string | null;
  status?: string;
  userId?: Uuid | null;
};
export type UpdateVehicleInput = {
  name?: string;
  plate?: string | null;
  // active | inactive | maintenance.
  status?: string;
  assignedInstructorId?: Uuid | null;
  poolInstructorIds?: Uuid[];
  followsInstructorAvailability?: boolean;
  licenseCategory?: LicenseCategory;
  transmission?: Transmission;
};

export type TimeRange = {
  startMinutes: number;
  endMinutes: number;
};

export type DailyAvailabilityOverride = {
  id: Uuid;
  companyId: Uuid;
  ownerType: string;
  ownerId: Uuid;
  date: IsoDate;
  ranges: TimeRange[];
};

export type SetDailyAvailabilityOverrideInput = {
  ownerType: 'instructor' | 'vehicle';
  ownerId: Uuid;
  date: string; // YYYY-MM-DD
  ranges: TimeRange[];
};

export type DeleteDailyAvailabilityOverrideInput = {
  ownerType: 'instructor' | 'vehicle';
  ownerId: Uuid;
  date: string; // YYYY-MM-DD
};

export type SetRecurringAvailabilityOverrideInput = {
  ownerType: 'instructor' | 'vehicle';
  ownerId: Uuid;
  dayOfWeek: number; // 0=Sun, 6=Sat
  ranges: TimeRange[]; // empty = absent
  weeksAhead?: number; // 1-52
};

export type CreateAvailabilitySlotsInput = {
  ownerType: "student" | "instructor" | "vehicle";
  ownerId: Uuid;
  startsAt: IsoDate;
  endsAt: IsoDate;
  startsAt2?: IsoDate;
  endsAt2?: IsoDate;
  daysOfWeek?: number[];
  weeks?: number;
  ranges?: TimeRange[];
  // Per-weekday schedule (0=Sun..6=Sat). When present the backend persists it as
  // authoritative and derives the flat fields above from a representative day.
  scheduleByDay?: Record<number, TimeRange[]>;
};

// Returned by getDefaultAvailability. `scheduleByDay` is always present (legacy
// shared records are projected onto each active day server-side).
export type DefaultAvailability = {
  daysOfWeek: number[];
  ranges: TimeRange[];
  scheduleByDay: Record<number, TimeRange[]>;
};

export type CreateBookingRequestInput = {
  studentId: Uuid;
  preferredDate: IsoDate;
  durationMinutes: number;
  lessonType?: string;
  preferredStartTime?: string;
  preferredEndTime?: string;
  maxDays?: number;
  selectedStartsAt?: IsoDate;
  excludeStartsAt?: IsoDate;
  requestId?: Uuid;
  instructorId?: Uuid;
};

export type RespondWaitlistOfferInput = {
  studentId: Uuid;
  response: "accept" | "decline";
};

export type CreateSlotsResult = { count: number };

export type CreateBookingRequestResult =
  | { matched: true; appointment: AutoscuolaAppointment; request: AutoscuolaBookingRequest }
  | {
      matched: false;
      request: AutoscuolaBookingRequest;
      suggestion?: { startsAt: IsoDate; endsAt: IsoDate };
    };

export type RespondWaitlistOfferResult =
  | { accepted: true; appointment: AutoscuolaAppointment; response: AutoscuolaWaitlistResponse }
  | { accepted: false; response: AutoscuolaWaitlistResponse };

export type CancelAppointmentResult =
  | { rescheduled: true; newStartsAt: IsoDate }
  | { rescheduled: false; broadcasted?: boolean };


export type RescheduleAppointmentInput = {
  startsAt: IsoDate;
  endsAt?: IsoDate | null;
};

export type RescheduleAppointmentResult = AutoscuolaAppointment;

export type LoginInput = { email: string; password: string };
export type StudentRegisterInput = {
  name: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  schoolCode: string;
};

// Self-service password reset (OTP via email)
export type PasswordResetRequestInput = { email: string };
export type PasswordResetVerifyInput = { email: string; code: string };
export type PasswordResetConfirmInput = {
  email: string;
  code: string;
  password: string;
  confirmPassword: string;
};
/** request/verify return only an ack; the generic message is shown as-is. */
export type PasswordResetAck = { message?: string };
/**
 * confirm returns the full AuthPayload (auto-login) when the account can enter,
 * or only a message (e.g. no company membership → log in manually).
 */
export type PasswordResetConfirmResult =
  | { autoLogin: true; payload: AuthPayload }
  | { autoLogin: false; message?: string };

export type SelectCompanyInput = { companyId: Uuid };
export type UpdateProfileInput = { name: string; phone?: string };
export type MobileInviteContext = {
  companyName: string;
  companyId: Uuid;
  email: string;
  role: string;
  expiresAt: IsoDate;
  hasAccount: boolean;
  alreadyMember: boolean;
  autoscuolaActive: boolean;
  requiresPhone: boolean;
};

export type AcceptMobileInviteInput = {
  mode: 'existing' | 'register';
  name?: string;
  password: string;
  confirmPassword?: string;
  phone?: string;
};

export type AutoscuolaSettings = {
  availabilityWeeks: number;
  studentReminderMinutes: 120 | 60 | 30 | 20 | 15;
  instructorReminderMinutes: 120 | 60 | 30 | 20 | 15;
  slotFillChannels?: Array<'push' | 'whatsapp' | 'email'>;
  studentReminderChannels?: Array<'push' | 'whatsapp' | 'email'>;
  instructorReminderChannels?: Array<'push' | 'whatsapp' | 'email'>;
  autoPaymentsEnabled?: boolean;
  lessonCreditFlowEnabled?: boolean;
  lessonPrice30?: number;
  lessonPrice60?: number;
  penaltyCutoffHoursPreset?: 1 | 2 | 4 | 6 | 12 | 24 | 48;
  penaltyPercentPreset?: 25 | 50 | 75 | 100;
  paymentNotificationChannels?: Array<'push' | 'email'>;
  ficVatTypeId?: string | null;
  ficPaymentMethodId?: string | null;
  lessonPolicyEnabled?: boolean;
  lessonRequiredTypesEnabled?: boolean;
  lessonRequiredTypes?: Array<'manovre' | 'urbano' | 'extraurbano' | 'notturna' | 'autostrada' | 'parcheggio' | 'altro'>;
  lessonTypeConstraints?: Partial<
    Record<
      'manovre' | 'urbano' | 'extraurbano' | 'notturna' | 'autostrada' | 'parcheggio' | 'altro',
      { daysOfWeek: number[]; startMinutes: number; endMinutes: number } | null
    >
  >;
  bookingSlotDurations?: number[];
  appBookingActors?: 'students' | 'instructors' | 'both';
  instructorBookingMode?: 'manual_full' | 'manual_engine';
  swapEnabled?: boolean;
  studentCancellationEnabled?: boolean;
  studentNotesEnabled?: boolean;
  instructorClustersEnabled?: boolean;
  autoCheckinEnabled?: boolean;
  vehiclesEnabled?: boolean;
  // "Auto al seguito" opt-in per license category (moto): a guida for an enabled
  // category additionally reserves a follow car.
  followCarRules?: Partial<Record<'AM' | 'A1' | 'A2' | 'A', { enabled: boolean }>>;
  groupLessonsEnabled?: boolean;
  quizEnabled?: boolean;
};

export type MobileBookingOptions = {
  bookingSlotDurations: number[];
  lessonTypeSelectionEnabled?: boolean;
  availableLessonTypes: Array<
    'manovre' | 'urbano' | 'extraurbano' | 'notturna' | 'autostrada' | 'parcheggio' | 'altro'
  >;
  instructorPreferenceEnabled?: boolean;
  weeklyBookingLimit?: {
    enabled: boolean;
    limit?: number;
    current?: number;
    reached?: boolean;
    examPriority?: {
      active: boolean;
      examDate: string | null;
    } | null;
  };
  assignedInstructorId?: string | null;
  assignedInstructorName?: string | null;
  assignedInstructorPhone?: string | null;
  isLockedToInstructor?: boolean;
  weeklyAbsenceEnabled?: boolean;
  appBookingActors?: 'students' | 'instructors' | 'both';
  swapEnabled?: boolean;
  studentCancellationEnabled?: boolean;
  examPriority?: { active: boolean; examDate: string | null };
  blockedByExamPriority?: boolean;
};

export type AvailableSlot = { startsAt: IsoDate; endsAt: IsoDate };

export type InstructorBookingMode = 'manual_full' | 'manual_engine';

export type InstructorBookingSuggestion = {
  startsAt: IsoDate;
  endsAt: IsoDate;
  instructorId: Uuid;
  vehicleId: Uuid;
  suggestedLessonType: string;
  durationMinutes: number;
};

export type SuggestInstructorBookingInput = {
  studentId: Uuid;
  preferredDate?: string;
};

export type ConfirmInstructorBookingInput = {
  studentId: Uuid;
  startsAt: IsoDate;
  endsAt: IsoDate;
  instructorId: Uuid;
  vehicleId: Uuid | null;
  // Follow car (auto al seguito) + extra motos for moto lessons.
  followVehicleId?: Uuid | null;
  extraMotoVehicleIds?: Uuid[];
  locationId?: Uuid | null;
  lessonType?: string;
  types?: string[];
  skipWeeklyLimitCheck?: boolean;
};

export type ConfirmInstructorBookingBatchInput = {
  studentId: Uuid;
  instructorId: Uuid;
  vehicleId: Uuid | null;
  // Follow car (auto al seguito) + extra motos applied to every entry.
  followVehicleId?: Uuid | null;
  extraMotoVehicleIds?: Uuid[];
  lessonType?: string;
  types?: string[];
  skipWeeklyLimitCheck?: boolean;
  entries: Array<{ startsAt: IsoDate; endsAt: IsoDate }>;
};

export type ConfirmInstructorBookingBatchResult = {
  created: number;
  appointments: AutoscuolaAppointment[];
};

export type InstructorBlock = {
  id: Uuid;
  companyId: Uuid;
  instructorId: Uuid;
  startsAt: IsoDate;
  endsAt: IsoDate;
  reason: string | null;
  createdAt: IsoDate;
  updatedAt: IsoDate;
};

export type CreateInstructorBlockInput = {
  startsAt: IsoDate;
  endsAt: IsoDate;
  reason?: string;
  recurring?: boolean;
  recurringWeeks?: number;
};

export type RegisterPushTokenInput = {
  token: string;
  platform: 'ios' | 'android';
  deviceId?: string;
  appVersion?: string;
};

export type UnregisterPushTokenInput = {
  token?: string;
};

export type DateAvailabilityMap = {
  dates: Record<string, boolean>;
  instructorsByDate: Record<string, string[]>;
  holidays?: string[];
};

export type AutoscuolaHoliday = {
  id: string;
  companyId: string;
  date: string;
  label: string | null;
  createdBy: string | null;
  createdAt: string;
};

export type OutOfAvailabilityAppointment = {
  id: string;
  startsAt: string;
  endsAt: string;
  type: string;
  status: string;
  groupLessonId: string | null;
  studentName: string;
  instructorName: string | null;
  vehicleName: string | null;
  outOfAvailabilityFor: ('instructor' | 'vehicle')[];
};

export type InstructorClusterSettings = {
  bookingSlotDurations?: number[];
  roundedHoursOnly?: boolean;
  appBookingActors?: 'students' | 'instructors' | 'both';
  instructorBookingMode?: 'manual_full' | 'manual_engine';
  swapEnabled?: boolean;
  studentCancellationEnabled?: boolean;
  swapNotifyMode?: 'all' | 'available_only';
  bookingCutoffEnabled?: boolean;
  bookingCutoffTime?: string;
  weeklyBookingLimitEnabled?: boolean;
  weeklyBookingLimit?: number;
  emptySlotNotificationEnabled?: boolean;
  emptySlotNotificationTarget?: 'all' | 'availability_matching';
  emptySlotNotificationTimes?: string[];
  restrictedTimeRangeEnabled?: boolean;
  restrictedTimeRangeStart?: string;
  restrictedTimeRangeEnd?: string;
  weeklyAbsenceEnabled?: boolean;
  availabilityMode?: AvailabilityMode;
};

export type AvailabilityMode = 'default' | 'publication';
export type InstructorPublishedWeek = { id: string; weekStart: string; publishedAt: string };

// ── Instructor Hours ──
export type InstructorHoursDayBreakdown = {
  date: string;
  dayLabel: string;
  totalMinutes: number;
  outsideWorkingHoursMinutes: number;
  appointmentCount: number;
};

export type InstructorHoursEntry = {
  instructorId: string;
  instructorName: string;
  workingHoursStart: string | null;
  workingHoursEnd: string | null;
  weekly: {
    totalMinutes: number;
    outsideWorkingHoursMinutes: number;
    byDay: InstructorHoursDayBreakdown[];
  };
  monthly: {
    monthLabel: string;
    totalMinutes: number;
    outsideWorkingHoursMinutes: number;
  };
};

export type InstructorHoursResponse = InstructorHoursEntry[];

// Range-based reporting (period selector). Buckets = days (span ≤ 14) or weeks.
export type InstructorHoursBucket = {
  key: string;
  label: string;
  startDate: string; // ISO YYYY-MM-DD (day, or week Monday)
  totalMinutes: number;
  outsideWorkingHoursMinutes: number;
  appointmentCount: number;
};

export type InstructorHoursRange = {
  instructorId: string;
  instructorName: string;
  workingHoursStart: string | null;
  workingHoursEnd: string | null;
  rangeStart: string; // ISO YYYY-MM-DD inclusive
  rangeEnd: string; // ISO YYYY-MM-DD inclusive
  granularity: 'day' | 'week';
  total: { totalMinutes: number; outsideWorkingHoursMinutes: number; appointmentCount: number };
  buckets: InstructorHoursBucket[];
};

export type InstructorHoursRangeResponse = InstructorHoursRange[];

export type CompanyBookingDefaults = {
  bookingSlotDurations: number[];
  roundedHoursOnly: boolean;
  appBookingActors: 'students' | 'instructors' | 'both';
  instructorBookingMode: 'manual_full' | 'manual_engine';
  swapEnabled: boolean;
  swapNotifyMode: 'all' | 'available_only';
  bookingCutoffEnabled: boolean;
  bookingCutoffTime: string;
  weeklyBookingLimitEnabled: boolean;
  weeklyBookingLimit: number;
  emptySlotNotificationEnabled: boolean;
  emptySlotNotificationTarget: 'all' | 'availability_matching';
  emptySlotNotificationTimes: string[];
  restrictedTimeRangeEnabled: boolean;
  restrictedTimeRangeStart: string;
  restrictedTimeRangeEnd: string;
  weeklyAbsenceEnabled: boolean;
  studentCancellationEnabled: boolean;
  quizEnabled: boolean;
};

// ── Quiz ─────────────────────────────────────────────────────────────────────

export type QuizSessionMode = 'EXAM' | 'PRACTICE' | 'CHAPTER' | 'REVIEW' | 'SCHEDA' | 'SCHEDA_ESAME';

export type QuizChapterProgress = {
  id: Uuid;
  chapterNumber: number;
  description: string;
  totalQuestions: number;
  attemptedCount: number;
  correctCount: number;
};

export type QuizQuestion = {
  id: Uuid;
  questionText: string;
  imageUrl: string | null;
  chapterNumber: number;
};

export type QuizQuestionWithAnswer = QuizQuestion & {
  correctAnswer: boolean;
  hint: { title: string; descriptionHtml: string } | null;
  wrongCount?: number;
  timesAnswered?: number;
  correctRate?: number;
};

export type StartQuizSessionInput = {
  mode: QuizSessionMode;
  chapterId?: Uuid;
};

export type StartQuizSessionResult = {
  sessionId: Uuid;
  questions: QuizQuestionWithAnswer[];
  timeLimitSec: number | null;
  totalQuestions: number;
};

export type SubmitQuizAnswerResult = {
  isCorrect: boolean;
  correctAnswer: boolean;
  hint: { title: string; descriptionHtml: string } | null;
  sessionStatus: 'in_progress' | 'completed' | 'auto_failed';
  correctCount: number;
  wrongCount: number;
};

export type QuizSessionResult = {
  id: Uuid;
  mode: QuizSessionMode;
  status: string;
  passed: boolean | null;
  totalQuestions: number;
  correctCount: number;
  wrongCount: number;
  skippedCount: number;
  durationSec: number | null;
  startedAt: IsoDate;
  completedAt: IsoDate | null;
  timeLimitSec: number | null;
  schedaNumber: number | null;
  chapterDescription: string | null;
  chaptersBreakdown: Array<{
    chapterNumber: number;
    description: string;
    correct: number;
    wrong: number;
    total: number;
  }>;
  wrongAnswers: QuizQuestionWithAnswer[];
};

export type QuizStudentStats = {
  totalSessions: number;
  examsPassed: number;
  examsFailed: number;
  examPassRate: number;
  readinessScore: number;
  chaptersProgress: QuizChapterProgress[];
  recentSessions: Array<{
    id: Uuid;
    mode: QuizSessionMode;
    completedAt: IsoDate | null;
    passed: boolean | null;
    correctCount: number;
    wrongCount: number;
    totalQuestions: number;
  }>;
  weakChapters: Array<{
    chapterNumber: number;
    description: string;
    correctRate: number;
  }>;
};

// ── Quiz Schede ──────────────────────────────────────────────────────────────

export type QuizChapterSchedeProgress = {
  id: Uuid;
  chapterNumber: number;
  description: string;
  totalSchede: number;
  completedSchede: number;
  passedSchede: number;
  failedSchede: number;
  correctRate: number;
};

export type QuizSchedaSummary = {
  id: Uuid;
  schedaNumber: number;
  totalQuestions: number;
  status: 'not_started' | 'in_progress' | 'passed' | 'failed';
  errorCount: number | null;
  correctCount: number | null;
  completedAt: IsoDate | null;
  sessionId: Uuid | null;
};

export type QuizChapterSchedeResponse = {
  chapter: { id: Uuid; chapterNumber: number; description: string };
  schede: QuizSchedaSummary[];
  summary: {
    totalSchede: number;
    completedCount: number;
    passedCount: number;
    failedCount: number;
    correctRate: number;
  };
};

export type QuizSchedaQuestionWithAnswer = QuizQuestionWithAnswer & {
  answered: { studentAnswer: boolean; isCorrect: boolean } | null;
};

export type StartSchedaSessionResult = {
  sessionId: Uuid;
  questions: QuizSchedaQuestionWithAnswer[];
  timeLimitSec: null;
  totalQuestions: number;
  schedaNumber: number;
  chapterDescription: string;
  resuming: boolean;
  correctCount: number;
  wrongCount: number;
};

// ── Exam Schede ─────────────────────────────────────────────────────────────

export type ExamSchedeProgressResponse = {
  schede: QuizSchedaSummary[];
  summary: {
    totalSchede: number;
    completedCount: number;
    passedCount: number;
    failedCount: number;
    correctRate: number;
  };
};

export type StartExamSchedaSessionResult = {
  sessionId: Uuid;
  questions: QuizSchedaQuestionWithAnswer[];
  timeLimitSec: number;
  totalQuestions: number;
  schedaNumber: number;
  resuming: boolean;
  correctCount: number;
  wrongCount: number;
};

// Public app config (pre-login) — drives the force-update gate.
export type AppConfig = {
  minSupportedVersion: { ios: string; android: string };
};
