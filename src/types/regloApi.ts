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
  createdAt: IsoDate;
  updatedAt: IsoDate;
};

export type AutoscuolaAppointmentWithRelations = AutoscuolaAppointment & {
  student: AutoscuolaStudent;
  case: AutoscuolaCase | null;
  instructor: AutoscuolaInstructor | null;
  vehicle: AutoscuolaVehicle | null;
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

export type UpdateAppointmentStatusInput = { status: string };

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
  preferredStartTime?: string;
  preferredEndTime?: string;
  maxDays?: number;
  selectedStartsAt?: IsoDate;
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
export type AutoscuolaSettings = { availabilityWeeks: number };
