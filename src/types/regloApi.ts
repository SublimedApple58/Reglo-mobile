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
};

export type UpdateAppointmentDetailsInput = {
  lessonType?: string;
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

export type CreateAvailabilitySlotsInput = {
  ownerType: "student" | "instructor" | "vehicle";
  ownerId: Uuid;
  startsAt: IsoDate;
  endsAt: IsoDate;
  daysOfWeek?: number[];
  weeks?: number;
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
export type SignupInput = {
  companyName: string;
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
};

export type SelectCompanyInput = { companyId: Uuid };
export type UpdateProfileInput = { name: string };
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
};

export type MobileBookingOptions = {
  bookingSlotDurations: number[];
  lessonTypeSelectionEnabled?: boolean;
  availableLessonTypes: Array<
    'manovre' | 'urbano' | 'extraurbano' | 'notturna' | 'autostrada' | 'parcheggio' | 'altro'
  >;
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

export type RegisterPushTokenInput = {
  token: string;
  platform: 'ios' | 'android';
  deviceId?: string;
  appVersion?: string;
};

export type UnregisterPushTokenInput = {
  token?: string;
};
