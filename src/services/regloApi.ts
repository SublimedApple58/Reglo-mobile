import { authStorage, createApiClient } from './apiClient';
import {
  AgendaBootstrapParams,
  AgendaBootstrapPayload,
  AppConfig,
  AuthPayload,
  AutoscuolaAppointment,
  AutoscuolaAppointmentWithRelations,
  AutoscuolaAvailabilitySlot,
  AutoscuolaCase,
  AutoscuolaCaseWithStudent,
  AutoscuolaDeadlineItem,
  AutoscuolaInstructor,
  AutoscuolaOverview,
  AutoscuolaStudent,
  AutoscuolaVehicle,
  AutoscuolaWaitlistOfferWithSlot,
  GroupLesson,
  GroupLessonInvite,
  GroupLessonInvitee,
  CreateGroupLessonInput,
  AcceptMobileInviteInput,
  CancelAppointmentResult,
  CreateAppointmentInput,
  CreateAvailabilitySlotsInput,
  DefaultAvailability,
  CreateBookingRequestInput,
  CreateBookingRequestResult,
  CreateCaseInput,
  CreateInstructorInput,
  CreateSlotsResult,
  CreateStudentInput,
  CreateVehicleInput,
  UpdateInstructorInput,
  LoginInput,
  MobileInviteContext,
  LogoutPayload,
  MePayload,
  GetAppointmentsParams,
  UpdateProfileInput,
  RespondWaitlistOfferInput,
  RespondWaitlistOfferResult,
  AutoscuolaSwapOfferWithDetails,
  RespondSwapOfferInput,
  RespondSwapOfferResult,
  InstructorSwapInput,
  RegisterPushTokenInput,
  MobileBookingOptions,
  AvailableSlot,
  SuggestInstructorBookingInput,
  InstructorBookingSuggestion,
  ConfirmInstructorBookingInput,
  ConfirmInstructorBookingBatchInput,
  ConfirmInstructorBookingBatchResult,
  LatestStudentAppointmentNote,
  DeleteAccountInput,
  DeleteAccountPayload,
  SelectCompanyInput,
  SelectCompanyPayload,
  StudentRegisterInput,
  PasswordResetRequestInput,
  PasswordResetVerifyInput,
  PasswordResetConfirmInput,
  PasswordResetConfirmResult,
  UnregisterPushTokenInput,
  RescheduleAppointmentInput,
  RescheduleAppointmentResult,
  UpdateAppointmentDetailsInput,
  UpdateAppointmentStatusInput,
  UpdateCaseStatusInput,
  UpdateVehicleInput,
  UserPublic,
  AutoscuolaSettings,
  CreateInstructorBlockInput,
  InstructorBlock,
  AutoscuolaHoliday,
  DailyAvailabilityOverride,
  SetDailyAvailabilityOverrideInput,
  DeleteDailyAvailabilityOverrideInput,
  SetRecurringAvailabilityOverrideInput,
  TimeRange,
  OutOfAvailabilityAppointment,
  DateAvailabilityMap,
  InstructorClusterSettings,
  CompanyBookingDefaults,
  InstructorHoursResponse,
  InstructorHoursRangeResponse,
  QuizChapterProgress,
  StartQuizSessionInput,
  StartQuizSessionResult,
  SubmitQuizAnswerResult,
  QuizSessionResult,
  QuizStudentStats,
  QuizChapterSchedeProgress,
  QuizChapterSchedeResponse,
  StartSchedaSessionResult,
  ExamSchedeProgressResponse,
  StartExamSchedaSessionResult,
  AutoscuolaLocation,
  CreateLocationInput,
  UpdateLocationInput,
  StudentPhasePayload,
  CheckInstructorAvailabilityInput,
  InstructorAvailabilityResult,
} from '../types/regloApi';

export const createRegloApi = (baseUrl?: string) => {
  const client = createApiClient(baseUrl);

  return {
    // Public, pre-login: drives the force-update gate (minimum supported version).
    getAppConfig: async () =>
      client.request<AppConfig>('/api/mobile/app-config'),
    login: async (input: LoginInput) => {
      const payload = await client.request<AuthPayload>('/api/mobile/auth/login', {
        method: 'POST',
        body: input,
      });
      await authStorage.setToken(payload.token);
      await authStorage.setActiveCompanyId(payload.activeCompanyId);
      return payload;
    },
    studentRegister: async (input: StudentRegisterInput) => {
      const payload = await client.request<AuthPayload>('/api/mobile/auth/student-register', {
        method: 'POST',
        body: input,
      });
      await authStorage.setToken(payload.token);
      await authStorage.setActiveCompanyId(payload.activeCompanyId);
      return payload;
    },
    // ── Password reset (OTP via email) ──
    passwordResetRequest: async (input: PasswordResetRequestInput) => {
      // Server always answers 200 with a generic message (no enumeration); the
      // screen shows its own generic copy, so we only care that it didn't throw.
      await client.request<unknown>('/api/mobile/auth/password-reset/request', {
        method: 'POST',
        body: input,
      });
    },
    passwordResetVerify: async (input: PasswordResetVerifyInput) => {
      // Throws RegloApiError (400) when the code is wrong/expired.
      await client.request<unknown>('/api/mobile/auth/password-reset/verify', {
        method: 'POST',
        body: input,
      });
    },
    passwordResetConfirm: async (
      input: PasswordResetConfirmInput,
    ): Promise<PasswordResetConfirmResult> => {
      // On success the server returns the full AuthPayload (auto-login) OR only
      // a message (no company membership). `request` returns `data` or undefined.
      const payload = (await client.request<AuthPayload>(
        '/api/mobile/auth/password-reset/confirm',
        { method: 'POST', body: input },
      )) as AuthPayload | undefined;

      if (payload?.token) {
        await authStorage.setToken(payload.token);
        await authStorage.setActiveCompanyId(payload.activeCompanyId);
        return { autoLogin: true, payload };
      }
      return { autoLogin: false };
    },
    logout: async () => {
      const payload = await client.request<LogoutPayload>('/api/mobile/auth/logout', {
        method: 'POST',
      });
      await authStorage.clear();
      return payload;
    },
    deleteAccount: async (input: DeleteAccountInput = { confirm: true }) =>
      client.request<DeleteAccountPayload>('/api/mobile/auth/delete-account', {
        method: 'POST',
        body: input,
      }),
    me: async () => client.request<MePayload>('/api/mobile/me'),
    selectCompany: async (input: SelectCompanyInput) => {
      const payload = await client.request<SelectCompanyPayload>('/api/mobile/auth/select-company', {
        method: 'POST',
        body: input,
      });
      await authStorage.setActiveCompanyId(payload.activeCompanyId);
      return payload;
    },
    createInvite: async (input: { email: string; autoscuolaRole?: 'INSTRUCTOR' | 'STUDENT' }) =>
      client.request<{ message: string }>('/api/mobile/invites/create', {
        method: 'POST',
        body: input,
      }),
    getInviteContext: async (token: string) =>
      client.request<MobileInviteContext>(`/api/mobile/invites/${token}/context`),
    acceptInvite: async (token: string, input: AcceptMobileInviteInput) => {
      const payload = await client.request<AuthPayload>(`/api/mobile/invites/${token}/accept`, {
        method: 'POST',
        body: input,
      });
      await authStorage.setToken(payload.token);
      await authStorage.setActiveCompanyId(payload.activeCompanyId);
      return payload;
    },
    updateProfile: async (input: UpdateProfileInput) =>
      client.request<UserPublic>('/api/mobile/profile', {
        method: 'PATCH',
        body: input,
      }),
    getAutoscuolaSettings: async () =>
      client.request<AutoscuolaSettings>('/api/autoscuole/settings'),
    getMyPhase: async () =>
      client.request<StudentPhasePayload>('/api/autoscuole/me'),
    updateAutoscuolaSettings: async (input: AutoscuolaSettings) =>
      client.request<AutoscuolaSettings>('/api/autoscuole/settings', {
        method: 'PATCH',
        body: input,
      }),

    getInstructorSettings: async () =>
      client.request<{
        autonomousMode: boolean;
        settings: InstructorClusterSettings;
        companyDefaults: CompanyBookingDefaults;
        students: Array<{ id: string; firstName: string; lastName: string; assignedInstructorId: string | null }>;
        assignedStudentIds: string[];
        /** Codice di invito personale: gli allievi che si registrano con questo codice entrano nel gruppo dell'istruttore. */
        inviteCode?: string | null;
        instructorId?: string;
        autonomousInstructors?: Array<{ id: string; name: string }>;
        publishedWeeks?: Array<{ id: string; weekStart: string; publishedAt: string }>;
      }>('/api/autoscuole/instructor-settings'),

    updateInstructorSettings: async (input: Partial<InstructorClusterSettings> & { assignStudentIds?: string[] }) =>
      client.request<InstructorClusterSettings>('/api/autoscuole/instructor-settings', {
        method: 'PATCH',
        body: input,
      }),

    createExam: async (input: { studentIds: string[]; startsAt: string; endsAt?: string; instructorId?: string; notes?: string }) =>
      client.request<{ count: number }>('/api/autoscuole/exam', {
        method: 'POST',
        body: input,
      }),

    updateExamTime: async (input: { appointmentIds: string[]; startsAt: string; endsAt?: string }) =>
      client.request<unknown>('/api/autoscuole/exam', {
        method: 'PATCH',
        body: input,
      }),

    // ── Group lessons (Guide di gruppo) ──
    getGroupLessons: async (params?: { from?: string; to?: string }) =>
      client.request<GroupLesson[]>('/api/autoscuole/group-lessons', { params }),
    getGroupLesson: async (groupLessonId: string) =>
      client.request<GroupLesson>(`/api/autoscuole/group-lessons/${groupLessonId}`),
    updateGroupLesson: async (input: {
      groupLessonId: string;
      startsAt?: string;
      endsAt?: string;
      instructorId?: string | null;
      vehicleId?: string | null;
      /** Capienza massima (3 o 4) — il BE rifiuta sotto gli iscritti attuali. */
      capacity?: number;
      notes?: string | null;
    }) => {
      const { groupLessonId, ...body } = input;
      return client.request<unknown>(`/api/autoscuole/group-lessons/${groupLessonId}`, {
        method: 'PATCH',
        body,
      });
    },
    createGroupLesson: async (input: CreateGroupLessonInput) =>
      client.request<{ groupLessonId: string; participants: number; capacity: number }>(
        '/api/autoscuole/group-lessons',
        { method: 'POST', body: input },
      ),
    cancelGroupLesson: async (groupLessonId: string) =>
      client.request<unknown>(`/api/autoscuole/group-lessons/${groupLessonId}`, {
        method: 'DELETE',
      }),
    // Student withdraws themselves from a group lesson they are enrolled in.
    withdrawFromGroupLesson: async (groupLessonId: string) =>
      client.request<unknown>(`/api/autoscuole/group-lessons/${groupLessonId}/withdraw`, {
        method: 'POST',
      }),
    addGroupLessonParticipant: async (groupLessonId: string, studentId: string) =>
      client.request<unknown>(`/api/autoscuole/group-lessons/${groupLessonId}/participants`, {
        method: 'POST',
        body: { studentId },
      }),
    removeGroupLessonParticipant: async (groupLessonId: string, studentId: string) =>
      client.request<unknown>(`/api/autoscuole/group-lessons/${groupLessonId}/participants`, {
        method: 'DELETE',
        params: { studentId },
      }),
    inviteToGroupLesson: async (groupLessonId: string, expiresInHours?: number) =>
      client.request<{ inviteId: string }>(`/api/autoscuole/group-lessons/${groupLessonId}/invite`, {
        method: 'POST',
        body: { expiresInHours },
      }),
    getEligibleGroupLessonInvitees: async (groupLessonId: string) =>
      client.request<GroupLessonInvitee[]>(
        `/api/autoscuole/group-lessons/${groupLessonId}/eligible-invitees`,
      ),
    getGroupLessonInvites: async (studentId: string, limit?: number) =>
      client.request<GroupLessonInvite[]>('/api/autoscuole/group-lessons/invites', {
        params: { studentId, limit },
      }),
    respondGroupLessonInvite: async (
      inviteId: string,
      input: { studentId: string; response: 'accept' | 'decline' },
    ) =>
      client.request<{ accepted: boolean; appointmentId?: string }>(
        `/api/autoscuole/group-lessons/invites/${inviteId}/respond`,
        { method: 'POST', body: input },
      ),
    updateStudentGroupLessonOptIn: async (studentId: string, optIn: boolean) =>
      client.request<{ groupLessonsOptIn: boolean }>(
        `/api/autoscuole/students/${studentId}/group-lesson-opt-in`,
        { method: 'PATCH', body: { optIn } },
      ),

    declareWeeklyAbsence: async (input: { weekStart: string }) =>
      client.request<unknown>('/api/autoscuole/weekly-absence', {
        method: 'POST',
        body: input,
      }),

    getWeeklyAbsences: async (weekStart: string) =>
      client.request<Array<{ id: string; weekStart: string }>>('/api/autoscuole/weekly-absence', {
        params: { weekStart },
      }),

    cancelWeeklyAbsence: async (weekStart: string) =>
      client.request<unknown>(`/api/autoscuole/weekly-absence?weekStart=${weekStart}`, {
        method: 'DELETE',
      }),

    getPublishedWeeks: async (params: { instructorId?: string; from?: string; to?: string }) =>
      client.request<Array<{ id: string; weekStart: string; publishedAt: string }>>('/api/autoscuole/availability/published-weeks', {
        params,
      }),

    publishWeek: async (input: { weekStart: string; instructorId?: string }) =>
      client.request<unknown>('/api/autoscuole/availability/published-weeks', {
        method: 'POST',
        body: input,
      }),

    unpublishWeek: async (input: { weekStart: string; instructorId?: string }) =>
      client.request<unknown>('/api/autoscuole/availability/published-weeks', {
        method: 'DELETE',
        body: input,
      }),

    createInstructorSickLeave: async (input: { instructorId?: string; startDate: string; startTime?: string; endDate: string }) =>
      client.request<{ blocksCreated: number; appointmentsCancelled: number }>('/api/autoscuole/instructor-sick-leave', {
        method: 'POST',
        body: input,
      }),

    getNotifications: async (limit = 20) =>
      client.request<Array<{ id: string; kind: string; data: Record<string, unknown>; createdAt: string }>>('/api/autoscuole/notifications', {
        params: { limit: String(limit) },
      }),

    getOverview: async () => client.request<AutoscuolaOverview>('/api/autoscuole/overview'),
    getStudents: async (search?: string) =>
      client.request<AutoscuolaStudent[]>('/api/autoscuole/students', {
        params: search ? { search } : undefined,
      }),
    createStudent: async (input: CreateStudentInput) =>
      client.request<AutoscuolaStudent>('/api/autoscuole/students', {
        method: 'POST',
        body: input,
      }),
    getCases: async () => client.request<AutoscuolaCase[]>('/api/autoscuole/cases'),
    createCase: async (input: CreateCaseInput) =>
      client.request<AutoscuolaCase>('/api/autoscuole/cases', {
        method: 'POST',
        body: input,
      }),
    updateCaseStatus: async (caseId: string, input: UpdateCaseStatusInput) =>
      client.request<AutoscuolaCaseWithStudent>(`/api/autoscuole/cases/${caseId}/status`, {
        method: 'PATCH',
        body: input,
      }),
    getAppointments: async (params?: GetAppointmentsParams) =>
      client.request<AutoscuolaAppointmentWithRelations[]>('/api/autoscuole/appointments', {
        params,
      }),
    getAgendaBootstrap: async (params: AgendaBootstrapParams) =>
      client.request<AgendaBootstrapPayload>('/api/autoscuole/agenda/bootstrap', {
        params,
      }),
    getLatestStudentAppointmentNote: async (studentId: string, before?: string) =>
      client.request<LatestStudentAppointmentNote | null>(
        '/api/autoscuole/appointments/latest-note',
        {
          params: before ? { studentId, before } : { studentId },
        }
      ),
    createAppointment: async (input: CreateAppointmentInput) =>
      client.request<AutoscuolaAppointment>('/api/autoscuole/appointments', {
        method: 'POST',
        body: input,
      }),
    updateAppointmentStatus: async (appointmentId: string, input: UpdateAppointmentStatusInput) =>
      client.request<AutoscuolaAppointment>(
        `/api/autoscuole/appointments/${appointmentId}/status`,
        {
          method: 'PATCH',
          body: input,
        }
      ),
    updateAppointmentDetails: async (appointmentId: string, input: UpdateAppointmentDetailsInput) =>
      client.request<AutoscuolaAppointment>(`/api/autoscuole/appointments/${appointmentId}`, {
        method: 'PATCH',
        body: input,
      }),
    checkInstructorAvailability: async (input: CheckInstructorAvailabilityInput) =>
      client.request<InstructorAvailabilityResult>(
        '/api/autoscuole/instructor-availability',
        {
          params: {
            instructorId: input.instructorId,
            startsAt: input.startsAt,
            endsAt: input.endsAt,
            ...(input.excludeAppointmentId
              ? { excludeAppointmentId: input.excludeAppointmentId }
              : {}),
          },
        },
      ),
    getLocations: async () =>
      client.request<AutoscuolaLocation[]>('/api/autoscuole/locations'),
    createLocation: async (input: CreateLocationInput) =>
      client.request<AutoscuolaLocation>('/api/autoscuole/locations', {
        method: 'POST',
        body: input,
      }),
    updateLocation: async (id: string, input: UpdateLocationInput) =>
      client.request<AutoscuolaLocation>(`/api/autoscuole/locations/${id}`, {
        method: 'PATCH',
        body: input,
      }),
    deleteLocation: async (id: string) =>
      client.request<null>(`/api/autoscuole/locations/${id}`, { method: 'DELETE' }),
    cancelAppointment: async (appointmentId: string) =>
      client.request<CancelAppointmentResult>(
        `/api/autoscuole/appointments/${appointmentId}/cancel`,
        {
          method: 'POST',
        }
      ),
    permanentlyCancelAppointment: async (appointmentId: string) =>
      client.request<{ success: boolean; message?: string }>(
        `/api/autoscuole/appointments/${appointmentId}/permanent-cancel`,
        {
          method: 'POST',
        }
      ),
    rescheduleAppointment: async (
      appointmentId: string,
      input: RescheduleAppointmentInput,
    ) =>
      client.request<RescheduleAppointmentResult>(
        `/api/autoscuole/appointments/${appointmentId}/reschedule`,
        {
          method: 'PATCH',
          body: input,
        },
      ),
    getOutOfAvailabilityAppointments: async (instructorId?: string) =>
      client.request<OutOfAvailabilityAppointment[]>(
        '/api/autoscuole/appointments/out-of-availability',
        {
          params: instructorId ? { instructorId } : {},
        }
      ),
    approveAvailabilityOverride: async (appointmentId: string) =>
      client.request<{ success: boolean }>(
        `/api/autoscuole/appointments/${appointmentId}/approve-override`,
        {
          method: 'POST',
        }
      ),
    getInstructors: async () =>
      client.request<AutoscuolaInstructor[]>('/api/autoscuole/instructors'),
    createInstructor: async (input: CreateInstructorInput) =>
      client.request<AutoscuolaInstructor>('/api/autoscuole/instructors', {
        method: 'POST',
        body: input,
      }),
    updateInstructor: async (instructorId: string, input: UpdateInstructorInput) =>
      client.request<AutoscuolaInstructor>(`/api/autoscuole/instructors/${instructorId}`, {
        method: 'PATCH',
        body: input,
      }),
    getVehicles: async () => client.request<AutoscuolaVehicle[]>('/api/autoscuole/vehicles'),
    createVehicle: async (input: CreateVehicleInput) =>
      client.request<AutoscuolaVehicle>('/api/autoscuole/vehicles', {
        method: 'POST',
        body: input,
      }),
    updateVehicle: async (vehicleId: string, input: UpdateVehicleInput) =>
      client.request<AutoscuolaVehicle>(`/api/autoscuole/vehicles/${vehicleId}`, {
        method: 'PATCH',
        body: input,
      }),
    deleteVehicle: async (vehicleId: string) =>
      client.request<AutoscuolaVehicle>(`/api/autoscuole/vehicles/${vehicleId}`, {
        method: 'DELETE',
      }),
    getDeadlines: async () =>
      client.request<AutoscuolaDeadlineItem[]>('/api/autoscuole/deadlines'),

    createAvailabilitySlots: async (input: CreateAvailabilitySlotsInput) =>
      client.request<CreateSlotsResult>('/api/autoscuole/availability/slots', {
        method: 'POST',
        body: input,
      }),
    deleteAvailabilitySlots: async (input: CreateAvailabilitySlotsInput) =>
      client.request<CreateSlotsResult>('/api/autoscuole/availability/slots', {
        method: 'DELETE',
        body: input,
      }),
    getAvailabilitySlots: async (params: {
      ownerType: string;
      ownerId: string;
      date?: string;
      // Inclusive date range — when both are set the backend returns slots for
      // every day in [from, to] in one response (one round-trip for a week).
      from?: string;
      to?: string;
    }) =>
      client.request<AutoscuolaAvailabilitySlot[]>('/api/autoscuole/availability/slots', {
        params,
      }),
    setDailyAvailabilityOverride: async (input: SetDailyAvailabilityOverrideInput) =>
      client.request<DailyAvailabilityOverride>('/api/autoscuole/availability/overrides', {
        method: 'POST',
        body: input,
      }),
    deleteDailyAvailabilityOverride: async (input: DeleteDailyAvailabilityOverrideInput) =>
      client.request<void>('/api/autoscuole/availability/overrides', {
        method: 'DELETE',
        body: input,
      }),
    setRecurringAvailabilityOverride: async (input: SetRecurringAvailabilityOverrideInput) =>
      client.request<{ count: number }>('/api/autoscuole/availability/overrides/recurring', {
        method: 'POST',
        body: input,
      }),
    getDefaultAvailability: async (params: {
      ownerType: string;
      ownerId: string;
    }) =>
      client.request<DefaultAvailability | null>('/api/autoscuole/availability/default', {
        params,
      }),
    getDailyAvailabilityOverrides: async (params: {
      ownerType: 'instructor' | 'vehicle';
      ownerId: string;
      from?: string;
      to?: string;
    }) =>
      client.request<DailyAvailabilityOverride[]>('/api/autoscuole/availability/overrides', {
        params,
      }),
    createBookingRequest: async (input: CreateBookingRequestInput) =>
      client.request<CreateBookingRequestResult>('/api/autoscuole/booking-requests', {
        method: 'POST',
        body: input,
      }),
    getBookingOptions: async (studentId: string) =>
      client.request<MobileBookingOptions>('/api/autoscuole/booking-options', {
        params: { studentId },
      }),
    getAvailableSlots: async (params: {
      studentId: string;
      date: string;
      durationMinutes: number;
      lessonType?: string;
      instructorId?: string;
    }) =>
      client.request<AvailableSlot[]>('/api/autoscuole/available-slots', {
        params,
      }),
    getDateAvailability: async (params: {
      studentId: string;
      from: string;
      to: string;
    }) =>
      client.request<DateAvailabilityMap>('/api/autoscuole/date-availability', {
        params,
      }),
    suggestInstructorBooking: async (input: SuggestInstructorBookingInput) =>
      client.request<InstructorBookingSuggestion>('/api/autoscuole/instructor-bookings/suggest', {
        method: 'POST',
        body: input,
      }),
    getStudentsCompletedHours: async () =>
      client.request<Record<string, number>>('/api/autoscuole/students/completed-hours'),
    confirmInstructorBooking: async (input: ConfirmInstructorBookingInput) =>
      client.request<AutoscuolaAppointment>('/api/autoscuole/instructor-bookings/confirm', {
        method: 'POST',
        body: input,
      }),
    confirmInstructorBookingBatch: async (input: ConfirmInstructorBookingBatchInput) =>
      client.request<ConfirmInstructorBookingBatchResult>('/api/autoscuole/instructor-bookings/confirm-batch', {
        method: 'POST',
        body: input,
      }),
    getInstructorBlocks: async (params: { instructorId?: string; from?: string; to?: string; reason?: string }) =>
      client.request<InstructorBlock[]>('/api/autoscuole/instructor-blocks', {
        params,
      }),
    createInstructorBlock: async (input: CreateInstructorBlockInput) =>
      client.request<InstructorBlock>('/api/autoscuole/instructor-blocks', {
        method: 'POST',
        body: input,
      }),
    deleteInstructorBlock: async (blockId: string) =>
      client.request<{ deleted: boolean }>(`/api/autoscuole/instructor-blocks/${blockId}`, {
        method: 'DELETE',
      }),
    getHolidays: async (params: { from: string; to: string }) =>
      client.request<AutoscuolaHoliday[]>('/api/autoscuole/holidays', {
        params,
      }),
    createHoliday: async (input: { date: string; label?: string; cancelAppointments: boolean }) =>
      client.request<{ holiday: AutoscuolaHoliday; cancelledCount: number }>('/api/autoscuole/holidays', {
        method: 'POST',
        body: input,
      }),
    deleteHoliday: async (input: { date: string }) =>
      client.request<{ success: boolean }>('/api/autoscuole/holidays', {
        method: 'DELETE',
        body: input,
      }),
    respondWaitlistOffer: async (offerId: string, input: RespondWaitlistOfferInput) =>
      client.request<RespondWaitlistOfferResult>(
        `/api/autoscuole/waitlist/offers/${offerId}/respond`,
        {
          method: 'POST',
          body: input,
        }
      ),
    getWaitlistOffers: async (studentId: string, limit?: number) =>
      client.request<AutoscuolaWaitlistOfferWithSlot[]>('/api/autoscuole/waitlist/offers', {
        params: { studentId, limit },
      }),
    createSwapOffer: async (appointmentId: string) =>
      client.request<{ id: string }>('/api/autoscuole/swap/create', {
        method: 'POST',
        body: { appointmentId },
      }),
    getSwapOffers: async (studentId: string, limit?: number) =>
      client.request<AutoscuolaSwapOfferWithDetails[]>('/api/autoscuole/swap/offers', {
        params: { studentId, limit },
      }),
    getMySwapOffers: async (studentId: string) =>
      client.request<AutoscuolaSwapOfferWithDetails[]>('/api/autoscuole/swap/my-offers', {
        params: { studentId },
      }),
    cancelSwapOffer: async (offerId: string, studentId: string) =>
      client.request<{ cancelled: boolean }>(
        `/api/autoscuole/swap/offers/${offerId}/cancel`,
        {
          method: 'POST',
          body: { studentId },
        },
      ),
    getMyAcceptedSwaps: async (studentId: string) =>
      client.request<Array<{
        id: string;
        acceptedByName: string;
        appointmentDate: string;
        appointmentTime: string;
        instructorName: string;
        vehicleName: string;
        appointmentType: string;
        acceptedAt: string;
      }>>('/api/autoscuole/swap/my-accepted', {
        params: { studentId },
      }),
    respondSwapOffer: async (offerId: string, input: RespondSwapOfferInput) =>
      client.request<RespondSwapOfferResult>(
        `/api/autoscuole/swap/offers/${offerId}/respond`,
        {
          method: 'POST',
          body: input,
        },
      ),
    instructorSwapAppointments: async (input: InstructorSwapInput) =>
      client.request<{ message: string }>('/api/autoscuole/swap/instructor-swap', {
        method: 'POST',
        body: input,
      }),
    registerPushToken: async (input: RegisterPushTokenInput) =>
      client.request<{ id: string }>('/api/mobile/push/register', {
        method: 'POST',
        body: input,
      }),
    unregisterPushToken: async (input: UnregisterPushTokenInput = {}) =>
      client.request<{ count: number }>('/api/mobile/push/unregister', {
        method: 'POST',
        body: input,
      }),
    getInstructorHours: async (params: { weekStart: string; monthStart?: string }) => {
      const qs = new URLSearchParams({ weekStart: params.weekStart });
      if (params.monthStart) qs.set('monthStart', params.monthStart);
      return client.request<InstructorHoursResponse>(
        `/api/autoscuole/instructor-hours?${qs.toString()}`
      );
    },
    getInstructorHoursRange: async (params: { from: string; to: string }) => {
      const qs = new URLSearchParams({ from: params.from, to: params.to });
      return client.request<InstructorHoursRangeResponse>(
        `/api/autoscuole/instructor-hours?${qs.toString()}`
      );
    },

    // ── Quiz ──────────────────────────────────────────────────────
    getQuizChapters: async () =>
      client.request<QuizChapterProgress[]>('/api/autoscuole/quiz/chapters'),
    startQuizSession: async (input: StartQuizSessionInput) =>
      client.request<StartQuizSessionResult>('/api/autoscuole/quiz/sessions', {
        method: 'POST',
        body: input,
      }),
    submitQuizAnswer: async (
      sessionId: string,
      body: { questionId: string; answer: boolean }
    ) =>
      client.request<SubmitQuizAnswerResult>(
        `/api/autoscuole/quiz/sessions/${sessionId}/answer`,
        { method: 'POST', body }
      ),
    completeQuizSession: async (sessionId: string) =>
      client.request<{ sessionId: string; passed: boolean | null; correctCount: number; wrongCount: number; totalQuestions: number }>(
        `/api/autoscuole/quiz/sessions/${sessionId}/complete`,
        { method: 'POST' }
      ),
    abandonQuizSession: async (sessionId: string) =>
      client.request<{ sessionId: string }>(
        `/api/autoscuole/quiz/sessions/${sessionId}/abandon`,
        { method: 'POST' }
      ),
    getQuizSessionResult: async (sessionId: string) =>
      client.request<QuizSessionResult>(
        `/api/autoscuole/quiz/sessions/${sessionId}`
      ),
    getQuizStudentStats: async () =>
      client.request<QuizStudentStats>('/api/autoscuole/quiz/stats'),

    // ── Quiz Schede ──────────────────────────────────────────────
    getChaptersWithSchedeProgress: async () =>
      client.request<QuizChapterSchedeProgress[]>('/api/autoscuole/quiz/chapters-schede'),
    getChapterSchede: async (chapterId: string) =>
      client.request<QuizChapterSchedeResponse>(
        `/api/autoscuole/quiz/chapters/${chapterId}/schede`,
      ),
    startSchedaSession: async (schedaId: string) =>
      client.request<StartSchedaSessionResult>(
        `/api/autoscuole/quiz/schede/${schedaId}/start`,
        { method: 'POST' },
      ),

    // ── Exam Schede ────────────────────────────────────────────────
    getExamSchedeProgress: async () =>
      client.request<ExamSchedeProgressResponse>('/api/autoscuole/quiz/exam-schede'),
    startExamSchedaSession: async (schedaId: string) =>
      client.request<StartExamSchedaSessionResult>(
        `/api/autoscuole/quiz/exam-schede/${schedaId}/start`,
        { method: 'POST' },
      ),
  };
};

export const regloApi = createRegloApi();
