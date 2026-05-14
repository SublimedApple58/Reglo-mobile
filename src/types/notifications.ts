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

export type AppointmentRescheduledData = {
  appointmentId: string;
  startsAt: string;
  oldStartsAt: string;
};

export type AppointmentCancelledData = {
  appointmentId: string;
  startsAt: string;
  instructorName?: string;
  cancellationKind?: string;
};

export type AvailabilityPublishedData = {
  instructorId: string;
  instructorName: string;
  weekStart: string;
};

export type AppointmentLocationChangedData = {
  appointmentId: string;
  startsAt: string;
  oldLocationName: string;
  newLocationName: string;
};

export type TheoryExamCountdownData = {
  offsetDays: 7 | 3 | 1 | number;
  theoryExamAt: string | null;
};

export type TheoryQuizInactivityData = {
  inactiveDays: number;
};

export type NotificationItem =
  | { kind: 'waitlist'; id: string; data: AutoscuolaWaitlistOfferWithSlot }
  | { kind: 'swap'; id: string; data: AutoscuolaSwapOfferWithDetails }
  | { kind: 'confirmation'; id: string; data: ConfirmationData }
  | { kind: 'proposal'; id: string; data: AutoscuolaAppointmentWithRelations }
  | { kind: 'available_slots'; id: string; data: AvailableSlotsData }
  | { kind: 'holiday_declared'; id: string; data: HolidayDeclaredData }
  | { kind: 'weekly_absence'; id: string; data: WeeklyAbsenceData }
  | { kind: 'sick_leave_cancelled'; id: string; data: SickLeaveCancelledData }
  | { kind: 'appointment_rescheduled'; id: string; data: AppointmentRescheduledData }
  | { kind: 'appointment_cancelled'; id: string; data: AppointmentCancelledData }
  | { kind: 'availability_published'; id: string; data: AvailabilityPublishedData }
  | { kind: 'appointment_location_changed'; id: string; data: AppointmentLocationChangedData }
  | { kind: 'theory_exam_countdown'; id: string; data: TheoryExamCountdownData }
  | { kind: 'theory_quiz_inactivity'; id: string; data: TheoryQuizInactivityData };

export type PersistedNotification = {
  kind: NotificationItem['kind'];
  id: string;
  data: any;
  receivedAt: string;
  read: boolean;
  dismissed: boolean;
};
