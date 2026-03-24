import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  Image,
  Linking,
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
import {
  AutoscuolaAppointmentWithRelations,
  MobileAppointmentPaymentDocument,
  AvailableSlot,
  MobileBookingOptions,
  MobileStudentPaymentProfile,
  AutoscuolaStudent,
  AutoscuolaSettings,
  StudentAppointmentPaymentHistoryItem,
  AutoscuolaWaitlistOfferWithSlot,
} from '../types/regloApi';
import { colors, radii, spacing, typography } from '../theme';
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
const proposalStatuses = new Set(['proposal']);
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
  if (status === 'no_show') return { label: 'No-show', tone: 'danger' as const };
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
  const { height: windowHeight, width: screenWidth } = useWindowDimensions();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const { user } = useSession();
  const [students, setStudents] = useState<AutoscuolaStudent[]>([]);
  const [studentsLoaded, setStudentsLoaded] = useState(false);
  const [appointments, setAppointments] = useState<AutoscuolaAppointmentWithRelations[]>([]);
  const [settings, setSettings] = useState<AutoscuolaSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ text: string; tone: ToastTone } | null>(null);

  const [preferredDate, setPreferredDate] = useState(new Date());
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [selectedLessonType, setSelectedLessonType] = useState<string>(
    DEFAULT_BOOKING_LESSON_TYPES[0],
  );
  const [bookingOptions, setBookingOptions] = useState<MobileBookingOptions | null>(null);
  const [suggestion, setSuggestion] = useState<{ startsAt: string; endsAt: string } | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [proposalLoading, setProposalLoading] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [cancellingAppointmentId, setCancellingAppointmentId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [bookingRequestId, setBookingRequestId] = useState<string | null>(null);
  const [paymentProfile, setPaymentProfile] = useState<MobileStudentPaymentProfile | null>(null);
  const [paymentHistory, setPaymentHistory] = useState<StudentAppointmentPaymentHistoryItem[]>([]);
  const [historyDetailsOpen, setHistoryDetailsOpen] = useState(false);
  const [selectedHistoryLesson, setSelectedHistoryLesson] =
    useState<AutoscuolaAppointmentWithRelations | null>(null);
  const [historyDocumentBusy, setHistoryDocumentBusy] = useState<'view' | 'share' | null>(null);
  const [payNowLoading, setPayNowLoading] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [pendingSuggestionOpen, setPendingSuggestionOpen] = useState(false);
  const [waitlistOffer, setWaitlistOffer] = useState<AutoscuolaWaitlistOfferWithSlot | null>(null);
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const [waitlistLoading, setWaitlistLoading] = useState(false);
  const [proposalAppointmentOpen, setProposalAppointmentOpen] = useState(false);
  const [proposalAppointmentLoading, setProposalAppointmentLoading] = useState(false);
  const [calendarRange, setCalendarRange] = useState<CalendarNavigatorRange | null>(null);
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [calendarDrawerOpen, setCalendarDrawerOpen] = useState(false);
  const [bookingCalendarOpen, setBookingCalendarOpen] = useState(false);
  const [freeChoiceSlots, setFreeChoiceSlots] = useState<AvailableSlot[]>([]);
  const [freeChoiceOpen, setFreeChoiceOpen] = useState(false);
  const [freeChoiceSelected, setFreeChoiceSelected] = useState<AvailableSlot | null>(null);
  const [freeChoiceBooking, setFreeChoiceBooking] = useState(false);
  const [pendingFreeChoiceOpen, setPendingFreeChoiceOpen] = useState(false);
  const dayScrollRef = useRef<ScrollView | null>(null);
  const [showAllAgendaLessons, setShowAllAgendaLessons] = useState(false);
  const [rangeLoading, setRangeLoading] = useState(false);
  const [bookingCelebrationVisible, setBookingCelebrationVisible] = useState(false);
  const [studentDataReady, setStudentDataReady] = useState(false);
  const rangeKeyRef = useRef<string | null>(null);
  const loadRequestRef = useRef(0);
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

  const openPreferences = () => {
    if (settings?.appBookingActors === 'instructors') {
      setToast({
        text: 'Le prenotazioni da app sono gestite dagli istruttori per questa autoscuola.',
        tone: 'info',
      });
      return;
    }
    setPrefsOpen(true);
  };

  const selectedStudent = useMemo(
    () => findLinkedStudent(students, user),
    [students, user]
  );
  const selectedStudentId = selectedStudent?.id ?? null;
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
  const hasLessonCredits = (paymentProfile?.lessonCreditsAvailable ?? 0) > 0;
  const creditFlowEnabled = paymentProfile?.lessonCreditFlowEnabled ?? false;
  const studentBookingDisabledByPolicy = settings?.appBookingActors === 'instructors';
  const requiresPaymentMethodForBooking = Boolean(
    paymentProfile?.autoPaymentsEnabled &&
      !creditFlowEnabled &&
      !paymentProfile?.hasPaymentMethod &&
      !hasLessonCredits
  );
  const requiresCreditsForBooking = Boolean(
    creditFlowEnabled &&
      !paymentProfile?.autoPaymentsEnabled &&
      !hasLessonCredits
  );

  const loadStudents = useCallback(async () => {
    const list = await regloApi.getStudents();
    setStudents(list);
    setStudentsLoaded(true);
    return list;
  }, []);

  const loadData = useCallback(
    async (studentId: string) => {
      const requestId = ++loadRequestRef.current;
      setLoading(true);
      setToast(null);
      let shouldShowRangeSkeleton = false;
      try {
        const defaultFrom = addDays(new Date(), -7);
        defaultFrom.setHours(0, 0, 0, 0);
        const defaultTo = addDays(new Date(), 30);
        defaultTo.setHours(23, 59, 59, 999);

        const selectedFrom = calendarRange ? new Date(calendarRange.from) : new Date(defaultFrom);
        selectedFrom.setHours(0, 0, 0, 0);
        const selectedTo = calendarRange ? new Date(calendarRange.to) : new Date(defaultTo);
        selectedTo.setHours(23, 59, 59, 999);

        const from =
          selectedFrom.getTime() < defaultFrom.getTime() ? selectedFrom : defaultFrom;
        const to = selectedTo.getTime() > defaultTo.getTime() ? selectedTo : defaultTo;

        const rangeKey = `${selectedFrom.toISOString()}|${selectedTo.toISOString()}`;
        if (rangeKeyRef.current !== rangeKey) {
          shouldShowRangeSkeleton = true;
          setRangeLoading(true);
        }
        rangeKeyRef.current = rangeKey;

        const [appointmentsResponse, settingsResponse, paymentResponse, paymentHistoryResponse] =
          await Promise.all([
          regloApi.getAppointments({
            studentId,
            from: from.toISOString(),
            to: to.toISOString(),
            limit: 280,
            light: true,
          }),
          regloApi.getAutoscuolaSettings(),
          regloApi.getPaymentProfile(),
          regloApi.getPaymentHistory(40),
        ]);
        if (requestId !== loadRequestRef.current) {
          return;
        }

        const studentCanBookFromApp = settingsResponse.appBookingActors !== 'instructors';
        let bookingOptionsResponse: MobileBookingOptions | null = null;
        if (studentCanBookFromApp) {
          bookingOptionsResponse = await regloApi.getBookingOptions(studentId).catch(() => null);
          if (requestId !== loadRequestRef.current) {
            return;
          }
        }

        setAppointments(appointmentsResponse.filter((item) => item.studentId === studentId));
        setSettings(settingsResponse);
        setPaymentProfile(paymentResponse);
        setPaymentHistory(paymentHistoryResponse);
        const resolvedBookingOptions: MobileBookingOptions = bookingOptionsResponse ?? {
          bookingSlotDurations: settingsResponse.bookingSlotDurations ?? [30, 60],
          lessonTypeSelectionEnabled: studentCanBookFromApp && Boolean(settingsResponse.lessonPolicyEnabled),
          availableLessonTypes: studentCanBookFromApp && settingsResponse.lessonPolicyEnabled
            ? [...DEFAULT_BOOKING_LESSON_TYPES]
            : [],
        };
        setBookingOptions(resolvedBookingOptions);
        const sortedDurations = (resolvedBookingOptions.bookingSlotDurations ?? [30, 60])
          .slice()
          .sort((a, b) => a - b);
        setDurationMinutes((current) =>
          sortedDurations.includes(current) ? current : sortedDurations[0] ?? 60,
        );
        const availableTypes = (resolvedBookingOptions.availableLessonTypes ??
          [...DEFAULT_BOOKING_LESSON_TYPES]) as string[];
        setSelectedLessonType((current) =>
          !resolvedBookingOptions.lessonTypeSelectionEnabled
            ? 'guida'
            :
          availableTypes.includes(current)
            ? current
            : availableTypes[0] ?? DEFAULT_BOOKING_LESSON_TYPES[0],
        );
      } catch (err) {
        if (requestId !== loadRequestRef.current) {
          return;
        }
        setToast({
          text: err instanceof Error ? err.message : 'Errore nel caricamento',
          tone: 'danger',
        });
      } finally {
        if (requestId === loadRequestRef.current) {
          setLoading(false);
          setStudentDataReady(true);
          if (shouldShowRangeSkeleton) {
            setRangeLoading(false);
          }
        }
      }
    },
    [calendarRange]
  );

  const loadWaitlistOffers = useCallback(async (studentId: string) => {
    try {
      const offers = await regloApi.getWaitlistOffers(studentId, 1);
      setWaitlistOffer(offers[0] ?? null);
    } catch (err) {
      setToast({
        text: err instanceof Error ? err.message : 'Errore caricando le proposte disponibili',
        tone: 'danger',
      });
    }
  }, []);

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

  useEffect(() => {
    if (!selectedStudentId) {
      setWaitlistOffer(null);
      setWaitlistOpen(false);
      return;
    }
    loadData(selectedStudentId);
    loadWaitlistOffers(selectedStudentId);
  }, [loadData, loadWaitlistOffers, selectedStudentId]);

  useEffect(() => {
    if (!waitlistOffer) {
      setWaitlistOpen(false);
      return;
    }
    if (!prefsOpen && !sheetOpen) {
      setWaitlistOpen(true);
    }
  }, [prefsOpen, sheetOpen, waitlistOffer]);

  useEffect(() => {
    if (!selectedStudentId) return;
    const unsubscribe = subscribePushIntent((intent) => {
      if (intent === 'slot_fill_offer') {
        loadWaitlistOffers(selectedStudentId);
        return;
      }
      if (intent === 'appointment_cancelled') {
        loadData(selectedStudentId);
        setToast({
          text: "Una guida e' stata annullata dall'autoscuola.",
          tone: 'info',
        });
        return;
      }
      if (intent === 'appointment_proposal') {
        setProposalAppointmentOpen(true);
        loadData(selectedStudentId);
      }
    });
    return unsubscribe;
  }, [loadData, loadWaitlistOffers, selectedStudentId]);

  useEffect(() => {
    if (!selectedStudentId) return;
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') return;
      loadData(selectedStudentId);
      loadWaitlistOffers(selectedStudentId);
    });
    return () => {
      subscription.remove();
    };
  }, [loadData, loadWaitlistOffers, selectedStudentId]);

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

  const agendaLessons = useMemo(() => {
    const fromTs = calendarRange ? new Date(calendarRange.from).getTime() : null;
    const toTs = calendarRange ? new Date(calendarRange.to).getTime() : null;
    return [...appointments]
      .filter((item) => item.id !== upcoming[0]?.id)
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
    setStudentDataReady(false);
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

  const pendingProposal = useMemo(() => {
    const now = new Date();
    return [...appointments]
      .filter((item) => {
        const status = (item.status ?? '').trim().toLowerCase();
        return proposalStatuses.has(status) && new Date(item.startsAt) >= now;
      })
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())[0] ?? null;
  }, [appointments]);

  useEffect(() => {
    if (!pendingProposal) {
      setProposalAppointmentOpen(false);
      return;
    }
    if (!prefsOpen && !sheetOpen && !waitlistOpen) {
      setProposalAppointmentOpen(true);
    }
  }, [pendingProposal, prefsOpen, sheetOpen, waitlistOpen]);

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
    setSuggestion(null);
    setBookingLoading(true);
    if (!availableDurations.includes(durationMinutes)) {
      setToast({ text: 'Durata non disponibile', tone: 'danger' });
      setBookingLoading(false);
      return;
    }
    if (
      canSelectLessonType &&
      (!selectedLessonType || !availableLessonTypes.includes(selectedLessonType))
    ) {
      setToast({ text: 'Tipo guida non disponibile', tone: 'danger' });
      setBookingLoading(false);
      return;
    }
    const mode = bookingOptions?.studentBookingMode ?? 'engine';
    try {
      if (mode === 'free_choice') {
        const slots = await regloApi.getAvailableSlots({
          studentId: selectedStudentId,
          date: toDateString(preferredDate),
          durationMinutes,
          ...(canSelectLessonType ? { lessonType: selectedLessonType } : {}),
        });
        if (!slots.length) {
          setToast({ text: 'Nessuna disponibilità per il giorno scelto', tone: 'info' });
          return;
        }
        setFreeChoiceSlots(slots);
        setFreeChoiceSelected(null);
        setPendingFreeChoiceOpen(true);
        setPrefsOpen(false);
        return;
      }

      const response = await regloApi.createBookingRequest({
        studentId: selectedStudentId,
        preferredDate: toDateString(preferredDate),
        durationMinutes,
        ...(canSelectLessonType ? { lessonType: selectedLessonType } : {}),
        maxDays: 4,
        requestId: bookingRequestId ?? undefined,
      });

      if (response.matched) {
        setToast({ text: 'Guida prenotata', tone: 'success' });
        triggerBookingCelebration();
        setPrefsOpen(false);
        await loadData(selectedStudentId);
        return;
      }

      if (response.suggestion) {
        setSuggestion(response.suggestion);
        setBookingRequestId(response.request.id);
        if (prefsOpen) {
          setPendingSuggestionOpen(true);
          setPrefsOpen(false);
        } else {
          setSheetOpen(true);
        }
        return;
      }

      setToast({ text: 'Nessuna disponibilita per il giorno scelto', tone: 'info' });
    } catch (err) {
      setToast({
        text: err instanceof Error ? err.message : 'Errore nella richiesta',
        tone: 'danger',
      });
    } finally {
      setBookingLoading(false);
    }
  };

  const handleAcceptSuggestion = async () => {
    if (!selectedStudentId || !suggestion) return;
    setToast(null);
    setProposalLoading(true);
    try {
      const response = await regloApi.createBookingRequest({
        studentId: selectedStudentId,
        preferredDate: toDateString(preferredDate),
        durationMinutes,
        ...(canSelectLessonType ? { lessonType: selectedLessonType } : {}),
        selectedStartsAt: suggestion.startsAt,
        requestId: bookingRequestId ?? undefined,
      });
      if (response.matched) {
        setToast({ text: 'Guida prenotata', tone: 'success' });
        triggerBookingCelebration();
        setSuggestion(null);
        setBookingRequestId(null);
        setSheetOpen(false);
        setPrefsOpen(false);
        await loadData(selectedStudentId);
        return;
      }
      setToast({ text: 'Slot non disponibile', tone: 'danger' });
    } catch (err) {
      setToast({
        text: err instanceof Error ? err.message : 'Errore prenotando slot',
        tone: 'danger',
      });
    } finally {
      setProposalLoading(false);
    }
  };

  const handleRejectSuggestion = () => {
    if (proposalLoading) return;
    setSheetOpen(false);
    setSuggestion(null);
    setBookingRequestId(null);
  };

  const handleConfirmFreeChoiceSlot = async () => {
    if (!selectedStudentId || !freeChoiceSelected || freeChoiceBooking) return;
    setFreeChoiceBooking(true);
    setToast(null);
    try {
      const response = await regloApi.createBookingRequest({
        studentId: selectedStudentId,
        preferredDate: toDateString(preferredDate),
        durationMinutes,
        ...(canSelectLessonType ? { lessonType: selectedLessonType } : {}),
        selectedStartsAt: freeChoiceSelected.startsAt,
      });
      if (response.matched) {
        setToast({ text: 'Guida prenotata', tone: 'success' });
        triggerBookingCelebration();
        setFreeChoiceOpen(false);
        setFreeChoiceSelected(null);
        setFreeChoiceSlots([]);
        await loadData(selectedStudentId);
        return;
      }
      // Slot taken in the meantime — reload available slots
      setToast({ text: 'Slot non più disponibile, aggiornamento in corso...', tone: 'danger' });
      try {
        const refreshed = await regloApi.getAvailableSlots({
          studentId: selectedStudentId,
          date: toDateString(preferredDate),
          durationMinutes,
          ...(canSelectLessonType ? { lessonType: selectedLessonType } : {}),
        });
        setFreeChoiceSlots(refreshed);
        setFreeChoiceSelected(null);
      } catch {
        setFreeChoiceOpen(false);
      }
    } catch (err) {
      setToast({
        text: err instanceof Error ? err.message : 'Errore nella prenotazione',
        tone: 'danger',
      });
    } finally {
      setFreeChoiceBooking(false);
    }
  };

  const handleAcceptAppointmentProposal = async () => {
    if (!pendingProposal || !selectedStudentId) return;
    setProposalAppointmentLoading(true);
    setToast(null);
    try {
      await regloApi.updateAppointmentStatus(pendingProposal.id, { status: 'scheduled' });
      setToast({ text: 'Proposta accettata', tone: 'success' });
      triggerBookingCelebration();
      setProposalAppointmentOpen(false);
      await loadData(selectedStudentId);
    } catch (err) {
      setToast({
        text: err instanceof Error ? err.message : 'Errore durante accettazione proposta',
        tone: 'danger',
      });
    } finally {
      setProposalAppointmentLoading(false);
    }
  };

  const handleDeclineAppointmentProposal = async () => {
    if (!pendingProposal || !selectedStudentId || proposalAppointmentLoading) return;
    setProposalAppointmentLoading(true);
    setToast(null);
    try {
      await regloApi.cancelAppointment(pendingProposal.id);
      setToast({ text: 'Proposta rifiutata', tone: 'info' });
      setProposalAppointmentOpen(false);
      await loadData(selectedStudentId);
    } catch (err) {
      setToast({
        text: err instanceof Error ? err.message : 'Errore durante rifiuto proposta',
        tone: 'danger',
      });
    } finally {
      setProposalAppointmentLoading(false);
    }
  };

  const handleClosePreferences = () => {
    setPrefsOpen(false);
  };

  const handleAlternativeSuggestion = async () => {
    if (!selectedStudentId || !suggestion) return;
    setProposalLoading(true);
    try {
      const response = await regloApi.createBookingRequest({
        studentId: selectedStudentId,
        preferredDate: toDateString(preferredDate),
        durationMinutes,
        ...(canSelectLessonType ? { lessonType: selectedLessonType } : {}),
        maxDays: 4,
        excludeStartsAt: suggestion.startsAt,
        requestId: bookingRequestId ?? undefined,
      });
      if (!response.matched && response.suggestion) {
        setSuggestion(response.suggestion);
        setBookingRequestId(response.request.id);
        return;
      }
      setToast({ text: 'Nessuna alternativa disponibile', tone: 'info' });
      setSheetOpen(false);
      setSuggestion(null);
      setBookingRequestId(null);
    } catch (err) {
      setToast({
        text: err instanceof Error ? err.message : 'Errore nella ricerca alternativa',
        tone: 'danger',
      });
    } finally {
      setProposalLoading(false);
    }
  };

  const handleAcceptWaitlistOffer = async () => {
    if (!selectedStudentId || !waitlistOffer) return;
    setWaitlistLoading(true);
    setToast(null);
    try {
      const response = await regloApi.respondWaitlistOffer(waitlistOffer.id, {
        studentId: selectedStudentId,
        response: 'accept',
      });
      if (response.accepted) {
        setToast({ text: 'Slot accettato e guida prenotata', tone: 'success' });
        triggerBookingCelebration();
        setWaitlistOpen(false);
        await loadData(selectedStudentId);
      } else {
        setToast({ text: 'Slot non più disponibile', tone: 'info' });
      }
      await loadWaitlistOffers(selectedStudentId);
    } catch (err) {
      setToast({
        text: err instanceof Error ? err.message : 'Errore durante accettazione slot',
        tone: 'danger',
      });
    } finally {
      setWaitlistLoading(false);
    }
  };

  const handleDeclineWaitlistOffer = async () => {
    if (!selectedStudentId || !waitlistOffer || waitlistLoading) return;
    setWaitlistLoading(true);
    setToast(null);
    try {
      await regloApi.respondWaitlistOffer(waitlistOffer.id, {
        studentId: selectedStudentId,
        response: 'decline',
      });
      setToast({ text: 'Proposta rifiutata', tone: 'info' });
      setWaitlistOpen(false);
      await loadWaitlistOffers(selectedStudentId);
    } catch (err) {
      setToast({
        text: err instanceof Error ? err.message : 'Errore durante rifiuto slot',
        tone: 'danger',
      });
    } finally {
      setWaitlistLoading(false);
    }
  };


  const executeCancel = async (appointmentId: string) => {
    setToast(null);
    setCancellingAppointmentId(appointmentId);
    try {
      await regloApi.cancelAppointment(appointmentId);
      setToast({ text: 'Guida annullata', tone: 'success' });
      if (selectedStudentId) {
        await Promise.all([loadData(selectedStudentId), loadWaitlistOffers(selectedStudentId)]);
      }
    } catch (err) {
      setToast({
        text: err instanceof Error ? err.message : 'Errore durante annullamento',
        tone: 'danger',
      });
    } finally {
      setCancellingAppointmentId(null);
    }
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
      await loadData(selectedStudentId);
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
      const list = await loadStudents();
      const linkedStudent = findLinkedStudent(list, user);
      if (linkedStudent?.id) {
        await Promise.all([loadData(linkedStudent.id), loadWaitlistOffers(linkedStudent.id)]);
      }
    } catch (err) {
      setToast({
        text: err instanceof Error ? err.message : 'Errore nel refresh',
        tone: 'danger',
      });
    } finally {
      setRefreshing(false);
    }
  }, [loadData, loadStudents, loadWaitlistOffers, user]);

  const blockedByInsoluti = paymentProfile?.blockedByInsoluti;

  const formatInstructorInitials = (name: string | null | undefined) => {
    if (!name) return 'Da assegnare';
    const parts = name.trim().split(/\s+/);
    if (parts.length < 2) return name;
    return `${parts[0]} ${parts[parts.length - 1][0]}.`;
  };

  return (
    <Screen>
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
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <Text style={styles.title}>
            Ciao, {selectedStudent?.firstName ?? 'Allievo'} {'\uD83D\uDC4B'}
          </Text>
          <Text style={styles.subtitle}>
            {selectedStudent
              ? 'Pronto per la tua prossima guida?'
              : studentsLoaded
                ? 'Profilo allievo non collegato'
                : 'Caricamento profilo...'}
          </Text>

        </View>

        {!selectedStudent ? (
          studentsLoaded ? (
            <View style={styles.emptyLessonCard}>
              <Image
                source={require('../../assets/duck-zen.png')}
                style={styles.emptyLessonImage}
                resizeMode="contain"
              />
              <Text style={styles.emptyLessonText}>Profilo allievo non collegato</Text>
            </View>
          ) : (
            <>
              <SkeletonCard style={styles.nextLessonSkeleton}>
                <SkeletonBlock width="40%" height={12} radius={6} />
                <SkeletonBlock width="75%" height={26} radius={8} />
                <SkeletonBlock width="55%" height={16} radius={6} />
              </SkeletonCard>
              <SkeletonBlock width="100%" height={58} radius={radii.sm} />
              <View style={styles.calendarSection}>
                <SkeletonBlock width="40%" height={22} radius={8} />
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <SkeletonBlock key={`init-cal-sk-${i}`} width={58} height={72} radius={16} />
                  ))}
                </View>
              </View>
            </>
          )
        ) : !studentDataReady ? (
          <>
            {/* Skeleton: Prossima Guida — matches yellow gradient card */}
            <SkeletonCard style={styles.nextLessonSkeleton}>
              <SkeletonBlock width="40%" height={12} radius={6} />
              <SkeletonBlock width="75%" height={26} radius={8} />
              <SkeletonBlock width="55%" height={16} radius={6} />
            </SkeletonCard>

            {/* Skeleton: CTA Button */}
            <SkeletonBlock width="100%" height={58} radius={radii.sm} />

            {/* Skeleton: Calendar */}
            <View style={styles.calendarSection}>
              <SkeletonBlock width="40%" height={22} radius={8} />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <SkeletonBlock key={`cal-sk-${i}`} width={58} height={72} radius={16} />
                ))}
              </View>
            </View>

            {/* Skeleton: Agenda */}
            <View style={styles.agendaSection}>
              <SkeletonBlock width="30%" height={20} radius={8} />
              <View style={styles.agendaList}>
                {Array.from({ length: 2 }).map((_, index) => (
                  <SkeletonCard key={`agenda-skeleton-${index}`} style={styles.agendaRowSkeleton}>
                    <SkeletonBlock width="65%" height={18} radius={6} />
                    <SkeletonBlock width="50%" height={14} radius={6} />
                    <SkeletonBlock width="40%" height={14} radius={6} />
                    <SkeletonBlock width="100%" height={48} radius={radii.sm} />
                  </SkeletonCard>
                ))}
              </View>
            </View>
          </>
        ) : (
          <>
            {/* ── Prossima Guida Card ── */}
            {nextLesson ? (
              <View style={styles.nextLessonShadow}>
                <Image
                  source={require('../../assets/duck-peek.png')}
                  style={styles.nextLessonDuck}
                  resizeMode="contain"
                />
                <LinearGradient
                  colors={['#FACC15', '#FDE68A']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0.8, y: 1 }}
                  style={styles.nextLessonCard}
                >
                  {isLessonInProgress ? (
                    <View style={styles.inProgressBadge}>
                      <View style={styles.inProgressDot} />
                      <Text style={styles.inProgressBadgeText}>GUIDA IN CORSO</Text>
                    </View>
                  ) : (
                    <Text style={styles.nextLessonLabel}>PROSSIMA GUIDA</Text>
                  )}
                  <Text style={styles.nextLessonDateTime}>
                    {formatDay(nextLesson.startsAt)} {'\u2022'} {formatTime(nextLesson.startsAt)}
                  </Text>
                  <Text style={styles.nextLessonDetails}>
                    {formatInstructorInitials(nextLesson.instructor?.name)} {'\u2022'}{' '}
                    {nextLesson.vehicle?.name ?? 'Da assegnare'}
                  </Text>
                  {!isLessonInProgress ? (
                    <Pressable
                      onPress={() => handleCancel(nextLesson.id)}
                      disabled={cancellingAppointmentId === nextLesson.id}
                    >
                      <Text style={styles.nextLessonCancelText}>
                        {cancellingAppointmentId === nextLesson.id
                          ? 'Annullamento...'
                          : 'Annulla prenotazione'}
                      </Text>
                    </Pressable>
                  ) : null}
                </LinearGradient>
              </View>
            ) : (
              <View style={styles.emptyLessonCard}>
                <Image
                  source={require('../../assets/duck-zen.png')}
                  style={styles.emptyLessonImage}
                  resizeMode="contain"
                />
                <Text style={styles.emptyLessonText}>Nessuna guida prenotata</Text>
              </View>
            )}

            {/* ── CTA Button (standalone) ── */}
            {!studentBookingDisabledByPolicy ? (
              <Pressable
                onPress={blockedByInsoluti ? handlePayNow : openPreferences}
                disabled={blockedByInsoluti ? payNowLoading : (requiresPaymentMethodForBooking || requiresCreditsForBooking)}
                style={({ pressed }) => [
                  styles.ctaButton,
                  pressed && styles.ctaButtonPressed,
                  (blockedByInsoluti ? payNowLoading : (requiresPaymentMethodForBooking || requiresCreditsForBooking)) && styles.ctaButtonDisabled,
                ]}
              >
                <Text style={styles.ctaButtonLabel}>
                  {blockedByInsoluti
                    ? payNowLoading
                      ? 'Attendi...'
                      : 'Salda ora'
                    : requiresCreditsForBooking
                      ? 'Crediti guida esauriti'
                      : 'Prenota nuova guida'}
                </Text>
              </Pressable>
            ) : null}

            {/* ── Horizontal Day Calendar ── */}
            <View style={styles.calendarSection}>
              <View style={styles.calendarMonthRow}>
                <Text style={styles.calendarMonthTitle}>{calendarMonthLabel}</Text>
                <Pressable
                  onPress={() => setCalendarDrawerOpen(true)}
                  style={styles.calendarIconBtn}
                >
                  <Ionicons name="calendar-outline" size={22} color="#94A3B8" />
                </Pressable>
              </View>
              <ScrollView
                ref={dayScrollRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.dayPillsRow}
                onLayout={handleDayScrollLayout}
              >
                {calendarDays.map((day, index) => {
                  const dayNorm = new Date(day.date);
                  dayNorm.setHours(0, 0, 0, 0);
                  const selNorm = new Date(selectedDate);
                  selNorm.setHours(0, 0, 0, 0);
                  const todayNorm = new Date();
                  todayNorm.setHours(0, 0, 0, 0);
                  const isToday = dayNorm.getTime() === todayNorm.getTime();
                  const isSelected = dayNorm.getTime() === selNorm.getTime() && !isToday;
                  const hasBooking = bookedDatesSet.has(
                    `${dayNorm.getFullYear()}-${dayNorm.getMonth()}-${dayNorm.getDate()}`
                  );
                  return (
                    <Pressable
                      key={`day-${index}`}
                      style={[
                        styles.dayPill,
                        isSelected
                          ? styles.dayPillSelected
                          : isToday
                            ? styles.dayPillToday
                            : styles.dayPillUnselected,
                      ]}
                      onPress={() => setSelectedDate(day.date)}
                    >
                      <Text
                        style={[
                          styles.dayPillWeekday,
                          isSelected
                            ? styles.dayPillWeekdaySelected
                            : isToday
                              ? styles.dayPillWeekdayToday
                              : styles.dayPillWeekdayUnselected,
                        ]}
                      >
                        {day.weekday}
                      </Text>
                      <Text
                        style={[
                          styles.dayPillNumber,
                          isSelected
                            ? styles.dayPillNumberSelected
                            : isToday
                              ? styles.dayPillNumberToday
                              : styles.dayPillNumberUnselected,
                        ]}
                      >
                        {day.dayNum}
                      </Text>
                      {hasBooking ? (
                        <View
                          style={[
                            styles.dayPillDot,
                            (isSelected || isToday) && styles.dayPillDotHighlight,
                          ]}
                        />
                      ) : null}
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            {/* ── Agenda Section ── */}
            <View style={styles.agendaSection}>
              <Text style={styles.agendaSectionTitle}>Agenda</Text>
              <View style={styles.agendaList}>
                {agendaLoading
                  ? Array.from({ length: 3 }).map((_, index) => (
                      <SkeletonCard key={`agenda-range-skeleton-${index}`} style={styles.agendaRowSkeleton}>
                        <SkeletonBlock width="65%" height={18} radius={6} />
                        <SkeletonBlock width="50%" height={14} radius={6} />
                        <SkeletonBlock width="40%" height={14} radius={6} />
                        <SkeletonBlock width="100%" height={48} radius={radii.sm} />
                      </SkeletonCard>
                    ))
                  : visibleAgendaLessons.map((lesson) => {
                      const status = statusLabel(lesson.status);
                      const lessonPayment = paymentByAppointmentId.get(lesson.id) ?? null;
                      return (
                        <View key={lesson.id} style={styles.agendaRow}>
                          <View style={styles.agendaTop}>
                            <Text style={styles.agendaTime}>
                              {formatDay(lesson.startsAt)} {'\u2022'} {formatTime(lesson.startsAt)}
                            </Text>
                            <Badge label={status.label} tone={status.tone} />
                          </View>
                          <Text style={styles.agendaInstructor}>
                            Istruttore: {lesson.instructor?.name ?? 'Da assegnare'}
                          </Text>
                          <Text style={styles.agendaMeta}>
                            Veicolo: {lesson.vehicle?.name ?? 'Da assegnare'}
                          </Text>
                          {lessonPayment ? (
                            <Text style={styles.historyPaymentMeta}>
                              Pagamento: {paymentStatusLabel(lessonPayment.paymentStatus).label} {'\u2022'} Residuo{' '}
                              {'\u20AC'} {lessonPayment.dueAmount.toFixed(2)}
                            </Text>
                          ) : null}
                          <Button
                            label="Dettagli"
                            tone="standard"
                            onPress={() => handleOpenHistoryDetails(lesson)}
                            fullWidth
                          />
                        </View>
                      );
                    })}
                {!agendaLoading && !agendaLessons.length ? (
                  <Text style={styles.empty}>Nessuna guida nel periodo selezionato.</Text>
                ) : null}
                {!agendaLoading && agendaLessons.length > 4 ? (
                  <View style={styles.agendaToggleWrap}>
                    <Button
                      label={showAllAgendaLessons ? 'Mostra meno' : 'Mostra di più'}
                      onPress={() => setShowAllAgendaLessons((prev) => !prev)}
                      tone="standard"
                      fullWidth
                    />
                  </View>
                ) : null}
              </View>
            </View>
          </>
        )}
      </ScrollView>
      {/* ── Lesson Detail BottomSheet ── */}
      <BottomSheet
        visible={historyDetailsOpen && !!selectedHistoryLesson}
        onClose={() => setHistoryDetailsOpen(false)}
        title="Dettaglio guida"
        showHandle
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
                </View>
              </View>

              {/* Vehicle */}
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

            {/* Cancel button — only for upcoming confirmed lessons */}
            {upcomingConfirmedStatuses.has(
              (selectedHistoryLesson.status ?? '').trim().toLowerCase(),
            ) &&
            new Date(selectedHistoryLesson.startsAt).getTime() > Date.now() ? (
              <Pressable
                style={styles.detailCancelBtn}
                onPress={() => {
                  const id = selectedHistoryLesson.id;
                  setHistoryDetailsOpen(false);
                  setTimeout(() => handleCancel(id), 350);
                }}
                disabled={cancellingAppointmentId === selectedHistoryLesson.id}
              >
                <Ionicons name="close-circle-outline" size={18} color="#EF4444" />
                <Text style={styles.detailCancelText}>
                  {cancellingAppointmentId === selectedHistoryLesson.id
                    ? 'Annullamento...'
                    : 'Annulla guida'}
                </Text>
              </Pressable>
            ) : null}
          </>
        ) : null}
      </BottomSheet>
      {/* ── Proposal BottomSheet ── */}
      <BottomSheet
        visible={proposalAppointmentOpen && !!pendingProposal}
        onClose={() => { if (!proposalAppointmentLoading) setProposalAppointmentOpen(false); }}
        title="Nuova proposta"
        closeDisabled={proposalAppointmentLoading}
        showHandle
        footer={
          pendingProposal ? (
            <View style={{ gap: 12 }}>
              <Pressable
                onPress={proposalAppointmentLoading ? undefined : handleAcceptAppointmentProposal}
                disabled={proposalAppointmentLoading}
                style={[styles.chunkyPinkCta, proposalAppointmentLoading && { opacity: 0.5 }]}
              >
                <Text style={styles.chunkyPinkCtaText}>
                  {proposalAppointmentLoading ? 'Attendi...' : 'Accetta guida'}
                </Text>
              </Pressable>
              <Pressable
                onPress={proposalAppointmentLoading ? undefined : handleDeclineAppointmentProposal}
                disabled={proposalAppointmentLoading}
                style={[styles.chunkyOutlineBtn, proposalAppointmentLoading && { opacity: 0.5 }]}
              >
                <Text style={styles.chunkyOutlineBtnText}>
                  {proposalAppointmentLoading ? 'Attendi...' : 'Chiedi cambio orario'}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (!proposalAppointmentLoading) {
                    handleDeclineAppointmentProposal();
                  }
                }}
                disabled={proposalAppointmentLoading}
                style={styles.chunkyRedLink}
              >
                <Text style={styles.chunkyRedLinkText}>Rifiuta proposta</Text>
              </Pressable>
            </View>
          ) : undefined
        }
      >
        {pendingProposal ? (
          <View style={styles.chunkyYellowCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={styles.chunkyYellowDot} />
              <Text style={styles.chunkyYellowLabel}>HAI UNA PROPOSTA!</Text>
            </View>
            <Text style={styles.chunkyYellowTitle}>
              {formatDay(pendingProposal.startsAt)} {'\u2022'} {formatTime(pendingProposal.startsAt)}
            </Text>
            <Text style={styles.chunkyYellowSub}>
              {Math.max(
                30,
                Math.round(
                  ((pendingProposal.endsAt
                    ? new Date(pendingProposal.endsAt).getTime()
                    : new Date(pendingProposal.startsAt).getTime() + 30 * 60 * 1000) -
                    new Date(pendingProposal.startsAt).getTime()) /
                    60000
                )
              )}{' '}
              min {'\u2022'} {pendingProposal.instructor?.name ?? 'Istruttore da assegnare'}
            </Text>
          </View>
        ) : null}
      </BottomSheet>
      <BottomSheet
        visible={waitlistOpen && !!waitlistOffer}
        title="Slot liberato"
        onClose={waitlistLoading ? () => {} : handleDeclineWaitlistOffer}
        closeDisabled={waitlistLoading}
        footer={
          <View style={styles.sheetActionsDock}>
            <View style={styles.fullWidthButtonWrap}>
              <Button
                label={waitlistLoading ? 'Attendi...' : 'Accetta'}
                tone="primary"
                onPress={waitlistLoading ? undefined : handleAcceptWaitlistOffer}
                disabled={waitlistLoading}
                fullWidth
              />
            </View>
            <View style={styles.fullWidthButtonWrap}>
              <Button
                label={waitlistLoading ? 'Attendi...' : 'Rifiuta'}
                tone="danger"
                onPress={waitlistLoading ? undefined : handleDeclineWaitlistOffer}
                disabled={waitlistLoading}
                fullWidth
              />
            </View>
          </View>
        }
      >
        {waitlistOffer ? (
          <View style={styles.sheetContent}>
            <Text style={styles.sheetText}>
              {formatDay(waitlistOffer.slot.startsAt)} · {formatTime(waitlistOffer.slot.startsAt)}
            </Text>
            <Text style={styles.sheetMeta}>Durata: 30 min</Text>
            <Text style={styles.sheetMeta}>
              Conferma entro: {formatTime(waitlistOffer.expiresAt)}
            </Text>
          </View>
        ) : null}
      </BottomSheet>
      {/* ── Booking Preferences BottomSheet ── */}
      <BottomSheet
        visible={prefsOpen}
        onClose={handleClosePreferences}
        onClosed={() => {
          if (pendingSuggestionOpen) {
            setSheetOpen(true);
            setPendingSuggestionOpen(false);
          }
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
          <Pressable
            onPress={bookingLoading ? undefined : handleBookingRequest}
            disabled={bookingLoading}
            style={[styles.chunkyPinkCta, bookingLoading && { opacity: 0.5 }]}
          >
            <Text style={styles.chunkyPinkCtaText}>
              {bookingLoading ? 'Attendi...' : 'Prenota \u2192'}
            </Text>
          </Pressable>
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
              <Ionicons name="calendar" size={20} color="#CA8A04" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.bookingDateMainText}>
                {formatDay(preferredDate.toISOString())}
              </Text>
              <Text style={styles.bookingDateHint}>Scegli quando guidare</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
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
                const isActive = selectedLessonType === lessonType;
                return (
                  <Pressable
                    key={`type-${lessonType}`}
                    style={[styles.bookingChipChunky, isActive && styles.bookingChipChunkyActive]}
                    onPress={() => setSelectedLessonType(lessonType)}
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
      </BottomSheet>
      {/* ── Booking Suggestion BottomSheet ── */}
      <BottomSheet
        visible={sheetOpen}
        onClose={handleRejectSuggestion}
        title="Nuova proposta"
        closeDisabled={proposalLoading}
        showHandle
        footer={
          suggestion ? (
            <View style={{ gap: 12 }}>
              <Pressable
                onPress={proposalLoading ? undefined : handleAcceptSuggestion}
                disabled={proposalLoading}
                style={[styles.chunkyPinkCta, proposalLoading && { opacity: 0.5 }]}
              >
                <Text style={styles.chunkyPinkCtaText}>
                  {proposalLoading ? 'Attendi...' : 'Accetta guida'}
                </Text>
              </Pressable>
              <Pressable
                onPress={proposalLoading ? undefined : handleAlternativeSuggestion}
                disabled={proposalLoading}
                style={[styles.chunkyOutlineBtn, proposalLoading && { opacity: 0.5 }]}
              >
                <Text style={styles.chunkyOutlineBtnText}>
                  {proposalLoading ? 'Attendi...' : 'Chiedi cambio orario'}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (!proposalLoading) handleRejectSuggestion();
                }}
                disabled={proposalLoading}
                style={styles.chunkyRedLink}
              >
                <Text style={styles.chunkyRedLinkText}>Rifiuta proposta</Text>
              </Pressable>
            </View>
          ) : undefined
        }
      >
        {suggestion ? (
          <View style={styles.chunkyYellowCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={styles.chunkyYellowDot} />
              <Text style={styles.chunkyYellowLabel}>HAI UNA PROPOSTA!</Text>
            </View>
            <Text style={styles.chunkyYellowTitle}>
              {formatDay(suggestion.startsAt)} {'\u2022'} {formatTime(suggestion.startsAt)}
            </Text>
            <Text style={styles.chunkyYellowSub}>
              {durationMinutes} min {'\u2022'} Istruttore da assegnare
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
    </Screen>
  );
};

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.xxl * 2 + spacing.md,
  },

  /* ── Header ── */
  header: {
    gap: 4,
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
  nextLessonCancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#EF4444',
    marginTop: 4,
  },
  emptyLessonCard: {
    borderRadius: radii.lg,
    borderWidth: 1.5,
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
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EC4899',
    marginTop: 4,
  },
  dayPillDotHighlight: {
    backgroundColor: '#FFFFFF',
  },
  detailCancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 20,
    paddingVertical: 12,
  },
  detailCancelText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#EF4444',
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
    borderWidth: 1.5,
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
  suggestionBox: {
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  suggestionText: {
    ...typography.body,
    color: colors.textSecondary,
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
    backgroundColor: '#EC4899',
    height: 54,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#EC4899',
    shadowOpacity: 0.3,
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
    borderWidth: 1.5,
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
    borderWidth: 1.5,
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
    backgroundColor: '#F8FAFC',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  bookingCreditsBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
  },
  bookingSection: {
    gap: 10,
  },
  bookingSectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  bookingDateCardChunky: {
    backgroundColor: '#F8FAFC',
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  bookingDateIconLg: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FEF9C3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookingDateMainText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  bookingDateHint: {
    fontSize: 12,
    fontWeight: '400',
    color: '#94A3B8',
    marginTop: 2,
  },
  bookingDurationSingle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
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
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookingChipChunkyActive: {
    backgroundColor: '#FACC15',
    borderColor: '#FACC15',
  },
  bookingChipChunkyText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  bookingChipChunkyTextActive: {
    fontSize: 14,
    fontWeight: '700',
    color: '#92400E',
  },
  timelineSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748B',
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
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
  },
  timelineLine: {
    width: 1.5,
    flex: 1,
    backgroundColor: '#E2E8F0',
    marginTop: 8,
    minHeight: 20,
  },
  timelineCard: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  timelineCardActive: {
    backgroundColor: '#FACC15',
    borderColor: '#FACC15',
    shadowColor: '#D97706',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  timelineCardText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
  },
  timelineCardTextActive: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#92400E',
  },
  timelineCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#92400E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineCheckText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
