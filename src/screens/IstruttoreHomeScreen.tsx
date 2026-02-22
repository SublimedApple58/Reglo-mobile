import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Screen } from '../components/Screen';
import { GlassBadge } from '../components/GlassBadge';
import { GlassCard } from '../components/GlassCard';
import { GlassButton } from '../components/GlassButton';
import { BottomSheet } from '../components/BottomSheet';
import { GlassInput } from '../components/GlassInput';
import { CalendarNavigator, CalendarNavigatorRange } from '../components/CalendarNavigator';
import { SelectableChip } from '../components/SelectableChip';
import { SkeletonBlock, SkeletonCard } from '../components/Skeleton';
import { ToastNotice, ToastTone } from '../components/ToastNotice';
import { regloApi } from '../services/regloApi';
import {
  AutoscuolaAppointmentWithRelations,
  AutoscuolaSettings,
  InstructorBookingSuggestion,
} from '../types/regloApi';
import { colors, spacing, typography } from '../theme';
import { formatDay, formatTime } from '../utils/date';
import { useSession } from '../context/SessionContext';

type InstructorActionStatus = 'checked_in' | 'no_show';
type DrawerAction = InstructorActionStatus | 'save_details' | 'reposition';
type BookingDrawerAction = 'suggest' | 'confirm' | 'create' | null;
type LessonTypeOption = {
  value: string;
  label: string;
};

const LESSON_TYPE_OPTIONS: LessonTypeOption[] = [
  { value: 'manovre', label: 'Manovre' },
  { value: 'urbano', label: 'Urbano' },
  { value: 'extraurbano', label: 'Extraurbano' },
  { value: 'notturna', label: 'Notturna' },
  { value: 'autostrada', label: 'Autostrada' },
  { value: 'parcheggio', label: 'Parcheggio' },
  { value: 'altro', label: 'Altro' },
];

const BOOKING_ACTOR_LABEL: Record<'students' | 'instructors' | 'both', string> = {
  students: 'Solo allievi',
  instructors: 'Solo istruttori',
  both: 'Allievi e istruttori',
};

const INSTRUCTOR_MODE_LABEL: Record<'manual_full' | 'manual_engine' | 'guided_proposal', string> = {
  manual_full: 'Manuale totale',
  manual_engine: 'Manuale + motore',
  guided_proposal: 'Guidata con proposta',
};

const normalizeStatus = (value: string | null | undefined) =>
  (value ?? '').trim().toLowerCase();

const ALLOWED_ACTION_STATUSES = new Set(['scheduled', 'confirmed', 'proposal']);
const CLOSED_ACTION_STATUSES = new Set(['cancelled', 'completed', 'no_show']);
const VISIBLE_LESSON_STATUSES = new Set(['scheduled', 'confirmed', 'proposal', 'checked_in']);
const DETAILS_EDITABLE_STATUSES = new Set([
  'scheduled',
  'confirmed',
  'proposal',
  'checked_in',
  'completed',
  'no_show',
]);

const STATUS_PRIORITY: Record<string, number> = {
  checked_in: 5,
  completed: 4,
  no_show: 3,
  scheduled: 2,
  confirmed: 2,
  proposal: 1,
  cancelled: 0,
};

const isSameDay = (date: Date, iso: string) => {
  const target = new Date(iso);
  return (
    date.getFullYear() === target.getFullYear() &&
    date.getMonth() === target.getMonth() &&
    date.getDate() === target.getDate()
  );
};

const getStartsAtTs = (lesson: AutoscuolaAppointmentWithRelations) =>
  new Date(lesson.startsAt).getTime();

const getUpdatedAtTs = (lesson: AutoscuolaAppointmentWithRelations) =>
  new Date(lesson.updatedAt).getTime();

const getLessonIdentityKey = (lesson: AutoscuolaAppointmentWithRelations) => {
  if (lesson.slotId) return `slot:${lesson.slotId}`;
  return [
    'fallback',
    lesson.studentId,
    lesson.instructorId ?? '',
    lesson.vehicleId ?? '',
    lesson.startsAt,
    lesson.endsAt ?? '',
  ].join(':');
};

const dedupeAppointments = (items: AutoscuolaAppointmentWithRelations[]) => {
  const map = new Map<string, AutoscuolaAppointmentWithRelations>();
  for (const item of items) {
    const key = getLessonIdentityKey(item);
    const prev = map.get(key);
    if (!prev) {
      map.set(key, item);
      continue;
    }

    const itemPriority = STATUS_PRIORITY[normalizeStatus(item.status)] ?? 0;
    const prevPriority = STATUS_PRIORITY[normalizeStatus(prev.status)] ?? 0;
    if (itemPriority > prevPriority) {
      map.set(key, item);
      continue;
    }
    if (itemPriority < prevPriority) {
      continue;
    }
    if (getUpdatedAtTs(item) >= getUpdatedAtTs(prev)) {
      map.set(key, item);
    }
  }
  return Array.from(map.values());
};

const durationLabel = (lesson: AutoscuolaAppointmentWithRelations) => {
  const start = new Date(lesson.startsAt).getTime();
  const end = lesson.endsAt ? new Date(lesson.endsAt).getTime() : start + 30 * 60 * 1000;
  const minutes = Math.round((end - start) / 60000);
  return `${minutes} min`;
};

const getLessonEnd = (lesson: AutoscuolaAppointmentWithRelations) =>
  lesson.endsAt ? new Date(lesson.endsAt) : new Date(new Date(lesson.startsAt).getTime() + 30 * 60 * 1000);

const computeStatusWindow = (lesson: AutoscuolaAppointmentWithRelations) => {
  const startsAt = new Date(lesson.startsAt);
  const opensAt = new Date(startsAt.getTime() - 10 * 60 * 1000);
  const closesAt = new Date(startsAt);
  closesAt.setHours(23, 59, 59, 999);
  return { opensAt, closesAt };
};

const toClockLabel = (value: Date) =>
  value.toLocaleTimeString('it-IT', {
    hour: '2-digit',
    minute: '2-digit',
  });

const getActionAvailability = (
  lesson: AutoscuolaAppointmentWithRelations,
  now: Date,
) => {
  const status = normalizeStatus(lesson.status);
  if (status === 'checked_in') {
    return { enabled: false, reason: null as string | null };
  }
  if (CLOSED_ACTION_STATUSES.has(status)) {
    return { enabled: false, reason: null as string | null };
  }
  if (!ALLOWED_ACTION_STATUSES.has(status)) {
    return { enabled: false, reason: null as string | null };
  }
  const { opensAt, closesAt } = computeStatusWindow(lesson);
  if (now < opensAt) {
    return { enabled: false, reason: `Disponibile dalle ${toClockLabel(opensAt)}` };
  }
  if (now > closesAt) {
    return { enabled: false, reason: 'Azione disponibile fino a fine giornata.' };
  }
  return { enabled: true, reason: '' };
};

const getLessonStateMeta = (lesson: AutoscuolaAppointmentWithRelations, now: Date) => {
  const status = normalizeStatus(lesson.status);
  if (!VISIBLE_LESSON_STATUSES.has(status)) return null;
  const startsAt = new Date(lesson.startsAt);
  const endsAt = getLessonEnd(lesson);

  if (status === 'checked_in' && now >= startsAt && now < endsAt) {
    return { label: 'In corso', tone: 'live' as const };
  }
  if (status === 'checked_in') {
    return { label: 'Confermata', tone: 'confirmed' as const };
  }
  return { label: 'Programmata', tone: 'scheduled' as const };
};

const normalizeLessonType = (value: string | null | undefined) =>
  (value ?? '').trim().toLowerCase();

const normalizeNotes = (value: string | null | undefined) => (value ?? '').trim();

const resolveInitialLessonType = (value: string | null | undefined) => {
  const normalized = normalizeLessonType(value);
  const match = LESSON_TYPE_OPTIONS.find((option) => option.value === normalized);
  return match?.value ?? '';
};

const isDetailsEditable = (lesson: AutoscuolaAppointmentWithRelations, now: Date) => {
  const status = normalizeStatus(lesson.status);
  if (!DETAILS_EDITABLE_STATUSES.has(status)) return false;
  if (status === 'cancelled') return false;
  if (status === 'completed' || status === 'no_show' || status === 'checked_in') {
    const { closesAt } = computeStatusWindow(lesson);
    return now <= closesAt;
  }
  return true;
};

const getCheckinStateText = (lesson: AutoscuolaAppointmentWithRelations, now: Date) => {
  const status = normalizeStatus(lesson.status);
  if (status === 'checked_in' || CLOSED_ACTION_STATUSES.has(status)) return null;

  const availability = getActionAvailability(lesson, now);
  if (availability.enabled) return null;
  return availability.reason ?? null;
};

const getLessonStateLabel = (lesson: AutoscuolaAppointmentWithRelations, now: Date) => {
  const meta = getLessonStateMeta(lesson, now);
  return meta?.label ?? lesson.status;
};

const getTodayLessonTimingMeta = (lesson: AutoscuolaAppointmentWithRelations, now: Date) => {
  const start = new Date(lesson.startsAt);
  const end = getLessonEnd(lesson);
  if (now < start) return { label: 'Futura', tone: 'future' as const };
  if (now >= start && now < end) return { label: 'In corso', tone: 'live' as const };
  return { label: 'Passata', tone: 'past' as const };
};

const canOperationalReposition = (
  lesson: AutoscuolaAppointmentWithRelations,
  now: Date,
) => {
  const status = normalizeStatus(lesson.status);
  if (CLOSED_ACTION_STATUSES.has(status)) return false;
  return new Date(lesson.startsAt).getTime() > now.getTime();
};

const formatFutureDayLabel = (isoDate: string) =>
  new Date(isoDate).toLocaleDateString('it-IT', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  });

const toLocalDayKey = (isoDate: string) => {
  const date = new Date(isoDate);
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};

const toTimeString = (value: Date) =>
  value.toLocaleTimeString('it-IT', {
    hour: '2-digit',
    minute: '2-digit',
  });

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
            value={
              mode === 'date'
                ? value.toLocaleDateString('it-IT', {
                    weekday: 'short',
                    day: '2-digit',
                    month: 'short',
                  })
                : toTimeString(value)
            }
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

export const IstruttoreHomeScreen = () => {
  const { instructorId } = useSession();
  const [appointments, setAppointments] = useState<AutoscuolaAppointmentWithRelations[]>([]);
  const [students, setStudents] = useState<Array<{ id: string; firstName: string; lastName: string }>>([]);
  const [vehicles, setVehicles] = useState<Array<{ id: string; name: string }>>([]);
  const [settings, setSettings] = useState<AutoscuolaSettings | null>(null);
  const [calendarRange, setCalendarRange] = useState<CalendarNavigatorRange | null>(null);
  const [clockTick, setClockTick] = useState(() => Date.now());
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; tone: ToastTone } | null>(null);
  const [sheetLesson, setSheetLesson] = useState<AutoscuolaAppointmentWithRelations | null>(null);
  const [selectedLessonType, setSelectedLessonType] = useState('');
  const [lessonNotes, setLessonNotes] = useState('');
  const [selectedFutureDayKey, setSelectedFutureDayKey] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<DrawerAction | null>(null);
  const [bookingSheetOpen, setBookingSheetOpen] = useState(false);
  const [bookingPendingAction, setBookingPendingAction] = useState<BookingDrawerAction>(null);
  const [bookingStudentId, setBookingStudentId] = useState<string>('');
  const [bookingVehicleId, setBookingVehicleId] = useState<string>('');
  const [bookingLessonType, setBookingLessonType] = useState<string>('guida');
  const [bookingDate, setBookingDate] = useState<Date>(() => new Date());
  const [bookingStartTime, setBookingStartTime] = useState<Date>(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 30 - (now.getMinutes() % 30), 0, 0);
    return now;
  });
  const [bookingDuration, setBookingDuration] = useState<number>(60);
  const [guidedSuggestion, setGuidedSuggestion] = useState<InstructorBookingSuggestion | null>(null);

  const loadData = useCallback(async (): Promise<AutoscuolaAppointmentWithRelations[]> => {
    if (!instructorId) return [];
    setLoading(true);
    setError(null);
    try {
      const from = calendarRange ? new Date(calendarRange.from) : new Date();
      const to = calendarRange ? new Date(calendarRange.to) : new Date();
      if (!calendarRange) {
        from.setDate(from.getDate() - 1);
        from.setHours(0, 0, 0, 0);
        to.setDate(to.getDate() + 14);
        to.setHours(23, 59, 59, 999);
      }

      const [appointmentsResponse, settingsResponse, studentsResponse, vehiclesResponse] =
        await Promise.all([
          regloApi.getAppointments({
            instructorId,
            from: from.toISOString(),
            to: to.toISOString(),
            limit: 400,
          }),
          regloApi.getAutoscuolaSettings(),
          regloApi.getStudents(),
          regloApi.getVehicles(),
        ]);
      setSettings(settingsResponse);
      setStudents(studentsResponse);
      setVehicles(vehiclesResponse);
      const nextAppointments = dedupeAppointments(
        appointmentsResponse.filter((item) => item.instructorId === instructorId),
      );
      setAppointments(nextAppointments);
      return nextAppointments;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore nel caricamento');
      return [];
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  }, [calendarRange, instructorId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const interval = setInterval(() => {
      setClockTick(Date.now());
    }, 30_000);
    return () => clearInterval(interval);
  }, []);

  const now = useMemo(() => new Date(clockTick), [clockTick]);
  const bookingActors = settings?.appBookingActors ?? 'students';
  const instructorBookingMode = settings?.instructorBookingMode ?? 'manual_engine';
  const canInstructorBook =
    bookingActors === 'instructors' || bookingActors === 'both';
  const bookingDurations = useMemo(
    () =>
      (settings?.bookingSlotDurations ?? [30, 60]).slice().sort((a, b) => a - b),
    [settings?.bookingSlotDurations],
  );

  const normalizeToHalfHour = useCallback((value: Date) => {
    const next = new Date(value);
    next.setSeconds(0, 0);
    const minutes = next.getMinutes();
    const rounded = Math.ceil(minutes / 30) * 30;
    if (rounded === 60) {
      next.setHours(next.getHours() + 1, 0, 0, 0);
    } else {
      next.setMinutes(rounded, 0, 0);
    }
    return next;
  }, []);

  const resolveBookingStartDate = useCallback(() => {
    const date = new Date(bookingDate);
    const time = new Date(bookingStartTime);
    date.setHours(time.getHours(), time.getMinutes(), 0, 0);
    return normalizeToHalfHour(date);
  }, [bookingDate, bookingStartTime, normalizeToHalfHour]);

  const openBookingDrawer = useCallback(() => {
    if (!canInstructorBook) {
      setToast({
        text: 'La prenotazione da app è abilitata solo per allievi.',
        tone: 'info',
      });
      return;
    }
    const allowedDurations = (settings?.bookingSlotDurations ?? [30, 60])
      .slice()
      .sort((a, b) => a - b);
    const nowDate = new Date();
    const roundedNow = normalizeToHalfHour(nowDate);
    setBookingStudentId((current) => current || students[0]?.id || '');
    setBookingVehicleId((current) => current || vehicles[0]?.id || '');
    setBookingLessonType('guida');
    setBookingDuration((current) =>
      allowedDurations.includes(current) ? current : allowedDurations[0] ?? 60,
    );
    setBookingDate(nowDate);
    setBookingStartTime(roundedNow);
    setGuidedSuggestion(null);
    setBookingSheetOpen(true);
  }, [canInstructorBook, normalizeToHalfHour, settings?.bookingSlotDurations, students, vehicles]);

  const handleSuggestGuidedBooking = useCallback(async () => {
    if (!bookingStudentId) {
      setToast({ text: 'Seleziona un allievo.', tone: 'danger' });
      return;
    }
    setBookingPendingAction('suggest');
    setToast(null);
    try {
      const suggestion = await regloApi.suggestInstructorBooking({ studentId: bookingStudentId });
      setGuidedSuggestion(suggestion);
      setBookingVehicleId(suggestion.vehicleId);
      setBookingDuration(suggestion.durationMinutes);
      setBookingLessonType(suggestion.suggestedLessonType || 'guida');
      setToast({ text: 'Slot suggerito pronto. Conferma per inviare la proposta.', tone: 'success' });
    } catch (err) {
      setGuidedSuggestion(null);
      setToast({
        text: err instanceof Error ? err.message : 'Nessuno slot disponibile al momento',
        tone: 'danger',
      });
    } finally {
      setBookingPendingAction(null);
    }
  }, [bookingStudentId]);

  const handleConfirmInstructorBooking = useCallback(async () => {
    if (!bookingStudentId) {
      setToast({ text: 'Seleziona un allievo.', tone: 'danger' });
      return;
    }
    if (!bookingVehicleId) {
      setToast({ text: 'Seleziona un veicolo.', tone: 'danger' });
      return;
    }
    if (!instructorId) {
      setToast({ text: 'Profilo istruttore non disponibile.', tone: 'danger' });
      return;
    }

    const start = guidedSuggestion ? new Date(guidedSuggestion.startsAt) : resolveBookingStartDate();
    const end = guidedSuggestion
      ? new Date(guidedSuggestion.endsAt)
      : new Date(start.getTime() + bookingDuration * 60 * 1000);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      setToast({ text: 'Intervallo orario non valido.', tone: 'danger' });
      return;
    }

    setBookingPendingAction(guidedSuggestion ? 'confirm' : 'create');
    setToast(null);
    try {
      await regloApi.confirmInstructorBooking({
        studentId: bookingStudentId,
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
        instructorId,
        vehicleId: guidedSuggestion?.vehicleId ?? bookingVehicleId,
        ...(bookingLessonType && bookingLessonType !== 'guida'
          ? { lessonType: bookingLessonType }
          : {}),
      });
      setBookingSheetOpen(false);
      setGuidedSuggestion(null);
      setToast({ text: 'Proposta inviata all’allievo.', tone: 'success' });
      await loadData();
    } catch (err) {
      setToast({
        text: err instanceof Error ? err.message : 'Errore creando la proposta',
        tone: 'danger',
      });
    } finally {
      setBookingPendingAction(null);
    }
  }, [
    bookingDuration,
    bookingLessonType,
    bookingStudentId,
    bookingVehicleId,
    guidedSuggestion,
    instructorId,
    loadData,
    resolveBookingStartDate,
  ]);
  const activeLessons = useMemo(
    () => appointments.filter((item) => VISIBLE_LESSON_STATUSES.has(normalizeStatus(item.status))),
    [appointments],
  );
  const inProgressLesson = useMemo(() => {
    return [...activeLessons]
      .filter((item) => {
        const status = normalizeStatus(item.status);
        if (status !== 'checked_in') return false;
        const startsAt = new Date(item.startsAt);
        const endsAt = getLessonEnd(item);
        return now >= startsAt && now < endsAt;
      })
      .sort((a, b) => getStartsAtTs(a) - getStartsAtTs(b))[0];
  }, [activeLessons, now]);

  const upcomingLessons = useMemo(() => {
    return [...activeLessons]
      .filter((item) => {
        const status = normalizeStatus(item.status);
        if (status === 'checked_in') return getLessonEnd(item) >= now;
        return new Date(item.startsAt) >= now;
      })
      .sort((a, b) => getStartsAtTs(a) - getStartsAtTs(b));
  }, [activeLessons, now]);

  const todayLessons = useMemo(() => {
    return [...appointments]
      .filter((item) => isSameDay(now, item.startsAt))
      .filter((item) => normalizeStatus(item.status) !== 'cancelled')
      .sort((a, b) => getStartsAtTs(b) - getStartsAtTs(a));
  }, [appointments, now]);
  const futureLessons = useMemo(() => {
    const tomorrowStart = new Date(now);
    tomorrowStart.setHours(0, 0, 0, 0);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);

    return [...appointments]
      .filter((item) => new Date(item.startsAt).getTime() >= tomorrowStart.getTime())
      .filter((item) => !CLOSED_ACTION_STATUSES.has(normalizeStatus(item.status)))
      .sort((a, b) => getStartsAtTs(a) - getStartsAtTs(b));
  }, [appointments, now]);
  const futureDayOptions = useMemo(() => {
    const map = new Map<
      string,
      { key: string; label: string; startsAtTs: number; count: number }
    >();

    for (const lesson of futureLessons) {
      const key = toLocalDayKey(lesson.startsAt);
      const current = map.get(key);
      if (current) {
        current.count += 1;
        continue;
      }
      map.set(key, {
        key,
        label: formatFutureDayLabel(lesson.startsAt),
        startsAtTs: getStartsAtTs(lesson),
        count: 1,
      });
    }

    return Array.from(map.values()).sort((a, b) => a.startsAtTs - b.startsAtTs);
  }, [futureLessons]);
  const visibleFutureLessons = useMemo(() => {
    if (!selectedFutureDayKey) return [];
    return futureLessons.filter((lesson) => toLocalDayKey(lesson.startsAt) === selectedFutureDayKey);
  }, [futureLessons, selectedFutureDayKey]);

  const featuredLesson = inProgressLesson ?? upcomingLessons[0] ?? null;
  const isSheetDetailsEditable = sheetLesson ? isDetailsEditable(sheetLesson, now) : false;

  const openLessonDrawer = (lesson: AutoscuolaAppointmentWithRelations) => {
    if (!isDetailsEditable(lesson, now)) {
      setToast({ text: 'Guida non modificabile.', tone: 'info' });
      return;
    }
    setSheetLesson(lesson);
    setSelectedLessonType(resolveInitialLessonType(lesson.type));
    setLessonNotes(lesson.notes ?? '');
  };

  const isPending = pendingAction !== null;
  const sheetActionAvailability = useMemo(() => {
    if (!sheetLesson) return null;
    return getActionAvailability(sheetLesson, now);
  }, [sheetLesson, now]);
  const featuredActionAvailability = useMemo(() => {
    if (!featuredLesson) return null;
    return getActionAvailability(featuredLesson, now);
  }, [featuredLesson, now]);

  const canRunStatusAction = Boolean(sheetActionAvailability?.enabled);
  const canRepositionSheetLesson = sheetLesson
    ? canOperationalReposition(sheetLesson, now)
    : false;
  const featuredCheckinHint = featuredLesson ? getCheckinStateText(featuredLesson, now) : null;
  const sheetStateMeta = useMemo(
    () => (sheetLesson ? getLessonStateMeta(sheetLesson, now) : null),
    [sheetLesson, now],
  );

  const refreshAndSyncDrawer = useCallback(
    async (lessonId: string) => {
      const refreshed = await loadData();
      const refreshedLesson = refreshed.find((item) => item.id === lessonId) ?? null;
      if (!refreshedLesson) {
        setSheetLesson(null);
        return;
      }
      setSheetLesson(refreshedLesson);
      setSelectedLessonType(resolveInitialLessonType(refreshedLesson.type));
      setLessonNotes(refreshedLesson.notes ?? '');
    },
    [loadData],
  );

  const executeStatusAction = useCallback(
    async (
      lesson: AutoscuolaAppointmentWithRelations,
      action: InstructorActionStatus,
      options?: { lessonType?: string; closeDrawerOnSuccess?: boolean },
    ) => {
      setToast(null);
      const availability = getActionAvailability(lesson, new Date());
      if (!availability.enabled) {
        if (availability.reason) {
          setToast({ text: availability.reason, tone: 'info' });
        }
        return;
      }

      const normalizedType = normalizeLessonType(options?.lessonType);
      if (action === 'checked_in' && !normalizedType && !normalizeLessonType(lesson.type)) {
        setToast({
          text: 'Seleziona prima il tipo guida dal dettaglio.',
          tone: 'info',
        });
        return;
      }

      setPendingAction(action);
      setError(null);

      try {
        await regloApi.updateAppointmentStatus(lesson.id, {
          status: action,
          lessonType: normalizedType || undefined,
        });
        setToast({ text: 'Stato aggiornato', tone: 'success' });
        if (options?.closeDrawerOnSuccess) {
          setSheetLesson(null);
        } else if (sheetLesson?.id === lesson.id) {
          await refreshAndSyncDrawer(lesson.id);
        } else {
          await loadData();
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Errore aggiornando stato';
        setError(message);
        setToast({ text: message, tone: 'danger' });
      } finally {
        setPendingAction(null);
      }
    },
    [loadData, refreshAndSyncDrawer, sheetLesson?.id],
  );

  const handleSaveDetails = async () => {
    if (!sheetLesson) return;
    if (!isDetailsEditable(sheetLesson, now)) {
      setToast({ text: 'Guida non modificabile.', tone: 'danger' });
      return;
    }

    const payload: { lessonType?: string; notes?: string | null } = {};
    const initialLessonType = resolveInitialLessonType(sheetLesson.type);
    if (selectedLessonType && selectedLessonType !== initialLessonType) {
      payload.lessonType = selectedLessonType;
    }

    const currentNotes = normalizeNotes(lessonNotes);
    const initialNotes = normalizeNotes(sheetLesson.notes);
    if (currentNotes !== initialNotes) {
      payload.notes = currentNotes || null;
    }

    if (!Object.keys(payload).length) {
      setToast({ text: 'Nessuna modifica da salvare.', tone: 'info' });
      return;
    }

    setPendingAction('save_details');
    setToast(null);
    setError(null);

    try {
      await regloApi.updateAppointmentDetails(sheetLesson.id, payload);
      await refreshAndSyncDrawer(sheetLesson.id);
      setToast({ text: 'Dettagli guida salvati.', tone: 'success' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Errore aggiornando dettagli';
      setError(message);
      setToast({ text: message, tone: 'danger' });
    } finally {
      setPendingAction(null);
    }
  };

  const handleStatusAction = async (action: InstructorActionStatus) => {
    if (!sheetLesson) return;
    await executeStatusAction(sheetLesson, action, {
      lessonType: selectedLessonType,
      closeDrawerOnSuccess: true,
    });
  };

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  useEffect(() => {
    if (!futureDayOptions.length) {
      if (selectedFutureDayKey !== null) setSelectedFutureDayKey(null);
      return;
    }
    if (!selectedFutureDayKey || !futureDayOptions.some((item) => item.key === selectedFutureDayKey)) {
      setSelectedFutureDayKey(futureDayOptions[0].key);
    }
  }, [futureDayOptions, selectedFutureDayKey]);

  const handleRepositionLesson = useCallback(
    async (lesson: AutoscuolaAppointmentWithRelations) => {
      if (!canOperationalReposition(lesson, now)) {
        setToast({ text: 'Puoi riposizionare solo guide future.', tone: 'info' });
        return;
      }
      setPendingAction('reposition');
      setToast(null);
      try {
        const response = await regloApi.repositionAppointment(lesson.id, 'instructor_cancel');
        if (response.proposalCreated && response.proposalStartsAt) {
          setToast({
            text: `Nuova proposta inviata (${formatDay(response.proposalStartsAt)} · ${formatTime(
              response.proposalStartsAt,
            )})`,
            tone: 'success',
          });
        } else {
          setToast({
            text: 'Guida cancellata. Ricerca nuovo slot in corso.',
            tone: 'info',
          });
        }
        if (sheetLesson?.id === lesson.id) {
          setSheetLesson(null);
        }
        await loadData();
      } catch (err) {
        setToast({
          text: err instanceof Error ? err.message : 'Errore durante il riposizionamento',
          tone: 'danger',
        });
      } finally {
        setPendingAction(null);
      }
    },
    [loadData, now, sheetLesson?.id],
  );

  const handleManualCancelLesson = useCallback(
    async (lesson: AutoscuolaAppointmentWithRelations) => {
      if (new Date(lesson.startsAt).getTime() <= Date.now()) {
        setToast({ text: 'Puoi annullare solo guide future.', tone: 'info' });
        return;
      }
      setPendingAction('reposition');
      setToast(null);
      try {
        await regloApi.cancelAppointment(lesson.id);
        if (sheetLesson?.id === lesson.id) {
          setSheetLesson(null);
        }
        setToast({ text: 'Guida annullata.', tone: 'success' });
        await loadData();
      } catch (err) {
        setToast({
          text: err instanceof Error ? err.message : 'Errore durante annullamento guida',
          tone: 'danger',
        });
      } finally {
        setPendingAction(null);
      }
    },
    [loadData, sheetLesson?.id],
  );

  const handleCancelByMode = useCallback(
    async (lesson: AutoscuolaAppointmentWithRelations) => {
      if (instructorBookingMode === 'manual_full') {
        await handleManualCancelLesson(lesson);
        return;
      }
      await handleRepositionLesson(lesson);
    },
    [handleManualCancelLesson, handleRepositionLesson, instructorBookingMode],
  );

  const resetGuidedSuggestionForStudent = useCallback((nextStudentId: string) => {
    setBookingStudentId(nextStudentId);
    setGuidedSuggestion(null);
  }, []);

  const bookingSheetFooter = useMemo(() => {
    if (!canInstructorBook) return null;

    if (instructorBookingMode === 'guided_proposal') {
      if (guidedSuggestion) {
        return (
          <GlassButton
            label={bookingPendingAction === 'confirm' ? 'Invio proposta...' : 'Invia proposta'}
            tone="primary"
            onPress={!bookingPendingAction ? handleConfirmInstructorBooking : undefined}
            disabled={Boolean(bookingPendingAction)}
            fullWidth
          />
        );
      }
      return (
        <GlassButton
          label={bookingPendingAction === 'suggest' ? 'Ricerca slot...' : 'Trova slot'}
          tone="primary"
          onPress={!bookingPendingAction ? handleSuggestGuidedBooking : undefined}
          disabled={Boolean(bookingPendingAction) || !bookingStudentId}
          fullWidth
        />
      );
    }

    return (
      <GlassButton
        label={bookingPendingAction ? 'Invio proposta...' : 'Invia proposta'}
        tone="primary"
        onPress={!bookingPendingAction ? handleConfirmInstructorBooking : undefined}
        disabled={Boolean(bookingPendingAction) || !bookingStudentId || !bookingVehicleId}
        fullWidth
      />
    );
  }, [
    bookingPendingAction,
    bookingStudentId,
    bookingVehicleId,
    canInstructorBook,
    guidedSuggestion,
    handleConfirmInstructorBooking,
    handleSuggestGuidedBooking,
    instructorBookingMode,
  ]);

  if (!instructorId) {
    return (
      <Screen>
        <StatusBar style="dark" />
        <View style={styles.emptyState}>
          <GlassCard title="Profilo istruttore mancante">
            <Text style={styles.emptyText}>
              Il tuo account non e ancora collegato a un profilo istruttore.
            </Text>
          </GlassCard>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <StatusBar style="dark" />
      <ToastNotice message={toast?.text ?? null} tone={toast?.tone} onHide={() => setToast(null)} />
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
            <Text style={styles.title}>Ciao, Istruttore</Text>
            <Text style={styles.subtitle}>Agenda e gestione riposizionamenti</Text>
          </View>
          <GlassBadge label="Istruttore" />
        </View>

        {!initialLoading && error ? <Text style={styles.error}>{error}</Text> : null}

        <GlassCard title="Calendario" subtitle="Naviga giorno, settimana o mese">
          <CalendarNavigator
            initialMode="week"
            onChange={setCalendarRange}
          />
        </GlassCard>

        <GlassCard title="Nuova prenotazione" subtitle="Crea una proposta per i tuoi allievi">
          <Text style={styles.lessonMeta}>
            Prenotazioni da app: {BOOKING_ACTOR_LABEL[bookingActors]}.
          </Text>
          {(bookingActors === 'instructors' || bookingActors === 'both') ? (
            <Text style={styles.lessonMeta}>
              Modalità: {INSTRUCTOR_MODE_LABEL[instructorBookingMode]}.
            </Text>
          ) : (
            <Text style={styles.lessonMeta}>
              Il titolare ha disabilitato le prenotazioni istruttore da app.
            </Text>
          )}
          <GlassButton
            label="Nuova prenotazione"
            tone="primary"
            onPress={openBookingDrawer}
            disabled={!canInstructorBook || isPending || Boolean(bookingPendingAction)}
            fullWidth
          />
        </GlassCard>

        <GlassCard title="Prossima guida" subtitle={loading ? 'Aggiornamento...' : 'In programma'}>
          {initialLoading ? (
            <SkeletonCard>
              <SkeletonBlock width="38%" height={20} />
              <SkeletonBlock width="62%" height={24} />
              <SkeletonBlock width="76%" />
              <SkeletonBlock width="68%" />
              <SkeletonBlock width="72%" />
              <SkeletonBlock width="100%" height={42} radius={14} style={styles.skeletonButton} />
            </SkeletonCard>
          ) : featuredLesson ? (
            <View style={styles.lessonRow}>
              <View style={styles.lessonInfo}>
                {getLessonStateMeta(featuredLesson, now) ? (
                  <LessonStateTag meta={getLessonStateMeta(featuredLesson, now)!} />
                ) : null}
                <Text style={styles.lessonTime}>
                  {formatDay(featuredLesson.startsAt)} · {formatTime(featuredLesson.startsAt)}
                </Text>
                <Text style={styles.lessonMeta}>
                  Allievo: {featuredLesson.student?.firstName} {featuredLesson.student?.lastName}
                </Text>
                <Text style={styles.lessonMeta}>Durata: {durationLabel(featuredLesson)}</Text>
                <Text style={styles.lessonMeta}>
                  Veicolo: {featuredLesson.vehicle?.name ?? 'Da assegnare'}
                </Text>
              </View>
              <View style={styles.topActions}>
                <View style={styles.topActionsRow}>
                  <View style={styles.actionHalf}>
                    <GlassButton
                      label={pendingAction === 'checked_in' ? 'Attendi...' : 'Check-in'}
                      tone="primary"
                      onPress={
                        !pendingAction && featuredActionAvailability?.enabled
                          ? () => executeStatusAction(featuredLesson, 'checked_in')
                          : undefined
                      }
                      disabled={Boolean(pendingAction) || !featuredActionAvailability?.enabled}
                      fullWidth
                    />
                  </View>
                  <View style={styles.actionHalf}>
                    <GlassButton
                      label={pendingAction === 'no_show' ? 'Attendi...' : 'No-show'}
                      tone="danger"
                      onPress={
                        !pendingAction && featuredActionAvailability?.enabled
                          ? () => executeStatusAction(featuredLesson, 'no_show')
                          : undefined
                      }
                      disabled={Boolean(pendingAction) || !featuredActionAvailability?.enabled}
                      fullWidth
                    />
                  </View>
                </View>
                <GlassButton
                  label="Apri dettagli guida"
                  tone="standard"
                  onPress={!pendingAction ? () => openLessonDrawer(featuredLesson) : undefined}
                  disabled={Boolean(pendingAction)}
                  fullWidth
                />
                {!featuredActionAvailability?.enabled && featuredCheckinHint ? (
                  <Text style={styles.actionHint}>{featuredCheckinHint}</Text>
                ) : null}
              </View>
            </View>
          ) : (
            <Text style={styles.emptyText}>Nessuna guida prevista.</Text>
          )}
        </GlassCard>

        <GlassCard title="Guide di oggi" subtitle="Future e passate della giornata">
          <View style={styles.agendaList}>
            {initialLoading
              ? Array.from({ length: 3 }).map((_, index) => (
                  <SkeletonCard key={`instructor-agenda-skeleton-${index}`}>
                    <SkeletonBlock width="56%" height={22} />
                    <SkeletonBlock width="74%" />
                    <SkeletonBlock width="62%" />
                    <SkeletonBlock width="100%" height={40} radius={14} style={styles.skeletonButton} />
                  </SkeletonCard>
                ))
              : todayLessons.map((lesson) => {
              const timeMeta = getTodayLessonTimingMeta(lesson, now);
              const lessonStateMeta = getLessonStateMeta(lesson, now);
              return (
                <View
                  key={lesson.id}
                  style={[styles.agendaRow, timeMeta.tone === 'past' ? styles.agendaRowPast : null]}
                >
                  <View style={styles.lessonInfo}>
                    <Text style={styles.lessonTime}>
                      {formatDay(lesson.startsAt)} · {formatTime(lesson.startsAt)}
                    </Text>
                    {timeMeta.tone !== 'live' ? (
                      <Text
                        style={[
                          styles.timeMetaTag,
                          timeMeta.tone === 'past'
                            ? styles.timeMetaTagPast
                            : styles.timeMetaTagFuture,
                        ]}
                      >
                        {timeMeta.label}
                      </Text>
                    ) : null}
                    <Text style={styles.lessonMeta}>
                      Allievo: {lesson.student?.firstName} {lesson.student?.lastName}
                    </Text>
                    <Text style={styles.lessonMeta}>Durata: {durationLabel(lesson)}</Text>
                    <Text style={styles.lessonMeta}>
                      Veicolo: {lesson.vehicle?.name ?? 'Da assegnare'}
                    </Text>
                    {lesson.notes ? (
                      <Text numberOfLines={1} style={styles.lessonMeta}>
                        Note: {lesson.notes}
                      </Text>
                    ) : null}
                    {lessonStateMeta ? <LessonStateTag meta={lessonStateMeta} compact /> : null}
                  </View>
                  <View style={styles.agendaActionWrap}>
                    <GlassButton
                      label="Dettagli"
                      tone="standard"
                      onPress={isDetailsEditable(lesson, now) ? () => openLessonDrawer(lesson) : undefined}
                      disabled={!isDetailsEditable(lesson, now)}
                      fullWidth
                    />
                  </View>
                </View>
              );
            })}
            {!initialLoading && !todayLessons.length ? (
              <Text style={styles.emptyText}>Nessuna guida oggi.</Text>
            ) : null}
          </View>
        </GlassCard>

        <GlassCard title="Guide future" subtitle="Scorri i giorni e apri azioni guida">
          <View style={styles.agendaList}>
            {!initialLoading && futureDayOptions.length ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.futureDaysScroller}
              >
                {futureDayOptions.map((day) => (
                  <SelectableChip
                    key={day.key}
                    label={`${day.label} · ${day.count}`}
                    active={selectedFutureDayKey === day.key}
                    onPress={() => setSelectedFutureDayKey(day.key)}
                    style={styles.futureDayChip}
                  />
                ))}
              </ScrollView>
            ) : null}
            {initialLoading
              ? Array.from({ length: 2 }).map((_, index) => (
                  <SkeletonCard key={`instructor-future-skeleton-${index}`}>
                    <SkeletonBlock width="56%" height={22} />
                    <SkeletonBlock width="74%" />
                    <SkeletonBlock width="62%" />
                    <SkeletonBlock width="100%" height={40} radius={14} style={styles.skeletonButton} />
                  </SkeletonCard>
                ))
              : visibleFutureLessons.map((lesson) => {
                  const lessonStateMeta = getLessonStateMeta(lesson, now);
                  const canOpenActions = isDetailsEditable(lesson, now) && !isPending;
                  return (
                    <View key={lesson.id} style={[styles.agendaRow, styles.futureAgendaRow]}>
                      <View style={styles.lessonInfo}>
                        <Text style={styles.lessonTime}>
                          {formatDay(lesson.startsAt)} · {formatTime(lesson.startsAt)}
                        </Text>
                        <Text style={styles.lessonMeta}>
                          Allievo: {lesson.student?.firstName} {lesson.student?.lastName}
                        </Text>
                        <Text style={styles.lessonMeta}>Durata: {durationLabel(lesson)}</Text>
                        <Text style={styles.lessonMeta}>
                          Veicolo: {lesson.vehicle?.name ?? 'Da assegnare'}
                        </Text>
                        {lessonStateMeta ? <LessonStateTag meta={lessonStateMeta} compact /> : null}
                      </View>
                      <View style={styles.futureRowActions}>
                        <GlassButton
                          label="Azioni"
                          tone="standard"
                          onPress={canOpenActions ? () => openLessonDrawer(lesson) : undefined}
                          disabled={!canOpenActions}
                          fullWidth
                        />
                      </View>
                    </View>
                  );
                })}
            {!initialLoading && !visibleFutureLessons.length ? (
              <Text style={styles.emptyText}>Nessuna guida futura.</Text>
            ) : null}
          </View>
        </GlassCard>
      </ScrollView>

      <BottomSheet
        visible={Boolean(sheetLesson)}
        onClose={() => {
          if (!isPending) setSheetLesson(null);
        }}
        closeDisabled={isPending}
        title="Gestisci guida"
        footer={
          <View style={styles.sheetFooterActions}>
            <GlassButton
              label={pendingAction === 'save_details' ? 'Salvataggio...' : 'Salva dettagli'}
              tone="standard"
              onPress={!isPending && isSheetDetailsEditable ? handleSaveDetails : undefined}
              disabled={isPending || !isSheetDetailsEditable}
              fullWidth
            />
            <GlassButton
              label={
                pendingAction === 'reposition'
                  ? 'Attendi...'
                  : instructorBookingMode === 'manual_full'
                    ? 'Annulla guida'
                    : 'Cancella e riposiziona'
              }
              tone="danger"
              onPress={
                !isPending && sheetLesson && canRepositionSheetLesson
                  ? () => handleCancelByMode(sheetLesson)
                  : undefined
              }
              disabled={isPending || !canRepositionSheetLesson}
              fullWidth
            />
            {canRunStatusAction ? (
              <>
                <GlassButton
                  label={pendingAction === 'checked_in' ? 'Attendi...' : 'Check-in'}
                  tone="primary"
                  onPress={isPending ? undefined : () => handleStatusAction('checked_in')}
                  disabled={isPending}
                  fullWidth
                />
                <GlassButton
                  label={pendingAction === 'no_show' ? 'Attendi...' : 'No-show'}
                  tone="danger"
                  onPress={isPending ? undefined : () => handleStatusAction('no_show')}
                  disabled={isPending}
                  fullWidth
                />
              </>
            ) : null}
          </View>
        }
      >
        {sheetLesson ? (
          <View style={styles.sheetContent}>
            <Text style={styles.sheetMeta}>
              {formatDay(sheetLesson.startsAt)} · {formatTime(sheetLesson.startsAt)} · {durationLabel(sheetLesson)}
            </Text>
            <Text style={styles.sheetMeta}>
              Allievo: {sheetLesson.student?.firstName} {sheetLesson.student?.lastName}
            </Text>
            <Text style={styles.sheetMeta}>
              Veicolo: {sheetLesson.vehicle?.name ?? 'Da assegnare'}
            </Text>
            <View style={styles.sheetStatusRow}>
              <Text style={styles.sheetMeta}>Stato guida:</Text>
              {sheetStateMeta ? (
                <LessonStateTag meta={sheetStateMeta} compact />
              ) : (
                <Text style={styles.sheetMeta}>{getLessonStateLabel(sheetLesson, now)}</Text>
              )}
            </View>

            <View style={styles.lessonTypeBlock}>
              <Text style={styles.lessonTypeTitle}>Tipo guida</Text>
              <View style={styles.lessonTypeList}>
                {LESSON_TYPE_OPTIONS.map((option) => (
                  <SelectableChip
                    key={option.value}
                    label={option.label}
                    active={selectedLessonType === option.value}
                    onPress={() => setSelectedLessonType(option.value)}
                    style={styles.lessonTypeChip}
                  />
                ))}
              </View>
            </View>

            <View style={styles.notesBlock}>
              <Text style={styles.notesTitle}>Note guida</Text>
              <TextInput
                value={lessonNotes}
                onChangeText={setLessonNotes}
                placeholder="Aggiungi note operative o osservazioni."
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={4}
                style={styles.notesInput}
                editable={!isPending}
              />
            </View>
          </View>
        ) : null}
      </BottomSheet>

      <BottomSheet
        visible={bookingSheetOpen}
        onClose={() => {
          if (!bookingPendingAction) {
            setBookingSheetOpen(false);
          }
        }}
        closeDisabled={Boolean(bookingPendingAction)}
        title="Nuova prenotazione istruttore"
        footer={bookingSheetFooter}
      >
        <View style={styles.sheetContent}>
          <Text style={styles.sheetMeta}>
            Modalità attiva: {INSTRUCTOR_MODE_LABEL[instructorBookingMode]}.
          </Text>

          {!canInstructorBook ? (
            <Text style={styles.actionHint}>
              La prenotazione da app è abilitata solo per allievi.
            </Text>
          ) : null}

          <View style={styles.lessonTypeBlock}>
            <Text style={styles.lessonTypeTitle}>Allievo</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipScroller}
            >
              {students.map((student) => {
                const isActive = bookingStudentId === student.id;
                return (
                  <SelectableChip
                    key={student.id}
                    label={`${student.firstName} ${student.lastName}`}
                    active={isActive}
                    onPress={() => resetGuidedSuggestionForStudent(student.id)}
                    style={styles.lessonTypeChip}
                  />
                );
              })}
            </ScrollView>
            {!students.length ? (
              <Text style={styles.actionHint}>Nessun allievo disponibile.</Text>
            ) : null}
          </View>

          {instructorBookingMode === 'guided_proposal' ? (
            <>
              {guidedSuggestion ? (
                <View style={styles.guidedSuggestionCard}>
                  <Text style={styles.guidedSuggestionTitle}>Slot suggerito dal motore</Text>
                  <Text style={styles.sheetMeta}>
                    {formatDay(guidedSuggestion.startsAt)} · {formatTime(guidedSuggestion.startsAt)}
                  </Text>
                  <Text style={styles.sheetMeta}>
                    Durata: {guidedSuggestion.durationMinutes} min
                  </Text>
                  <Text style={styles.sheetMeta}>
                    Tipo guida: {guidedSuggestion.suggestedLessonType || 'guida'}
                  </Text>
                </View>
              ) : (
                <Text style={styles.actionHint}>
                  Seleziona l’allievo e premi “Trova slot” per ricevere una proposta ottimizzata.
                </Text>
              )}
            </>
          ) : (
            <>
              <View style={styles.lessonTypeBlock}>
                <Text style={styles.lessonTypeTitle}>Veicolo</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipScroller}
                >
                  {vehicles.map((vehicle) => (
                    <SelectableChip
                      key={vehicle.id}
                      label={vehicle.name}
                      active={bookingVehicleId === vehicle.id}
                      onPress={() => setBookingVehicleId(vehicle.id)}
                      style={styles.lessonTypeChip}
                    />
                  ))}
                </ScrollView>
                {!vehicles.length ? (
                  <Text style={styles.actionHint}>Nessun veicolo disponibile.</Text>
                ) : null}
              </View>

              <View style={styles.pickerRow}>
                <PickerField
                  label="Giorno"
                  value={bookingDate}
                  mode="date"
                  onChange={(nextDate) => {
                    setBookingDate(nextDate);
                    setGuidedSuggestion(null);
                  }}
                />
              </View>
              <View style={styles.pickerRow}>
                <PickerField
                  label="Ora inizio"
                  value={bookingStartTime}
                  mode="time"
                  onChange={(nextTime) => {
                    setBookingStartTime(nextTime);
                    setGuidedSuggestion(null);
                  }}
                />
              </View>

              <View style={styles.lessonTypeBlock}>
                <Text style={styles.lessonTypeTitle}>Durata slot</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipScroller}
                >
                  {bookingDurations.map((duration) => (
                    <SelectableChip
                      key={`duration-${duration}`}
                      label={`${duration} min`}
                      active={bookingDuration === duration}
                      onPress={() => {
                        setBookingDuration(duration);
                        setGuidedSuggestion(null);
                      }}
                      style={styles.lessonTypeChip}
                    />
                  ))}
                </ScrollView>
              </View>
            </>
          )}

          {instructorBookingMode !== 'guided_proposal' ? (
            <View style={styles.lessonTypeBlock}>
              <Text style={styles.lessonTypeTitle}>Tipo guida (facoltativo)</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipScroller}
              >
                {LESSON_TYPE_OPTIONS.map((option) => (
                  <SelectableChip
                    key={option.value}
                    label={option.label}
                    active={bookingLessonType === option.value}
                    onPress={() => setBookingLessonType(option.value)}
                    style={styles.lessonTypeChip}
                  />
                ))}
              </ScrollView>
            </View>
          ) : null}
        </View>
      </BottomSheet>
    </Screen>
  );
};

const LessonStateTag = ({
  meta,
  compact = false,
}: {
  meta: { label: string; tone: 'live' | 'confirmed' | 'scheduled' };
  compact?: boolean;
}) => (
  <View
    style={[
      styles.stateTag,
      meta.tone === 'live'
        ? styles.stateTagLive
        : meta.tone === 'scheduled'
          ? styles.stateTagScheduled
          : styles.stateTagConfirmed,
      compact && styles.stateTagCompact,
    ]}
  >
    <Text numberOfLines={1} style={[styles.stateTagText, compact && styles.stateTagTextCompact]}>
      {meta.label}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.xxl * 2,
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
    gap: spacing.md,
  },
  lessonInfo: {
    flex: 1,
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
    gap: spacing.md,
  },
  agendaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(50, 77, 122, 0.12)',
    backgroundColor: 'rgba(255, 255, 255, 0.56)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  agendaRowPast: {
    opacity: 0.85,
  },
  agendaActionWrap: {
    width: 116,
  },
  futureAgendaRow: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: spacing.sm,
  },
  futureDaysScroller: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingBottom: spacing.xs,
  },
  futureDayChip: {
    borderRadius: 999,
  },
  futureRowActions: {
    width: '100%',
  },
  topActions: {
    gap: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: 'rgba(50, 77, 122, 0.1)',
    paddingTop: spacing.sm,
  },
  topActionsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  actionHalf: {
    flex: 1,
  },
  actionHint: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  skeletonButton: {
    marginTop: spacing.xs,
  },
  timeMetaTag: {
    ...typography.caption,
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    marginTop: spacing.xs,
    fontWeight: '700',
  },
  timeMetaTagFuture: {
    backgroundColor: 'rgba(50, 77, 122, 0.12)',
    color: colors.textSecondary,
  },
  timeMetaTagPast: {
    backgroundColor: 'rgba(124, 140, 170, 0.18)',
    color: '#5D6D88',
  },
  stateTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: spacing.xs,
  },
  stateTagLive: {
    backgroundColor: '#1FD38A',
  },
  stateTagConfirmed: {
    backgroundColor: '#49C99C',
  },
  stateTagScheduled: {
    backgroundColor: '#6F85AB',
  },
  stateTagText: {
    ...typography.caption,
    color: '#FFFFFF',
    fontWeight: '700',
    letterSpacing: 0,
    flexShrink: 0,
  },
  stateTagCompact: {
    marginTop: spacing.xs,
    marginBottom: 0,
    paddingVertical: 2,
    paddingHorizontal: spacing.xs,
  },
  stateTagTextCompact: {
    fontSize: 10,
  },
  sheetContent: {
    gap: spacing.sm,
  },
  sheetMeta: {
    ...typography.body,
    color: colors.textSecondary,
  },
  sheetStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  lessonTypeBlock: {
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  lessonTypeTitle: {
    ...typography.body,
    color: colors.textPrimary,
  },
  lessonTypeList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chipScroller: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingVertical: 1,
  },
  lessonTypeChip: {
    marginRight: spacing.xs,
  },
  notesBlock: {
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  notesTitle: {
    ...typography.body,
    color: colors.textPrimary,
  },
  notesInput: {
    minHeight: 96,
    borderWidth: 1,
    borderColor: 'rgba(50, 77, 122, 0.18)',
    borderRadius: 14,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
    backgroundColor: 'rgba(255, 255, 255, 0.82)',
    textAlignVertical: 'top',
    ...typography.body,
  },
  sheetFooterActions: {
    gap: spacing.sm,
    width: '100%',
  },
  pickerRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  timePickerFieldWrap: {
    flex: 1,
  },
  timePickerField: {
    borderRadius: 14,
  },
  timePickerFieldPressed: {
    opacity: 0.8,
  },
  pickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.3)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  pickerCard: {
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  pickerTitle: {
    ...typography.subtitle,
    color: colors.textPrimary,
  },
  guidedSuggestionCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(50, 77, 122, 0.16)',
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  guidedSuggestionTitle: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  emptyState: {
    flex: 1,
    padding: spacing.lg,
    justifyContent: 'center',
  },
  emptyText: {
    ...typography.body,
    color: colors.textMuted,
  },
  error: {
    ...typography.body,
    color: colors.danger,
  },
});
