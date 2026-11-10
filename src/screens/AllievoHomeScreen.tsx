import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import {
  Alert,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { spacing } from '../theme';

import { StatusBar } from 'expo-status-bar';
import { useRouter, useFocusEffect } from 'expo-router';
import { BookingCelebration } from '../components/BookingCelebration';
import { ToastNotice, ToastTone } from '../components/ToastNotice';
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
import { useAppointments } from '../hooks/queries/useAppointments';
import { queryKeys } from '../hooks/queries/queryKeys';
import { useBookSlot } from '../hooks/mutations/useBookSlot';
import { useCancelAppointment } from '../hooks/mutations/useCancelAppointment';
import {
  AutoscuolaAppointmentWithRelations,
  AvailableSlot,
  AutoscuolaStudent,
  AutoscuolaInstructor,
  AutoscuolaWaitlistOfferWithSlot,
  GroupLessonInvite,
} from '../types/regloApi';
import { ClayNavBar, useLargeTitleScroll } from '../components/ClayLargeTitle';
import { Avatar, ClayButton, ClayIconButton, ClayPressable } from '../components/clay';
import { CLAY } from '../theme/clay';
import {
  bookingExceptionCases,
  bookingHoldMessage,
  resolveStudentBookingPolicy,
} from '../utils/studentBookingPolicy';
import {
  BookingCaseItem,
  BookingCasesCard,
  CallInstructorButton,
  EmptyLessonCard,
  FeaturedOfferCard,
  HOME_ART,
  HomeGreeting,
  HomeLessonRow,
  HomeRow,
  HomeRowsList,
  HomeSection,
  HomeTile,
  LessonsList,
  NextLessonCard,
  PausedCard,
  StatTiles,
} from './allievoHome/HomeSections';
import { lessonDetailStore } from '../stores/lessonDetailStore';
import { groupLessonStudentStore } from '../stores/groupLessonStudentStore';
import { allLessonsStore } from '../stores/allLessonsStore';
import { examDetailStore } from '../stores/examDetailStore';
import { bookingFlowStore } from '../stores/bookingFlowStore';



import { formatTime } from '../utils/date';
import { examTimeIsTbd } from '../utils/examTime';
import { CompactLessonCard, ExamHeroCard } from './allievoHome/ExamHomeCards';
import { slotLocationParam } from '../utils/slotLocation';
import { transmissionLabel } from '../utils/license';
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
  if (status === 'pending_review') return { label: 'Da confermare', tone: 'warning' as const };
  return { label: 'Programmato', tone: 'default' as const };
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
  const { user, activeCompanyId, companies } = useSession();
  const activeCompanyName = companies.find((c) => c.id === activeCompanyId)?.name ?? null;
  const {
    phase: studentPhase,
    theoryExamAt: studentTheoryExamAt,
    licenseCategory: studentLicenseCategory,
    transmission: studentTransmission,
  } = useStudentPhase();
  const studentLicenseLabel = studentLicenseCategory
    ? `${studentLicenseCategory} · ${transmissionLabel(studentTransmission)}`
    : null;
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
  // Open group-lesson invites available to this student (for the home CTA badge).
  const [groupInvitesCount, setGroupInvitesCount] = useState<number | null>(null);
  // Elenco (solo data/posti, countOnly) per la riga «Posti liberi» della home.
  const [groupInvites, setGroupInvites] = useState<GroupLessonInvite[]>([]);
  // My active swap requests: appointmentId → offerId (for the home marker + revoke).
  const [mySwapByAppointment, setMySwapByAppointment] = useState<Map<string, string>>(new Map());

  // ── Linked student (must come before hooks that depend on studentId) ──
  const selectedStudent = useMemo(
    () => findLinkedStudent(students, user),
    [students, user]
  );
  const selectedStudentId = selectedStudent?.id ?? null;

  // Settings drive the booking horizon used to size the appointment window below.
  const settingsQuery = useAutoscuolaSettings();

  // ── Appointment query params (computed from calendarRange) ──
  const appointmentParams = useMemo(() => {
    if (!selectedStudentId) return null;
    const defaultFrom = addDays(new Date(), -7);
    defaultFrom.setHours(0, 0, 0, 0);
    // Forward floor = the school's booking horizon (availabilityWeeks) + buffer.
    // The home "prossime guide" list isn't navigable, so the window must cover
    // everything bookable — otherwise a lesson booked weeks out (e.g. July) is
    // outside the window and vanishes after booking. Navigating the calendar
    // still extends `to` further on demand (selectedTo below).
    const horizonWeeks = Number(settingsQuery.data?.availabilityWeeks) || 4;
    const defaultTo = addDays(new Date(), Math.max(35, horizonWeeks * 7 + 7));
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
  }, [selectedStudentId, calendarRange, settingsQuery.data?.availabilityWeeks]);

  // ── Query hooks (data from cache on cold start, background refetch) ──
  const appointmentsQuery = useAppointments(appointmentParams);
  const bookingOptionsQuery = useBookingOptions(selectedStudentId);

  // Derive data from hooks (fallback to empty/null for loading state)
  const allAppointments = appointmentsQuery.data;

  // No optimistic overlay: the list shows exactly what the BE returns. After a
  // booking/cancel, the flow awaits the mutation + refetch before updating the UI.
  const appointments = useMemo(() => {
    const base = allAppointments ?? [];
    return base.filter((item) =>
      selectedStudentId ? item.studentId === selectedStudentId : true,
    );
  }, [allAppointments, selectedStudentId]);

  const settings = settingsQuery.data ?? null;
  const bookingOptions = bookingOptionsQuery.data ?? null;

  // Derive loading states from hooks
  const loading = appointmentsQuery.isLoading && !appointmentsQuery.data;
  const rangeLoading = appointmentsQuery.isFetching && !!appointmentsQuery.data;
  const studentDataReady = !!appointmentsQuery.data || appointmentsQuery.isError;

  // ── Invalidation helper (replaces loadData) ──
  // Returns a promise that resolves once the refetch lands, so booking/cancel
  // flows can await it and update the UI only when the BE data is in.
  const invalidateAllData = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['appointments'] }),
      queryClient.invalidateQueries({ queryKey: ['autoscuola-settings'] }),
      queryClient.invalidateQueries({ queryKey: ['booking-options'] }),
    ]);
  }, [queryClient]);

  // ── Mutation hooks ──
  const bookSlotMutation = useBookSlot();
  const cancelMutation = useCancelAppointment();

  const triggerBookingCelebration = useCallback(() => {
    setBookingCelebrationVisible(false);
    setTimeout(() => {
      setBookingCelebrationVisible(true);
    }, 0);
  }, []);

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
    // Blocco prenotazioni (manuale o automatico per debito): fermalo qui con un
    // messaggio chiaro invece di lasciarlo cercare slot destinati al rifiuto.
    if (studentBookingBlocked) {
      setToast({ text: 'Le tue prenotazioni sono temporaneamente sospese. Contatta la segreteria.', tone: 'danger' });
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
      searchError: null,
      preferredDateAvailable,
      availableDurations,
      availableLessonTypes,
      canSelectLessonType,
      canSelectInstructor,
      isLockedToInstructor,
      assignedInstructorName,
      instructors,
      instructorsByDate: dateAvailability.instructorsByDate,
      availabilityDates: dateAvailability.dates,
      calendarMonths,
      bookingMaxDate,
      bookedDatesSet,
      unavailableDatesSet,
      onSearchSlots: () => {
        const s = bookingFlowStore.get();
        if (!s || !selectedStudentId) return;
        bookingFlowStore.set({ loading: true, searchError: null });
        regloApi.getAvailableSlots({
          studentId: selectedStudentId,
          date: toDateString(s.preferredDate),
          durationMinutes: s.durationMinutes,
          ...(canSelectLessonType ? { lessonType: s.selectedLessonTypes[0], types: s.selectedLessonTypes } : {}),
          ...(s.selectedInstructorId ? { instructorId: s.selectedInstructorId } : {}),
        }).then((slots) => {
          bookingFlowStore.set({ slots, slotsLoading: false, loading: false, selectedSlot: null });
          router.push('/(tabs)/home/booking-slots');
        }).catch((err) => {
          // Rifiuto gestito dal server (blocco prenotazioni, cutoff, …) o errore
          // di rete: mai silenzioso — il messaggio compare nel foglio sopra la CTA.
          bookingFlowStore.set({
            slots: [], slotsLoading: false, loading: false,
            searchError: err instanceof Error && err.message && err.message !== 'Request failed'
              ? err.message
              : 'Ricerca non riuscita. Controlla la connessione e riprova.',
          });
        });
      },
      onConfirmBooking: () => {
        const s = bookingFlowStore.get();
        if (!s?.selectedSlot || !selectedStudentId) return;
        // No optimistic insert: keep the sheet in its loading state, wait for the
        // BE + refetch, then dismiss and celebrate. The lesson appears only once
        // the server has confirmed it.
        bookingFlowStore.set({ loading: true });
        const slot = s.selectedSlot;
        // On error (weekly limit, slot taken, …) close the booking modal and show
        // the toast on the home — otherwise the slots route keeps its own confirm
        // spinner running (it lives in the route, not here) and the toast would be
        // hidden behind the modal.
        const closeWithError = (msg: string) => {
          // Due form sheet (Prenota → Orari): si chiude tutta la pila fino alla home.
          router.dismissTo('/(tabs)/home');
          bookingFlowStore.clear();
          setToast({ text: msg, tone: 'danger' });
        };
        regloApi.createBookingRequest({
          studentId: selectedStudentId,
          preferredDate: toDateString(s.preferredDate),
          durationMinutes: s.durationMinutes,
          ...(canSelectLessonType ? { lessonType: s.selectedLessonTypes[0], types: s.selectedLessonTypes } : {}),
          ...(s.selectedInstructorId ? { instructorId: s.selectedInstructorId } : {}),
          selectedStartsAt: slot.startsAt,
          ...slotLocationParam(slot),
        }).then(async (response) => {
          if (response.matched) {
            await invalidateAllData();
            // Due form sheet (Prenota → Orari): si chiude tutta la pila fino alla home.
          router.dismissTo('/(tabs)/home');
            bookingFlowStore.clear();
            triggerBookingCelebration();
            return;
          }
          await invalidateAllData();
          closeWithError('Slot non più disponibile. Riprova.');
        }).catch((err) => {
          // Surface the server message (e.g. the weekly-limit rejection
          // "Hai raggiunto il limite massimo di N guide settimanali…").
          closeWithError(err instanceof Error ? err.message : 'Errore nella prenotazione');
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
      // No optimistic insert: await the booking + refetch (the mutation invalidates
      // on success), then close and celebrate. The lesson appears only once the BE
      // has confirmed it.
      await bookSlotMutation.mutateAsync({
        studentId: selectedStudentId,
        preferredDate: toDateString(preferredDate),
        selectedStartsAt: bookingSelectedSlot.startsAt,
        ...slotLocationParam(bookingSelectedSlot),
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
  // Group lessons: feature on for the school AND this student opted in.
  const groupLessonsEligible =
    settings?.groupLessonsEnabled === true && selectedStudent?.groupLessonsOptIn === true;
  // Prefer cluster-resolved setting over company default.
  // Fail-closed default: hide the "Annulla guida" button when bookingOptions is
  // not yet loaded (loading / stale persisted cache / query error). Showing the
  // button to a student whose school disabled cancellations would let them click
  // through to a backend rejection — bad UX. We'd rather hide for a beat and
  // reveal once we have the authoritative value from the server.
  const canCancelAppointments = bookingOptions?.studentCancellationEnabled === true;
  const effectiveAppBookingActors = bookingOptions?.appBookingActors ?? settings?.appBookingActors;
  const studentBookingDisabledByPolicy = effectiveAppBookingActors === 'instructors';
  // Blocco prenotazioni lato allievo (manuale del titolare o auto per debito).
  const studentBookingBlocked = bookingOptions?.bookingBlocked === true;
  const canBook = !!bookingOptions && !studentBookingDisabledByPolicy;
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

  // Refetch appointments whenever the Home tab regains focus (or the app opens
  // on it). focusManager only fires on OS-level app foreground and respects
  // staleTime, so a booking made elsewhere (e.g. an exam booked from the web
  // while the app stayed open) wouldn't show up. Forcing a refetch on focus
  // makes returning to Home always reflect the current schedule.
  // Open group-lesson count for the home "Guide di gruppo" CTA. Refetched on
  // mount, on focus (so returning from the invites screen after an accept/decline
  // updates the badge), and on pull-to-refresh.
  const refreshGroupInvitesCount = useCallback(async () => {
    if (!groupLessonsEligible || !selectedStudentId) {
      setGroupInvitesCount(null);
      return;
    }
    try {
      // countOnly: badge number only, no ensure-invite writes server-side.
      const list = await regloApi.getGroupLessonInvites(selectedStudentId, 100, true);
      const items = Array.isArray(list)
        ? list.slice().sort((x, y) => new Date(x.startsAt).getTime() - new Date(y.startsAt).getTime())
        : [];
      setGroupInvites(items);
      setGroupInvitesCount(items.length);
    } catch {
      setGroupInvites([]);
      setGroupInvitesCount(0);
    }
  }, [groupLessonsEligible, selectedStudentId]);

  useFocusEffect(
    useCallback(() => {
      if (!selectedStudentId) return;
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      // Prenotazione «solo eccezioni»: se l'autoscuola cambia modalità la home
      // deve saperlo al ritorno, non dopo i 10 minuti di cache.
      queryClient.invalidateQueries({ queryKey: queryKeys.bookingOptions(activeCompanyId, selectedStudentId) });
      void refreshGroupInvitesCount();
    }, [queryClient, selectedStudentId, refreshGroupInvitesCount, activeCompanyId]),
  );

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

  // Initial / dependency-driven fetch of the group-lesson count.
  useEffect(() => {
    void refreshGroupInvitesCount();
  }, [refreshGroupInvitesCount]);

  // My active swap requests (background): mark the lessons I asked to swap.
  const refreshMySwaps = useCallback(async () => {
    if (!swapEnabled || !selectedStudentId) {
      setMySwapByAppointment(new Map());
      return;
    }
    try {
      const list = await regloApi.getMySwapOffers(selectedStudentId);
      const map = new Map<string, string>();
      (Array.isArray(list) ? list : []).forEach((o) => map.set(o.appointmentId, o.id));
      setMySwapByAppointment(map);
    } catch {
      // non-blocking
    }
  }, [swapEnabled, selectedStudentId]);

  useEffect(() => {
    refreshMySwaps();
  }, [refreshMySwaps]);

  // Re-sync swap markers when another screen mutates swaps (e.g. revoke/accept
  // from the Scambi section emits emitDataChanged).
  useEffect(() => {
    return notificationEvents.onDataChanged(() => {
      refreshMySwaps();
    });
  }, [refreshMySwaps]);

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

    // Exclude exams and group lessons — group lessons render in their own
    // teal section (see `upcomingGroupLessons`), not the hero/mini cards.
    const lessons = confirmed.filter((item) => {
      const t = (item.type ?? '').trim().toLowerCase();
      return t !== 'esame' && t !== 'group_lesson';
    });

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

  // Upcoming group lessons the student is enrolled in (own teal section).
  const upcomingGroupLessons = useMemo(() => {
    const now = new Date();
    return appointments
      .filter((item) => {
        const status = (item.status ?? '').trim().toLowerCase();
        const isGroup = (item.type ?? '').trim().toLowerCase() === 'group_lesson';
        return isGroup && upcomingConfirmedStatuses.has(status) && !!item.groupLessonId;
      })
      .filter((item) => {
        const start = new Date(item.startsAt);
        const end = item.endsAt ? new Date(item.endsAt) : new Date(start.getTime() + 60 * 60 * 1000);
        return now < end; // keep in-progress + future
      })
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  }, [appointments]);

  // Seat counts (+ kind, for the orange moto tint) for the upcoming group
  // lessons (student-safe; names hidden).
  const [groupSeats, setGroupSeats] = useState<Record<string, { filled: number; capacity: number; kind?: string }>>({});
  useEffect(() => {
    const ids = Array.from(
      new Set(upcomingGroupLessons.map((a) => a.groupLessonId).filter(Boolean)),
    ) as string[];
    if (!ids.length) {
      setGroupSeats({});
      return;
    }
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        ids.map(async (id) => {
          try {
            const gl = await regloApi.getGroupLesson(id);
            if (gl) return [id, { filled: gl.filledSeats, capacity: gl.capacity, kind: gl.kind }] as const;
          } catch {
            // ignore — render the card without dots
          }
          return null;
        }),
      );
      if (cancelled) return;
      const map: Record<string, { filled: number; capacity: number; kind?: string }> = {};
      for (const e of entries) if (e) map[e[0]] = e[1];
      setGroupSeats(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [upcomingGroupLessons]);

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
    // The availability map covers the whole bookable range. If this date is not
    // in `dates` yet, the map simply hasn't loaded → show all (avoid a flash).
    if (!(dateKey in dateAvailability.dates)) return instructors;
    // Loaded: a missing `instructorsByDate` entry means NO instructor is
    // available that day (holiday / everyone on leave), not "unknown" → none.
    const availableIds = dateAvailability.instructorsByDate[dateKey] ?? [];
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

  // Keep the booking-flow store's raw inputs fresh while the sheet is open: the
  // date-availability prefetch can resolve AFTER the sheet was opened, and the
  // sheet recomputes its own visible-instructor list from these on every date
  // change. Without this, the list stays frozen at the value seeded on open.
  useEffect(() => {
    if (!bookingFlowStore.get()) return;
    bookingFlowStore.set({
      instructors,
      instructorsByDate: dateAvailability.instructorsByDate,
      availabilityDates: dateAvailability.dates,
      unavailableDatesSet,
      bookedDatesSet,
    });
  }, [instructors, dateAvailability, unavailableDatesSet, bookedDatesSet]);

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

    // No optimistic insert: keep the modal open with its spinner, wait for the BE
    // + refetch, then close and celebrate on success. The lesson appears only once
    // the server has confirmed it.
    const slot = bookingSelectedSlot;
    try {
      const response = await regloApi.createBookingRequest({
        studentId: selectedStudentId,
        preferredDate: toDateString(preferredDate),
        durationMinutes,
        ...(canSelectLessonType ? { lessonType: selectedLessonTypes[0], types: selectedLessonTypes } : {}),
        ...(selectedInstructorId ? { instructorId: selectedInstructorId } : {}),
        selectedStartsAt: slot.startsAt,
        ...slotLocationParam(slot),
      });
      if (response.matched) {
        await invalidateAllData();
        setBookingOpen(false);
        setBookingSelectedSlot(null);
        setBookingSlots([]);
        triggerBookingCelebration();
        return;
      }
      setToast({ text: 'Slot non più disponibile. Riprova.', tone: 'danger' });
      await invalidateAllData();
    } catch (err) {
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
    // No optimistic marker: the spinner (creatingSwap) covers the wait; the swap
    // marker appears from the BE once refreshMySwaps lands.
    try {
      await regloApi.createSwapOffer(appointmentId);
      await refreshMySwaps();
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

  const handleRevokeSwap = async (offerId: string) => {
    if (!selectedStudentId) return;
    setToast(null);
    // No optimistic drop: wait for the BE, then refresh the markers from it.
    try {
      await regloApi.cancelSwapOffer(offerId, selectedStudentId);
      await refreshMySwaps();
      setToast({ text: 'Richiesta di sostituzione revocata', tone: 'info' });
    } catch (err) {
      setToast({
        text: err instanceof Error ? err.message : 'Errore durante la revoca',
        tone: 'danger',
      });
    }
  };

  const executeCancel = async (appointmentId: string) => {
    setToast(null);
    setCancellingAppointmentId(null);
    // No optimistic removal: the cancel mutation invalidates + refetches on settle,
    // so the lesson drops once the BE confirms it.
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

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setToast(null);
    try {
      await loadStudents();
      invalidateAllData();
      notificationEvents.requestRefresh();
      await refreshGroupInvitesCount();
    } catch (err) {
      setToast({
        text: err instanceof Error ? err.message : 'Errore nel refresh',
        tone: 'danger',
      });
    } finally {
      setRefreshing(false);
    }
  }, [invalidateAllData, loadStudents, refreshGroupInvitesCount]);

  const openLessonDetail = useCallback((lesson: AutoscuolaAppointmentWithRelations) => {
    const status = (lesson.status ?? '').trim().toLowerCase();
    const isFutureActive = upcomingConfirmedStatuses.has(status) && new Date(lesson.startsAt).getTime() > Date.now();
    // Group-lesson seats and exams are never swappable (the BE rejects them
    // too): a swap would bypass the group opt-in/seat rules.
    const type = (lesson.type ?? '').trim().toLowerCase();
    const swappableType = !lesson.groupLessonId && type !== 'group_lesson' && type !== 'esame';
    lessonDetailStore.set({
      lesson,
      canSwap: swappableType && isFutureActive && ['scheduled', 'confirmed'].includes(status) && !!(bookingOptions?.swapEnabled ?? settings?.swapEnabled),
      canCancel: isFutureActive && !!canCancelAppointments,
      vehiclesEnabled: settings?.vehiclesEnabled !== false,
      activeSwapOfferId: mySwapByAppointment.get(lesson.id) ?? null,
      onSwap: handleCreateSwap,
      onCancel: handleCancel,
      onRevokeSwap: handleRevokeSwap,
    });
    router.push('/(tabs)/home/lesson-detail');
  }, [bookingOptions, settings, canCancelAppointments, mySwapByAppointment, handleCreateSwap, handleCancel, handleRevokeSwap, router]);

  const openGroupLessonDetail = useCallback((appt: AutoscuolaAppointmentWithRelations) => {
    if (!appt.groupLessonId) return;
    groupLessonStudentStore.set({
      groupLessonId: appt.groupLessonId,
      cutoffHours: settings?.penaltyCutoffHoursPreset ?? 0,
      penaltyEnabled: !!(settings?.autoPaymentsEnabled || settings?.lessonCreditFlowEnabled),
      onChanged: invalidateAllData,
    });
    router.push('/(tabs)/home/group-lesson-detail');
  }, [settings, invalidateAllData, router]);

  const formatInstructorInitials = (name: string | null | undefined) => {
    if (!name) return 'Da assegnare';
    const parts = name.trim().split(/\s+/);
    if (parts.length < 2) return name;
    return `${parts[0]} ${parts[parts.length - 1][0]}.`;
  };


  // ── Prenotazione «solo eccezioni»: stato deciso dal server ──
  const bookingPolicy = useMemo(() => resolveStudentBookingPolicy(bookingOptions), [bookingOptions]);
  const policyMode = bookingPolicy?.mode ?? null;
  const policyHold = bookingPolicy?.hold ?? null;

  // Offerte «slot liberato» attive (il server restituisce solo quelle che
  // questo allievo può prendere). Ricaricate al focus e a ogni evento push.
  const [liveOffers, setLiveOffers] = useState<AutoscuolaWaitlistOfferWithSlot[]>([]);
  const refreshLiveOffers = useCallback(async () => {
    if (!selectedStudentId) return;
    try {
      const list = await regloApi.getWaitlistOffers(selectedStudentId, 5);
      setLiveOffers(Array.isArray(list) ? list : []);
    } catch {
      setLiveOffers([]);
    }
  }, [selectedStudentId]);

  // Ultimo minuto: quanti orari liberi nella finestra e il primo.
  const [lastMinute, setLastMinute] = useState<{ count: number; first: string | null } | null>(null);
  const lastMinuteUntil = bookingPolicy?.lastMinuteUntil ?? null;
  const refreshLastMinute = useCallback(async () => {
    if (!selectedStudentId || !lastMinuteUntil || policyHold) {
      setLastMinute(null);
      return;
    }
    const until = new Date(lastMinuteUntil);
    const duration = availableDurations.includes(60) ? 60 : availableDurations[0] ?? 60;
    const days: string[] = [];
    // Giorni dalla mezzanotte di oggi: conta anche domani se la finestra ci arriva
    // (la finestra può finire prima dell'ora attuale del giorno dopo).
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let d = today; d < until && days.length < 8; d = addDays(d, 1)) days.push(toDateString(d));
    try {
      const lists = await Promise.all(
        days.map((date) =>
          regloApi
            .getAvailableSlots({ studentId: selectedStudentId, date, durationMinutes: duration })
            .catch(() => [] as AvailableSlot[]),
        ),
      );
      const all = lists
        .flat()
        .filter((slot) => new Date(slot.startsAt).getTime() > Date.now())
        .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
      setLastMinute({ count: all.length, first: all[0]?.startsAt ?? null });
    } catch {
      setLastMinute(null);
    }
  }, [selectedStudentId, lastMinuteUntil, policyHold, availableDurations]);

  useFocusEffect(
    useCallback(() => {
      void refreshLiveOffers();
      void refreshLastMinute();
    }, [refreshLiveOffers, refreshLastMinute]),
  );
  useEffect(() => {
    return notificationEvents.onDataChanged(() => {
      void refreshLiveOffers();
      void refreshLastMinute();
    });
  }, [refreshLiveOffers, refreshLastMinute]);

  const openSlotOffer = useCallback(
    (offerId: string) => router.push({ pathname: '/(tabs)/home/slot-offer', params: { offerId } }),
    [router],
  );

  // ── Numeri e frasi della home ──
  const firstName = selectedStudent?.firstName ?? 'Allievo';
  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h >= 5 && h < 13) return 'Buongiorno';
    if (h >= 13 && h < 18) return 'Buon pomeriggio';
    return 'Buonasera';
  }, []);

  const pastLessons = useMemo(() => {
    const now = Date.now();
    return appointments
      .filter((a) => {
        const status = (a.status ?? '').trim().toLowerCase();
        const type = (a.type ?? '').trim().toLowerCase();
        if (status === 'cancelled' || type === 'esame') return false;
        const end = a.endsAt ? new Date(a.endsAt).getTime() : new Date(a.startsAt).getTime() + 3600000;
        return end < now;
      })
      .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());
  }, [appointments]);

  const lessonsThisWeek = useMemo(() => {
    const now = new Date();
    const monday = new Date(now);
    monday.setHours(0, 0, 0, 0);
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    const next = addDays(monday, 7).getTime();
    return [...upcoming, ...upcomingGroupLessons].filter((a) => {
      const t = new Date(a.startsAt).getTime();
      return t >= monday.getTime() && t < next;
    }).length;
  }, [upcoming, upcomingGroupLessons]);

  const featuredOffer = liveOffers[0] ?? null;

  const mood = useMemo(() => {
    // Con la card esame la frase sotto il nome sparisce (anteprima 1i/1j).
    if (nextExam && examCountdown) return null;
    if (policyHold === 'blocked') return 'Le guide che hai già fissato restano valide.';
    if (featuredOffer) return 'Si è liberato un posto: prendilo prima degli altri.';
    if (policyMode === 'exceptions') return 'Le guide le fissa la tua autoscuola.';
    if (policyMode === 'closed') return 'La tua autoscuola organizza le guide per te.';
    if (lessonsThisWeek >= 2) return `Questa settimana guidi ${lessonsThisWeek} volte. Bel ritmo!`;
    if (lessonsThisWeek === 1) return 'Questa settimana hai una guida. Buona strada!';
    if (upcoming.length) return 'La prossima guida ti aspetta.';
    return 'Prenota la tua prossima guida quando vuoi.';
  }, [policyHold, featuredOffer, policyMode, lessonsThisWeek, upcoming.length, nextExam, examCountdown]);

  const instructorInitials = (name: string | null | undefined) => {
    if (!name) return null;
    const parts = name.trim().split(/\s+/);
    return `${parts[0]?.[0] ?? ''}${parts.length > 1 ? parts[parts.length - 1][0] : ''}`.toUpperCase();
  };
  const timeRange = (a: { startsAt: string; endsAt?: string | null }) =>
    `${formatTime(a.startsAt)}${a.endsAt ? ` – ${formatTime(a.endsAt)}` : ''}`;
  const longDay = (iso: string) => {
    const d = new Date(iso);
    const txt = d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
    return txt.charAt(0).toUpperCase() + txt.slice(1);
  };
  const shortDay = (iso: string) => {
    const d = new Date(iso);
    const wd = d.toLocaleDateString('it-IT', { weekday: 'long' });
    return `${wd.charAt(0).toUpperCase() + wd.slice(1)} ${d.getDate()}`;
  };

  // ── Righe e sezioni ──
  const lessonRows = useMemo<HomeLessonRow[]>(() => {
    const list = [...upcoming.slice(1), ...upcomingGroupLessons]
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
      .slice(0, 3);
    return list.map((l) => {
      const d = new Date(l.startsAt);
      const isGroup = !!l.groupLessonId;
      const wd = d.toLocaleDateString('it-IT', { weekday: 'long' });
      const who = isGroup ? 'Guida di gruppo' : l.instructor?.name ?? 'Istruttore da assegnare';
      const extra = mySwapByAppointment.has(l.id)
        ? 'sostituzione richiesta'
        : l.types?.length
          ? formatLessonType(l.types[0]).toLowerCase()
          : l.endsAt
            ? `${Math.round((new Date(l.endsAt).getTime() - d.getTime()) / 60000)} min`
            : null;
      return {
        key: l.id,
        dayNum: String(d.getDate()),
        month: d.toLocaleDateString('it-IT', { month: 'short' }).replace('.', ''),
        title: `${wd.charAt(0).toUpperCase() + wd.slice(1)} · ${timeRange(l)}`,
        subtitle: extra ? `${who} · ${extra}` : who,
        onPress: () => (isGroup ? openGroupLessonDetail(l) : openLessonDetail(l)),
      };
    });
  }, [upcoming, upcomingGroupLessons, mySwapByAppointment, openGroupLessonDetail, openLessonDetail]);

  const pastRows = useMemo<HomeLessonRow[]>(
    () =>
      pastLessons.slice(0, 3).map((l) => {
        const d = new Date(l.startsAt);
        const wd = d.toLocaleDateString('it-IT', { weekday: 'long' });
        return {
          key: l.id,
          dayNum: String(d.getDate()),
          month: d.toLocaleDateString('it-IT', { month: 'short' }).replace('.', ''),
          title: `${wd.charAt(0).toUpperCase() + wd.slice(1)} · ${timeRange(l)}`,
          subtitle: l.instructor?.name ?? 'Guida',
          onPress: () => openLessonDetail(l),
        };
      }),
    [pastLessons, openLessonDetail],
  );

  const openAllLessons = useCallback(() => {
    allLessonsStore.set({ lessons: upcoming, studentId: selectedStudentId, onOpenDetail: openLessonDetail });
    router.push('/(tabs)/home/all-lessons');
  }, [upcoming, selectedStudentId, openLessonDetail, router]);

  const openExam = useCallback(() => {
    if (!nextExam || !examCountdown) return;
    examDetailStore.set({ exam: nextExam, countdown: examCountdown });
    router.push('/(tabs)/home/exam-detail');
  }, [nextExam, examCountdown, router]);

  const tiles = useMemo<HomeTile[]>(() => {
    const out: HomeTile[] = [];
    if (pastLessons.length) {
      out.push({
        key: 'done',
        icon: HOME_ART.volante,
        value: `${pastLessons.length} ${pastLessons.length === 1 ? 'guida' : 'guide'}`,
        label: 'già fatte',
      });
    }
    // L'esame ha la sua card in cima: qui non si ripete.
    if (policyMode === 'closed' && pastLessons[0]) {
      const wd = new Date(pastLessons[0].startsAt).toLocaleDateString('it-IT', { weekday: 'short' }).replace('.', '');
      out.push({ key: 'last', icon: HOME_ART.agenda, value: wd.charAt(0).toUpperCase() + wd.slice(1), label: 'ultima guida' });
    }
    return out;
  }, [pastLessons, policyMode]);

  const bookingCases = useMemo<BookingCaseItem[]>(() => {
    if (!bookingPolicy) return [];
    const icons = { slotFill: HOME_ART.campanella, groupSeats: HOME_ART.persone, lastMinute: HOME_ART.orologio };
    return bookingExceptionCases(bookingPolicy).map((c) => ({ ...c, icon: icons[c.key] }));
  }, [bookingPolicy]);

  const canTakeGroupSeats =
    groupLessonsEligible &&
    !policyHold &&
    (policyMode === 'open' || (policyMode === 'exceptions' && !!bookingPolicy?.exceptions.groupSeats));
  const firstGroupInvite = groupInvites[0] ?? null;

  const freeRows = useMemo<HomeRow[]>(() => {
    const rows: HomeRow[] = [];
    for (const offer of liveOffers.slice(1)) {
      rows.push({
        key: `offer-${offer.id}`,
        icon: HOME_ART.campanella,
        title: `${shortDay(offer.slot.startsAt)} · ${timeRange(offer.slot)}`,
        subtitle: 'Si è liberato un posto',
        onPress: () => openSlotOffer(offer.id),
      });
    }
    if (canTakeGroupSeats && policyMode === 'exceptions' && firstGroupInvite) {
      const left = firstGroupInvite.openSeats;
      rows.push({
        key: 'group',
        icon: HOME_ART.persone,
        title: `${shortDay(firstGroupInvite.startsAt)} · ${timeRange(firstGroupInvite)}`,
        subtitle: `${firstGroupInvite.kind === 'moto' ? 'Guida di gruppo moto' : 'Guida di gruppo'} · ${
          left === 1 ? '1 posto rimasto' : `${left} posti liberi`
        }${groupInvites.length > 1 ? ` · altre ${groupInvites.length - 1}` : ''}`,
        onPress: () => router.push('/(tabs)/home/group-lesson-invites'),
      });
    }
    if (lastMinute && lastMinute.count > 0 && bookingPolicy) {
      const first = lastMinute.first ? new Date(lastMinute.first) : null;
      const isToday = first ? toDateString(first) === toDateString(new Date()) : false;
      rows.push({
        key: 'last-minute',
        icon: HOME_ART.orologio,
        title: `Prossime ${bookingPolicy.exceptions.lastMinuteHours} ore`,
        subtitle: first
          ? `${lastMinute.count} ${lastMinute.count === 1 ? 'orario' : 'orari'}, il primo ${
              isToday ? 'oggi' : first.toLocaleDateString('it-IT', { weekday: 'long' })
            } alle ${formatTime(first.toISOString())}`
          : null,
        onPress: () => router.push('/(tabs)/home/last-minute'),
      });
    }
    return rows;
  }, [liveOffers, canTakeGroupSeats, policyMode, firstGroupInvite, groupInvites.length, lastMinute, bookingPolicy, openSlotOffer, router]);

  const moreRows = useMemo<HomeRow[]>(() => {
    const rows: HomeRow[] = [];
    if (swapEnabled && !policyHold) {
      rows.push({
        key: 'swaps',
        icon: HOME_ART.scambio,
        title: 'Scambi',
        subtitle:
          swapOffersCount == null
            ? 'Guide lasciate da altri allievi'
            : swapOffersCount > 0
              ? `${swapOffersCount} ${swapOffersCount === 1 ? 'guida disponibile' : 'guide disponibili'} da altri allievi`
              : 'Nessuna guida da prendere al momento',
        onPress: () => router.push('/(tabs)/home/swaps'),
      });
    }
    if (canTakeGroupSeats && policyMode === 'open') {
      rows.push({
        key: 'groups',
        icon: HOME_ART.persone,
        title: 'Guide di gruppo',
        subtitle:
          groupInvitesCount == null
            ? 'Guide in compagnia di altri allievi'
            : groupInvitesCount > 0
              ? `${groupInvitesCount} ${groupInvitesCount === 1 ? 'posto libero' : 'posti liberi'} per te`
              : 'Nessun posto libero al momento',
        onPress: () => router.push('/(tabs)/home/group-lesson-invites'),
      });
    }
    if (isLockedToInstructor && assignedInstructorName && weeklyAbsenceEnabled) {
      rows.push({
        key: 'absence',
        icon: HOME_ART.agenda,
        title: weeklyAbsenceDeclared ? 'Assenza segnalata' : 'Sarai assente questa settimana?',
        subtitle: weeklyAbsenceDeclared ? `L'abbiamo detto a ${assignedInstructorName}` : `Avvisa ${assignedInstructorName}`,
        onPress: weeklyAbsenceDeclared || weeklyAbsenceLoading ? undefined : handleDeclareAbsence,
      });
    }
    return rows;
  }, [swapEnabled, policyHold, swapOffersCount, canTakeGroupSeats, policyMode, groupInvitesCount, isLockedToInstructor, assignedInstructorName, weeklyAbsenceEnabled, weeklyAbsenceDeclared, weeklyAbsenceLoading, handleDeclareAbsence, router]);

  // ── Home con l'esame: numero grande, una riga, la linea Oggi→Esame ──
  const examHome = useMemo(() => {
    if (!nextExam || !examCountdown) return null;
    const days = examCountdown.days;
    const examStart = new Date(nextExam.startsAt);
    const mon = (d: Date) => d.toLocaleDateString('it-IT', { month: 'short' }).replace('.', '');
    const place = nextExam.location?.name ?? null;
    const whenLine = [
      `${examStart.getDate()} ${mon(examStart)}`,
      // «9:30», non «09:30» (come l'anteprima approvata).
      examTimeIsTbd(nextExam) ? 'orario da definire' : `${examStart.getHours()}:${String(examStart.getMinutes()).padStart(2, '0')}`,
      place,
    ]
      .filter(Boolean)
      .join(' \u00B7 ');
    const now = Date.now();
    const span = Math.max(1, examStart.getTime() - now);
    const beforeExam = [...upcoming, ...upcomingGroupLessons]
      .filter((l) => {
        const t = new Date(l.startsAt).getTime();
        return t >= now && t < examStart.getTime();
      })
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
    const lessonPositions = beforeExam.map((l) => (new Date(l.startsAt).getTime() - now) / span);
    let compact: { kicker: string; title: string } | null = null;
    if (nextLesson) {
      const d = new Date(nextLesson.startsAt);
      const wd = d.toLocaleDateString('it-IT', { weekday: 'short' }).replace('.', '');
      const isLast = beforeExam.length === 1 && beforeExam[0].id === nextLesson.id;
      const when = nextLessonCountdown ? ` \u00B7 ${nextLessonCountdown.toLowerCase()}` : '';
      compact = {
        kicker: `${isLast ? 'Ultima guida' : 'Prossima guida'}${when}`,
        title: `${wd.charAt(0).toUpperCase() + wd.slice(1)} ${d.getDate()} ${mon(d)} \u00B7 ${timeRange(nextLesson)}`,
      };
    }
    return {
      big: days <= 0 ? 'Oggi' : String(days),
      unit: days <= 0 ? "è il giorno dell'esame" : days === 1 ? "giorno all'esame" : "giorni all'esame",
      whenLine,
      lessonPositions,
      compact,
    };
  }, [nextExam, examCountdown, upcoming, upcomingGroupLessons, nextLesson, nextLessonCountdown]);

  const callInstructor = useCallback(() => {
    if (!assignedInstructorPhone) return;
    void Linking.openURL(`tel:${assignedInstructorPhone.replace(/\s+/g, '')}`);
  }, [assignedInstructorPhone]);
  const instructorFirstName = assignedInstructorName?.trim().split(/\s+/)[0] ?? null;

  const { scrollY, onScroll } = useLargeTitleScroll();
  // Se booking-options fallisce la home si mostra lo stesso (senza bottoni di prenotazione).
  const dataReady = studentsLoaded && studentDataReady && (!!bookingOptions || bookingOptionsQuery.isError);
  const canFreelyBook = !!bookingPolicy?.canBookFreely && policyMode === 'open';

  const nextLessonCard = nextLesson ? (
    <NextLessonCard
      when={`Prossima guida${nextLessonCountdown ? ` · ${nextLessonCountdown.toLowerCase()}` : ''}`}
      day={longDay(nextLesson.startsAt)}
      time={`${timeRange(nextLesson)}${nextLesson.location ? ` · ${nextLesson.location.name}` : ''}`}
      who={
        mySwapByAppointment.has(nextLesson.id)
          ? 'Sostituzione richiesta'
          : [nextLesson.instructor?.name ?? 'Istruttore da assegnare', nextLesson.vehicle?.name]
              .filter(Boolean)
              .join(' · ')
      }
      initials={mySwapByAppointment.has(nextLesson.id) ? null : instructorInitials(nextLesson.instructor?.name)}
      onPress={() => openLessonDetail(nextLesson)}
    />
  ) : null;

  const emptyCard = !nextLesson ? (
    policyMode === 'closed' || policyHold ? (
      <EmptyLessonCard
        title="Nessuna guida in programma"
        text="Le guide non si prenotano dall'app. Quando l'autoscuola ne fissa una ti arriva una notifica e la trovi qui."
        action={
          assignedInstructorPhone && instructorFirstName ? (
            <CallInstructorButton name={instructorFirstName} onPress={callInstructor} />
          ) : undefined
        }
      />
    ) : policyMode === 'exceptions' ? (
      <EmptyLessonCard
        title="Nessuna guida in programma"
        text="Quando l'autoscuola ne fissa una, o prendi un posto libero, la trovi qui."
      />
    ) : (
      <EmptyLessonCard
        title="Nessuna guida in programma"
        text={
          nextExam && examCountdown
            ? `Mancano ${examCountdown.days} giorni all'esame: prenota le guide per arrivarci pronto.`
            : 'Scegli giorno e orario: la tua prima guida è a un tocco.'
        }
      />
    )
  ) : null;

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <ToastNotice message={toast?.text ?? null} tone={toast?.tone} onHide={() => setToast(null)} />
      <BookingCelebration visible={bookingCelebrationVisible} onHidden={() => setBookingCelebrationVisible(false)} />

      <ClayNavBar
        title={firstName}
        scrollY={scrollY}
        actions={
          <>
            <ClayIconButton
              icon={<Ionicons name="notifications-outline" size={21} color={CLAY.ink} />}
              onPress={() => router.push('/(tabs)/home/notifications')}
              accessibilityLabel={unreadNotifCount > 0 ? `Notifiche, ${unreadNotifCount} da leggere` : 'Notifiche'}
              testID="home-bell"
            />
            <ClayPressable kind="small" onPress={() => router.push('/(tabs)/more')} accessibilityRole="button" accessibilityLabel="Il tuo profilo">
              <Avatar userId={user?.id ?? null} name={selectedStudent ? `${selectedStudent.firstName} ${selectedStudent.lastName ?? ''}` : firstName} size={40} />
            </ClayPressable>
          </>
        }
      />

      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={CLAY.ink3} />}
      >
        <HomeGreeting greeting={greeting} name={firstName} mood={dataReady ? mood : null} />

        {!dataReady ? (
          <Animated.View exiting={FadeOut.duration(150)} style={styles.skeleton}>
            <SkeletonBlock width="100%" height={258} radius={28} />
            <View style={styles.skeletonTiles}>
              <SkeletonBlock width="48%" height={74} radius={22} />
              <SkeletonBlock width="48%" height={74} radius={22} />
            </View>
            <SkeletonBlock width="100%" height={54} radius={27} />
          </Animated.View>
        ) : (
          <Animated.View entering={FadeIn.duration(220)}>
            {/* ── Esame prenotato: è SEMPRE la card protagonista (Tiziano 10/11),
                la prossima guida scende in una card compatta subito sotto. ── */}
            {examHome ? (
              <>
                <ExamHeroCard
                  big={examHome.big}
                  unit={examHome.unit}
                  whenLine={examHome.whenLine}
                  lessonPositions={examHome.lessonPositions}
                  onPress={openExam}
                />
                {nextLesson && examHome.compact ? (
                  <CompactLessonCard
                    kicker={examHome.compact.kicker}
                    title={examHome.compact.title}
                    onPress={() => openLessonDetail(nextLesson)}
                  />
                ) : null}
              </>
            ) : null}

            {/* ── Prenotazioni in pausa ── */}
            {policyHold === 'blocked' ? (
              <PausedCard
                title="Prenotazioni in pausa"
                count={
                  bookingOptions?.bookingBlockReason === 'unpaid_threshold' && bookingOptions.unpaidLessonCount
                    ? bookingOptions.unpaidLessonCount
                    : null
                }
                countLabel={
                  bookingOptions?.bookingBlockReason === 'unpaid_threshold' && bookingOptions.unpaidLessonCount
                    ? bookingOptions.unpaidLessonCount === 1
                      ? 'guida da pagare'
                      : 'guide da pagare'
                    : 'Sospese dalla segreteria'
                }
                text={
                  bookingOptions?.bookingBlockReason === 'unpaid_threshold'
                    ? 'Finché non le saldi non puoi prenotare né prendere posti liberi. Quando paghi in segreteria si riaprono da sole.'
                    : 'Non puoi prenotare né prendere posti liberi. Per riaprirle parla con la segreteria.'
                }
              />
            ) : null}

            {/* ── Posto liberato in evidenza ── */}
            {!policyHold && featuredOffer ? (
              <LiveOfferCard
                offer={featuredOffer}
                day={`${shortDay(featuredOffer.slot.startsAt)} · ${formatTime(featuredOffer.slot.startsAt)}`}
                onTake={() => openSlotOffer(featuredOffer.id)}
              />
            ) : null}

            {/* ── Solo eccezioni senza posti: quando puoi prenotare tu ── */}
            {!policyHold && policyMode === 'exceptions' && !featuredOffer && freeRows.length === 0 && bookingCases.length ? (
              <HomeSection
                title="Quando puoi prenotare tu"
                right="Ora nessun posto"
                footer="Per tutte le altre guide chiedi in segreteria o al tuo istruttore."
              >
                <BookingCasesCard cases={bookingCases} />
              </HomeSection>
            ) : null}

            {/* ── Altri posti liberi ── */}
            {!policyHold && freeRows.length ? (
              <HomeSection
                title={featuredOffer ? 'Altri posti liberi' : 'Posti liberi'}
                footer={policyMode === 'exceptions' ? 'Questi li prenoti tu. Tutte le altre guide le fissa la tua autoscuola.' : null}
              >
                <HomeRowsList rows={freeRows} />
              </HomeSection>
            ) : null}

            {/* ── Prossima guida (o stato vuoto con l'immagine) ── */}
            <View style={policyMode === 'exceptions' && !policyHold ? styles.afterCases : undefined}>
              {examHome ? null : nextLessonCard ?? emptyCard}
            </View>

            {examHome ? null : <StatTiles tiles={tiles} />}

            {canFreelyBook ? <ClayButton title="Prenota una guida" onPress={openBookingFlow} style={styles.cta} testID="home-book" /> : null}

            {lessonRows.length ? (
              <HomeSection title="Le tue guide" right={upcoming.length > 1 ? 'Tutte' : null} onRightPress={openAllLessons}>
                <LessonsList rows={lessonRows} />
              </HomeSection>
            ) : !nextLesson && pastRows.length && policyMode !== 'open' ? (
              <HomeSection title="Guide fatte">
                <LessonsList rows={pastRows} />
              </HomeSection>
            ) : null}

            {moreRows.length ? (
              <HomeSection title="Altro">
                <HomeRowsList rows={moreRows} />
              </HomeSection>
            ) : null}

            {policyHold && policyHold !== 'blocked' ? <Text style={styles.holdNote}>{bookingHoldMessage(policyHold)}</Text> : null}
          </Animated.View>
        )}
      </Animated.ScrollView>
    </View>
  );
};

/** Posto liberato in evidenza: il conto alla rovescia vive qui (timer locale, non nella schermata). */
const OFFER_WINDOW_MS = 15 * 60 * 1000;
const LiveOfferCard = React.memo(function LiveOfferCard({
  offer,
  day,
  onTake,
}: {
  offer: AutoscuolaWaitlistOfferWithSlot;
  day: string;
  onTake: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 20000);
    return () => clearInterval(id);
  }, []);
  const leftMs = Math.max(0, new Date(offer.expiresAt).getTime() - now);
  const minutesLeft = Math.ceil(leftMs / 60000);
  const total = Math.max(OFFER_WINDOW_MS, new Date(offer.expiresAt).getTime() - new Date(offer.sentAt).getTime());
  const minutes = offer.slot.endsAt
    ? Math.round((new Date(offer.slot.endsAt).getTime() - new Date(offer.slot.startsAt).getTime()) / 60000)
    : null;
  const detail = [offer.locationName, minutes ? `${minutes} min` : null].filter(Boolean).join(' · ') || 'Guida singola';
  if (leftMs <= 0) return null;
  return <FeaturedOfferCard day={day} detail={detail} minutesLeft={minutesLeft} progress={leftMs / total} onTake={onTake} />;
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: CLAY.bg },
  scroll: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 120 },
  skeleton: { marginTop: 18, gap: 14 },
  skeletonTiles: { flexDirection: 'row', justifyContent: 'space-between' },
  afterCases: { marginTop: 6 },
  cta: { marginTop: 18 },
  holdNote: { fontSize: 13.5, lineHeight: 19, color: CLAY.ink3, marginTop: 18, paddingHorizontal: 4 },
});
