import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
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
import DateTimePicker from '@react-native-community/datetimepicker';
import { StatusBar } from 'expo-status-bar';
import * as FileSystem from 'expo-file-system/legacy';
import { useStripe } from '@stripe/stripe-react-native';
import { Screen } from '../components/Screen';
import { BottomSheet } from '../components/BottomSheet';
import { BookingCelebration } from '../components/BookingCelebration';
import { ToastNotice, ToastTone } from '../components/ToastNotice';
import { GlassBadge } from '../components/GlassBadge';
import { GlassButton } from '../components/GlassButton';
import { GlassCard } from '../components/GlassCard';
import { GlassInput } from '../components/GlassInput';
import { CalendarNavigator, CalendarNavigatorRange } from '../components/CalendarNavigator';
import { ScrollHintFab } from '../components/ScrollHintFab';
import { SkeletonBlock, SkeletonCard } from '../components/Skeleton';
import { SectionHeader } from '../components/SectionHeader';
import { useSession } from '../context/SessionContext';
import { regloApi } from '../services/regloApi';
import { subscribePushIntent } from '../services/pushNotifications';
import {
  AutoscuolaAppointmentWithRelations,
  MobileAppointmentPaymentDocument,
  MobileBookingOptions,
  MobileStudentPaymentProfile,
  AutoscuolaStudent,
  AutoscuolaSettings,
  StudentAppointmentPaymentHistoryItem,
  AutoscuolaWaitlistOfferWithSlot,
} from '../types/regloApi';
import { colors, spacing, typography } from '../theme';
import { formatDay, formatTime } from '../utils/date';
import {
  invoiceStatusLabel,
  paymentEventStatusLabel,
  paymentPhaseLabel,
  paymentStatusLabel,
} from '../utils/payment';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const upcomingConfirmedStatuses = new Set(['scheduled', 'confirmed', 'checked_in']);
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

type PickerFieldProps = {
  label: string;
  value: Date;
  mode: 'date' | 'time';
  onChange: (date: Date) => void;
};

const PickerField = ({ label, value, mode, onChange }: PickerFieldProps) => {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const isTimeField = mode === 'time';

  return (
    <View style={isTimeField ? styles.timePickerFieldWrap : undefined}>
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          isTimeField && styles.timePickerField,
          pressed && isTimeField && styles.timePickerFieldPressed,
        ]}
      >
        <View pointerEvents="none">
          <GlassInput
            editable={false}
            placeholder={label}
            value={mode === 'date' ? formatDay(value.toISOString()) : toTimeString(value)}
          />
        </View>
      </Pressable>
      {open ? (
        Platform.OS === 'ios' ? (
          <Modal transparent animationType="fade" onRequestClose={close}>
            <View style={styles.pickerBackdrop}>
              <View style={styles.pickerCard}>
                <Text style={styles.pickerTitle}>{label}</Text>
                <DateTimePicker
                  value={value}
                  mode={mode}
                  display="spinner"
                  onChange={(_, selected) => {
                    if (selected) onChange(selected);
                  }}
                />
                <GlassButton label="Fatto" onPress={close} />
              </View>
            </View>
          </Modal>
        ) : (
          <DateTimePicker
            value={value}
            mode={mode}
            display="default"
            onChange={(_, selected) => {
              setOpen(false);
              if (selected) onChange(selected);
            }}
          />
        )
      ) : null}
    </View>
  );
};



export const AllievoHomeScreen = () => {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
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
  const studentBookingDisabledByPolicy = settings?.appBookingActors === 'instructors';
  const requiresPaymentMethodForBooking = Boolean(
    paymentProfile?.autoPaymentsEnabled &&
      !paymentProfile?.hasPaymentMethod &&
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
            limit: 500,
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
    return [...appointments]
      .filter((item) => {
        const status = (item.status ?? '').trim().toLowerCase();
        return upcomingConfirmedStatuses.has(status) && new Date(item.startsAt) >= now;
      })
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  }, [appointments]);

  const paymentByAppointmentId = useMemo(
    () => new Map(paymentHistory.map((item) => [item.appointmentId, item])),
    [paymentHistory]
  );
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
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
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
  const agendaLoading = rangeLoading || loading;
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
    try {
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


  const handleCancel = async (appointmentId: string) => {
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
            tintColor={colors.navy}
            colors={[colors.navy]}
          />
        }
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Ciao, {selectedStudent?.firstName ?? 'Allievo'}</Text>
            <Text style={styles.subtitle}>
              {selectedStudent
                ? 'Gestisci le tue guide'
                : studentsLoaded
                  ? 'Profilo allievo non collegato'
                  : 'Caricamento profilo...'}
            </Text>
          </View>
          <GlassBadge label="Allievo" />
        </View>

        {!selectedStudent ? (
          <GlassCard
            title={studentsLoaded ? 'Profilo non associato' : 'Caricamento profilo'}
            subtitle={
              studentsLoaded
                ? 'Questo account STUDENT non e collegato a un allievo della company.'
                : 'Recupero dati allievo in corso.'
            }
            hierarchy="secondary"
          >
            {studentsLoaded ? (
              <Text style={styles.empty}>Contatta il titolare per collegare il tuo profilo.</Text>
            ) : null}
          </GlassCard>
        ) : !studentDataReady ? (
          <>
            <GlassCard title="Prossima guida" subtitle="Caricamento dati..." hierarchy="primary">
              <SkeletonCard>
                <SkeletonBlock width="58%" height={26} />
                <SkeletonBlock width="72%" />
                <SkeletonBlock width="64%" />
                <SkeletonBlock width={132} height={44} radius={14} style={styles.skeletonButton} />
              </SkeletonCard>
            </GlassCard>

            <GlassCard title="Prenota guida" hierarchy="secondary">
              <SkeletonCard>
                <SkeletonBlock width="34%" height={24} />
                <SkeletonBlock width="28%" height={32} />
                <SkeletonBlock width="100%" height={44} radius={14} style={styles.skeletonButton} />
              </SkeletonCard>
            </GlassCard>

            <GlassCard title="Calendario" hierarchy="tertiary">
              <SkeletonCard>
                <SkeletonBlock width="100%" height={34} radius={14} />
                <SkeletonBlock width="82%" height={28} radius={14} />
              </SkeletonCard>
            </GlassCard>

            <SectionHeader title="Agenda" hierarchy="tertiary" />
            <GlassCard hierarchy="tertiary">
              <View style={styles.agendaList}>
                {Array.from({ length: 3 }).map((_, index) => (
                  <SkeletonCard key={`agenda-skeleton-${index}`}>
                    <SkeletonBlock width="56%" height={24} />
                    <SkeletonBlock width="66%" />
                    <SkeletonBlock width="78%" />
                    <SkeletonBlock width="100%" height={42} radius={14} style={styles.skeletonButton} />
                  </SkeletonCard>
                ))}
              </View>
            </GlassCard>
          </>
        ) : (
          <>
            <GlassCard
              title="Prossima guida"
              subtitle={undefined}
              hierarchy="primary"
            >
              {nextLesson ? (
                <View style={styles.lessonRow}>
                  <View style={styles.lessonInfo}>
                    <Text style={styles.primaryLessonTime}>
                      {formatDay(nextLesson.startsAt)} · {formatTime(nextLesson.startsAt)}
                    </Text>
                    <Text style={styles.primaryLessonMeta}>
                      Istruttore: {nextLesson.instructor?.name ?? 'Da assegnare'}
                    </Text>
                    <Text style={styles.primaryLessonMeta}>
                      Veicolo: {nextLesson.vehicle?.name ?? 'Da assegnare'}
                    </Text>
                  </View>
                  <View style={styles.nextLessonActionWrap}>
                    <GlassButton
                      label={cancellingAppointmentId === nextLesson.id ? 'Annulla...' : 'Annulla'}
                      onPress={() => handleCancel(nextLesson.id)}
                      disabled={cancellingAppointmentId === nextLesson.id}
                      fullWidth
                    />
                  </View>
                </View>
              ) : (
                <Text style={styles.empty}>Nessuna guida programmata.</Text>
              )}
            </GlassCard>

            {!studentBookingDisabledByPolicy ? (
              <>
                <GlassCard title="Prenota guida" hierarchy="secondary">
                  <GlassButton
                    label={
                      paymentProfile?.blockedByInsoluti
                        ? payNowLoading
                          ? 'Attendi...'
                          : 'Salda ora'
                        : 'Prenota'
                    }
                    onPress={paymentProfile?.blockedByInsoluti ? handlePayNow : openPreferences}
                    disabled={paymentProfile?.blockedByInsoluti ? payNowLoading : requiresPaymentMethodForBooking}
                    tone="primary"
                    fullWidth
                  />
                </GlassCard>
              </>
            ) : null}

            <GlassCard title="Calendario" hierarchy="tertiary">
              <CalendarNavigator initialMode="week" onChange={setCalendarRange} />
            </GlassCard>

            <SectionHeader title="Agenda" hierarchy="tertiary" />
            <GlassCard hierarchy="tertiary">
              <View style={styles.agendaList}>
                {agendaLoading
                  ? Array.from({ length: 3 }).map((_, index) => (
                      <SkeletonCard key={`agenda-range-skeleton-${index}`}>
                        <SkeletonBlock width="56%" height={24} />
                        <SkeletonBlock width="66%" />
                        <SkeletonBlock width="78%" />
                        <SkeletonBlock width="100%" height={42} radius={14} style={styles.skeletonButton} />
                      </SkeletonCard>
                    ))
                  : visibleAgendaLessons.map((lesson) => {
                      const status = statusLabel(lesson.status);
                      const lessonPayment = paymentByAppointmentId.get(lesson.id) ?? null;
                      return (
                        <View key={lesson.id} style={styles.agendaRow}>
                          <View style={styles.agendaTop}>
                            <Text style={styles.agendaTime}>
                              {formatDay(lesson.startsAt)} · {formatTime(lesson.startsAt)}
                            </Text>
                            <GlassBadge label={status.label} tone={status.tone} />
                          </View>
                          <Text style={styles.agendaInstructor}>
                            {lesson.instructor?.name ?? 'Istruttore da assegnare'}
                          </Text>
                          <Text style={styles.agendaMeta}>
                            Veicolo: {lesson.vehicle?.name ?? 'Da assegnare'}
                          </Text>
                          {lessonPayment ? (
                            <Text style={styles.historyPaymentMeta}>
                              Pagamento: {paymentStatusLabel(lessonPayment.paymentStatus).label} · Residuo €{' '}
                              {lessonPayment.dueAmount.toFixed(2)}
                            </Text>
                          ) : null}
                          <View style={styles.agendaCtaWrap}>
                            <GlassButton
                              label="Dettagli"
                              tone="standard"
                              onPress={() => handleOpenHistoryDetails(lesson)}
                            />
                          </View>
                        </View>
                      );
                    })}
                {!agendaLoading && !agendaLessons.length ? (
                  <Text style={styles.empty}>Nessuna guida nel periodo selezionato.</Text>
                ) : null}
                {!agendaLoading && agendaLessons.length > 4 ? (
                  <View style={styles.agendaToggleWrap}>
                    <GlassButton
                      label={showAllAgendaLessons ? 'Mostra meno' : 'Mostra di più'}
                      onPress={() => setShowAllAgendaLessons((prev) => !prev)}
                      tone="standard"
                      fullWidth
                    />
                  </View>
                ) : null}
              </View>
            </GlassCard>

          </>
        )}
      </ScrollView>
      <BottomSheet
        visible={historyDetailsOpen && !!selectedHistoryLesson}
        title="Dettaglio guida"
        onClose={() => setHistoryDetailsOpen(false)}
      >
        {selectedHistoryLesson ? (
          <View style={styles.sheetScrollContainer}>
            <ScrollView
              ref={historyDetailsScrollRef}
              style={[styles.paymentDetailsScroll, { maxHeight: historyDetailsMaxHeight }]}
              contentContainerStyle={styles.sheetScrollContent}
              showsVerticalScrollIndicator={false}
              bounces={false}
              contentInsetAdjustmentBehavior="never"
              automaticallyAdjustContentInsets={false}
              automaticallyAdjustsScrollIndicatorInsets={false}
              scrollEventThrottle={16}
              onLayout={(event) =>
                setHistoryDetailsLayoutHeight(event.nativeEvent.layout.height)
              }
              onContentSizeChange={(_, height) => setHistoryDetailsContentHeight(height)}
              onScroll={(event) => setHistoryDetailsOffsetY(event.nativeEvent.contentOffset.y)}
            >
              <Text style={styles.sheetText}>
                Guida {formatDay(selectedHistoryLesson.startsAt)} · {formatTime(selectedHistoryLesson.startsAt)}
              </Text>
              <Text style={styles.sheetMeta}>
                Durata: {lessonDurationMinutes(selectedHistoryLesson)} min
              </Text>
              <Text style={styles.sheetMeta}>
                Istruttore: {selectedHistoryLesson.instructor?.name ?? 'Da assegnare'}
              </Text>
              <Text style={styles.sheetMeta}>Veicolo: {selectedHistoryLesson.vehicle?.name ?? 'Da assegnare'}</Text>
              <Text style={styles.sheetMeta}>
                Stato guida: {statusLabel(selectedHistoryLesson.status).label}
              </Text>
              <Text style={styles.sheetDivider}>Pagamento</Text>
              {selectedHistoryPayment ? (
                <>
                  <Text style={styles.sheetMeta}>
                    Stato pagamento: {paymentStatusLabel(selectedHistoryPayment.paymentStatus).label}
                  </Text>
                  <Text style={styles.sheetMeta}>Prezzo guida: € {selectedHistoryPayment.priceAmount.toFixed(2)}</Text>
                  <Text style={styles.sheetMeta}>Penale: € {selectedHistoryPayment.penaltyAmount.toFixed(2)}</Text>
                  <Text style={styles.sheetMeta}>
                    Totale dovuto: € {selectedHistoryPayment.finalAmount.toFixed(2)}
                  </Text>
                  <Text style={styles.sheetMeta}>Pagato: € {selectedHistoryPayment.paidAmount.toFixed(2)}</Text>
                  <Text style={styles.sheetMeta}>Residuo: € {selectedHistoryPayment.dueAmount.toFixed(2)}</Text>
                  <Text style={styles.sheetMeta}>
                    Fattura: {invoiceStatusLabel(selectedHistoryPayment.invoiceStatus)}
                  </Text>
                  <View style={styles.paymentDocumentActions}>
                    <View style={styles.paymentDocumentActionWrap}>
                      <GlassButton
                        label={historyDocumentBusy === 'view' ? 'Apertura...' : 'Visualizza documento'}
                        onPress={handleOpenPaymentDocument}
                        disabled={Boolean(historyDocumentBusy)}
                        fullWidth
                      />
                    </View>
                    <View style={styles.paymentDocumentActionWrap}>
                      <GlassButton
                        label={historyDocumentBusy === 'share' ? 'Condivisione...' : 'Condividi documento'}
                        onPress={handleSharePaymentDocument}
                        disabled={Boolean(historyDocumentBusy)}
                        fullWidth
                      />
                    </View>
                  </View>
                  <Text style={styles.sheetDivider}>Tentativi di addebito</Text>
                  <View style={styles.paymentEventsList}>
                    {selectedHistoryPayment.payments.map((payment) => {
                      const paymentEventStatus = paymentEventStatusLabel(payment.status);
                      return (
                        <View key={payment.id} style={styles.paymentEventRow}>
                          <View style={styles.paymentEventMain}>
                            <Text style={styles.paymentEventTitle}>
                              {paymentPhaseLabel(payment.phase)} · € {payment.amount.toFixed(2)}
                            </Text>
                            <Text style={styles.paymentEventMeta}>
                              {formatDay(payment.paidAt ?? payment.createdAt)} ·{' '}
                              {formatTime(payment.paidAt ?? payment.createdAt)}
                            </Text>
                            {payment.failureMessage ? (
                              <Text style={styles.paymentEventMeta}>{payment.failureMessage}</Text>
                            ) : null}
                          </View>
                          <GlassBadge label={paymentEventStatus.label} tone={paymentEventStatus.tone} />
                        </View>
                      );
                    })}
                    {!selectedHistoryPayment.payments.length ? (
                      <Text style={styles.empty}>Nessun tentativo registrato.</Text>
                    ) : null}
                  </View>
                </>
              ) : (
                <Text style={styles.sheetMeta}>
                  Nessun dettaglio pagamento disponibile per questa guida.
                </Text>
              )}
            </ScrollView>
            {showHistoryScrollDown ? (
              <ScrollHintFab
                direction="down"
                style={styles.scrollHintBottom}
                onPress={() => handleHistoryDetailsQuickScroll('down')}
              />
            ) : null}
            {showHistoryScrollUp ? (
              <ScrollHintFab
                direction="up"
                style={styles.scrollHintTop}
                onPress={() => handleHistoryDetailsQuickScroll('up')}
              />
            ) : null}
          </View>
        ) : null}
      </BottomSheet>
      <BottomSheet
        visible={proposalAppointmentOpen && !!pendingProposal}
        title="Nuova proposta guida"
        onClose={() => {
          if (!proposalAppointmentLoading) setProposalAppointmentOpen(false);
        }}
        closeDisabled={proposalAppointmentLoading}
        footer={
          <View style={styles.sheetActionsDock}>
            <View style={styles.fullWidthButtonWrap}>
              <GlassButton
                label={proposalAppointmentLoading ? 'Attendi...' : 'Accetta'}
                tone="primary"
                onPress={proposalAppointmentLoading ? undefined : handleAcceptAppointmentProposal}
                disabled={proposalAppointmentLoading}
                fullWidth
              />
            </View>
            <View style={styles.fullWidthButtonWrap}>
              <GlassButton
                label={proposalAppointmentLoading ? 'Attendi...' : 'Rifiuta'}
                tone="danger"
                onPress={proposalAppointmentLoading ? undefined : handleDeclineAppointmentProposal}
                disabled={proposalAppointmentLoading}
                fullWidth
              />
            </View>
          </View>
        }
      >
        {pendingProposal ? (
          <View style={styles.sheetContent}>
            <Text style={styles.sheetText}>
              {formatDay(pendingProposal.startsAt)} · {formatTime(pendingProposal.startsAt)}
            </Text>
            <Text style={styles.sheetMeta}>
              Durata:{' '}
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
              min
            </Text>
            <Text style={styles.sheetMeta}>
              Istruttore: {pendingProposal.instructor?.name ?? 'Da assegnare'}
            </Text>
            <Text style={styles.sheetMeta}>
              Veicolo: {pendingProposal.vehicle?.name ?? 'Da assegnare'}
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
              <GlassButton
                label={waitlistLoading ? 'Attendi...' : 'Accetta'}
                tone="primary"
                onPress={waitlistLoading ? undefined : handleAcceptWaitlistOffer}
                disabled={waitlistLoading}
                fullWidth
              />
            </View>
            <View style={styles.fullWidthButtonWrap}>
              <GlassButton
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
      <BottomSheet
        visible={prefsOpen}
        title="Prenota guida"
        onClose={handleClosePreferences}
        onClosed={() => {
          if (pendingSuggestionOpen) {
            setSheetOpen(true);
            setPendingSuggestionOpen(false);
          }
        }}
        closeDisabled={bookingLoading}
        footer={
          <View style={styles.sheetActionsDock}>
            <View style={styles.fullWidthButtonWrap}>
              <GlassButton
                label={bookingLoading ? 'Attendi...' : 'Prenota'}
                tone="primary"
                onPress={bookingLoading ? undefined : handleBookingRequest}
                disabled={bookingLoading}
                fullWidth
              />
            </View>
          </View>
        }
      >
        <View style={styles.sheetContent}>
          {paymentProfile?.autoPaymentsEnabled ? (
            <View style={styles.bookingCreditsInline}>
              <Text style={styles.bookingCreditsInlineLabel}>Crediti disponibili</Text>
              <Text style={styles.bookingCreditsInlineValue}>
                {paymentProfile.lessonCreditsAvailable ?? 0}
              </Text>
            </View>
          ) : null}
          <View style={styles.bookingFormBlock}>
            <PickerField
              label="Giorno"
              value={preferredDate}
              mode="date"
              onChange={setPreferredDate}
            />
          </View>
          {canSelectLessonType ? (
            <View style={styles.bookingFormBlock}>
              <Text style={styles.sheetMeta}>Tipo guida</Text>
              <View style={styles.durationWrap}>
                {availableLessonTypes.map((lessonType) => (
                  <Pressable
                    key={`type-${lessonType}`}
                    style={[
                      styles.durationChip,
                      selectedLessonType === lessonType && styles.durationChipActive,
                    ]}
                    onPress={() => setSelectedLessonType(lessonType)}
                  >
                    <Text
                      style={
                        selectedLessonType === lessonType
                          ? styles.durationTextActive
                          : styles.durationText
                      }
                    >
                      {formatLessonType(lessonType)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
          <View style={styles.bookingFormBlock}>
            <Text style={styles.sheetMeta}>Durata</Text>
            {availableDurations.length === 1 ? (
              <Text style={styles.sheetText}>{availableDurations[0]} min</Text>
            ) : (
              <View style={styles.durationWrap}>
                {availableDurations.map((duration) => (
                  <Pressable
                    key={`duration-${duration}`}
                    style={[
                      styles.durationChip,
                      durationMinutes === duration && styles.durationChipActive,
                    ]}
                    onPress={() => setDurationMinutes(duration)}
                  >
                    <Text
                      style={
                        durationMinutes === duration
                          ? styles.durationTextActive
                          : styles.durationText
                      }
                    >
                      {duration}m
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        </View>
      </BottomSheet>
      <BottomSheet
        visible={sheetOpen}
        title="Proposta di guida"
        onClose={handleRejectSuggestion}
        closeDisabled={proposalLoading}
        footer={
          <View style={styles.sheetActionsDock}>
            <View style={styles.fullWidthButtonWrap}>
              <GlassButton
                label={proposalLoading ? 'Attendi...' : 'Accetta'}
                tone="primary"
                onPress={proposalLoading ? undefined : handleAcceptSuggestion}
                disabled={proposalLoading}
                fullWidth
              />
            </View>
            <View style={styles.fullWidthButtonWrap}>
              <GlassButton
                label={proposalLoading ? 'Attendi...' : 'Proponimi altro'}
                onPress={proposalLoading ? undefined : handleAlternativeSuggestion}
                disabled={proposalLoading}
                fullWidth
              />
            </View>
            <View style={styles.fullWidthButtonWrap}>
              <GlassButton
                label="Rifiuta"
                tone="danger"
                onPress={proposalLoading ? undefined : handleRejectSuggestion}
                disabled={proposalLoading}
                fullWidth
              />
            </View>
          </View>
        }
      >
        {suggestion ? (
          <View style={styles.sheetContent}>
            <Text style={styles.sheetText}>
              {formatDay(suggestion.startsAt)} · {formatTime(suggestion.startsAt)}
            </Text>
            {canSelectLessonType ? (
              <Text style={styles.sheetMeta}>Tipo guida: {formatLessonType(selectedLessonType)}</Text>
            ) : null}
            <Text style={styles.sheetMeta}>Durata: {durationMinutes} min</Text>
            <Text style={styles.sheetMeta}>Istruttore: da assegnare</Text>
            <Text style={styles.sheetMeta}>Veicolo: da assegnare</Text>
          </View>
        ) : null}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    ...typography.title,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  lessonRow: {
    gap: spacing.sm,
  },
  lessonInfo: {
    flex: 1,
    minWidth: 0,
  },
  nextLessonActionWrap: {
    width: '100%',
    paddingTop: spacing.xs,
  },
  primaryLessonTime: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '700',
    letterSpacing: -0.3,
    color: colors.textPrimary,
  },
  primaryLessonMeta: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '500',
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  lessonTime: {
    ...typography.subtitle,
    color: colors.textPrimary,
  },
  lessonMeta: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  agendaList: {
    gap: spacing.sm,
  },
  skeletonButton: {
    marginTop: spacing.xs,
  },
  agendaRow: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(50, 77, 122, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
    shadowColor: 'rgba(15, 29, 51, 0.2)',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  agendaTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  agendaTime: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 1,
    fontWeight: '600',
    fontSize: 16,
    lineHeight: 21,
  },
  agendaInstructor: {
    fontSize: 15,
    lineHeight: 20,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  agendaMeta: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  agendaCtaWrap: {
    alignSelf: 'flex-start',
    marginTop: 2,
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
    borderColor: 'rgba(50, 77, 122, 0.35)',
    backgroundColor: 'rgba(239, 244, 252, 0.9)',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  durationChipActive: {
    backgroundColor: colors.navy,
    borderColor: colors.navy,
    shadowColor: colors.navy,
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
  bookingCreditsInline: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(50, 77, 122, 0.14)',
    backgroundColor: 'rgba(255, 255, 255, 0.38)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
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
    borderColor: colors.glassBorder,
    backgroundColor: colors.glassStrong,
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
  pickerBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(10, 15, 30, 0.78)',
    padding: spacing.lg,
  },
  pickerCard: {
    backgroundColor: '#F7FAFF',
    borderRadius: 20,
    padding: spacing.lg,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  pickerTitle: {
    ...typography.subtitle,
    color: colors.textPrimary,
  },
  timePickerFieldWrap: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(50, 77, 122, 0.34)',
    backgroundColor: 'rgba(238, 244, 252, 0.92)',
    padding: 3,
    shadowColor: 'rgba(50, 77, 122, 0.4)',
    shadowOpacity: 0.14,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  timePickerField: {
    borderRadius: 16,
  },
  timePickerFieldPressed: {
    opacity: 0.9,
  },
});
