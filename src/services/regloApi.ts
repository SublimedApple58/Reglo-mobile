import { authStorage, createApiClient } from './apiClient';
import {
  AgendaBootstrapParams,
  AgendaBootstrapPayload,
  AppConfig,
  InstructorLinkPreview,
  InstructorLinkResult,
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
  WhatsAppPreference,
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
  CheckInstructorBookingBatchInput,
  CheckInstructorBookingBatchResult,
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
  AppointmentEvaluation,
  EvaluationSheetConfig,
  SaveEvaluationSheetInput,
  UpdateAppointmentDetailsInput,
  UpdateAppointmentStatusInput,
  UpdateCaseStatusInput,
  UpdateVehicleInput,
  UserPublic,
  UploadMediaPayload,
  UploadSignatureInput,
  UserPhotosPayload,
  AutoscuolaSettings,
  CreateInstructorBlockInput,
  UpdateInstructorBlockInput,
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
  PaymentHistoryEvent,
  RoadState,
  RoadStartResult,
  RoadFreeOptions,
  RoadFreeStartInput,
  RoadPlan,
  RoadPlanResponse,
  RoadPlanRouteResponse,
  AddRoadHotspotCheckInput,
  RoadPlanStop,
  SavedRoadPlan,
  RoadDetail,
  RoadExamRoute,
  RoadHotspotDetail,
  RoadHotspots,
  RoadStudentItem,
  RoadStudentRoad,
  RoadBriefing,
  RoadMarker,
  RoadPoint,
  RoadPointsResult,
  AddRoadMarkerInput,
  UpdateRoadMarkerInput,
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
    getWhatsAppPreference: async () =>
      client.request<WhatsAppPreference>('/api/mobile/me/whatsapp', { method: 'GET' }),
    setWhatsAppPreference: async (enabled: boolean) =>
      client.request<WhatsAppPreference>('/api/mobile/me/whatsapp', {
        method: 'PATCH',
        body: { enabled },
      }),
    updateProfile: async (input: UpdateProfileInput) =>
      client.request<UserPublic>('/api/mobile/profile', {
        method: 'PATCH',
        body: input,
      }),
    uploadProfilePhoto: async (file: { uri: string; name: string; type: string }) => {
      const form = new FormData();
      // React Native accetta { uri, name, type } come parte multipart.
      form.append('file', file as unknown as Blob);
      return client.request<UploadMediaPayload>('/api/mobile/profile/photo', {
        method: 'POST',
        body: form,
        timeoutMs: 60_000,
      });
    },
    uploadSignature: async (input: UploadSignatureInput) =>
      client.request<UploadMediaPayload>('/api/mobile/profile/signature', {
        method: 'POST',
        body: input,
      }),
    getUserPhotos: async (userIds: string[], instructorIds: string[] = []) =>
      client.request<UserPhotosPayload>('/api/autoscuole/user-photos', {
        params: {
          ids: userIds.join(',') || undefined,
          instructorIds: instructorIds.join(',') || undefined,
        },
      }),
    getAutoscuolaSettings: async () =>
      client.request<AutoscuolaSettings>('/api/autoscuole/settings'),
    getMyPhase: async () =>
      client.request<StudentPhasePayload>('/api/autoscuole/me'),
    // REG-410 — a self-registered student sets their OWN license path at first
    // access (self-scoped, mirrors the owner-side setter on the web).
    setLicensePath: async (input: { licenseCategory: string; transmission: string }) =>
      client.request<{
        licenseCategory: string;
        transmission: string;
        needsLicensePath: boolean;
      }>('/api/autoscuole/me/license-path', { method: 'PATCH', body: input }),
    // REG-451 — l'allievo si associa a un istruttore dal QR della sua card
    // (o col codice a mano). `code` accetta anche l'URL completo del QR.
    getInstructorLinkPreview: async (code: string) =>
      client.request<InstructorLinkPreview>('/api/autoscuole/me/instructor-link', {
        params: { code },
      }),
    linkInstructor: async (code: string) =>
      client.request<InstructorLinkResult>('/api/autoscuole/me/instructor-link', {
        method: 'POST',
        body: { code },
      }),
    updateAutoscuolaSettings: async (input: Partial<AutoscuolaSettings>) =>
      client.request<AutoscuolaSettings>('/api/autoscuole/settings', {
        method: 'PATCH',
        body: input,
      }),
    // Colori agenda (pannello "Aspetto") — endpoint SCOPED gestibile anche dagli
    // istruttori (non solo titolari): scrive solo i campi colore dell'agenda.
    updateAgendaColorSettings: async (
      input: Partial<
        Pick<
          AutoscuolaSettings,
          | 'agendaColorCriterion'
          | 'agendaColorOverrides'
          | 'agendaColorExceptions'
          | 'automaticLessonMarker'
          | 'automaticLessonMarkerColor'
          | 'agendaShowVehicle'
        >
      >,
    ) =>
      client.request<AutoscuolaSettings>('/api/autoscuole/agenda-colors', {
        method: 'PATCH',
        body: input,
      }),

    getInstructorSettings: async () =>
      client.request<{
        autonomousMode: boolean;
        settings: InstructorClusterSettings;
        companyDefaults: CompanyBookingDefaults;
        students: Array<{ id: string; firstName: string; lastName: string; assignedInstructorId: string | null; licenseCategory?: string | null; transmission?: string | null; studentPhase?: string; examReady?: boolean; examReadyAt?: string | null }>;
        assignedStudentIds: string[];
        /** Codice di invito personale: gli allievi che si registrano con questo codice entrano nel gruppo dell'istruttore. */
        inviteCode?: string | null;
        instructorId?: string;
        autonomousInstructors?: Array<{ id: string; name: string }>;
        publishedWeeks?: Array<{ id: string; weekStart: string; publishedAt: string }>;
      }>('/api/autoscuole/instructor-settings'),

    updateInstructorSettings: async (
      // REG-426: appBookingActors / appBookingActorsByPath accettano anche `null`
      // per AZZERARE il campo (torna al default). Gli altri campi restano com'erano.
      input: Omit<Partial<InstructorClusterSettings>, 'appBookingActors' | 'appBookingActorsByPath'> & {
        assignStudentIds?: string[];
        appBookingActors?: 'students' | 'instructors' | 'both' | null;
        appBookingActorsByPath?: {
          moto?: 'students' | 'instructors' | 'both';
          auto?: 'students' | 'instructors' | 'both';
          pro?: 'students' | 'instructors' | 'both';
        } | null;
      },
    ) =>
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
    /**
     * REG-585 — accompagnatori aggiuntivi di un esame. Stessa PATCH dell'orario:
     * è la presenza di `coInstructorIds` a distinguere le due cose. Le righe di
     * un esame sono una per allievo, quindi si mandano tutte.
     */
    updateExamCoInstructors: async (input: { appointmentIds: string[]; coInstructorIds: string[] }) =>
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
      /** Moto group: replace the fleet / change the shared follow car. */
      vehicleIds?: string[];
      followVehicleId?: string | null;
      /** Capienza massima (3 o 4) — il BE rifiuta sotto gli iscritti attuali. */
      capacity?: number;
      notes?: string | null;
      /**
       * REG-585 — i colleghi che la portano insieme al principale. Assente =
       * non toccarli; lista vuota = toglili tutti.
       */
      coInstructorIds?: string[];
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
    // Presence outcome for a single seat (present/absent) — correctable any time.
    setGroupLessonSeatOutcome: async (
      groupLessonId: string,
      appointmentId: string,
      outcome: 'present' | 'absent',
    ) =>
      client.request<unknown>(`/api/autoscuole/group-lessons/${groupLessonId}/attendance`, {
        method: 'POST',
        body: { appointmentId, outcome },
      }),
    // REG-636 — change one participant's moto (null = a rotazione). A moto held
    // by a sibling is a swap: echo the sibling's seat in swapWithAppointmentId.
    setGroupLessonParticipantMoto: async (
      groupLessonId: string,
      payload: { appointmentId: string; vehicleId: string | null; swapWithAppointmentId?: string | null },
    ) =>
      client.request<unknown>(`/api/autoscuole/group-lessons/${groupLessonId}/participant-moto`, {
        method: 'POST',
        body: payload,
      }),
    markGroupLessonAllPresent: async (groupLessonId: string) =>
      client.request<unknown>(`/api/autoscuole/group-lessons/${groupLessonId}/attendance`, {
        method: 'POST',
        body: { all: true },
      }),
    inviteToGroupLesson: async (groupLessonId: string, expiresInHours?: number) =>
      client.request<{ inviteId: string; invitedCount: number }>(
        `/api/autoscuole/group-lessons/${groupLessonId}/invite`,
        {
          method: 'POST',
          body: { expiresInHours },
          // REG-617: gli invii veri ora partono DOPO la risposta, quindi la
          // richiesta e' corta. Il margine sopra i 15s di default resta come
          // cintura: su un'autoscuola grande il calcolo degli idonei legge
          // comunque qualche centinaio di righe, e un timeout qui si vedeva
          // come "Aborted" su un invito andato a buon fine.
          timeoutMs: 30_000,
        },
      ),
    getEligibleGroupLessonInvitees: async (groupLessonId: string) =>
      client.request<GroupLessonInvitee[]>(
        `/api/autoscuole/group-lessons/${groupLessonId}/eligible-invitees`,
      ),
    getGroupLessonInvites: async (studentId: string, limit?: number, countOnly?: boolean) =>
      client.request<GroupLessonInvite[]>('/api/autoscuole/group-lessons/invites', {
        params: { studentId, limit, ...(countOnly ? { countOnly: '1' } : {}) },
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

    // "Pronto per l'esame" — segnale interno impostabile da istruttore/titolare.
    setStudentExamReady: async (studentId: string, ready: boolean) =>
      client.request<{ examReady: boolean; examReadyAt: string | null }>(
        `/api/autoscuole/students/${studentId}/exam-ready`,
        { method: 'PATCH', body: { ready } },
      ),

    // Luogo di default dell'allievo (REG-392) — impostabile da istruttore/titolare.
    // null = nessun default (il form riparte dalla sede).
    setStudentDefaultLocation: async (studentId: string, locationId: string | null) =>
      client.request<{ defaultLocation: { id: string; name: string } | null }>(
        `/api/autoscuole/students/${studentId}/default-location`,
        { method: 'PATCH', body: { locationId } },
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
    /**
     * Pagellino di una guida: voci dell'autoscuola + punteggi già dati.
     * `client.request` scarta l'involucro {success,data}: qui arriva già `data`.
     */
    getAppointmentEvaluation: async (appointmentId: string) =>
      client.request<AppointmentEvaluation>(
        `/api/autoscuole/appointments/${appointmentId}/evaluation`,
      ),
    updateAppointmentDetails: async (appointmentId: string, input: UpdateAppointmentDetailsInput) =>
      client.request<AutoscuolaAppointment>(`/api/autoscuole/appointments/${appointmentId}`, {
        method: 'PATCH',
        body: input,
      }),
    /**
     * Segna una guida pagata / da pagare (REG-450). `null` azzera lo stato.
     * Permessi (titolare e istruttori, su qualsiasi guida dell'allievo) stanno
     * nel BE: l'errore torna già in italiano, si mostra così com'è.
     * REG-637: `paymentEvent` è la riga di storico appena scritta (null se lo
     * stato era già quello).
     */
    setManualPaymentStatus: async (
      appointmentId: string,
      status: 'paid' | 'unpaid' | null
    ) =>
      client.request<{ manualPaymentStatus: string | null; paymentEvent?: PaymentHistoryEvent | null }>(
        `/api/autoscuole/appointments/${appointmentId}/manual-payment`,
        {
          method: 'PATCH',
          body: { status },
        }
      ),
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
    /**
     * Configurazione del pagellino dell'autoscuola (Altro → Pagellino).
     * Stesse action del pane Impostazioni web: permessi e archiviazione delle
     * voci tolte stanno lato server.
     */
    getEvaluationSheet: async () =>
      client.request<EvaluationSheetConfig>('/api/autoscuole/evaluation-sheet'),
    saveEvaluationSheet: async (input: SaveEvaluationSheetInput) =>
      client.request<EvaluationSheetConfig>('/api/autoscuole/evaluation-sheet', {
        method: 'PUT',
        body: input,
      }),
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
    /**
     * Esito esame (REG-513). `licenseNumber` omesso = non tocca il numero già
     * registrato: sull'app si segna l'esito, il numero lo inserisce chi ha la
     * tastiera davanti dal web.
     */
    setExamOutcome: async (
      appointmentId: string,
      outcome: 'idoneo' | 'respinto' | null,
    ) =>
      client.request<{ success: boolean; message?: string; data?: { promoted?: boolean } }>(
        `/api/autoscuole/appointments/${appointmentId}/exam-outcome`,
        { method: 'POST', body: { outcome } },
      ),
    cancelAppointment: async (appointmentId: string) =>
      client.request<CancelAppointmentResult>(
        `/api/autoscuole/appointments/${appointmentId}/cancel`,
        {
          method: 'POST',
        }
      ),
    /**
     * Annullamento staff di una guida futura (REG-587): stesso percorso del web
     * (rilascia gli slot, notifica l'allievo, applica la regola del preavviso).
     * `fault: 'school'` = imprevisto dell'autoscuola → nessuna penale e la guida
     * non entra nella coda "Cancellazioni tardive".
     */
    annulAppointment: async (appointmentId: string, fault: 'student' | 'school') =>
      client.request<{ isLate: boolean; coverage: 'credit' | 'money' | 'none'; fault: 'student' | 'school' }>(
        `/api/autoscuole/appointments/${appointmentId}/annul`,
        { method: 'POST', body: { fault } },
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
    /**
     * Prova a vuoto della prenotazione multipla (REG-608): non crea niente,
     * dice quali date sono libere, perche' le altre no e quali auto al seguito
     * sono libere in ciascuno slot. Non controlla il limite settimanale —
     * quella conferma resta sulla creazione vera.
     */
    checkInstructorBookingBatch: async (input: CheckInstructorBookingBatchInput) =>
      client.request<CheckInstructorBookingBatchResult>('/api/autoscuole/instructor-bookings/check-batch', {
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
    updateInstructorBlock: async (blockId: string, input: UpdateInstructorBlockInput) =>
      client.request<InstructorBlock>(`/api/autoscuole/instructor-blocks/${blockId}`, {
        method: 'PATCH',
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
    getInstructorHoursRange: async (params: { from: string; to: string; instructorId?: string }) => {
      const qs = new URLSearchParams({ from: params.from, to: params.to });
      // Facoltativo: il titolare-istruttore senza id riceve TUTTI gli istruttori.
      if (params.instructorId) qs.set('instructorId', params.instructorId);
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

    // ── Reglo Road (REG-638) ─────────────────────────────────────
    // Contratto: reglo/docs/features/reglo-road.md. Errori: RegloApiError con
    // `payload.code` (ROAD_DISABLED, FORBIDDEN, NOT_FOUND, NOT_ELIGIBLE,
    // TOO_EARLY, SESSION_CLOSED).
    getRoadState: async () =>
      client.request<RoadState>('/api/autoscuole/road/state'),
    /** Road libero: durate, veicoli e allievi recenti per «Avvia guida». */
    getRoadFreeOptions: async () =>
      client.request<RoadFreeOptions>('/api/autoscuole/road/free'),
    /** Road libero: crea la guida in agenda (adesso, già presente) e apre la sessione. */
    startFreeRoadSession: async (input: RoadFreeStartInput) =>
      client.request<RoadStartResult & { appointmentId: string }>('/api/autoscuole/road/free', {
        method: 'POST',
        body: input,
      }),
    startRoadSession: async (appointmentId: string, plan?: RoadPlan | null) =>
      client.request<RoadStartResult>('/api/autoscuole/road/sessions', {
        method: 'POST',
        body: plan ? { appointmentId, plan } : { appointmentId },
      }),
    /** REG-649: il giro proposto per allievo e durata, più i suoi punti critici. */
    getRoadPlan: async (params: { studentId: string; durationMin: number; lat?: number | null; lng?: number | null }) => {
      const q = new URLSearchParams({ studentId: params.studentId, durationMin: String(params.durationMin) });
      if (params.lat != null && params.lng != null) {
        q.set('lat', params.lat.toFixed(5));
        q.set('lng', params.lng.toFixed(5));
      }
      return client.request<RoadPlanResponse>(`/api/autoscuole/road/plan?${q.toString()}`);
    },
    /**
     * REG-652: la linea suggerita del giro (strade vere, chiusa in sede) con
     * l'ordine delle tappe. Una volta alla partenza; `optimize: false` per il
     * riaggancio (REG-654).
     */
    getRoadPlanRoute: async (input: {
      start: { lat: number; lng: number };
      stops: RoadPlanStop[];
      optimize?: boolean;
    }) =>
      client.request<RoadPlanRouteResponse>('/api/autoscuole/road/plan/route', { method: 'POST', body: input }),
    /** REG-668: il giro modificato di una guida futura (null = vale il proposto). */
    getSavedRoadPlan: async (appointmentId: string) =>
      client.request<{ saved: SavedRoadPlan | null }>(
        `/api/autoscuole/road/plan/saved?appointmentId=${encodeURIComponent(appointmentId)}`,
      ),
    saveRoadPlan: async (input: { appointmentId: string; stops: RoadPlanStop[]; minutes: number }) =>
      client.request<{ saved: SavedRoadPlan }>('/api/autoscuole/road/plan/saved', { method: 'PUT', body: input }),
    deleteSavedRoadPlan: async (appointmentId: string) =>
      client.request<{ saved: null }>(
        `/api/autoscuole/road/plan/saved?appointmentId=${encodeURIComponent(appointmentId)}`,
        { method: 'DELETE' },
      ),
    getRoadSession: async (sessionId: string) =>
      client.request<RoadDetail>(`/api/autoscuole/road/sessions/${sessionId}`),
    /** Lotto di punti idempotente su `seq`: rimandarlo dà `duplicate: true`. */
    sendRoadPoints: async (
      sessionId: string,
      input: { seq: number; points: RoadPoint[]; street?: string | null; eta?: number | null },
    ) =>
      client.request<RoadPointsResult>(`/api/autoscuole/road/sessions/${sessionId}/points`, {
        method: 'POST',
        body: input,
        timeoutMs: 20_000,
      }),
    /** Idempotente su `clientId` (coda offline). */
    addRoadMarker: async (sessionId: string, input: AddRoadMarkerInput) =>
      client.request<RoadMarker>(`/api/autoscuole/road/sessions/${sessionId}/markers`, {
        method: 'POST',
        body: input,
      }),
    /** REG-677: «Meglio» / «Ancora no» sul punto critico (idempotente su clientId). */
    addRoadHotspotCheck: async (sessionId: string, input: AddRoadHotspotCheckInput) =>
      client.request<{ id: string; clientId: string }>(`/api/autoscuole/road/sessions/${sessionId}/hotspot-checks`, {
        method: 'POST',
        body: input,
      }),
    removeRoadHotspotCheck: async (sessionId: string, checkIdOrClientId: string) =>
      client.request<{ removed: boolean }>(
        `/api/autoscuole/road/sessions/${sessionId}/hotspot-checks/${encodeURIComponent(checkIdOrClientId)}`,
        { method: 'DELETE' },
      ),
    /** REG-696: corregge giudizio, posizione o nota di una segnalazione. */
    updateRoadMarker: async (sessionId: string, markerIdOrClientId: string, input: UpdateRoadMarkerInput) =>
      client.request<RoadMarker>(
        `/api/autoscuole/road/sessions/${sessionId}/markers/${encodeURIComponent(markerIdOrClientId)}`,
        { method: 'PATCH', body: input },
      ),
    removeRoadMarker: async (sessionId: string, markerIdOrClientId: string) =>
      client.request<{ removed: boolean }>(
        `/api/autoscuole/road/sessions/${sessionId}/markers/${encodeURIComponent(markerIdOrClientId)}`,
        { method: 'DELETE' },
      ),
    endRoadSession: async (sessionId: string) =>
      client.request<RoadDetail>(`/api/autoscuole/road/sessions/${sessionId}/end`, {
        method: 'POST',
        timeoutMs: 25_000,
      }),
    /** Percorso di una guida (allievo: solo con il setting dell'autoscuola). */
    getRoadForAppointment: async (appointmentId: string) =>
      client.request<RoadDetail | null>(`/api/autoscuole/road/appointments/${appointmentId}`),
    /** Percorsi Road delle guide di un allievo (titolare: tutte; istruttore: le sue). */
    getRoadForStudent: async (studentId: string) =>
      client.request<RoadStudentRoad>(
        `/api/autoscuole/road/students/${studentId}`,
      ),
    /** Punti critici dell'autoscuola (REG-646): mappa aggregata, anche per l'istruttore. */
    getRoadHotspots: async (params: { from: string }) =>
      client.request<RoadHotspots>(`/api/autoscuole/road/hotspots?from=${encodeURIComponent(params.from)}`),
    /** Dettaglio di un punto: per l'istruttore solo le sue guide e i suoi allievi. */
    getRoadHotspot: async (key: string, params: { from: string }) =>
      client.request<RoadHotspotDetail>(
        `/api/autoscuole/road/hotspots/${encodeURIComponent(key)}?from=${encodeURIComponent(params.from)}`,
      ),
    getRoadExamRoutes: async () =>
      client.request<RoadExamRoute[]>('/api/autoscuole/road/exam-routes'),
    /** «Annulla» nei primi secondi di una guida avviata da Road. */
    undoFreeRoadSession: async (sessionId: string) =>
      client.request<{ appointmentId: string }>('/api/autoscuole/road/free/undo', {
        method: 'POST',
        body: { sessionId },
      }),

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
