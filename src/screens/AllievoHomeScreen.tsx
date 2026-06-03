import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import Animated, {
  Extrapolation,
  FadeIn,
  FadeInUp,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import {
  Alert,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  Share,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import { BlurView } from 'expo-blur';
import { useStripe } from '@stripe/stripe-react-native';
import { Screen } from '../components/Screen';
import { BookingCelebration } from '../components/BookingCelebration';
import { ToastNotice, ToastTone } from '../components/ToastNotice';
import { CalendarDrawer } from '../components/CalendarDrawer';
import { CalendarNavigatorRange } from '../components/CalendarNavigator';
import { SkeletonBlock } from '../components/Skeleton';
import { useSession } from '../context/SessionContext';
import { regloApi } from '../services/regloApi';
import { subscribePushIntent } from '../services/pushNotifications';
import { notificationEvents } from '../services/notificationEvents';
import { loadInbox } from '../services/notificationStore';
import { useAutoscuolaSettings } from '../hooks/queries/useAutoscuolaSettings';
import { useStudentPhase } from '../hooks/useStudentPhase';
import { useBookingOptions } from '../hooks/queries/useBookingOptions';
import { usePaymentProfile } from '../hooks/queries/usePaymentProfile';
import { usePaymentHistory } from '../hooks/queries/usePaymentHistory';
import { useAppointments } from '../hooks/queries/useAppointments';
import { queryKeys } from '../hooks/queries/queryKeys';
import { useBookSlot } from '../hooks/mutations/useBookSlot';
import { useCancelAppointment } from '../hooks/mutations/useCancelAppointment';
import {
  AutoscuolaAppointmentWithRelations,
  MobileAppointmentPaymentDocument,
  AvailableSlot,
  AutoscuolaStudent,
  AutoscuolaInstructor,
} from '../types/regloApi';
import { colors, radii, spacing, typography } from '../theme';
import { lessonDetailStore } from '../stores/lessonDetailStore';
import { allLessonsStore } from '../stores/allLessonsStore';
import { examDetailStore } from '../stores/examDetailStore';
import { bookingFlowStore } from '../stores/bookingFlowStore';



import { formatDay, formatTime } from '../utils/date';
import {
  invoiceStatusLabel,
  paymentEventStatusLabel,
  paymentPhaseLabel,
  paymentStatusLabel,
} from '../utils/payment';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const upcomingConfirmedStatuses = new Set(['scheduled', 'confirmed', 'checked_in', 'pending_review']);
const DEFAULT_BOOKING_LESSON_TYPES = [
  'manovre',
  'urbano',
  'extraurbano',
  'notturna',
  'autostrada',
  'parcheggio',
  'altro',
] as const;
const lessonTypeLabelMap: Record<string, string> = {
  manovre: 'Manovre',
  urbano: 'Urbano',
  extraurbano: 'Extraurbano',
  notturna: 'Notturna',
  autostrada: 'Autostrada',
  parcheggio: 'Parcheggio',
  altro: 'Altro',
  guida: 'Guida',
  esame: 'Esame',
};

const pad = (value: number) => value.toString().padStart(2, '0');

const toDateString = (value: Date) => {
  const year = value.getFullYear();
  const month = pad(value.getMonth() + 1);
  const day = pad(value.getDate());
  return `${year}-${month}-${day}`;
};
const toTimeString = (value: Date) => value.toTimeString().slice(0, 5);

const addDays = (date: Date, amount: number) => {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + amount);
  return copy;
};

const statusLabel = (status: string) => {
  if (status === 'completed') return { label: 'Completata', tone: 'success' as const };
  if (status === 'no_show') return { label: 'Assente', tone: 'danger' as const };
  if (status === 'cancelled') return { label: 'Annullata', tone: 'warning' as const };
  if (status === 'proposal') return { label: 'Proposta', tone: 'default' as const };
  if (status === 'pending_review') return { label: 'Da confermare', tone: 'warning' as const };
  return { label: 'Programmato', tone: 'default' as const };
};

const shouldRetryPaymentSheetWithoutWallet = (message?: string | null) => {
  const normalized = (message ?? '').toLowerCase();
  return (
    normalized.includes('merchantidentifier') ||
    normalized.includes('merchant identifier')
  );
};

let sharingModulePromise: Promise<typeof import('expo-sharing') | null> | null = null;
const getSharingModule = async () => {
  if (!sharingModulePromise) {
    sharingModulePromise = import('expo-sharing').catch(() => null);
  }
  return sharingModulePromise;
};

let webBrowserModulePromise: Promise<typeof import('expo-web-browser') | null> | null = null;
const getWebBrowserModule = async () => {
  if (!webBrowserModulePromise) {
    webBrowserModulePromise = import('expo-web-browser').catch(() => null);
  }
  return webBrowserModulePromise;
};

const normalize = (value: string | null | undefined) =>
  (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

const formatLessonType = (value: string | null | undefined) =>
  lessonTypeLabelMap[normalize(value)] ?? value ?? 'Guida';

const LESSON_CARD_COLORS = [
  { bg: '#FFF0F3', accent: '#ec4899' },  // rose
  { bg: '#EFF6FF', accent: '#3B82F6' },  // sky
  { bg: '#F0FDF4', accent: '#22C55E' },  // mint
  { bg: '#FFFBEB', accent: '#F59E0B' },  // amber
  { bg: '#F5F3FF', accent: '#8B5CF6' },  // violet
] as const;

const findLinkedStudent = (
  students: AutoscuolaStudent[],
  user: { name: string | null; email: string } | null
) => {
  if (!user) return null;
  const normalizedEmail = normalize(user.email);
  const normalizedName = normalize(user.name);

  const byEmail = students.find((student) => normalize(student.email) === normalizedEmail);
  if (byEmail) return byEmail;

  if (!normalizedName) return null;
  const byName = students.find(
    (student) => `${normalize(student.firstName)} ${normalize(student.lastName)}` === normalizedName
  );
  return byName ?? null;
};




const COMPACT_HEADER_H = 44;
const SCROLL_RANGE = 70;

export const AllievoHomeScreen = () => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { height: windowHeight, width: screenWidth } = useWindowDimensions();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const { user, activeCompanyId, companies } = useSession();
  const activeCompanyName = companies.find((c) => c.id === activeCompanyId)?.name ?? null;
  const { phase: studentPhase, theoryExamAt: studentTheoryExamAt } = useStudentPhase();
  const queryClient = useQueryClient();
  const [students, setStudents] = useState<AutoscuolaStudent[]>([]);
  const [studentsLoaded, setStudentsLoaded] = useState(false);
  const [toast, setToast] = useState<{ text: string; tone: ToastTone } | null>(null);

  const [preferredDate, setPreferredDate] = useState(new Date());
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [selectedLessonTypes, setSelectedLessonTypes] = useState<string[]>([
    DEFAULT_BOOKING_LESSON_TYPES[0],
  ]);
  const [instructors, setInstructors] = useState<AutoscuolaInstructor[]>([]);
  const [selectedInstructorId, setSelectedInstructorId] = useState<string | null>(null);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingStep, setBookingStep] = useState<1 | 2>(1);
  const [bookingSlots, setBookingSlots] = useState<AvailableSlot[]>([]);
  const [bookingSlotsLoading, setBookingSlotsLoading] = useState(false);
  const [bookingSelectedSlot, setBookingSelectedSlot] = useState<AvailableSlot | null>(null);
  const [cancellingAppointmentId, setCancellingAppointmentId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [historyDetailsOpen, setHistoryDetailsOpen] = useState(false);
  const [selectedHistoryLesson, setSelectedHistoryLesson] =
    useState<AutoscuolaAppointmentWithRelations | null>(null);
  const [historyDocumentBusy, setHistoryDocumentBusy] = useState<'view' | 'share' | null>(null);
  const [payNowLoading, setPayNowLoading] = useState(false);
  const [creatingSwap, setCreatingSwap] = useState(false);
  const [calendarRange, setCalendarRange] = useState<CalendarNavigatorRange | null>(null);
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [calendarDrawerOpen, setCalendarDrawerOpen] = useState(false);
  const [bookingCalendarOpen, setBookingCalendarOpen] = useState(false);
  const [dateAvailability, setDateAvailability] = useState<{
    dates: Record<string, boolean>;
    instructorsByDate: Record<string, string[]>;
  }>({ dates: {}, instructorsByDate: {} });
  const [freeChoiceBooking, setFreeChoiceBooking] = useState(false);
  const dayScrollRef = useRef<ScrollView | null>(null);
  const [showAllAgendaLessons, setShowAllAgendaLessons] = useState(false);
  const [bookingCelebrationVisible, setBookingCelebrationVisible] = useState(false);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [weeklyAbsenceDeclared, setWeeklyAbsenceDeclared] = useState(false);
  const [weeklyAbsenceLoading, setWeeklyAbsenceLoading] = useState(false);
  const [swapOffersCount, setSwapOffersCount] = useState<number | null>(null);

  // ── Linked student (must come before hooks that depend on studentId) ──
  const selectedStudent = useMemo(
    () => findLinkedStudent(students, user),
    [students, user]
  );
  const selectedStudentId = selectedStudent?.id ?? null;

  // ── Appointment query params (computed from calendarRange) ──
  const appointmentParams = useMemo(() => {
    if (!selectedStudentId) return null;
    const defaultFrom = addDays(new Date(), -7);
    defaultFrom.setHours(0, 0, 0, 0);
    const defaultTo = addDays(new Date(), 30);
    defaultTo.setHours(23, 59, 59, 999);
    const selectedFrom = calendarRange ? new Date(calendarRange.from) : new Date(defaultFrom);
    selectedFrom.setHours(0, 0, 0, 0);
    const selectedTo = calendarRange ? new Date(calendarRange.to) : new Date(defaultTo);
    selectedTo.setHours(23, 59, 59, 999);
    const from = selectedFrom.getTime() < defaultFrom.getTime() ? selectedFrom : defaultFrom;
    const to = selectedTo.getTime() > defaultTo.getTime() ? selectedTo : defaultTo;
    return {
      studentId: selectedStudentId,
      from: from.toISOString(),
      to: to.toISOString(),
      limit: 280,
      light: true,
    };
  }, [selectedStudentId, calendarRange]);

  // ── Query hooks (data from cache on cold start, background refetch) ──
  const appointmentsQuery = useAppointments(appointmentParams);
  const settingsQuery = useAutoscuolaSettings();
  const paymentProfileQuery = usePaymentProfile();
  const paymentHistoryQuery = usePaymentHistory(40);
  const bookingOptionsQuery = useBookingOptions(selectedStudentId);

  // Derive data from hooks (fallback to empty/null for loading state)
  const allAppointments = appointmentsQuery.data;
  const appointments = useMemo(
    () => (allAppointments ?? []).filter((item) => selectedStudentId ? item.studentId === selectedStudentId : true),
    [allAppointments, selectedStudentId]
  );
  const settings = settingsQuery.data ?? null;
  const paymentProfile = paymentProfileQuery.data ?? null;
  const paymentHistory = paymentHistoryQuery.data ?? [];
  const bookingOptions = bookingOptionsQuery.data ?? null;

  // Derive loading states from hooks
  const loading = appointmentsQuery.isLoading && !appointmentsQuery.data;
  const rangeLoading = appointmentsQuery.isFetching && !!appointmentsQuery.data;
  const studentDataReady = !!appointmentsQuery.data || appointmentsQuery.isError;

  // ── Invalidation helper (replaces loadData) ──
  const invalidateAllData = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['appointments'] });
    queryClient.invalidateQueries({ queryKey: ['autoscuola-settings'] });
    queryClient.invalidateQueries({ queryKey: ['payment-profile'] });
    queryClient.invalidateQueries({ queryKey: ['payment-history'] });
    queryClient.invalidateQueries({ queryKey: ['booking-options'] });
  }, [queryClient]);

  // ── Mutation hooks ──
  const bookSlotMutation = useBookSlot();
  const cancelMutation = useCancelAppointment();

  const historyDetailsScrollRef = useRef<ScrollView | null>(null);
  const [historyDetailsLayoutHeight, setHistoryDetailsLayoutHeight] = useState(0);
  const [historyDetailsContentHeight, setHistoryDetailsContentHeight] = useState(0);
  const [historyDetailsOffsetY, setHistoryDetailsOffsetY] = useState(0);
  const historyDetailsMaxHeight = useMemo(
    () => Math.max(320, Math.min(windowHeight * 0.62, windowHeight - insets.top - 180)),
    [insets.top, windowHeight]
  );
  const historyDetailsMaxOffset = Math.max(
    0,
    historyDetailsContentHeight - historyDetailsLayoutHeight
  );
  const canScrollHistoryDetails = historyDetailsMaxOffset > 12;
  const showHistoryScrollUp = canScrollHistoryDetails && historyDetailsOffsetY > 24;
  const showHistoryScrollDown =
    canScrollHistoryDetails &&
    !showHistoryScrollUp &&
    historyDetailsOffsetY < historyDetailsMaxOffset - 24;

  const handleHistoryDetailsQuickScroll = useCallback(
    (direction: 'up' | 'down') => {
      if (!historyDetailsScrollRef.current) return;
      const step = Math.max(180, historyDetailsLayoutHeight * 0.85);
      const nextOffset =
        direction === 'down'
          ? Math.min(historyDetailsOffsetY + step, historyDetailsMaxOffset)
          : Math.max(historyDetailsOffsetY - step, 0);
      historyDetailsScrollRef.current.scrollTo({ y: nextOffset, animated: true });
    },
    [historyDetailsLayoutHeight, historyDetailsMaxOffset, historyDetailsOffsetY]
  );

  const triggerBookingCelebration = useCallback(() => {
    setBookingCelebrationVisible(false);
    setTimeout(() => {
      setBookingCelebrationVisible(true);
    }, 0);
  }, []);

  useEffect(() => {
    if (historyDetailsOpen) return;
    setHistoryDetailsOffsetY(0);
    setHistoryDetailsLayoutHeight(0);
    setHistoryDetailsContentHeight(0);
  }, [historyDetailsOpen]);

  const ITALIAN_MONTHS_BK = [
    'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
    'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
  ] as const;
  const maxWeeksEarly = Number(settingsQuery.data?.availabilityWeeks) || 4;

  // ── Unified Booking Flow ──
  const [bookingMonth, setBookingMonth] = useState(() => {
    const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d;
  });
  const bookingGridCells = useMemo(() => {
    const first = new Date(bookingMonth.getFullYear(), bookingMonth.getMonth(), 1);
    const day = first.getDay();
    const startMonday = new Date(first);
    startMonday.setDate(first.getDate() - (day === 0 ? 6 : day - 1));
    const cells: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(startMonday);
      d.setDate(d.getDate() + i);
      d.setHours(0, 0, 0, 0);
      cells.push(d);
    }
    return cells;
  }, [bookingMonth]);
  const bookingMonthLabel = `${ITALIAN_MONTHS_BK[bookingMonth.getMonth()]} ${bookingMonth.getFullYear()}`;
  const bookingMaxDate = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() + maxWeeksEarly * 7); return d;
  }, [maxWeeksEarly]);
  const bookingMinMonth = useMemo(() => { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d; }, []);
  const bookingMaxMonth = useMemo(() => new Date(bookingMaxDate.getFullYear(), bookingMaxDate.getMonth(), 1), [bookingMaxDate]);
  const bookingCanPrev = bookingMonth.getTime() > bookingMinMonth.getTime();

  // Continuous calendar months (Airbnb-style)
  const calendarMonths = useMemo(() => {
    const months: { year: number; month: number; label: string; cells: Date[] }[] = [];
    const cur = new Date(bookingMinMonth);
    while (cur <= bookingMaxMonth) {
      const y = cur.getFullYear();
      const m = cur.getMonth();
      const first = new Date(y, m, 1);
      const dow = first.getDay();
      const startMon = new Date(first);
      startMon.setDate(first.getDate() - (dow === 0 ? 6 : dow - 1));
      const cells: Date[] = [];
      for (let i = 0; i < 42; i++) {
        const d = new Date(startMon);
        d.setDate(d.getDate() + i);
        d.setHours(0, 0, 0, 0);
        cells.push(d);
      }
      // Trim trailing row if entirely next month
      const lastRowStart = 35;
      const lastRowAllNext = cells.slice(lastRowStart).every((d) => d.getMonth() !== m);
      months.push({
        year: y,
        month: m,
        label: `${ITALIAN_MONTHS_BK[m]} ${y}`,
        cells: lastRowAllNext ? cells.slice(0, 35) : cells,
      });
      cur.setMonth(cur.getMonth() + 1);
    }
    return months;
  }, [bookingMinMonth, bookingMaxMonth]);
  const bookingCanNext = bookingMonth.getTime() < bookingMaxMonth.getTime();
  const BOOKING_WEEKDAYS = ['LUN', 'MAR', 'MER', 'GIO', 'VEN', 'SAB', 'DOM'] as const;

  const openBookingFlow = () => {
    if (studentBookingDisabledByPolicy) {
      setToast({ text: 'Le prenotazioni da app sono gestite dagli istruttori per questa autoscuola.', tone: 'info' });
      return;
    }
    if (requiresPaymentMethodForBooking) {
      setToast({ text: 'Aggiungi un metodo di pagamento dalle impostazioni prima di prenotare.', tone: 'info' });
      return;
    }
    if (requiresCreditsForBooking) {
      setToast({ text: 'Non hai crediti guida disponibili. Contatta la tua autoscuola.', tone: 'info' });
      return;
    }
    if (paymentProfile?.blockedByInsoluti) {
      setToast({ text: 'Hai pagamenti insoluti. Salda prima di prenotare una nuova guida.', tone: 'danger' });
      return;
    }
    setBookingStep(1);
    setBookingSlots([]);
    setBookingSelectedSlot(null);
    setBookingMonth(() => { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d; });
    bookingFlowStore.init({
      step: 1,
      preferredDate,
      durationMinutes,
      selectedLessonTypes,
      selectedInstructorId,
      selectedSlot: null,
      calendarOpen: false,
      slots: [],
      slotsLoading: false,
      loading: false,
      preferredDateAvailable,
      availableDurations,
      availableLessonTypes,
      canSelectLessonType,
      canSelectInstructor,
      isLockedToInstructor,
      assignedInstructorName,
      visibleInstructors,
      creditFlowEnabled,
      creditsAvailable: paymentProfile?.lessonCreditsAvailable ?? 0,
      autoPaymentsEnabled: paymentProfile?.autoPaymentsEnabled ?? false,
      calendarMonths,
      bookingMaxDate,
      bookedDatesSet,
      unavailableDatesSet,
      onSearchSlots: () => {
        const s = bookingFlowStore.get();
        if (!s || !selectedStudentId) return;
        bookingFlowStore.set({ loading: true });
        regloApi.getAvailableSlots({
          studentId: selectedStudentId,
          date: toDateString(s.preferredDate),
          durationMinutes: s.durationMinutes,
          ...(canSelectLessonType ? { lessonType: s.selectedLessonTypes[0], types: s.selectedLessonTypes } : {}),
          ...(s.selectedInstructorId ? { instructorId: s.selectedInstructorId } : {}),
        }).then((slots) => {
          bookingFlowStore.set({ slots, slotsLoading: false, loading: false, selectedSlot: null });
          router.push('/(tabs)/home/booking-slots');
        }).catch(() => {
          bookingFlowStore.set({ slots: [], slotsLoading: false, loading: false });
        });
      },
      onConfirmBooking: () => {
        const s = bookingFlowStore.get();
        if (!s?.selectedSlot || !selectedStudentId) return;
        bookingFlowStore.set({ loading: true });
        const slot = s.selectedSlot;
        // Optimistic insert
        const provisionalId = `provisional-${Date.now()}`;
        const provisionalAppt: AutoscuolaAppointmentWithRelations = {
          id: provisionalId, companyId: '', studentId: selectedStudentId,
          caseId: null, slotId: null,
          type: canSelectLessonType ? (s.selectedLessonTypes[0] ?? 'guida') : 'guida',
          startsAt: slot.startsAt, endsAt: slot.endsAt, status: 'scheduled',
          instructorId: s.selectedInstructorId, vehicleId: null, locationId: null,
          notes: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          student: selectedStudent!, case: null,
          instructor: s.selectedInstructorId ? (instructors.find((i) => i.id === s.selectedInstructorId) ?? null) : null,
          vehicle: null, location: null,
        };
        queryClient.setQueriesData<AutoscuolaAppointmentWithRelations[]>(
          { queryKey: ['appointments'] },
          (old) => old ? [...old, provisionalAppt] : [provisionalAppt],
        );
        // Dismiss both sheets (slots + booking) and cleanup store
        router.dismiss(2);
        bookingFlowStore.clear();
        triggerBookingCelebration();
        regloApi.createBookingRequest({
          studentId: selectedStudentId,
          preferredDate: toDateString(s.preferredDate),
          durationMinutes: s.durationMinutes,
          ...(canSelectLessonType ? { lessonType: s.selectedLessonTypes[0], types: s.selectedLessonTypes } : {}),
          ...(s.selectedInstructorId ? { instructorId: s.selectedInstructorId } : {}),
          selectedStartsAt: slot.startsAt,
        }).then((response) => {
          if (response.matched) { invalidateAllData(); return; }
          queryClient.setQueriesData<AutoscuolaAppointmentWithRelations[]>(
            { queryKey: ['appointments'] },
            (old) => old?.filter((a) => a.id !== provisionalId),
          );
          setToast({ text: 'Slot non più disponibile. Riprova.', tone: 'danger' });
          invalidateAllData();
        }).catch(() => {
          queryClient.setQueriesData<AutoscuolaAppointmentWithRelations[]>(
            { queryKey: ['appointments'] },
            (old) => old?.filter((a) => a.id !== provisionalId),
          );
          setToast({ text: 'Errore nella prenotazione', tone: 'danger' });
        });
      },
      onClose: () => { bookingFlowStore.clear(); },
    });
    router.push('/(tabs)/home/booking-flow');
  };

  const handleBookingDateSelect = async (date: Date, overrideInstructorId?: string | null) => {
    const isStepChange = bookingStep === 1;
    setPreferredDate(date);
    if (isStepChange) {
      setBookingStep(2);
      setBookingSlotsLoading(true);
      setBookingSlots([]);
    } else {
      setBookingSlotsLoading(true);
      setBookingSlots([]);
    }
    setBookingSelectedSlot(null);
    if (!selectedStudentId) { setBookingSlotsLoading(false); return; }
    const effectiveInstructor = overrideInstructorId !== undefined ? overrideInstructorId : selectedInstructorId;
    try {
      const slots = await regloApi.getAvailableSlots({
        studentId: selectedStudentId,
        date: toDateString(date),
        durationMinutes,
        ...(canSelectLessonType ? { lessonType: selectedLessonTypes[0], types: selectedLessonTypes } : {}),
        ...(effectiveInstructor ? { instructorId: effectiveInstructor } : {}),
      });
      setBookingSlots(slots);
    } catch { setBookingSlots([]); }
    finally { setBookingSlotsLoading(false); }
  };

  const handleBookingConfirm = async () => {
    if (!selectedStudentId || !bookingSelectedSlot) return;
    setBookingLoading(true);
    try {
      // Optimistic: inject provisional appointment into cache immediately
      const optimisticId = `optimistic-${Date.now()}`;
      const optimisticAppt = {
        id: optimisticId,
        companyId: activeCompanyId ?? '',
        studentId: selectedStudentId,
        caseId: null,
        slotId: null,
        type: 'guida',
        types: canSelectLessonType ? selectedLessonTypes : [],
        rating: null,
        startsAt: bookingSelectedSlot.startsAt,
        endsAt: bookingSelectedSlot.endsAt,
        status: 'scheduled',
        instructorId: selectedInstructorId ?? null,
        vehicleId: null,
        notes: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        student: { id: selectedStudentId, name: '' } as any,
        case: null,
        instructor: selectedInstructorId
          ? (instructors.find((i) => i.id === selectedInstructorId) ?? null)
          : null,
        vehicle: null,
      };
      queryClient.setQueriesData<any[]>(
        { queryKey: ['appointments'] },
        (old) => old ? [optimisticAppt, ...old] : [optimisticAppt],
      );
      bookSlotMutation.mutate({
        studentId: selectedStudentId,
        preferredDate: toDateString(preferredDate),
        selectedStartsAt: bookingSelectedSlot.startsAt,
        ...(selectedInstructorId ? { instructorId: selectedInstructorId } : {}),
        durationMinutes,
        ...(canSelectLessonType ? { lessonType: selectedLessonTypes[0] } : {}),
      });
      setBookingOpen(false);
      triggerBookingCelebration();
    } catch { setToast({ text: 'Errore nella prenotazione', tone: 'danger' }); }
    finally { setBookingLoading(false); }
  };

  const openPreferences = () => {
    if (studentBookingDisabledByPolicy) {
      setToast({
        text: 'Le prenotazioni da app sono gestite dagli istruttori per questa autoscuola.',
        tone: 'info',
      });
      return;
    }
    setPreferredDate(selectedDate);
    openBookingFlow();
  };

  const availableDurations = useMemo(
    () =>
      (bookingOptions?.bookingSlotDurations ?? settings?.bookingSlotDurations ?? [30, 60])
        .slice()
        .sort((a, b) => a - b),
    [bookingOptions?.bookingSlotDurations, settings?.bookingSlotDurations],
  );
  const availableLessonTypes = useMemo<string[]>(
    () =>
      bookingOptions?.availableLessonTypes ??
      settings?.lessonRequiredTypes ??
      [...DEFAULT_BOOKING_LESSON_TYPES],
    [bookingOptions?.availableLessonTypes, settings?.lessonRequiredTypes],
  );
  const canSelectLessonType = useMemo(
    () =>
      bookingOptions?.lessonTypeSelectionEnabled ??
      Boolean(settings?.lessonPolicyEnabled),
    [bookingOptions?.lessonTypeSelectionEnabled, settings?.lessonPolicyEnabled],
  );
  const canSelectInstructor = bookingOptions?.instructorPreferenceEnabled ?? false;
  const isLockedToInstructor = bookingOptions?.isLockedToInstructor === true;
  const assignedInstructorName = bookingOptions?.assignedInstructorName ?? null;
  const assignedInstructorPhone = bookingOptions?.assignedInstructorPhone ?? null;
  const weeklyAbsenceEnabled = bookingOptions?.weeklyAbsenceEnabled === true;
  const swapEnabled = (bookingOptions?.swapEnabled ?? settings?.swapEnabled) === true;
  const hasLessonCredits = (paymentProfile?.lessonCreditsAvailable ?? 0) > 0;
  const creditFlowEnabled = paymentProfile?.lessonCreditFlowEnabled ?? false;
  // Prefer cluster-resolved setting over company default.
  // Fail-closed default: hide the "Annulla guida" button when bookingOptions is
  // not yet loaded (loading / stale persisted cache / query error). Showing the
  // button to a student whose school disabled cancellations would let them click
  // through to a backend rejection — bad UX. We'd rather hide for a beat and
  // reveal once we have the authoritative value from the server.
  const canCancelAppointments = bookingOptions?.studentCancellationEnabled === true;
  const effectiveAppBookingActors = bookingOptions?.appBookingActors ?? settings?.appBookingActors;
  const studentBookingDisabledByPolicy = effectiveAppBookingActors === 'instructors';
  const canBook = !!bookingOptions && !studentBookingDisabledByPolicy;
  const requiresPaymentMethodForBooking = Boolean(
    paymentProfile?.autoPaymentsEnabled &&
      !creditFlowEnabled &&
      !paymentProfile?.hasPaymentMethod &&
      !hasLessonCredits
  );
  const requiresCreditsForBooking = Boolean(
    creditFlowEnabled &&
      paymentProfile?.lessonCreditsRequired !== false &&
      !paymentProfile?.autoPaymentsEnabled &&
      !hasLessonCredits
  );
  const weeklyLimitReached = Boolean(
    bookingOptions?.weeklyBookingLimit?.enabled &&
      bookingOptions.weeklyBookingLimit.reached
  );
  const examPriority = bookingOptions?.examPriority ?? bookingOptions?.weeklyBookingLimit?.examPriority ?? null;
  const blockedByExamPriority = bookingOptions?.blockedByExamPriority === true;
  const weeklyLimitLabel = bookingOptions?.weeklyBookingLimit?.enabled && !examPriority?.active
    ? `Limite di ${bookingOptions.weeklyBookingLimit.limit ?? 0} guide settimanali raggiunto`
    : '';

  const loadStudents = useCallback(async () => {
    const list = await regloApi.getStudents();
    setStudents(list);
    setStudentsLoaded(true);
    return list;
  }, []);

  // ── Side effects from bookingOptions data ──
  const bookingOptionsInitRef = useRef(false);
  useEffect(() => {
    if (!bookingOptions) return;
    // Only run initialization logic once per fresh data load
    if (bookingOptionsInitRef.current) return;
    bookingOptionsInitRef.current = true;

    if (bookingOptions.isLockedToInstructor && bookingOptions.assignedInstructorId) {
      setSelectedInstructorId(bookingOptions.assignedInstructorId);
    }
    // Check weekly absence
    if (bookingOptions.weeklyAbsenceEnabled && bookingOptions.isLockedToInstructor) {
      const now = new Date();
      const dow = now.getDay();
      const mondayOff = dow === 0 ? -6 : 1 - dow;
      const ws = new Date(now);
      ws.setDate(ws.getDate() + mondayOff);
      const wsStr = `${ws.getFullYear()}-${String(ws.getMonth() + 1).padStart(2, '0')}-${String(ws.getDate()).padStart(2, '0')}`;
      regloApi.getWeeklyAbsences(wsStr).then((absences) => {
        if (absences.length > 0) setWeeklyAbsenceDeclared(true);
      }).catch(() => {});
    }
    if (bookingOptions.instructorPreferenceEnabled) {
      regloApi.getInstructors().then((list) => {
        const active = list.filter((i) => i.status !== 'inactive');
        setInstructors(active);
      }).catch(() => {});
    }
    const sortedDurations = (bookingOptions.bookingSlotDurations ?? [30, 60])
      .slice()
      .sort((a, b) => a - b);
    setDurationMinutes((current) =>
      sortedDurations.includes(current) ? current : sortedDurations[0] ?? 60,
    );
    const availableTypes = (bookingOptions.availableLessonTypes ??
      [...DEFAULT_BOOKING_LESSON_TYPES]) as string[];
    setSelectedLessonTypes((current) => {
      if (!bookingOptions.lessonTypeSelectionEnabled) return ['guida'];
      const valid = current.filter((t) => availableTypes.includes(t));
      return valid.length ? valid : [availableTypes[0] ?? DEFAULT_BOOKING_LESSON_TYPES[0]];
    });
  }, [bookingOptions]);

  // Reset init ref when student changes
  useEffect(() => {
    bookingOptionsInitRef.current = false;
  }, [selectedStudentId]);

  useEffect(() => {
    const init = async () => {
      try {
        await loadStudents();
      } catch (err) {
        setToast({
          text: err instanceof Error ? err.message : 'Errore nel caricamento studenti',
          tone: 'danger',
        });
      }
    };
    init();
  }, [loadStudents]);

  // Push intents: invalidate queries instead of manual reload
  useEffect(() => {
    if (!selectedStudentId) return;
    const unsubscribe = subscribePushIntent((intent) => {
      if (intent === 'appointment_cancelled') {
        invalidateAllData();
        setToast({
          text: "Una guida e' stata annullata dall'autoscuola.",
          tone: 'info',
        });
      }
    });
    return unsubscribe;
  }, [invalidateAllData, selectedStudentId]);

  // AppState foreground reload is handled globally by TanStack Query focusManager
  // in _layout.tsx — no per-screen listener needed.

  // Listen for data changes from NotificationOverlay (e.g., proposal accepted, waitlist accepted)
  useEffect(() => {
    if (!selectedStudentId) return;
    return notificationEvents.onDataChanged(() => {
      invalidateAllData();
    });
  }, [invalidateAllData, selectedStudentId]);

  // Unread notification count — refresh on both data changes (live push
  // events) and inbox updates (server sync at mount, markRead, etc.)
  useEffect(() => {
    const refreshCount = () => {
      loadInbox().then((items) => {
        setUnreadNotifCount(items.filter((n) => !n.read && !n.dismissed).length);
      }).catch(() => {});
    };
    refreshCount();
    const unsubData = notificationEvents.onDataChanged(refreshCount);
    const unsubInbox = notificationEvents.onInboxUpdated(refreshCount);
    return () => {
      unsubData();
      unsubInbox();
    };
  }, []);

  // Open swap-offers count for the home "Scambi" slot (background, non-blocking).
  useEffect(() => {
    if (!swapEnabled || !selectedStudentId) {
      setSwapOffersCount(null);
      return;
    }
    let cancelled = false;
    regloApi
      .getSwapOffers(selectedStudentId, 20)
      .then((list) => {
        if (!cancelled) setSwapOffersCount(Array.isArray(list) ? list.length : 0);
      })
      .catch(() => {
        if (!cancelled) setSwapOffersCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, [swapEnabled, selectedStudentId]);

  // Declare weekly absence to the assigned instructor (used by the slim row).
  const handleDeclareAbsence = useCallback(() => {
    if (weeklyAbsenceDeclared) return;
    const now = new Date();
    const dow = now.getDay();
    const mondayOff = dow === 0 ? -6 : 1 - dow;
    const ws = new Date(now);
    ws.setDate(ws.getDate() + mondayOff);
    const wsStr = `${ws.getFullYear()}-${String(ws.getMonth() + 1).padStart(2, '0')}-${String(ws.getDate()).padStart(2, '0')}`;
    Alert.alert(
      'Segnala assenza',
      'Vuoi segnalare la tua assenza per questa settimana al tuo istruttore?',
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Conferma',
          onPress: async () => {
            setWeeklyAbsenceLoading(true);
            try {
              await regloApi.declareWeeklyAbsence({ weekStart: wsStr });
              setWeeklyAbsenceDeclared(true);
              setToast({ text: 'Assenza segnalata', tone: 'success' });
            } catch {
              setToast({ text: 'Errore nella segnalazione', tone: 'danger' });
            } finally {
              setWeeklyAbsenceLoading(false);
            }
          },
        },
      ],
    );
  }, [weeklyAbsenceDeclared]);

  const upcoming = useMemo(() => {
    const now = new Date();
    const confirmed = appointments.filter((item) => {
      const status = (item.status ?? '').trim().toLowerCase();
      return upcomingConfirmedStatuses.has(status);
    });

    // Exclude exams from the lesson list
    const lessons = confirmed.filter((item) => (item.type ?? '').trim().toLowerCase() !== 'esame');

    // First: find any lesson currently in progress (startsAt <= now < endsAt)
    const inProgress = lessons
      .filter((item) => {
        const start = new Date(item.startsAt);
        const end = item.endsAt
          ? new Date(item.endsAt)
          : new Date(start.getTime() + 60 * 60 * 1000);
        return start <= now && now < end;
      })
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

    // Then: future lessons
    const future = lessons
      .filter((item) => new Date(item.startsAt) >= now)
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

    // In-progress first, then future
    return [...inProgress, ...future];
  }, [appointments]);

  const paymentByAppointmentId = useMemo(
    () => new Map(paymentHistory.map((item) => [item.appointmentId, item])),
    [paymentHistory]
  );
  const bookedDatesSet = useMemo(() => {
    const set = new Set<string>();
    for (const appt of appointments) {
      const status = (appt.status ?? '').trim().toLowerCase();
      if (status === 'cancelled') continue;
      const d = new Date(appt.startsAt);
      set.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
    }
    return set;
  }, [appointments]);

  const examDatesSet = useMemo(() => {
    const set = new Set<string>();
    for (const appt of appointments) {
      if (appt.type !== 'esame') continue;
      const status = (appt.status ?? '').trim().toLowerCase();
      if (status === 'cancelled') continue;
      const d = new Date(appt.startsAt);
      set.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
    }
    return set;
  }, [appointments]);

  const nextExam = useMemo(() => {
    const now = new Date();
    return appointments
      .filter((appt) => {
        if (appt.type !== 'esame') return false;
        const status = (appt.status ?? '').trim().toLowerCase();
        if (status === 'cancelled') return false;
        return new Date(appt.startsAt) >= now;
      })
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())[0] ?? null;
  }, [appointments]);

  const examCountdown = useMemo(() => {
    if (!nextExam) return null;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const examDate = new Date(nextExam.startsAt);
    examDate.setHours(0, 0, 0, 0);
    const diffMs = examDate.getTime() - now.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return { days: 0, label: 'Oggi!' };
    if (diffDays === 1) return { days: 1, label: 'Domani!' };
    return { days: diffDays, label: `Tra ${diffDays} giorni` };
  }, [nextExam]);

  const agendaLessons = useMemo(() => {
    const fromTs = calendarRange ? new Date(calendarRange.from).getTime() : null;
    const toTs = calendarRange ? new Date(calendarRange.to).getTime() : null;
    return [...appointments]
      .filter((item) => {
        const startsAtTs = new Date(item.startsAt).getTime();
        if (fromTs !== null && startsAtTs < fromTs) return false;
        if (toTs !== null && startsAtTs > toTs) return false;
        return true;
      })
      .sort((a, b) => {
        const activeStatuses = upcomingConfirmedStatuses;
        const aActive = activeStatuses.has((a.status ?? '').trim().toLowerCase()) ? 0 : 1;
        const bActive = activeStatuses.has((b.status ?? '').trim().toLowerCase()) ? 0 : 1;
        if (aActive !== bActive) return aActive - bActive;
        return new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
      });
  }, [appointments, calendarRange, upcoming]);
  const visibleAgendaLessons = useMemo(
    () => (showAllAgendaLessons ? agendaLessons : agendaLessons.slice(0, 4)),
    [agendaLessons, showAllAgendaLessons],
  );
  const selectedHistoryPayment = useMemo(
    () =>
      selectedHistoryLesson
        ? paymentByAppointmentId.get(selectedHistoryLesson.id) ?? null
        : null,
    [paymentByAppointmentId, selectedHistoryLesson]
  );

  useEffect(() => {
    setHistoryDetailsOpen(false);
    setSelectedHistoryLesson(null);
  }, [selectedStudentId]);

  useEffect(() => {
    setShowAllAgendaLessons(false);
  }, [calendarRange?.from, calendarRange?.to, selectedStudentId]);

  useEffect(() => {
    const from = new Date(selectedDate);
    from.setHours(0, 0, 0, 0);
    const to = new Date(selectedDate);
    to.setHours(23, 59, 59, 999);
    setCalendarRange({ mode: 'day', from, to, label: '', anchor: selectedDate });
  }, [selectedDate]);

  useEffect(() => {
    if (!selectedHistoryLesson) return;
    const updated = appointments.find((item) => item.id === selectedHistoryLesson.id);
    if (!updated) {
      setHistoryDetailsOpen(false);
      setSelectedHistoryLesson(null);
      return;
    }
    setSelectedHistoryLesson(updated);
  }, [appointments, selectedHistoryLesson]);

  const nextLesson = upcoming[0];

  const nextLessonCountdown = useMemo(() => {
    if (!nextLesson) return null;
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const ld = new Date(nextLesson.startsAt); ld.setHours(0, 0, 0, 0);
    const diff = Math.round((ld.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diff === 0) return 'Oggi';
    if (diff === 1) return 'Domani';
    if (diff < 0) return 'In corso';
    return `Tra ${diff} giorni`;
  }, [nextLesson]);

  const sameDayLessons = useMemo(() => {
    if (!nextLesson) return [];
    const d = new Date(nextLesson.startsAt);
    const dayKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    return upcoming.filter((item) => {
      const id = new Date(item.startsAt);
      return `${id.getFullYear()}-${id.getMonth()}-${id.getDate()}` === dayKey;
    });
  }, [upcoming, nextLesson]);
  const hasMultipleLessons = sameDayLessons.length > 1;
  const isLessonInProgress = useMemo(() => {
    if (!nextLesson) return false;
    const now = new Date();
    const start = new Date(nextLesson.startsAt);
    const end = nextLesson.endsAt
      ? new Date(nextLesson.endsAt)
      : new Date(start.getTime() + 60 * 60 * 1000);
    return start <= now && now < end;
  }, [nextLesson]);
  const agendaLoading = rangeLoading || loading;

  const ITALIAN_WEEKDAYS = ['DOM', 'LUN', 'MAR', 'MER', 'GIO', 'VEN', 'SAB'] as const;
  const ITALIAN_MONTHS = [
    'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
    'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
  ] as const;
  const maxWeeks = Number(settings?.availabilityWeeks) || 4;
  const calendarDays = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = addDays(today, -7);
    const totalDays = 7 + maxWeeks * 7; // 1 week back + maxWeeks forward
    const days: { date: Date; dayNum: number; weekday: string }[] = [];
    for (let i = 0; i < totalDays; i++) {
      const d = addDays(start, i);
      days.push({
        date: d,
        dayNum: d.getDate(),
        weekday: ITALIAN_WEEKDAYS[d.getDay()],
      });
    }
    return days;
  }, [maxWeeks]);
  const calendarMonthLabel = `${ITALIAN_MONTHS[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`;

  // Prefetch date availability as soon as student data is ready
  useEffect(() => {
    if (!selectedStudentId || !maxWeeks) return;
    const today = new Date();
    const from = toDateString(today);
    const toDate = addDays(today, maxWeeks * 7);
    const to = toDateString(toDate);
    regloApi.getDateAvailability({ studentId: selectedStudentId, from, to })
      .then((data) => setDateAvailability(data))
      .catch(() => { /* silent — non-critical */ });
  }, [selectedStudentId, maxWeeks]);

  const preferredDateAvailable = dateAvailability.dates[toDateString(preferredDate)] !== false;

  const [holidaySet, setHolidaySet] = useState<Set<string>>(new Set());

  // Load holidays for full pill range (separate from date availability)
  useEffect(() => {
    const today = new Date();
    const from = toDateString(today);
    const toDate = addDays(today, 52 * 7);
    const to = toDateString(toDate);
    regloApi.getHolidays({ from, to })
      .then((response) => {
        const set = new Set<string>();
        const list = Array.isArray(response) ? response : [];
        for (const h of list) {
          const d = new Date(h.date);
          set.add(toDateString(d));
        }
        setHolidaySet(set);
      })
      .catch(() => { /* silent */ });
  }, []);

  const isSelectedDateHoliday = useMemo(
    () => holidaySet.has(toDateString(selectedDate)),
    [holidaySet, selectedDate],
  );

  const unavailableDatesSet = useMemo(() => {
    const set = new Set<string>();
    for (const [dateStr, avail] of Object.entries(dateAvailability.dates)) {
      if (avail) continue;
      // Convert YYYY-MM-DD (1-indexed) → year-month0indexed-day for CalendarDrawer
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const year = Number(parts[0]);
        const month = Number(parts[1]) - 1; // 0-indexed
        const day = Number(parts[2]);
        set.add(`${year}-${month}-${day}`);
      }
    }
    return set;
  }, [dateAvailability]);

  // Filter instructor chips by availability on selected date
  const visibleInstructors = useMemo(() => {
    if (!canSelectInstructor || !instructors.length) return instructors;
    const dateKey = toDateString(preferredDate);
    const availableIds = dateAvailability.instructorsByDate[dateKey];
    if (!availableIds) return instructors; // data not loaded yet → show all
    return instructors.filter((i) => availableIds.includes(i.id));
  }, [canSelectInstructor, instructors, preferredDate, dateAvailability]);

  // Reset selected instructor if no longer visible (but never reset if locked)
  useEffect(() => {
    if (
      selectedInstructorId &&
      canSelectInstructor &&
      !isLockedToInstructor &&
      visibleInstructors.length > 0 &&
      !visibleInstructors.some((i) => i.id === selectedInstructorId)
    ) {
      setSelectedInstructorId(null);
    }
  }, [visibleInstructors, selectedInstructorId, canSelectInstructor, isLockedToInstructor]);

  const dayScrollMountedRef = useRef(false);

  const scrollToDay = useCallback(
    (animated: boolean) => {
      const DAY_PILL_WIDTH = 58;
      const DAY_PILL_GAP = 8;
      const selectedNorm = new Date(selectedDate);
      selectedNorm.setHours(0, 0, 0, 0);
      const idx = calendarDays.findIndex(
        (d) => d.date.getTime() === selectedNorm.getTime(),
      );
      if (idx >= 0 && dayScrollRef.current) {
        const offset =
          idx * (DAY_PILL_WIDTH + DAY_PILL_GAP) -
          (screenWidth - spacing.lg * 2) / 2 +
          DAY_PILL_WIDTH / 2;
        dayScrollRef.current.scrollTo({ x: Math.max(0, offset), animated });
      }
    },
    [calendarDays, screenWidth, selectedDate],
  );

  const handleDayScrollLayout = useCallback(() => {
    if (!dayScrollMountedRef.current) {
      dayScrollMountedRef.current = true;
      scrollToDay(false);
    }
  }, [scrollToDay]);

  // Scroll to center when user taps a different day (skip initial — handled by onLayout)
  useEffect(() => {
    if (dayScrollMountedRef.current) {
      scrollToDay(true);
    }
  }, [scrollToDay]);

  const handleBookingRequest = async () => {
    if (!selectedStudentId) return;
    if (studentBookingDisabledByPolicy) {
      setToast({
        text: 'Le prenotazioni da app sono gestite dagli istruttori per questa autoscuola.',
        tone: 'info',
      });
      return;
    }
    if (requiresPaymentMethodForBooking) {
      setToast({
        text: 'Aggiungi un metodo di pagamento dalle impostazioni prima di prenotare.',
        tone: 'info',
      });
      return;
    }
    if (requiresCreditsForBooking) {
      setToast({
        text: 'Non hai crediti guida disponibili. Contatta la tua autoscuola.',
        tone: 'info',
      });
      return;
    }
    if (paymentProfile?.blockedByInsoluti) {
      setToast({
        text: 'Hai pagamenti insoluti. Salda prima di prenotare una nuova guida.',
        tone: 'danger',
      });
      return;
    }
    setToast(null);
    setBookingLoading(true);
    if (!availableDurations.includes(durationMinutes)) {
      setToast({ text: 'Durata non disponibile', tone: 'danger' });
      setBookingLoading(false);
      return;
    }
    if (
      canSelectLessonType &&
      (!selectedLessonTypes.length || !selectedLessonTypes.every((t) => availableLessonTypes.includes(t)))
    ) {
      setToast({ text: 'Tipo guida non disponibile', tone: 'danger' });
      setBookingLoading(false);
      return;
    }
    try {
      const slots = await regloApi.getAvailableSlots({
        studentId: selectedStudentId,
        date: toDateString(preferredDate),
        durationMinutes,
        ...(canSelectLessonType ? { lessonType: selectedLessonTypes[0], types: selectedLessonTypes } : {}),
        ...(selectedInstructorId ? { instructorId: selectedInstructorId } : {}),
      });
      if (!slots.length) {
        setToast({ text: 'Nessuna disponibilità per il giorno scelto. Prova con un altro giorno.', tone: 'info' });
        return;
      }
      setBookingSlots(slots);
      setBookingSelectedSlot(null);
      setBookingStep(2);
    } catch (err) {
      setToast({
        text: err instanceof Error ? err.message : 'Errore nella richiesta',
        tone: 'danger',
      });
    } finally {
      setBookingLoading(false);
    }
  };

  const handleConfirmFreeChoiceSlot = async () => {
    if (!selectedStudentId || !bookingSelectedSlot || freeChoiceBooking) return;
    setFreeChoiceBooking(true);
    setToast(null);

    // Close modal immediately for optimistic UX
    const slot = bookingSelectedSlot;
    setBookingOpen(false);
    setBookingSelectedSlot(null);
    setBookingSlots([]);
    triggerBookingCelebration();

    // Add provisional appointment to cache immediately
    const provisionalId = `provisional-${Date.now()}`;
    const provisionalAppointment: AutoscuolaAppointmentWithRelations = {
      id: provisionalId,
      companyId: '',
      studentId: selectedStudentId,
      caseId: null,
      slotId: null,
      type: canSelectLessonType ? (selectedLessonTypes[0] ?? 'guida') : 'guida',
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
      status: 'scheduled',
      instructorId: selectedInstructorId,
      vehicleId: null,
      locationId: null,
      notes: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      student: selectedStudent!,
      case: null,
      instructor: selectedInstructorId
        ? (instructors.find((i) => i.id === selectedInstructorId) ?? null)
        : null,
      vehicle: null,
      location: null,
    };

    // Inject into all active appointment queries
    queryClient.setQueriesData<AutoscuolaAppointmentWithRelations[]>(
      { queryKey: ['appointments'] },
      (old) => old ? [...old, provisionalAppointment] : [provisionalAppointment],
    );

    try {
      const response = await regloApi.createBookingRequest({
        studentId: selectedStudentId,
        preferredDate: toDateString(preferredDate),
        durationMinutes,
        ...(canSelectLessonType ? { lessonType: selectedLessonTypes[0], types: selectedLessonTypes } : {}),
        ...(selectedInstructorId ? { instructorId: selectedInstructorId } : {}),
        selectedStartsAt: slot.startsAt,
      });
      if (response.matched) {
        invalidateAllData();
        return;
      }
      // Slot taken — remove provisional, show error
      queryClient.setQueriesData<AutoscuolaAppointmentWithRelations[]>(
        { queryKey: ['appointments'] },
        (old) => old?.filter((a) => a.id !== provisionalId),
      );
      setToast({ text: 'Slot non più disponibile. Riprova.', tone: 'danger' });
      invalidateAllData();
    } catch (err) {
      // Remove provisional on error
      queryClient.setQueriesData<AutoscuolaAppointmentWithRelations[]>(
        { queryKey: ['appointments'] },
        (old) => old?.filter((a) => a.id !== provisionalId),
      );
      setToast({
        text: err instanceof Error ? err.message : 'Errore nella prenotazione',
        tone: 'danger',
      });
    } finally {
      setFreeChoiceBooking(false);
    }
  };

  const handleCloseBooking = () => {
    if (!bookingLoading) {
      setBookingOpen(false);
      setBookingStep(1);
    }
  };

  const handleCreateSwap = async (appointmentId: string) => {
    if (creatingSwap) return;
    setCreatingSwap(true);
    setToast(null);
    try {
      await regloApi.createSwapOffer(appointmentId);
      setToast({ text: 'Richiesta di sostituzione inviata!', tone: 'success' });
    } catch (err) {
      setToast({
        text: err instanceof Error ? err.message : 'Errore durante la richiesta di scambio',
        tone: 'danger',
      });
    } finally {
      setCreatingSwap(false);
    }
  };

  const executeCancel = async (appointmentId: string) => {
    setToast(null);
    setCancellingAppointmentId(null);
    cancelMutation.mutate(appointmentId, {
      onSuccess: () => {
        notificationEvents.requestRefresh();
      },
      onError: (err) => {
        setToast({
          text: err instanceof Error ? err.message : 'Errore durante annullamento',
          tone: 'danger',
        });
      },
    });
  };

  const handleCancel = (appointmentId: string) => {
    const appointment = appointments.find((a) => a.id === appointmentId);
    const cutoffHours = settings?.penaltyCutoffHoursPreset ?? 0;
    const autoPayments = settings?.autoPaymentsEnabled ?? false;
    const creditFlow = settings?.lessonCreditFlowEnabled ?? false;

    if (appointment && cutoffHours > 0 && (autoPayments || creditFlow)) {
      const startsAt = new Date(appointment.startsAt).getTime();
      const cutoffTime = startsAt - cutoffHours * 60 * 60 * 1000;
      if (Date.now() >= cutoffTime) {
        Alert.alert(
          'Annullare la guida?',
          `Mancano meno di ${cutoffHours} ore alla guida. Annullando, la lezione verrà comunque addebitata.`,
          [
            { text: 'Indietro', style: 'cancel' },
            {
              text: 'Annulla guida',
              style: 'destructive',
              onPress: () => executeCancel(appointmentId),
            },
          ],
        );
        return;
      }
    }

    Alert.alert(
      'Annullare la guida?',
      'Sei sicuro di voler annullare questa guida?',
      [
        { text: 'Indietro', style: 'cancel' },
        {
          text: 'Annulla guida',
          style: 'destructive',
          onPress: () => executeCancel(appointmentId),
        },
      ],
    );
  };

  const handleOpenHistoryDetails = (lesson: AutoscuolaAppointmentWithRelations) => {
    openLessonDetail(lesson);
  };

  const getPaymentDocument = useCallback(
    async (appointmentId: string): Promise<MobileAppointmentPaymentDocument | null> => {
      const document = await regloApi.getAppointmentPaymentDocument(appointmentId);
      if (document.documentType === 'none' || !document.viewUrl) {
        setToast({
          text: 'Documento non disponibile al momento.',
          tone: 'info',
        });
        return null;
      }
      return document;
    },
    []
  );

  const handleOpenPaymentDocument = useCallback(async () => {
    if (!selectedHistoryPayment || historyDocumentBusy) return;
    setHistoryDocumentBusy('view');
    try {
      const document = await getPaymentDocument(selectedHistoryPayment.appointmentId);
      if (!document?.viewUrl) return;
      const webBrowser = await getWebBrowserModule();
      if (webBrowser) {
        await webBrowser.openBrowserAsync(document.viewUrl, {
          presentationStyle: webBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
        });
        return;
      }
      await Linking.openURL(document.viewUrl);
      setToast({
        text: 'Viewer in-app non disponibile su questa build. Aperto nel browser.',
        tone: 'info',
      });
    } catch (err) {
      setToast({
        text: err instanceof Error ? err.message : 'Errore aprendo il documento',
        tone: 'danger',
      });
    } finally {
      setHistoryDocumentBusy(null);
    }
  }, [getPaymentDocument, historyDocumentBusy, selectedHistoryPayment]);

  const handleSharePaymentDocument = useCallback(async () => {
    if (!selectedHistoryPayment || historyDocumentBusy) return;
    setHistoryDocumentBusy('share');
    let downloadedUri: string | null = null;
    try {
      const document = await regloApi.getAppointmentPaymentDocument(selectedHistoryPayment.appointmentId);
      if (document.documentType === 'none' || !document.shareUrl || document.shareMode === 'none') {
        setToast({
          text: 'Documento non disponibile al momento.',
          tone: 'info',
        });
        return;
      }

      if (document.shareMode === 'file') {
        const sharing = await getSharingModule();
        if (!sharing || !(await sharing.isAvailableAsync())) {
          await Share.share({
            message: document.shareUrl,
            url: document.shareUrl,
          });
          setToast({
            text: 'Condivisione file non disponibile su questa build. Ti condivido il link.',
            tone: 'info',
          });
          return;
        }

        const cacheDir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
        if (!cacheDir) {
          throw new Error('Storage locale non disponibile sul dispositivo.');
        }
        const fileUri = `${cacheDir}payment-${selectedHistoryPayment.appointmentId}-${Date.now()}.pdf`;
        const downloaded = await FileSystem.downloadAsync(document.shareUrl, fileUri);
        downloadedUri = downloaded.uri;
        await sharing.shareAsync(downloaded.uri, {
          mimeType: 'application/pdf',
          dialogTitle: document.label,
          UTI: 'com.adobe.pdf',
        });
        return;
      }

      await Share.share({
        message: document.shareUrl,
        url: document.shareUrl,
      });
    } catch (err) {
      setToast({
        text: err instanceof Error ? err.message : 'Errore condividendo il documento',
        tone: 'danger',
      });
    } finally {
      if (downloadedUri) {
        try {
          await FileSystem.deleteAsync(downloadedUri, { idempotent: true });
        } catch {
          // ignore cleanup error
        }
      }
      setHistoryDocumentBusy(null);
    }
  }, [historyDocumentBusy, selectedHistoryPayment]);

  const handlePayNow = async () => {
    if (!selectedStudentId || !paymentProfile?.outstanding.length) return;
    const outstanding = paymentProfile.outstanding[0];
    setPayNowLoading(true);
    setToast(null);
    try {
      const setup = await regloApi.preparePayNow(outstanding.appointmentId);
      const baseSheetConfig = {
        merchantDisplayName: 'Reglo Autoscuole',
        customerId: setup.customerId,
        customerEphemeralKeySecret: setup.ephemeralKey,
        paymentIntentClientSecret: setup.paymentIntentClientSecret,
      } as const;

      let init = await initPaymentSheet({
        ...baseSheetConfig,
        applePay: { merchantCountryCode: 'IT' },
        googlePay: { merchantCountryCode: 'IT', testEnv: __DEV__ },
      });

      if (init.error && shouldRetryPaymentSheetWithoutWallet(init.error.message)) {
        init = await initPaymentSheet(baseSheetConfig);
        if (!init.error) {
          setToast({
            text: 'Apple Pay non disponibile su questa build. Usa carta o Link.',
            tone: 'info',
          });
        }
      }

      if (init.error) {
        throw new Error(init.error.message);
      }

      const result = await presentPaymentSheet();
      if (result.error) {
        throw new Error(result.error.message);
      }

      const finalized = await regloApi.finalizePayNow(
        outstanding.appointmentId,
        setup.paymentIntentId
      );

      if (!finalized.success) {
        throw new Error(finalized.message ?? 'Pagamento in elaborazione.');
      }

      setToast({ text: 'Pagamento completato', tone: 'success' });
      invalidateAllData();
    } catch (err) {
      setToast({
        text: err instanceof Error ? err.message : 'Errore durante pagamento',
        tone: 'danger',
      });
    } finally {
      setPayNowLoading(false);
    }
  };

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setToast(null);
    try {
      await loadStudents();
      invalidateAllData();
      notificationEvents.requestRefresh();
    } catch (err) {
      setToast({
        text: err instanceof Error ? err.message : 'Errore nel refresh',
        tone: 'danger',
      });
    } finally {
      setRefreshing(false);
    }
  }, [invalidateAllData, loadStudents]);

  const blockedByInsoluti = paymentProfile?.blockedByInsoluti;

  const openLessonDetail = useCallback((lesson: AutoscuolaAppointmentWithRelations) => {
    const status = (lesson.status ?? '').trim().toLowerCase();
    const isFutureActive = upcomingConfirmedStatuses.has(status) && new Date(lesson.startsAt).getTime() > Date.now();
    lessonDetailStore.set({
      lesson,
      payment: paymentByAppointmentId.get(lesson.id) ?? null,
      canSwap: isFutureActive && ['scheduled', 'confirmed'].includes(status) && !!(bookingOptions?.swapEnabled ?? settings?.swapEnabled),
      canCancel: isFutureActive && !!canCancelAppointments,
      vehiclesEnabled: settings?.vehiclesEnabled !== false,
      onSwap: handleCreateSwap,
      onCancel: handleCancel,
    });
    router.push('/(tabs)/home/lesson-detail');
  }, [paymentByAppointmentId, bookingOptions, settings, canCancelAppointments, handleCreateSwap, handleCancel, router]);

  const formatInstructorInitials = (name: string | null | undefined) => {
    if (!name) return 'Da assegnare';
    const parts = name.trim().split(/\s+/);
    if (parts.length < 2) return name;
    return `${parts[0]} ${parts[parts.length - 1][0]}.`;
  };


  // ── Scroll animation (sticky header) ──
  const headerH = insets.top + COMPACT_HEADER_H;
  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => { scrollY.value = e.contentOffset.y; },
  });

  const largeTitleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, SCROLL_RANGE * 0.6], [1, 0], Extrapolation.CLAMP),
    transform: [
      { translateY: interpolate(scrollY.value, [0, SCROLL_RANGE], [0, -12], Extrapolation.CLAMP) },
    ],
  }));

  const compactTitleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [SCROLL_RANGE * 0.5, SCROLL_RANGE], [0, 1], Extrapolation.CLAMP),
  }));

  const headerBorderStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 20], [0, 1], Extrapolation.CLAMP),
  }));

  const firstName = selectedStudent?.firstName ?? 'Allievo';

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style="dark" />
      <ToastNotice
        message={toast?.text ?? null}
        tone={toast?.tone}
        onHide={() => setToast(null)}
      />
      <BookingCelebration
        visible={bookingCelebrationVisible}
        onHidden={() => setBookingCelebrationVisible(false)}
      />

      {/* ── Sticky header ── */}
      <View style={[styles.headerWrap, { height: headerH, paddingTop: insets.top }]}>
        {Platform.OS === 'ios' ? (
          <BlurView intensity={80} tint="systemChromeMaterialLight" style={StyleSheet.absoluteFill} />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(247,247,247,0.95)' }]} />
        )}
        <Animated.View style={[StyleSheet.absoluteFill, styles.headerBorder, headerBorderStyle]} />
        <View style={styles.headerRow}>
          <Animated.View style={[styles.compactHeader, compactTitleStyle]}>
            <Text style={styles.compactTitle} numberOfLines={1}>Ciao, {firstName}</Text>
            <View style={styles.compactTag}>
              <Text style={styles.compactTagText}>Pratica</Text>
            </View>
          </Animated.View>
          <Pressable
            onPress={() => router.push('/(tabs)/home/notifications')}
            style={({ pressed }) => [styles.headerBellBtn, pressed && { opacity: 0.7 }]}
          >
            <Ionicons name="notifications-outline" size={18} color="#1a120a" />
            {unreadNotifCount > 0 && <View style={styles.headerBellDot} />}
          </Pressable>
        </View>
      </View>

      {/* ── Scroll content ── */}
      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scrollContent, { paddingTop: headerH }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            progressViewOffset={headerH}
          />
        }
      >
        {/* ── Large title ── */}
        <Animated.View style={[styles.largeTitleWrap, largeTitleStyle]}>
          <Text style={styles.largeTitleText}>Ciao, {firstName}</Text>
          {activeCompanyName ? (
            <View style={styles.largeTitleSchoolRow}>
              <Image source={require('../../assets/icons/fluent-pin.png')} style={styles.largeTitleSchoolIcon} />
              <Text style={styles.largeTitleSub} numberOfLines={1}>{activeCompanyName}</Text>
            </View>
          ) : (
            <Text style={styles.largeTitleSub}>Le tue guide</Text>
          )}
        </Animated.View>

        {/* ── Skeleton while loading ── */}
        {upcoming.length === 0 && (!studentsLoaded || !studentDataReady) && (
          <>
            <SkeletonBlock width="100%" height={180} radius={26} />
            <SkeletonBlock width="100%" height={60} radius={20} />
          </>
        )}

        {/* ── Empty state (no lessons AND no exam) ── */}
        {upcoming.length === 0 && !nextExam && studentsLoaded && (appointmentsQuery.data != null) && (
          <View style={styles.emptyState}>
            <Image
              source={require('../../assets/icons/fluent-car.png')}
              style={styles.emptyStateIcon}
            />
            <Text style={styles.emptyStateTitle}>Nessuna guida in programma</Text>
            <Text style={styles.emptyStateSub}>
              Prenota la tua prima guida e inizia il percorso{'\n'}verso la patente!
            </Text>
            {canBook && (
              <Pressable
                onPress={openBookingFlow}
                style={({ pressed }) => [styles.examPromptCta, pressed && { opacity: 0.9, transform: [{ scale: 0.97 }] }]}
              >
                <Ionicons name="add" size={18} color="#FFFFFF" />
                <Text style={styles.examPromptCtaText}>Prenota una guida</Text>
              </Pressable>
            )}
          </View>
        )}

        {/* ── Dedicated EXAM-HERO state (exam scheduled, but NO lessons booked) ── */}
        {upcoming.length === 0 && nextExam && examCountdown && studentsLoaded && (appointmentsQuery.data != null) && (
          <>
            <Animated.View entering={FadeInUp.delay(40).duration(340).springify()}>
              <Pressable
                onPress={() => {
                  examDetailStore.set({ exam: nextExam, countdown: examCountdown });
                  router.push('/(tabs)/home/exam-detail');
                }}
                style={({ pressed }) => [styles.examHero, pressed && styles.ctaPressed]}
              >
                <View style={styles.examHeroTop}>
                  <View style={styles.examHeroEyebrowRow}>
                    <Image source={require('../../assets/icons/fluent-graduate.png')} style={styles.examHeroIcon} />
                    <Text style={styles.examHeroEyebrow}>ESAME DI GUIDA</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.7)" />
                </View>

                {examCountdown.days === 0 ? (
                  <Text style={styles.examHeroToday}>È oggi!</Text>
                ) : (
                  <View style={styles.examHeroCountWrap}>
                    <Text style={styles.examHeroNum}>{examCountdown.days}</Text>
                    <Text style={styles.examHeroUnit}>{examCountdown.days === 1 ? 'giorno' : 'giorni'}</Text>
                  </View>
                )}

                <View style={styles.examHeroFooter}>
                  <View style={styles.examHeroChip}>
                    <Ionicons name="calendar" size={13} color="#FFFFFF" />
                    <Text style={styles.examHeroChipText}>{formatDay(nextExam.startsAt)}</Text>
                  </View>
                  <View style={styles.examHeroChip}>
                    <Ionicons name="time" size={13} color="#FFFFFF" />
                    <Text style={styles.examHeroChipText}>{formatTime(nextExam.startsAt)}</Text>
                  </View>
                </View>
              </Pressable>
            </Animated.View>

            <Animated.View entering={FadeInUp.delay(140).duration(320).springify()} style={styles.examPrompt}>
              <Image source={require('../../assets/icons/fluent-car.png')} style={styles.examPromptIcon} />
              <Text style={styles.examPromptTitle}>Non hai guide prenotate</Text>
              <Text style={styles.examPromptSub}>
                {studentBookingDisabledByPolicy
                  ? 'Contatta la tua autoscuola per fissare le guide di pratica prima dell’esame.'
                  : examCountdown.days <= 1
                    ? 'Manca pochissimo! Prenota una guida per allenarti prima dell’esame.'
                    : `Mancano ${examCountdown.days} giorni: prenota le tue guide di pratica e arriva all’esame al massimo.`}
              </Text>
              {!studentBookingDisabledByPolicy && (
                <Pressable
                  onPress={openBookingFlow}
                  style={({ pressed }) => [styles.examPromptCta, pressed && { opacity: 0.9, transform: [{ scale: 0.97 }] }]}
                >
                  <Ionicons name="add" size={18} color="#FFFFFF" />
                  <Text style={styles.examPromptCtaText}>Prenota una guida</Text>
                </Pressable>
              )}
            </Animated.View>
          </>
        )}

        {/* ── Exam countdown card (compact, shown above lessons when lessons exist) ── */}
        {nextExam && examCountdown && upcoming.length > 0 && (
          <Animated.View entering={FadeInUp.delay(50).duration(280).springify()}>
            <Pressable
              onPress={() => {
                examDetailStore.set({ exam: nextExam, countdown: examCountdown });
                router.push('/(tabs)/home/exam-detail');
              }}
              style={({ pressed }) => [styles.examCard, pressed && styles.ctaPressed]}
            >
              <Image source={require('../../assets/icons/fluent-graduate.png')} style={styles.examIcon} />
              <View style={{ flex: 1 }}>
                <Text style={styles.examLabel}>Esame di guida</Text>
                <Text style={styles.examDate}>
                  {formatDay(nextExam.startsAt)} {'\u2022'} {formatTime(nextExam.startsAt)}
                </Text>
              </View>
              <View style={styles.examBadge}>
                <Text style={styles.examBadgeNum}>{examCountdown.days}</Text>
                <Text style={styles.examBadgeUnit}>{examCountdown.days === 1 ? 'giorno' : 'giorni'}</Text>
              </View>
            </Pressable>
          </Animated.View>
        )}

        {/* ── HERO: Next lesson — warm elevated card ── */}
        {nextLesson && (
          <Animated.View entering={FadeInUp.delay(80).duration(320).springify()}>
            <Pressable
              onPress={() => openLessonDetail(nextLesson)}
              style={({ pressed }) => [styles.heroCard, pressed && styles.ctaPressed]}
            >
              <View style={styles.heroTop}>
                <View style={{ flex: 1 }}>
                  {nextLessonCountdown && (
                    <View style={styles.heroPill}>
                      <Text style={styles.heroPillText}>{nextLessonCountdown}</Text>
                    </View>
                  )}
                  <Text style={styles.heroTime}>
                    {formatTime(nextLesson.startsAt)}{nextLesson.endsAt ? ` \u2013 ${formatTime(nextLesson.endsAt)}` : ''}
                  </Text>
                  <Text style={styles.heroDate}>{formatDay(nextLesson.startsAt)}</Text>
                </View>
                <Image
                  source={require('../../assets/icons/fluent-racing.png')}
                  style={styles.heroIcon}
                />
              </View>

              <View style={styles.heroFooter}>
                <View style={styles.heroChip}>
                  <Ionicons name="person" size={13} color={colors.textSecondary} />
                  <Text style={styles.heroChipText}>{nextLesson.instructor?.name ?? 'Da assegnare'}</Text>
                </View>
                {nextLesson.types && nextLesson.types.length > 0 && (
                  <View style={styles.heroChip}>
                    <Ionicons name="flag" size={13} color={colors.textSecondary} />
                    <Text style={styles.heroChipText}>{formatLessonType(nextLesson.types[0])}</Text>
                  </View>
                )}
              </View>
            </Pressable>
          </Animated.View>
        )}

        {/* ── Upcoming lessons + booking CTA — horizontal scroll of mini-cards ── */}
        {(upcoming.length > 1 || (canBook && upcoming.length >= 1)) && (
          <Animated.View entering={FadeInUp.delay(140).duration(280).springify()}>
            {upcoming.length > 1 && (
              <Pressable
                onPress={() => {
                  allLessonsStore.set({ lessons: upcoming, onOpenDetail: openLessonDetail });
                  router.push('/(tabs)/home/all-lessons');
                }}
                style={({ pressed }) => [styles.seeAllBtn, pressed && { opacity: 0.6 }]}
              >
                <Text style={styles.seeAllText}>Vedi tutte le guide</Text>
                <Ionicons name="chevron-forward" size={14} color={colors.primary} />
              </Pressable>
            )}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ overflow: 'visible' }}
              contentContainerStyle={styles.upcomingScroll}
            >
              {canBook && (
                <Pressable
                  onPress={openBookingFlow}
                  style={({ pressed }) => [styles.bookCard, pressed && styles.ctaPressed]}
                >
                  <View style={styles.bookCardIcon}>
                    <Ionicons name="add" size={20} color="#6B7280" />
                  </View>
                  <Text style={styles.bookCardTitle}>Prenota</Text>
                  <Text style={styles.bookCardSub}>una guida</Text>
                </Pressable>
              )}
              {upcoming.slice(1).map((lesson, idx) => {
                const bg = LESSON_CARD_COLORS[(idx + 1) % LESSON_CARD_COLORS.length];
                return (
                  <Pressable
                    key={lesson.id}
                    onPress={() => openLessonDetail(lesson)}
                    style={({ pressed }) => [
                      styles.miniCard,
                      { backgroundColor: bg.bg },
                      pressed && styles.ctaPressed,
                    ]}
                  >
                    <Image
                      source={require('../../assets/icons/fluent-car.png')}
                      style={styles.miniCardIcon}
                    />
                    <Text style={styles.miniCardTime} numberOfLines={1}>
                      {formatTime(lesson.startsAt)}{lesson.endsAt ? ` \u2013 ${formatTime(lesson.endsAt)}` : ''}
                    </Text>
                    <Text style={styles.miniCardDate} numberOfLines={1}>
                      {formatDay(lesson.startsAt)}
                    </Text>
                    <Text style={styles.miniCardInstructor} numberOfLines={1}>
                      {lesson.instructor?.name ?? 'Da assegnare'}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Animated.View>
        )}

        {/* ── Scambi — open swap offers from other students ── */}
        {swapEnabled && (
          <Animated.View entering={FadeInUp.delay(180).duration(280).springify()}>
            <Pressable
              onPress={() => router.push('/(tabs)/swaps')}
              style={({ pressed }) => [styles.swapCard, pressed && styles.ctaPressed]}
            >
              <Image source={require('../../assets/icons/fluent-swap.png')} style={styles.swapIcon} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.swapTitle}>Scambi</Text>
                <Text style={styles.swapSub} numberOfLines={1}>
                  {swapOffersCount == null
                    ? 'Guide libere da altri allievi'
                    : swapOffersCount > 0
                      ? `${swapOffersCount} guid${swapOffersCount === 1 ? 'a disponibile' : 'e disponibili'} da altri allievi`
                      : 'Nessuna guida disponibile al momento'}
                </Text>
              </View>
              {swapOffersCount != null && swapOffersCount > 0 && (
                <View style={styles.swapBadge}>
                  <Text style={styles.swapBadgeText}>{swapOffersCount}</Text>
                </View>
              )}
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </Pressable>
          </Animated.View>
        )}

        {/* ── Segnala assenza — slim, low-emphasis row ── */}
        {isLockedToInstructor && assignedInstructorName && (
          <Animated.View entering={FadeInUp.delay(220).duration(280).springify()}>
            <Pressable
              disabled={weeklyAbsenceLoading || weeklyAbsenceDeclared}
              onPress={handleDeclareAbsence}
              style={({ pressed }) => [styles.absenceRow, pressed && !weeklyAbsenceDeclared && { opacity: 0.6 }]}
            >
              <Ionicons
                name={weeklyAbsenceDeclared ? 'checkmark-circle' : 'calendar-outline'}
                size={18}
                color={weeklyAbsenceDeclared ? '#22C55E' : colors.textMuted}
              />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.absenceTitle}>
                  {weeklyAbsenceDeclared ? 'Assenza segnalata questa settimana' : 'Sarai assente questa settimana?'}
                </Text>
                <Text style={styles.absenceSub} numberOfLines={1}>
                  {weeklyAbsenceDeclared ? assignedInstructorName : `Avvisa ${assignedInstructorName}`}
                </Text>
              </View>
              {!weeklyAbsenceDeclared && <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />}
            </Pressable>
          </Animated.View>
        )}

        <View style={{ height: 100 }} />
      </Animated.ScrollView>

      {/* Booking is now triggered from the in-row "Prenota una guida" CTA card
          (and the empty-state button) instead of a floating FAB. */}

      {/* Booking flow — now an Expo Router formSheet screen at /(tabs)/home/booking-flow */}
      {/* Lesson Detail — now an Expo Router formSheet screen at /(tabs)/home/lesson-detail */}
      <CalendarDrawer
        visible={calendarDrawerOpen}
        onClose={() => setCalendarDrawerOpen(false)}
        onSelectDate={(date) => setSelectedDate(date)}
        selectedDate={selectedDate}
        maxWeeks={Number(settings?.availabilityWeeks) || 4}
        bookedDates={bookedDatesSet}
      />
      {/* Free Choice BottomSheet removed — unified into Booking PageSheet */}
    </View>
  );
};

const styles = StyleSheet.create({
  /* ── Sticky blur header ── */
  headerWrap: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
  },
  headerBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  headerRow: {
    flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md,
  },
  compactHeader: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  compactTitle: { fontSize: 17, fontWeight: '600', color: colors.textPrimary },
  compactTag: {
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8,
    backgroundColor: colors.primary,
  },
  compactTagText: { fontSize: 11, fontWeight: '700', color: colors.surface },
  headerBellBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    position: 'absolute', right: spacing.md,
  },
  headerBellDot: {
    position: 'absolute', top: 4, right: 4,
    width: 8, height: 8, borderRadius: 999,
    backgroundColor: '#ec4899', borderWidth: 2, borderColor: colors.background,
  },

  /* ── Large title ── */
  largeTitleWrap: { paddingTop: 4, paddingBottom: 2 },
  largeTitleText: { fontSize: 24, fontWeight: '600', letterSpacing: -0.3, color: '#1A1A2E' },
  largeTitleSub: { fontSize: 13, fontWeight: '500', color: colors.textMuted, marginTop: 4 },
  largeTitleSchoolRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  largeTitleSchoolIcon: { width: 16, height: 16 },

  /* ── Scambi (swap offers) slot ── */
  swapCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.surface, borderRadius: 20, paddingVertical: 14, paddingHorizontal: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08, shadowRadius: 6, elevation: 3,
  },
  swapIcon: { width: 36, height: 36 },
  swapTitle: { fontSize: 15, fontWeight: '700', color: '#1A1A2E', letterSpacing: -0.2 },
  swapSub: { fontSize: 12.5, fontWeight: '500', color: colors.textMuted, marginTop: 2 },
  swapBadge: {
    backgroundColor: colors.primary, borderRadius: 12, minWidth: 22, height: 22,
    paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center',
  },
  swapBadgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },

  /* ── Segnala assenza — slim row ── */
  absenceRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 12, paddingHorizontal: 4,
  },
  absenceTitle: { fontSize: 13.5, fontWeight: '600', color: colors.textSecondary },
  absenceSub: { fontSize: 12, fontWeight: '500', color: colors.textMuted, marginTop: 1 },

  /* ── Scroll content ── */
  scrollContent: { paddingHorizontal: spacing.md, gap: 20 },

  /* ── Press feedback ── */
  ctaPressed: { opacity: 0.95, transform: [{ scale: 0.97 }] },

  /* ── Booking CTA — white Airbnb card, lifted, Reglo-colored shadow ── */
  bookCard: {
    width: 150, borderRadius: 20, padding: 14,
    alignItems: 'flex-start', justifyContent: 'center', gap: 4,
    backgroundColor: colors.surface,
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.17, shadowRadius: 28, elevation: 12,
  },
  bookCardIcon: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'transparent', borderWidth: 1, borderColor: '#9CA3AF', borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', marginBottom: 6,
  },
  bookCardTitle: { fontSize: 16, fontWeight: '600', color: '#1A1A2E', letterSpacing: -0.2 },
  bookCardSub: { fontSize: 12.5, fontWeight: '500', color: colors.textMuted },

  /* ── HERO card: next lesson — warm elevated card ── */
  heroCard: {
    backgroundColor: colors.surface, borderRadius: 26,
    padding: 20, gap: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 10, elevation: 6,
  },
  heroTop: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  heroPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'transparent', borderWidth: 1, borderColor: '#F9A8D4', borderRadius: 999,
    paddingHorizontal: 11, paddingVertical: 3, marginBottom: 6,
  },
  heroPillText: { fontSize: 11, fontWeight: '700', color: '#DB2777' },
  heroTime: {
    fontSize: 30, fontWeight: '600', color: '#1A1A2E',
    letterSpacing: -0.8, lineHeight: 36,
  },
  heroDate: { fontSize: 14, fontWeight: '500', color: colors.textMuted, marginTop: 2 },
  heroIcon: { width: 72, height: 72 },
  heroFooter: {
    flexDirection: 'row', gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border,
    paddingTop: 12,
  },
  heroChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#F3F4F6', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  heroChipText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },

  /* ── Mini-cards: horizontal upcoming lessons ── */
  upcomingScroll: { gap: 12, paddingRight: spacing.md, paddingVertical: 6 },
  miniCard: {
    width: 150, borderRadius: 20, padding: 14,
    alignItems: 'flex-start', gap: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10, shadowRadius: 10, elevation: 5,
  },
  miniCardIcon: { width: 32, height: 32, marginBottom: 4 },
  miniCardTime: { fontSize: 16, fontWeight: '700', color: '#1A1A2E', letterSpacing: -0.3 },
  miniCardDate: { fontSize: 11, fontWeight: '500', color: colors.textMuted },
  miniCardInstructor: { fontSize: 11, fontWeight: '600', color: colors.textSecondary, marginTop: 2 },
  seeAllBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-start', paddingVertical: 8, marginBottom: 4,
  },
  seeAllText: { fontSize: 13, fontWeight: '600', color: colors.primary },

  /* ── Exam countdown card ── */
  examCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#F5F0FF', borderRadius: 22, padding: 16,
    shadowColor: '#8B5CF6', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 12, elevation: 6,
  },
  examIcon: { width: 44, height: 44 },
  examLabel: { fontSize: 12, fontWeight: '600', color: '#7C3AED' },
  examDate: { fontSize: 15, fontWeight: '700', color: '#1A1A2E', marginTop: 2 },
  examBadge: {
    backgroundColor: '#8B5CF6', borderRadius: 16,
    paddingHorizontal: spacing.sm, paddingVertical: 6, alignItems: 'center', minWidth: 64,
  },
  examBadgeNum: { color: '#FFF', fontSize: 22, fontWeight: '800', lineHeight: 24 },
  examBadgeUnit: { color: '#FFF', fontSize: 10, fontWeight: '600', opacity: 0.9 },

  /* ── Exam HERO (dedicated empty-state when exam scheduled but no lessons) ── */
  examHero: {
    backgroundColor: '#7C3AED', borderRadius: 26, padding: 22,
    shadowColor: '#7C3AED', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 16, elevation: 8,
  },
  examHeroTop: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  examHeroEyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  examHeroIcon: { width: 34, height: 34 },
  examHeroEyebrow: {
    fontSize: 12, fontWeight: '800', color: 'rgba(255,255,255,0.85)', letterSpacing: 1,
  },
  examHeroCountWrap: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 16, marginBottom: 20,
  },
  examHeroNum: {
    fontSize: 64, fontWeight: '800', color: '#FFFFFF', lineHeight: 62, letterSpacing: -2,
  },
  examHeroUnit: {
    fontSize: 18, fontWeight: '700', color: 'rgba(255,255,255,0.9)', marginBottom: 11,
  },
  examHeroToday: {
    fontSize: 50, fontWeight: '800', color: '#FFFFFF', letterSpacing: -1.5,
    marginTop: 16, marginBottom: 20,
  },
  examHeroFooter: {
    flexDirection: 'row', gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.25)',
    paddingTop: 16,
  },
  examHeroChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  examHeroChipText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },

  examPrompt: { alignItems: 'center', paddingTop: 20, paddingHorizontal: 16, gap: 6 },
  examPromptIcon: { width: 72, height: 72, marginBottom: 4 },
  examPromptTitle: {
    fontSize: 17, fontWeight: '800', color: '#1A1A2E', letterSpacing: -0.3, textAlign: 'center',
  },
  examPromptSub: {
    fontSize: 14, fontWeight: '400', color: colors.textMuted, textAlign: 'center',
    lineHeight: 20, maxWidth: 300,
  },
  examPromptCta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: colors.primary, borderRadius: 26, paddingHorizontal: 24, minHeight: 50,
    marginTop: 14, alignSelf: 'stretch',
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22, shadowRadius: 8, elevation: 4,
  },
  examPromptCtaText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },

  /* ── Empty state ── */
  emptyState: {
    alignItems: 'center', paddingVertical: 10, paddingHorizontal: 30, gap: 6,
  },
  emptyStateIcon: { width: 120, height: 120, marginBottom: 12 },
  emptyStateTitle: {
    fontSize: 18, fontWeight: '700', color: '#1a120a', letterSpacing: -0.3, textAlign: 'center',
  },
  emptyStateSub: {
    fontSize: 14, fontWeight: '400', color: '#9CA3AF', textAlign: 'center', lineHeight: 20,
  },
  /* ── Booking Flow Calendar ── */
  bkBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  bkBackBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#EC4899',
  },
  bkMonthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  bkMonthLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a120a',
  },
  bkMonthArrow: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(26,18,10,0.08)',
  },
  bkWeekdayRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  bkWeekdayCell: {
    flex: 1,
    alignItems: 'center',
  },
  bkWeekdayText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9CA3AF',
    letterSpacing: 0.5,
  },
  bkGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  bkDayWrapper: {
    width: '14.28%',
    alignItems: 'center',
    paddingVertical: 4,
  },
  bkDayCell: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bkDayCellToday: {
    borderWidth: 2,
    borderColor: '#ec4899',
  },
  bkDayCellSelected: {
    backgroundColor: '#1a120a',
  },
  bkDayText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1a120a',
  },
  bkDayTextToday: {
    fontWeight: '700',
    color: '#ec4899',
  },
  bkDayTextSelected: {
    fontWeight: '700',
    color: '#FFFFFF',
  },
  bkDayDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#ec4899',
    marginTop: 2,
  },
  bkInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  bkInfoText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#9CA3AF',
  },

  /* ── Legacy styles removed — old pills, fixed CTA, exam card ── */

  /* ── Blocked by exam priority ── */
  blockedByExamBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 20,
    backgroundColor: '#F5F3FF',
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  blockedByExamIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  blockedByExamTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#4C1D95',
  },
  blockedByExamDesc: {
    fontSize: 13,
    color: '#5B21B6',
    marginTop: 2,
    lineHeight: 18,
  },

  /* ── Old nextLesson/calendar/CTA styles removed ── */
  swapDetailsCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  swapDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  swapDetailIcon: {
    fontSize: 16,
    width: 24,
    textAlign: 'center',
  },
  swapDetailText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.textPrimary,
    flex: 1,
  },
  swapIgnoreBtn: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  swapIgnoreBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textSecondary,
  },

  /* ── Agenda Section ── */
  agendaSection: {
    gap: spacing.sm,
  },
  agendaSectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
  },
  agendaList: {
    gap: spacing.sm,
  },
  carouselCard: {
    borderRadius: 28,
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 28,
    elevation: 12,
  },
  carouselCardImageStyle: {
    borderRadius: 28,
  },
  carouselCardContent: {
    flex: 1,
    padding: 24,
  },
  carouselCardNumber: {
    fontSize: 64,
    fontWeight: '800',
    color: 'rgba(77,3,32,0.15)',
    position: 'absolute',
    top: 16,
    right: 22,
    lineHeight: 68,
  },
  carouselCardDate: {
    fontSize: 22,
    fontWeight: '800',
    color: '#4c0320',
    marginTop: 8,
  },
  carouselCardTime: {
    fontSize: 15,
    fontWeight: '600',
    color: '#4c0320',
    marginTop: 2,
  },
  carouselCardMeta: {
    fontSize: 14,
    fontWeight: '500',
    color: '#fd94cd',
    marginTop: 4,
  },
  carouselCardActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },

  // Lessons list (scroll down view)
  lessonsListSection: {
    gap: 12,
    marginTop: 8,
  },
  lessonsListTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1A1A2E',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  lessonListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 12,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    shadowColor: '#F9A8D4',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 3,
  },
  lessonListThumb: {
    width: 56,
    height: 56,
    borderRadius: 16,
    overflow: 'hidden',
  },
  lessonListThumbImage: {
    borderRadius: 16,
  },
  lessonListInfo: {
    flex: 1,
    gap: 2,
  },
  lessonListDate: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  lessonListTime: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  lessonListInstructor: {
    fontSize: 12,
    fontWeight: '500',
    color: '#94A3B8',
  },

  cardCtaRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  cardCtaBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 14,
    borderRadius: 20,
  },
  cardCtaDetail: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  cardCtaDetailText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  cardCtaCancel: {
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  cardCtaCancelText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  dateGroupHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    marginTop: 14,
    marginBottom: 4,
    paddingHorizontal: 2,
  },
  nextLessonSkeleton: {
    backgroundColor: '#FEF9C3',
    paddingHorizontal: 22,
    paddingVertical: 24,
    gap: 12,
  },
  agendaRowSkeleton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: 10,
  },
  agendaRow: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.xs,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  agendaExamRow: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: 4,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  agendaExamHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  agendaExamIconBox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  agendaExamTime: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  agendaExamBadge: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    color: '#6366F1',
  },
  agendaExamTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  agendaExamMeta: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  agendaTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  agendaTime: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '700',
    color: '#1E293B',
    flex: 1,
  },
  agendaInstructor: {
    fontSize: 14,
    lineHeight: 20,
    color: '#1E293B',
    fontWeight: '500',
  },
  agendaMeta: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    color: '#64748B',
  },
  agendaCtaWrap: {
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  agendaToggleWrap: {
    marginTop: spacing.xs,
  },
  historyPaymentMeta: {
    ...typography.caption,
    color: colors.textSecondary,
    textTransform: 'none',
    letterSpacing: 0,
    fontSize: 11,
    lineHeight: 15,
  },

  /* ── BottomSheet / Booking Preferences (unchanged styles) ── */
  pickerRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  bookingFormBlock: {
    gap: spacing.xs,
  },
  durationWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    alignItems: 'center',
  },
  durationChip: {
    minWidth: 62,
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: '#FFFFFF',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  durationChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.32,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  durationText: {
    ...typography.body,
    color: colors.textPrimary,
  },
  durationTextActive: {
    ...typography.body,
    color: '#FFFFFF',
  },
  _oldBookingCreditsInline: {
    display: 'none',
  },
  bookingCreditsInlineLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    letterSpacing: 0,
    textTransform: 'none',
    fontWeight: '500',
  },
  bookingCreditsInlineValue: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -0.2,
  },
  sheetContent: {
    gap: spacing.xs,
  },
  sheetScrollContent: {
    gap: spacing.xs,
    paddingBottom: spacing.sm,
  },
  sheetScrollContainer: {
    width: '100%',
    position: 'relative',
  },
  paymentDetailsScroll: {
    width: '100%',
  },
  sheetText: {
    ...typography.subtitle,
    color: colors.textPrimary,
  },
  sheetMeta: {
    ...typography.body,
    color: colors.textSecondary,
  },
  sheetDivider: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    textTransform: 'uppercase',
  },
  paymentDocumentActions: {
    gap: spacing.sm,
    marginTop: spacing.sm,
    overflow: 'visible',
  },
  paymentDocumentActionWrap: {
    width: '100%',
    alignSelf: 'stretch',
    paddingHorizontal: spacing.md,
    paddingVertical: 2,
    overflow: 'visible',
  },
  paymentEventsList: {
    gap: spacing.sm,
  },
  paymentEventRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#FFFFFF',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  paymentEventMain: {
    flex: 1,
    gap: 2,
  },
  paymentEventTitle: {
    ...typography.body,
    color: colors.textPrimary,
  },
  paymentEventMeta: {
    ...typography.caption,
    color: colors.textSecondary,
    textTransform: 'none',
    letterSpacing: 0,
  },
  scrollHintBottom: {
    bottom: spacing.sm,
  },
  scrollHintTop: {
    top: spacing.xs,
  },
  sheetActionsDock: {
    gap: spacing.sm,
    alignItems: 'stretch',
    width: '100%',
  },
  fullWidthButtonWrap: {
    width: '100%',
    alignSelf: 'stretch',
  },
  empty: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  /* ── BottomSheet shared styles ── */
  sheetInfoCard: {
    backgroundColor: '#FEF9C3',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: 16,
    gap: 4,
  },
  sheetInfoLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#CA8A04',
  },
  sheetInfoDateTime: {
    fontSize: 15,
    fontWeight: '400',
    color: '#111111',
  },
  sheetInfoMeta: {
    fontSize: 12,
    fontWeight: '400',
    color: '#111111',
  },
  sheetFormLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748B',
  },
  sheetTextAction: {
    alignSelf: 'center',
    paddingVertical: 6,
  },
  sheetTextActionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#EF4444',
    textAlign: 'center',
  },
  bookingDateCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bookingDateIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FEF9C3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookingDateText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
  },
  detailInfoCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    gap: 2,
  },
  detailDateTime: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  detailStatus: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 2,
  },
  detailDuration: {
    fontSize: 12,
    fontWeight: '400',
    color: '#94A3B8',
    marginTop: 2,
  },
  detailSection: {
    gap: 2,
  },
  detailSectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  detailSectionValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  detailPaymentInfo: {
    fontSize: 13,
    fontWeight: '400',
    fontStyle: 'italic',
    color: '#64748B',
  },

  /* ── Chunky Google-style BottomSheet styles ── */
  chunkyYellowCard: {
    backgroundColor: '#FEF9C3',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: 20,
    gap: 6,
  },
  chunkyYellowDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#CA8A04',
  },
  chunkyYellowLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#CA8A04',
    textTransform: 'uppercase',
  },
  chunkyYellowTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
  },
  chunkyYellowSub: {
    fontSize: 14,
    fontWeight: '400',
    color: '#64748B',
  },
  chunkyPinkCta: {
    backgroundColor: colors.primary,
    height: 54,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  chunkyPinkCtaText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  chunkyOutlineBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E2E8F0',
    height: 54,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chunkyOutlineBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  chunkyRedLink: {
    alignSelf: 'center',
    paddingVertical: 10,
  },
  chunkyRedLinkText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#EF4444',
    textAlign: 'center',
  },
  chunkyFormLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chunkyDateCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    padding: 18,
    height: 58,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chunkyDateText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  chunkyChipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    alignItems: 'center',
  },
  chunkyChip: {
    height: 44,
    paddingHorizontal: 20,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chunkyChipActive: {
    backgroundColor: '#EC4899',
    borderColor: '#EC4899',
    shadowColor: '#EC4899',
    shadowOpacity: 0.32,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  chunkyChipText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
  },
  chunkyChipTextActive: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  chunkyCreditsRow: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  chunkyCreditsLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748B',
  },
  chunkyCreditsValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },

  /* ── Booking drawer (chunky redesign) ── */
  bookingCreditsBadge: {
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(26,18,10,0.08)',
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  bookingCreditsBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1a120a',
  },
  bookingSection: {
    gap: 12,
  },
  bookingSectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  bookingDateCardChunky: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(26,18,10,0.08)',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    shadowColor: '#9c8a76',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  bookingDateIconLg: {
    width: 42,
    height: 42,
    borderRadius: 999,
    backgroundColor: '#fbd6e6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookingDateFluent: {
    width: 42,
    height: 42,
  },
  bookingDateMainText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a120a',
  },
  bookingDateHint: {
    fontSize: 12,
    fontWeight: '400',
    color: '#9CA3AF',
    marginTop: 2,
  },
  bookingDurationSingle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a120a',
  },
  bookingChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  bookingChipChunky: {
    height: 46,
    paddingHorizontal: 22,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookingChipChunkyActive: {
    backgroundColor: '#1a120a',
    borderColor: '#1a120a',
  },
  bookingChipChunkyText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  bookingChipChunkyTextActive: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  bookingInstructorCaption: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 6,
    lineHeight: 16,
  },
  bookingUnavailableCaption: {
    fontSize: 13,
    fontWeight: '600',
    color: '#c4334e',
    textAlign: 'center',
    marginBottom: 8,
  },
  timelineSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#9CA3AF',
    marginBottom: 16,
  },
  timelineContainer: {
    paddingBottom: 12,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    minHeight: 62,
  },
  timelineLeft: {
    width: 52,
    alignItems: 'center',
    paddingTop: 16,
  },
  timelineHour: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  timelineLine: {
    width: 1.5,
    flex: 1,
    backgroundColor: 'rgba(26,18,10,0.08)',
    marginTop: 8,
    minHeight: 20,
  },
  timelineCard: {
    flex: 1,
    height: 52,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(26,18,10,0.08)',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    marginBottom: 10,
    shadowColor: '#9c8a76',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  timelineCardActive: {
    backgroundColor: '#1a120a',
    borderColor: '#1a120a',
    shadowColor: '#1a120a',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  timelineCardText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#1a120a',
  },
  timelineCardTextActive: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  timelineCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#ec4899',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineCheckText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  /* ── Assigned Instructor Row ── */
  assignedInstructorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginTop: 16,
    marginBottom: 8,
    gap: 12,
  },
  assignedInstructorAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FCE7F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  assignedInstructorInfo: {
    flex: 1,
    gap: 1,
  },
  assignedInstructorLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  assignedInstructorName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
  },
  assignedInstructorActions: {
    flexDirection: 'row',
    gap: 4,
  },
  assignedInstructorBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  assignedInstructorBtnWhatsApp: {
    backgroundColor: '#F0FDF4',
  },
  assignedInstructorBtnCall: {
    backgroundColor: '#EFF6FF',
  },
});
