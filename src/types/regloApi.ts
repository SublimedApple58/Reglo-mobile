export type IsoDate = string;
export type Uuid = string;

export type ApiSuccess<T> = { success: true; data: T };
export type ApiError = { success: false; message: string };
export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export type AutoscuolaRole = "OWNER" | "INSTRUCTOR" | "STUDENT";

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
  createdAt: IsoDate;
  updatedAt: IsoDate;
};

export type AutoscuolaVehicle = {
  id: Uuid;
  companyId: Uuid;
  name: string;
  plate: string | null;
  status: string;
  createdAt: IsoDate;
  updatedAt: IsoDate;
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
  notes: string | null;
  cancellationKind?: string | null;
  cancellationReason?: string | null;
  replacedByAppointmentId?: Uuid | null;
  createdAt: IsoDate;
  updatedAt: IsoDate;
};

export type AutoscuolaAppointmentWithRelations = AutoscuolaAppointment & {
  student: AutoscuolaStudent;
  case: AutoscuolaCase | null;
  instructor: AutoscuolaInstructor | null;
  vehicle: AutoscuolaVehicle | null;
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
};

export type CreateInstructorInput = { name: string; phone?: string };
export type CreateVehicleInput = { name: string; plate?: string };
export type UpdateInstructorInput = {
  name?: string;
  phone?: string | null;
  status?: string;
  userId?: Uuid | null;
};
export type UpdateVehicleInput = {
  name?: string;
  plate?: string | null;
  status?: string;
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

export type RepositionAppointmentResult = {
  queued: true;
  proposalCreated: boolean;
  proposalStartsAt?: IsoDate;
  taskId?: Uuid;
};

export type LoginInput = { email: string; password: string };
export type StudentRegisterInput = {
  name: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  schoolCode: string;
};

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
  instructorBookingMode?: 'manual_full' | 'manual_engine' | 'guided_proposal';
  swapEnabled?: boolean;
  studentNotesEnabled?: boolean;
};

export type MobileBookingOptions = {
  bookingSlotDurations: number[];
  lessonTypeSelectionEnabled?: boolean;
  availableLessonTypes: Array<
    'manovre' | 'urbano' | 'extraurbano' | 'notturna' | 'autostrada' | 'parcheggio' | 'altro'
  >;
  studentBookingMode?: 'engine' | 'free_choice';
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
};

export type AvailableSlot = { startsAt: IsoDate; endsAt: IsoDate };

export type InstructorBookingMode = 'manual_full' | 'manual_engine' | 'guided_proposal';

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
  vehicleId: Uuid;
  lessonType?: string;
  skipWeeklyLimitCheck?: boolean;
};

export type PaymentMethodSummary = {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
};

export type StudentPaymentOutstanding = {
  appointmentId: Uuid;
  startsAt: IsoDate;
  amountDue: number;
  status: string;
};

export type StudentAppointmentPaymentEvent = {
  id: Uuid;
  phase: 'penalty' | 'settlement' | 'manual_recovery' | string;
  status: 'pending' | 'processing' | 'succeeded' | 'failed' | 'abandoned' | string;
  amount: number;
  attemptCount: number;
  nextAttemptAt: IsoDate | null;
  failureCode: string | null;
  failureMessage: string | null;
  createdAt: IsoDate;
  paidAt: IsoDate | null;
};

export type StudentAppointmentPaymentHistoryItem = {
  appointmentId: Uuid;
  startsAt: IsoDate;
  endsAt: IsoDate | null;
  lessonStatus: string;
  paymentStatus: string;
  priceAmount: number;
  penaltyAmount: number;
  finalAmount: number;
  paidAmount: number;
  dueAmount: number;
  invoiceStatus: string | null;
  instructorName: string | null;
  vehicleName: string | null;
  latestPaidAt: IsoDate | null;
  payments: StudentAppointmentPaymentEvent[];
};

export type MobileStudentPaymentProfile = {
  autoPaymentsEnabled: boolean;
  lessonCreditFlowEnabled: boolean;
  lessonCreditsRequired?: boolean;
  hasPaymentMethod: boolean;
  paymentMethod: PaymentMethodSummary | null;
  blockedByInsoluti: boolean;
  outstanding: StudentPaymentOutstanding[];
  lessonCreditsAvailable: number;
};

export type MobileSetupIntentPayload = {
  customerId: string;
  ephemeralKey: string;
  setupIntentClientSecret: string;
  setupIntentId: string;
};

export type MobileConfirmPaymentMethodPayload = {
  id: string;
  paymentMethod: PaymentMethodSummary | null;
};

export type MobileRemovePaymentMethodPayload = {
  removed: boolean;
};

export type MobilePreparePayNowPayload = {
  customerId: string;
  ephemeralKey: string;
  paymentIntentClientSecret: string;
  paymentIntentId: string;
  amountDue: number;
};

export type MobileFinalizePayNowPayload = {
  success: boolean;
  status: 'succeeded' | 'processing' | 'failed';
  message?: string;
};

export type MobileAppointmentPaymentDocument = {
  documentType: 'invoice' | 'receipt' | 'none';
  label: string;
  viewUrl: string | null;
  shareMode: 'file' | 'link' | 'none';
  shareUrl: string | null;
  invoiceId: string | null;
  invoiceStatus: string | null;
  source: 'fic' | 'stripe' | 'none';
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
  studentName: string;
  instructorName: string | null;
  vehicleName: string | null;
  outOfAvailabilityFor: ('instructor' | 'vehicle')[];
};
