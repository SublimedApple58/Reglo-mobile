import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  ActionSheetIOS,
  ActivityIndicator,
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
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Extrapolation,
  useAnimatedScrollHandler,
  FadeInLeft,
  FadeInRight,
  FadeOutLeft,
  FadeOutRight,
  Layout,
} from 'react-native-reanimated';
import { StatusBar } from 'expo-status-bar';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '../components/Screen';
import { Badge } from '../components/Badge';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { NativePageSheet } from '../components/NativePageSheet';
import { manageLessonStore, type ManageLessonData, type ManageLessonDetailsPayload, type ManageLessonVehicle } from '../stores/manageLessonStore';
import { swapStore } from '../stores/swapStore';
import { rescheduleStore } from '../stores/rescheduleStore';
import { Input } from '../components/Input';
import { CalendarDrawer } from '../components/CalendarDrawer';
import { dayPickerStore } from '../stores/dayPickerStore';
import { homeAddSheetStore } from '../stores/homeAddSheetStore';
import { bookingSheetStore } from '../stores/bookingSheetStore';
import { blockSheetStore } from '../stores/blockSheetStore';
import { sickLeaveSheetStore } from '../stores/sickLeaveSheetStore';
import { examSheetStore } from '../stores/examSheetStore';
import { groupLessonSheetStore } from '../stores/groupLessonSheetStore';
import { outOfAvailStore } from '../stores/outOfAvailStore';
import { BookableBand, ScrubBubble } from '../components/BookableBand';
import { InlineLocationPicker } from '../components/InlineLocationPicker';
import { InlineLocationForm } from '../components/InlineLocationForm';
import { CalendarNavigatorRange } from '../components/CalendarNavigator';
import { SelectableChip } from '../components/SelectableChip';
import { WeeklyOverview } from '../components/WeeklyOverview';
import { WeeklyLiveCard } from '../components/WeeklyLiveCard';
import WeeklyAgendaView from '../components/WeeklyAgendaView';
import { computeDayPlan, BOOK_DAY_START, BOOK_DAY_END } from '../utils/weeklyAgenda';
import { dayDetailStore } from '../stores/dayDetailStore';
import { examManageStore } from '../stores/examManageStore';
import { groupLessonManageStore } from '../stores/groupLessonManageStore';
import { sessionStorage } from '../services/sessionStorage';
import { StarRating } from '../components/StarRating';
import { SkeletonBlock, SkeletonCard } from '../components/Skeleton';
import { ToastNotice, ToastTone } from '../components/ToastNotice';
import { regloApi } from '../services/regloApi';
import {
  AutoscuolaAppointmentWithRelations,
  AutoscuolaInstructor,
  AutoscuolaLocation,
  AutoscuolaSettings,
  AutoscuolaVehicle,
  InstructorBlock,
  InstructorBookingSuggestion,
  OutOfAvailabilityAppointment,
} from '../types/regloApi';
import { useNavigation } from '@react-navigation/native';
import { colors, radii, spacing, typography } from '../theme';
import { formatDay, formatTime } from '../utils/date';
import { useSession } from '../context/SessionContext';
import { useAutoscuolaSettings } from '../hooks/queries/useAutoscuolaSettings';
import { useInstructorSettings } from '../hooks/queries/useInstructorSettings';
import { useAgendaBootstrap } from '../hooks/queries/useAgendaBootstrap';
import { useHolidays } from '../hooks/queries/useHolidays';
import { queryKeys, STALE_TIMES } from '../hooks/queries/queryKeys';

type InstructorActionStatus = 'checked_in' | 'no_show';
type DrawerAction = InstructorActionStatus | 'save_details';
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
const VISIBLE_LESSON_STATUSES = new Set(['scheduled', 'confirmed', 'checked_in', 'pending_review', 'proposal', 'completed', 'no_show']);
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
  // Terminal statuses take priority over time-window checks
  if (status === 'completed') {
    return { label: 'Completata', tone: 'confirmed' as const };
  }
  if (status === 'no_show') {
    return { label: 'Assente', tone: 'pending_review' as const };
  }
  if (status === 'cancelled') {
    return { label: 'Annullata', tone: 'pending_review' as const };
  }
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

const isDetailsEditable = (lesson: AutoscuolaAppointmentWithRelations, _now: Date) => {
  const status = normalizeStatus(lesson.status);
  if (!DETAILS_EDITABLE_STATUSES.has(status)) return false;
  if (status === 'cancelled') return false;
  // Tipo guida / valutazione / note restano modificabili anche sulle guide già
  // concluse (completed / no_show / checked_in), senza limite temporale: una
  // valutazione o una nota si possono aggiungere/correggere a posteriori.
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

const pickFeaturedLesson = (
  source: AutoscuolaAppointmentWithRelations[],
  now: Date,
) => {
  const active = source.filter((item) => VISIBLE_LESSON_STATUSES.has(normalizeStatus(item.status)));
  const terminalStatuses = new Set(['completed', 'no_show', 'cancelled']);
  const inProgress = [...active]
    .filter((item) => !terminalStatuses.has(normalizeStatus(item.status)) && isLessonInProgressWindow(item, now))
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

/* ── Inline Calendar Picker (no Modal, renders inside BottomSheet) ── */
const CAL_MONTHS = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
const CAL_WEEKDAYS = ['LUN','MAR','MER','GIO','VEN','SAB','DOM'];
const CAL_CELL = 44;
const calFirstOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const calMondayBefore = (d: Date) => { const r = new Date(d); const day = r.getDay(); r.setDate(r.getDate() - (day === 0 ? 6 : day - 1)); return r; };
const calSameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const calSameMonth = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();


/* ── Inline Time Picker (no Modal, renders inside BottomSheet) ── */
const TP_HOURS = Array.from({ length: 24 }, (_, i) => i);
const TP_MINUTES = [0, 15, 30, 45];
const TP_ITEM_H = 48;
const TP_COL_H = 250;
const tpPad = (n: number) => String(n).padStart(2, '0');

const InlineTimePicker = ({ selectedTime, onSelectTime, loading }: {
  selectedTime: Date;
  onSelectTime: (date: Date) => void;
  loading?: boolean;
}) => {
  const [hour, setHour] = useState(() => selectedTime.getHours());
  const [minute, setMinute] = useState(() => {
    const m = selectedTime.getMinutes();
    return TP_MINUTES.reduce((p, c) => Math.abs(c - m) < Math.abs(p - m) ? c : p);
  });
  const hourRef = useRef<ScrollView | null>(null);
  const minRef = useRef<ScrollView | null>(null);

  useEffect(() => {
    setTimeout(() => {
      hourRef.current?.scrollTo({ y: Math.max(0, TP_HOURS.indexOf(hour) * TP_ITEM_H - TP_COL_H / 2 + TP_ITEM_H / 2), animated: false });
      minRef.current?.scrollTo({ y: Math.max(0, TP_MINUTES.indexOf(minute) * TP_ITEM_H - TP_COL_H / 2 + TP_ITEM_H / 2), animated: false });
    }, 50);
  }, []);

  return (
    <View style={{ paddingVertical: 4 }}>
      <View style={{ flexDirection: 'row', gap: spacing.md, justifyContent: 'center' }}>
        {/* Hours column */}
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: '#94A3B8', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8 }}>Ore</Text>
          <View style={{ height: TP_COL_H, width: '100%', borderRadius: 16, backgroundColor: '#F8FAFC', overflow: 'hidden' }}>
            <ScrollView ref={hourRef} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 8, alignItems: 'center' }}>
              {TP_HOURS.map((h) => {
                const sel = h === hour;
                return (
                  <Pressable key={h} onPress={() => setHour(h)} style={[
                    { height: TP_ITEM_H, width: '80%', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
                    sel && { backgroundColor: '#FACC15' },
                  ]}>
                    <Text style={[{ fontSize: 18, fontWeight: '500', color: '#64748B' }, sel && { fontWeight: '700', color: '#92400E' }]}>{tpPad(h)}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
        {/* Minutes column */}
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: '#94A3B8', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8 }}>Minuti</Text>
          <View style={{ height: TP_COL_H, width: '100%', borderRadius: 16, backgroundColor: '#F8FAFC', overflow: 'hidden' }}>
            <ScrollView ref={minRef} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 8, alignItems: 'center' }}>
              {TP_MINUTES.map((m) => {
                const sel = m === minute;
                return (
                  <Pressable key={m} onPress={() => setMinute(m)} style={[
                    { height: TP_ITEM_H, width: '80%', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
                    sel && { backgroundColor: '#FACC15' },
                  ]}>
                    <Text style={[{ fontSize: 18, fontWeight: '500', color: '#64748B' }, sel && { fontWeight: '700', color: '#92400E' }]}>{tpPad(m)}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </View>
      <View style={{ alignItems: 'center', paddingTop: spacing.sm, paddingBottom: spacing.xs, gap: 4 }}>
        <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: '#EEF0F4', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="time-outline" size={44} color="#1A1A2E" />
        </View>
        <Text style={{ fontSize: 14, color: '#94A3B8', marginTop: 8 }}>Scegli l'ora della guida</Text>
      </View>
      {/* Confirm CTA */}
      <Pressable
        disabled={loading}
        onPress={() => {
          const result = new Date(selectedTime);
          result.setHours(hour, minute, 0, 0);
          onSelectTime(result);
        }}
        style={({ pressed }) => [
          { backgroundColor: '#1A1A2E', borderRadius: radii.sm, minHeight: 52, alignItems: 'center', justifyContent: 'center',
            shadowColor: '#1A1A2E', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 5 },
          pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
          loading && { opacity: 0.6 },
        ]}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#FFFFFF' }}>
            Conferma {tpPad(hour)}:{tpPad(minute)}
          </Text>
        )}
      </Pressable>
    </View>
  );
};

export const IstruttoreHomeScreen = ({ ownerMode = false }: { ownerMode?: boolean } = {}) => {
  const router = useRouter();
  const { instructorId, user, autoscuolaRole, activeCompanyId } = useSession();
  const { height: windowHeight, width: screenWidth } = useWindowDimensions();
  const safeInsets = useSafeAreaInsets();
  // Owner (titolare puro, senza instructorId) vede la stessa home dell'istruttore
  // ma in SOLA LETTURA e con scope fisso "tutti gli istruttori": niente FAB,
  // niente prenotazione/band, niente azioni mutanti sulle guide.
  const canSwitchScope = !ownerMode && autoscuolaRole === 'INSTRUCTOR_OWNER';
  const [calendarScope, setCalendarScope] = useState<'personal' | 'all'>(ownerMode ? 'all' : 'personal');
  const effectiveInstructorId = ownerMode || calendarScope === 'all' ? undefined : instructorId;
  const [appointments, setAppointments] = useState<AutoscuolaAppointmentWithRelations[]>([]);
  const [featuredAppointments, setFeaturedAppointments] = useState<
    AutoscuolaAppointmentWithRelations[]
  >([]);
  const [students, setStudents] = useState<Array<{ id: string; firstName: string; lastName: string; phone?: string | null; assignedInstructorId?: string | null }>>([]);
  const [vehicles, setVehicles] = useState<Array<{ id: string; name: string; assignedInstructorId?: string | null; licenseCategory?: string | null; transmission?: string | null }>>([]);
  const [settings, setSettings] = useState<AutoscuolaSettings | null>(null);
  const [studentCompletedMinutes, setStudentCompletedMinutes] = useState<Record<string, number>>({});
  const [calendarRange, setCalendarRange] = useState<CalendarNavigatorRange | null>(null);
  // Fetch window, DECOUPLED from the displayed day. loadData fetches this whole
  // window in one bootstrap call; the timeline then filters it client-side to
  // `selectedDate`. Selecting another day inside the window costs zero network
  // and shows no skeleton (data is already loaded). The window only recenters
  // when selectedDate approaches an edge → effectively prefetches neighbours.
  const [loadRange, setLoadRange] = useState<{ from: string; to: string }>(() => {
    const from = new Date();
    from.setDate(from.getDate() - 7);
    from.setHours(0, 0, 0, 0);
    const to = new Date();
    // Baseline forward reach before settings load (recentered to the real
    // booking horizon below, once availabilityWeeks is known). +21 was shorter
    // than the booking horizon, so a lesson booked ~3+ weeks out (e.g. July) fell
    // outside the window and vanished after booking. 35d is a safe floor.
    to.setDate(to.getDate() + 35);
    to.setHours(23, 59, 59, 999);
    return { from: from.toISOString(), to: to.toISOString() };
  });
  const [clockTick, setClockTick] = useState(() => Date.now());
  const [initialLoading, setInitialLoading] = useState(true);
  const [rangeLoading, setRangeLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; tone: ToastTone } | null>(null);
  // Ghost-block CTA visible in the weekly grid → hide the FAB underneath it.
  const [ghostCtaActive, setGhostCtaActive] = useState(false);
  const [sheetLesson, setSheetLesson] = useState<AutoscuolaAppointmentWithRelations | null>(null);
  const [sheetStudentProgress, setSheetStudentProgress] = useState<{ completed: number; required: number } | null>(null);
  const [swapModalOpen, setSwapModalOpen] = useState(false);
  const [swapPending, setSwapPending] = useState(false);
  const [swapSearch, setSwapSearch] = useState('');
  const [swapSourceLesson, setSwapSourceLesson] = useState<AutoscuolaAppointmentWithRelations | null>(null);
  const [rescheduleLesson, setRescheduleLesson] = useState<AutoscuolaAppointmentWithRelations | null>(null);
  const pendingRescheduleRef = useRef<AutoscuolaAppointmentWithRelations | null>(null);
  const [clusterDrawerAppts, setClusterDrawerAppts] = useState<AutoscuolaAppointmentWithRelations[] | null>(null);
  const [sheetScrollAtBottom, setSheetScrollAtBottom] = useState(false);
  const [sheetScrollAtTop, setSheetScrollAtTop] = useState(true);
  const [selectedLessonTypes, setSelectedLessonTypes] = useState<string[]>([]);
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [lessonNotes, setLessonNotes] = useState('');
  const [pendingAction, setPendingAction] = useState<DrawerAction | null>(null);
  const [instructorBlocks, setInstructorBlocks] = useState<InstructorBlock[]>([]);
  // "Blocca slot" + "Malattia" now live as standalone modal routes
  // (app/(tabs)/home/block-slot.tsx, sick-leave.tsx) driven by their own stores.
  const [defaultLocation, setDefaultLocation] = useState<AutoscuolaLocation | null>(null);
  // Load company default sede once (used to pre-populate Luogo field)
  useEffect(() => {
    let cancelled = false;
    regloApi
      .getLocations()
      .then((list) => {
        if (cancelled) return;
        const def = list?.find((l) => l.isDefault) ?? null;
        setDefaultLocation(def);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  // ── Multi-booking state ──
  type MultiBookingEntry = { id: string; date: Date; startTime: Date; duration: number };
  const [latestStudentLessonNote, setLatestStudentLessonNote] = useState<{
    startsAt: string;
    note: string;
  } | null>(null);
  const [studentNotesMap, setStudentNotesMap] = useState<Record<string, string | null>>({});
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const rangeKeyRef = useRef<string | null>(null);
  const loadRequestRef = useRef(0);
  const lessonSheetScrollRef = useRef<ScrollView | null>(null);
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [agendaViewMode, setAgendaViewMode] = useState<'day' | 'week' | 'grid'>('day');
  const [calendarDrawerOpen, setCalendarDrawerOpen] = useState(false);
  const [lessonSheetMode, setLessonSheetMode] = useState<'view' | 'locationPicker' | 'locationForm' | 'instructorPicker'>('view');
  // Instructor reassignment state for the "Modifica guida" sheet.
  // `selectedInstructorId` mirrors the sheetLesson's current instructor and
  // is only different when the user has staged a change. The availability
  // state shows live verification feedback for the staged choice.
  const [selectedInstructorId, setSelectedInstructorId] = useState<string | null>(null);
  const [instructorAvailability, setInstructorAvailability] = useState<
    | { status: 'idle' }
    | { status: 'checking' }
    | { status: 'available' }
    | { status: 'unavailable'; detail: string }
    | { status: 'error'; detail: string }
  >({ status: 'idle' });
  const [instructorList, setInstructorList] = useState<AutoscuolaInstructor[]>([]);
  const [instructorListLoading, setInstructorListLoading] = useState(false);
  const [availableHours, setAvailableHours] = useState<Set<number>>(new Set());
  const [availabilitySlots, setAvailabilitySlots] = useState<Array<{ startMinutes: number; endMinutes: number }>>([]);
  // Per-day availability cache (day view): seed instantly on day change so a
  // revisited day is stable (no stale-previous-day flash, no reload glitch).
  const availabilityCacheRef = useRef<Map<string, { hours: Set<number>; slots: Array<{ startMinutes: number; endMinutes: number }> }>>(new Map());
  const latestAvailKeyRef = useRef<string>('');
  // Keyed by YYYY-MM-DD. Loaded for a 3-week window (prev/current/next) so the
  // weekly pager can swipe to adjacent weeks with availability already present.
  const [weekAvailability, setWeekAvailability] = useState<Record<string, Array<{ startMinutes: number; endMinutes: number }>>>({});
  const [outOfAvailAppointments, setOutOfAvailAppointments] = useState<OutOfAvailabilityAppointment[]>([]);
  const [holidays, setHolidays] = useState<Set<string>>(new Set());
  const [instructorAutonomousMode, setInstructorAutonomousMode] = useState(false);
  const [clusterDurations, setClusterDurations] = useState<number[] | null>(null);
  const [emergencyAllStudents, setEmergencyAllStudents] = useState(false);
  const [myStudentsExpanded, setMyStudentsExpanded] = useState(false);
  const dayScrollRef = useRef<ScrollView | null>(null);
  const queryClient = useQueryClient();
  // Cross-fade applied to the day timeline when a background (stale-while-
  // revalidate) refresh swaps in fresh BE data over an already-painted day.
  const timelineFadeSV = useSharedValue(1);
  const timelineFadeStyle = useAnimatedStyle(() => ({ opacity: timelineFadeSV.value }));

  // ── Query hooks for cold-start cache hydration ──
  const bootstrapParams = useMemo(() => {
    if (!instructorId && !ownerMode) return null;
    return {
      ...(effectiveInstructorId ? { instructorId: effectiveInstructorId } : {}),
      from: loadRange.from,
      to: loadRange.to,
      limit: 400,
    };
  }, [instructorId, ownerMode, loadRange, effectiveInstructorId]);

  const bootstrapCached = useAgendaBootstrap(bootstrapParams);
  const settingsCached = useAutoscuolaSettings();
  const instructorSettingsCached = useInstructorSettings();
  const holidayParams = useMemo(() => {
    const today = new Date();
    const from = addDays(today, -14);
    const to = addDays(today, 52 * 7);
    return { from: from.toISOString(), to: to.toISOString() };
  }, []);
  const holidaysCached = useHolidays(holidayParams);

  // Hydrate state from cache on cold start (before loadData runs)
  const hydratedFromCache = useRef(false);
  useEffect(() => {
    if (hydratedFromCache.current) return;
    const bootstrap = bootstrapCached.data;
    const settingsData = settingsCached.data;
    if (!bootstrap || !settingsData) return;
    hydratedFromCache.current = true;

    setSettings(settingsData);
    setStudents(bootstrap.students);
    setVehicles(bootstrap.vehicles ?? []);
    const notCancelled = (item: { status?: string | null }) => (item.status ?? '').toLowerCase() !== 'cancelled';
    const matchesScope = (item: { instructorId?: string | null }) =>
      effectiveInstructorId ? item.instructorId === effectiveInstructorId : true;
    const freshBlocks = (bootstrap.instructorBlocks ?? []).filter(
      (b) => effectiveInstructorId ? b.instructorId === effectiveInstructorId : true,
    );
    setInstructorBlocks(freshBlocks);
    setAppointments(
      dedupeAppointments(bootstrap.appointments.filter((item) => matchesScope(item) && notCancelled(item)))
    );
    setInitialLoading(false);
    setRangeLoading(false);

    // Hydrate holidays from cache
    if (holidaysCached.data) {
      const set = new Set<string>();
      for (const h of holidaysCached.data) {
        const d = new Date(h.date);
        set.add(toDateOnlyString(d));
      }
      setHolidays(set);
    }

    // Hydrate cluster settings
    const cs = instructorSettingsCached.data;
    if (cs) {
      const currentInstructor = bootstrap.instructors?.find((inst) => inst.id === instructorId);
      const isAutonomous = currentInstructor?.autonomousMode ?? false;
      setInstructorAutonomousMode(isAutonomous);
      if (isAutonomous && cs.settings?.bookingSlotDurations?.length) {
        setClusterDurations(cs.settings.bookingSlotDurations);
      }
    }
  }, [bootstrapCached.data, settingsCached.data, instructorSettingsCached.data, holidaysCached.data, effectiveInstructorId, instructorId]);


  const loadData = useCallback(async (opts?: { force?: boolean }): Promise<AutoscuolaAppointmentWithRelations[]> => {
    if (!instructorId && !ownerMode) return [];
    // force=true (default) bypasses the TanStack cache (staleTime 0) so callers
    // after a mutation / pull-to-refresh always hit the network. The initial
    // mount load and the focus listener pass force=false: if the TanStack cache
    // (already hydrated on cold start) is still fresh, fetchQuery returns it
    // without a network round-trip, killing the cold-start double-fetch.
    const force = opts?.force ?? true;
    const requestId = ++loadRequestRef.current;
    setError(null);
    let shouldShowRangeSkeleton = false;
    try {
      // Fetch the whole rolling window (decoupled from the displayed day).
      const from = new Date(loadRange.from);
      const to = new Date(loadRange.to);
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

      // Bootstrap params MUST match useAgendaBootstrap's bootstrapParams exactly
      // so fetchQuery shares the same cache entry (dedup with the hydration hook).
      const bootstrapParams = {
        ...(effectiveInstructorId ? { instructorId: effectiveInstructorId } : {}),
        from: from.toISOString(),
        to: to.toISOString(),
        limit: 400,
      };
      const [
        agendaBootstrap,
        featuredAppointmentsResponse,
        settingsResponse,
        wideSickBlocks,
        clusterSettingsResponse,
      ] =
        await Promise.all([
          // Routed through TanStack: force ⇒ staleTime 0 (always network);
          // otherwise reuse the fresh cache shared with useAgendaBootstrap.
          queryClient.fetchQuery({
            queryKey: queryKeys.agendaBootstrap(activeCompanyId, bootstrapParams),
            queryFn: () => regloApi.getAgendaBootstrap(bootstrapParams),
            staleTime: force ? 0 : STALE_TIMES.agendaBootstrap,
          }),
          regloApi.getAppointments({
            ...(effectiveInstructorId ? { instructorId: effectiveInstructorId } : {}),
            from: featuredFrom.toISOString(),
            to: featuredTo.toISOString(),
            limit: 220,
            light: true,
          }),
          queryClient.fetchQuery({
            queryKey: queryKeys.autoscuolaSettings(activeCompanyId),
            queryFn: () => regloApi.getAutoscuolaSettings(),
            staleTime: force ? 0 : STALE_TIMES.settings,
          }),
          // Lightweight fetch of sick_leave blocks over wide range for calendar dots.
          // Owner (no instructorId) → omit it so the API returns all instructors'.
          regloApi.getInstructorBlocks({
            ...(effectiveInstructorId
              ? { instructorId: effectiveInstructorId }
              : instructorId
                ? { instructorId }
                : {}),
            from: featuredFrom.toISOString(),
            to: featuredTo.toISOString(),
            reason: 'sick_leave',
          }),
          queryClient
            .fetchQuery({
              queryKey: queryKeys.instructorSettings(activeCompanyId),
              queryFn: () => regloApi.getInstructorSettings(),
              staleTime: force ? 0 : STALE_TIMES.instructorSettings,
            })
            .catch(() => null),
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
      const isAutonomous = currentInstructor?.autonomousMode ?? false;
      setInstructorAutonomousMode(isAutonomous);
      // Use cluster durations only if instructor is in autonomous mode
      if (isAutonomous && clusterSettingsResponse?.settings?.bookingSlotDurations?.length) {
        setClusterDurations(clusterSettingsResponse.settings.bookingSlotDurations);
      } else {
        setClusterDurations(null);
      }
      const freshBlocks = (agendaBootstrap.instructorBlocks ?? []).filter(
        (b) => effectiveInstructorId ? b.instructorId === effectiveInstructorId : true,
      );
      // Merge wide-range sick_leave blocks with current-range blocks
      const mergedBlocks = [...freshBlocks];
      for (const sb of wideSickBlocks) {
        if (!mergedBlocks.some((b) => b.id === sb.id)) {
          mergedBlocks.push(sb);
        }
      }
      setInstructorBlocks(mergedBlocks);
      const notCancelled = (item: { status?: string | null }) => (item.status ?? '').toLowerCase() !== 'cancelled';
      const matchesScope = (item: { instructorId?: string | null }) =>
        effectiveInstructorId ? item.instructorId === effectiveInstructorId : true;
      const nextAppointments = dedupeAppointments(
        agendaBootstrap.appointments.filter((item) => matchesScope(item) && notCancelled(item)),
      );
      const nextFeaturedAppointments = dedupeAppointments(
        featuredAppointmentsResponse.filter((item) => matchesScope(item) && notCancelled(item)),
      );
      const mergedAppointments = nextAppointments;
      setAppointments(mergedAppointments);
      setFeaturedAppointments(nextFeaturedAppointments);
      // Background revalidation over an already-painted window → gentle cross-fade
      // to the fresh data (not on a brand-new window load, which shows a skeleton).
      if (!shouldShowRangeSkeleton) {
        timelineFadeSV.value = 0.5;
        timelineFadeSV.value = withTiming(1, { duration: 220 });
      }
      return mergedAppointments;
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
  }, [loadRange, instructorId, ownerMode, effectiveInstructorId, queryClient, activeCompanyId]);

  const loadOutOfAvailability = useCallback(async () => {
    if (!instructorId && !ownerMode) return;
    try {
      // Owner → no instructorId, so the API returns all instructors' OOB guide.
      const data = await regloApi.getOutOfAvailabilityAppointments(instructorId ?? undefined);
      setOutOfAvailAppointments(Array.isArray(data) ? data : []);
    } catch {
      // silent
    }
  }, [instructorId, ownerMode]);

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

  useEffect(() => {
    // Initial load: reuse the fresh TanStack cache when present (no double
    // fetch on cold start) and fire out-of-availability in parallel rather
    // than chaining it behind loadData.
    loadData({ force: false });
    loadOutOfAvailability();
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
    !ownerMode && (bookingActors === 'instructors' || bookingActors === 'both');
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
    const toOption = (student: typeof students[number], offCluster: boolean) => ({
      value: student.id,
      label: `${student.firstName} ${student.lastName}`.trim(),
      subtitle: offCluster ? 'Non assegnato a te' : (null as string | null),
    });
    if (!clustersActive) {
      // No cluster lock \u2014 all students are equivalent
      return students.map((s) => toOption(s, false));
    }
    // Clusters active: own students first, then others (marked)
    return [
      ...assignedStudents.map((s) => toOption(s, false)),
      ...unassignedStudents.map((s) => toOption(s, true)),
    ];
  }, [students, assignedStudents, unassignedStudents, clustersActive]);
  // SWR: only a true loading state when nothing is loaded yet. Background window
  // refreshes keep the (week) grid painted instead of flashing a loader.
  const appointmentsLoading = (initialLoading || rangeLoading) && appointments.length === 0;

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

  // Open the native exam-management page sheet (seed-and-callback).
  const openExamManage = useCallback(
    (g: {
      startsAt: string;
      endsAt: string | null;
      instructorId: string | null;
      instructorName: string | null;
      notes: string | null;
      appointments: AutoscuolaAppointmentWithRelations[];
    }) => {
      examManageStore.set({ ...g, readOnly: ownerMode, onChanged: () => { loadData(); } });
      router.push('/(tabs)/home/exam-manage');
    },
    [loadData, router, ownerMode],
  );

  // Manage an existing group lesson: open the dedicated "Gestisci guida di
  // gruppo" page sheet (roster, instructor/vehicle, sposta, annulla). Loads the
  // instructor + vehicle lists for the in-modal pickers, then seeds the store.
  const openGroupLessonManage = useCallback(
    (groupLessonId: string) => {
      const vehiclesEnabled = settings?.vehiclesEnabled !== false;
      // Open the sheet IMMEDIATELY. Previously this awaited getInstructors +
      // getVehicles BEFORE pushing, so the group-lesson sheet lagged noticeably
      // vs the normal "Gestisci guida" (which opens from local data). Seed with
      // empty picker lists and push now; the lists fill in a beat later from a
      // background fetch (the screen reads them reactively from the store).
      groupLessonManageStore.set({
        groupLessonId,
        instructors: [],
        vehicles: [],
        vehiclesEnabled,
        readOnly: ownerMode,
        onChanged: () => { loadData(); },
      });
      router.push('/(tabs)/home/manage-group-lesson');
      void (async () => {
        const [instructorsRes, vehiclesRes] = await Promise.all([
          regloApi.getInstructors().catch(() => [] as AutoscuolaInstructor[]),
          vehiclesEnabled
            ? regloApi.getVehicles().catch(() => [] as AutoscuolaVehicle[])
            : Promise.resolve([] as AutoscuolaVehicle[]),
        ]);
        const cur = groupLessonManageStore.get();
        if (cur?.groupLessonId !== groupLessonId) return; // sheet closed/changed
        groupLessonManageStore.set({
          ...cur,
          instructors: (instructorsRes ?? []).filter((i) => i.status !== 'inactive'),
          vehicles: (vehiclesRes ?? []).filter((v) => v.status === 'active'),
        });
      })();
    },
    [loadData, router, settings?.vehiclesEnabled, ownerMode],
  );

  const openCreateGroupLesson = useCallback(() => {
    groupLessonSheetStore.set({
      initialDate: selectedDate.toISOString(),
      onDone: (message) => { setToast({ text: message, tone: 'success' }); },
    });
    router.push('/(tabs)/home/create-group-lesson');
  }, [selectedDate, router]);






  const featuredLesson = useMemo(
    () => pickFeaturedLesson(featuredAppointments, now),
    [featuredAppointments, now],
  );
  // `appointments` now holds the whole fetch window; the day grid renders only
  // the selected day. Filtering here (instead of refetching per day) is what
  // makes day-to-day navigation instant with no skeleton.
  const dayAppointments = useMemo(
    () => appointments.filter((appt) => isSameDay(selectedDate, appt.startsAt)),
    [appointments, selectedDate],
  );
  const HOUR_SLOTS = useMemo(() => {
    const DEFAULT_START = 7;
    // END is the last visible hour-slot label. The grid extends through 24:00
    // so events/blocks ending up to midnight are fully visible.
    const END = 24;
    let earliest = DEFAULT_START;
    // Check availability
    for (const h of availableHours) {
      if (h < earliest) earliest = h;
    }
    // Check appointments (skip timeless exams — they render as banners, not in the grid)
    for (const appt of dayAppointments) {
      if (appt.type === 'esame' && !appt.endsAt) continue;
      const h = new Date(appt.startsAt).getHours();
      if (normalizeStatus(appt.status) !== 'cancelled' && h < earliest) earliest = h;
    }
    // Also extend earliest backwards for instructor blocks on this day (e.g. 06:00).
    for (const block of instructorBlocks) {
      if (!isSameDay(selectedDate, block.startsAt)) continue;
      const h = new Date(block.startsAt).getHours();
      if (h < earliest) earliest = h;
    }
    return Array.from({ length: END - earliest + 1 }, (_, i) => i + earliest);
  }, [availableHours, dayAppointments, instructorBlocks, selectedDate]);

  // Raw (non-grouped) list — used for counts, stats, etc.
  const timelineAppointments = useMemo(() => {
    return [...dayAppointments].sort((a, b) => getStartsAtTs(a) - getStartsAtTs(b));
  }, [dayAppointments]);

  // Timeline items: exams grouped by time; other appointments as-is
  const timelineItems = useMemo(() => {
    const GROUP_LESSON_CAPACITY = 3; // fallback when the BE annotation is missing
    const exams: AutoscuolaAppointmentWithRelations[] = [];
    const groupLessonAppts: AutoscuolaAppointmentWithRelations[] = [];
    const others: AutoscuolaAppointmentWithRelations[] = [];
    for (const appt of timelineAppointments) {
      if (appt.type === 'esame') exams.push(appt);
      else if (appt.type === 'group_lesson') groupLessonAppts.push(appt);
      else others.push(appt);
    }
    const groupMap = new Map<string, AutoscuolaAppointmentWithRelations[]>();
    for (const e of exams) {
      const key = `${e.startsAt}|${e.endsAt ?? ''}|${e.instructorId ?? ''}`;
      const list = groupMap.get(key) ?? [];
      list.push(e);
      groupMap.set(key, list);
    }
    // Collapse group-lesson participant appointments into ONE card per lesson.
    const glMap = new Map<string, AutoscuolaAppointmentWithRelations[]>();
    for (const a of groupLessonAppts) {
      const key = a.groupLessonId ?? `${a.startsAt}|${a.endsAt ?? ''}|${a.instructorId ?? ''}`;
      const list = glMap.get(key) ?? [];
      list.push(a);
      glMap.set(key, list);
    }
    type Item =
      | { kind: 'appointment'; appointment: AutoscuolaAppointmentWithRelations; sortKey: number }
      | { kind: 'examGroup'; id: string; startsAt: string; endsAt: string | null; instructorId: string | null; instructorName: string | null; notes: string | null; appointments: AutoscuolaAppointmentWithRelations[]; sortKey: number }
      | { kind: 'groupLesson'; id: string; groupLessonId: string | null; startsAt: string; endsAt: string | null; vehicleName: string | null; count: number; capacity: number; appointments: AutoscuolaAppointmentWithRelations[]; sortKey: number };
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
    for (const [key, appts] of glMap) {
      const first = appts[0];
      // Synthetic empty-lesson rows (id `gl-empty:`) represent 0 participants.
      const filled = appts.filter((a) => !String(a.id).startsWith('gl-empty:')).length;
      items.push({
        kind: 'groupLesson',
        id: `gl-${key}`,
        groupLessonId: first.groupLessonId ?? null,
        startsAt: first.startsAt,
        endsAt: first.endsAt,
        vehicleName: first.vehicle?.name ?? null,
        count: filled,
        capacity: first.groupLessonCapacity ?? GROUP_LESSON_CAPACITY,
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
    // Owner vede TUTTI gli istruttori: la malattia di uno non blocca la giornata
    // (gli altri lavorano). Niente overlay "in malattia" a tutta pagina.
    if (ownerMode) return null;
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
  }, [instructorBlocks, selectedDate, sickLeaveDateKeys, ownerMode]);

  const hasTimelineAppointments = timelineAppointments.length > 0 || blocksByHour.size > 0;
  // Show the day skeleton ONLY while the initial window load is still empty
  // (nothing fetched yet) — same rule as the week/grid views (`appointmentsLoading`).
  // Gating on the per-day `!hasTimelineAppointments` was wrong: once the window
  // is loaded, an EMPTY day (today/past with no guide) would stay stuck on an
  // infinite skeleton, while days that happen to have a guide painted fine.
  const dayGridLoading = (initialLoading || rangeLoading) && appointments.length === 0;

  const ROW_H = 80;

  // Cluster overlapping appointments into groups (for "all instructors" view)
  type TimelineClusterItem =
    | { kind: 'single'; item: (typeof timelineItems)[number] }
    | { kind: 'cluster'; items: (typeof timelineItems)[number][]; startMin: number; endMin: number };

  const timelineClusters = useMemo((): TimelineClusterItem[] => {
    if (calendarScope !== 'all' || timelineItems.length <= 1) {
      return timelineItems.map((item) => ({ kind: 'single' as const, item }));
    }

    // Build spans with start/end in minutes
    type Span = { idx: number; startMin: number; endMin: number };
    const spans: Span[] = timelineItems.map((item, idx) => {
      const start = new Date(item.kind === 'appointment' ? item.appointment.startsAt : item.startsAt);
      const startMin = start.getHours() * 60 + start.getMinutes();
      const endIso = item.kind === 'appointment' ? item.appointment.endsAt : item.endsAt;
      const endTs = endIso ? new Date(endIso).getTime() : start.getTime() + 60 * 60 * 1000;
      const endMin = startMin + (endTs - start.getTime()) / (60 * 1000);
      return { idx, startMin, endMin };
    });
    spans.sort((a, b) => a.startMin - b.startMin);

    // Merge overlapping spans into groups
    const groups: Span[][] = [];
    let current: Span[] = [spans[0]];
    let groupEnd = spans[0].endMin;
    for (let i = 1; i < spans.length; i++) {
      if (spans[i].startMin < groupEnd) {
        current.push(spans[i]);
        groupEnd = Math.max(groupEnd, spans[i].endMin);
      } else {
        groups.push(current);
        current = [spans[i]];
        groupEnd = spans[i].endMin;
      }
    }
    groups.push(current);

    return groups.map((group): TimelineClusterItem => {
      if (group.length === 1) {
        return { kind: 'single', item: timelineItems[group[0].idx] };
      }
      return {
        kind: 'cluster',
        items: group.map((s) => timelineItems[s.idx]),
        startMin: Math.min(...group.map((s) => s.startMin)),
        endMin: Math.max(...group.map((s) => s.endMin)),
      };
    });
  }, [timelineItems, calendarScope]);

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
    // Group lesson: teal theme (mirrors the agenda card accent).
    if (type === 'group_lesson' && s !== 'cancelled' && s !== 'no_show') {
      return { border: '#10B981', badgeBg: '#D1FAE5', badgeText: '#047857', label: 'GRUPPO', isExam: false as const };
    }
    if (s === 'pending_review')
      return { border: '#F97316', badgeBg: '#FFF7ED', badgeText: '#EA580C', label: 'Da confermare', isExam: false as const };
    if (s === 'checked_in')
      return { border: '#1A1A2E', badgeBg: '#EEF0F4', badgeText: '#1A1A2E', label: 'In corso', isExam: false as const };
    if (s === 'completed')
      return { border: '#22C55E', badgeBg: '#F0FDF4', badgeText: '#16A34A', label: 'Completata', isExam: false as const };
    if (s === 'no_show' || s === 'cancelled')
      return { border: '#94A3B8', badgeBg: '#F1F5F9', badgeText: '#64748B', label: s === 'no_show' ? 'Assente' : 'Annullata', isExam: false as const };
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
    // Group-lesson seats are not managed via the normal "Gestisci guida" modal —
    // they open the dedicated "Gestisci guida di gruppo" page sheet instead.
    if (lesson.type === 'group_lesson' && lesson.groupLessonId) {
      openGroupLessonManage(lesson.groupLessonId);
      return;
    }
    setSheetLesson(lesson);
    setSheetStudentProgress(null);
    // Seed the store synchronously so the route paints immediately, then push.
    manageLessonStore.set(buildManageSnapshot(lesson, null));
    router.push('/(tabs)/home/manage-lesson');
  };

  // Live availability check whenever the staged instructor changes to a
  // value different from the lesson's current instructor.
  useEffect(() => {
    if (!sheetLesson || !selectedInstructorId) return;
    if (selectedInstructorId === sheetLesson.instructorId) {
      setInstructorAvailability({ status: 'idle' });
      return;
    }
    const startsAt = new Date(sheetLesson.startsAt);
    const endTs = sheetLesson.endsAt
      ? new Date(sheetLesson.endsAt).getTime()
      : startsAt.getTime() + 60 * 60 * 1000;
    const endsAt = new Date(endTs);

    let cancelled = false;
    setInstructorAvailability({ status: 'checking' });

    regloApi
      .checkInstructorAvailability({
        instructorId: selectedInstructorId,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        excludeAppointmentId: sheetLesson.id,
      })
      .then((result) => {
        if (cancelled) return;
        if (result.available) {
          setInstructorAvailability({ status: 'available' });
        } else {
          setInstructorAvailability({ status: 'unavailable', detail: result.detail });
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const detail = err instanceof Error ? err.message : 'Errore verifica disponibilità';
        setInstructorAvailability({ status: 'error', detail });
      });

    return () => {
      cancelled = true;
    };
  }, [sheetLesson, selectedInstructorId]);

  // Lazily load the instructors list when the user first opens the picker.
  const handleOpenInstructorPicker = useCallback(async () => {
    setLessonSheetMode('instructorPicker');
    if (instructorList.length > 0 || instructorListLoading) return;
    setInstructorListLoading(true);
    try {
      const list = await regloApi.getInstructors();
      setInstructorList(list ?? []);
    } catch {
      setInstructorList([]);
    } finally {
      setInstructorListLoading(false);
    }
  }, [instructorList.length, instructorListLoading]);

  // Preload the instructor list when the drawer opens, so the "Veicolo" picker
  // can label vehicles with the instructor they're assigned to.
  useEffect(() => {
    if (!sheetLesson || settings?.vehiclesEnabled === false) return;
    if (instructorList.length > 0 || instructorListLoading) return;
    setInstructorListLoading(true);
    regloApi.getInstructors()
      .then((l) => setInstructorList(l ?? []))
      .catch(() => { /* keep best-effort agenda-derived names */ })
      .finally(() => setInstructorListLoading(false));
  }, [sheetLesson, settings?.vehiclesEnabled, instructorList.length, instructorListLoading]);

  // Fetch student lesson progress when drawer opens
  useEffect(() => {
    if (!sheetLesson) return;
    const studentId = sheetLesson.studentId;
    let cancelled = false;
    regloApi.getAppointments({ studentId, limit: 500 }).then((appts) => {
      if (cancelled) return;
      const completed = appts.filter((a) => {
        const s = (a.status ?? '').trim().toLowerCase();
        return s === 'completed' || s === 'checked_in';
      }).length;
      setSheetStudentProgress({ completed, required: 6 });
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [sheetLesson]);

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
      (`${a.student?.firstName ?? ''} ${a.student?.lastName ?? ''}`).toLowerCase().includes(q),
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
  const sheetStateMeta = useMemo(() => {
    if (!sheetLesson) return null;
    const endTs = sheetLesson.endsAt
      ? new Date(sheetLesson.endsAt).getTime()
      : new Date(sheetLesson.startsAt).getTime() + 60 * 60 * 1000;
    const durationMin = (endTs - new Date(sheetLesson.startsAt).getTime()) / (60 * 1000);
    const config = timelineStatusConfig(sheetLesson.status, sheetLesson.type, {
      durationMin,
      studentId: sheetLesson.studentId,
    });
    // Map timelineStatusConfig colors to LessonStateTag tones
    const toneMap: Record<string, 'live' | 'confirmed' | 'scheduled' | 'pending_review'> = {
      '#1A1A2E': 'live',        // checked_in / in corso
      '#22C55E': 'confirmed',   // completed
      '#F97316': 'pending_review', // pending_review
      '#94A3B8': 'pending_review', // cancelled / no_show
      '#A78BFA': 'pending_review', // proposal
    };
    const tone = toneMap[config.border] ?? 'scheduled';
    return { label: config.label, tone };
  }, [sheetLesson, now, timelineStatusConfig]);

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

  // Booked days in YYYY-MM-DD for the new scrollable calendar (select-date sheet).
  const markedDatesYMD = useMemo(() => {
    const pad = (n: number) => String(n).padStart(2, '0');
    const set = new Set<string>();
    for (const appt of featuredAppointments) {
      const status = (appt.status ?? '').trim().toLowerCase();
      if (status === 'cancelled') continue;
      const d = new Date(appt.startsAt);
      set.add(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
    }
    return set;
  }, [featuredAppointments]);

  const openAgendaCalendar = useCallback(() => {
    const pad = (n: number) => String(n).padStart(2, '0');
    const sel = new Date(selectedDate);
    dayPickerStore.set({
      selectedDate: `${sel.getFullYear()}-${pad(sel.getMonth() + 1)}-${pad(sel.getDate())}`,
      markedDates: markedDatesYMD,
      // Snappy: 2 mesi passati + mese corrente + 3 mesi futuri (max 3 mesi avanti),
      // non più ~1.5 anni che rendeva lento il render del calendario.
      monthsBack: 2,
      monthsCount: 4,
      allowPast: true,
      title: 'Vai al giorno',
      onSelect: (ds) => {
        const [y, m, d] = ds.split('-').map(Number);
        setSelectedDate(new Date(y, m - 1, d));
      },
    });
    router.push('/(tabs)/home/select-date');
  }, [selectedDate, markedDatesYMD, router]);

  // Legacy tap+drag grid is disabled (quick-book is now a native formSheet).
  // Kept renderable-but-off via a non-literal flag so TS still type-checks the
  // block; remove the block entirely in a later cleanup.

  // Overall bookable window for the selected day (earliest..latest availability,
  // or a sensible default when none is set).
  const dayBookWindow = useMemo(() => {
    if (availabilitySlots.length) {
      return {
        start: Math.min(...availabilitySlots.map((s) => s.startMinutes)),
        end: Math.max(...availabilitySlots.map((s) => s.endMinutes)),
      };
    }
    return { start: 8 * 60, end: 20 * 60 };
  }, [availabilitySlots]);


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
    const key = toDateOnlyString(selectedDate);
    latestAvailKeyRef.current = key;
    // Seed instantly from cache so changing day never shows the previous day's
    // availability (nor flashes the 8–20 fallback). If uncached, keep what's
    // shown until the fetch resolves — never clear.
    const cached = availabilityCacheRef.current.get(key);
    if (cached) {
      setAvailableHours(cached.hours);
      setAvailabilitySlots(cached.slots);
    }
    regloApi.getAvailabilitySlots({
      ownerType: 'instructor',
      ownerId: instructorId,
      date: key,
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
      availabilityCacheRef.current.set(key, { hours, slots: precise });
      // Only apply if the user is still on this day (guards out-of-order resolves).
      if (latestAvailKeyRef.current === key) {
        setAvailableHours(hours);
        setAvailabilitySlots(precise);
      }
    }).catch(() => { /* keep cached/previous availability — never flash empty */ });
  }, [selectedDate, instructorId]);

  // Recenter the fetch window only when the selected day nears an edge. Staying
  // inside the loaded window is a no-op → no refetch, no skeleton (pure client
  // filter). The span (-7 / +booking-horizon) prefetches neighbours for the day
  // grid and week swipes AND covers everything bookable; SWR keeps the visible
  // day painted during a recenter.
  useEffect(() => {
    // Forward reach = the school's booking horizon (availabilityWeeks) + buffer,
    // so everything bookable is loaded and a just-booked lesson never vanishes;
    // navigating further still recenters the window and refetches on demand.
    const forwardDays = Math.max(35, (Number(settings?.availabilityWeeks) || 4) * 7 + 7);
    setLoadRange((prev) => {
      const sel = new Date(selectedDate);
      sel.setHours(0, 0, 0, 0);
      const selMs = sel.getTime();
      const prevFrom = new Date(prev.from).getTime();
      const prevTo = new Date(prev.to).getTime();
      const MARGIN = 86400000; // 1 day
      const desiredTo = selMs + forwardDays * MARGIN;
      // No-op only if the selected day sits comfortably inside the window AND the
      // window still reaches the booking horizon (it may not once settings load).
      if (selMs >= prevFrom + MARGIN && selMs <= prevTo - MARGIN && prevTo >= desiredTo - MARGIN) return prev;
      const from = new Date(selectedDate);
      from.setDate(from.getDate() - 7);
      from.setHours(0, 0, 0, 0);
      const to = new Date(selectedDate);
      to.setDate(to.getDate() + forwardDays);
      to.setHours(23, 59, 59, 999);
      const next = { from: from.toISOString(), to: to.toISOString() };
      if (next.from === prev.from && next.to === prev.to) return prev;
      return next;
    });
  }, [selectedDate, settings?.availabilityWeeks]);

  useEffect(() => {
    if (agendaViewMode === 'week' || agendaViewMode === 'grid') {
      // Fetch full week (Mon–Sat) for weekly / grid view
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

    // Load availability for a 3-week window (prev/current/next) in weekly mode,
    // keyed by date, so the horizontal week-pager always has the neighbouring
    // weeks ready and swiping never flashes empty availability.
    if ((agendaViewMode === 'week' || agendaViewMode === 'grid') && instructorId) {
      const day = selectedDate.getDay();
      const mondayOffset = day === 0 ? -6 : 1 - day;
      const start = new Date(selectedDate);
      start.setDate(start.getDate() + mondayOffset - 7); // one week before current
      start.setHours(0, 0, 0, 0);

      Promise.all(
        Array.from({ length: 21 }, (_, i) => {
          const d = new Date(start);
          d.setDate(d.getDate() + i);
          const key = toDateOnlyString(d);
          return regloApi.getAvailabilitySlots({
            ownerType: 'instructor',
            ownerId: instructorId,
            date: key,
          }).then((slots) => {
            const precise: Array<{ startMinutes: number; endMinutes: number }> = [];
            if (slots) {
              for (const slot of slots) {
                const s = new Date(slot.startsAt);
                const e = new Date(slot.endsAt);
                precise.push({ startMinutes: s.getHours() * 60 + s.getMinutes(), endMinutes: e.getHours() * 60 + e.getMinutes() });
              }
            }
            return { key, slots: precise };
          });
        }),
      ).then((results) => {
        const map: Record<string, Array<{ startMinutes: number; endMinutes: number }>> = {};
        for (const r of results) map[r.key] = r.slots;
        // MERGE (don't replace): swiping to an adjacent week must never blank out
        // days that already have availability — we only add/refresh keys. Replacing
        // made days flash "Riposo" during the ~0.5s reload. Keep prior data on error.
        setWeekAvailability((prev) => ({ ...prev, ...map }));
      }).catch(() => { /* keep previously loaded availability — never flash empty */ });
    }
  }, [selectedDate, instructorId, loadAvailability, agendaViewMode]);

  // Re-fetch data when screen regains focus (e.g. after changing availability).
  // Gated: returning from a sheet/tab fires 'focus' constantly; without a gate
  // every re-entry re-ran 4 fetch families. Skip the network refresh when the
  // last one was < 30s ago — the view-mode read (local, cheap) still runs every
  // time. loadData uses force:false so it reuses the fresh TanStack cache.
  const navigation = useNavigation();
  const lastFocusRefreshRef = useRef(0);
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      sessionStorage.getAgendaViewMode().then(setAgendaViewMode);
      const nowMs = Date.now();
      if (nowMs - lastFocusRefreshRef.current < 30_000) return;
      lastFocusRefreshRef.current = nowMs;
      loadData({ force: false });
      loadAvailability();
      loadOutOfAvailability();
      loadHolidays();
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

      // No optimistic update: wait for the BE, then refresh from it. The spinner
      // (pendingAction) stays up the whole time so the action doesn't feel dead.
      const lessonId = lesson.id;
      setPendingAction(action);
      setError(null);

      try {
        await regloApi.updateAppointmentStatus(lessonId, {
          status: action,
          lessonType: types[0] || undefined,
          lessonTypes: types.length ? types : undefined,
        });
        // Refresh from the BE before closing so the list/card show the true state.
        await loadData();
        setToast({ text: 'Stato aggiornato', tone: 'success' });
        if (options?.closeDrawerOnSuccess) {
          setSheetLesson(null);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Errore aggiornando stato';
        setError(message);
        setToast({ text: message, tone: 'danger' });
      } finally {
        setPendingAction(null);
      }
    },
    [loadData, settings?.autoCheckinEnabled],
  );

  // Saves tipo guida / valutazione / note from the details sub-sheet. Instructor
  // and location are NOT handled here — they auto-save on selection.
  const saveLessonDetails = async (
    lesson: AutoscuolaAppointmentWithRelations,
    input: ManageLessonDetailsPayload,
  ): Promise<boolean> => {
    if (!isDetailsEditable(lesson, now)) {
      setToast({ text: 'Guida non modificabile.', tone: 'danger' });
      return false;
    }

    const payload: { lessonType?: string; lessonTypes?: string[]; rating?: number | null; notes?: string | null } = {};
    const initialTypes = resolveInitialLessonTypes(lesson);
    const typesChanged = JSON.stringify([...input.lessonTypes].sort()) !== JSON.stringify([...initialTypes].sort());
    if (input.lessonTypes.length && typesChanged) {
      payload.lessonTypes = input.lessonTypes;
      payload.lessonType = input.lessonTypes[0];
    }

    const initialRating = lesson.rating ?? null;
    if (input.rating !== initialRating) {
      payload.rating = input.rating;
    }

    const currentNotes = normalizeNotes(input.notes);
    const initialNotes = normalizeNotes(lesson.notes);
    if (currentNotes !== initialNotes) {
      payload.notes = currentNotes || null;
    }

    if (!Object.keys(payload).length) {
      setToast({ text: 'Nessuna modifica da salvare.', tone: 'info' });
      return false;
    }

    // No optimistic update: wait for the BE, refresh from it, then report success
    // so the caller can close. The caller keeps its spinner while this awaits.
    const lessonId = lesson.id;
    setToast(null);
    setError(null);

    try {
      await regloApi.updateAppointmentDetails(lessonId, payload);
      await loadData();
      setToast({ text: 'Dettagli guida salvati.', tone: 'success' });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Errore aggiornando dettagli';
      setError(message);
      setToast({ text: message, tone: 'danger' });
      return false;
    }
  };

  // Instructor reassignment — checks availability, then auto-saves. No optimistic
  // update: the row reflects the change only after the BE confirms (and we refresh
  // the drawer from it). Uses Alert (not toast) for the failure path since toasts
  // render under the modal route and would be invisible while the sheet stays open.
  const changeLessonInstructor = async (
    lesson: AutoscuolaAppointmentWithRelations,
    instructor: { id: string; name: string },
  ) => {
    const lessonId = lesson.id;
    if (!instructor?.id || instructor.id === lesson.instructorId) return;
    // L'istruttore non si cambia su guide concluse/annullate (il backend lo
    // rifiuta comunque). I dettagli (tipo/voto/note) invece restano editabili.
    const instrStatus = normalizeStatus(lesson.status);
    if (['cancelled', 'completed', 'no_show'].includes(instrStatus)) {
      Alert.alert('Guida non modificabile', 'Non puoi cambiare istruttore per una guida conclusa o annullata.');
      return;
    }

    try {
      await regloApi.updateAppointmentDetails(lessonId, { instructorId: instructor.id });
      await refreshAndSyncDrawer(lessonId);
      setToast({ text: 'Istruttore aggiornato.', tone: 'success' });
    } catch (err: unknown) {
      Alert.alert('Istruttore non aggiornato', err instanceof Error ? err.message : 'Errore aggiornando istruttore.');
    }
  };

  const handleStatusAction = async (action: InstructorActionStatus, lessonTypes: string[]) => {
    if (!sheetLesson) return;
    await executeStatusAction(sheetLesson, action, {
      lessonTypes,
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

  // Permanent delete ("Elimina definitivamente") — same action as the web. Soft
  // delete on the BE (status→cancelled, refunds credit, notifies the student),
  // available regardless of the lesson time/status. Confirmed before running.
  const handlePermanentDelete = useCallback(
    (lesson: AutoscuolaAppointmentWithRelations) => {
      Alert.alert(
        'Elimina definitivamente',
        'Sei sicuro di voler eliminare definitivamente questa guida? All’allievo verrà restituito il credito.',
        [
          { text: 'Annulla', style: 'cancel' },
          {
            text: 'Elimina',
            style: 'destructive',
            onPress: async () => {
              const lessonId = lesson.id;
              // No optimistic removal: wait for the BE, refresh from it, then close.
              setPendingAction('save_details');
              setToast(null);
              try {
                const res = await regloApi.permanentlyCancelAppointment(lessonId);
                if (!res?.success) {
                  throw new Error(res?.message || 'Impossibile eliminare la guida.');
                }
                await loadData();
                setSheetLesson((prev) => (prev && prev.id === lessonId ? null : prev));
                setToast({ text: 'Guida eliminata definitivamente.', tone: 'success' });
              } catch (err) {
                // The cancel often commits server-side even when the client call
                // times out (slow student notifications on the BE) — so don't cry
                // wolf. Refresh and check the BE truth: if the guide is no longer
                // active, the delete actually succeeded.
                const refreshed = await loadData();
                const stillActive = refreshed.some((a) => a.id === lessonId);
                if (stillActive) {
                  setToast({
                    text: err instanceof Error ? err.message : 'Errore durante l’eliminazione.',
                    tone: 'danger',
                  });
                } else {
                  setSheetLesson((prev) => (prev && prev.id === lessonId ? null : prev));
                  setToast({ text: 'Guida eliminata definitivamente.', tone: 'success' });
                }
              } finally {
                setPendingAction(null);
              }
            },
          },
        ],
      );
    },
    [loadData],
  );

  // Instructor names by id — best-effort from the loaded agenda (always present)
  // plus the lazily-loaded picker list. Used to label vehicles by their assigned
  // instructor in the "Veicolo" picker.
  const instructorNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of appointments) {
      if (a.instructor?.id && a.instructor.name) m.set(a.instructor.id, a.instructor.name);
    }
    for (const i of instructorList) {
      if (i?.id && i.name) m.set(i.id, i.name);
    }
    return m;
  }, [appointments, instructorList]);

  // Elegant subtitle for a vehicle: "Patente B · Mario Rossi" (license category +
  // assigned instructor, where applicable).
  const vehicleOptions = useMemo<ManageLessonVehicle[]>(() => {
    return vehicles.map((v) => {
      const parts: string[] = [];
      if (v.licenseCategory) parts.push(`Patente ${String(v.licenseCategory).toUpperCase()}`);
      const instName = v.assignedInstructorId ? instructorNameById.get(v.assignedInstructorId) : null;
      if (instName) parts.push(instName);
      return { id: v.id, name: v.name, subtitle: parts.join(' · ') || null };
    });
  }, [vehicles, instructorNameById]);

  // ── "Gestisci guida" route (manage-lesson) bridge ──────────────────────────
  // Builds the snapshot the manage-lesson modal route renders from. The route
  // owns local drafts (notes/types/rating/instructor); we keep all API logic.
  const buildManageSnapshot = (
    lesson: AutoscuolaAppointmentWithRelations,
    progress: { completed: number; required: number } | null,
  ): ManageLessonData => {
    const status = normalizeStatus(lesson.status);
    const endTs = lesson.endsAt
      ? new Date(lesson.endsAt).getTime()
      : new Date(lesson.startsAt).getTime() + 60 * 60 * 1000;
    const durationMin = (endTs - new Date(lesson.startsAt).getTime()) / (60 * 1000);
    const config = timelineStatusConfig(lesson.status, lesson.type, {
      durationMin,
      studentId: lesson.studentId,
    });
    const toneMap: Record<string, 'live' | 'confirmed' | 'scheduled' | 'pending_review'> = {
      '#1A1A2E': 'live',
      '#22C55E': 'confirmed',
      '#F97316': 'pending_review',
      '#94A3B8': 'pending_review',
      '#A78BFA': 'pending_review',
    };
    const stateMeta = { label: config.label, tone: toneMap[config.border] ?? 'scheduled' };

    const actionAvail = getActionAvailability(lesson, now, settings?.autoCheckinEnabled);
    const startsFuture = new Date(lesson.startsAt).getTime() > Date.now();
    const menuOptions: ManageLessonData['menuOptions'] = [];
    if (['scheduled', 'confirmed', 'proposal'].includes(status) && startsFuture) {
      menuOptions.push({ key: 'sposta', label: 'Sposta' });
    }
    if ((status === 'scheduled' || status === 'confirmed') && startsFuture && lesson.type !== 'esame') {
      menuOptions.push({ key: 'scambia', label: 'Scambia' });
    }
    // "Elimina" (permanent delete) is always available — future, past or live.
    menuOptions.push({ key: 'cancella', label: 'Elimina', danger: true });

    return {
      lesson,
      studentProgress: progress,
      stateMeta,
      stateLabel: getLessonStateLabel(lesson, now),
      durationText: durationLabel(lesson),
      vehiclesEnabled: settings?.vehiclesEnabled !== false,
      // Resolve from the relation, falling back to the vehicles list by id.
      vehicleText: lesson.vehicle?.name ?? vehicles.find((v) => v.id === lesson.vehicleId)?.name ?? 'Da assegnare',
      vehicles: vehicleOptions,
      defaultLocation,
      isDetailsEditable: !ownerMode && isDetailsEditable(lesson, now),
      readOnly: ownerMode,
      showStatusActions: !ownerMode && Boolean(actionAvail.enabled) && status !== 'proposal',
      allowPresente: status !== 'checked_in',
      showRating: ['checked_in', 'completed', 'no_show'].includes(status),
      pendingAction,
      menuOptions: ownerMode ? [] : menuOptions,
      onSaveDetails: (input) => saveLessonDetails(lesson, input),
      onChangeInstructor: (instructor) => changeLessonInstructor(lesson, instructor),
      // Uses the captured `lesson` (not sheetLesson): the route closes itself
      // first, which nulls sheetLesson before this fires.
      onStatus: (action) => {
        void executeStatusAction(lesson, action, {
          lessonTypes: resolveInitialLessonTypes(lesson),
          closeDrawerOnSuccess: true,
        });
      },
      onMenu: (key) => {
        if (key === 'sposta') {
          rescheduleStore.set({
            lesson,
            onSuccess: (newStartsAt) => {
              setToast({
                text: `Guida spostata al ${formatDay(newStartsAt)} · ${formatTime(newStartsAt)}.`,
                tone: 'success',
              });
              void refreshAndSyncDrawer(lesson.id);
            },
            onError: (message) => setToast({ text: message, tone: 'danger' }),
          });
          router.push('/(tabs)/home/reschedule-lesson');
        } else if (key === 'scambia') {
          swapStore.set({
            sourceName: `${lesson.student?.firstName ?? ''} ${lesson.student?.lastName ?? ''}`.trim() || 'Allievo',
            candidates: computeSwapCandidates(lesson),
            vehiclesEnabled: settings?.vehiclesEnabled !== false,
            onSwap: (target) => doSwap(lesson, target),
          });
          router.push('/(tabs)/home/swap-lesson');
        } else if (key === 'cancella') {
          handlePermanentDelete(lesson);
        }
      },
      onChangeLocation: async (location) => {
        const lessonId = lesson.id;
        if (location.id === lesson.locationId) return; // already the current location — nothing to save
        // No optimistic update: persist, then refresh the drawer from the BE.
        try {
          await regloApi.updateAppointmentDetails(lessonId, { locationId: location.id });
          await refreshAndSyncDrawer(lessonId);
        } catch (err) {
          setToast({ text: err instanceof Error ? err.message : 'Errore aggiornando il luogo.', tone: 'danger' });
        }
      },
      onChangeVehicle: async (vehicleId) => {
        const lessonId = lesson.id;
        if ((vehicleId ?? null) === (lesson.vehicleId ?? null)) return; // already current — nothing to save
        // No optimistic update: persist, then refresh the drawer from the BE.
        try {
          await regloApi.updateAppointmentDetails(lessonId, { vehicleId: vehicleId ?? null });
          await refreshAndSyncDrawer(lessonId);
        } catch (err) {
          setToast({ text: err instanceof Error ? err.message : 'Errore aggiornando il veicolo.', tone: 'danger' });
        }
      },
      onClosed: () => { setSheetLesson(null); },
    };
  };

  // Keep the route's store snapshot in sync while a lesson is being managed.
  useEffect(() => {
    if (!sheetLesson) return;
    manageLessonStore.set(buildManageSnapshot(sheetLesson, sheetStudentProgress));
    // buildManageSnapshot reads current closure (now/settings/pending/etc.)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetLesson, sheetStudentProgress, pendingAction, now, settings, defaultLocation, instructorBookingMode, vehicleOptions]);

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

  // Swappable candidates for a given source lesson (same instructor, future,
  // scheduled/confirmed, different student, not an exam).
  const computeSwapCandidates = (
    source: AutoscuolaAppointmentWithRelations,
  ): AutoscuolaAppointmentWithRelations[] => {
    const nowTs = Date.now();
    return featuredAppointments
      .filter((a) => {
        if (a.id === source.id) return false;
        if (a.studentId === source.studentId) return false;
        if (a.instructorId !== source.instructorId) return false;
        if (a.status !== 'scheduled' && a.status !== 'confirmed') return false;
        if (new Date(a.startsAt).getTime() <= nowTs) return false;
        if (a.type === 'esame') return false;
        return true;
      })
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  };

  // Performs the swap from the swap-lesson route. Returns true on success so the
  // route dismisses itself (revealing the home + success toast).
  const doSwap = useCallback(
    async (
      source: AutoscuolaAppointmentWithRelations,
      target: AutoscuolaAppointmentWithRelations,
    ): Promise<boolean> => {
      setToast(null);
      try {
        await regloApi.instructorSwapAppointments({
          appointmentIdA: source.id,
          appointmentIdB: target.id,
        });
        setToast({ text: 'Guide scambiate.', tone: 'success' });
        // Refresh the still-open "Gestisci guida" sheet with the swapped data.
        await refreshAndSyncDrawer(source.id);
        return true;
      } catch (err) {
        setToast({ text: err instanceof Error ? err.message : 'Errore nello scambio', tone: 'danger' });
        return false;
      }
    },
    [refreshAndSyncDrawer],
  );


  // New booking via the native modal route (same component family as Gestione guida).
  // Builds a provisional agenda row from a just-created booking so it shows
  // immediately; loadData() later replaces the whole array with BE data.
  // "Blocca slot" + "Malattia": seed the store with the viewed day + instructor,
  // then push the route. Non-optimistic: the form runs the create, then onApplied
  // (loadData) refreshes the agenda from the BE before the sheet closes.
  // Seeds blockSheetStore for the dedicated block-slot route AND the quick-book
  // sheet. `presetStartMinutes` (from a released scrub) seeds the start time.
  const seedBlockStore = useCallback((initialDate: Date, presetStartMinutes?: number) => {
    blockSheetStore.set({
      initialDate: initialDate.toISOString(),
      ...(presetStartMinutes != null ? { presetStartMinutes } : {}),
      instructorId: effectiveInstructorId ?? instructorId ?? '',
      onApplied: async () => { await loadData(); },
      onDone: (message) => { setToast({ text: message, tone: 'success' }); },
    });
  }, [effectiveInstructorId, instructorId, loadData]);

  const openBlockDrawer = useCallback(() => {
    seedBlockStore(selectedDate);
    router.push('/(tabs)/home/block-slot');
  }, [seedBlockStore, selectedDate, router]);

  const openSickLeaveDrawer = useCallback(() => {
    sickLeaveSheetStore.set({
      initialDate: selectedDate.toISOString(),
      instructorId: effectiveInstructorId ?? instructorId ?? '',
      // Sick leave also cancels conflicting guides → loadData refreshes the agenda
      // from the BE so they drop out.
      onApplied: async () => { await loadData(); },
      onDone: (message) => { setToast({ text: message, tone: 'success' }); },
    });
    router.push('/(tabs)/home/sick-leave');
  }, [selectedDate, effectiveInstructorId, instructorId, loadData, router]);

  const openCreateExam = useCallback(() => {
    examSheetStore.set({
      initialDate: selectedDate.toISOString(),
      // The create-exam route loads its own students; the screen-focus listener
      // reloads the agenda on return so the new exam appears. No optimistic insert.
      onDone: (message) => { setToast({ text: message, tone: 'success' }); },
    });
    router.push('/(tabs)/home/create-exam');
  }, [selectedDate, router]);

  // Seeds bookingSheetStore for the dedicated new-booking route AND the quick-book
  // sheet. `presetStartMinutes` (from a released scrub) seeds the start time.
  const seedBookingStore = useCallback((initialDate: Date, presetStartMinutes?: number, presetDurationMinutes?: number) => {
    bookingSheetStore.set({
      canBook: canInstructorBook,
      vehiclesEnabled: settings?.vehiclesEnabled !== false,
      availabilityWeeks: Number(settings?.availabilityWeeks) || 4,
      instructorId: instructorId ?? '',
      initialDate: initialDate.toISOString(),
      ...(presetStartMinutes != null ? { presetStartMinutes } : {}),
      durations: bookingDurations,
      // Ghost-block flow: the dragged duration (already snapped to the closest
      // allowed option) wins over the default 60'.
      defaultDuration: presetDurationMinutes
        ?? (bookingDurations.includes(60) ? 60 : (bookingDurations[0] ?? 60)),
      // Precompile the instructor's fixed vehicle when they have one; the
      // picker stays editable so it can still be overridden per lesson.
      defaultVehicleId:
        vehicles.find((v) => v.assignedInstructorId === instructorId)?.id ??
        vehicles[0]?.id ??
        '',
      vehicles: vehicles.map((v) => ({ id: v.id, name: v.name })),
      studentOptions: bookingStudentOptions,
      defaultLocation: defaultLocation
        ? { id: defaultLocation.id, name: defaultLocation.name, address: defaultLocation.address ?? null }
        : null,
      bookedDateKeys: Array.from(bookedDatesSet),
      onApplied: async () => { await loadData(); },
      onDone: (message) => { setToast({ text: message, tone: 'success' }); },
    });
  }, [canInstructorBook, settings?.vehiclesEnabled, settings?.availabilityWeeks, instructorId, bookingDurations, vehicles, bookingStudentOptions, defaultLocation, bookedDatesSet, loadData]);

  const openNewBooking = useCallback(() => {
    if (!canInstructorBook) {
      setToast({ text: 'La prenotazione da app è abilitata solo per allievi.', tone: 'info' });
      return;
    }
    seedBookingStore(selectedDate);
    router.push('/(tabs)/home/new-booking');
  }, [canInstructorBook, seedBookingStore, selectedDate, router]);

  // Opens the native quick-book sheet (Airbnb segmented: Prenota guida / Blocca
  // slot) preset to a start within a free window. Seeds the SAME stores the
  // dedicated routes use, so the embedded forms are identical.
  const openQuickBookSheet = useCallback((date: Date, startMinutes: number, windowStart: number, windowEnd: number, durationMinutes?: number) => {
    if (!canInstructorBook) {
      setToast({ text: 'La prenotazione da app è abilitata solo per allievi.', tone: 'info' });
      return;
    }
    const preset = Math.max(windowStart, Math.min(windowEnd - 15, startMinutes));
    // Ghost-block duration (free 15' steps) → closest allowed booking duration.
    const presetDur = durationMinutes != null && bookingDurations.length
      ? bookingDurations.reduce((best, d) =>
          Math.abs(d - durationMinutes) < Math.abs(best - durationMinutes) ? d : best,
        bookingDurations[0])
      : undefined;
    seedBookingStore(date, preset, presetDur);
    seedBlockStore(date, preset);
    router.push('/(tabs)/home/quick-book');
  }, [canInstructorBook, bookingDurations, seedBookingStore, seedBlockStore, router]);

  const userName = user?.name?.split(' ')[0] ?? (ownerMode ? 'Titolare' : 'Istruttore');

  if (!instructorId && !ownerMode) {
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

  // Scope filter — Airbnb-style chips (same language as the Allievi filters),
  // replacing the old segmented bar. Shared by the weekly + daily headers.
  const scopeChips = canSwitchScope ? (
    <View style={scopeStyles.row}>
      <SelectableChip
        label="Le mie guide"
        active={calendarScope === 'personal'}
        onPress={() => setCalendarScope('personal')}
      />
      <SelectableChip
        label="Tutti gli istruttori"
        active={calendarScope === 'all'}
        onPress={() => setCalendarScope('all')}
      />
    </View>
  ) : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style="dark" />
      <ToastNotice message={toast?.text ?? null} tone={toast?.tone} onHide={() => setToast(null)} />
      {agendaViewMode === 'week' ? (
        <>
          {/* ── Fixed header for weekly mode ── */}
          <View style={{ paddingHorizontal: spacing.lg, paddingTop: safeInsets.top, paddingBottom: spacing.sm }}>
            <View style={styles.greetRow}>
              <Text style={styles.greetName} numberOfLines={1}>Ciao, {userName} {'\uD83D\uDC4B'}</Text>
            </View>

            {scopeChips}

            {!initialLoading && error ? <Text style={styles.error}>{error}</Text> : null}

            {outOfAvailAppointments.length > 0 && (
              <Pressable
                onPress={() => {
                  outOfAvailStore.set({
                    appointments: outOfAvailAppointments,
                    onChanged: () => { loadOutOfAvailability(); loadData(); },
                  });
                  router.push('/(tabs)/home/out-of-availability');
                }}
                style={({ pressed }) => [oobStyles.banner, pressed && { opacity: 0.7 }]}
              >
                <View style={oobStyles.bannerIcon}>
                  <Ionicons name="alert-circle-outline" size={20} color="#1A1A2E" />
                </View>
                <Text style={oobStyles.bannerText}>
                  <Text style={oobStyles.bannerCount}>{outOfAvailAppointments.length}</Text>
                  {' '}guid{outOfAvailAppointments.length === 1 ? 'a' : 'e'} fuori disponibilità
                </Text>
                <Text style={oobStyles.bannerAction}>Gestisci</Text>
                <Ionicons name="chevron-forward" size={18} color="#C7CBD1" />
              </Pressable>
            )}
          </View>
        </>
      ) : null}

      <View style={agendaViewMode !== 'day' ? { display: 'none' } : { flex: 1, paddingTop: safeInsets.top }}>
      <Animated.ScrollView
        contentContainerStyle={[styles.content, { paddingTop: 0 }]}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        stickyHeaderIndices={[1]}
        style={{ flex: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={'#1A1A2E'}
            colors={['#1A1A2E']}
          />
        }
      >
        {/* ── Greeting + out-of-availability banner ── */}
        <View>
          <View>
          <View style={styles.greetRow}>
            <Text style={styles.greetName} numberOfLines={1}>Ciao, {userName} {'👋'}</Text>
          </View>

          {scopeChips}

          {!initialLoading && error ? <Text style={styles.error}>{error}</Text> : null}
          </View>

          {outOfAvailAppointments.length > 0 && (
            <Pressable
              onPress={() => {
                outOfAvailStore.set({
                  appointments: outOfAvailAppointments,
                  onChanged: () => { loadOutOfAvailability(); loadData(); },
                });
                router.push('/(tabs)/home/out-of-availability');
              }}
              style={({ pressed }) => [oobStyles.banner, pressed && { opacity: 0.7 }]}
            >
              <View style={oobStyles.bannerIcon}>
                <Ionicons name="alert-circle-outline" size={20} color="#1A1A2E" />
              </View>
              <Text style={oobStyles.bannerText}>
                <Text style={oobStyles.bannerCount}>{outOfAvailAppointments.length}</Text>
                {' '}guid{outOfAvailAppointments.length === 1 ? 'a' : 'e'} fuori disponibilità
              </Text>
              <Text style={oobStyles.bannerAction}>Gestisci</Text>
              <Ionicons name="chevron-forward" size={18} color="#C7CBD1" />
            </Pressable>
          )}
        </View>

        {/* ── Calendar panel (tonal surface; sticky) ── */}
        <View style={styles.calendarSection}>
          <View style={styles.calendarMonthRow}>
            <Text style={styles.calendarMonthTitle}>
              {ITALIAN_MONTHS[selectedDate.getMonth()]}{' '}
              <Text style={styles.calendarMonthYear}>{selectedDate.getFullYear()}</Text>
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Pressable
                onPress={() => setSelectedDate(new Date())}
                style={({ pressed }) => [styles.calendarTodayChip, pressed && { transform: [{ scale: 0.96 }], opacity: 0.9 }]}
                hitSlop={6}
              >
                <Text style={styles.calendarTodayChipText}>Oggi</Text>
              </Pressable>
              <Pressable
                onPress={openAgendaCalendar}
                style={({ pressed }) => [styles.calendarIconBtn, pressed && { transform: [{ scale: 0.96 }], opacity: 0.9 }]}
                hitSlop={6}
              >
                <Ionicons name="calendar-outline" size={21} color="#1A1A2E" />
              </Pressable>
            </View>
          </View>
          <ScrollView
            ref={dayScrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.dayPillsScroll}
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
              const isDaySelected = dayNorm.getTime() === selNorm.getTime();
              const dayKey = `${dayNorm.getFullYear()}-${dayNorm.getMonth()}-${dayNorm.getDate()}`;
              const hasBooking = bookedDatesSet.has(dayKey);
              const hasExam = examDatesSet.has(dayKey);
              const isDayHoliday = holidays.has(toDateOnlyString(dayNorm));
              const isDaySick = sickLeaveDateKeys.has(dateToKey(dayNorm));
              return (
                <Pressable
                  key={`day-${index}`}
                  style={({ pressed }) => [
                    styles.dayPill,
                    isDaySelected
                      ? styles.dayPillSelected
                      : isDayToday
                        ? styles.dayPillToday
                        : isDayHoliday
                          ? styles.dayPillHoliday
                          : styles.dayPillUnselected,
                    pressed && { transform: [{ scale: 0.96 }] },
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
                    <View style={[styles.dayPillDot, styles.dayPillSickDot]} />
                  ) : hasExam ? (
                    <View style={[styles.dayPillDot, styles.dayPillExamDot]} />
                  ) : isDayHoliday ? (
                    <View style={styles.dayPillHolidayDot} />
                  ) : hasBooking ? (
                    <View
                      style={[
                        styles.dayPillDot,
                        isDaySelected && styles.dayPillDotHighlight,
                      ]}
                    />
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>


        {/* ── Timeline ── */}
        {dayGridLoading ? (
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
            backgroundColor: '#FFFFFF',
            borderRadius: 28,
            paddingVertical: 32,
            paddingHorizontal: 24,
            alignItems: 'center',
            gap: 18,
            shadowColor: '#1A1A2E',
            shadowOpacity: 0.06,
            shadowRadius: 22,
            shadowOffset: { width: 0, height: 12 },
            elevation: 3,
          }}>
            <View style={{
              width: 88,
              height: 88,
              borderRadius: 44,
              backgroundColor: '#F4F5F9',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Image source={require('../../assets/icons/fluent-thermometer.png')} style={{ width: 52, height: 52 }} resizeMode="contain" />
            </View>
            <View style={{ alignItems: 'center', gap: 7 }}>
              <Text style={{ fontSize: 21, fontWeight: '600', color: '#1A1A2E', letterSpacing: -0.4 }}>
                In malattia
              </Text>
              <Text style={{ fontSize: 14, color: '#717171', textAlign: 'center', lineHeight: 21 }}>
                Le guide sono state cancellate{'\n'}e gli allievi sono stati avvisati.
              </Text>
            </View>
            <View style={{
              backgroundColor: '#F4F5F9',
              borderRadius: 999,
              paddingHorizontal: 16,
              paddingVertical: 9,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
            }}>
              <Ionicons name="calendar-outline" size={15} color="#1A1A2E" />
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#1A1A2E' }}>
                {sickLeaveInfo.rangeStart.toDateString() === sickLeaveInfo.rangeEnd.toDateString()
                  ? sickLeaveInfo.rangeStart.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
                  : `${sickLeaveInfo.rangeStart.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })} \u2013 ${sickLeaveInfo.rangeEnd.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}`}
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
                  marginTop: 2,
                  paddingHorizontal: 24,
                  paddingVertical: 12,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: '#E4E7EE',
                  backgroundColor: pressed ? '#F4F5F9' : '#FFFFFF',
                },
              ]}
            >
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#1A1A2E' }}>
                Rimuovi malattia
              </Text>
            </Pressable>
          </View>
        ) : (
          <Animated.View style={[styles.timelineGridWrapper, timelineFadeStyle]}>
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
            {!hasTimelineAppointments && (isSelectedDateHoliday || !canInstructorBook || !!sickLeaveInfo) && (
              isSelectedDateHoliday ? (
                <View style={styles.dayEmpty}>
                  <Image source={require('../../assets/icons/fluent-pin.png')} style={styles.dayEmptyImg} />
                  <Text style={styles.dayEmptyTitle}>Giorno festivo</Text>
                  <Text style={styles.dayEmptySub}>L'autoscuola è chiusa.</Text>
                </View>
              ) : (
                <View style={styles.dayEmpty}>
                  <Image source={require('../../assets/icons/fluent-car.png')} style={styles.dayEmptyImg} />
                  <Text style={styles.dayEmptyTitle}>Nessuna guida oggi</Text>
                  <Text style={styles.dayEmptySub}>
                    {ownerMode
                      ? 'Nessuna guida in programma per gli istruttori.'
                      : canInstructorBook && !sickLeaveInfo ? 'Tocca un orario libero per prenotare al volo.' : 'Giornata libera — goditi la pausa!'}
                  </Text>
                  {canInstructorBook && !sickLeaveInfo ? (
                    <Pressable
                      onPress={() => openQuickBookSheet(selectedDate, dayBookWindow.start, dayBookWindow.start, dayBookWindow.end)}
                      style={({ pressed }) => [styles.dayEmptyCta, pressed && { opacity: 0.9 }]}
                    >
                      <Ionicons name="add" size={18} color="#FFFFFF" />
                      <Text style={styles.dayEmptyCtaText}>Prenota una guida</Text>
                    </Pressable>
                  ) : null}
                </View>
              )
            )}
            {/* Timeless exam banners (daily view) */}
            {(() => {
              const timelessExams = timelineItems.filter(
                (item) => item.kind === 'examGroup' && !item.endsAt,
              );
              if (!timelessExams.length) return null;
              return (
                <View style={{ paddingHorizontal: 0, paddingBottom: 12, gap: 6 }}>
                  {timelessExams.map((item) => {
                    if (item.kind !== 'examGroup') return null;
                    const d = new Date(item.startsAt);
                    const dayLabel = d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
                    return (
                      <Pressable
                        key={`timeless-day-${item.id}`}
                        onPress={() =>
                          openExamManage({
                            startsAt: item.startsAt,
                            endsAt: item.endsAt,
                            instructorId: item.instructorId,
                            instructorName: item.instructorName,
                            notes: item.notes,
                            appointments: item.appointments,
                          })
                        }
                        style={({ pressed }) => [{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 12,
                          backgroundColor: '#F5F0FF',
                          borderRadius: 22,
                          padding: 14,
                          shadowColor: '#8B5CF6',
                          shadowOpacity: 0.22,
                          shadowRadius: 14,
                          shadowOffset: { width: 0, height: 5 },
                          elevation: 4,
                        }, pressed && styles.itinCardPressed]}
                      >
                        <Image source={require('../../assets/icons/fluent-graduate.png')} style={styles.examGroupIcon} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.examGroupLabel}>Esame di guida · {dayLabel}</Text>
                          <Text style={styles.examGroupTitle} numberOfLines={1}>
                            {item.appointments.length} {item.appointments.length === 1 ? 'allievo' : 'allievi'} · Orario da definire
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              );
            })()}
            {/* ── Itinerary list (always shown; quick-book opens as a drawer over it) ── */}
            {(() => {
              const itFmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(Math.round(m % 60)).padStart(2, '0')}`;
              const gapLabel = (m: number) => m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ' ' + (m % 60) : ''}` : `${m} min`;
              type ItinRow =
                | { type: 'appointment'; startMin: number; endMin: number; appt: AutoscuolaAppointmentWithRelations }
                | { type: 'examGroup'; startMin: number; endMin: number; group: Extract<(typeof timelineItems)[number], { kind: 'examGroup' }> }
                | { type: 'groupLesson'; startMin: number; endMin: number; group: Extract<(typeof timelineItems)[number], { kind: 'groupLesson' }> }
                | { type: 'cluster'; startMin: number; endMin: number; cluster: Extract<TimelineClusterItem, { kind: 'cluster' }> }
                | { type: 'block'; startMin: number; endMin: number; block: InstructorBlock };
              const rows: ItinRow[] = [];
              for (const c of timelineClusters) {
                if (c.kind === 'cluster') {
                  rows.push({ type: 'cluster', startMin: c.startMin, endMin: c.endMin, cluster: c });
                } else {
                  const it = c.item;
                  if (it.kind === 'appointment') {
                    const a = it.appointment;
                    const sd = new Date(a.startsAt);
                    const startMin = sd.getHours() * 60 + sd.getMinutes();
                    const endTs = a.endsAt ? new Date(a.endsAt).getTime() : sd.getTime() + 3600000;
                    rows.push({ type: 'appointment', startMin, endMin: startMin + (endTs - sd.getTime()) / 60000, appt: a });
                  } else if (it.kind === 'groupLesson') {
                    const sd = new Date(it.startsAt);
                    const startMin = sd.getHours() * 60 + sd.getMinutes();
                    const endTs = it.endsAt ? new Date(it.endsAt).getTime() : sd.getTime() + 3600000;
                    rows.push({ type: 'groupLesson', startMin, endMin: startMin + (endTs - sd.getTime()) / 60000, group: it });
                  } else {
                    if (!it.endsAt) continue; // timeless exams render as banners above
                    const sd = new Date(it.startsAt);
                    const startMin = sd.getHours() * 60 + sd.getMinutes();
                    rows.push({ type: 'examGroup', startMin, endMin: startMin + (new Date(it.endsAt).getTime() - sd.getTime()) / 60000, group: it });
                  }
                }
              }
              const dayBlocks = Array.from(new Map(Array.from(blocksByHour.values()).flat()
                .filter((b) => b.reason === 'sick_leave' ? sickLeaveInfo?.isHalfDay === true : true)
                .map((b) => [b.id, b])).values());
              for (const block of dayBlocks) {
                const bs = new Date(block.startsAt); const be = new Date(block.endsAt);
                rows.push({ type: 'block', startMin: bs.getHours() * 60 + bs.getMinutes(), endMin: be.getHours() * 60 + be.getMinutes(), block });
              }
              rows.sort((a, b) => a.startMin - b.startMin);
              // No lessons AND not bookable (holiday / sick full-day / can't book)
              // → let the empty-state block handle it.
              const cannotBookEmpty = !canInstructorBook || (!!sickLeaveInfo && sickLeaveInfo.isHalfDay === false) || isSelectedDateHoliday;
              if (!rows.length && cannotBookEmpty) return null;
              const todayNorm = new Date(); todayNorm.setHours(0, 0, 0, 0);
              const selNorm = new Date(selectedDate); selNorm.setHours(0, 0, 0, 0);
              const nowMin = selNorm.getTime() === todayNorm.getTime() ? now.getHours() * 60 + now.getMinutes() : null;
              // The past portion of the rail stays "illuminated" (green); the
              // block/segment containing `now` is the boundary (green above, grey
              // below); the future is grey.
              const lineStateFor = (start: number, end: number): 'past' | 'now' | 'future' =>
                nowMin === null ? 'future' : nowMin >= end ? 'past' : nowMin >= start ? 'now' : 'future';
              const sickFullDay = !!sickLeaveInfo && sickLeaveInfo.isHalfDay === false;

              // Airbnb-style time rail: a time pill per row, pills linked top-to
              // -bottom by a continuous vertical line (markers included).
              const Rail = ({ time, isFirst, isLast, muted, hidePill, lineState = 'future' }: { time: string; sub?: string; isFirst: boolean; isLast: boolean; muted?: boolean; hidePill?: boolean; lineState?: 'past' | 'now' | 'future' }) => {
                const lit = lineState !== 'future';                         // past + now → green pill
                const topLive = lineState === 'past' || lineState === 'now'; // line ABOVE the pill is past
                const botLive = lineState === 'past';                        // line BELOW only when fully past
                return (
                  <View style={styles.itinRail}>
                    {hidePill ? (
                      // Row starts exactly at an availability boundary marker — the
                      // marker already shows the time, so we drop the duplicate pill
                      // and draw a continuous line through the rail instead.
                      <View style={[styles.railLineFull, topLive && styles.lineLive]} />
                    ) : (
                      <>
                        {!isFirst ? <View style={[styles.railLineTop, topLive && styles.lineLive]} /> : null}
                        {!isLast ? <View style={[styles.railLineBottom, botLive && styles.lineLive]} /> : null}
                        <View style={[styles.railPill, muted && styles.railPillMuted, lit && styles.railPillNow]}>
                          <Text style={[styles.railPillText, muted && styles.railPillTextMuted, lit && styles.railPillTextNow]}>{time}</Text>
                        </View>
                      </>
                    )}
                  </View>
                );
              };
              // Rail for the in-progress lesson: TWO pills — the lesson start time
              // (light green) and the current time (solid green) — linked by green.
              const NowRail = ({ startTime, nowTime, isFirst }: { startTime: string; nowTime: string; isFirst: boolean }) => (
                <View style={styles.itinRailNow}>
                  {!isFirst ? <View style={[styles.railLineTop, styles.lineLive]} /> : null}
                  <View style={[styles.railPill, styles.railPillNow]}>
                    <Text style={[styles.railPillText, styles.railPillTextNow]}>{startTime}</Text>
                  </View>
                  <View style={styles.railFlowMid} />
                  <View style={[styles.railPill, styles.railPillNow, styles.railPillCurrent]}>
                    <View style={styles.railCurrentDot} />
                    <Text style={[styles.railPillText, styles.railPillTextNow]}>{nowTime}</Text>
                  </View>
                  <View style={styles.railFlowFill} />
                </View>
              );

              const renderRow = (row: ItinRow, i: number, isFirst: boolean, isLast: boolean, hidePill: boolean) => {
                // Past/now/future for this block → drives the rail line + lit pill.
                const lineState = lineStateFor(row.startMin, row.endMin);
                if (row.type === 'appointment') {
                  const a = row.appt;
                  const config = timelineStatusConfig(a.status, a.type, { durationMin: row.endMin - row.startMin, studentId: a.studentId });
                  const st = normalizeStatus(a.status);
                  const isTerminal = st === 'completed' || st === 'no_show' || st === 'cancelled';
                  const isActive = !isTerminal && isLessonInProgressWindow(a, now);
                  const actionAvail = getActionAvailability(a, now, settings?.autoCheckinEnabled);
                  const isCheckedIn = st === 'checked_in';
                  const showActions = isActive && (!isCheckedIn || settings?.autoCheckinEnabled) && actionAvail.enabled && st !== 'proposal';
                  const initials = `${a.student?.firstName?.[0] ?? ''}${a.student?.lastName?.[0] ?? ''}`.toUpperCase() || '·';
                  const nm = `${calendarScope === 'all' && a.instructor?.name ? a.instructor.name + ' · ' : ''}${a.student?.firstName ?? ''} ${a.student?.lastName ?? ''}`.trim();
                  const meta = config.isExam
                    ? `Esame · ${durationLabel(a)}`
                    : [settings?.vehiclesEnabled !== false ? a.vehicle?.name : null, durationLabel(a)].filter(Boolean).join(' · ');
                  return (
                    <View key={a.id} style={styles.itinRow}>
                      {lineState === 'now' && nowMin !== null ? (
                        <NowRail startTime={itFmt(row.startMin)} nowTime={itFmt(nowMin)} isFirst={isFirst} />
                      ) : (
                        <Rail time={itFmt(row.startMin)} sub={durationLabel(a)} isFirst={isFirst} isLast={isLast} hidePill={hidePill} lineState={lineState} />
                      )}
                      <Pressable onPress={() => openLessonDrawer(a)} style={({ pressed }) => [styles.itinCard, isActive && styles.itinCardActive, pressed && styles.itinCardPressed]}>
                        <View style={styles.itinTop}>
                          <View style={[styles.itinAvatar, config.isExam && { backgroundColor: '#EEF2FF' }]}>
                            {config.isExam ? <Ionicons name="school" size={18} color="#4338CA" /> : <Text style={styles.itinAvatarText}>{initials}</Text>}
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.itinName} numberOfLines={1}>{nm}</Text>
                            <Text style={styles.itinMeta} numberOfLines={1}>{meta}</Text>
                          </View>
                          <View style={[styles.itinStatusPill, { backgroundColor: config.badgeBg }]}>
                            <Text style={[styles.itinStatusPillText, { color: config.badgeText }]} numberOfLines={1}>{config.label}</Text>
                          </View>
                        </View>
                        {showActions ? (
                          <View style={styles.itinActions}>
                            {!isCheckedIn ? (
                              <Pressable onPress={(e) => { e.stopPropagation?.(); if (!isPending) executeStatusAction(a, 'checked_in'); }} disabled={isPending} style={({ pressed }) => [styles.itinActBtn, styles.itinActCheck, pressed && { opacity: 0.85 }, isPending && { opacity: 0.5 }]}>
                                <Text style={styles.itinActCheckText}>{pendingAction === 'checked_in' ? 'Attendi…' : '✓ Presente'}</Text>
                              </Pressable>
                            ) : null}
                            <Pressable onPress={(e) => { e.stopPropagation?.(); if (!isPending) executeStatusAction(a, 'no_show'); }} disabled={isPending} style={({ pressed }) => [styles.itinActBtn, styles.itinActNo, pressed && { opacity: 0.85 }, isPending && { opacity: 0.5 }]}>
                              <Text style={styles.itinActNoText}>{pendingAction === 'no_show' ? 'Attendi…' : '✗ Assente'}</Text>
                            </Pressable>
                          </View>
                        ) : null}
                      </Pressable>
                    </View>
                  );
                }
                if (row.type === 'examGroup') {
                  const g = row.group;
                  const count = g.appointments.length;
                  // Rich exam card (student-app language): lavender surface + Fluent
                  // 3D icon, count subtitle, NO right tag. Tap → exam detail sheet.
                  return (
                    <View key={`exam-${g.id}`} style={styles.itinRow}>
                      <Rail time={itFmt(row.startMin)} sub={itFmt(row.endMin)} isFirst={isFirst} isLast={isLast} hidePill={hidePill} lineState={lineState} />
                      <Pressable onPress={() => openExamManage({ startsAt: g.startsAt, endsAt: g.endsAt, instructorId: g.instructorId, instructorName: g.instructorName, notes: g.notes, appointments: g.appointments })} style={({ pressed }) => [styles.examGroupCard, pressed && styles.itinCardPressed]}>
                        <Image source={require('../../assets/icons/fluent-graduate.png')} style={styles.examGroupIcon} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.examGroupLabel}>Esame di guida</Text>
                          <Text style={styles.examGroupTitle} numberOfLines={1}>{count} {count === 1 ? 'allievo' : 'allievi'} · {gapLabel(row.endMin - row.startMin)}</Text>
                        </View>
                      </Pressable>
                    </View>
                  );
                }
                if (row.type === 'groupLesson') {
                  const g = row.group;
                  // Collapsed group-lesson card — bigger, NO student name. Tap → manage modal.
                  const sub = [settings?.vehiclesEnabled !== false ? g.vehicleName : null, gapLabel(row.endMin - row.startMin)].filter(Boolean).join(' · ');
                  return (
                    <View key={g.id} style={styles.itinRow}>
                      <Rail time={itFmt(row.startMin)} sub={gapLabel(row.endMin - row.startMin)} isFirst={isFirst} isLast={isLast} hidePill={hidePill} lineState={lineState} />
                      <Pressable
                        onPress={() => g.groupLessonId && openGroupLessonManage(g.groupLessonId)}
                        style={({ pressed }) => [styles.groupLessonCard, pressed && styles.itinCardPressed]}
                      >
                        <Image source={require('../../assets/icons/fluent-people.png')} style={styles.groupLessonIcon} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.groupLessonLabel}>Guida di gruppo</Text>
                          <Text style={styles.groupLessonTitle} numberOfLines={1}>{sub}</Text>
                          <View style={styles.glSeats}>
                            {Array.from({ length: g.capacity }).map((_, i) => (
                              <View key={i} style={[styles.glSeat, i >= g.count && styles.glSeatEmpty]} />
                            ))}
                            <Text style={styles.glSeatsText}>{g.count}/{g.capacity}</Text>
                          </View>
                        </View>
                      </Pressable>
                    </View>
                  );
                }
                if (row.type === 'cluster') {
                  const c = row.cluster;
                  const allAppts = c.items.filter((it) => it.kind === 'appointment').map((it) => (it as { kind: 'appointment'; appointment: AutoscuolaAppointmentWithRelations }).appointment);
                  const names = [...new Set(allAppts.map((a) => a.instructor?.name).filter(Boolean))];
                  return (
                    <View key={`cluster-${i}`} style={styles.itinRow}>
                      <Rail time={itFmt(row.startMin)} sub={itFmt(row.endMin)} isFirst={isFirst} isLast={isLast} hidePill={hidePill} lineState={lineState} />
                      <Pressable onPress={() => setClusterDrawerAppts(allAppts)} style={({ pressed }) => [styles.itinCard, pressed && styles.itinCardPressed]}>
                        <View style={styles.itinTop}>
                          <View style={styles.itinAvatar}><Ionicons name="layers" size={18} color="#1A1A2E" /></View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.itinName} numberOfLines={1}>{c.items.length} guide insieme</Text>
                            <Text style={styles.itinMeta} numberOfLines={1}>{names.join(', ')}</Text>
                          </View>
                          <Ionicons name="chevron-forward" size={16} color="#9AA1AC" />
                        </View>
                      </Pressable>
                    </View>
                  );
                }
                const block = row.block;
                const isSick = block.reason === 'sick_leave';
                return (
                  <View key={`block-${block.id}`} style={styles.itinRow}>
                    <Rail time={itFmt(row.startMin)} sub={itFmt(row.endMin)} isFirst={isFirst} isLast={isLast} muted hidePill={hidePill} lineState={lineState} />
                    <Pressable
                      onPress={ownerMode ? undefined : () => Alert.alert(
                        isSick ? 'Rimuovi malattia' : 'Rimuovi blocco',
                        isSick ? 'Vuoi rimuovere la segnalazione di malattia? Le guide già cancellate non verranno ripristinate.' : `Vuoi rimuovere il blocco${block.reason ? ` "${block.reason}"` : ''} dalle ${formatTime(block.startsAt)} alle ${formatTime(block.endsAt)}?`,
                        [{ text: 'Annulla', style: 'cancel' }, { text: 'Rimuovi', style: 'destructive', onPress: () => handleDeleteBlock(block.id) }],
                      )}
                      style={({ pressed }) => [styles.itinCard, styles.itinCardMuted, pressed && styles.itinCardPressed]}
                    >
                      <View style={styles.itinTop}>
                        <View style={[styles.itinAvatar, { backgroundColor: '#F1F5F9' }]}><Ionicons name={isSick ? 'medkit' : 'lock-closed'} size={17} color={isSick ? '#EA580C' : '#94A3B8'} /></View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.itinName, { color: '#64748B' }]} numberOfLines={1}>{isSick ? 'In malattia' : (block.reason || 'Slot bloccato')}</Text>
                          <Text style={styles.itinMeta} numberOfLines={1}>{isSick ? 'Guide cancellate e allievi avvisati' : 'Non prenotabile'}</Text>
                        </View>
                      </View>
                    </Pressable>
                  </View>
                );
              };

              // Free slots across the whole working day (availability − occupied),
              // so the instructor can tap any open window to quick-book — not just
              // the gaps between two lessons.
              const canShowFree = canInstructorBook && !sickFullDay && !isSelectedDateHoliday;
              const MIN_FREE = 30;
              const occupied = rows.map((r) => [r.startMin, r.endMin] as [number, number]).sort((a, b) => a[0] - b[0]);
              // Availability is stored as many granular (e.g. 30-min) slots —
              // MERGE adjacent/overlapping ones into continuous windows so a free
              // span renders as ONE band, not a 30-min grid.
              // Loaded with zero availability windows = the day is explicitly
              // unavailable (e.g. a "giorno non disponibile" override). Only fall
              // back to the 8–20 canvas WHILE STILL LOADING — never after a load
              // that genuinely returned no availability.
              const availLoaded = availabilityCacheRef.current.has(toDateOnlyString(selectedDate));
              const dayUnavailable = availLoaded && availabilitySlots.length === 0;
              // Owner has no personal availability → no availability scaffolding
              // (markers / free bands). The itinerary becomes the pure list of all
              // instructors' guide, chronologically.
              const rawWindows: Array<[number, number]> = ownerMode
                ? []
                : availabilitySlots.length
                  ? availabilitySlots.map((s) => [s.startMinutes, s.endMinutes] as [number, number])
                  : dayUnavailable
                    ? []
                    : [[8 * 60, 20 * 60]];
              rawWindows.sort((a, b) => a[0] - b[0]);
              const windows: Array<[number, number]> = [];
              for (const w of rawWindows) {
                const last = windows[windows.length - 1];
                if (last && w[0] <= last[1]) last[1] = Math.max(last[1], w[1]);
                else windows.push([w[0], w[1]]);
              }
              // Bookable free spans = the whole working day (07–24) minus occupied
              // events — NOT clipped to availability. The instructor can quick-book
              // any open time, as long as it doesn't overlap another event.
              // `windows` (availability) stays only for the informational markers.
              const freeIntervals: Array<[number, number]> = [];
              if (canShowFree) {
                let cursor = BOOK_DAY_START;
                for (const [os, oe] of occupied) {
                  if (oe <= cursor || os >= BOOK_DAY_END) continue;
                  if (os > cursor) freeIntervals.push([cursor, Math.min(os, BOOK_DAY_END)]);
                  cursor = Math.max(cursor, oe);
                  if (cursor >= BOOK_DAY_END) break;
                }
                if (cursor < BOOK_DAY_END) freeIntervals.push([cursor, BOOK_DAY_END]);
              }
              const freeRows = freeIntervals
                .map(([s, e]) => [nowMin !== null && s < nowMin ? Math.ceil(nowMin / 15) * 15 : s, e] as [number, number])
                .filter(([s, e]) => e - s >= MIN_FREE);
              // Every bookable start across the whole day (15-min grid, ascending,
              // disjoint windows) — the shared space the hold-to-scrub walks, so a
              // hold on one free band can reach times in any other band.
              const SCRUB_STEP = 15;
              const bookableStarts: number[] = [];
              for (const [s, e] of freeRows) {
                for (let m = s; m <= e - SCRUB_STEP; m += SCRUB_STEP) bookableStarts.push(m);
              }

              // Unified, chronologically-sorted timeline: availability markers,
              // booked rows and free bands all live in ONE sorted sequence. This
              // (a) gives every (merged) availability window its own start/end
              // marker — so multiple bands and the gaps between them are explicit —
              // and (b) lets an out-of-availability lesson sort correctly BELOW the
              // end marker instead of floating above it.
              type SeqItem =
                | { kind: 'booked'; row: ItinRow; ri: number; sortMin: number; order: number }
                | { kind: 'free'; s: number; e: number; sortMin: number; order: number }
                | { kind: 'marker'; min: number; text: string; sortMin: number; order: number };
              const seq: SeqItem[] = [];
              rows.forEach((row, ri) => seq.push({ kind: 'booked', row, ri, sortMin: row.startMin, order: 1 }));
              freeRows.forEach(([s, e]) => seq.push({ kind: 'free', s, e, sortMin: s, order: 1 }));
              // One start/end marker per merged availability window. Intermediate
              // boundaries read as "Pausa" → "Ripresa disponibilità".
              const windowStartSet = new Set<number>(windows.map(([ws]) => ws));
              windows.forEach(([ws, we], wi) => {
                const isFirstWin = wi === 0;
                const isLastWin = wi === windows.length - 1;
                seq.push({ kind: 'marker', min: ws, text: isFirstWin ? 'Inizio disponibilità' : 'Ripresa disponibilità', sortMin: ws, order: 0 });
                seq.push({ kind: 'marker', min: we, text: isLastWin ? 'Fine disponibilità' : 'Pausa', sortMin: we, order: 2 });
              });
              // Chronological order; at the same minute a start marker comes first,
              // content next, an end marker last.
              seq.sort((a, b) => a.sortMin - b.sortMin || a.order - b.order);

              const renderFree = (s: number, e: number, key: string, isFirst: boolean, isLast: boolean, hidePill: boolean, showHint: boolean) => (
                <View key={key} style={styles.itinRow}>
                  <Rail time={itFmt(s)} sub={gapLabel(e - s)} isFirst={isFirst} isLast={isLast} muted hidePill={hidePill} lineState={lineStateFor(s, e)} />
                  <View style={{ flex: 1 }}>
                    <BookableBand windowStart={s} windowEnd={e} bookableStarts={bookableStarts} showHint={showHint} onPick={(min) => {
                      // The scrub may land in a DIFFERENT free band than the one held,
                      // so resolve the window that actually contains `min` (else the
                      // clamp in openQuickBookSheet would drag a cross-band pick back).
                      const win = freeRows.find(([ws, we]) => min >= ws && min < we) ?? [min, min + 15];
                      openQuickBookSheet(selectedDate, min, win[0], win[1]);
                    }} />
                  </View>
                </View>
              );

              const renderMarker = (min: number, text: string, key: string, isFirst: boolean, isLast: boolean) => {
                const past = nowMin !== null && nowMin >= min; // marker (a point in time) is behind us
                return (
                <View key={key} style={styles.itinRow}>
                  <View style={styles.itinRail}>
                    {!isFirst ? <View style={[styles.railLineTop, past && styles.lineLive]} /> : null}
                    {!isLast ? <View style={[styles.railLineBottom, past && styles.lineLive]} /> : null}
                    <View style={[styles.railPill, styles.railPillEndpoint, past && styles.railPillNow]}>
                      <Text style={[styles.railPillText, styles.railPillTextMuted, past && styles.railPillTextNow]}>{itFmt(min)}</Text>
                    </View>
                  </View>
                  <View style={styles.itinMarkerBody}>
                    <Text style={styles.itinMarkerText}>{text}</Text>
                  </View>
                </View>
                );
              };

              const lastIdx = seq.length - 1;
              const els: React.ReactNode[] = [];
              // Skip the free-floating dot when "now" is already inside a block or
              // free band (those light their own pill / split their own line).
              const nowInside = nowMin !== null && (rows.some((r) => r.startMin <= nowMin && nowMin < r.endMin) || freeRows.some(([s, e]) => s <= nowMin && nowMin < e));
              let nowShown = nowInside;
              let freeHintShown = false; // the "hold to pick" hint is shown once, on the first free slot
              seq.forEach((item, idx) => {
                const isFirst = idx === 0;
                const isLast = idx === lastIdx;
                const startMin = item.kind === 'marker' ? item.min : item.sortMin;
                if (!nowShown && nowMin !== null && nowMin < startMin && item.kind !== 'marker') {
                  // Current-time marker: a coloured dot riding ON the timeline rail
                  // (no horizontal line / label — that broke the cards' 3D feel).
                  els.push(
                    <View key={`now-${idx}`} style={styles.itinNowRow}>
                      <View style={styles.itinRail}>
                        <View style={styles.railNowLineTop} />
                        <View style={styles.railNowLineBottom} />
                        <View style={styles.railNowDot} />
                      </View>
                      <View style={{ flex: 1 }} />
                    </View>,
                  );
                  nowShown = true;
                }
                if (item.kind === 'marker') {
                  els.push(renderMarker(item.min, item.text, `mk-${idx}`, isFirst, isLast));
                } else {
                  // Drop the redundant time pill when a row/band starts exactly at
                  // a window boundary — the adjacent marker already shows that time.
                  const hidePill = windowStartSet.has(startMin);
                  if (item.kind === 'booked') els.push(renderRow(item.row, item.ri, isFirst, isLast, hidePill));
                  else {
                    els.push(renderFree(item.s, item.e, `free-${idx}`, isFirst, isLast, hidePill, !freeHintShown));
                    freeHintShown = true;
                  }
                }
              });
              return (
                <View style={styles.itinerary}>
                  {dayUnavailable && !canShowFree ? (
                    <Text style={styles.dayEmptyInline}>Nessuna disponibilità in questa giornata</Text>
                  ) : rows.length === 0 ? (
                    <Text style={styles.dayEmptyInline}>Nessuna guida oggi · tieni premuto uno slot libero per prenotare</Text>
                  ) : null}
                  {els}
                </View>
              );
            })()}

          </Animated.View>
        )}
      </Animated.ScrollView>
      </View>

      {agendaViewMode === 'week' ? (
        <>
          {/* Timeless exam banners */}
          {(() => {
            // `appointments` now spans the whole fetch window, so constrain the
            // week view's timeless-exam banners to the visible week (of selectedDate).
            const weekMon = new Date(selectedDate);
            const dow = weekMon.getDay();
            weekMon.setDate(weekMon.getDate() + (dow === 0 ? -6 : 1 - dow));
            weekMon.setHours(0, 0, 0, 0);
            const weekEnd = new Date(weekMon);
            weekEnd.setDate(weekEnd.getDate() + 6);
            weekEnd.setHours(23, 59, 59, 999);
            const weekMonMs = weekMon.getTime();
            const weekEndMs = weekEnd.getTime();
            const timelessExams = appointments.filter((a) => {
              if (a.type !== 'esame' || a.endsAt || (a.status ?? '').toLowerCase() === 'cancelled') return false;
              const t = new Date(a.startsAt).getTime();
              return t >= weekMonMs && t <= weekEndMs;
            });
            if (!timelessExams.length) return null;
            // Group by startsAt (date)
            const groups = new Map<string, typeof timelessExams>();
            for (const a of timelessExams) {
              const key = a.startsAt;
              const list = groups.get(key) ?? [];
              list.push(a);
              groups.set(key, list);
            }
            return (
              <View style={{ paddingHorizontal: 16, paddingBottom: 12, gap: 6 }}>
                {Array.from(groups.entries()).map(([startsAt, appts]) => {
                  const d = new Date(startsAt);
                  const dayLabel = d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
                  return (
                    <Pressable
                      key={`timeless-exam-${startsAt}`}
                      onPress={() => {
                        const first = appts[0];
                        openExamManage({
                          startsAt: first.startsAt,
                          endsAt: first.endsAt,
                          instructorId: first.instructorId,
                          instructorName: first.instructor?.name ?? null,
                          notes: first.notes,
                          appointments: appts,
                        });
                      }}
                      style={({ pressed }) => [{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 12,
                        backgroundColor: '#F5F0FF',
                        borderRadius: 22,
                        padding: 14,
                        shadowColor: '#8B5CF6',
                        shadowOpacity: 0.22,
                        shadowRadius: 14,
                        shadowOffset: { width: 0, height: 5 },
                        elevation: 4,
                      }, pressed && styles.itinCardPressed]}
                    >
                      <Image source={require('../../assets/icons/fluent-graduate.png')} style={styles.examGroupIcon} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.examGroupLabel}>Esame di guida · {dayLabel}</Text>
                        <Text style={styles.examGroupTitle} numberOfLines={1}>
                          {appts.length} {appts.length === 1 ? 'allievo' : 'allievi'} · Orario da definire
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            );
          })()}

          {/* Live card — current/next lesson or exam of TODAY, with inline check-in */}
          {(() => {
            // Exclude timeless exams (no time yet) — they have their own banner above.
            const today = appointments.filter((a) => isSameDay(now, a.startsAt) && !(a.type === 'esame' && !a.endsAt));
            const live = pickFeaturedLesson(today, now);
            if (!live) return null;
            const isExam = live.type === 'esame';
            const inProgress = isLessonInProgressWindow(live, now);
            const st = normalizeStatus(live.status);
            const isCheckedIn = st === 'checked_in';
            const avail = getActionAvailability(live, now, settings?.autoCheckinEnabled);
            const showActions = !ownerMode && !isExam && inProgress && avail.enabled && st !== 'proposal';
            const sameSlot = isExam
              ? today.filter((a) => a.type === 'esame' && a.startsAt === live.startsAt && (a.endsAt ?? '') === (live.endsAt ?? '') && a.instructorId === live.instructorId && normalizeStatus(a.status) !== 'cancelled')
              : [];
            const mins = Math.round((new Date(live.startsAt).getTime() - now.getTime()) / 60000);
            const topLabel = inProgress
              ? 'ADESSO · IN CORSO'
              : mins <= 0 ? 'A breve'
              : mins < 60 ? `Tra ${mins} min`
              : `Alle ${formatTime(live.startsAt)}`;
            const timeText = `${formatTime(live.startsAt)}${live.endsAt ? ` – ${formatTime(live.endsAt)}` : ''}`;
            const vehicleText = !isExam && settings?.vehiclesEnabled !== false ? (live.vehicle?.name ?? null) : null;
            const pa = pendingAction === 'checked_in' || pendingAction === 'no_show' ? pendingAction : null;
            return (
              <WeeklyLiveCard
                lesson={live}
                isExam={isExam}
                examCount={sameSlot.length}
                inProgress={inProgress}
                isCheckedIn={isCheckedIn}
                showActions={showActions}
                isPending={isPending}
                pendingAction={pa}
                topLabel={topLabel}
                timeText={timeText}
                vehicleText={vehicleText}
                onPresent={() => executeStatusAction(live, 'checked_in')}
                onAbsent={() => executeStatusAction(live, 'no_show')}
                onOpen={() => {
                  if (isExam) {
                    openExamManage({
                      startsAt: live.startsAt,
                      endsAt: live.endsAt,
                      instructorId: live.instructorId,
                      instructorName: live.instructor?.name ?? null,
                      notes: live.notes,
                      appointments: sameSlot.length ? sameSlot : [live],
                    });
                  } else {
                    openLessonDrawer(live);
                  }
                }}
              />
            );
          })()}

          <WeeklyOverview
            selectedDate={selectedDate}
            appointments={appointments}
            instructorBlocks={instructorBlocks}
            weekAvailability={weekAvailability}
            holidays={holidays}
            completedMinutes={studentCompletedMinutes}
            now={now}
            canBook={canInstructorBook}
            loading={appointmentsLoading}
            refreshing={refreshing}
            onRefresh={handleRefresh}
            onSelectDate={(date) => setSelectedDate(date)}
            onToday={() => setSelectedDate(new Date())}
            onOpenCalendar={openAgendaCalendar}
            onOpenDay={(date) => {
              const key = toDateOnlyString(date);
              const plan = computeDayPlan(date, appointments, instructorBlocks, weekAvailability[key] ?? [], {
                now,
                canBook: canInstructorBook,
                isHoliday: holidays.has(key),
                completedMinutes: studentCompletedMinutes,
              });
              dayDetailStore.set({
                date,
                plan,
                onQuickBook: openQuickBookSheet,
                onOpenLesson: openLessonDrawer,
                onOpenExam: (examAppts) => {
                  if (!examAppts.length) return;
                  const first = examAppts[0];
                  openExamManage({
                    startsAt: first.startsAt,
                    endsAt: first.endsAt,
                    instructorId: first.instructorId,
                    instructorName: first.instructor?.name ?? null,
                    notes: first.notes,
                    appointments: examAppts,
                  });
                },
                onOpenGroupLesson: (group) => {
                  openGroupLessonManage(group.id);
                },
                // Owner (sola lettura): tap su un blocco non offre la rimozione.
                onOpenBlock: ownerMode ? () => {} : (block) => {
                  const isSick = block.reason === 'sick_leave';
                  Alert.alert(
                    isSick ? 'Rimuovi malattia' : 'Rimuovi blocco',
                    isSick
                      ? 'Vuoi rimuovere la segnalazione di malattia? Le guide già cancellate non verranno ripristinate.'
                      : `Vuoi rimuovere il blocco${block.reason ? ` "${block.reason}"` : ''} dalle ${formatTime(block.startsAt)} alle ${formatTime(block.endsAt)}?`,
                    [
                      { text: 'Annulla', style: 'cancel' },
                      { text: 'Rimuovi', style: 'destructive', onPress: () => handleDeleteBlock(block.id) },
                    ],
                  );
                },
              });
              router.push('/(tabs)/home/day-detail');
            }}
          />
        </>
      ) : null}



      {agendaViewMode === 'grid' ? (
        <View style={{ flex: 1, paddingTop: safeInsets.top }}>
          {/* Header compatto (saluto + scope) */}
          <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}>
            <View style={styles.greetRow}>
              <Text style={styles.greetName} numberOfLines={1}>Ciao, {userName} {'👋'}</Text>
            </View>
            {scopeChips}
            {!initialLoading && error ? <Text style={styles.error}>{error}</Text> : null}
            {outOfAvailAppointments.length > 0 && (
              <Pressable
                onPress={() => {
                  outOfAvailStore.set({
                    appointments: outOfAvailAppointments,
                    onChanged: () => { loadOutOfAvailability(); loadData(); },
                  });
                  router.push('/(tabs)/home/out-of-availability');
                }}
                style={({ pressed }) => [oobStyles.banner, pressed && { opacity: 0.7 }]}
              >
                <View style={oobStyles.bannerIcon}>
                  <Ionicons name="alert-circle-outline" size={20} color="#1A1A2E" />
                </View>
                <Text style={oobStyles.bannerText}>
                  <Text style={oobStyles.bannerCount}>{outOfAvailAppointments.length}</Text>
                  {' '}guid{outOfAvailAppointments.length === 1 ? 'a' : 'e'} fuori disponibilità
                </Text>
                <Text style={oobStyles.bannerAction}>Gestisci</Text>
                <Ionicons name="chevron-forward" size={18} color="#C7CBD1" />
              </Pressable>
            )}
          </View>

          <WeeklyAgendaView
            appointments={appointments}
            instructorBlocks={instructorBlocks}
            holidays={holidays}
            anchorDate={selectedDate}
            readOnly={ownerMode}
            loading={appointmentsLoading}
            studentCompletedMinutes={studentCompletedMinutes}
            weekAvailabilityByDate={weekAvailability}
            onDateChange={(monday) => {
              // Aggiorna selectedDate solo se cambia settimana (evita loop col sync anchor).
              setSelectedDate((prev) => {
                const pm = new Date(prev);
                const pd = pm.getDay();
                pm.setDate(pm.getDate() + (pd === 0 ? -6 : 1 - pd));
                pm.setHours(0, 0, 0, 0);
                return pm.getTime() === monday.getTime() ? prev : monday;
              });
            }}
            onPressAppointment={openLessonDrawer}
            onPressExam={(appts) => {
              if (!appts.length) return;
              const first = appts[0];
              openExamManage({
                startsAt: first.startsAt,
                endsAt: first.endsAt,
                instructorId: first.instructorId,
                instructorName: first.instructor?.name ?? null,
                notes: first.notes,
                appointments: appts,
              });
            }}
            onPressGroupLesson={(groupLessonId) => openGroupLessonManage(groupLessonId)}
            onPressBlock={ownerMode ? undefined : (block) => {
              const isSick = block.reason === 'sick_leave';
              Alert.alert(
                isSick ? 'Rimuovi malattia' : 'Rimuovi blocco',
                isSick
                  ? 'Vuoi rimuovere la segnalazione di malattia? Le guide già cancellate non verranno ripristinate.'
                  : `Vuoi rimuovere il blocco${block.reason ? ` "${block.reason}"` : ''} dalle ${formatTime(block.startsAt)} alle ${formatTime(block.endsAt)}?`,
                [
                  { text: 'Annulla', style: 'cancel' },
                  { text: 'Rimuovi', style: 'destructive', onPress: () => handleDeleteBlock(block.id) },
                ],
              );
            }}
            onBookAt={(ownerMode || !canInstructorBook) ? undefined : (date, startMin, winStart, winEnd, durMin) => {
              openQuickBookSheet(date, startMin, winStart, winEnd, durMin);
            }}
            allowedDurations={bookingDurations}
            onGhostActiveChange={setGhostCtaActive}
          />
        </View>
      ) : null}

      {/* ── FAB Menu (nascosto per il titolare: home in sola lettura;
           e mentre la CTA del blocco fantasma occupa il fondo schermo) ── */}
      {!ownerMode && !(agendaViewMode === 'grid' && ghostCtaActive) && (
        <FabMenu
          canBook={canInstructorBook}
          canGroupLesson={settings?.groupLessonsEnabled === true}
          disabled={isPending}
          onBookLesson={openNewBooking}
          onBlockSlot={openBlockDrawer}
          onCreateExam={openCreateExam}
          onCreateGroupLesson={openCreateGroupLesson}
          onSickLeave={openSickLeaveDrawer}
        />
      )}

      {/* Screen-level scrub bubble (follows the finger during hold-to-book) */}
      <ScrubBubble />

      {/* ── Placeholder to keep old refs working ── */}
      {/* old content removed — timeline is above */}

      {/* ── Booking ── */}




      {/* ── Cluster details drawer (all-instructors scope) ── */}
      <NativePageSheet
        visible={Boolean(clusterDrawerAppts)}
        onClose={() => setClusterDrawerAppts(null)}
      >
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#EEF0F4', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="layers" size={20} color={'#1A1A2E'} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: '#1E293B' }}>
                {clusterDrawerAppts?.length ?? 0} guide contemporanee
              </Text>
              {clusterDrawerAppts?.[0] ? (
                <Text style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>
                  {formatDay(clusterDrawerAppts[0].startsAt)}
                </Text>
              ) : null}
            </View>
          </View>

          <View style={{ borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF', overflow: 'hidden' }}>
            {clusterDrawerAppts?.map((a, idx) => {
              const isLast = idx === (clusterDrawerAppts?.length ?? 0) - 1;
              const studentName = a.student ? `${a.student.firstName ?? ''} ${a.student.lastName ?? ''}`.trim() : 'Allievo';
              const instrName = a.instructor?.name ?? '';
              const cfg = timelineStatusConfig(a.status, a.type, { durationMin: 0, studentId: a.studentId });
              return (
                <Pressable
                  key={a.id}
                  onPress={() => { setClusterDrawerAppts(null); setTimeout(() => openLessonDrawer(a), 300); }}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    padding: 12,
                    borderBottomWidth: isLast ? 0 : 1,
                    borderBottomColor: '#F1F5F9',
                    backgroundColor: pressed ? '#F8FAFC' : '#FFFFFF',
                  })}
                >
                  <View style={{ width: 4, height: 36, borderRadius: 2, backgroundColor: cfg.border }} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: '#1E293B' }}>
                        {formatTime(a.startsAt)} {'\u2013'} {formatTime(a.endsAt ?? a.startsAt)}
                      </Text>
                      <View style={[styles.timelineStatusBadge, { backgroundColor: cfg.badgeBg }]}>
                        <Text style={[styles.timelineStatusText, { color: cfg.badgeText, fontSize: 9 }]}>
                          {cfg.label}
                        </Text>
                      </View>
                    </View>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#1E293B' }} numberOfLines={1}>
                      {studentName}
                    </Text>
                    {instrName ? (
                      <Text style={{ fontSize: 12, color: '#64748B' }} numberOfLines={1}>
                        {instrName}
                      </Text>
                    ) : null}
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </NativePageSheet>


    </View>
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

const FabMenu = ({
  canBook,
  canGroupLesson,
  disabled,
  onBookLesson,
  onBlockSlot,
  onCreateExam,
  onCreateGroupLesson,
  onSickLeave,
}: {
  canBook: boolean;
  canGroupLesson: boolean;
  disabled: boolean;
  onBookLesson: () => void;
  onBlockSlot: () => void;
  onCreateExam: () => void;
  onCreateGroupLesson: () => void;
  onSickLeave: () => void;
}) => {
  const router = useRouter();
  const fabScale = useSharedValue(1);
  const fabStyle = useAnimatedStyle(() => ({ transform: [{ scale: fabScale.value }] }));

  // Seed the handlers, then open the native content-hugging formSheet route.
  const openMenu = useCallback(() => {
    homeAddSheetStore.set({
      canBook,
      canGroupLesson,
      onBook: onBookLesson,
      onBlock: onBlockSlot,
      onExam: onCreateExam,
      onGroupLesson: onCreateGroupLesson,
      onSick: onSickLeave,
    });
    router.push('/(tabs)/home/add-action');
  }, [canBook, canGroupLesson, onBookLesson, onBlockSlot, onCreateExam, onCreateGroupLesson, onSickLeave, router]);

  return (
    <AnimatedPressable
      onPress={disabled ? undefined : openMenu}
      onPressIn={() => { fabScale.value = withTiming(0.92, { duration: 90 }); }}
      onPressOut={() => { fabScale.value = withTiming(1, { duration: 120 }); }}
      style={[styles.fab, disabled && { opacity: 0.5 }, fabStyle]}
    >
      <Ionicons name="add" size={28} color="#FFFFFF" />
    </AnimatedPressable>
  );
};

const COMPACT_HEADER_H = 44;
const LARGE_TITLE_H = 64;
// Max height for the in-sheet picker formsheets (instructor / location): hugs
// content for short lists, scrolls beyond this.
const PICKER_MAX_H = 460;

const scopeStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
    marginBottom: 4,
  },
});

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.xxl * 2 + spacing.md,
  },
  greetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  greetName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
    letterSpacing: 0.1,
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

  /* ── Sticky blur header (Airbnb-style) ── */
  stickyHeader: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 20,
  },
  stickyHeaderBorder: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E6E8EC',
  },
  stickyHeaderRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  stickyHeaderTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1A1A2E',
  },
  largeTitleWrap: {
    height: LARGE_TITLE_H,
    justifyContent: 'flex-end',
    paddingBottom: 2,
  },
  largeTitle: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.3,
    color: '#1A1A2E',
  },
  largeSub: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 3,
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


  /* ── Calendar Section ── */
  calendarSection: {
    gap: spacing.sm,
    backgroundColor: '#F4F5F9',
    marginHorizontal: -spacing.lg,
    // leave ~16px of breathing room between the greeting eyebrow and the panel
    // (content container adds `gap: spacing.lg`; we cancel all but ~16px)
    marginTop: -spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  calendarMonthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  calendarMonthTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1A1A2E',
    letterSpacing: -0.6,
    lineHeight: 26,
  },
  calendarMonthYear: {
    color: '#94A3B8',
    fontWeight: '600',
  },
  calendarTodayChip: {
    height: 34,
    paddingHorizontal: 15,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1A1A2E',
    shadowOpacity: 0.10,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  calendarTodayChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  calendarIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1A1A2E',
    shadowOpacity: 0.10,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  dayPillsScroll: {
    // bleed to the full panel width so cells slide off the straight panel edge
    // instead of being clipped against the panel's inner padding
    marginHorizontal: -spacing.lg,
  },
  dayPillsRow: {
    gap: 10,
    // extra vertical room so the selected pill's drop shadow (radius 18, y+10)
    // isn't clipped by the horizontal ScrollView's bounds
    paddingTop: 12,
    paddingBottom: 26,
    paddingHorizontal: spacing.lg,
  },
  dayPill: {
    width: 58,
    height: 72,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  dayPillSelected: {
    backgroundColor: '#1A1A2E',
    borderWidth: 0,
    shadowColor: '#1A1A2E',
    shadowOpacity: 0.20,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  // Minimal style: inactive days are bare on the tonal panel (no fill, no border)
  dayPillUnselected: {
    backgroundColor: 'transparent',
  },
  // Today gets a soft tonal fill (not a ring) — lighter than the selected fill
  dayPillToday: {
    backgroundColor: '#E9EBF2',
  },
  dayPillWeekday: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  dayPillWeekdaySelected: {
    color: '#FFFFFF',
  },
  dayPillWeekdayUnselected: {
    color: '#94A3B8',
  },
  dayPillWeekdayToday: {
    color: '#1A1A2E',
  },
  dayPillNumber: {
    fontSize: 20,
    fontWeight: '700',
  },
  dayPillNumberSelected: {
    color: '#FFFFFF',
  },
  dayPillNumberUnselected: {
    color: '#1A1A2E',
  },
  dayPillNumberToday: {
    color: '#1A1A2E',
  },

  dayPillDot: {
    position: 'absolute',
    bottom: 8,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#1A1A2E',
  },
  dayPillDotHighlight: {
    backgroundColor: '#FACC15',
  },
  // Exam / sick dots: absolute like the booking dot, so the weekday + number
  // stay vertically aligned across every day (inline dots used to push them up).
  dayPillExamDot: {
    backgroundColor: '#6366F1',
  },
  dayPillSickDot: {
    backgroundColor: '#EA580C',
  },
  dayPillHoliday: {
    backgroundColor: '#FEE2E2',
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
    backgroundColor: '#EEF0F4',
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
    color: '#1A1A2E',
  },
  sheetMoreBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F2F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetSaveBtn: {
    backgroundColor: '#1A1A2E',
    minHeight: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1A1A2E',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  sheetSaveText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  /* ── BottomSheet content styles ── */
  modalInfoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ECECEC',
    padding: 16,
    gap: 4,
    shadowColor: '#1A1A2E',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
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
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
  },
  contactCallBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  contactWaBtn: {
    flex: 1,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#1A1A2E',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#1A1A2E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 6,
  },
  contactWaText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.2,
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
  /* ── Grouped detail list (istruttore + luogo) ── */
  detailGroupCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ECECEC',
    shadowColor: '#1A1A2E',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 64,
  },
  detailRowPressed: {
    opacity: 0.55,
  },
  detailRowIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#EEF0F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailRowBody: {
    flex: 1,
    gap: 2,
  },
  detailRowLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#94A3B8',
  },
  detailRowValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A2E',
  },
  detailRowSub: {
    fontSize: 13,
    color: '#94A3B8',
  },
  detailDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#ECECEC',
    marginLeft: 66,
  },
  pickerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerAvatarActive: {
    backgroundColor: '#1A1A2E',
  },
  pickerName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A2E',
  },
  pickerNameActive: {
    fontWeight: '700',
  },
  /* ── Availability badge ── */
  availBadge: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  availBadgeNeutral: { backgroundColor: '#F1F5F9' },
  availBadgeNeutralText: { color: '#64748B', fontSize: 13 },
  availBadgeOk: { backgroundColor: '#ECFDF5' },
  availBadgeOkText: { color: '#047857', fontSize: 13, fontWeight: '500' },
  availBadgeBad: { backgroundColor: '#FEF2F2' },
  availBadgeBadText: { color: '#B91C1C', fontSize: 13 },
  availBadgeWarn: { backgroundColor: '#FFFBEB' },
  availBadgeWarnText: { color: '#92400E', fontSize: 13 },
  modalBookingInfoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ECECEC',
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
  sheetProgressSection: {
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#EEEDEB',
    borderRadius: 20,
    boxShadow: [
      { offsetX: 0, offsetY: 2, blurRadius: 6, spreadDistance: 0, color: 'rgba(0,0,0,0.12)', inset: true },
      { offsetX: 0, offsetY: 1, blurRadius: 2, spreadDistance: 0, color: 'rgba(0,0,0,0.06)', inset: true },
    ],
  },
  sheetProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sheetProgressLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: '#9CA3AF',
  },
  sheetProgressCount: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
  },
  sheetProgressBarBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E5E7EB',
  },
  sheetProgressBarFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#1A1A2E',
  },
  sheetProgressHint: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
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
  lessonTypeChip: {},
  notesBlock: {
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  notesTitle: {
    ...typography.body,
    color: colors.textPrimary,
  },
  notesInput: {
    minHeight: 110,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ECECEC',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#1A1A2E',
    backgroundColor: '#F7F7F8',
    textAlignVertical: 'top',
    fontSize: 15,
    lineHeight: 22,
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
    color: '#1A1A2E',
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
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ECECEC',
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 12,
    shadowColor: '#1A1A2E',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  nextBannerLive: {
    backgroundColor: '#EEF0F4',
    borderColor: '#D6D9E0',
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
    backgroundColor: '#1A1A2E',
  },
  nextBannerLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1A1A2E',
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
  emptyDayIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#EEF0F4',
    alignItems: 'center',
    justifyContent: 'center',
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

  /* ── Empty state (Fluent, centered) ── */
  dayEmpty: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24 },
  dayEmptyImg: { width: 76, height: 76, resizeMode: 'contain', marginBottom: 16 },
  dayEmptyTitle: { fontSize: 19, fontWeight: '700', color: '#1A1A2E', letterSpacing: -0.3 },
  dayEmptySub: { fontSize: 14, fontWeight: '500', color: '#94A3B8', marginTop: 6, textAlign: 'center', lineHeight: 20, maxWidth: 280 },
  dayEmptyCta: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 20,
    backgroundColor: '#1A1A2E', paddingVertical: 13, paddingHorizontal: 22, borderRadius: 26,
    shadowColor: '#1A1A2E', shadowOpacity: 0.22, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  dayEmptyCtaText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.2 },

  /* ── Itinerary list (Airbnb-style day view) ── */
  itinerary: { marginBottom: 12 },
  itinRow: { flexDirection: 'row', alignItems: 'stretch' },
  itinRail: { width: 84, paddingTop: 16, alignItems: 'center', position: 'relative' },
  // Line linking the time pills, with a small gap above/below each pill.
  railLineTop: { position: 'absolute', left: 41, top: 0, height: 12, width: 2, backgroundColor: '#E6E8EC', borderRadius: 1 },
  railLineBottom: { position: 'absolute', left: 41, top: 46, bottom: -14, width: 2, backgroundColor: '#E6E8EC', borderRadius: 1 },
  railLineFull: { position: 'absolute', left: 41, top: 0, bottom: -14, width: 2, backgroundColor: '#E6E8EC', borderRadius: 1 },
  railPill: {
    minHeight: 26, minWidth: 52, paddingHorizontal: 9, justifyContent: 'center', alignItems: 'center',
    borderRadius: 13, backgroundColor: '#EEF0F4',
  },
  railPillMuted: { backgroundColor: '#F1F3F7' },
  railPillEndpoint: { backgroundColor: '#F1F3F7' },
  railPillNow: { backgroundColor: '#DCFCE7' },
  railPillText: { fontSize: 13, fontWeight: '700', color: '#1A1A2E', letterSpacing: -0.2, fontVariant: ['tabular-nums'] },
  railPillTextMuted: { color: '#94A3B8' },
  railPillTextNow: { color: '#16A34A' },
  // Past portion of the rail is illuminated (green); future stays grey.
  lineLive: { backgroundColor: '#22C55E' },
  // In-progress lesson rail: start pill (light green) + current-time pill (solid green).
  itinRailNow: { width: 84, paddingTop: 16, alignItems: 'center', position: 'relative' },
  railFlowMid: { width: 2, height: 14, backgroundColor: '#22C55E', borderRadius: 1, marginVertical: 3 },
  railFlowFill: { width: 2, flex: 1, minHeight: 12, backgroundColor: '#E6E8EC', borderRadius: 1, marginTop: 3, marginBottom: -14 },
  railPillCurrent: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8 },
  railCurrentDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#16A34A' },
  // Current-time marker: a coloured dot centred on the rail line (left 41, w2 → centre 42),
  // green line above (past), grey below (future).
  itinNowRow: { flexDirection: 'row', height: 18 },
  railNowLineTop: { position: 'absolute', left: 41, top: 0, height: 9, width: 2, backgroundColor: '#22C55E', borderRadius: 1 },
  railNowLineBottom: { position: 'absolute', left: 41, top: 9, bottom: -14, width: 2, backgroundColor: '#E6E8EC', borderRadius: 1 },
  railNowDot: { position: 'absolute', left: 36, top: 3, width: 12, height: 12, borderRadius: 6, backgroundColor: '#16A34A', borderWidth: 2.5, borderColor: '#FFFFFF', zIndex: 3 },
  itinCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 14,
    marginBottom: 14,
    shadowColor: '#1A1A2E',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  // Active (in-progress) lesson: stays a 3D card — MORE elevated, never a flat outline.
  itinCardActive: { shadowOpacity: 0.16, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 7 },
  itinCardMuted: { backgroundColor: '#F7F8FA', shadowOpacity: 0, elevation: 0 },
  itinCardPressed: { opacity: 0.95, transform: [{ scale: 0.992 }] },
  // Exam card — student-app language (lavender surface + Fluent 3D icon), no right tag.
  examGroupCard: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#F5F0FF', borderRadius: 22, padding: 14, marginBottom: 14,
    shadowColor: '#8B5CF6', shadowOpacity: 0.22, shadowRadius: 14, shadowOffset: { width: 0, height: 5 }, elevation: 4,
  },
  examGroupIcon: { width: 42, height: 42 },
  examGroupLabel: { fontSize: 12, fontWeight: '600', color: '#7C3AED' },
  examGroupTitle: { fontSize: 16, fontWeight: '600', color: '#1A1A2E', letterSpacing: -0.2, marginTop: 2 },
  // Group-lesson card — bigger than a normal lesson, teal accent, NO student name.
  groupLessonCard: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#ECFDF5', borderRadius: 22, paddingVertical: 20, paddingHorizontal: 16, marginBottom: 14,
    shadowColor: '#10B981', shadowOpacity: 0.2, shadowRadius: 14, shadowOffset: { width: 0, height: 5 }, elevation: 4,
  },
  groupLessonIcon: { width: 48, height: 48 },
  groupLessonLabel: { fontSize: 12.5, fontWeight: '600', color: '#0F766E' },
  groupLessonTitle: { fontSize: 16, fontWeight: '600', color: '#1A1A2E', letterSpacing: -0.2, marginTop: 2 },
  glSeats: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 9 },
  glSeat: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#0F766E' },
  glSeatEmpty: { backgroundColor: '#A7D8CE' },
  glSeatsText: { fontSize: 12, fontWeight: '500', color: '#0F766E', marginLeft: 4 },
  itinTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  itinAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#EEF0F4', alignItems: 'center', justifyContent: 'center' },
  itinAvatarText: { fontSize: 15, fontWeight: '700', color: '#1A1A2E' },
  itinName: { fontSize: 16, fontWeight: '700', color: '#1A1A2E', letterSpacing: -0.2 },
  itinMeta: { fontSize: 13, fontWeight: '500', color: '#94A3B8', marginTop: 2 },
  itinStatusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, marginLeft: 8, flexShrink: 0 },
  itinStatusPillText: { fontSize: 11.5, fontWeight: '700', letterSpacing: 0.1 },
  itinActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  itinActBtn: { flex: 1, minHeight: 46, paddingVertical: 11, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  itinActCheck: { backgroundColor: '#1A1A2E' },
  itinActCheckText: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  itinActNo: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: '#E9EBF2' },
  itinActNoText: { fontSize: 14, fontWeight: '600', color: '#64748B' },
  itinGapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginLeft: 64,
    marginBottom: 14,
    marginTop: -4,
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E6E6EA',
    borderStyle: 'dashed',
  },
  itinGapText: { fontSize: 13, fontWeight: '600', color: '#9AA1AC' },
  itinGapAdd: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  itinGapAddText: { fontSize: 13, fontWeight: '700', color: '#1A1A2E' },
  itinFree: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, paddingHorizontal: 14, marginBottom: 14,
    borderRadius: 18, borderWidth: 1.5, borderColor: '#E6E6EA', borderStyle: 'dashed',
    backgroundColor: 'transparent',
  },
  itinFreeAdd: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#EEF0F4', alignItems: 'center', justifyContent: 'center' },
  itinFreeTitle: { fontSize: 14, fontWeight: '700', color: '#1A1A2E', letterSpacing: -0.1 },
  itinFreeSub: { fontSize: 12, fontWeight: '500', color: '#9AA1AC', marginTop: 1 },
  itinMarkerBody: { flex: 1, paddingTop: 22, marginBottom: 14 },
  itinMarkerText: { fontSize: 13, fontWeight: '700', color: '#475569', letterSpacing: 0.1 },
  dayEmptyInline: { fontSize: 13, fontWeight: '500', color: '#9AA1AC', textAlign: 'center', marginTop: 4, marginBottom: 16, paddingHorizontal: 24, lineHeight: 18 },
  itinNowBody: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 22, marginBottom: 14 },
  itinNowLine: { flex: 1, height: 1.5, backgroundColor: '#EF4444', opacity: 0.45 },
  itinNowLabel: { fontSize: 11, fontWeight: '700', color: '#EF4444' },
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
    overflow: 'hidden' as const,
  },
  timelineBlockActive: {
    backgroundColor: '#F4F5F9',
    borderLeftWidth: 5,
    borderLeftColor: '#1A1A2E',
    borderColor: '#D6D9E6',
    shadowColor: '#1A1A2E',
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
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1A1A2E',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1A1A2E',
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
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
    marginTop: spacing.sm,
    marginBottom: 10,
    shadowColor: '#1A1A2E',
    shadowOpacity: 0.07,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  bannerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F4F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerText: {
    flex: 1,
    fontSize: 14,
    color: '#1A1A2E',
  },
  bannerCount: {
    fontWeight: '600',
    color: '#1A1A2E',
  },
  bannerAction: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#1A1A2E',
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
    backgroundColor: '#EEF0F4',
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
    color: '#14141F',
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
    borderColor: '#1A1A2E',
    backgroundColor: '#1A1A2E',
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
