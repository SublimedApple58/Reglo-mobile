import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Keyboard,
  KeyboardEvent,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  interpolate,
  Easing,
} from 'react-native-reanimated';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../components/Screen';
import { Badge } from '../components/Badge';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { BottomSheet } from '../components/BottomSheet';
import { Input } from '../components/Input';
import { CalendarDrawer } from '../components/CalendarDrawer';
import { RescheduleAppointmentSheet } from '../components/RescheduleAppointmentSheet';
import { TimePickerDrawer } from '../components/TimePickerDrawer';
import { CalendarNavigatorRange } from '../components/CalendarNavigator';
import { SearchableSelect } from '../components/SearchableSelect';
import { SelectableChip } from '../components/SelectableChip';
import WeeklyAgendaView from '../components/WeeklyAgendaView';
import { sessionStorage } from '../services/sessionStorage';
import { StarRating } from '../components/StarRating';
import { SkeletonBlock, SkeletonCard } from '../components/Skeleton';
import { ToastNotice, ToastTone } from '../components/ToastNotice';
import { regloApi } from '../services/regloApi';
import {
  AutoscuolaAppointmentWithRelations,
  AutoscuolaSettings,
  InstructorBlock,
  InstructorBookingSuggestion,
  OutOfAvailabilityAppointment,
} from '../types/regloApi';
import { useNavigation } from '@react-navigation/native';
import { colors, radii, spacing, typography } from '../theme';
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

const INSTRUCTOR_MODE_LABEL: Record<'manual_full' | 'manual_engine', string> = {
  manual_full: 'Manuale totale',
  manual_engine: 'Manuale + motore',
};

const normalizeStatus = (value: string | null | undefined) =>
  (value ?? '').trim().toLowerCase();

const WEEKDAYS_SHORT = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'] as const;
const MONTHS_SHORT = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'] as const;

const smartDayLabel = (isoDate: string, now: Date): string => {
  const target = new Date(isoDate);
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const targetStart = new Date(target);
  targetStart.setHours(0, 0, 0, 0);
  const diffDays = Math.round((targetStart.getTime() - todayStart.getTime()) / 86400000);
  if (diffDays === 0) return 'Oggi';
  if (diffDays === 1) return 'Domani';
  if (diffDays === 2) return 'Dopodomani';
  if (diffDays > 2 && diffDays <= 6) return WEEKDAYS_SHORT[target.getDay()];
  return `${target.getDate()} ${MONTHS_SHORT[target.getMonth()]}`;
};

const ALLOWED_ACTION_STATUSES = new Set(['scheduled', 'confirmed', 'pending_review']);
const CLOSED_ACTION_STATUSES = new Set(['cancelled', 'completed', 'no_show']);
const VISIBLE_LESSON_STATUSES = new Set(['scheduled', 'confirmed', 'checked_in', 'pending_review', 'proposal', 'completed', 'no_show', 'cancelled']);
const DETAILS_EDITABLE_STATUSES = new Set([
  'scheduled',
  'confirmed',
  'checked_in',
  'completed',
  'no_show',
  'pending_review',
]);

const STATUS_PRIORITY: Record<string, number> = {
  checked_in: 5,
  pending_review: 4,
  completed: 4,
  no_show: 3,
  scheduled: 2,
  confirmed: 2,
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

const isLessonInProgressWindow = (
  lesson: AutoscuolaAppointmentWithRelations,
  now: Date,
) => {
  const startsAt = new Date(lesson.startsAt);
  const endsAt = getLessonEnd(lesson);
  return now >= startsAt && now < endsAt;
};

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

const toDateOnlyString = (value: Date) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getActionAvailability = (
  lesson: AutoscuolaAppointmentWithRelations,
  now: Date,
  autoCheckinEnabled = false,
) => {
  const status = normalizeStatus(lesson.status);
  if (status === 'checked_in' && !autoCheckinEnabled) {
    return { enabled: false, reason: null as string | null };
  }
  if (status === 'checked_in' && autoCheckinEnabled) {
    const { closesAt } = computeStatusWindow(lesson);
    if (now > closesAt) {
      return { enabled: false, reason: null as string | null };
    }
    return { enabled: true, reason: '' };
  }
  if (CLOSED_ACTION_STATUSES.has(status)) {
    return { enabled: false, reason: null as string | null };
  }
  if (status === 'proposal') {
    return { enabled: false, reason: null as string | null };
  }
  if (!ALLOWED_ACTION_STATUSES.has(status)) {
    return { enabled: false, reason: null as string | null };
  }
  // pending_review lessons can be acted on at any time (no time window)
  if (status === 'pending_review') {
    return { enabled: true, reason: '' };
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
  if (status === 'pending_review') {
    return { label: 'Da confermare', tone: 'pending_review' as const };
  }
  if (isLessonInProgressWindow(lesson, now)) {
    if (status === 'checked_in') {
      return { label: 'In corso', tone: 'live' as const };
    }
    return { label: 'In corso', tone: 'scheduled' as const };
  }
  if (status === 'checked_in') {
    return { label: 'Confermata', tone: 'confirmed' as const };
  }
  if (status === 'proposal') {
    return { label: 'Proposta', tone: 'pending_review' as const };
  }
  if (status === 'completed') {
    return { label: 'Completata', tone: 'confirmed' as const };
  }
  if (status === 'no_show') {
    return { label: 'Assente', tone: 'pending_review' as const };
  }
  if (status === 'cancelled') {
    return { label: 'Annullata', tone: 'pending_review' as const };
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

const canOperationalReposition = (
  lesson: AutoscuolaAppointmentWithRelations,
  now: Date,
) => {
  const status = normalizeStatus(lesson.status);
  if (CLOSED_ACTION_STATUSES.has(status)) return false;
  return new Date(lesson.startsAt).getTime() > now.getTime();
};

const pickFeaturedLesson = (
  source: AutoscuolaAppointmentWithRelations[],
  now: Date,
) => {
  const active = source.filter((item) => VISIBLE_LESSON_STATUSES.has(normalizeStatus(item.status)));
  const inProgress = [...active]
    .filter((item) => isLessonInProgressWindow(item, now))
    .sort((a, b) => {
      const aCheckedIn = normalizeStatus(a.status) === 'checked_in' ? 1 : 0;
      const bCheckedIn = normalizeStatus(b.status) === 'checked_in' ? 1 : 0;
      if (aCheckedIn !== bCheckedIn) return bCheckedIn - aCheckedIn;
      return getStartsAtTs(a) - getStartsAtTs(b);
    })[0];
  if (inProgress) return inProgress;

  return [...active]
    .filter((item) => {
      const status = normalizeStatus(item.status);
      if (status === 'checked_in') return getLessonEnd(item) >= now;
      return new Date(item.startsAt) >= now;
    })
    .sort((a, b) => getStartsAtTs(a) - getStartsAtTs(b))[0] ?? null;
};

const toTimeString = (value: Date) =>
  value.toLocaleTimeString('it-IT', {
    hour: '2-digit',
    minute: '2-digit',
  });

const addDays = (date: Date, amount: number) => {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + amount);
  return copy;
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
          <Input
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
                <Button label="Fatto" onPress={close} />
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
  const router = useRouter();
  const { instructorId, user } = useSession();
  const { height: windowHeight, width: screenWidth } = useWindowDimensions();
  const [appointments, setAppointments] = useState<AutoscuolaAppointmentWithRelations[]>([]);
  const [featuredAppointments, setFeaturedAppointments] = useState<
    AutoscuolaAppointmentWithRelations[]
  >([]);
  const [students, setStudents] = useState<Array<{ id: string; firstName: string; lastName: string; phone?: string | null; assignedInstructorId?: string | null }>>([]);
  const [vehicles, setVehicles] = useState<Array<{ id: string; name: string }>>([]);
  const [settings, setSettings] = useState<AutoscuolaSettings | null>(null);
  const [studentCompletedMinutes, setStudentCompletedMinutes] = useState<Record<string, number>>({});
  const [calendarRange, setCalendarRange] = useState<CalendarNavigatorRange | null>(null);
  const [clockTick, setClockTick] = useState(() => Date.now());
  const [initialLoading, setInitialLoading] = useState(true);
  const [rangeLoading, setRangeLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; tone: ToastTone } | null>(null);
  const [sheetLesson, setSheetLesson] = useState<AutoscuolaAppointmentWithRelations | null>(null);
  const [swapModalOpen, setSwapModalOpen] = useState(false);
  const [swapPending, setSwapPending] = useState(false);
  const [swapSearch, setSwapSearch] = useState('');
  const [swapSourceLesson, setSwapSourceLesson] = useState<AutoscuolaAppointmentWithRelations | null>(null);
  const [rescheduleLesson, setRescheduleLesson] = useState<AutoscuolaAppointmentWithRelations | null>(null);
  const pendingRescheduleRef = useRef<AutoscuolaAppointmentWithRelations | null>(null);
  const [examDrawerGroup, setExamDrawerGroup] = useState<{
    id: string;
    startsAt: string;
    endsAt: string | null;
    instructorId: string | null;
    instructorName: string | null;
    notes: string | null;
    appointments: AutoscuolaAppointmentWithRelations[];
  } | null>(null);
  const [examActionPending, setExamActionPending] = useState<string | null>(null); // appointmentId being processed | 'all'
  const [sheetScrollAtBottom, setSheetScrollAtBottom] = useState(false);
  const [sheetScrollAtTop, setSheetScrollAtTop] = useState(true);
  const [selectedLessonTypes, setSelectedLessonTypes] = useState<string[]>([]);
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [lessonNotes, setLessonNotes] = useState('');
  const [pendingAction, setPendingAction] = useState<DrawerAction | null>(null);
  const [instructorBlocks, setInstructorBlocks] = useState<InstructorBlock[]>([]);
  const [blockSheetOpen, setBlockSheetOpen] = useState(false);
  const [blockDate, setBlockDate] = useState<Date>(() => new Date());
  const [blockStartTime, setBlockStartTime] = useState<Date>(() => new Date());
  const [blockEndTime, setBlockEndTime] = useState<Date>(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() + 60);
    return d;
  });
  const [blockReason, setBlockReason] = useState('');
  const [blockRecurring, setBlockRecurring] = useState(false);
  const [blockRecurringWeeks, setBlockRecurringWeeks] = useState(4);
  const [blockPending, setBlockPending] = useState(false);
  const [blockCalendarOpen, setBlockCalendarOpen] = useState(false);
  const [blockStartTimePickerOpen, setBlockStartTimePickerOpen] = useState(false);
  const [blockEndTimePickerOpen, setBlockEndTimePickerOpen] = useState(false);
  // Sick leave state
  const [sickSheetOpen, setSickSheetOpen] = useState(false);
  const [sickStartDate, setSickStartDate] = useState<Date>(() => new Date());
  const [sickEndDate, setSickEndDate] = useState<Date>(() => new Date());
  const [sickHalfDay, setSickHalfDay] = useState(false);
  const [sickStartTime, setSickStartTime] = useState<Date>(() => { const d = new Date(); d.setHours(14, 0, 0, 0); return d; });
  const [sickPending, setSickPending] = useState(false);
  const [sickStartCalendarOpen, setSickStartCalendarOpen] = useState(false);
  const [sickEndCalendarOpen, setSickEndCalendarOpen] = useState(false);
  const [sickTimePickerOpen, setSickTimePickerOpen] = useState(false);
  const sickNavigatingToPicker = useRef(false);
  const [bookingSheetOpen, setBookingSheetOpen] = useState(false);
  const [bookingPendingAction, setBookingPendingAction] = useState<BookingDrawerAction>(null);
  const [bookingStudentId, setBookingStudentId] = useState<string>('');
  const [bookingVehicleId, setBookingVehicleId] = useState<string>('');
  const [bookingLessonTypes, setBookingLessonTypes] = useState<string[]>(['guida']);
  const [bookingDate, setBookingDate] = useState<Date>(() => new Date());
  const [bookingStartTime, setBookingStartTime] = useState<Date>(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 30 - (now.getMinutes() % 30), 0, 0);
    return now;
  });
  const [bookingDuration, setBookingDuration] = useState<number>(60);
  const [guidedSuggestion, setGuidedSuggestion] = useState<InstructorBookingSuggestion | null>(null);
  const [guidedPreferredDate, setGuidedPreferredDate] = useState<Date | null>(null);
  // ── Multi-booking state ──
  type MultiBookingEntry = { id: string; date: Date; startTime: Date; duration: number };
  const [multiBookingMode, setMultiBookingMode] = useState(false);
  const [multiBookingEntries, setMultiBookingEntries] = useState<MultiBookingEntry[]>([]);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editingEntryField, setEditingEntryField] = useState<'date' | 'time' | null>(null);
  const [latestStudentLessonNote, setLatestStudentLessonNote] = useState<{
    startsAt: string;
    note: string;
  } | null>(null);
  const [studentNotesMap, setStudentNotesMap] = useState<Record<string, string | null>>({});
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const rangeKeyRef = useRef<string | null>(null);
  const loadRequestRef = useRef(0);
  const lessonSheetScrollRef = useRef<ScrollView | null>(null);
  const bookingSheetScrollRef = useRef<ScrollView | null>(null);
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [agendaViewMode, setAgendaViewMode] = useState<'day' | 'week'>('day');
  const [calendarDrawerOpen, setCalendarDrawerOpen] = useState(false);
  const [bookingCalendarOpen, setBookingCalendarOpen] = useState(false);
  const [guidedCalendarOpen, setGuidedCalendarOpen] = useState(false);
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const [availableHours, setAvailableHours] = useState<Set<number>>(new Set());
  const [availabilitySlots, setAvailabilitySlots] = useState<Array<{ startMinutes: number; endMinutes: number }>>([]);
  const [weekAvailability, setWeekAvailability] = useState<Record<number, Array<{ startMinutes: number; endMinutes: number }>>>({});
  const [outOfAvailAppointments, setOutOfAvailAppointments] = useState<OutOfAvailabilityAppointment[]>([]);
  const [outOfAvailSheetOpen, setOutOfAvailSheetOpen] = useState(false);
  const [outOfAvailActionPending, setOutOfAvailActionPending] = useState<string | null>(null);
  const [holidays, setHolidays] = useState<Set<string>>(new Set());
  const [instructorAutonomousMode, setInstructorAutonomousMode] = useState(false);
  const [clusterDurations, setClusterDurations] = useState<number[] | null>(null);
  const [emergencyAllStudents, setEmergencyAllStudents] = useState(false);
  const [myStudentsExpanded, setMyStudentsExpanded] = useState(false);
  const dayScrollRef = useRef<ScrollView | null>(null);

  const loadData = useCallback(async (): Promise<AutoscuolaAppointmentWithRelations[]> => {
    if (!instructorId) return [];
    const requestId = ++loadRequestRef.current;
    setError(null);
    let shouldShowRangeSkeleton = false;
    try {
      const from = calendarRange ? new Date(calendarRange.from) : new Date();
      const to = calendarRange ? new Date(calendarRange.to) : new Date();
      if (!calendarRange) {
        from.setDate(from.getDate() - 1);
        from.setHours(0, 0, 0, 0);
        to.setDate(to.getDate() + 14);
        to.setHours(23, 59, 59, 999);
      }
      const rangeKey = `${from.toISOString()}|${to.toISOString()}`;
      if (rangeKeyRef.current !== rangeKey) {
        shouldShowRangeSkeleton = true;
        setRangeLoading(true);
      }
      rangeKeyRef.current = rangeKey;
      const featuredFrom = new Date();
      featuredFrom.setDate(featuredFrom.getDate() - 1);
      featuredFrom.setHours(0, 0, 0, 0);
      const featuredTo = new Date();
      featuredTo.setDate(featuredTo.getDate() + 60);
      featuredTo.setHours(23, 59, 59, 999);

      const [
        agendaBootstrap,
        featuredAppointmentsResponse,
        settingsResponse,
        wideSickBlocks,
        clusterSettingsResponse,
      ] =
        await Promise.all([
          regloApi.getAgendaBootstrap({
            instructorId,
            from: from.toISOString(),
            to: to.toISOString(),
            limit: 280,
          }),
          regloApi.getAppointments({
            instructorId,
            from: featuredFrom.toISOString(),
            to: featuredTo.toISOString(),
            limit: 220,
            light: true,
          }),
          regloApi.getAutoscuolaSettings(),
          // Lightweight fetch of sick_leave blocks over wide range for calendar dots
          regloApi.getInstructorBlocks({
            instructorId,
            from: featuredFrom.toISOString(),
            to: featuredTo.toISOString(),
            reason: 'sick_leave',
          }),
          regloApi.getInstructorSettings().catch(() => null),
        ]);
      if (requestId !== loadRequestRef.current) {
        return [];
      }
      setSettings(settingsResponse);
      setStudents(agendaBootstrap.students);
      setVehicles(agendaBootstrap.vehicles);
      const currentInstructor = agendaBootstrap.instructors?.find(
        (inst) => inst.id === instructorId,
      );
      setInstructorAutonomousMode(currentInstructor?.autonomousMode ?? false);
      // Use cluster durations if instructor has them configured
      if (clusterSettingsResponse?.settings?.bookingSlotDurations?.length) {
        setClusterDurations(clusterSettingsResponse.settings.bookingSlotDurations);
      } else {
        setClusterDurations(null);
      }
      const freshBlocks = (agendaBootstrap.instructorBlocks ?? []).filter(
        (b) => b.instructorId === instructorId,
      );
      // Merge wide-range sick_leave blocks with current-range blocks
      const mergedBlocks = [...freshBlocks];
      for (const sb of wideSickBlocks) {
        if (!mergedBlocks.some((b) => b.id === sb.id)) {
          mergedBlocks.push(sb);
        }
      }
      setInstructorBlocks(mergedBlocks);
      const nextAppointments = dedupeAppointments(
        agendaBootstrap.appointments.filter((item) => item.instructorId === instructorId),
      );
      const nextFeaturedAppointments = dedupeAppointments(
        featuredAppointmentsResponse.filter((item) => item.instructorId === instructorId),
      );
      setAppointments(nextAppointments);
      setFeaturedAppointments(nextFeaturedAppointments);
      return nextAppointments;
    } catch (err) {
      if (requestId !== loadRequestRef.current) {
        return [];
      }
      setError(err instanceof Error ? err.message : 'Errore nel caricamento');
      return [];
    } finally {
      if (requestId === loadRequestRef.current) {
        setInitialLoading(false);
        if (shouldShowRangeSkeleton) {
          setRangeLoading(false);
        }
      }
    }
  }, [calendarRange, instructorId]);

  const loadOutOfAvailability = useCallback(async () => {
    if (!instructorId) return;
    try {
      const data = await regloApi.getOutOfAvailabilityAppointments(instructorId);
      setOutOfAvailAppointments(Array.isArray(data) ? data : []);
    } catch {
      // silent
    }
  }, [instructorId]);

  const loadHolidays = useCallback(async () => {
    try {
      const today = new Date();
      const from = addDays(today, -14);
      const to = addDays(today, 52 * 7);
      const response = await regloApi.getHolidays({
        from: from.toISOString(),
        to: to.toISOString(),
      });
      const set = new Set<string>();
      const list = Array.isArray(response) ? response : [];
      for (const h of list) {
        const d = new Date(h.date);
        set.add(toDateOnlyString(d));
      }
      setHolidays(set);
    } catch {
      // silent
    }
  }, []);

  const handleOutOfAvailAction = useCallback(async (
    appointmentId: string,
    action: 'cancel' | 'reposition' | 'approve',
  ) => {
    setOutOfAvailActionPending(appointmentId);
    try {
      if (action === 'cancel') {
        await regloApi.cancelAppointment(appointmentId);
        setToast({ text: 'Guida cancellata.', tone: 'success' });
      } else if (action === 'reposition') {
        await regloApi.repositionAppointment(appointmentId);
        setToast({ text: 'Riposizionamento avviato.', tone: 'success' });
      } else {
        await regloApi.approveAvailabilityOverride(appointmentId);
        setToast({ text: 'Guida mantenuta.', tone: 'success' });
      }
      loadOutOfAvailability();
      loadData();
    } catch {
      setToast({ text: 'Errore durante l\'operazione.', tone: 'danger' });
    } finally {
      setOutOfAvailActionPending(null);
    }
  }, [loadData, loadOutOfAvailability]);

  useEffect(() => {
    loadData().then(() => loadOutOfAvailability());
  }, [loadData, loadOutOfAvailability]);

  useEffect(() => {
    sessionStorage.getAgendaViewMode().then(setAgendaViewMode);
    regloApi.getStudentsCompletedHours().then(setStudentCompletedMinutes).catch(() => {});
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setClockTick(Date.now());
    }, 30_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const resolveKeyboardHeight = (event: KeyboardEvent) => {
      const screenY = event.endCoordinates?.screenY;
      if (typeof screenY === 'number') {
        return Math.max(0, windowHeight - screenY);
      }
      return Math.max(0, event.endCoordinates?.height ?? 0);
    };

    const onShowOrChange = (event: KeyboardEvent) => {
      setKeyboardHeight(resolveKeyboardHeight(event));
    };

    const onHide = () => setKeyboardHeight(0);

    const subs =
      Platform.OS === 'ios'
        ? [
            Keyboard.addListener('keyboardWillShow', onShowOrChange),
            Keyboard.addListener('keyboardWillChangeFrame', onShowOrChange),
            Keyboard.addListener('keyboardWillHide', onHide),
            Keyboard.addListener('keyboardDidHide', onHide),
          ]
        : [
            Keyboard.addListener('keyboardDidShow', onShowOrChange),
            Keyboard.addListener('keyboardDidHide', onHide),
          ];

    return () => {
      subs.forEach((sub) => sub.remove());
    };
  }, [windowHeight]);

  const now = useMemo(() => new Date(clockTick), [clockTick]);
  const bookingActors = settings?.appBookingActors ?? 'students';
  const instructorBookingMode = settings?.instructorBookingMode ?? 'manual_engine';
  const canInstructorBook =
    bookingActors === 'instructors' || bookingActors === 'both';
  const bookingDurations = useMemo(
    () =>
      (clusterDurations ?? settings?.bookingSlotDurations ?? [30, 60]).slice().sort((a, b) => a - b),
    [clusterDurations, settings?.bookingSlotDurations],
  );
  const clustersActive = Boolean(instructorAutonomousMode);
  const assignedStudents = useMemo(
    () => students.filter((s) => s.assignedInstructorId === instructorId),
    [students, instructorId],
  );
  const unassignedStudents = useMemo(
    () => students.filter((s) => s.assignedInstructorId !== instructorId),
    [students, instructorId],
  );
  const bookingStudentOptions = useMemo(() => {
    const toOption = (student: typeof students[number]) => ({
      value: student.id,
      label: `${student.firstName} ${student.lastName}`.trim(),
      subtitle: null as string | null,
    });
    // Clusters not active: show all students unchanged
    if (!clustersActive) {
      return students.map(toOption);
    }
    // Clusters active + emergency mode: assigned first, separator, then others
    if (emergencyAllStudents) {
      const assigned = assignedStudents.map(toOption);
      if (unassignedStudents.length > 0) {
        const separator = {
          value: '__separator__',
          label: '\u2500 Altri allievi \u2500',
          subtitle: null as string | null,
        };
        return [...assigned, separator, ...unassignedStudents.map(toOption)];
      }
      return assigned;
    }
    // Clusters active, normal mode: only assigned students
    return assignedStudents.map(toOption);
  }, [students, assignedStudents, unassignedStudents, clustersActive, emergencyAllStudents]);
  const selectedBookingStudent = useMemo(
    () => students.find((student) => student.id === bookingStudentId) ?? null,
    [bookingStudentId, students],
  );
  const appointmentsLoading = initialLoading || rangeLoading;

  const normalizeToQuarter = useCallback((value: Date) => {
    const next = new Date(value);
    next.setSeconds(0, 0);
    const minutes = next.getMinutes();
    const rounded = Math.ceil(minutes / 15) * 15;
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
    return normalizeToQuarter(date);
  }, [bookingDate, bookingStartTime, normalizeToQuarter]);

  const openBlockDrawer = useCallback(() => {
    const roundedNow = normalizeToQuarter(new Date());
    const endTime = new Date(roundedNow);
    endTime.setMinutes(endTime.getMinutes() + 60);
    setBlockDate(selectedDate);
    setBlockStartTime(roundedNow);
    setBlockEndTime(endTime);
    setBlockReason('');
    setBlockRecurring(false);
    setBlockRecurringWeeks(4);
    setBlockSheetOpen(true);
  }, [normalizeToQuarter, selectedDate]);

  const handleCreateBlock = useCallback(async () => {
    setBlockPending(true);
    try {
      const startsAt = new Date(blockDate);
      const startT = new Date(blockStartTime);
      startsAt.setHours(startT.getHours(), startT.getMinutes(), 0, 0);
      const endsAt = new Date(blockDate);
      const endT = new Date(blockEndTime);
      endsAt.setHours(endT.getHours(), endT.getMinutes(), 0, 0);
      if (endsAt <= startsAt) {
        setToast({ text: "L'ora di fine deve essere dopo l'inizio.", tone: 'danger' });
        return;
      }
      await regloApi.createInstructorBlock({
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        ...(blockReason.trim() ? { reason: blockReason.trim() } : {}),
        ...(blockRecurring ? { recurring: true, recurringWeeks: blockRecurringWeeks } : {}),
      });
      setBlockSheetOpen(false);
      setToast({ text: 'Slot bloccato.', tone: 'success' });
      await loadData();
    } catch (err) {
      setToast({
        text: err instanceof Error ? err.message : 'Errore nel blocco slot',
        tone: 'danger',
      });
    } finally {
      setBlockPending(false);
    }
  }, [blockDate, blockStartTime, blockEndTime, blockReason, loadData]);

  const openSickLeaveDrawer = useCallback(() => {
    setSickStartDate(new Date());
    setSickEndDate(new Date());
    setSickHalfDay(false);
    const defaultTime = new Date();
    defaultTime.setHours(14, 0, 0, 0);
    setSickStartTime(defaultTime);
    setSickSheetOpen(true);
  }, []);

  const handleCreateSickLeave = useCallback(async () => {
    setSickPending(true);
    try {
      const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const startDate = fmt(sickStartDate);
      const endDate = fmt(sickEndDate);
      const startTime = sickHalfDay
        ? `${String(sickStartTime.getHours()).padStart(2, '0')}:${String(sickStartTime.getMinutes()).padStart(2, '0')}`
        : undefined;
      const result = await regloApi.createInstructorSickLeave({ startDate, endDate, startTime });
      setSickSheetOpen(false);
      setToast({
        text: `Malattia registrata. ${result.appointmentsCancelled} guide cancellate.`,
        tone: 'success',
      });
      await loadData();
    } catch (err) {
      setToast({
        text: err instanceof Error ? err.message : 'Errore nella registrazione malattia',
        tone: 'danger',
      });
    } finally {
      setSickPending(false);
    }
  }, [sickStartDate, sickEndDate, sickHalfDay, sickStartTime, loadData]);

  const handleDeleteBlock = useCallback(async (blockId: string) => {
    try {
      await regloApi.deleteInstructorBlock(blockId);
      setToast({ text: 'Blocco rimosso.', tone: 'success' });
      await loadData();
    } catch (err) {
      setToast({
        text: err instanceof Error ? err.message : 'Errore nella rimozione',
        tone: 'danger',
      });
    }
  }, [loadData]);

  // Exam actions
  const handleRemoveExamStudent = useCallback(
    async (appointmentId: string) => {
      setExamActionPending(appointmentId);
      try {
        await regloApi.cancelAppointment(appointmentId);
        setToast({ text: 'Allievo rimosso dall\u2019esame.', tone: 'success' });
        await loadData();
        // Refresh the drawer with updated group
        setExamDrawerGroup((prev) =>
          prev
            ? {
                ...prev,
                appointments: prev.appointments.filter((a) => a.id !== appointmentId),
              }
            : null,
        );
      } catch (err) {
        setToast({ text: err instanceof Error ? err.message : 'Errore', tone: 'danger' });
      } finally {
        setExamActionPending(null);
      }
    },
    [loadData],
  );

  const handleCancelExam = useCallback(async () => {
    if (!examDrawerGroup) return;
    setExamActionPending('all');
    try {
      await Promise.all(
        examDrawerGroup.appointments.map((a) => regloApi.cancelAppointment(a.id)),
      );
      setToast({ text: 'Esame annullato.', tone: 'success' });
      setExamDrawerGroup(null);
      await loadData();
    } catch (err) {
      setToast({ text: err instanceof Error ? err.message : 'Errore', tone: 'danger' });
    } finally {
      setExamActionPending(null);
    }
  }, [examDrawerGroup, loadData]);

  const openBookingDrawer = useCallback(() => {
    if (!canInstructorBook) {
      setToast({
        text: 'La prenotazione da app è abilitata solo per allievi.',
        tone: 'info',
      });
      return;
    }
    const allowedDurations = (clusterDurations ?? settings?.bookingSlotDurations ?? [30, 60])
      .slice()
      .sort((a, b) => a - b);
    const nowDate = new Date();
    const roundedNow = normalizeToQuarter(nowDate);
    setBookingStudentId('');
    setBookingVehicleId((current) => current || vehicles[0]?.id || '');
    setBookingLessonTypes(['guida']);
    setBookingDuration((current) =>
      allowedDurations.includes(current) ? current : allowedDurations[0] ?? 60,
    );
    setBookingDate(selectedDate);
    setBookingStartTime(roundedNow);
    setGuidedSuggestion(null);
    setGuidedPreferredDate(null);
    setMultiBookingMode(false);
    setMultiBookingEntries([]);
    setEditingEntryId(null);
    setEditingEntryField(null);
    setBookingSheetOpen(true);
  }, [canInstructorBook, normalizeToQuarter, settings?.bookingSlotDurations, students, vehicles, selectedDate]);

  const handleSuggestGuidedBooking = useCallback(async () => {
    if (!bookingStudentId) {
      setToast({ text: 'Seleziona un allievo.', tone: 'danger' });
      return;
    }
    setBookingPendingAction('suggest');
    setToast(null);
    try {
      const requestedDate = guidedPreferredDate ? toDateOnlyString(guidedPreferredDate) : undefined;
      const suggestion = await regloApi.suggestInstructorBooking({
        studentId: bookingStudentId,
        preferredDate: requestedDate,
      });
      setGuidedSuggestion(suggestion);
      setBookingVehicleId(suggestion.vehicleId);
      setBookingDuration(suggestion.durationMinutes);
      setBookingLessonTypes([suggestion.suggestedLessonType || 'guida']);
      const suggestedDate = toDateOnlyString(new Date(suggestion.startsAt));
      const usedFallbackDate = Boolean(requestedDate && requestedDate !== suggestedDate);
      setToast({
        text: usedFallbackDate
          ? 'Nessuno slot nella data scelta: proposta sul primo giorno utile.'
          : 'Slot suggerito pronto. Conferma per inviare la proposta.',
        tone: 'success',
      });
    } catch (err) {
      setGuidedSuggestion(null);
      setToast({
        text: err instanceof Error ? err.message : 'Nessuno slot disponibile al momento',
        tone: 'danger',
      });
    } finally {
      setBookingPendingAction(null);
    }
  }, [bookingStudentId, guidedPreferredDate]);

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

    const doBook = async (skipWeeklyLimitCheck = false) => {
      const res = await regloApi.confirmInstructorBooking({
        studentId: bookingStudentId,
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
        instructorId,
        vehicleId: guidedSuggestion?.vehicleId ?? bookingVehicleId,
        ...(bookingLessonTypes.length && !(bookingLessonTypes.length === 1 && bookingLessonTypes[0] === 'guida')
          ? { lessonType: bookingLessonTypes[0], types: bookingLessonTypes }
          : {}),
        ...(skipWeeklyLimitCheck ? { skipWeeklyLimitCheck: true } : {}),
      });
      return res;
    };

    try {
      await doBook();
      setBookingSheetOpen(false);
      setGuidedSuggestion(null);
      setToast({
        text: 'Guida prenotata.',
        tone: 'success',
      });
      await loadData();
    } catch (err: unknown) {
      const payload = (err as { payload?: Record<string, unknown> })?.payload;
      if (payload?.code === 'WEEKLY_LIMIT_CONFIRM') {
        setBookingPendingAction(null);
        const msg = typeof payload.message === 'string'
          ? payload.message
          : "L'allievo ha raggiunto il limite settimanale. Vuoi procedere comunque?";
        Alert.alert('Limite settimanale', msg, [
          { text: 'Annulla', style: 'cancel' },
          {
            text: 'Procedi',
            onPress: async () => {
              setBookingPendingAction(guidedSuggestion ? 'confirm' : 'create');
              try {
                await doBook(true);
                setBookingSheetOpen(false);
                setGuidedSuggestion(null);
                setToast({ text: 'Guida prenotata.', tone: 'success' });
                await loadData();
              } catch (retryErr) {
                setToast({
                  text: retryErr instanceof Error ? retryErr.message : 'Errore nella prenotazione',
                  tone: 'danger',
                });
              } finally {
                setBookingPendingAction(null);
              }
            },
          },
        ]);
        return;
      }
      setToast({
        text: err instanceof Error ? err.message : 'Errore nella prenotazione',
        tone: 'danger',
      });
    } finally {
      setBookingPendingAction(null);
    }
  }, [
    bookingDuration,
    bookingLessonTypes,
    bookingStudentId,
    bookingVehicleId,
    guidedSuggestion,
    instructorId,
    loadData,
    resolveBookingStartDate,
  ]);

  const handleConfirmMultiBooking = useCallback(async () => {
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
    if (!multiBookingEntries.length) {
      setToast({ text: 'Aggiungi almeno una guida.', tone: 'danger' });
      return;
    }

    const entries = multiBookingEntries.map((entry) => {
      const start = new Date(entry.date);
      start.setHours(entry.startTime.getHours(), entry.startTime.getMinutes(), 0, 0);
      const end = new Date(start.getTime() + entry.duration * 60 * 1000);
      return { startsAt: start.toISOString(), endsAt: end.toISOString() };
    });

    setBookingPendingAction('create');
    setToast(null);

    const doBook = async (skipWeeklyLimitCheck = false) => {
      return regloApi.confirmInstructorBookingBatch({
        studentId: bookingStudentId,
        instructorId,
        vehicleId: bookingVehicleId,
        ...(bookingLessonTypes.length && !(bookingLessonTypes.length === 1 && bookingLessonTypes[0] === 'guida')
          ? { lessonType: bookingLessonTypes[0], types: bookingLessonTypes }
          : {}),
        ...(skipWeeklyLimitCheck ? { skipWeeklyLimitCheck: true } : {}),
        entries,
      });
    };

    try {
      const result = await doBook();
      setBookingSheetOpen(false);
      setMultiBookingMode(false);
      setMultiBookingEntries([]);
      setToast({
        text: `${result.created} guide prenotate.`,
        tone: 'success',
      });
      await loadData();
    } catch (err: unknown) {
      const payload = (err as { payload?: Record<string, unknown> })?.payload;
      if (payload?.code === 'WEEKLY_LIMIT_CONFIRM') {
        setBookingPendingAction(null);
        const msg = typeof payload.message === 'string'
          ? payload.message
          : "L'allievo ha raggiunto il limite settimanale. Vuoi procedere comunque?";
        Alert.alert('Limite settimanale', msg, [
          { text: 'Annulla', style: 'cancel' },
          {
            text: 'Procedi',
            onPress: async () => {
              setBookingPendingAction('create');
              try {
                const result = await doBook(true);
                setBookingSheetOpen(false);
                setMultiBookingMode(false);
                setMultiBookingEntries([]);
                setToast({ text: `${result.created} guide prenotate.`, tone: 'success' });
                await loadData();
              } catch (retryErr) {
                setToast({
                  text: retryErr instanceof Error ? retryErr.message : 'Errore nella prenotazione',
                  tone: 'danger',
                });
              } finally {
                setBookingPendingAction(null);
              }
            },
          },
        ]);
        return;
      }
      setToast({
        text: err instanceof Error ? err.message : 'Errore nella prenotazione',
        tone: 'danger',
      });
    } finally {
      setBookingPendingAction(null);
    }
  }, [
    bookingDuration,
    bookingLessonTypes,
    bookingStudentId,
    bookingVehicleId,
    instructorId,
    loadData,
    multiBookingEntries,
  ]);

  const featuredLesson = useMemo(
    () => pickFeaturedLesson(featuredAppointments, now),
    [featuredAppointments, now],
  );
  const HOUR_SLOTS = useMemo(() => {
    const DEFAULT_START = 7;
    const END = 21;
    let earliest = DEFAULT_START;
    // Check availability
    for (const h of availableHours) {
      if (h < earliest) earliest = h;
    }
    // Check appointments
    for (const appt of appointments) {
      const h = new Date(appt.startsAt).getHours();
      if (normalizeStatus(appt.status) !== 'cancelled' && h < earliest) earliest = h;
    }
    return Array.from({ length: END - earliest + 1 }, (_, i) => i + earliest);
  }, [availableHours, appointments]);

  // Raw (non-grouped) list — used for counts, stats, etc.
  const timelineAppointments = useMemo(() => {
    return [...appointments]
      .filter((item) => {
        const status = normalizeStatus(item.status);
        // Hide cancelled appointments that have been replaced by another
        if (status === 'cancelled' && item.replacedByAppointmentId) return false;
        return true;
      })
      .sort((a, b) => getStartsAtTs(a) - getStartsAtTs(b));
  }, [appointments]);

  // Timeline items: exams grouped by time; other appointments as-is
  const timelineItems = useMemo(() => {
    const exams: AutoscuolaAppointmentWithRelations[] = [];
    const others: AutoscuolaAppointmentWithRelations[] = [];
    for (const appt of timelineAppointments) {
      if (appt.type === 'esame') exams.push(appt);
      else others.push(appt);
    }
    const groupMap = new Map<string, AutoscuolaAppointmentWithRelations[]>();
    for (const e of exams) {
      const key = `${e.startsAt}|${e.endsAt ?? ''}|${e.instructorId ?? ''}`;
      const list = groupMap.get(key) ?? [];
      list.push(e);
      groupMap.set(key, list);
    }
    type Item =
      | { kind: 'appointment'; appointment: AutoscuolaAppointmentWithRelations; sortKey: number }
      | { kind: 'examGroup'; id: string; startsAt: string; endsAt: string | null; instructorId: string | null; instructorName: string | null; notes: string | null; appointments: AutoscuolaAppointmentWithRelations[]; sortKey: number };
    const items: Item[] = [];
    for (const appt of others) {
      items.push({ kind: 'appointment', appointment: appt, sortKey: getStartsAtTs(appt) });
    }
    for (const [key, appts] of groupMap) {
      const first = appts[0];
      items.push({
        kind: 'examGroup',
        id: key,
        startsAt: first.startsAt,
        endsAt: first.endsAt,
        instructorId: first.instructorId,
        instructorName: first.instructor?.name ?? null,
        notes: first.notes ?? null,
        appointments: appts,
        sortKey: getStartsAtTs(first),
      });
    }
    return items.sort((a, b) => a.sortKey - b.sortKey);
  }, [timelineAppointments]);

  const appointmentsByHour = useMemo(() => {
    const map = new Map<number, AutoscuolaAppointmentWithRelations[]>();
    for (const appt of timelineAppointments) {
      const hour = new Date(appt.startsAt).getHours();
      const existing = map.get(hour) ?? [];
      existing.push(appt);
      map.set(hour, existing);
    }
    return map;
  }, [timelineAppointments]);

  const blocksByHour = useMemo(() => {
    const map = new Map<number, InstructorBlock[]>();
    if (!calendarRange) return map;
    const rangeFrom = new Date(calendarRange.from).getTime();
    const rangeTo = new Date(calendarRange.to).getTime();
    for (const block of instructorBlocks) {
      const blockStart = new Date(block.startsAt).getTime();
      const blockEnd = new Date(block.endsAt).getTime();
      if (blockEnd <= rangeFrom || blockStart >= rangeTo) continue;
      const hour = new Date(block.startsAt).getHours();
      const existing = map.get(hour) ?? [];
      existing.push(block);
      map.set(hour, existing);
    }
    return map;
  }, [instructorBlocks, calendarRange]);

  // Helper: extract YYYY-MM-DD from ISO string without timezone issues
  const toDateKey = (isoStr: string) => isoStr.slice(0, 10);
  const dateKeyToDate = (key: string) => {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d);
  };
  const addDaysToKey = (key: string, n: number) => {
    const d = dateKeyToDate(key);
    d.setDate(d.getDate() + n);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const dateToKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  // Collect all sick leave dates (using local date, timezone-safe)
  const sickLeaveDateKeys = useMemo(() => {
    const dates = new Set<string>();
    for (const block of instructorBlocks) {
      if (block.reason !== 'sick_leave') continue;
      const d = new Date(block.startsAt);
      dates.add(dateToKey(d));
    }
    return dates;
  }, [instructorBlocks]);

  // Detect if selected day has a sick leave block + find full contiguous range
  const sickLeaveInfo = useMemo(() => {
    const selKey = dateToKey(selectedDate);
    if (!sickLeaveDateKeys.has(selKey)) return null;

    const block = instructorBlocks.find((b) =>
      b.reason === 'sick_leave' && dateToKey(new Date(b.startsAt)) === selKey,
    );
    if (!block) return null;

    // Walk backward/forward to find contiguous range
    let rangeStartKey = selKey;
    let rangeEndKey = selKey;
    for (let k = addDaysToKey(selKey, -1); sickLeaveDateKeys.has(k); k = addDaysToKey(k, -1)) rangeStartKey = k;
    for (let k = addDaysToKey(selKey, 1); sickLeaveDateKeys.has(k); k = addDaysToKey(k, 1)) rangeEndKey = k;

    // Detect half-day: block starts after midnight on this day
    const blockStart = new Date(block.startsAt);
    const isHalfDay = blockStart.getHours() > 0 || blockStart.getMinutes() > 0;
    const sickStartHour = blockStart.getHours() + blockStart.getMinutes() / 60;

    return {
      block,
      rangeStart: dateKeyToDate(rangeStartKey),
      rangeEnd: dateKeyToDate(rangeEndKey),
      isHalfDay,
      sickStartHour,
    };
  }, [instructorBlocks, selectedDate, sickLeaveDateKeys]);

  const hasTimelineAppointments = timelineAppointments.length > 0 || blocksByHour.size > 0;

  const ROW_H = 80;

  // Per-hour availability coverage: { topFraction, bottomFraction } where 0=start of hour, 1=end
  const hourAvailCoverage = useMemo(() => {
    const map = new Map<number, { top: number; bottom: number }>();
    for (const slot of availabilitySlots) {
      const startHour = Math.floor(slot.startMinutes / 60);
      const endHour = Math.floor(slot.endMinutes / 60);
      const endMinute = slot.endMinutes % 60;
      const lastHour = endMinute > 0 ? endHour : endHour - 1;
      for (let h = startHour; h <= lastHour; h++) {
        const hourStart = h * 60;
        const coverStart = Math.max(slot.startMinutes, hourStart);
        const coverEnd = Math.min(slot.endMinutes, hourStart + 60);
        const topFrac = (coverStart - hourStart) / 60;
        const bottomFrac = (coverEnd - hourStart) / 60;
        const existing = map.get(h);
        if (existing) {
          map.set(h, { top: Math.min(existing.top, topFrac), bottom: Math.max(existing.bottom, bottomFrac) });
        } else {
          map.set(h, { top: topFrac, bottom: bottomFrac });
        }
      }
    }
    return map;
  }, [availabilitySlots]);

  // NOW line position — fractional hour offset for today only
  const nowHourFraction = useMemo(() => {
    const todayNorm = new Date();
    todayNorm.setHours(0, 0, 0, 0);
    const selNorm = new Date(selectedDate);
    selNorm.setHours(0, 0, 0, 0);
    if (todayNorm.getTime() !== selNorm.getTime()) return null;
    return now.getHours() + now.getMinutes() / 60;
  }, [now, selectedDate]);

  const MANDATORY_MINUTES_THRESHOLD = 480; // 8 hours

  const timelineStatusConfig = (status: string, type?: string | null, opts?: { durationMin?: number; studentId?: string }) => {
    const s = normalizeStatus(status);
    // Exam: distinctive purple/indigo theme, overrides normal status visuals
    if (type === 'esame' && s !== 'cancelled' && s !== 'no_show') {
      return { border: '#6366F1', badgeBg: '#EEF2FF', badgeText: '#4338CA', label: 'ESAME', isExam: true as const };
    }
    if (s === 'pending_review')
      return { border: '#F97316', badgeBg: '#FFF7ED', badgeText: '#EA580C', label: 'Da confermare', isExam: false as const };
    if (s === 'checked_in')
      return { border: '#EC4899', badgeBg: '#FDF2F8', badgeText: '#EC4899', label: 'In corso', isExam: false as const };
    if (s === 'completed')
      return { border: '#22C55E', badgeBg: '#F0FDF4', badgeText: '#16A34A', label: 'Completata', isExam: false as const };
    if (s === 'no_show' || s === 'cancelled')
      return { border: '#94A3B8', badgeBg: '#F1F5F9', badgeText: '#64748B', label: s === 'no_show' ? 'Assente' : 'Annullata', isExam: false as const };
    if (s === 'proposal')
      return { border: '#A78BFA', badgeBg: '#F5F3FF', badgeText: '#7C3AED', label: 'Proposta', isExam: false as const };
    // Scheduled/confirmed: mandatory if student has < 8h completed AND lesson is ≥ 60 min
    const completedMins = opts?.studentId ? (studentCompletedMinutes[opts.studentId] ?? 0) : 0;
    const isMandatory = completedMins < MANDATORY_MINUTES_THRESHOLD && (opts?.durationMin ?? 0) >= 60;
    if (isMandatory) {
      return { border: '#0EA5E9', badgeBg: '#F0F9FF', badgeText: '#0369A1', label: 'Obbligatoria', isExam: false as const };
    }
    return { border: '#FACC15', badgeBg: '#FEF9C3', badgeText: '#CA8A04', label: 'Programmata', isExam: false as const };
  };
  const isSheetDetailsEditable = sheetLesson ? isDetailsEditable(sheetLesson, now) : false;

  const resolveInitialLessonTypes = (lesson: AutoscuolaAppointmentWithRelations): string[] => {
    if (lesson.types && lesson.types.length > 0) {
      return lesson.types.map((t) => normalizeLessonType(t)).filter(Boolean);
    }
    const single = resolveInitialLessonType(lesson.type);
    return single ? [single] : [];
  };

  const openLessonDrawer = (lesson: AutoscuolaAppointmentWithRelations) => {
    setSheetLesson(lesson);
    setSheetScrollAtBottom(false);
    setSheetScrollAtTop(true);
    setSelectedLessonTypes(resolveInitialLessonTypes(lesson));
    setSelectedRating(lesson.rating ?? null);
    setLessonNotes(lesson.notes ?? '');
  };

  const isPending = pendingAction !== null;
  const sheetActionAvailability = useMemo(() => {
    if (!sheetLesson) return null;
    return getActionAvailability(sheetLesson, now, settings?.autoCheckinEnabled);
  }, [sheetLesson, now, settings?.autoCheckinEnabled]);
  const featuredActionAvailability = useMemo(() => {
    if (!featuredLesson) return null;
    return getActionAvailability(featuredLesson, now, settings?.autoCheckinEnabled);
  }, [featuredLesson, now, settings?.autoCheckinEnabled]);

  useEffect(() => {
    let active = true;
    if (!featuredLesson) {
      setLatestStudentLessonNote(null);
      return () => {
        active = false;
      };
    }

    const loadLatestNote = async () => {
      try {
        const latestNote = await regloApi.getLatestStudentAppointmentNote(
          featuredLesson.studentId,
          featuredLesson.startsAt,
        );
        if (!active) return;
        setLatestStudentLessonNote(
          latestNote
            ? {
                startsAt: latestNote.startsAt,
                note: latestNote.note,
              }
            : null,
        );
      } catch {
        if (!active) return;
        setLatestStudentLessonNote(null);
      }
    };

    loadLatestNote();
    return () => {
      active = false;
    };
  }, [featuredLesson?.id, featuredLesson?.studentId, featuredLesson?.startsAt]);

  // Load latest notes for all students visible in the timeline
  useEffect(() => {
    let active = true;
    const uniqueStudents = new Map<string, string>(); // studentId → earliest startsAt
    for (const appt of timelineAppointments) {
      if (appt.studentId && !uniqueStudents.has(appt.studentId)) {
        uniqueStudents.set(appt.studentId, appt.startsAt);
      }
    }
    if (!uniqueStudents.size) {
      setStudentNotesMap({});
      return;
    }
    const loadAll = async () => {
      const entries = Array.from(uniqueStudents.entries());
      const results = await Promise.all(
        entries.map(async ([studentId, before]) => {
          try {
            const note = await regloApi.getLatestStudentAppointmentNote(studentId, before);
            return [studentId, note?.note ?? null] as const;
          } catch {
            return [studentId, null] as const;
          }
        }),
      );
      if (!active) return;
      const map: Record<string, string | null> = {};
      for (const [id, note] of results) map[id] = note;
      setStudentNotesMap(map);
    };
    loadAll();
    return () => { active = false; };
  }, [timelineAppointments]);

  const canRunStatusAction = Boolean(sheetActionAvailability?.enabled);
  const canRepositionSheetLesson = sheetLesson
    ? canOperationalReposition(sheetLesson, now)
    : false;
  const canRescheduleSheetLesson = useMemo(() => {
    if (!sheetLesson) return false;
    const status = normalizeStatus(sheetLesson.status);
    if (!['scheduled', 'confirmed', 'proposal'].includes(status)) return false;
    return new Date(sheetLesson.startsAt).getTime() > Date.now();
  }, [sheetLesson]);

  const swapCandidates = useMemo(() => {
    if (!swapSourceLesson || !swapModalOpen) return [];
    const now = new Date();
    return featuredAppointments
      .filter((a) => {
        if (a.id === swapSourceLesson.id) return false;
        if (a.studentId === swapSourceLesson.studentId) return false;
        if (a.instructorId !== swapSourceLesson.instructorId) return false;
        if (a.status !== 'scheduled' && a.status !== 'confirmed') return false;
        if (new Date(a.startsAt) <= now) return false;
        if (a.type === 'esame') return false;
        return true;
      })
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  }, [featuredAppointments, swapSourceLesson, swapModalOpen]);

  const filteredSwapCandidates = useMemo(() => {
    if (!swapSearch.trim()) return swapCandidates;
    const q = swapSearch.toLowerCase().trim();
    return swapCandidates.filter((a) =>
      (a.student?.name ?? '').toLowerCase().includes(q),
    );
  }, [swapCandidates, swapSearch]);

  // Group by day for section headers
  const swapCandidatesByDay = useMemo(() => {
    const groups: Array<{ title: string; data: typeof filteredSwapCandidates }> = [];
    let currentKey = '';
    let currentGroup: typeof filteredSwapCandidates = [];
    for (const appt of filteredSwapCandidates) {
      const d = new Date(appt.startsAt);
      const key = d.toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: 'short' });
      if (key !== currentKey) {
        if (currentGroup.length) groups.push({ title: currentKey, data: currentGroup });
        currentKey = key;
        currentGroup = [appt];
      } else {
        currentGroup.push(appt);
      }
    }
    if (currentGroup.length) groups.push({ title: currentKey, data: currentGroup });
    return groups;
  }, [filteredSwapCandidates]);

  const lessonSheetMaxHeight = useMemo(() => {
    const base = Math.max(300, Math.min(windowHeight * 0.52, windowHeight - 350));
    if (!keyboardHeight) return base;
    return Math.max(base, Math.min(windowHeight * 0.72, windowHeight - 160));
  }, [windowHeight, keyboardHeight]);
  const lessonSheetMinHeight = useMemo(
    () =>
      Math.max(360, Math.min(windowHeight * 0.62, windowHeight - 180)) +
      Math.min(220, Math.round(keyboardHeight * 0.6)),
    [windowHeight, keyboardHeight],
  );
  const bookingSheetMaxHeight = useMemo(() => {
    const base = Math.max(340, Math.min(windowHeight * 0.64, windowHeight - 260));
    if (!keyboardHeight) return base;
    return Math.max(base, Math.min(windowHeight * 0.78, windowHeight - 120));
  }, [windowHeight, keyboardHeight]);
  const bookingSheetMinHeight = useMemo(
    () =>
      Math.max(420, Math.min(windowHeight * 0.72, windowHeight - 120)) +
      Math.min(180, Math.round(keyboardHeight * 0.45)),
    [windowHeight, keyboardHeight],
  );
  const featuredCheckinHint = featuredLesson ? getCheckinStateText(featuredLesson, now) : null;
  const sheetStateMeta = useMemo(
    () => (sheetLesson ? getLessonStateMeta(sheetLesson, now) : null),
    [sheetLesson, now],
  );

  // ── Calendar day-pills logic (mirroring AllievoHomeScreen) ──
  const ITALIAN_WEEKDAYS = ['DOM', 'LUN', 'MAR', 'MER', 'GIO', 'VEN', 'SAB'] as const;
  const ITALIAN_MONTHS = [
    'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
    'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
  ] as const;
  const bookedDatesSet = useMemo(() => {
    const set = new Set<string>();
    for (const appt of featuredAppointments) {
      const status = (appt.status ?? '').trim().toLowerCase();
      if (status === 'cancelled') continue;
      const d = new Date(appt.startsAt);
      set.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
    }
    return set;
  }, [featuredAppointments]);

  const examDatesSet = useMemo(() => {
    const set = new Set<string>();
    for (const appt of featuredAppointments) {
      if (appt.type !== 'esame') continue;
      const status = (appt.status ?? '').trim().toLowerCase();
      if (status === 'cancelled') continue;
      const d = new Date(appt.startsAt);
      set.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
    }
    return set;
  }, [featuredAppointments]);

  const NAV_WEEKS = 52; // navigation: 1 year ahead
  const calendarDays = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = addDays(today, -7);
    const totalDays = 7 + NAV_WEEKS * 7;
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
  }, []);
  const calendarMonthLabel = `${ITALIAN_MONTHS[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`;

  const isSelectedDateHoliday = useMemo(
    () => holidays.has(toDateOnlyString(selectedDate)),
    [holidays, selectedDate],
  );

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

  useEffect(() => {
    if (dayScrollMountedRef.current) {
      scrollToDay(true);
    }
  }, [scrollToDay]);

  const loadAvailability = useCallback(() => {
    if (!instructorId) return;
    regloApi.getAvailabilitySlots({
      ownerType: 'instructor',
      ownerId: instructorId,
      date: toDateOnlyString(selectedDate),
    }).then((slots) => {
      const hours = new Set<number>();
      const precise: Array<{ startMinutes: number; endMinutes: number }> = [];
      if (slots) {
        for (const slot of slots) {
          const s = new Date(slot.startsAt);
          const e = new Date(slot.endsAt);
          const startMin = s.getHours() * 60 + s.getMinutes();
          const endMin = e.getHours() * 60 + e.getMinutes();
          precise.push({ startMinutes: startMin, endMinutes: endMin });
          const startHour = s.getHours();
          const endHour = e.getHours();
          const endMinute = e.getMinutes();
          for (let h = startHour; h < endHour; h++) {
            hours.add(h);
          }
          if (endMinute > 0) hours.add(endHour);
        }
      }
      setAvailableHours(hours);
      setAvailabilitySlots(precise);
    }).catch(() => { setAvailableHours(new Set()); setAvailabilitySlots([]); });
  }, [selectedDate, instructorId]);

  useEffect(() => {
    if (agendaViewMode === 'week') {
      // Fetch full week (Mon–Sat) for weekly view
      const day = selectedDate.getDay();
      const mondayOffset = day === 0 ? -6 : 1 - day;
      const from = new Date(selectedDate);
      from.setDate(from.getDate() + mondayOffset);
      from.setHours(0, 0, 0, 0);
      const to = new Date(from);
      to.setDate(to.getDate() + 5); // Saturday
      to.setHours(23, 59, 59, 999);
      setCalendarRange({ mode: 'week', from, to, label: '', anchor: selectedDate });
    } else {
      const from = new Date(selectedDate);
      from.setHours(0, 0, 0, 0);
      const to = new Date(selectedDate);
      to.setHours(23, 59, 59, 999);
      setCalendarRange({ mode: 'day', from, to, label: '', anchor: selectedDate });
    }
    loadAvailability();

    // Load availability for all 6 days when in weekly mode
    if (agendaViewMode === 'week' && instructorId) {
      const day = selectedDate.getDay();
      const mondayOffset = day === 0 ? -6 : 1 - day;
      const monday = new Date(selectedDate);
      monday.setDate(monday.getDate() + mondayOffset);
      monday.setHours(0, 0, 0, 0);

      Promise.all(
        Array.from({ length: 6 }, (_, i) => {
          const d = new Date(monday);
          d.setDate(d.getDate() + i);
          return regloApi.getAvailabilitySlots({
            ownerType: 'instructor',
            ownerId: instructorId,
            date: toDateOnlyString(d),
          }).then((slots) => {
            const precise: Array<{ startMinutes: number; endMinutes: number }> = [];
            if (slots) {
              for (const slot of slots) {
                const s = new Date(slot.startsAt);
                const e = new Date(slot.endsAt);
                precise.push({ startMinutes: s.getHours() * 60 + s.getMinutes(), endMinutes: e.getHours() * 60 + e.getMinutes() });
              }
            }
            return { colIdx: i, slots: precise };
          });
        }),
      ).then((results) => {
        const map: Record<number, Array<{ startMinutes: number; endMinutes: number }>> = {};
        for (const r of results) map[r.colIdx] = r.slots;
        setWeekAvailability(map);
      }).catch(() => setWeekAvailability({}));
    }
  }, [selectedDate, instructorId, loadAvailability, agendaViewMode]);

  // Re-fetch data when screen regains focus (e.g. after changing availability)
  const navigation = useNavigation();
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadData();
      loadAvailability();
      loadOutOfAvailability();
      loadHolidays();
      sessionStorage.getAgendaViewMode().then(setAgendaViewMode);
    });
    return unsubscribe;
  }, [navigation, loadData, loadAvailability, loadOutOfAvailability]);

  const refreshAndSyncDrawer = useCallback(
    async (lessonId: string) => {
      const refreshed = await loadData();
      const refreshedLesson = refreshed.find((item) => item.id === lessonId) ?? null;
      if (!refreshedLesson) {
        setSheetLesson(null);
        return;
      }
      setSheetLesson(refreshedLesson);
      setSelectedLessonTypes(resolveInitialLessonTypes(refreshedLesson));
      setSelectedRating(refreshedLesson.rating ?? null);
      setLessonNotes(refreshedLesson.notes ?? '');
    },
    [loadData],
  );

  const executeStatusAction = useCallback(
    async (
      lesson: AutoscuolaAppointmentWithRelations,
      action: InstructorActionStatus,
      options?: { lessonTypes?: string[]; closeDrawerOnSuccess?: boolean },
    ) => {
      setToast(null);
      const availability = getActionAvailability(lesson, new Date(), settings?.autoCheckinEnabled);
      if (!availability.enabled) {
        if (availability.reason) {
          setToast({ text: availability.reason, tone: 'info' });
        }
        return;
      }

      const types = (options?.lessonTypes ?? []).map(normalizeLessonType).filter(Boolean);
      if (action === 'checked_in' && !types.length && !normalizeLessonType(lesson.type)) {
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
          lessonType: types[0] || undefined,
          lessonTypes: types.length ? types : undefined,
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

    const payload: { lessonType?: string; lessonTypes?: string[]; rating?: number | null; notes?: string | null } = {};
    const initialTypes = resolveInitialLessonTypes(sheetLesson);
    const typesChanged = JSON.stringify(selectedLessonTypes.sort()) !== JSON.stringify([...initialTypes].sort());
    if (selectedLessonTypes.length && typesChanged) {
      payload.lessonTypes = selectedLessonTypes;
      payload.lessonType = selectedLessonTypes[0];
    }

    const initialRating = sheetLesson.rating ?? null;
    if (selectedRating !== initialRating) {
      payload.rating = selectedRating;
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
      lessonTypes: selectedLessonTypes,
      closeDrawerOnSuccess: true,
    });
  };

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    loadAvailability();
    loadOutOfAvailability();
    setRefreshing(false);
  }, [loadData, loadAvailability, loadOutOfAvailability]);

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

  const handleInstructorSwap = useCallback(async (targetAppt: AutoscuolaAppointmentWithRelations) => {
    if (!swapSourceLesson || swapPending) return;
    const studentA = `${swapSourceLesson.student?.firstName ?? ''} ${swapSourceLesson.student?.lastName ?? ''}`.trim() || 'Allievo';
    const studentB = `${targetAppt.student?.firstName ?? ''} ${targetAppt.student?.lastName ?? ''}`.trim() || 'Allievo';
    Alert.alert(
      'Conferma scambio',
      `Scambiare ${studentA} con ${studentB}?`,
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Scambia',
          onPress: async () => {
            setSwapPending(true);
            try {
              await regloApi.instructorSwapAppointments({
                appointmentIdA: swapSourceLesson.id,
                appointmentIdB: targetAppt.id,
              });
              setSwapModalOpen(false);
              setSwapSourceLesson(null);
              setSheetLesson(null);
              setToast({ text: 'Guide scambiate.', tone: 'success' });
              await loadData();
            } catch (err) {
              setToast({
                text: err instanceof Error ? err.message : 'Errore nello scambio',
                tone: 'danger',
              });
            } finally {
              setSwapPending(false);
            }
          },
        },
      ],
    );
  }, [swapSourceLesson, swapPending, loadData]);

  const resetGuidedSuggestionForStudent = useCallback((nextStudentId: string) => {
    if (nextStudentId === '__separator__') return;
    setBookingStudentId(nextStudentId);
    setGuidedSuggestion(null);
  }, []);

  const bookingSheetFooter = useMemo(() => {
    if (!canInstructorBook) return null;

    if (multiBookingMode) {
      const n = multiBookingEntries.length;
      return (
        <Button
          label={bookingPendingAction ? 'Prenotazione...' : `Prenota ${n} guid${n === 1 ? 'a' : 'e'}`}
          tone="primary"
          onPress={!bookingPendingAction ? handleConfirmMultiBooking : undefined}
          disabled={Boolean(bookingPendingAction) || !bookingStudentId || !bookingVehicleId || n === 0}
          fullWidth
        />
      );
    }

    return (
      <Button
        label={bookingPendingAction ? 'Prenotazione...' : 'Prenota guida'}
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
    handleConfirmMultiBooking,
    handleSuggestGuidedBooking,
    instructorBookingMode,
    multiBookingMode,
    multiBookingEntries.length,
  ]);

  const userName = user?.name?.split(' ')[0] ?? 'Istruttore';

  if (!instructorId) {
    return (
      <Screen>
        <StatusBar style="dark" />
        <View style={styles.emptyState}>
          <Card title="Profilo istruttore mancante">
            <Text style={styles.emptyText}>
              Il tuo account non e ancora collegato a un profilo istruttore.
            </Text>
          </Card>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <StatusBar style="dark" />
      <ToastNotice message={toast?.text ?? null} tone={toast?.tone} onHide={() => setToast(null)} />
      {agendaViewMode === 'week' ? (
        <>
          {/* ── Fixed header for weekly mode ── */}
          <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm, gap: spacing.md }}>
            <View style={styles.header}>
              <View>
                <Text style={styles.title}>
                  Ciao, {userName} {'\uD83D\uDC4B'}
                </Text>
                <Text style={styles.subtitle}>Gestisci le tue guide</Text>
              </View>
            </View>
            {!initialLoading && error ? <Text style={styles.error}>{error}</Text> : null}
            {featuredLesson ? (() => {
              const isLive = isLessonInProgressWindow(featuredLesson, now);
              return (
                <View style={[styles.nextBanner, isLive && styles.nextBannerLive]}>
                  <View style={styles.nextBannerLeft}>
                    {isLive ? (
                      <View style={styles.nextBannerDot} />
                    ) : (
                      <Ionicons name="time-outline" size={14} color="#CA8A04" />
                    )}
                    <Text style={styles.nextBannerLabel}>
                      {isLive ? 'In corso' : 'Prossima'}
                    </Text>
                  </View>
                  <Text style={styles.nextBannerInfo} numberOfLines={1}>
                    {smartDayLabel(featuredLesson.startsAt, now)} {formatTime(featuredLesson.startsAt)} {'\u00B7'} {featuredLesson.student?.firstName} {featuredLesson.student?.lastName}
                  </Text>
                </View>
              );
            })() : null}
          </View>
        </>
      ) : null}

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        style={agendaViewMode === 'week' ? { display: 'none' } : undefined}
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
          <View>
            <Text style={styles.title}>
              Ciao, {userName} {'\uD83D\uDC4B'}
            </Text>
            <Text style={styles.subtitle}>Gestisci le tue guide</Text>
          </View>
        </View>

        {!initialLoading && error ? <Text style={styles.error}>{error}</Text> : null}

        {outOfAvailAppointments.length > 0 && (
          <Pressable
            onPress={() => setOutOfAvailSheetOpen(true)}
            style={oobStyles.banner}
          >
            <Ionicons name="alert-circle" size={18} color="#92400E" />
            <Text style={oobStyles.bannerText}>
              <Text style={oobStyles.bannerCount}>{outOfAvailAppointments.length}</Text>
              {' '}guid{outOfAvailAppointments.length === 1 ? 'a' : 'e'} fuori disponibilità
            </Text>
            <Text style={oobStyles.bannerAction}>Gestisci</Text>
          </Pressable>
        )}

        {/* ── Next Lesson Compact Banner ── */}
        {featuredLesson ? (() => {
          const isLive = isLessonInProgressWindow(featuredLesson, now);
          return (
            <View style={[styles.nextBanner, isLive && styles.nextBannerLive]}>
              <View style={styles.nextBannerLeft}>
                {isLive ? (
                  <View style={styles.nextBannerDot} />
                ) : (
                  <Ionicons name="time-outline" size={14} color="#CA8A04" />
                )}
                <Text style={styles.nextBannerLabel}>
                  {isLive ? 'In corso' : 'Prossima'}
                </Text>
              </View>
              <Text style={styles.nextBannerInfo} numberOfLines={1}>
                {smartDayLabel(featuredLesson.startsAt, now)} {formatTime(featuredLesson.startsAt)} {'\u00B7'} {featuredLesson.student?.firstName} {featuredLesson.student?.lastName}
              </Text>
            </View>
          );
        })() : null}

        {/* ── Day Pill Calendar ── */}
        <View style={styles.calendarSection}>
          <View style={styles.calendarMonthRow}>
            <Text style={styles.calendarMonthTitle}>{calendarMonthLabel}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Pressable
                onPress={() => setSelectedDate(new Date())}
                style={styles.calendarIconBtn}
              >
                <Ionicons name="return-down-back-outline" size={20} color="#94A3B8" />
              </Pressable>
              <Pressable
                onPress={() => setCalendarDrawerOpen(true)}
                style={styles.calendarIconBtn}
              >
                <Ionicons name="calendar-outline" size={22} color="#94A3B8" />
              </Pressable>
            </View>
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
              const isDayToday = dayNorm.getTime() === todayNorm.getTime();
              const isDaySelected = dayNorm.getTime() === selNorm.getTime() && !isDayToday;
              const dayKey = `${dayNorm.getFullYear()}-${dayNorm.getMonth()}-${dayNorm.getDate()}`;
              const hasBooking = bookedDatesSet.has(dayKey);
              const hasExam = examDatesSet.has(dayKey);
              const isDayHoliday = holidays.has(toDateOnlyString(dayNorm));
              const isDaySick = sickLeaveDateKeys.has(dateToKey(dayNorm));
              return (
                <Pressable
                  key={`day-${index}`}
                  style={[
                    styles.dayPill,
                    isDaySick && !isDaySelected
                      ? { backgroundColor: '#FFF7ED', borderColor: '#FED7AA', borderWidth: 1.5 }
                      : hasExam && !isDaySelected
                        ? { backgroundColor: '#EEF2FF', borderColor: '#C7D2FE', borderWidth: 1.5 }
                        : isDayHoliday && !isDaySelected && !isDayToday
                          ? styles.dayPillHoliday
                          : isDaySelected
                            ? styles.dayPillSelected
                            : isDayToday
                              ? styles.dayPillToday
                              : styles.dayPillUnselected,
                  ]}
                  onPress={() => setSelectedDate(day.date)}
                >
                  <Text
                    style={[
                      styles.dayPillWeekday,
                      isDayHoliday && !isDaySelected && !isDayToday
                        ? styles.dayPillWeekdayHoliday
                        : isDaySelected
                          ? styles.dayPillWeekdaySelected
                          : isDayToday
                            ? styles.dayPillWeekdayToday
                            : styles.dayPillWeekdayUnselected,
                    ]}
                  >
                    {day.weekday}
                  </Text>
                  <Text
                    style={[
                      styles.dayPillNumber,
                      isDayHoliday && !isDaySelected && !isDayToday
                        ? styles.dayPillNumberHoliday
                        : isDaySelected
                          ? styles.dayPillNumberSelected
                          : isDayToday
                            ? styles.dayPillNumberToday
                            : styles.dayPillNumberUnselected,
                    ]}
                  >
                    {day.dayNum}
                  </Text>
                  {isDaySick ? (
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#EA580C' }} />
                  ) : hasExam ? (
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#6366F1' }} />
                  ) : isDayHoliday ? (
                    <View style={styles.dayPillHolidayDot} />
                  ) : hasBooking ? (
                    <View
                      style={[
                        styles.dayPillDot,
                        (isDaySelected || isDayToday) && styles.dayPillDotHighlight,
                      ]}
                    />
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>


        {/* ── Timeline ── */}
        {appointmentsLoading ? (
          <View style={styles.timelineSection}>
            {Array.from({ length: 6 }).map((_, i) => (
              <View key={`skel-hour-${i}`} style={styles.timelineRow}>
                <SkeletonBlock width={42} height={14} radius={6} />
                <View style={styles.timelineSlotArea}>
                  <SkeletonCard style={styles.timelineSkeletonCard}>
                    <SkeletonBlock width="60%" height={14} radius={6} />
                    <SkeletonBlock width="80%" height={12} radius={6} />
                    <SkeletonBlock width="40%" height={10} radius={6} />
                  </SkeletonCard>
                </View>
              </View>
            ))}
          </View>
        ) : sickLeaveInfo && !sickLeaveInfo.isHalfDay ? (
          /* ── Full-Day Sick Leave Overlay ── */
          <View style={{
            backgroundColor: '#FFF7ED',
            borderRadius: 35,
            borderWidth: 1,
            borderColor: '#FED7AA',
            padding: 24,
            alignItems: 'center',
            gap: 16,
          }}>
            <View style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: '#FFEDD5',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Ionicons name="medkit" size={32} color="#EA580C" />
            </View>
            <View style={{ alignItems: 'center', gap: 4 }}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: '#9A3412' }}>
                In malattia
              </Text>
              <Text style={{ fontSize: 14, color: '#C2410C', textAlign: 'center', lineHeight: 20 }}>
                Le guide di oggi sono state cancellate{'\n'}e gli allievi sono stati avvisati.
              </Text>
            </View>
            <View style={{
              backgroundColor: '#FFEDD5',
              borderRadius: 12,
              paddingHorizontal: 16,
              paddingVertical: 10,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
            }}>
              <Ionicons name="calendar-outline" size={16} color="#EA580C" />
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#C2410C' }}>
                {sickLeaveInfo.rangeStart.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}
                {' \u2013 '}
                {sickLeaveInfo.rangeEnd.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}
              </Text>
            </View>
            <Pressable
              onPress={() => {
                Alert.alert(
                  'Rimuovi malattia',
                  'Vuoi rimuovere la segnalazione di malattia per questo giorno? Le guide già cancellate non verranno ripristinate.',
                  [
                    { text: 'Annulla', style: 'cancel' },
                    {
                      text: 'Rimuovi',
                      style: 'destructive',
                      onPress: () => handleDeleteBlock(sickLeaveInfo.block.id),
                    },
                  ],
                );
              }}
              style={({ pressed }) => [
                {
                  paddingHorizontal: 20,
                  paddingVertical: 10,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: '#FED7AA',
                  backgroundColor: pressed ? '#FFF7ED' : '#FFFFFF',
                },
              ]}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#EA580C' }}>
                Rimuovi malattia
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.timelineGridWrapper}>
            {/* ── Half-day sick leave banner ── */}
            {sickLeaveInfo?.isHalfDay && (
              <Pressable
                onPress={() => {
                  Alert.alert(
                    'Rimuovi malattia',
                    'Vuoi rimuovere la segnalazione di malattia per questo giorno? Le guide già cancellate non verranno ripristinate.',
                    [
                      { text: 'Annulla', style: 'cancel' },
                      {
                        text: 'Rimuovi',
                        style: 'destructive',
                        onPress: () => handleDeleteBlock(sickLeaveInfo.block.id),
                      },
                    ],
                  );
                }}
                style={({ pressed }) => [{
                  backgroundColor: pressed ? '#FFEDD5' : '#FFF7ED',
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: '#FED7AA',
                  padding: 14,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  marginBottom: 12,
                }]}
              >
                <View style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: '#FFEDD5',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Ionicons name="medkit" size={18} color="#EA580C" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#9A3412' }}>
                    In malattia dalle {String(Math.floor(sickLeaveInfo.sickStartHour)).padStart(2, '0')}:{String(Math.round((sickLeaveInfo.sickStartHour % 1) * 60)).padStart(2, '0')}
                  </Text>
                  <Text style={{ fontSize: 12, color: '#C2410C', marginTop: 2 }}>
                    {sickLeaveInfo.rangeStart.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}
                    {' \u2013 '}
                    {sickLeaveInfo.rangeEnd.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}
                    {'  \u00B7  Tocca per rimuovere'}
                  </Text>
                </View>
                <Ionicons name="close-circle-outline" size={20} color="#EA580C" />
              </Pressable>
            )}
            {/* Empty day hint — inline above the grid */}
            {!hasTimelineAppointments && (
              isSelectedDateHoliday ? (
                <View style={styles.holidayBanner}>
                  <Ionicons name="ban-outline" size={28} color="#DC2626" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.holidayBannerTitle}>Giorno festivo</Text>
                    <Text style={styles.holidayBannerSubtitle}>L'autoscuola è chiusa</Text>
                  </View>
                </View>
              ) : (
                <View style={styles.emptyDayBanner}>
                  <View style={styles.emptyDayDuckClip}>
                    <Image
                      source={require('../../assets/duck-zen.png')}
                      style={styles.emptyDayDuck}
                      resizeMode="contain"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.emptyDayTitle}>Nessuna guida oggi</Text>
                    <Text style={styles.emptyDaySubtitle}>Giornata libera — goditi la pausa!</Text>
                  </View>
                </View>
              )
            )}
            <View style={[styles.timelineSection, { position: 'relative', height: HOUR_SLOTS.length * ROW_H }]}>
              {/* ── Grid layer: hour labels + lines + availability ── */}
              {HOUR_SLOTS.map((hour, idx) => {
                const coverage = hourAvailCoverage.get(hour);
                return (
                  <View key={`grid-${hour}`} style={{ position: 'absolute', top: idx * ROW_H, left: 0, right: 0, height: ROW_H, flexDirection: 'row' }} pointerEvents="none">
                    <Text style={styles.hourLabel}>{String(hour).padStart(2, '0')}:00</Text>
                    <View style={{ flex: 1, borderTopWidth: 1, borderTopColor: '#F1F5F9', position: 'relative' }}>
                      {coverage ? (
                        <View style={{ position: 'absolute', left: 0, width: 3, top: coverage.top * ROW_H, height: (coverage.bottom - coverage.top) * ROW_H, backgroundColor: '#EC4899', borderRadius: 1.5 }} />
                      ) : (
                        <View style={{ position: 'absolute', left: 0, width: 1, top: 0, bottom: 0, borderLeftWidth: 1, borderLeftColor: '#E5E7EB', borderStyle: 'dashed' }} />
                      )}
                    </View>
                  </View>
                );
              })}
              {/* ── Unavailable labels ── */}
              {HOUR_SLOTS.map((hour, idx) => {
                const coverage = hourAvailCoverage.get(hour);
                if (coverage) return null;
                const prevHasCoverage = idx > 0 && hourAvailCoverage.has(HOUR_SLOTS[idx - 1]);
                const isFirst = idx === 0 || prevHasCoverage;
                if (!isFirst) return null;
                let blockSize = 0;
                for (let i = idx; i < HOUR_SLOTS.length; i++) {
                  if (!hourAvailCoverage.has(HOUR_SLOTS[i])) blockSize++;
                  else break;
                }
                const hasContent = Array.from({ length: blockSize }, (_, i) => HOUR_SLOTS[idx + i]).some(
                  (h) => (appointmentsByHour.get(h)?.length ?? 0) > 0 || (blocksByHour.get(h)?.length ?? 0) > 0
                );
                if (hasContent) return null;
                return (
                  <View key={`unavail-${hour}`} style={{ position: 'absolute', top: idx * ROW_H, left: 46 + 14, right: 0, height: blockSize * ROW_H, justifyContent: 'center', alignItems: 'center' }} pointerEvents="none">
                    <Text style={styles.unavailableLabel}>Non disponibile</Text>
                  </View>
                );
              })}
              {/* ── Blocks layer: appointments + exam groups + instructor blocks ── */}
              {timelineItems.map((item) => {
                if (item.kind === 'examGroup') {
                  const startDate = new Date(item.startsAt);
                  const startMin = startDate.getHours() * 60 + startDate.getMinutes();
                  const endTs = item.endsAt ? new Date(item.endsAt).getTime() : startDate.getTime() + 60 * 60 * 1000;
                  const durationMin = (endTs - startDate.getTime()) / (60 * 1000);
                  const firstHourMin = HOUR_SLOTS[0] * 60;
                  const topPx = ((startMin - firstHourMin) / 60) * ROW_H;
                  const blockH = Math.max(36, (durationMin / 60) * ROW_H);
                  const isCompact = blockH < 55;
                  const studentsCount = item.appointments.length;
                  const studentsPreview = item.appointments
                    .slice(0, 2)
                    .map((a) => a.student?.name ?? '')
                    .filter(Boolean)
                    .join(', ');
                  const moreCount = studentsCount - 2;
                  return (
                    <Pressable
                      key={`exam-${item.id}`}
                      onPress={() =>
                        setExamDrawerGroup({
                          id: item.id,
                          startsAt: item.startsAt,
                          endsAt: item.endsAt,
                          instructorId: item.instructorId,
                          instructorName: item.instructorName,
                          notes: item.notes,
                          appointments: item.appointments,
                        })
                      }
                      style={[
                        styles.timelineBlock,
                        {
                          borderLeftColor: '#6366F1',
                          borderLeftWidth: 4,
                          backgroundColor: '#EEF2FF',
                          position: 'absolute',
                          top: topPx,
                          left: 46 + 14,
                          right: 0,
                          height: blockH,
                          zIndex: 6,
                          padding: isCompact ? 6 : 14,
                        },
                      ]}
                    >
                      {isCompact ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                          <Ionicons name="school" size={14} color="#4338CA" />
                          <Text style={{ fontSize: 13, fontWeight: '700', color: '#4338CA' }} numberOfLines={1}>
                            {formatTime(item.startsAt)} {'\u2013'} {formatTime(item.endsAt ?? new Date(endTs).toISOString())}
                          </Text>
                          <Text style={{ fontSize: 13, color: '#4338CA', flex: 1 }} numberOfLines={1}>
                            Esame · {studentsCount} {studentsCount === 1 ? 'allievo' : 'allievi'}
                          </Text>
                        </View>
                      ) : (
                        <>
                          <View style={styles.timelineBlockHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <Ionicons name="school" size={16} color="#4338CA" />
                              <Text style={[styles.timelineBlockTime, { color: '#4338CA' }]}>
                                {formatTime(item.startsAt)} {'\u2013'} {formatTime(item.endsAt ?? new Date(endTs).toISOString())}
                              </Text>
                            </View>
                            <View style={[styles.timelineStatusBadge, { backgroundColor: '#E0E7FF' }]}>
                              <Text style={[styles.timelineStatusText, { color: '#4338CA' }]}>
                                ESAME
                              </Text>
                            </View>
                          </View>
                          <Text style={[styles.timelineBlockStudent, { color: '#1E293B' }]} numberOfLines={1}>
                            {studentsCount} {studentsCount === 1 ? 'allievo all\u2019esame' : 'allievi all\u2019esame'}
                          </Text>
                          <Text style={[styles.timelineBlockMeta, { color: '#4C1D95' }]} numberOfLines={1}>
                            {studentsPreview}
                            {moreCount > 0 ? ` +${moreCount}` : ''}
                          </Text>
                        </>
                      )}
                    </Pressable>
                  );
                }
                const appt = item.appointment;
                const startDate = new Date(appt.startsAt);
                const startMin = startDate.getHours() * 60 + startDate.getMinutes();
                const endTs = appt.endsAt ? new Date(appt.endsAt).getTime() : startDate.getTime() + 60 * 60 * 1000;
                const durationMin = (endTs - startDate.getTime()) / (60 * 1000);
                const firstHourMin = HOUR_SLOTS[0] * 60;
                const topPx = ((startMin - firstHourMin) / 60) * ROW_H;
                const blockH = Math.max(36, (durationMin / 60) * ROW_H);
                const config = timelineStatusConfig(appt.status, appt.type, { durationMin, studentId: appt.studentId });
                const isActive = isLessonInProgressWindow(appt, now);
                const actionAvail = getActionAvailability(appt, now, settings?.autoCheckinEnabled);
                const isCheckedIn = normalizeStatus(appt.status) === 'checked_in';
                const isCompact = blockH < 55;
                const isFull = blockH >= 110;

                return (
                  <Pressable
                    key={appt.id}
                    onPress={() => openLessonDrawer(appt)}
                    style={[
                      styles.timelineBlock,
                      {
                        borderLeftColor: config.border,
                        position: 'absolute',
                        top: topPx,
                        left: 46 + 14,
                        right: 0,
                        height: blockH,
                        zIndex: 5,
                        padding: isCompact ? 6 : 14,
                      },
                      isActive && styles.timelineBlockActive,
                      config.isExam && { backgroundColor: '#F5F3FF', borderLeftWidth: 4 },
                    ]}
                  >
                    {isCompact ? (
                      /* ── Compact: single row ── */
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                        {config.isExam ? (
                          <Ionicons name="school" size={14} color="#4338CA" />
                        ) : null}
                        <Text style={{ fontSize: 13, fontWeight: '700', color: '#1E293B' }} numberOfLines={1}>
                          {formatTime(appt.startsAt)} {'\u2013'} {formatTime(appt.endsAt ?? new Date(endTs).toISOString())}
                        </Text>
                        <Text style={{ fontSize: 13, color: '#475569', flex: 1 }} numberOfLines={1}>
                          {appt.student?.firstName} {appt.student?.lastName}
                        </Text>
                        <View style={[styles.timelineStatusBadge, { backgroundColor: config.badgeBg }]}>
                          <Text style={[styles.timelineStatusText, { color: config.badgeText, fontSize: 9 }]}>
                            {config.label}
                          </Text>
                        </View>
                      </View>
                    ) : (
                      /* ── Normal / Full ── */
                      <>
                        <View style={styles.timelineBlockHeader}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            {config.isExam ? (
                              <Ionicons name="school" size={15} color="#4338CA" />
                            ) : null}
                            <Text style={[styles.timelineBlockTime, config.isExam && { color: '#4338CA' }]}>
                              {formatTime(appt.startsAt)} {'\u2013'} {formatTime(appt.endsAt ?? new Date(endTs).toISOString())}
                            </Text>
                          </View>
                          <View style={[styles.timelineStatusBadge, { backgroundColor: config.badgeBg }]}>
                            <Text style={[styles.timelineStatusText, { color: config.badgeText }]}>
                              {config.label}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.timelineBlockStudent} numberOfLines={1}>
                          {appt.student?.firstName} {appt.student?.lastName}
                        </Text>
                        <Text style={styles.timelineBlockMeta} numberOfLines={1}>
                          {config.isExam
                            ? `Esame di guida \u00B7 ${durationLabel(appt)}`
                            : [appt.vehicle?.name, durationLabel(appt)].filter(Boolean).join(' \u00B7 ')}
                        </Text>

                        {isFull && appt.studentId && studentNotesMap[appt.studentId] ? (
                          <View style={styles.timelineNoteRow}>
                            <Ionicons name="document-text-outline" size={13} color="#94A3B8" />
                            <Text style={styles.timelineNoteText} numberOfLines={1}>
                              {studentNotesMap[appt.studentId]}
                            </Text>
                          </View>
                        ) : null}

                        {isFull && isActive && (!isCheckedIn || settings?.autoCheckinEnabled) && actionAvail.enabled && normalizeStatus(appt.status) !== 'proposal' ? (
                          <View style={styles.timelineActions}>
                            {!isCheckedIn ? (
                              <Pressable
                                onPress={(e) => { e.stopPropagation?.(); if (!isPending) executeStatusAction(appt, 'checked_in'); }}
                                disabled={isPending}
                                style={({ pressed }) => [styles.timelineActionBtn, styles.timelineCheckIn, pressed && { opacity: 0.8 }, isPending && { opacity: 0.5 }]}
                              >
                                <Text style={styles.timelineCheckInText}>{pendingAction === 'checked_in' ? 'Attendi...' : '\u2713 Presente'}</Text>
                              </Pressable>
                            ) : null}
                            <Pressable
                              onPress={(e) => { e.stopPropagation?.(); if (!isPending) executeStatusAction(appt, 'no_show'); }}
                              disabled={isPending}
                              style={({ pressed }) => [styles.timelineActionBtn, styles.timelineNoShow, pressed && { opacity: 0.8 }, isPending && { opacity: 0.5 }]}
                            >
                              <Text style={styles.timelineNoShowText}>{pendingAction === 'no_show' ? 'Attendi...' : '\u2717 Assente'}</Text>
                            </Pressable>
                          </View>
                        ) : null}

                        {!isFull && !isCheckedIn && !actionAvail.enabled && actionAvail.reason ? (
                          <View style={styles.timelineWaiting}>
                            <Ionicons name="time-outline" size={14} color="#94A3B8" />
                            <Text style={styles.timelineWaitingText}>{actionAvail.reason}</Text>
                          </View>
                        ) : null}
                      </>
                    )}
                  </Pressable>
                );
              })}
              {/* ── Instructor blocks layer ── */}
              {Array.from(new Map(Array.from(blocksByHour.values()).flat().filter((b) => {
                // Hide sick_leave blocks from timeline only when full-day overlay is shown
                if (b.reason === 'sick_leave') return sickLeaveInfo?.isHalfDay === true;
                return true;
              }).map((b) => [b.id, b])).values()).map((block) => {
                const isSickBlock = block.reason === 'sick_leave';
                const bStart = new Date(block.startsAt);
                const bEnd = new Date(block.endsAt);
                const bStartMin = bStart.getHours() * 60 + bStart.getMinutes();
                const bEndMin = bEnd.getHours() * 60 + bEnd.getMinutes() + (bEnd.getSeconds() > 0 ? 1 : 0);
                const firstHourMin = HOUR_SLOTS[0] * 60;
                const lastHourMin = (HOUR_SLOTS[HOUR_SLOTS.length - 1] + 1) * 60;
                // Clamp to visible timeline range
                const clampedStart = Math.max(bStartMin, firstHourMin);
                const clampedEnd = Math.min(bEndMin, lastHourMin);
                if (clampedEnd <= clampedStart) return null;
                const clampedDurMin = clampedEnd - clampedStart;
                const topPx = ((clampedStart - firstHourMin) / 60) * ROW_H;
                const blockH = Math.max(36, (clampedDurMin / 60) * ROW_H);
                const bCompact = blockH < 55;
                // Sick leave blocks: orange theme
                const blockBorderColor = isSickBlock ? '#FB923C' : '#94A3B8';
                const blockBgColor = isSickBlock ? '#FFF7ED' : '#F8FAFC';
                const blockTextColor = isSickBlock ? '#EA580C' : '#94A3B8';
                const blockBadgeBg = isSickBlock ? '#FFEDD5' : '#F1F5F9';
                const blockBadgeText = isSickBlock ? '#C2410C' : '#64748B';
                const blockLabel = isSickBlock ? 'In malattia' : (block.reason || 'Bloccato');
                return (
                  <Pressable
                    key={`block-${block.id}`}
                    onPress={() => isSickBlock
                      ? Alert.alert(
                          'Rimuovi malattia',
                          'Vuoi rimuovere la segnalazione di malattia? Le guide già cancellate non verranno ripristinate.',
                          [
                            { text: 'Annulla', style: 'cancel' },
                            { text: 'Rimuovi', style: 'destructive', onPress: () => handleDeleteBlock(block.id) },
                          ],
                        )
                      : handleDeleteBlock(block.id)
                    }
                    style={[styles.timelineBlock, { borderLeftColor: blockBorderColor, backgroundColor: blockBgColor, position: 'absolute', top: topPx, left: 46 + 14, right: 0, height: blockH, zIndex: 4, padding: bCompact ? 6 : 14 }]}
                  >
                    {bCompact ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                        {isSickBlock && <Ionicons name="medkit" size={14} color="#EA580C" />}
                        <Text style={{ fontSize: 13, fontWeight: '700', color: blockTextColor }} numberOfLines={1}>
                          {formatTime(block.startsAt)} {'\u2013'} {formatTime(block.endsAt)}
                        </Text>
                        <Text style={{ fontSize: 13, color: blockTextColor, flex: 1 }} numberOfLines={1}>
                          {blockLabel}
                        </Text>
                      </View>
                    ) : (
                      <>
                        <View style={styles.timelineBlockHeader}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            {isSickBlock && <Ionicons name="medkit" size={14} color="#EA580C" />}
                            <Text style={[styles.timelineBlockTime, isSickBlock && { color: '#EA580C' }]}>
                              {formatTime(block.startsAt)} {'\u2013'} {formatTime(block.endsAt)}
                            </Text>
                          </View>
                          <View style={[styles.timelineStatusBadge, { backgroundColor: blockBadgeBg }]}>
                            <Text style={[styles.timelineStatusText, { color: blockBadgeText }]}>{blockLabel}</Text>
                          </View>
                        </View>
                        <Text style={[styles.timelineBlockStudent, { color: blockTextColor }]}>
                          {isSickBlock ? 'Guide cancellate e allievi avvisati' : (block.reason || 'Slot bloccato')}
                        </Text>
                      </>
                    )}
                  </Pressable>
                );
              })}
              {/* ── NOW line ── */}
              {nowHourFraction !== null && nowHourFraction >= HOUR_SLOTS[0] && nowHourFraction <= HOUR_SLOTS[HOUR_SLOTS.length - 1] + 1 ? (
                <View style={[styles.nowLineOverlay, { top: (nowHourFraction - HOUR_SLOTS[0]) * ROW_H, left: 40, zIndex: 20 }]} pointerEvents="none">
                  <View style={styles.nowDot} />
                  <View style={styles.nowLine} />
                  <Text style={styles.nowLabel}>
                    {String(now.getHours()).padStart(2, '0')}:{String(now.getMinutes()).padStart(2, '0')}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        )}
      </ScrollView>

      {agendaViewMode === 'week' ? (
          <WeeklyAgendaView
            appointments={appointments}
            loading={appointmentsLoading}
            studentCompletedMinutes={studentCompletedMinutes}
            weekAvailability={weekAvailability}
            onPressAppointment={(appt: AutoscuolaAppointmentWithRelations) => {
              if (appt.type === 'esame') return;
              setSheetLesson(appt);
            }}
            onPressExam={(examAppts) => {
              if (!examAppts.length) return;
              const first = examAppts[0];
              setExamDrawerGroup({
                id: `exam-${first.startsAt}`,
                startsAt: first.startsAt,
                endsAt: first.endsAt,
                instructorId: first.instructorId,
                instructorName: first.instructor?.name ?? null,
                notes: first.notes,
                appointments: examAppts,
              });
            }}
            onDateChange={(weekStart: Date) => {
              setSelectedDate(weekStart);
            }}
          />
      ) : null}

      {/* ── Sick Leave BottomSheet ── */}
      <BottomSheet
        visible={sickSheetOpen}
        onClose={() => { if (!sickPending && !sickNavigatingToPicker.current) setSickSheetOpen(false); }}
        title="🤒 Malattia"
        closeDisabled={sickPending}
        showHandle
        footer={
          <Pressable
            onPress={sickPending ? undefined : handleCreateSickLeave}
            disabled={sickPending}
            style={({ pressed }) => [styles.ctaButton, pressed && styles.ctaButtonPressed, sickPending && styles.ctaButtonDisabled]}
          >
            <Text style={styles.ctaButtonLabel}>{sickPending ? 'Registrazione...' : 'Conferma malattia'}</Text>
          </Pressable>
        }
      >
        <View style={{ gap: 16 }}>
          {/* Start date */}
          <Pressable
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFBEB', borderRadius: 16, borderWidth: 1, borderColor: '#FDE68A', paddingHorizontal: 14, paddingVertical: 12 }}
            onPress={() => { sickNavigatingToPicker.current = true; setSickSheetOpen(false); setTimeout(() => { setSickStartCalendarOpen(true); sickNavigatingToPicker.current = false; }, 350); }}
          >
            <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="calendar" size={16} color="#CA8A04" />
            </View>
            <View>
              <Text style={{ fontSize: 11, color: '#94A3B8', fontWeight: '600' }}>DATA INIZIO</Text>
              <Text style={{ fontSize: 15, fontWeight: '600', color: '#1E293B' }}>
                {sickStartDate.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })}
              </Text>
            </View>
          </Pressable>

          {/* End date */}
          <Pressable
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFBEB', borderRadius: 16, borderWidth: 1, borderColor: '#FDE68A', paddingHorizontal: 14, paddingVertical: 12 }}
            onPress={() => { sickNavigatingToPicker.current = true; setSickSheetOpen(false); setTimeout(() => { setSickEndCalendarOpen(true); sickNavigatingToPicker.current = false; }, 350); }}
          >
            <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="calendar" size={16} color="#CA8A04" />
            </View>
            <View>
              <Text style={{ fontSize: 11, color: '#94A3B8', fontWeight: '600' }}>DATA FINE</Text>
              <Text style={{ fontSize: 15, fontWeight: '600', color: '#1E293B' }}>
                {sickEndDate.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })}
              </Text>
            </View>
          </Pressable>

          {/* Half day toggle */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 }}>
            <View>
              <Text style={{ fontSize: 15, fontWeight: '600', color: '#1E293B' }}>Mezza giornata</Text>
              <Text style={{ fontSize: 12, color: '#94A3B8' }}>La malattia inizia a un orario specifico</Text>
            </View>
            <Switch
              value={sickHalfDay}
              onValueChange={setSickHalfDay}
              trackColor={{ false: '#E2E8F0', true: '#FACC15' }}
              thumbColor="#FFFFFF"
            />
          </View>

          {/* Half day time picker */}
          {sickHalfDay && (
            <Pressable
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFBEB', borderRadius: 16, borderWidth: 1, borderColor: '#FDE68A', paddingHorizontal: 14, paddingVertical: 12 }}
              onPress={() => { sickNavigatingToPicker.current = true; setSickSheetOpen(false); setTimeout(() => { setSickTimePickerOpen(true); sickNavigatingToPicker.current = false; }, 350); }}
            >
              <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="time" size={16} color="#CA8A04" />
              </View>
              <View>
                <Text style={{ fontSize: 11, color: '#94A3B8', fontWeight: '600' }}>INIZIO MALATTIA</Text>
                <Text style={{ fontSize: 15, fontWeight: '600', color: '#1E293B' }}>
                  {`${String(sickStartTime.getHours()).padStart(2, '0')}:${String(sickStartTime.getMinutes()).padStart(2, '0')}`}
                </Text>
              </View>
            </Pressable>
          )}
        </View>
      </BottomSheet>

      <CalendarDrawer
        visible={sickStartCalendarOpen}
        onClose={() => { setSickStartCalendarOpen(false); setTimeout(() => setSickSheetOpen(true), 350); }}
        selectedDate={sickStartDate}
        onSelectDate={(d) => {
          setSickStartDate(d);
          if (d > sickEndDate) setSickEndDate(d);
        }}
      />
      <CalendarDrawer
        visible={sickEndCalendarOpen}
        onClose={() => { setSickEndCalendarOpen(false); setTimeout(() => setSickSheetOpen(true), 350); }}
        selectedDate={sickEndDate}
        onSelectDate={(d) => setSickEndDate(d)}
      />
      <TimePickerDrawer
        visible={sickTimePickerOpen}
        onClose={() => { setSickTimePickerOpen(false); setTimeout(() => setSickSheetOpen(true), 350); }}
        selectedTime={sickStartTime}
        onSelectTime={setSickStartTime}
      />

      {/* ── FAB Menu ── */}
      <FabMenu
        canBook={canInstructorBook}
        disabled={isPending || Boolean(bookingPendingAction)}
        onBookLesson={openBookingDrawer}
        onBlockSlot={openBlockDrawer}
        onCreateExam={() => router.push('/(tabs)/home/create-exam')}
        onSickLeave={openSickLeaveDrawer}
      />

      {/* ── Placeholder to keep old refs working ── */}
      {/* old content removed — timeline is above */}

      {/* ── Lesson Detail BottomSheet ── */}
      <BottomSheet
        visible={Boolean(sheetLesson)}
        onClose={() => { if (!isPending) setSheetLesson(null); }}
        onClosed={() => {
          if (pendingRescheduleRef.current) {
            setRescheduleLesson(pendingRescheduleRef.current);
            pendingRescheduleRef.current = null;
          }
          if (swapSourceLesson) {
            setSwapModalOpen(true);
          }
        }}
        title="Gestisci guida"
        closeDisabled={isPending}
        showHandle
        footer={
          <View style={styles.sheetFooterActions}>
            {/* Row 1: Presente + Assente (primary actions, side by side) */}
            {canRunStatusAction && normalizeStatus(sheetLesson?.status) !== 'proposal' ? (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {normalizeStatus(sheetLesson?.status) !== 'checked_in' ? (
                  <View style={{ flex: 1 }}>
                    <Button
                      label={pendingAction === 'checked_in' ? 'Attendi...' : 'Presente'}
                      tone="primary"
                      onPress={isPending ? undefined : () => handleStatusAction('checked_in')}
                      disabled={isPending}
                      fullWidth
                    />
                  </View>
                ) : null}
                <View style={{ flex: 1 }}>
                  <Button
                    label={pendingAction === 'no_show' ? 'Attendi...' : 'Assente'}
                    tone="danger"
                    onPress={isPending ? undefined : () => handleStatusAction('no_show')}
                    disabled={isPending}
                    fullWidth
                  />
                </View>
              </View>
            ) : null}
            {/* Row 2: Salva dettagli */}
            <Button
              label={pendingAction === 'save_details' ? 'Salvataggio...' : 'Salva dettagli'}
              tone="standard"
              onPress={!isPending && isSheetDetailsEditable ? handleSaveDetails : undefined}
              disabled={isPending || !isSheetDetailsEditable}
              fullWidth
            />
            {/* Row 3: Sposta + Scambia (side by side) */}
            {(canRescheduleSheetLesson || (sheetLesson &&
              (sheetLesson.status === 'scheduled' || sheetLesson.status === 'confirmed') &&
              new Date(sheetLesson.startsAt) > new Date() &&
              sheetLesson.type !== 'esame')) ? (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {canRescheduleSheetLesson ? (
                  <View style={{ flex: 1 }}>
                    <Button
                      label="Sposta"
                      tone="secondary"
                      onPress={
                        !isPending && sheetLesson
                          ? () => {
                              pendingRescheduleRef.current = sheetLesson;
                              setSheetLesson(null);
                            }
                          : undefined
                      }
                      disabled={isPending}
                      fullWidth
                    />
                  </View>
                ) : null}
                {sheetLesson &&
                  (sheetLesson.status === 'scheduled' || sheetLesson.status === 'confirmed') &&
                  new Date(sheetLesson.startsAt) > new Date() &&
                  sheetLesson.type !== 'esame' ? (
                  <View style={{ flex: 1 }}>
                    <Button
                      label="Scambia"
                      tone="secondary"
                      onPress={() => {
                        setSwapSearch('');
                        setSwapSourceLesson(sheetLesson);
                        setSheetLesson(null);
                      }}
                      fullWidth
                    />
                  </View>
                ) : null}
              </View>
            ) : null}
            {/* Row 4: Cancella (danger, full width) */}
            <Button
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
          </View>
        }
      >
        {sheetLesson ? (
          <View style={{ maxHeight: windowHeight * 0.45 }}>
            <ScrollView
              ref={lessonSheetScrollRef}
              style={styles.sheetScroll}
              contentContainerStyle={styles.sheetContentScroll}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
              automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
              showsVerticalScrollIndicator={false}
              onScroll={({ nativeEvent }) => {
                const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
                const atBottom = contentOffset.y + layoutMeasurement.height >= contentSize.height - 10;
                const atTop = contentOffset.y <= 10;
                setSheetScrollAtBottom(atBottom);
                setSheetScrollAtTop(atTop);
              }}
              scrollEventThrottle={16}
            >
            {/* Info card */}
            <View style={styles.modalInfoCard}>
              <Text style={styles.modalInfoBold}>
                {formatDay(sheetLesson.startsAt)} {'\u00B7'} {formatTime(sheetLesson.startsAt)}
              </Text>
              <Text style={styles.modalInfoName}>
                {sheetLesson.student?.firstName} {sheetLesson.student?.lastName}
              </Text>
              {sheetLesson.student?.phone ? (
                <View style={styles.studentContactRow}>
                  <Pressable
                    style={styles.studentContactButton}
                    onPress={() => Linking.openURL(`tel:${sheetLesson.student!.phone}`)}
                  >
                    <Text style={styles.studentContactIcon}>📞</Text>
                    <Text style={styles.studentContactLabel}>Chiama</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.studentContactButton, styles.studentContactWhatsapp]}
                    onPress={() => {
                      const num = sheetLesson.student!.phone!.replace(/[^0-9]/g, "");
                      Linking.openURL(`https://wa.me/${num}`);
                    }}
                  >
                    <Text style={styles.studentContactIcon}>💬</Text>
                    <Text style={styles.studentContactLabel}>WhatsApp</Text>
                  </Pressable>
                </View>
              ) : null}
              <Text style={styles.modalInfoSub}>
                {durationLabel(sheetLesson)} {'\u00B7'} {sheetLesson.vehicle?.name ?? 'Da assegnare'}
              </Text>
              <View style={styles.sheetStatusRow}>
                {sheetStateMeta ? (
                  <LessonStateTag meta={sheetStateMeta} compact />
                ) : (
                  <Text style={styles.modalInfoSub}>{getLessonStateLabel(sheetLesson, now)}</Text>
                )}
              </View>
            </View>

            {/* TIPO GUIDA */}
            <View style={styles.modalSection}>
              <Text style={styles.modalSectionLabel}>TIPO GUIDA</Text>
              <View style={styles.lessonTypeList}>
                {LESSON_TYPE_OPTIONS.map((option) => (
                  <SelectableChip
                    key={option.value}
                    label={option.label}
                    active={selectedLessonTypes.includes(option.value)}
                    onPress={() => {
                      setSelectedLessonTypes((prev) => {
                        if (prev.includes(option.value)) {
                          const next = prev.filter((t) => t !== option.value);
                          return next.length ? next : [option.value];
                        }
                        return [...prev, option.value];
                      });
                    }}
                    style={styles.lessonTypeChip}
                  />
                ))}
              </View>
            </View>

            {/* VALUTAZIONE */}
            {sheetLesson && ['checked_in', 'completed', 'no_show'].includes(normalizeStatus(sheetLesson.status)) ? (
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionLabel}>VALUTAZIONE</Text>
                <StarRating value={selectedRating} onChange={setSelectedRating} />
              </View>
            ) : null}

            {/* NOTE */}
            <View style={styles.modalSection}>
              <Text style={styles.modalSectionLabel}>NOTE</Text>
              <TextInput
                value={lessonNotes}
                onChangeText={setLessonNotes}
                placeholder="Aggiungi note operative o osservazioni."
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={4}
                style={styles.notesInput}
                editable={!isPending}
                onFocus={() => {
                  setTimeout(() => {
                    lessonSheetScrollRef.current?.scrollToEnd({ animated: true });
                  }, 60);
                }}
              />
            </View>
            </ScrollView>
            {!sheetScrollAtTop && (
              <LinearGradient
                colors={['rgba(255,255,255,1)', 'rgba(255,255,255,0)']}
                style={styles.scrollFadeHintTop}
                pointerEvents="none"
              />
            )}
            {!sheetScrollAtBottom && (
              <LinearGradient
                colors={['rgba(255,255,255,0)', 'rgba(255,255,255,1)']}
                style={styles.scrollFadeHintBottom}
                pointerEvents="none"
              />
            )}
          </View>
        ) : null}
      </BottomSheet>

      {/* ── Booking BottomSheet ── */}
      <BottomSheet
        visible={bookingSheetOpen}
        onClose={() => { if (!bookingPendingAction) { setBookingSheetOpen(false); setEmergencyAllStudents(false); } }}
        title="Nuova prenotazione"
        closeDisabled={Boolean(bookingPendingAction)}
        minHeight={bookingSheetMinHeight}
        showHandle
        footer={bookingSheetFooter}
      >
        <ScrollView
          ref={bookingSheetScrollRef}
          style={[styles.sheetScroll, { maxHeight: bookingSheetMaxHeight }]}
          contentContainerStyle={styles.sheetContentScroll}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
          showsVerticalScrollIndicator={false}
        >
          {!canInstructorBook ? (
            <Text style={styles.actionHint}>
              La prenotazione da app è abilitata solo per allievi.
            </Text>
          ) : null}

          {/* ── ALLIEVO ── */}
          <View style={{ marginTop: spacing.sm }}>
            <Text style={styles.bookingSectionLabel}>Allievo</Text>
            {selectedBookingStudent ? (
              <View style={styles.bookingStudentRow}>
                <Text style={styles.bookingStudentName}>
                  {selectedBookingStudent.firstName} {selectedBookingStudent.lastName}
                </Text>
                <Pressable
                  onPress={() => resetGuidedSuggestionForStudent('')}
                  hitSlop={8}
                >
                  <Text style={styles.bookingStudentChange}>Cambia</Text>
                </Pressable>
              </View>
            ) : (
              <SearchableSelect
                placeholder="Cerca allievo..."
                value={bookingStudentId}
                options={bookingStudentOptions}
                onChange={resetGuidedSuggestionForStudent}
                persistSelectedLabel={false}
                onFocus={() => {
                  setTimeout(() => {
                    bookingSheetScrollRef.current?.scrollTo({ y: 0, animated: true });
                  }, 40);
                }}
                disabled={Boolean(bookingPendingAction) || !students.length}
                emptyText="Nessun allievo trovato."
              />
            )}
            {!students.length ? (
              <Text style={styles.actionHint}>Nessun allievo disponibile.</Text>
            ) : null}
            {clustersActive && !emergencyAllStudents && unassignedStudents.length > 0 ? (
              <Pressable
                onPress={() => {
                  Alert.alert(
                    'Accesso allievi non assegnati',
                    'Stai accedendo ad allievi non assegnati a te',
                    [
                      { text: 'Annulla', style: 'cancel' },
                      { text: 'OK', onPress: () => setEmergencyAllStudents(true) },
                    ],
                  );
                }}
                hitSlop={8}
              >
                <Text style={{ color: '#94A3B8', fontSize: 13, marginTop: 10, textAlign: 'center' }}>
                  Vedi tutti gli allievi
                </Text>
              </Pressable>
            ) : null}
          </View>

          {/* ── PRENOTAZIONE MULTIPLA TOGGLE ── */}
          <View style={{ marginTop: spacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={[typography.body, { color: '#1E293B' }]}>Prenotazione multipla</Text>
            <Switch
              value={multiBookingMode}
              onValueChange={(val) => {
                setMultiBookingMode(val);
                if (val) {
                  const now = new Date();
                  const rounded = normalizeToQuarter(now);
                  setMultiBookingEntries([{
                    id: String(Date.now()),
                    date: new Date(bookingDate),
                    startTime: rounded,
                    duration: bookingDuration,
                  }]);
                } else {
                  setMultiBookingEntries([]);
                  setEditingEntryId(null);
                  setEditingEntryField(null);
                }
              }}
              trackColor={{ false: '#E2E8F0', true: colors.primary }}
              thumbColor="#fff"
              disabled={Boolean(bookingPendingAction)}
            />
          </View>

          {multiBookingMode ? (
            <>
              {/* ── MULTI ENTRIES LIST ── */}
              <View style={{ marginTop: spacing.sm }}>
                <Text style={styles.bookingSectionLabel}>Guide</Text>
                {multiBookingEntries.map((entry, index) => (
                  <View
                    key={entry.id}
                    style={{
                      backgroundColor: '#fff',
                      borderRadius: 14,
                      padding: 12,
                      marginBottom: 8,
                      shadowColor: '#000',
                      shadowOpacity: 0.05,
                      shadowRadius: 8,
                      shadowOffset: { width: 0, height: 2 },
                      elevation: 2,
                    }}
                  >
                    {/* Row 1: date + time + trash */}
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={[styles.bookingFieldIconCircle, { backgroundColor: '#FEF9C3' }]}>
                        <Ionicons name="calendar-outline" size={18} color="#CA8A04" />
                      </View>
                      <Pressable
                        style={{ flex: 1, marginLeft: 10 }}
                        onPress={() => {
                          setEditingEntryId(entry.id);
                          setEditingEntryField('date');
                          setBookingSheetOpen(false);
                          setTimeout(() => setBookingCalendarOpen(true), 350);
                        }}
                      >
                        <Text style={{ color: '#1E293B', fontSize: 15, textDecorationLine: 'underline' }}>
                          {entry.date.toLocaleDateString('it-IT', {
                            weekday: 'short',
                            day: '2-digit',
                            month: 'short',
                          })}
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => {
                          setEditingEntryId(entry.id);
                          setEditingEntryField('time');
                          setBookingSheetOpen(false);
                          setTimeout(() => setTimePickerOpen(true), 350);
                        }}
                      >
                        <Text style={{ color: '#1E293B', fontSize: 15, textDecorationLine: 'underline' }}>
                          {String(entry.startTime.getHours()).padStart(2, '0')}:{String(entry.startTime.getMinutes()).padStart(2, '0')}
                        </Text>
                      </Pressable>
                      {multiBookingEntries.length > 1 ? (
                        <Pressable
                          hitSlop={8}
                          style={{ marginLeft: 12 }}
                          onPress={() => {
                            setMultiBookingEntries((prev) => prev.filter((e) => e.id !== entry.id));
                          }}
                        >
                          <Ionicons name="trash-outline" size={18} color="#EF4444" />
                        </Pressable>
                      ) : (
                        <View style={{ width: 18, marginLeft: 12 }} />
                      )}
                    </View>
                    {/* Row 2: duration chips */}
                    <View style={{ flexDirection: 'row', marginTop: 8, marginLeft: 42, gap: 6 }}>
                      {bookingDurations.map((dur) => {
                        const isActive = entry.duration === dur;
                        return (
                          <Pressable
                            key={dur}
                            onPress={() => {
                              setMultiBookingEntries((prev) =>
                                prev.map((e) => (e.id === entry.id ? { ...e, duration: dur } : e)),
                              );
                            }}
                            style={{
                              paddingVertical: 4,
                              paddingHorizontal: 10,
                              borderRadius: 999,
                              borderWidth: 1,
                              backgroundColor: isActive ? '#FEF9C3' : '#F8FAFC',
                              borderColor: isActive ? '#FDE047' : '#E2E8F0',
                            }}
                          >
                            <Text style={{
                              fontSize: 12,
                              fontWeight: '600',
                              color: isActive ? '#A16207' : '#64748B',
                            }}>
                              {dur} min
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                ))}

                {/* ── ADD ENTRY BUTTON ── */}
                {multiBookingEntries.length < 20 ? (
                  <Pressable
                    onPress={() => {
                      const last = multiBookingEntries[multiBookingEntries.length - 1];
                      const lastDuration = last?.duration ?? bookingDuration;
                      const newDate = last ? new Date(last.date) : new Date(bookingDate);
                      const newTime = last
                        ? new Date(last.startTime.getTime() + lastDuration * 60 * 1000)
                        : normalizeToQuarter(new Date());
                      setMultiBookingEntries((prev) => [
                        ...prev,
                        { id: String(Date.now()), date: newDate, startTime: newTime, duration: lastDuration },
                      ]);
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 1.5,
                      borderStyle: 'dashed',
                      borderColor: '#CBD5E1',
                      borderRadius: 14,
                      paddingVertical: 12,
                      marginTop: 4,
                    }}
                  >
                    <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
                    <Text style={{ color: colors.primary, fontSize: 14, fontWeight: '600', marginLeft: 6 }}>
                      Aggiungi guida
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </>
          ) : (
            <>
              {/* ── GIORNO (single mode) ── */}
              <View style={{ marginTop: spacing.sm }}>
                <Text style={styles.bookingSectionLabel}>Giorno</Text>
                <Pressable
                  onPress={() => {
                    setBookingSheetOpen(false);
                    setTimeout(() => setBookingCalendarOpen(true), 350);
                  }}
                  style={styles.bookingFieldCard}
                >
                  <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                    <View style={[styles.bookingFieldIconCircle, { backgroundColor: '#FEF9C3' }]}>
                      <Ionicons name="calendar-outline" size={18} color="#CA8A04" />
                    </View>
                    <Text style={styles.bookingFieldText}>
                      {bookingDate.toLocaleDateString('it-IT', {
                        weekday: 'short',
                        day: '2-digit',
                        month: 'short',
                      })}
                    </Text>
                  </View>
                  <Text style={styles.bookingFieldChevron}>›</Text>
                </Pressable>
              </View>

              {/* ── ORA INIZIO (single mode) ── */}
              <View style={{ marginTop: spacing.sm }}>
                <Text style={styles.bookingSectionLabel}>Ora inizio</Text>
                <Pressable
                  onPress={() => {
                    setBookingSheetOpen(false);
                    setTimeout(() => setTimePickerOpen(true), 350);
                  }}
                  style={styles.bookingFieldCard}
                >
                  <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                    <View style={[styles.bookingFieldIconCircle, { backgroundColor: '#FCE7F3' }]}>
                      <Ionicons name="time-outline" size={18} color="#EC4899" />
                    </View>
                    <Text style={styles.bookingFieldText}>
                      {bookingStartTime.toTimeString().slice(0, 5)}
                    </Text>
                  </View>
                  <Text style={styles.bookingFieldChevron}>{'\u203A'}</Text>
                </Pressable>
              </View>
            </>
          )}

              {/* ── DURATA (single mode only — multi mode has per-entry duration) ── */}
              {!multiBookingMode ? (
              <View style={{ marginTop: spacing.sm }}>
                <Text style={styles.bookingSectionLabel}>Durata</Text>
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
              ) : null}

              {/* ── VEICOLO ── */}
              <View style={{ marginTop: spacing.sm }}>
                <Text style={styles.bookingSectionLabel}>Veicolo</Text>
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

          {/* ── TIPO GUIDA ── */}
            <View style={{ marginTop: spacing.sm }}>
              <Text style={styles.bookingSectionLabel}>Tipo guida</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipScroller}
              >
                {LESSON_TYPE_OPTIONS.map((option) => (
                  <SelectableChip
                    key={option.value}
                    label={option.label}
                    active={bookingLessonTypes.includes(option.value)}
                    onPress={() => {
                      setBookingLessonTypes((prev) => {
                        if (prev.includes(option.value)) {
                          const next = prev.filter((t) => t !== option.value);
                          return next.length ? next : [option.value];
                        }
                        return [...prev, option.value];
                      });
                    }}
                    style={styles.lessonTypeChip}
                  />
                ))}
              </ScrollView>
            </View>
        </ScrollView>
      </BottomSheet>

      <CalendarDrawer
        visible={calendarDrawerOpen}
        onClose={() => setCalendarDrawerOpen(false)}
        onSelectDate={(date) => setSelectedDate(date)}
        selectedDate={selectedDate}
        unlimitedNavigation
        caption={null}
        bookedDates={bookedDatesSet}
      />

      <CalendarDrawer
        visible={bookingCalendarOpen}
        onClose={() => {
          setBookingCalendarOpen(false);
          setEditingEntryId(null);
          setEditingEntryField(null);
          setTimeout(() => setBookingSheetOpen(true), 350);
        }}
        onSelectDate={(date) => {
          if (editingEntryId && editingEntryField === 'date') {
            setMultiBookingEntries((prev) =>
              prev.map((e) => (e.id === editingEntryId ? { ...e, date } : e)),
            );
            setEditingEntryId(null);
            setEditingEntryField(null);
          } else {
            setBookingDate(date);
            setGuidedSuggestion(null);
          }
          setBookingCalendarOpen(false);
          setTimeout(() => setBookingSheetOpen(true), 350);
        }}
        selectedDate={
          editingEntryId
            ? (multiBookingEntries.find((e) => e.id === editingEntryId)?.date ?? bookingDate)
            : bookingDate
        }
        maxWeeks={Number(settings?.availabilityWeeks) || 4}
        caption={null}
      />

      <CalendarDrawer
        visible={guidedCalendarOpen}
        onClose={() => {
          setGuidedCalendarOpen(false);
          setTimeout(() => setBookingSheetOpen(true), 350);
        }}
        onSelectDate={(date) => {
          setGuidedPreferredDate(date);
          setGuidedSuggestion(null);
          setGuidedCalendarOpen(false);
          setTimeout(() => setBookingSheetOpen(true), 350);
        }}
        selectedDate={guidedPreferredDate ?? new Date()}
        maxWeeks={Number(settings?.availabilityWeeks) || 4}
        caption={null}
      />

      <TimePickerDrawer
        visible={timePickerOpen}
        onClose={() => {
          setTimePickerOpen(false);
          setEditingEntryId(null);
          setEditingEntryField(null);
          setTimeout(() => setBookingSheetOpen(true), 350);
        }}
        onSelectTime={(date) => {
          if (editingEntryId && editingEntryField === 'time') {
            setMultiBookingEntries((prev) =>
              prev.map((e) => (e.id === editingEntryId ? { ...e, startTime: date } : e)),
            );
            setEditingEntryId(null);
            setEditingEntryField(null);
          } else {
            setBookingStartTime(date);
            setGuidedSuggestion(null);
          }
        }}
        selectedTime={
          editingEntryId
            ? (multiBookingEntries.find((e) => e.id === editingEntryId)?.startTime ?? bookingStartTime)
            : bookingStartTime
        }
      />

      {/* ── Block Slot BottomSheet ── */}
      <BottomSheet
        visible={blockSheetOpen}
        onClose={() => { if (!blockPending) setBlockSheetOpen(false); }}
        title="Blocca slot"
        closeDisabled={blockPending}
        footer={
          <Button
            label={blockPending ? 'Creazione...' : 'Blocca slot'}
            tone="primary"
            onPress={!blockPending ? handleCreateBlock : undefined}
            disabled={blockPending}
            fullWidth
          />
        }
      >
        <View style={{ gap: spacing.md }}>
          <View>
            <Text style={styles.bookingSectionLabel}>Giorno</Text>
            <Pressable
              onPress={() => {
                setBlockSheetOpen(false);
                setTimeout(() => setBlockCalendarOpen(true), 350);
              }}
              style={styles.bookingFieldCard}
            >
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                <View style={[styles.bookingFieldIconCircle, { backgroundColor: '#F1F5F9' }]}>
                  <Ionicons name="calendar-outline" size={18} color="#64748B" />
                </View>
                <Text style={styles.bookingFieldText}>
                  {blockDate.toLocaleDateString('it-IT', {
                    weekday: 'short',
                    day: '2-digit',
                    month: 'short',
                  })}
                </Text>
              </View>
              <Text style={styles.bookingFieldChevron}>›</Text>
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.bookingSectionLabel}>Ora inizio</Text>
              <Pressable
                onPress={() => {
                  setBlockSheetOpen(false);
                  setTimeout(() => setBlockStartTimePickerOpen(true), 350);
                }}
                style={styles.bookingFieldCard}
              >
                <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                  <View style={[styles.bookingFieldIconCircle, { backgroundColor: '#F1F5F9' }]}>
                    <Ionicons name="time-outline" size={18} color="#64748B" />
                  </View>
                  <Text style={styles.bookingFieldText}>
                    {String(blockStartTime.getHours()).padStart(2, '0')}:{String(blockStartTime.getMinutes()).padStart(2, '0')}
                  </Text>
                </View>
              </Pressable>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.bookingSectionLabel}>Ora fine</Text>
              <Pressable
                onPress={() => {
                  setBlockSheetOpen(false);
                  setTimeout(() => setBlockEndTimePickerOpen(true), 350);
                }}
                style={styles.bookingFieldCard}
              >
                <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                  <View style={[styles.bookingFieldIconCircle, { backgroundColor: '#F1F5F9' }]}>
                    <Ionicons name="time-outline" size={18} color="#64748B" />
                  </View>
                  <Text style={styles.bookingFieldText}>
                    {String(blockEndTime.getHours()).padStart(2, '0')}:{String(blockEndTime.getMinutes()).padStart(2, '0')}
                  </Text>
                </View>
              </Pressable>
            </View>
          </View>
          <View>
            <Text style={styles.bookingSectionLabel}>Motivo (opzionale)</Text>
            <Input
              placeholder="Es. Visita medica, pausa..."
              value={blockReason}
              onChangeText={setBlockReason}
            />
          </View>
          <View style={styles.blockRecurringRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.blockRecurringLabel}>Ripeti ogni settimana</Text>
              <Text style={styles.blockRecurringDesc}>Stesso giorno e orario</Text>
            </View>
            <Switch
              value={blockRecurring}
              onValueChange={setBlockRecurring}
              trackColor={{ false: '#E2E8F0', true: '#FACC15' }}
              thumbColor="#FFFFFF"
            />
          </View>
          {blockRecurring && (
            <View>
              <Text style={styles.bookingSectionLabel}>Per quante settimane</Text>
              <View style={styles.blockWeeksRow}>
                {[2, 4, 8, 12].map((w) => (
                  <Pressable
                    key={w}
                    style={[styles.blockWeekChip, blockRecurringWeeks === w && styles.blockWeekChipActive]}
                    onPress={() => setBlockRecurringWeeks(w)}
                  >
                    <Text style={[styles.blockWeekChipText, blockRecurringWeeks === w && styles.blockWeekChipTextActive]}>
                      {w} sett.
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
        </View>
      </BottomSheet>

      {/* ── Out of Availability BottomSheet ── */}
      <BottomSheet
        visible={outOfAvailSheetOpen}
        onClose={() => setOutOfAvailSheetOpen(false)}
        title="Guide fuori disponibilità"
        showHandle
      >
        <ScrollView style={{ maxHeight: windowHeight * 0.6 }} showsVerticalScrollIndicator={false}>
          {outOfAvailAppointments.map((apt) => {
            const isLoading = outOfAvailActionPending === apt.id;
            return (
            <View key={apt.id} style={[oobStyles.card, isLoading && { opacity: 0.5 }]}>
              <View style={oobStyles.cardHeader}>
                <Text style={oobStyles.studentName}>{apt.studentName}</Text>
                <View style={[
                  oobStyles.badge,
                  apt.outOfAvailabilityFor.length > 1
                    ? oobStyles.badgeBoth
                    : apt.outOfAvailabilityFor.includes('instructor')
                      ? oobStyles.badgeInstructor
                      : oobStyles.badgeVehicle,
                ]}>
                  <Text style={[
                    oobStyles.badgeText,
                    apt.outOfAvailabilityFor.length > 1
                      ? oobStyles.badgeTextBoth
                      : apt.outOfAvailabilityFor.includes('instructor')
                        ? oobStyles.badgeTextInstructor
                        : oobStyles.badgeTextVehicle,
                  ]}>
                    {apt.outOfAvailabilityFor.length > 1
                      ? 'Entrambi'
                      : apt.outOfAvailabilityFor.includes('instructor')
                        ? 'Istruttore'
                        : 'Veicolo'}
                  </Text>
                </View>
              </View>
              <Text style={oobStyles.cardTime}>
                {new Date(apt.startsAt).toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: 'short' })}
                {' \u00B7 '}
                {formatTime(apt.startsAt)} – {formatTime(apt.endsAt)}
              </Text>
              {apt.instructorName && (
                <Text style={oobStyles.cardMeta}>{apt.instructorName}</Text>
              )}
              {apt.vehicleName && (
                <Text style={oobStyles.cardMeta}>{apt.vehicleName}</Text>
              )}
              <View style={oobStyles.actions}>
                <Pressable
                  style={oobStyles.actionBtn}
                  disabled={isLoading}
                  onPress={() => handleOutOfAvailAction(apt.id, 'reposition')}
                >
                  <Text style={oobStyles.actionBtnText}>Riposiziona</Text>
                </Pressable>
                <Pressable
                  style={[oobStyles.actionBtn, oobStyles.actionBtnDanger]}
                  disabled={isLoading}
                  onPress={() => handleOutOfAvailAction(apt.id, 'cancel')}
                >
                  <Text style={[oobStyles.actionBtnText, oobStyles.actionBtnDangerText]}>Cancella</Text>
                </Pressable>
                <Pressable
                  style={[oobStyles.actionBtn, oobStyles.actionBtnPrimary]}
                  disabled={isLoading}
                  onPress={() => handleOutOfAvailAction(apt.id, 'approve')}
                >
                  <Text style={[oobStyles.actionBtnText, oobStyles.actionBtnPrimaryText]}>Mantieni</Text>
                </Pressable>
              </View>
            </View>
            );
          })}
          {outOfAvailAppointments.length === 0 && (
            <Text style={oobStyles.emptyText}>Nessuna guida fuori disponibilità.</Text>
          )}
        </ScrollView>
      </BottomSheet>

      {/* ── Exam details drawer ── */}
      <BottomSheet
        visible={Boolean(examDrawerGroup)}
        onClose={() => setExamDrawerGroup(null)}
        showHandle
      >
        <ScrollView contentContainerStyle={{ paddingBottom: 12 }} showsVerticalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="school" size={20} color="#4338CA" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: '#1E293B' }}>Esame di guida</Text>
              {examDrawerGroup ? (
                <Text style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>
                  {formatDay(examDrawerGroup.startsAt)} · {formatTime(examDrawerGroup.startsAt)}
                  {examDrawerGroup.endsAt ? ` – ${formatTime(examDrawerGroup.endsAt)}` : ''}
                </Text>
              ) : null}
            </View>
          </View>

          {examDrawerGroup?.instructorName ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 14, backgroundColor: '#F8FAFC', marginBottom: 12 }}>
              <Ionicons name="person-outline" size={16} color="#64748B" />
              <Text style={{ fontSize: 13, color: '#475569' }}>Accompagnatore:</Text>
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#1E293B', flex: 1 }}>
                {examDrawerGroup.instructorName}
              </Text>
            </View>
          ) : null}

          <Text style={{ fontSize: 12, fontWeight: '700', color: '#64748B', letterSpacing: 0.5, marginBottom: 8 }}>
            ALLIEVI ({examDrawerGroup?.appointments.length ?? 0})
          </Text>
          <View style={{ borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF', overflow: 'hidden', marginBottom: 12 }}>
            {examDrawerGroup?.appointments.map((a, idx) => {
              const isLast = idx === examDrawerGroup.appointments.length - 1;
              const canRemove = examDrawerGroup.appointments.length > 1;
              const pending = examActionPending === a.id;
              const name = a.student?.name ?? 'Allievo';
              return (
                <View
                  key={a.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    padding: 12,
                    borderBottomWidth: isLast ? 0 : 1,
                    borderBottomColor: '#F1F5F9',
                  }}
                >
                  <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="person" size={14} color="#4338CA" />
                  </View>
                  <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: '#1E293B' }} numberOfLines={1}>
                    {name}
                  </Text>
                  <Pressable
                    onPress={() =>
                      canRemove && !pending
                        ? Alert.alert(
                            'Rimuovi allievo',
                            `Rimuovere ${name} dall\u2019esame?`,
                            [
                              { text: 'Annulla', style: 'cancel' },
                              { text: 'Rimuovi', style: 'destructive', onPress: () => handleRemoveExamStudent(a.id) },
                            ],
                          )
                        : undefined
                    }
                    disabled={!canRemove || pending}
                    style={({ pressed }) => [
                      {
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: 999,
                        backgroundColor: !canRemove ? '#F1F5F9' : pressed ? '#FEE2E2' : '#FEF2F2',
                        borderWidth: 1,
                        borderColor: !canRemove ? '#E2E8F0' : '#FECACA',
                      },
                    ]}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '600', color: !canRemove ? '#94A3B8' : '#DC2626' }}>
                      {pending ? '...' : 'Rimuovi'}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </View>

          {examDrawerGroup?.notes ? (
            <>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#64748B', letterSpacing: 0.5, marginBottom: 8 }}>NOTE</Text>
              <View style={{ padding: 12, borderRadius: 14, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 12 }}>
                <Text style={{ fontSize: 13, color: '#475569', lineHeight: 18 }}>{examDrawerGroup.notes}</Text>
              </View>
            </>
          ) : null}

          <Pressable
            onPress={() =>
              Alert.alert(
                'Annulla esame',
                'Vuoi annullare l\u2019esame per tutti gli allievi?',
                [
                  { text: 'Chiudi', style: 'cancel' },
                  { text: 'Annulla esame', style: 'destructive', onPress: handleCancelExam },
                ],
              )
            }
            disabled={examActionPending === 'all'}
            style={({ pressed }) => [
              {
                paddingVertical: 14,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: '#FECACA',
                backgroundColor: pressed ? '#FEE2E2' : '#FFFFFF',
                alignItems: 'center',
                marginTop: 4,
              },
              examActionPending === 'all' && { opacity: 0.6 },
            ]}
          >
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#DC2626' }}>
              {examActionPending === 'all' ? 'Annullamento...' : 'Annulla esame'}
            </Text>
          </Pressable>
        </ScrollView>
      </BottomSheet>

      {/* Block slot calendar/time drawers */}
      <CalendarDrawer
        visible={blockCalendarOpen}
        onClose={() => {
          setBlockCalendarOpen(false);
          setTimeout(() => setBlockSheetOpen(true), 350);
        }}
        onSelectDate={(date) => {
          setBlockDate(date);
          setBlockCalendarOpen(false);
          setTimeout(() => setBlockSheetOpen(true), 350);
        }}
        selectedDate={blockDate}
      />
      <TimePickerDrawer
        visible={blockStartTimePickerOpen}
        onClose={() => {
          setBlockStartTimePickerOpen(false);
          setTimeout(() => setBlockSheetOpen(true), 350);
        }}
        onSelectTime={(date) => {
          setBlockStartTime(date);
          setBlockStartTimePickerOpen(false);
          setTimeout(() => setBlockSheetOpen(true), 350);
        }}
        selectedTime={blockStartTime}
      />
      <TimePickerDrawer
        visible={blockEndTimePickerOpen}
        onClose={() => {
          setBlockEndTimePickerOpen(false);
          setTimeout(() => setBlockSheetOpen(true), 350);
        }}
        onSelectTime={(date) => {
          setBlockEndTime(date);
          setBlockEndTimePickerOpen(false);
          setTimeout(() => setBlockSheetOpen(true), 350);
        }}
        selectedTime={blockEndTime}
      />

      <RescheduleAppointmentSheet
        visible={rescheduleLesson !== null}
        onClose={() => setRescheduleLesson(null)}
        lesson={rescheduleLesson}
        onSuccess={(newStartsAt) => {
          setToast({
            text: `Guida spostata al ${formatDay(newStartsAt)} · ${formatTime(newStartsAt)}.`,
            tone: 'success',
          });
          loadData();
        }}
        onError={(message) => {
          setToast({ text: message, tone: 'danger' });
        }}
      />

      <Modal
        visible={swapModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => { if (!swapPending) { setSwapModalOpen(false); setSwapSourceLesson(null); } }}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 20, width: '100%', maxHeight: '70%', overflow: 'hidden' }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#0F172A' }}>Scambia con…</Text>
              <Pressable hitSlop={8} onPress={() => { if (!swapPending) { setSwapModalOpen(false); setSwapSourceLesson(null); } }}>
                <Ionicons name="close" size={22} color="#94A3B8" />
              </Pressable>
            </View>

            {/* Search */}
            <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 12, height: 42 }}>
                <Ionicons name="search" size={18} color="#94A3B8" />
                <TextInput
                  placeholder="Cerca allievo..."
                  placeholderTextColor="#94A3B8"
                  value={swapSearch}
                  onChangeText={setSwapSearch}
                  style={{ flex: 1, marginLeft: 8, fontSize: 15, color: '#1E293B' }}
                  autoCorrect={false}
                />
                {swapSearch ? (
                  <Pressable hitSlop={8} onPress={() => setSwapSearch('')}>
                    <Ionicons name="close-circle" size={18} color="#CBD5E1" />
                  </Pressable>
                ) : null}
              </View>
            </View>

            {/* List */}
            <ScrollView style={{ flexShrink: 1 }} keyboardShouldPersistTaps="handled">
              {swapCandidatesByDay.length === 0 ? (
                <View style={{ padding: 40, alignItems: 'center' }}>
                  <Ionicons name="swap-horizontal-outline" size={32} color="#CBD5E1" />
                  <Text style={{ color: '#94A3B8', fontSize: 14, marginTop: 8, textAlign: 'center' }}>
                    Nessuna guida disponibile per lo scambio
                  </Text>
                </View>
              ) : (
                swapCandidatesByDay.map((section) => (
                  <View key={section.title}>
                    <View style={{ paddingHorizontal: 20, paddingVertical: 6, backgroundColor: '#F8FAFC' }}>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: '#64748B', textTransform: 'capitalize' }}>
                        {section.title}
                      </Text>
                    </View>
                    {section.data.map((appt) => {
                      const startTime = new Date(appt.startsAt);
                      const timeStr = `${String(startTime.getHours()).padStart(2, '0')}:${String(startTime.getMinutes()).padStart(2, '0')}`;
                      const endTime = appt.endsAt ? new Date(appt.endsAt) : new Date(startTime.getTime() + 60 * 60 * 1000);
                      const endStr = `${String(endTime.getHours()).padStart(2, '0')}:${String(endTime.getMinutes()).padStart(2, '0')}`;
                      return (
                        <Pressable
                          key={appt.id}
                          onPress={() => handleInstructorSwap(appt)}
                          disabled={swapPending}
                          style={({ pressed }) => ({
                            flexDirection: 'row',
                            alignItems: 'center',
                            paddingHorizontal: 20,
                            paddingVertical: 14,
                            borderBottomWidth: 1,
                            borderBottomColor: '#F1F5F9',
                            backgroundColor: pressed ? '#FEF9C3' : '#fff',
                          })}
                        >
                          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#FCE7F3', alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ fontSize: 14, fontWeight: '700', color: '#EC4899' }}>
                              {(appt.student?.firstName ?? '?').slice(0, 1).toUpperCase()}
                            </Text>
                          </View>
                          <View style={{ flex: 1, marginLeft: 12 }}>
                            <Text style={{ fontSize: 15, fontWeight: '600', color: '#1E293B' }}>
                              {appt.student?.firstName ?? ''} {appt.student?.lastName ?? ''}
                            </Text>
                            <Text style={{ fontSize: 13, color: '#64748B', marginTop: 1 }}>
                              {appt.vehicle?.name ?? ''}
                            </Text>
                          </View>
                          <Text style={{ fontSize: 14, fontWeight: '600', color: '#475569' }}>
                            {timeStr} – {endStr}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Screen>
  );
};

const LessonStateTag = ({
  meta,
  compact = false,
}: {
  meta: { label: string; tone: 'live' | 'confirmed' | 'scheduled' | 'pending_review' };
  compact?: boolean;
}) => {
  const tagStyle =
    meta.tone === 'pending_review'
      ? styles.stateTagPendingReview
      : meta.tone === 'live'
        ? styles.stateTagLive
        : meta.tone === 'scheduled'
          ? styles.stateTagScheduled
          : styles.stateTagConfirmed;
  return (
  <View
    style={[
      styles.stateTag,
      tagStyle,
      compact && styles.stateTagCompact,
    ]}
  >
    <Text numberOfLines={1} style={[styles.stateTagText, (meta.tone === 'scheduled' || meta.tone === 'pending_review') && styles.stateTagTextScheduled, compact && styles.stateTagTextCompact]}>
      {meta.label}
    </Text>
  </View>
  );
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const FAB_DURATION = 300;
const PILL_STAGGER = 60;

const FabMenu = ({
  canBook,
  disabled,
  onBookLesson,
  onBlockSlot,
  onCreateExam,
  onSickLeave,
}: {
  canBook: boolean;
  disabled: boolean;
  onBookLesson: () => void;
  onBlockSlot: () => void;
  onCreateExam: () => void;
  onSickLeave: () => void;
}) => {
  const progress = useSharedValue(0);
  const [open, setOpen] = useState(false);

  const toggle = useCallback(() => {
    const next = !open;
    setOpen(next);
    progress.value = withTiming(next ? 1 : 0, {
      duration: FAB_DURATION,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
    });
  }, [open, progress]);

  const close = useCallback(() => {
    setOpen(false);
    progress.value = withTiming(0, {
      duration: FAB_DURATION,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
    });
  }, [progress]);

  const handleBook = useCallback(() => {
    close();
    onBookLesson();
  }, [close, onBookLesson]);

  const handleBlock = useCallback(() => {
    close();
    onBlockSlot();
  }, [close, onBlockSlot]);

  // FAB rotation: 450° (1.25 turns)
  const fabStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${interpolate(progress.value, [0, 1], [0, 90])}deg` },
      { scale: interpolate(progress.value, [0, 0.5, 1], [1, 1.1, 1]) },
    ],
  }));

  // Overlay fade
  const overlayStyle = useAnimatedStyle(() => ({
    opacity: progress.value * 0.4,
    pointerEvents: progress.value > 0.01 ? 'auto' as const : 'none' as const,
  }));

  // Pill animations (bottom pill first — closer to FAB)
  const pill0Style = useAnimatedStyle(() => {
    const p = interpolate(progress.value, [0, 1], [0, 1]);
    return {
      opacity: p,
      transform: [
        { translateY: interpolate(p, [0, 1], [20, 0]) },
        { scale: interpolate(p, [0, 1], [0.8, 1]) },
      ],
    };
  });

  const pill1Style = useAnimatedStyle(() => {
    const delayed = interpolate(progress.value, [0, 0.3, 1], [0, 0, 1]);
    return {
      opacity: delayed,
      transform: [
        { translateY: interpolate(delayed, [0, 1], [20, 0]) },
        { scale: interpolate(delayed, [0, 1], [0.8, 1]) },
      ],
    };
  });

  return (
    <>
      {/* Overlay */}
      <Animated.View style={[styles.fabOverlay, overlayStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
      </Animated.View>

      {/* Pills */}
      {open || progress.value > 0 ? (
        <View style={styles.fabMenuContainer} pointerEvents="box-none">
          {canBook ? (
            <Animated.View style={pill1Style}>
              <Pressable
                onPress={handleBook}
                style={({ pressed }) => [
                  styles.fabPill,
                  pressed && styles.fabPillPressed,
                ]}
              >
                <View style={[styles.fabPillIcon, { backgroundColor: '#FDF2F8' }]}>
                  <Ionicons name="calendar-outline" size={20} color="#EC4899" />
                </View>
                <Text style={styles.fabPillLabel}>Prenota guida</Text>
              </Pressable>
            </Animated.View>
          ) : null}
          <Animated.View style={pill0Style}>
            <Pressable
              onPress={handleBlock}
              style={({ pressed }) => [
                styles.fabPill,
                pressed && styles.fabPillPressed,
              ]}
            >
              <View style={[styles.fabPillIcon, { backgroundColor: '#F1F5F9' }]}>
                <Ionicons name="ban-outline" size={20} color="#64748B" />
              </View>
              <Text style={styles.fabPillLabel}>Blocca slot</Text>
            </Pressable>
          </Animated.View>
          <Animated.View style={pill0Style}>
            <Pressable
              onPress={onCreateExam}
              style={({ pressed }) => [
                styles.fabPill,
                pressed && styles.fabPillPressed,
              ]}
            >
              <View style={[styles.fabPillIcon, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="school-outline" size={20} color="#D97706" />
              </View>
              <Text style={styles.fabPillLabel}>Crea esame</Text>
            </Pressable>
          </Animated.View>
          <Animated.View style={pill0Style}>
            <Pressable
              onPress={onSickLeave}
              style={({ pressed }) => [
                styles.fabPill,
                pressed && styles.fabPillPressed,
              ]}
            >
              <View style={[styles.fabPillIcon, { backgroundColor: '#FEF2F2' }]}>
                <Ionicons name="medkit-outline" size={20} color="#DC2626" />
              </View>
              <Text style={styles.fabPillLabel}>Malattia</Text>
            </Pressable>
          </Animated.View>
        </View>
      ) : null}

      {/* FAB */}
      <AnimatedPressable
        onPress={disabled ? undefined : toggle}
        style={[
          styles.fab,
          disabled && { opacity: 0.5 },
          fabStyle,
        ]}
      >
        <Ionicons name={open ? 'close' : 'add'} size={28} color="#FFFFFF" />
      </AnimatedPressable>
    </>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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

  /* ── Next Lesson Card (yellow gradient) ── */
  nextLessonShadow: {
    borderRadius: radii.lg,
    shadowColor: '#B45309',
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  nextLessonCard: {
    borderRadius: radii.lg,
    padding: 22,
    gap: 8,
    overflow: 'hidden',
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
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.85)',
    textShadowColor: 'rgba(120, 53, 0, 0.25)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  nextLessonInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  nextLessonLiveBadge: {
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
  nextLessonLiveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#16A34A',
  },
  nextLessonLiveBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#15803D',
    letterSpacing: 0.6,
  },
  nextLessonWaitingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  nextLessonWaitingText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    textShadowColor: 'rgba(120, 53, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  nextLessonStatusPill: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  nextLessonStatusText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
    textShadowColor: 'rgba(120, 53, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  nextLessonNoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  nextLessonNoteText: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
    flex: 1,
    fontStyle: 'italic',
    textShadowColor: 'rgba(120, 53, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  nextLessonDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginVertical: 12,
  },
  nextLessonActions: {
    flexDirection: 'row',
    gap: 10,
  },
  nextLessonActionBtn: {
    flex: 1,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextLessonCheckIn: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    shadowColor: 'rgba(120, 53, 0, 0.25)',
    shadowOpacity: 1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  nextLessonCheckInText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#16A34A',
  },
  nextLessonNoShow: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    shadowColor: 'rgba(120, 53, 0, 0.2)',
    shadowOpacity: 1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  nextLessonNoShowText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    textShadowColor: 'rgba(120, 53, 0, 0.25)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  nextLessonDetailLink: {
    alignSelf: 'center',
    paddingTop: 10,
    paddingBottom: 2,
  },
  nextLessonDetailLinkText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    textShadowColor: 'rgba(120, 53, 0, 0.25)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  nextLessonSkeleton: {
    backgroundColor: '#FEF9C3',
    paddingHorizontal: 22,
    paddingVertical: 24,
    gap: 12,
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
    position: 'absolute',
    bottom: 8,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#DC2626',
  },
  holidayBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 8,
  },
  holidayBannerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#DC2626',
  },
  holidayBannerSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 2,
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
    paddingHorizontal: 22,
    paddingVertical: 16,
    gap: spacing.xs,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  agendaRowPast: {
    opacity: 0.88,
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
  agendaStudent: {
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
  empty: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },


  /* ── State Tag ── */
  stateTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: spacing.xs,
  },
  stateTagLive: {
    backgroundColor: colors.positive,
  },
  stateTagConfirmed: {
    backgroundColor: colors.positive,
  },
  stateTagScheduled: {
    backgroundColor: '#FEF9C3',
  },
  stateTagPendingReview: {
    backgroundColor: '#FFF7ED',
  },
  stateTagText: {
    ...typography.caption,
    color: '#FFFFFF',
    fontWeight: '700',
    letterSpacing: 0,
    flexShrink: 0,
  },
  stateTagCompact: {
    marginTop: 0,
    marginBottom: 0,
    paddingVertical: 2,
    paddingHorizontal: spacing.xs,
  },
  stateTagTextCompact: {
    fontSize: 10,
  },
  stateTagTextScheduled: {
    color: '#CA8A04',
  },

  /* ── BottomSheet content styles ── */
  modalInfoCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    gap: 4,
  },
  modalInfoBold: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  modalInfoName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1E293B',
  },
  modalInfoPhone: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3B82F6',
    marginTop: 2,
  },
  studentContactRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  studentContactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  studentContactWhatsapp: {
    backgroundColor: '#F0FDF4',
  },
  studentContactIcon: {
    fontSize: 16,
  },
  studentContactLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
  },
  modalInfoSub: {
    fontSize: 13,
    color: '#94A3B8',
  },
  modalSection: {
    gap: 4,
  },
  modalSectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  modalBookingInfoCard: {
    backgroundColor: '#FEF9C3',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: 16,
    gap: 4,
  },
  modalBookingInfoLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#CA8A04',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  modalBookingInfoMode: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111111',
  },

  /* ── Sheet internals (kept for ScrollView sizing) ── */
  sheetContent: {
    gap: spacing.sm,
  },
  sheetScroll: {
    width: '100%',
  },
  blockRecurringRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  blockRecurringLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  blockRecurringDesc: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  blockWeeksRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  blockWeekChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
  },
  blockWeekChipActive: {
    backgroundColor: '#FACC15',
  },
  blockWeekChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  blockWeekChipTextActive: {
    color: '#1E293B',
  },
  scrollFadeHintTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 32,
    zIndex: 1,
  },
  scrollFadeHintBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 32,
  },
  sheetContentScroll: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
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
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
    backgroundColor: '#FFFFFF',
    textAlignVertical: 'top',
    ...typography.body,
  },
  sheetFooterActions: {
    gap: spacing.sm,
    width: '100%',
  },
  datePickerPressable: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    gap: 2,
  },
  datePickerLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
    letterSpacing: 0.3,
  },
  datePickerValue: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1E293B',
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
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
    backgroundColor: '#FEF9C3',
    padding: 16,
    gap: spacing.xs,
  },
  guidedSuggestionTitle: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
  },

  /* ── Booking BottomSheet form styles ── */
  bookingSectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  bookingFieldCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: radii.sm,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bookingFieldIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookingFieldText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
  },
  bookingFieldChevron: {
    fontSize: 18,
    color: '#CBD5E1',
  },
  bookingStudentRow: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bookingStudentName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
  },
  bookingStudentChange: {
    fontSize: 13,
    fontWeight: '700',
    color: '#EC4899',
  },

  emptyState: {
    flex: 1,
    padding: spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xxl * 2,
    gap: spacing.md,
  },
  emptyText: {
    ...typography.body,
    color: colors.textMuted,
  },
  actionHint: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  error: {
    ...typography.body,
    color: colors.destructive,
  },

  /* ── Next Lesson Banner ── */
  nextBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FEF9C3',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  nextBannerLive: {
    backgroundColor: '#F0FDF4',
  },
  nextBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  nextBannerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#16A34A',
  },
  nextBannerLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  nextBannerInfo: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    flex: 1,
    textAlign: 'right',
    marginLeft: 12,
  },

  /* ── Timeline ── */
  timelineSection: {
    gap: 0,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  timelineGridWrapper: {
    position: 'relative' as const,
  },
  emptyDayBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 16,
    marginBottom: 20,
    gap: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
    overflow: 'hidden',
  },
  emptyDayDuckClip: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#FDF2F8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyDayDuck: {
    width: 120,
    height: 120,
  },
  emptyDayTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  emptyDaySubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 2,
    lineHeight: 18,
  },
  hourLabel: {
    width: 46,
    fontSize: 12,
    fontWeight: '500',
    color: '#94A3B8',
    marginTop: -7,
  },
  timelineSlotArea: {
    flex: 1,
    paddingLeft: 14,
    position: 'relative' as const,
    overflow: 'visible',
  },
  timelineSlotUnavailable: {
    borderLeftWidth: 1,
    borderLeftColor: '#E5E7EB',
    borderStyle: 'dashed' as const,
  },
  unavailableLabelWrap: {
    position: 'absolute' as const,
    top: 0,
    left: 14,
    right: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  unavailableLabel: {
    fontSize: 13,
    fontStyle: 'italic' as const,
    fontWeight: '500' as const,
    color: '#CBD5E1',
    letterSpacing: 0.3,
  },
  emptyHourLine: {
    height: 1,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    borderStyle: 'dashed',
    marginTop: 12,
    flex: 1,
  },
  timelineBlock: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#64748B',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  timelineBlockActive: {
    backgroundColor: '#FFF1F3',
    borderLeftWidth: 5,
    borderLeftColor: '#EC4899',
    borderColor: '#FECDD3',
    shadowColor: '#EC4899',
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  timelineBlockHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  timelineBlockTime: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  timelineStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  timelineStatusText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  timelineBlockStudent: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  timelineBlockMeta: {
    fontSize: 12,
    fontWeight: '500',
    color: '#94A3B8',
  },
  timelineActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  timelineActionBtn: {
    flex: 1,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineCheckIn: {
    backgroundColor: '#16A34A',
    shadowColor: '#16A34A',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  timelineCheckInText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  timelineNoShow: {
    backgroundColor: '#F1F5F9',
  },
  timelineNoShowText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
  },
  timelineNoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
  },
  timelineNoteText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#94A3B8',
    fontStyle: 'italic',
    flex: 1,
  },
  timelineWaiting: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
  },
  timelineWaitingText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  },
  timelineSkeletonCard: {
    gap: spacing.xs,
  },

  /* ── NOW Line ── */
  nowLineOverlay: {
    position: 'absolute',
    left: -6,
    right: -8,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 20,
  },
  nowDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EF4444',
    marginLeft: -6,
    shadowColor: '#EF4444',
    shadowOpacity: 0.4,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  nowLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#EF4444',
    opacity: 0.7,
  },
  nowLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#EF4444',
    marginLeft: 6,
  },

  /* ── FAB ── */
  fabOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
    zIndex: 50,
  },
  fabMenuContainer: {
    position: 'absolute',
    bottom: 164,
    right: 24,
    alignItems: 'flex-end',
    gap: 12,
    zIndex: 51,
  },
  fabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 10,
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  fabPillPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.97 }],
  },
  fabPillIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabPillLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
    marginRight: 4,
  },
  fab: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#EC4899',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#EC4899',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
    zIndex: 52,
  },
});

const oobStyles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 8,
  },
  bannerText: {
    flex: 1,
    fontSize: 13,
    color: '#92400E',
  },
  bannerCount: {
    fontWeight: '700',
  },
  bannerAction: {
    fontSize: 13,
    fontWeight: '600',
    color: '#92400E',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: radii.sm,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  studentName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeInstructor: {
    backgroundColor: '#FEF3C7',
  },
  badgeVehicle: {
    backgroundColor: '#DBEAFE',
  },
  badgeBoth: {
    backgroundColor: '#FCE7F3',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  badgeTextInstructor: {
    color: '#92400E',
  },
  badgeTextVehicle: {
    color: '#1E40AF',
  },
  badgeTextBoth: {
    color: '#9D174D',
  },
  cardTime: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 2,
  },
  cardMeta: {
    fontSize: 12,
    color: '#94A3B8',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: spacing.sm,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  actionBtnDanger: {
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  actionBtnDangerText: {
    color: '#DC2626',
  },
  actionBtnPrimary: {
    borderColor: '#EC4899',
    backgroundColor: '#EC4899',
  },
  actionBtnPrimaryText: {
    color: '#FFFFFF',
  },
  emptyText: {
    textAlign: 'center',
    color: '#94A3B8',
    fontSize: 14,
    paddingVertical: 32,
  },
});
