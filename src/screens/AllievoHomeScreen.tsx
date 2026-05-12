import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import Animated, { FadeIn, FadeInUp, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import {
  Alert,
  Image,
  ImageBackground,
  LayoutAnimation,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  Share,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
  useWindowDimensions,
  View,
} from 'react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import { LinearGradient } from 'expo-linear-gradient';
import { useStripe } from '@stripe/stripe-react-native';
import { Screen } from '../components/Screen';
import { BottomSheet } from '../components/BottomSheet';
import { BookingCelebration } from '../components/BookingCelebration';
import { ToastNotice, ToastTone } from '../components/ToastNotice';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { CalendarDrawer } from '../components/CalendarDrawer';
import { CalendarNavigatorRange } from '../components/CalendarNavigator';
import { ScrollHintFab } from '../components/ScrollHintFab';
import { SkeletonBlock, SkeletonCard } from '../components/Skeleton';
import { useSession } from '../context/SessionContext';
import { regloApi } from '../services/regloApi';
import { subscribePushIntent } from '../services/pushNotifications';
import { notificationEvents } from '../services/notificationEvents';
import { loadInbox } from '../services/notificationStore';
import { useAutoscuolaSettings } from '../hooks/queries/useAutoscuolaSettings';
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
import { colors, pink, radii, spacing, typography } from '../theme';


// Collapsible wrapper — measures content once, animates height
const Collapsible = ({ open, children }: { open: boolean; children: React.ReactNode }) => {
  const measuredRef = useRef(0);
  const openRef = useRef(open);
  const height = useSharedValue(open ? 1000 : 0); // Start expanded if open on mount

  openRef.current = open;

  const onMeasure = useCallback((e: { nativeEvent: { layout: { height: number } } }) => {
    const h = Math.ceil(e.nativeEvent.layout.height);
    if (h > 0) {
      measuredRef.current = h;
      // Set height immediately on first measure if open (no animation)
      if (openRef.current) height.value = h;
    }
  }, []);

  useEffect(() => {
    if (measuredRef.current === 0) return; // Not measured yet, skip
    height.value = withTiming(open ? measuredRef.current : 0, { duration: 150 });
  }, [open]);

  const animStyle = useAnimatedStyle(() => ({
    height: height.value,
    overflow: 'hidden' as const,
  }));

  return (
    <Animated.View style={animStyle}>
      <View style={{ position: 'absolute', width: '100%' }} onLayout={onMeasure}>
        {children}
      </View>
    </Animated.View>
  );
};

// Card background images
const CARD_BACKGROUNDS = [
  require('../../assets/card-backgrounds/2.png'),
  require('../../assets/card-backgrounds/3.png'),
  require('../../assets/card-backgrounds/4.png'),
  require('../../assets/card-backgrounds/5.png'),
  require('../../assets/card-backgrounds/6.png'),
  require('../../assets/card-backgrounds/7.png'),
  require('../../assets/card-backgrounds/8.png'),
  require('../../assets/card-backgrounds/9.png'),
  require('../../assets/card-backgrounds/10.png'),
  require('../../assets/card-backgrounds/11.png'),
];

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

const lessonDurationMinutes = (appointment: AutoscuolaAppointmentWithRelations) => {
  const startsAt = new Date(appointment.startsAt).getTime();
  const endsAt = appointment.endsAt
    ? new Date(appointment.endsAt).getTime()
    : startsAt + 30 * 60 * 1000;
  return Math.max(30, Math.round((endsAt - startsAt) / 60000));
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




export const AllievoHomeScreen = () => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { height: windowHeight, width: screenWidth } = useWindowDimensions();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const { user, activeCompanyId, companies } = useSession();
  const activeCompanyName = companies.find((c) => c.id === activeCompanyId)?.name ?? null;
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
  const [bookingFlowOpen, setBookingFlowOpen] = useState(false);
  const [bookingStep, setBookingStep] = useState<1 | 2>(1);
  const [bookingSlots, setBookingSlots] = useState<AvailableSlot[]>([]);
  const [bookingSlotsLoading, setBookingSlotsLoading] = useState(false);
  const [bookingSelectedSlot, setBookingSelectedSlot] = useState<AvailableSlot | null>(null);
  const bookingScrollRef = useRef<ScrollView | null>(null);
  const [cancellingAppointmentId, setCancellingAppointmentId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [historyDetailsOpen, setHistoryDetailsOpen] = useState(false);
  const [selectedHistoryLesson, setSelectedHistoryLesson] =
    useState<AutoscuolaAppointmentWithRelations | null>(null);
  const [historyDocumentBusy, setHistoryDocumentBusy] = useState<'view' | 'share' | null>(null);
  const [payNowLoading, setPayNowLoading] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [creatingSwap, setCreatingSwap] = useState(false);
  const [calendarRange, setCalendarRange] = useState<CalendarNavigatorRange | null>(null);
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [calendarDrawerOpen, setCalendarDrawerOpen] = useState(false);
  const [bookingCalendarOpen, setBookingCalendarOpen] = useState(false);
  const [dateAvailability, setDateAvailability] = useState<{
    dates: Record<string, boolean>;
    instructorsByDate: Record<string, string[]>;
  }>({ dates: {}, instructorsByDate: {} });
  const [freeChoiceSlots, setFreeChoiceSlots] = useState<AvailableSlot[]>([]);
  const [freeChoiceOpen, setFreeChoiceOpen] = useState(false);
  const [freeChoiceSelected, setFreeChoiceSelected] = useState<AvailableSlot | null>(null);
  const [freeChoiceBooking, setFreeChoiceBooking] = useState(false);
  const [pendingFreeChoiceOpen, setPendingFreeChoiceOpen] = useState(false);
  const dayScrollRef = useRef<ScrollView | null>(null);
  const [showAllAgendaLessons, setShowAllAgendaLessons] = useState(false);
  const [bookingCelebrationVisible, setBookingCelebrationVisible] = useState(false);
  const [expandedPillId, setExpandedPillId] = useState<string | null>(null);
  const userToggledRef = useRef(false);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [weeklyAbsenceDeclared, setWeeklyAbsenceDeclared] = useState(false);
  const [weeklyAbsenceLoading, setWeeklyAbsenceLoading] = useState(false);

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
    setBookingFlowOpen(true);
    setBookingMonth(() => { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d; });
  };

  const handleBookingDateSelect = async (date: Date, overrideInstructorId?: string | null) => {
    const isStepChange = bookingStep === 1;
    setPreferredDate(date);
    if (isStepChange) {
      setBookingStep(2);
      setBookingSlotsLoading(true);
      setBookingSlots([]);
      setTimeout(() => bookingScrollRef.current?.scrollTo({ x: screenWidth, animated: true }), 50);
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
      setBookingFlowOpen(false);
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
    setPrefsOpen(true);
    // Prefetch available slots for the selected date
    if (selectedStudentId) {
      queryClient.prefetchQuery({
        queryKey: ['available-slots', activeCompanyId, {
          studentId: selectedStudentId,
          date: toDateString(selectedDate),
          durationMinutes,
          ...(canSelectLessonType ? { lessonType: selectedLessonTypes[0] } : {}),
          ...(selectedInstructorId ? { instructorId: selectedInstructorId } : {}),
        }],
        queryFn: () => regloApi.getAvailableSlots({
          studentId: selectedStudentId!,
          date: toDateString(selectedDate),
          durationMinutes,
          ...(canSelectLessonType ? { lessonType: selectedLessonTypes[0] } : {}),
          ...(selectedInstructorId ? { instructorId: selectedInstructorId } : {}),
        }),
        staleTime: 30 * 1000,
      });
    }
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
  const hasLessonCredits = (paymentProfile?.lessonCreditsAvailable ?? 0) > 0;
  const creditFlowEnabled = paymentProfile?.lessonCreditFlowEnabled ?? false;
  // Prefer cluster-resolved setting over company default
  const canCancelAppointments = bookingOptions?.studentCancellationEnabled !== false;
  const effectiveAppBookingActors = bookingOptions?.appBookingActors ?? settings?.appBookingActors;
  const studentBookingDisabledByPolicy = effectiveAppBookingActors === 'instructors';
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

  // Unread notification count
  useEffect(() => {
    const refreshCount = () => {
      loadInbox().then((items) => {
        setUnreadNotifCount(items.filter((n) => !n.read && !n.dismissed).length);
      }).catch(() => {});
    };
    refreshCount();
    return notificationEvents.onDataChanged(refreshCount);
  }, []);

  const upcoming = useMemo(() => {
    const now = new Date();
    const confirmed = appointments.filter((item) => {
      const status = (item.status ?? '').trim().toLowerCase();
      return upcomingConfirmedStatuses.has(status);
    });

    // First: find any lesson currently in progress (startsAt <= now < endsAt)
    const inProgress = confirmed
      .filter((item) => {
        const start = new Date(item.startsAt);
        const end = item.endsAt
          ? new Date(item.endsAt)
          : new Date(start.getTime() + 60 * 60 * 1000);
        return start <= now && now < end;
      })
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

    // Then: future lessons
    const future = confirmed
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
      setFreeChoiceSlots(slots);
      setFreeChoiceSelected(null);
      setPendingFreeChoiceOpen(true);
      setPrefsOpen(false);
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
    if (!selectedStudentId || !freeChoiceSelected || freeChoiceBooking) return;
    setFreeChoiceBooking(true);
    setToast(null);

    // Close drawer immediately for optimistic UX
    const slot = freeChoiceSelected;
    setFreeChoiceOpen(false);
    setFreeChoiceSelected(null);
    setFreeChoiceSlots([]);
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

  const handleClosePreferences = () => {
    setPrefsOpen(false);
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
    setSelectedHistoryLesson(lesson);
    setHistoryDetailsOpen(true);
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

  const formatInstructorInitials = (name: string | null | undefined) => {
    if (!name) return 'Da assegnare';
    const parts = name.trim().split(/\s+/);
    if (parts.length < 2) return name;
    return `${parts[0]} ${parts[parts.length - 1][0]}.`;
  };


  // First pill auto-expanded until user interacts (collapsed if exam card visible)
  const effectiveExpandedId = userToggledRef.current
    ? expandedPillId
    : (expandedPillId ?? (nextExam ? null : upcoming[0]?.id ?? null));

  const PILL_COLORS = ['#FDE4F0', '#FEE8C8', '#EDE5FE', '#D5FAE5', '#FEF6CC'];
  const PILL_BORDERS = ['#F0A6C9', '#F2C48A', '#C5B0F0', '#82DBA8', '#F0DC7A'];
  const PILL_IMAGES = [
    require('../../assets/ducks/duck-vespa.png'),
    require('../../assets/ducks/duck-bike.png'),
    require('../../assets/ducks/duck-moto.png'),
    require('../../assets/ducks/duck-scooter.png'),
    require('../../assets/ducks/duck-f1.png'),
  ];

  return (
    <LinearGradient colors={['#FAE0EF', '#F8F7F4']} locations={[0, 0.5]} style={{ flex: 1 }}>
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


      {/* Status bar cover — content never shows under the notch */}
      <LinearGradient
        colors={['#FAE0EF', '#FAE0EF', 'rgba(250,224,239,0)']}
        locations={[0, 0.6, 1]}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top + 20, zIndex: 10 }}
        pointerEvents="none"
      />

      {/* ── Pill Stack ── */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.pillStack}
        showsVerticalScrollIndicator={false}
        scrollIndicatorInsets={{ top: insets.top }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* ── Header (scrolls with content) ── */}
        <View style={[styles.pillHeader, { paddingTop: insets.top - 20 }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.pillEyebrow}>Ciao {selectedStudent?.firstName ?? 'Allievo'}</Text>
            <Text style={styles.pillTitle}>LE TUE GUIDE</Text>
          </View>
          <View style={styles.pillHeaderBtns}>
            <Pressable
              onPress={() => router.push('/(tabs)/home/notifications')}
              style={({ pressed }) => [styles.pillBellBtn, pressed && { opacity: 0.7 }]}
            >
              <Ionicons name="notifications-outline" size={16} color="#1a120a" />
              {unreadNotifCount > 0 && <View style={styles.pillBellDot} />}
            </Pressable>
          </View>
        </View>

        {/* ── Filter tags ── */}
        <View style={styles.pillFiltersRow}>
          {activeCompanyName && (
            <View style={styles.pillFilterTag}>
              <Ionicons name="location-outline" size={11} color="#EC4899" />
              <Text style={styles.pillFilterTagText}>{activeCompanyName}</Text>
            </View>
          )}
          {isLockedToInstructor && assignedInstructorName && (
            <Animated.View entering={FadeIn.duration(300)} style={styles.pillFilterTag}>
              <Ionicons name="person-outline" size={11} color="#EC4899" />
              <Text style={styles.pillFilterTagText}>{assignedInstructorName}</Text>
            </Animated.View>
          )}
          {isLockedToInstructor && (
            <Animated.View entering={FadeIn.duration(300).delay(100)}>
            <Pressable
              disabled={weeklyAbsenceLoading || weeklyAbsenceDeclared}
              onPress={() => {
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
                    { text: 'Conferma', onPress: async () => {
                      setWeeklyAbsenceLoading(true);
                      try {
                        await regloApi.declareWeeklyAbsence({ weekStart: wsStr });
                        setWeeklyAbsenceDeclared(true);
                        setToast({ text: 'Assenza segnalata', tone: 'success' });
                      } catch { setToast({ text: 'Errore nella segnalazione', tone: 'danger' }); }
                      finally { setWeeklyAbsenceLoading(false); }
                    }},
                  ],
                );
              }}
              style={({ pressed }) => [
                styles.pillFilterTag,
                { borderWidth: 1, borderColor: weeklyAbsenceDeclared ? '#7ea968' : 'rgba(184,36,106,0.3)', backgroundColor: weeklyAbsenceDeclared ? '#ecf2e3' : 'rgba(255,255,255,0.6)' },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Ionicons name={weeklyAbsenceDeclared ? 'checkmark-circle' : 'calendar-clear-outline'} size={11} color={weeklyAbsenceDeclared ? '#7ea968' : '#EC4899'} />
              <Text style={[styles.pillFilterTagText, { color: weeklyAbsenceDeclared ? '#7ea968' : '#EC4899', fontWeight: '600' }]}>
                {weeklyAbsenceDeclared ? 'Assenza segnalata' : 'Segnala assenza'}
              </Text>
            </Pressable>
            </Animated.View>
          )}
        </View>

        {/* ── Exam Countdown Card ── */}
        {nextExam && examCountdown && (
          <Animated.View entering={FadeInUp.duration(500).delay(100)}>
            <View style={styles.examCard}>
              <View style={styles.examCardContent}>
                <View style={styles.examCardCountdown}>
                  <Text style={styles.examCardCountdownText}>{examCountdown.label}</Text>
                </View>
                <Text style={styles.examCardTitle}>Esame di guida</Text>
                <Text style={styles.examCardDate}>
                  {formatDay(nextExam.startsAt)} · {formatTime(nextExam.startsAt)}
                </Text>
              </View>
              <Image
                source={require('../../assets/duck-graduate.png')}
                style={styles.examCardDuck}
                resizeMode="contain"
              />
            </View>
          </Animated.View>
        )}

        {/* Skeleton while loading — only if no real data yet */}
        {upcoming.length === 0 && (!studentsLoaded || !studentDataReady) && (
          <>
            <View style={styles.pillSectionLabel}>
              <SkeletonBlock width={120} height={10} radius={5} />
            </View>
            {[0, 1, 2].map((i) => (
              <SkeletonBlock
                key={`pill-sk-${i}`}
                width="100%"
                height={i === 0 ? 140 : 66}
                radius={22}
              />
            ))}
          </>
        )}

        {/* Empty state — no upcoming lessons, data ready */}
        {upcoming.length === 0 && studentsLoaded && (appointmentsQuery.data != null) && (
          <View style={styles.pillEmpty}>
            <Image
              source={require('../../assets/duck-zen.png')}
              style={styles.pillEmptyImage}
              resizeMode="contain"
            />
            <Text style={styles.pillEmptyTitle}>Nessuna guida in programma</Text>
            <Text style={styles.pillEmptySub}>
              Prenota la tua prima guida e inizia il percorso verso la patente!
            </Text>
          </View>
        )}

        {/* Section: La prossima guida */}
        {upcoming.length > 0 && (
          <View style={styles.pillSectionLabel}>
            <View style={styles.pillPulseDot} />
            <Text style={styles.pillSectionText}>LA PROSSIMA GUIDA</Text>
          </View>
        )}

        {upcoming.map((lesson, idx) => {
          const isFirst = idx === 0;
          const isExpanded = effectiveExpandedId === lesson.id;
          // Cycle colors by position so adjacent pills always differ
          const pillIdx = idx % PILL_COLORS.length;
          const pillBg = PILL_COLORS[pillIdx];
          const pillBorder = PILL_BORDERS[pillIdx];
          const pillImg = PILL_IMAGES[pillIdx];
          const statusInfo = statusLabel(lesson.status);
          const isFutureActive = !['cancelled', 'completed', 'no_show'].includes(
            (lesson.status ?? '').trim().toLowerCase()
          );

          return (
            <React.Fragment key={lesson.id}>
              {idx === 1 && (
                <View style={[styles.pillSectionLabel, { paddingTop: 10 }]}>
                  <Text style={[styles.pillSectionText, { color: '#9CA3AF' }]}>IN PROGRAMMA</Text>
                </View>
              )}
              <Pressable
                onPress={() => {
                  userToggledRef.current = true;
                  setExpandedPillId(isExpanded ? null : lesson.id);
                }}
                style={[
                  styles.pillItem,
                  { backgroundColor: pillBg },
                  isFirst ? styles.pillItemNext : { ...styles.pillItemDefault, borderColor: pillBorder },
                ]}
              >
                {/* Header row */}
                <View style={styles.pillItemHeader}>
                  <Image source={pillImg} style={styles.pillAvatar} resizeMode="cover" />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.pillItemTitle} numberOfLines={1}>
                      {formatDay(lesson.startsAt)} · {formatTime(lesson.startsAt)}{lesson.endsAt ? ` \u2013 ${formatTime(lesson.endsAt)}` : ''}
                    </Text>
                    <Text style={styles.pillItemSub} numberOfLines={1}>
                      {lesson.instructor?.name ?? 'Da assegnare'}
                    </Text>
                  </View>
                  <View style={[styles.pillChevron, isExpanded && { transform: [{ rotate: '180deg' }] }]}>
                    <Ionicons name="chevron-down" size={14} color="#1a120a" />
                  </View>
                </View>

                {/* Expanded body — animated */}
                <Collapsible open={isExpanded}>
                  <View style={styles.pillBody}>
                    <View style={styles.pillDivider} />
                    <View style={styles.pillChipRow}>
                      <View style={styles.pillChip}>
                        <Text style={styles.pillChipText}>{lessonDurationMinutes(lesson)} min</Text>
                      </View>
                      <Badge label={statusInfo.label} tone={statusInfo.tone} />
                    </View>
                    <View style={styles.pillCtaRow}>
                      {isFutureActive && (bookingOptions?.swapEnabled ?? settings?.swapEnabled) && (
                        <Pressable
                          onPress={() => {
                            Alert.alert(
                              'Cerca sostituto',
                              'Vuoi creare una richiesta di scambio per questa guida?',
                              [
                                { text: 'Annulla', style: 'cancel' },
                                { text: 'Conferma', onPress: () => handleCreateSwap(lesson.id) },
                              ],
                            );
                          }}
                          disabled={creatingSwap}
                          style={({ pressed }) => [styles.pillCtaOutline, pressed && { opacity: 0.7 }, creatingSwap && { opacity: 0.5 }]}
                        >
                          <Text style={styles.pillCtaOutlineText}>{creatingSwap ? 'Invio...' : 'Cerca sostituto'}</Text>
                        </Pressable>
                      )}
                      {isFutureActive && canCancelAppointments && (
                        <Pressable
                          onPress={() => handleCancel(lesson.id)}
                          disabled={cancellingAppointmentId === lesson.id}
                          style={({ pressed }) => [styles.pillCtaFilled, pressed && { opacity: 0.7 }]}
                        >
                          <Text style={styles.pillCtaFilledText}>Annulla guida</Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                </Collapsible>
              </Pressable>
            </React.Fragment>
          );
        })}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* ── Fixed CTA: Prenota una guida (hidden if booking disabled) ── */}
      {bookingOptions && !studentBookingDisabledByPolicy && <Animated.View entering={FadeInUp.duration(400).delay(200)} style={[styles.pillFixedCta, { bottom: insets.bottom + 60 }]} pointerEvents="box-none">
        <LinearGradient
          colors={['rgba(248,247,244,0)', 'rgba(248,247,244,0.85)', '#F8F7F4']}
          locations={[0, 0.5, 1]}
          style={styles.pillFixedFade}
          pointerEvents="none"
        />
        <View style={styles.pillFixedCtaInner}>
          <Pressable
            onPress={openBookingFlow}
            style={({ pressed }) => [styles.pillBookBtn, pressed && { backgroundColor: 'rgba(214,48,127,0.06)', borderColor: 'rgba(214,48,127,0.7)' }]}
          >
            <View style={styles.pillBookIcon}>
              <Ionicons name="add" size={20} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.pillBookTitle}>Prenota una guida</Text>
              <Text style={styles.pillBookSub}>Scegli data, orario e istruttore</Text>
            </View>
            <Ionicons name="arrow-up" size={16} color="#EC4899" style={{ transform: [{ rotate: '45deg' }] }} />
          </Pressable>
        </View>
      </Animated.View>}
      {/* Solid bg behind tab bar — prevents items showing through */}
      <View style={[styles.pillTabBarBg, { height: insets.bottom + 70 }]} />
      {/* ── Unified Booking Flow BottomSheet ── */}
      <BottomSheet
        gradient
        visible={bookingFlowOpen}
        onClose={() => { if (!bookingLoading) setBookingFlowOpen(false); }}
        closeDisabled={bookingLoading}
        showHandle
        title={bookingStep === 1 ? 'Scegli il giorno' : formatDay(preferredDate.toISOString())}
        titleRight={bookingStep === 2 ? (
          <Pressable
            onPress={() => {
              setBookingStep(1);
              bookingScrollRef.current?.scrollTo({ x: 0, animated: true });
            }}
            style={({ pressed }) => [styles.bkBackBtn, pressed && { opacity: 0.7 }]}
          >
            <Ionicons name="calendar-outline" size={14} color="#EC4899" />
            <Text style={styles.bkBackBtnText}>Cambia</Text>
          </Pressable>
        ) : undefined}
        footer={bookingStep === 2 ? (
          <Pressable
            onPress={bookingLoading || !bookingSelectedSlot ? undefined : handleBookingConfirm}
            disabled={bookingLoading || !bookingSelectedSlot}
            style={[styles.chunkyPinkCta, (bookingLoading || !bookingSelectedSlot) && { opacity: 0.4 }]}
          >
            <Text style={styles.chunkyPinkCtaText}>
              {bookingLoading ? 'Attendi...' : 'Prenota \u2192'}
            </Text>
          </Pressable>
        ) : undefined}
      >
        <ScrollView
          ref={bookingScrollRef}
          horizontal
          pagingEnabled
          scrollEnabled={false}
          showsHorizontalScrollIndicator={false}
          style={{ marginHorizontal: -spacing.lg }}
        >
          {/* ── Step 1: Calendar ── */}
          <View style={{ width: screenWidth, paddingHorizontal: spacing.lg }}>
            {/* Month nav */}
            <View style={styles.bkMonthNav}>
              <Pressable
                onPress={() => setBookingMonth(new Date(bookingMonth.getFullYear(), bookingMonth.getMonth() - 1, 1))}
                disabled={!bookingCanPrev}
                style={[styles.bkMonthArrow, !bookingCanPrev && { opacity: 0.3 }]}
              >
                <Ionicons name="chevron-back" size={18} color="#1a120a" />
              </Pressable>
              <Text style={styles.bkMonthLabel}>{bookingMonthLabel}</Text>
              <Pressable
                onPress={() => setBookingMonth(new Date(bookingMonth.getFullYear(), bookingMonth.getMonth() + 1, 1))}
                disabled={!bookingCanNext}
                style={[styles.bkMonthArrow, !bookingCanNext && { opacity: 0.3 }]}
              >
                <Ionicons name="chevron-forward" size={18} color="#1a120a" />
              </Pressable>
            </View>

            {/* Weekday headers */}
            <View style={styles.bkWeekdayRow}>
              {BOOKING_WEEKDAYS.map((wd) => (
                <View key={wd} style={styles.bkWeekdayCell}>
                  <Text style={styles.bkWeekdayText}>{wd}</Text>
                </View>
              ))}
            </View>

            {/* Calendar grid */}
            <View style={styles.bkGrid}>
              {bookingGridCells.map((date, idx) => {
                const today = new Date(); today.setHours(0,0,0,0);
                const inMonth = date.getMonth() === bookingMonth.getMonth() && date.getFullYear() === bookingMonth.getFullYear();
                const isToday = date.getTime() === today.getTime();
                const isSelected = date.getFullYear() === preferredDate.getFullYear() && date.getMonth() === preferredDate.getMonth() && date.getDate() === preferredDate.getDate();
                const inRange = date >= today && date <= bookingMaxDate;
                const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
                const isUnavailable = inMonth && inRange && unavailableDatesSet.has(dateKey);
                const tappable = inMonth && inRange && !isUnavailable;
                const hasBooking = inMonth && bookedDatesSet.has(dateKey);

                return (
                  <Pressable
                    key={`bk-${idx}`}
                    onPress={tappable ? () => handleBookingDateSelect(date) : undefined}
                    disabled={!tappable}
                    style={styles.bkDayWrapper}
                  >
                    <View style={[
                      styles.bkDayCell,
                      isToday && styles.bkDayCellToday,
                      isSelected && styles.bkDayCellSelected,
                    ]}>
                      <Text style={[
                        styles.bkDayText,
                        !inMonth && { color: 'rgba(26,18,10,0.15)' },
                        isToday && styles.bkDayTextToday,
                        isSelected && styles.bkDayTextSelected,
                        (inMonth && (!inRange || isUnavailable)) && { color: 'rgba(26,18,10,0.25)' },
                      ]}>
                        {date.getDate()}
                      </Text>
                    </View>
                    {hasBooking ? <View style={[styles.bkDayDot, (isSelected || isToday) && { backgroundColor: '#fff' }]} /> : null}
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* ── Step 2: Options + Slots ── */}
          <View style={{ width: screenWidth, paddingHorizontal: spacing.lg }}>
            {/* Duration chips (if selectable) */}
            {availableDurations.length > 1 && (
              <View style={styles.bookingSection}>
                <Text style={styles.bookingSectionLabel}>DURATA</Text>
                <View style={styles.bookingChipRow}>
                  {availableDurations.map((dur) => {
                    const isActive = durationMinutes === dur;
                    const label = dur >= 60
                      ? dur === 60 ? '1 ora' : dur === 90 ? '1h 30' : `${dur / 60} ore`
                      : `${dur} min`;
                    return (
                      <Pressable
                        key={`bk-dur-${dur}`}
                        style={[styles.bookingChipChunky, isActive && styles.bookingChipChunkyActive]}
                        onPress={() => {
                          setDurationMinutes(dur);
                          // Re-fetch slots with new duration
                          handleBookingDateSelect(preferredDate);
                        }}
                      >
                        <Text style={isActive ? styles.bookingChipChunkyTextActive : styles.bookingChipChunkyText}>{label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Instructor selection / info */}
            {isLockedToInstructor && assignedInstructorName ? (
              <View style={[styles.bkInfoRow, { marginTop: availableDurations.length > 1 ? 12 : 0 }]}>
                <Ionicons name="person-outline" size={14} color="#9CA3AF" />
                <Text style={styles.bkInfoText}>{assignedInstructorName} · {durationMinutes} min</Text>
              </View>
            ) : canSelectInstructor && visibleInstructors.length > 0 ? (
              <View style={{ marginTop: 16, gap: 10 }}>
                <Text style={styles.bookingSectionLabel}>ISTRUTTORE</Text>
                <View style={styles.bookingChipRow}>
                  {visibleInstructors.length > 1 ? (
                    <Pressable
                      style={[styles.bookingChipChunky, !selectedInstructorId && styles.bookingChipChunkyActive]}
                      onPress={() => {
                        setSelectedInstructorId(null);
                        handleBookingDateSelect(preferredDate, null);
                      }}
                    >
                      <Text style={!selectedInstructorId ? styles.bookingChipChunkyTextActive : styles.bookingChipChunkyText}>
                        Tutti
                      </Text>
                    </Pressable>
                  ) : null}
                  {visibleInstructors.map((instructor) => {
                    const isActive = selectedInstructorId === instructor.id;
                    return (
                      <Pressable
                        key={`bk-instr-${instructor.id}`}
                        style={[styles.bookingChipChunky, isActive && styles.bookingChipChunkyActive]}
                        onPress={() => {
                          setSelectedInstructorId(instructor.id);
                          handleBookingDateSelect(preferredDate, instructor.id);
                        }}
                      >
                        <Text style={isActive ? styles.bookingChipChunkyTextActive : styles.bookingChipChunkyText}>
                          {instructor.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}

            {/* Slot list */}
            <Text style={[styles.bookingSectionLabel, { marginTop: 16, marginBottom: 10 }]}>ORARI DISPONIBILI</Text>
            {bookingSlotsLoading && bookingSlots.length === 0 ? (
              <View style={{ height: 280 }}>
                {[0, 1, 2, 3].map((i) => (
                  <View key={`sk-slot-${i}`} style={styles.timelineRow}>
                    <View style={styles.timelineLeft}>
                      <SkeletonBlock width={32} height={12} radius={6} />
                      {i < 3 && <View style={styles.timelineLine} />}
                    </View>
                    <View style={[styles.timelineCard, { borderColor: 'transparent' }]}>
                      <SkeletonBlock width="60%" height={16} radius={8} />
                    </View>
                  </View>
                ))}
              </View>
            ) : bookingSlots.length === 0 ? (
              <View style={{ height: 280, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="calendar-clear-outline" size={28} color="rgba(26,18,10,0.15)" />
                <Text style={[styles.bkInfoText, { marginTop: 8, textAlign: 'center' }]}>Nessun orario disponibile{'\n'}per questo giorno</Text>
              </View>
            ) : (
              <ScrollView style={{ height: 280 }} showsVerticalScrollIndicator={false}>
                <View style={styles.timelineContainer}>
                  {bookingSlots.map((slot, index) => {
                    const isActive = bookingSelectedSlot?.startsAt === slot.startsAt;
                    const isLast = index === bookingSlots.length - 1;
                    return (
                      <View key={slot.startsAt} style={styles.timelineRow}>
                        <View style={styles.timelineLeft}>
                          <Text style={styles.timelineHour}>{formatTime(slot.startsAt)}</Text>
                          {!isLast ? <View style={styles.timelineLine} /> : null}
                        </View>
                        <Pressable
                          style={[styles.timelineCard, isActive && styles.timelineCardActive]}
                          onPress={() => setBookingSelectedSlot(slot)}
                        >
                          <Text style={isActive ? styles.timelineCardTextActive : styles.timelineCardText}>
                            {formatTime(slot.startsAt)} – {formatTime(slot.endsAt)}
                          </Text>
                          {slot.instructorName ? (
                            <Text style={[isActive ? styles.timelineCardTextActive : styles.timelineCardText, { fontSize: 12, fontWeight: '400', flex: 0 }]}>
                              {slot.instructorName}
                            </Text>
                          ) : null}
                          {isActive ? (
                            <View style={styles.timelineCheck}>
                              <Text style={styles.timelineCheckText}>{'\u2713'}</Text>
                            </View>
                          ) : null}
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              </ScrollView>
            )}
          </View>
        </ScrollView>
      </BottomSheet>
      {/* ── Lesson Detail BottomSheet ── */}
      <BottomSheet
        visible={historyDetailsOpen && !!selectedHistoryLesson}
        onClose={() => setHistoryDetailsOpen(false)}
        title="Dettaglio guida"
        showHandle
        gradient
      >
        {selectedHistoryLesson ? (
          <>
            {/* Hero info card */}
            <View style={styles.chunkyHeroCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={styles.chunkyHeroTitle}>
                  {formatDay(selectedHistoryLesson.startsAt)} {'\u2022'} {formatTime(selectedHistoryLesson.startsAt)}
                </Text>
                <View style={[styles.chunkyStatusPill, { backgroundColor: '#FEF9C3' }]}>
                  <Text style={[styles.chunkyStatusPillText, { color: '#CA8A04' }]}>
                    {statusLabel(selectedHistoryLesson.status).label.toUpperCase()}
                  </Text>
                </View>
              </View>
              <Text style={styles.chunkyHeroSub}>
                Durata: {lessonDurationMinutes(selectedHistoryLesson)} min
              </Text>
            </View>

            {/* Icon rows */}
            <View style={{ gap: 16 }}>
              {/* Instructor */}
              <View style={styles.chunkyIconRow}>
                <View style={[styles.chunkyIconCircle, { backgroundColor: '#EFF6FF' }]}>
                  <Ionicons name="person-outline" size={18} color="#3B82F6" />
                </View>
                <View>
                  <Text style={styles.chunkyRowLabel}>ISTRUTTORE</Text>
                  <Text style={styles.chunkyRowValue}>
                    {selectedHistoryLesson.instructor?.name ?? 'Da assegnare'}
                  </Text>
                  {selectedHistoryLesson.instructor?.phone ? (
                    <Pressable
                      onPress={() =>
                        Linking.openURL(`tel:${selectedHistoryLesson.instructor!.phone}`)
                      }
                    >
                      <Text style={styles.chunkyRowPhone}>
                        {selectedHistoryLesson.instructor.phone}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>

              {/* Vehicle */}
              {settings?.vehiclesEnabled !== false && (
                <View style={styles.chunkyIconRow}>
                  <View style={[styles.chunkyIconCircle, { backgroundColor: '#FEF9C3' }]}>
                    <Ionicons name="car-outline" size={18} color="#CA8A04" />
                  </View>
                  <View>
                    <Text style={styles.chunkyRowLabel}>VEICOLO</Text>
                    <Text style={styles.chunkyRowValue}>
                      {selectedHistoryLesson.vehicle?.name ?? 'Da assegnare'}
                    </Text>
                  </View>
                </View>
              )}

              {/* Payment */}
              <View style={styles.chunkyIconRow}>
                <View style={[styles.chunkyIconCircle, { backgroundColor: '#FCE7F3' }]}>
                  <Ionicons name="wallet-outline" size={18} color="#EC4899" />
                </View>
                <View>
                  <Text style={styles.chunkyRowLabel}>PAGAMENTO</Text>
                  {selectedHistoryPayment ? (
                    <Text style={[styles.chunkyRowValue, { fontStyle: 'italic', color: '#64748B' }]}>
                      {paymentStatusLabel(selectedHistoryPayment.paymentStatus).label}
                      {selectedHistoryPayment.dueAmount > 0
                        ? ` \u2022 Residuo \u20AC ${selectedHistoryPayment.dueAmount.toFixed(2)}`
                        : ''}
                    </Text>
                  ) : (
                    <Text style={[styles.chunkyRowValue, { fontStyle: 'italic', color: '#64748B' }]}>
                      Nessun dettaglio disponibile
                    </Text>
                  )}
                </View>
              </View>
            </View>

            {/* Swap + Cancel buttons — only for upcoming confirmed lessons */}
            {upcomingConfirmedStatuses.has(
              (selectedHistoryLesson.status ?? '').trim().toLowerCase(),
            ) &&
            new Date(selectedHistoryLesson.startsAt).getTime() > Date.now() ? (
              <>
                {(bookingOptions?.swapEnabled ?? settings?.swapEnabled) &&
                  ['scheduled', 'confirmed'].includes(
                    (selectedHistoryLesson.status ?? '').trim().toLowerCase(),
                  ) ? (
                  <Pressable
                    style={[styles.detailSwapBtn, creatingSwap && { opacity: 0.5 }]}
                    onPress={() => {
                      const id = selectedHistoryLesson.id;
                      setHistoryDetailsOpen(false);
                      setTimeout(() => handleCreateSwap(id), 350);
                    }}
                    disabled={creatingSwap}
                  >
                    <Text style={{ fontSize: 16 }}>🤝</Text>
                    <Text style={styles.detailSwapText}>
                      {creatingSwap ? 'Invio richiesta...' : 'Cerca sostituto'}
                    </Text>
                  </Pressable>
                ) : null}
                {canCancelAppointments && (
                <Pressable
                  style={[styles.detailCancelBtn, cancellingAppointmentId === selectedHistoryLesson.id && { opacity: 0.5 }]}
                  onPress={() => {
                    const id = selectedHistoryLesson.id;
                    setHistoryDetailsOpen(false);
                    setTimeout(() => handleCancel(id), 350);
                  }}
                  disabled={cancellingAppointmentId === selectedHistoryLesson.id}
                >
                  <Ionicons name="close-circle-outline" size={16} color="#DC2626" />
                  <Text style={styles.detailCancelText}>
                    {cancellingAppointmentId === selectedHistoryLesson.id
                      ? 'Annullamento...'
                      : 'Annulla guida'}
                  </Text>
                </Pressable>
                )}
              </>
            ) : null}
          </>
        ) : null}
      </BottomSheet>
      {/* ── Booking Preferences BottomSheet ── */}
      <BottomSheet
        gradient
        visible={prefsOpen}
        onClose={handleClosePreferences}
        onClosed={() => {
          if (pendingFreeChoiceOpen) {
            setFreeChoiceOpen(true);
            setPendingFreeChoiceOpen(false);
          }
        }}
        title="Prenota guida"
        closeDisabled={bookingLoading}
        showHandle
        titleRight={
          (paymentProfile?.autoPaymentsEnabled || creditFlowEnabled) ? (
            <View style={styles.bookingCreditsBadge}>
              <Text style={styles.bookingCreditsBadgeText}>
                Crediti: {paymentProfile?.lessonCreditsAvailable ?? 0}
              </Text>
            </View>
          ) : undefined
        }
        footer={
          <>
            {!preferredDateAvailable ? (
              <Text style={styles.bookingUnavailableCaption}>
                Nessuna disponibilità per il giorno selezionato
              </Text>
            ) : null}
            <Pressable
              onPress={bookingLoading || !preferredDateAvailable ? undefined : handleBookingRequest}
              disabled={bookingLoading || !preferredDateAvailable}
              style={[styles.chunkyPinkCta, (bookingLoading || !preferredDateAvailable) && { opacity: 0.5 }]}
            >
              <Text style={styles.chunkyPinkCtaText}>
                {bookingLoading ? 'Attendi...' : 'Prenota \u2192'}
              </Text>
            </Pressable>
          </>
        }
      >
        {/* GIORNO */}
        <View style={styles.bookingSection}>
          <Text style={styles.bookingSectionLabel}>GIORNO</Text>
          <Pressable
            style={({ pressed }) => [styles.bookingDateCardChunky, pressed && { opacity: 0.85 }]}
            onPress={() => {
              setPrefsOpen(false);
              setTimeout(() => setBookingCalendarOpen(true), 350);
            }}
          >
            <View style={styles.bookingDateIconLg}>
              <Ionicons name="calendar" size={20} color="#ec4899" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.bookingDateMainText}>
                {formatDay(preferredDate.toISOString())}
              </Text>
              <Text style={styles.bookingDateHint}>Scegli quando guidare</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </Pressable>
        </View>

        {/* DURATA */}
        <View style={styles.bookingSection}>
          <Text style={styles.bookingSectionLabel}>DURATA</Text>
          {availableDurations.length === 1 ? (
            <Text style={styles.bookingDurationSingle}>{availableDurations[0]} min</Text>
          ) : (
            <View style={styles.bookingChipRow}>
              {availableDurations.map((duration) => {
                const isActive = durationMinutes === duration;
                const label = duration >= 60
                  ? duration === 60 ? '1 ora' : duration === 90 ? '1 ora e mezza' : `${duration / 60} ore`
                  : `${duration} min`;
                return (
                  <Pressable
                    key={`duration-${duration}`}
                    style={[styles.bookingChipChunky, isActive && styles.bookingChipChunkyActive]}
                    onPress={() => setDurationMinutes(duration)}
                  >
                    <Text style={isActive ? styles.bookingChipChunkyTextActive : styles.bookingChipChunkyText}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        {/* TIPO GUIDA */}
        {canSelectLessonType ? (
          <View style={styles.bookingSection}>
            <Text style={styles.bookingSectionLabel}>TIPO GUIDA</Text>
            <View style={styles.bookingChipRow}>
              {availableLessonTypes.map((lessonType) => {
                const isActive = selectedLessonTypes.includes(lessonType);
                return (
                  <Pressable
                    key={`type-${lessonType}`}
                    style={[styles.bookingChipChunky, isActive && styles.bookingChipChunkyActive]}
                    onPress={() => {
                      setSelectedLessonTypes((prev) => {
                        if (prev.includes(lessonType)) {
                          const next = prev.filter((t) => t !== lessonType);
                          return next.length ? next : [lessonType];
                        }
                        return [...prev, lessonType];
                      });
                    }}
                  >
                    <Text style={isActive ? styles.bookingChipChunkyTextActive : styles.bookingChipChunkyText}>
                      {formatLessonType(lessonType)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        {/* ISTRUTTORE */}
        {isLockedToInstructor && assignedInstructorName ? (
          <View style={styles.bookingSection}>
            <Text style={styles.bookingSectionLabel}>ISTRUTTORE</Text>
            <View style={styles.bookingChipRow}>
              <View style={[styles.bookingChipChunky, styles.bookingChipChunkyActive, { opacity: 1 }]}>
                <Text style={styles.bookingChipChunkyTextActive}>
                  {assignedInstructorName}
                </Text>
              </View>
            </View>
            <Text style={styles.bookingInstructorCaption}>
              Istruttore assegnato dal tuo cluster.
            </Text>
          </View>
        ) : canSelectInstructor && visibleInstructors.length > 0 ? (
          <View style={styles.bookingSection}>
            <Text style={styles.bookingSectionLabel}>ISTRUTTORE</Text>
            <View style={styles.bookingChipRow}>
              {visibleInstructors.length > 1 ? (
                <Pressable
                  style={[styles.bookingChipChunky, !selectedInstructorId && styles.bookingChipChunkyActive]}
                  onPress={() => setSelectedInstructorId(null)}
                >
                  <Text style={!selectedInstructorId ? styles.bookingChipChunkyTextActive : styles.bookingChipChunkyText}>
                    Tutti
                  </Text>
                </Pressable>
              ) : null}
              {visibleInstructors.map((instructor) => {
                const isActive = selectedInstructorId === instructor.id;
                return (
                  <Pressable
                    key={`instr-${instructor.id}`}
                    style={[styles.bookingChipChunky, isActive && styles.bookingChipChunkyActive]}
                    onPress={() => setSelectedInstructorId(instructor.id)}
                  >
                    <Text style={isActive ? styles.bookingChipChunkyTextActive : styles.bookingChipChunkyText}>
                      {instructor.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.bookingInstructorCaption}>
              {visibleInstructors.length < instructors.length
                ? 'Solo gli istruttori disponibili per questo giorno.'
                : 'Se non scegli, vedrai proposte con tutti gli istruttori.'}
            </Text>
          </View>
        ) : null}
      </BottomSheet>
      <CalendarDrawer
        visible={bookingCalendarOpen}
        onClose={() => {
          setBookingCalendarOpen(false);
          setTimeout(() => setPrefsOpen(true), 350);
        }}
        bookedDates={bookedDatesSet}
        unavailableDates={unavailableDatesSet}
        onSelectDate={(date) => {
          setPreferredDate(date);
          setBookingCalendarOpen(false);
          setTimeout(() => setPrefsOpen(true), 350);
        }}
        selectedDate={preferredDate}
        maxWeeks={Number(settings?.availabilityWeeks) || 4}
      />
      <CalendarDrawer
        visible={calendarDrawerOpen}
        onClose={() => setCalendarDrawerOpen(false)}
        onSelectDate={(date) => setSelectedDate(date)}
        selectedDate={selectedDate}
        maxWeeks={Number(settings?.availabilityWeeks) || 4}
        bookedDates={bookedDatesSet}
      />
      {/* ── Free Choice Slot Picker BottomSheet ── */}
      <BottomSheet
        gradient
        visible={freeChoiceOpen}
        onClose={() => {
          if (!freeChoiceBooking) {
            setFreeChoiceOpen(false);
            setFreeChoiceSelected(null);
          }
        }}
        title="Scegli un orario"
        closeDisabled={freeChoiceBooking}
        showHandle
        footer={
          <Pressable
            onPress={freeChoiceBooking || !freeChoiceSelected ? undefined : handleConfirmFreeChoiceSlot}
            disabled={freeChoiceBooking || !freeChoiceSelected}
            style={[
              styles.chunkyPinkCta,
              (freeChoiceBooking || !freeChoiceSelected) && { opacity: 0.5 },
            ]}
          >
            <Text style={styles.chunkyPinkCtaText}>
              {freeChoiceBooking ? 'Attendi...' : 'Prenota'}
            </Text>
          </Pressable>
        }
      >
        <Text style={styles.timelineSubtitle}>
          {formatDay(preferredDate.toISOString())} {'\u2022'} {durationMinutes} min
        </Text>
        <ScrollView
          style={{ maxHeight: 380 }}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.timelineContainer}>
            {freeChoiceSlots.map((slot, index) => {
              const isActive = freeChoiceSelected?.startsAt === slot.startsAt;
              const isLast = index === freeChoiceSlots.length - 1;
              return (
                <View key={slot.startsAt} style={styles.timelineRow}>
                  <View style={styles.timelineLeft}>
                    <Text style={styles.timelineHour}>{formatTime(slot.startsAt)}</Text>
                    {!isLast ? <View style={styles.timelineLine} /> : null}
                  </View>
                  <Pressable
                    style={[styles.timelineCard, isActive && styles.timelineCardActive]}
                    onPress={() => setFreeChoiceSelected(slot)}
                  >
                    <Text style={isActive ? styles.timelineCardTextActive : styles.timelineCardText}>
                      {formatTime(slot.startsAt)} – {formatTime(slot.endsAt)}
                    </Text>
                    {isActive ? (
                      <View style={styles.timelineCheck}>
                        <Text style={styles.timelineCheckText}>{'\u2713'}</Text>
                      </View>
                    ) : null}
                  </Pressable>
                </View>
              );
            })}
          </View>
        </ScrollView>
      </BottomSheet>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  /* ── Pill List Layout ── */
  pillBlob: {
    position: 'absolute',
    top: -120,
    left: -80,
    width: 360,
    height: 360,
    borderRadius: 180,
    backgroundColor: '#fbd6e6',
    opacity: 0.7,
  },
  pillHeader: {
    paddingHorizontal: 14,
    paddingBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 1,
  },
  pillEyebrow: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: '#EC4899',
    marginBottom: 8,
  },
  pillTitle: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -1,
    color: '#1a120a',
    textTransform: 'uppercase',
  },
  pillHeaderBtns: {
    flexDirection: 'row',
    gap: 8,
  },
  pillAbsenceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(26,18,10,0.10)',
  },
  pillAbsenceBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1a120a',
  },
  pillBellBtn: {
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(26,18,10,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1a120a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  pillBellDot: {
    position: 'absolute',
    top: 9,
    right: 11,
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#ec4899',
    borderWidth: 2,
    borderColor: '#fff',
  },
  pillSearchBtn: {
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: '#ec4899',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#d6307f',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 6,
  },
  pillFiltersRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    paddingHorizontal: 14,
    marginBottom: 4,
    minHeight: 28,
  },
  pillFilterTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.12)',
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  pillFilterTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1a120a',
    letterSpacing: 0.2,
  },
  pillEmpty: {
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 30,
    gap: 6,
  },
  pillEmptyImage: {
    width: 220,
    height: 220,
    opacity: 0.85,
  },
  pillEmptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a120a',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  pillEmptySub: {
    fontSize: 14,
    fontWeight: '400',
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 20,
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

  pillTopFade: {
    left: 0,
    right: 0,
    height: 40,
    zIndex: 2,
    marginBottom: -40,
  },
  pillStack: {
    paddingHorizontal: 14,
    paddingBottom: 30,
    gap: 16,
  },
  pillSectionLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  pillPulseDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: '#ec4899',
  },
  pillSectionText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: '#EC4899',
  },
  pillItem: {
    borderRadius: 22,
    shadowColor: '#9c8a76',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 6,
  },
  pillItemDefault: {
    borderWidth: 2,
    borderColor: 'rgba(26,18,10,0.08)',
  },
  pillItemNext: {
    shadowColor: '#d6307f',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 6,
    borderWidth: 2,
    borderColor: '#ec4899',
  },
  pillItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  pillAvatar: {
    width: 38,
    height: 38,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  pillItemTitle: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
    color: '#1a120a',
  },
  pillItemSub: {
    fontSize: 11,
    fontWeight: '400',
    color: 'rgba(0,0,0,0.65)',
    marginTop: 1,
  },
  pillChevron: {
    width: 30,
    height: 30,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillBody: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  pillDivider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.10)',
    marginBottom: 12,
  },
  pillChipRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 14,
    alignItems: 'center',
  },
  pillChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  pillChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#1a120a',
  },
  pillCtaRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  pillCtaOutline: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.18)',
  },
  pillCtaOutlineText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1a120a',
  },
  pillCtaFilled: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: '#1a120a',
  },
  pillCtaFilledText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  pillTabBarBg: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#F8F7F4',
    zIndex: 4,
  },
  pillFixedCta: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 5,
  },
  pillFixedFade: {
    height: 40,
  },
  pillFixedCtaInner: {
    backgroundColor: '#F8F7F4',
    paddingHorizontal: 18,
    paddingBottom: 14,
  },
  pillBookBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 28,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(214,48,127,0.45)',
  },
  pillBookIcon: {
    width: 42,
    height: 42,
    borderRadius: 999,
    backgroundColor: '#ec4899',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#d6307f',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.55,
    shadowRadius: 14,
    elevation: 6,
  },
  pillBookTitle: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
    color: '#1a120a',
  },
  pillBookSub: {
    fontSize: 12,
    color: '#6b5444',
    marginTop: 2,
  },

  /* ── Legacy (kept for BottomSheets) ── */
  content: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    gap: spacing.lg,
    paddingBottom: spacing.xxl * 2 + spacing.md,
  },

  /* ── Header ── */
  header: {
    gap: 4,
    paddingRight: 56,
  },
  title: {
    ...typography.title,
    color: '#1E293B',
  },
  subtitle: {
    ...typography.body,
    color: '#64748B',
    marginTop: 2,
  },

  /* ── Exam Countdown Card ── */
  examCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F3FF',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#DDD6FE',
    paddingLeft: 18,
    paddingVertical: 8,
    paddingRight: 4,
    gap: 8,
    shadowColor: '#8B5CF6',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  examCardContent: {
    flex: 1,
    gap: 4,
  },
  examCardCountdown: {
    alignSelf: 'flex-start',
    backgroundColor: '#8B5CF6',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  examCardCountdownText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  examCardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1a120a',
    letterSpacing: -0.2,
  },
  examCardDate: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8B5CF6',
  },
  examCardDuck: {
    width: 200,
    height: 200,
    marginRight: -45,
    marginTop: -50,
    marginBottom: -70,
  },

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

  /* ── Next Lesson Card (yellow) ── */
  nextLessonShadow: {
    borderRadius: radii.lg,
    shadowColor: '#B45309',
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  nextLessonDuck: {
    position: 'absolute',
    top: -49.5,
    right: 20,
    width: 80,
    height: 50,
    zIndex: 10,
  },
  nextLessonCard: {
    borderRadius: radii.lg,
    padding: 22,
    gap: 8,
    overflow: 'hidden',
  },
  inProgressBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: 'rgba(22, 163, 74, 0.15)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  inProgressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#16A34A',
  },
  inProgressBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#15803D',
    letterSpacing: 0.6,
  },
  nextLessonLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    color: '#FFFFFF',
    textTransform: 'uppercase',
    textShadowColor: 'rgba(120, 53, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  nextLessonDateTime: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
    textShadowColor: 'rgba(120, 53, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  nextLessonDetails: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
    textShadowColor: 'rgba(120, 53, 0, 0.25)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  nextLessonActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  nextLessonSwapPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  nextLessonSwapEmoji: {
    fontSize: 13,
  },
  nextLessonSwapText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    textShadowColor: 'rgba(120, 53, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  nextLessonCancelPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  nextLessonCancelText: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.7)',
  },
  nextLessonSlot: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 16,
    padding: 14,
    gap: 8,
  },
  nextLessonSlotHeader: {
    gap: 2,
  },
  nextLessonSlotTime: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    textShadowColor: 'rgba(120, 53, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  nextLessonSlotDetails: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.85)',
    textShadowColor: 'rgba(120, 53, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  emptyLessonCard: {
    borderRadius: radii.lg,
    borderWidth: 2,
    borderColor: '#FACC15',
    borderStyle: 'dashed',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    paddingHorizontal: spacing.lg,
    gap: 8,
  },
  emptyLessonImage: {
    width: 200,
    height: 125,
  },
  emptyLessonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ACABB2',
    fontStyle: 'italic',
  },

  /* ── CTA Button ── */
  ctaButton: {
    backgroundColor: '#EC4899',
    borderRadius: radii.sm,
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    shadowColor: '#EC4899',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  ctaButtonPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.92,
  },
  ctaButtonDisabled: {
    opacity: 0.5,
  },
  ctaButtonLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  /* ── Calendar Section ── */
  calendarSection: {
    gap: spacing.sm,
  },
  calendarMonthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  calendarMonthTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
  },
  calendarIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayPillsRow: {
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  dayPill: {
    width: 58,
    height: 72,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  dayPillSelected: {
    backgroundColor: '#FCE7F3',
    borderWidth: 2,
    borderColor: '#EC4899',
    shadowColor: '#EC4899',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  dayPillUnselected: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dayPillToday: {
    backgroundColor: '#FEF9C3',
    borderWidth: 2,
    borderColor: '#FACC15',
    shadowColor: '#D97706',
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  dayPillWeekday: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  dayPillWeekdaySelected: {
    color: '#BE185D',
  },
  dayPillWeekdayUnselected: {
    color: '#94A3B8',
  },
  dayPillWeekdayToday: {
    color: '#CA8A04',
  },
  dayPillNumber: {
    fontSize: 20,
    fontWeight: '700',
  },
  dayPillNumberSelected: {
    color: '#BE185D',
  },
  dayPillNumberUnselected: {
    color: '#1E293B',
  },
  dayPillNumberToday: {
    color: '#CA8A04',
  },

  dayPillDot: {
    position: 'absolute',
    bottom: 8,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EC4899',
  },
  dayPillDotHighlight: {
    backgroundColor: '#FFFFFF',
  },
  dayPillHoliday: {
    backgroundColor: '#FEE2E2',
    borderWidth: 2,
    borderColor: '#FCA5A5',
  },
  dayPillWeekdayHoliday: {
    color: '#DC2626',
  },
  dayPillNumberHoliday: {
    color: '#DC2626',
  },
  dayPillHolidayDot: {
    position: 'absolute' as const,
    bottom: 8,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#DC2626',
  },
  detailCancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginTop: 8,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'rgba(220, 38, 38, 0.2)',
    backgroundColor: 'rgba(220, 38, 38, 0.04)',
  },
  detailCancelText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#DC2626',
  },
  detailSwapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginTop: 20,
    marginBottom: 0,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'rgba(146, 64, 14, 0.25)',
    backgroundColor: 'rgba(146, 64, 14, 0.06)',
  },
  detailSwapText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#92400E',
  },
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
    shadowColor: pink[300],
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
  chunkyHeroCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 24,
    padding: 20,
    gap: 6,
  },
  chunkyHeroTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  chunkyHeroSub: {
    fontSize: 14,
    fontWeight: '400',
    color: '#94A3B8',
  },
  chunkyStatusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chunkyStatusPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  chunkyIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  chunkyIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chunkyRowLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chunkyRowValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
  },
  chunkyRowPhone: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3B82F6',
    marginTop: 2,
  },
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
    backgroundColor: '#1a120a',
    height: 54,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1a120a',
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
    gap: 10,
  },
  bookingSectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#EC4899',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
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
    height: 44,
    paddingHorizontal: 20,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: 'rgba(26,18,10,0.10)',
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
    color: '#9CA3AF',
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
