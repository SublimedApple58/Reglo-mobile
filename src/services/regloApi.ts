import { authStorage, createApiClient } from './apiClient';
import {
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
  AcceptMobileInviteInput,
  CancelAppointmentResult,
  CreateAppointmentInput,
  CreateAvailabilitySlotsInput,
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
  RegisterPushTokenInput,
  MobileStudentPaymentProfile,
  MobileSetupIntentPayload,
  MobileConfirmPaymentMethodPayload,
  MobilePreparePayNowPayload,
  MobileFinalizePayNowPayload,
  MobileAppointmentPaymentDocument,
  StudentAppointmentPaymentHistoryItem,
  SelectCompanyInput,
  SelectCompanyPayload,
  SignupInput,
  UnregisterPushTokenInput,
  UpdateAppointmentDetailsInput,
  UpdateAppointmentStatusInput,
  UpdateCaseStatusInput,
  UpdateVehicleInput,
  UserPublic,
  AutoscuolaSettings,
} from '../types/regloApi';

export const createRegloApi = (baseUrl?: string) => {
  const client = createApiClient(baseUrl);

  return {
    login: async (input: LoginInput) => {
      const payload = await client.request<AuthPayload>('/api/mobile/auth/login', {
        method: 'POST',
        body: input,
      });
      await authStorage.setToken(payload.token);
      await authStorage.setActiveCompanyId(payload.activeCompanyId);
      return payload;
    },
    signup: async (input: SignupInput) => {
      const payload = await client.request<AuthPayload>('/api/mobile/auth/signup', {
        method: 'POST',
        body: input,
      });
      await authStorage.setToken(payload.token);
      await authStorage.setActiveCompanyId(payload.activeCompanyId);
      return payload;
    },
    logout: async () => {
      const payload = await client.request<LogoutPayload>('/api/mobile/auth/logout', {
        method: 'POST',
      });
      await authStorage.clear();
      return payload;
    },
    me: async () => client.request<MePayload>('/api/mobile/me'),
    selectCompany: async (input: SelectCompanyInput) => {
      const payload = await client.request<SelectCompanyPayload>('/api/mobile/auth/select-company', {
        method: 'POST',
        body: input,
      });
      await authStorage.setActiveCompanyId(payload.activeCompanyId);
      return payload;
    },
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
    updateAutoscuolaSettings: async (input: AutoscuolaSettings) =>
      client.request<AutoscuolaSettings>('/api/autoscuole/settings', {
        method: 'PATCH',
        body: input,
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
    cancelAppointment: async (appointmentId: string) =>
      client.request<CancelAppointmentResult>(
        `/api/autoscuole/appointments/${appointmentId}/cancel`,
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
      date: string;
    }) =>
      client.request<AutoscuolaAvailabilitySlot[]>('/api/autoscuole/availability/slots', {
        params,
      }),
    createBookingRequest: async (input: CreateBookingRequestInput) =>
      client.request<CreateBookingRequestResult>('/api/autoscuole/booking-requests', {
        method: 'POST',
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
    getPaymentProfile: async () =>
      client.request<MobileStudentPaymentProfile>('/api/mobile/payments/profile'),
    getPaymentHistory: async (limit?: number) =>
      client.request<StudentAppointmentPaymentHistoryItem[]>('/api/mobile/payments/history', {
        params: limit ? { limit } : undefined,
      }),
    createSetupIntent: async () =>
      client.request<MobileSetupIntentPayload>('/api/mobile/payments/setup-intent', {
        method: 'POST',
        body: {},
      }),
    confirmPaymentMethod: async (input: {
      setupIntentId?: string;
      paymentMethodId?: string;
    }) =>
      client.request<MobileConfirmPaymentMethodPayload>(
        '/api/mobile/payments/confirm-method',
        {
          method: 'POST',
          body: input,
        }
      ),
    preparePayNow: async (appointmentId: string) =>
      client.request<MobilePreparePayNowPayload>(
        `/api/mobile/payments/appointments/${appointmentId}/pay-now`,
        {
          method: 'POST',
          body: {},
        }
      ),
    finalizePayNow: async (appointmentId: string, paymentIntentId: string) =>
      client.request<MobileFinalizePayNowPayload>(
        `/api/mobile/payments/appointments/${appointmentId}/pay-now`,
        {
          method: 'POST',
          body: { paymentIntentId },
        }
      ),
    getAppointmentPaymentDocument: async (appointmentId: string) =>
      client.request<MobileAppointmentPaymentDocument>(
        `/api/mobile/payments/appointments/${appointmentId}/document`
      ),
  };
};

export const regloApi = createRegloApi();
