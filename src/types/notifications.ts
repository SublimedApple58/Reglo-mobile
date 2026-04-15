import {
  AutoscuolaSwapOfferWithDetails,
  AutoscuolaWaitlistOfferWithSlot,
  AutoscuolaAppointmentWithRelations,
} from './regloApi';

export type ConfirmationData = {
  id: string;
  acceptedByName: string;
  appointmentDate: string;
  appointmentTime: string;
  instructorName: string;
  vehicleName: string;
  appointmentType: string;
};

export type AvailableSlotsData = {
  date: string;
};

export type HolidayDeclaredData = {
  date: string;
  label?: string;
  appointmentsCancelled: boolean;
  cancelledCount?: number;
};

export type WeeklyAbsenceData = {
  studentId: string;
  studentName: string;
  weekStart: string;
};

export type SickLeaveCancelledData = {
  appointmentId: string;
  instructorName: string;
};

export type NotificationItem =
  | { kind: 'waitlist'; id: string; data: AutoscuolaWaitlistOfferWithSlot }
  | { kind: 'swap'; id: string; data: AutoscuolaSwapOfferWithDetails }
  | { kind: 'confirmation'; id: string; data: ConfirmationData }
  | { kind: 'proposal'; id: string; data: AutoscuolaAppointmentWithRelations }
  | { kind: 'available_slots'; id: string; data: AvailableSlotsData }
  | { kind: 'holiday_declared'; id: string; data: HolidayDeclaredData }
  | { kind: 'weekly_absence'; id: string; data: WeeklyAbsenceData }
  | { kind: 'sick_leave_cancelled'; id: string; data: SickLeaveCancelledData };

export type PersistedNotification = {
  kind: NotificationItem['kind'];
  id: string;
  data: any;
  receivedAt: string;
  read: boolean;
  dismissed: boolean;
};
