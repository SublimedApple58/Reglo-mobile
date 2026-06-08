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
  PanResponder,
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
  Extrapolation,
  useAnimatedScrollHandler,
  Easing,
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
import { manageLessonStore, type ManageLessonData, type ManageLessonDetailsPayload } from '../stores/manageLessonStore';
import { swapStore } from '../stores/swapStore';
import { rescheduleStore } from '../stores/rescheduleStore';
import { Input } from '../components/Input';
import { CalendarDrawer } from '../components/CalendarDrawer';
import { dayPickerStore } from '../stores/dayPickerStore';
import { quickBookStore } from '../stores/quickBookStore';
import { BookableBand, ScrubBubble } from '../components/BookableBand';
import { RescheduleAppointmentSheet } from '../components/RescheduleAppointmentSheet';
import { InlineLocationPicker } from '../components/InlineLocationPicker';
import { InlineLocationForm } from '../components/InlineLocationForm';
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
  AutoscuolaInstructor,
  AutoscuolaLocation,
  AutoscuolaSettings,
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
  if (status === 'proposal') {
    return { label: 'Proposta', tone: 'pending_review' as const };
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

const InlineCalendarPicker = ({ selectedDate, maxWeeks = 4, onSelectDate, bookedDates }: {
  selectedDate: Date;
  maxWeeks?: number;
  onSelectDate: (date: Date) => void;
  bookedDates?: Set<string>;
}) => {
  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);
  const [month, setMonth] = useState(() => calFirstOfMonth(selectedDate));
  const maxDate = useMemo(() => { const d = new Date(today); d.setDate(d.getDate() + maxWeeks * 7); return d; }, [today, maxWeeks]);
  const minMonth = useMemo(() => calFirstOfMonth(today), [today]);
  const maxMonth = useMemo(() => calFirstOfMonth(maxDate), [maxDate]);
  const canPrev = month.getTime() > minMonth.getTime();
  const canNext = month.getTime() < maxMonth.getTime();
  const cells = useMemo(() => {
    const start = calMondayBefore(calFirstOfMonth(month));
    return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(d.getDate() + i); d.setHours(0,0,0,0); return d; });
  }, [month]);

  return (
    <View style={{ paddingVertical: 4 }}>
      {/* Month navigation */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
        <Pressable
          onPress={() => canPrev && setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
          disabled={!canPrev}
          style={[{ width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }, !canPrev && { opacity: 0.35 }]}
        >
          <Text style={{ fontSize: 22, color: '#1E293B', lineHeight: 26 }}>{'\u2039'}</Text>
        </Pressable>
        <Text style={{ fontSize: 18, fontWeight: '700', color: '#1E293B' }}>{CAL_MONTHS[month.getMonth()]} {month.getFullYear()}</Text>
        <Pressable
          onPress={() => canNext && setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
          disabled={!canNext}
          style={[{ width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }, !canNext && { opacity: 0.35 }]}
        >
          <Text style={{ fontSize: 22, color: '#1E293B', lineHeight: 26 }}>{'\u203A'}</Text>
        </Pressable>
      </View>
      {/* Weekday headers */}
      <View style={{ flexDirection: 'row', marginBottom: 4 }}>
        {CAL_WEEKDAYS.map((wd) => (
          <View key={wd} style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#94A3B8' }}>{wd}</Text>
          </View>
        ))}
      </View>
      {/* Grid */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {cells.map((date, idx) => {
          const inMonth = calSameMonth(date, month);
          const isToday = calSameDay(date, today);
          const isSelected = calSameDay(date, selectedDate) && !isToday;
          const inRange = date >= today && date <= maxDate;
          const tappable = inMonth && inRange;
          const hasBooking = inMonth && bookedDates?.has(
            `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
          );
          return (
            <Pressable key={idx} onPress={tappable ? () => onSelectDate(date) : undefined} disabled={!tappable}
              style={{ width: '14.2857%', alignItems: 'center', justifyContent: 'center', paddingVertical: 3 }}>
              <View style={[
                { width: CAL_CELL, height: CAL_CELL, borderRadius: CAL_CELL / 2, alignItems: 'center', justifyContent: 'center' },
                isToday && { borderWidth: 2, borderColor: '#FACC15' },
                isSelected && { backgroundColor: '#1A1A2E' },
              ]}>
                <Text style={[
                  { fontSize: 15, fontWeight: '600', color: '#1E293B' },
                  !inMonth && { color: '#E2E8F0' },
                  isToday && { fontWeight: '700' },
                  isSelected && { color: '#FFFFFF', fontWeight: '700' },
                  (inMonth && !inRange) && { color: '#CBD5E1' },
                ]}>{date.getDate()}</Text>
              </View>
              {hasBooking ? (
                <View style={[
                  { position: 'absolute', bottom: 2, width: 6, height: 6, borderRadius: 3, backgroundColor: '#1A1A2E' },
                  (isSelected || isToday) && { backgroundColor: '#FACC15' },
                ]} />
              ) : null}
            </Pressable>
          );
        })}
      </View>
      <View style={{ alignItems: 'center', paddingTop: spacing.sm, paddingBottom: spacing.md, gap: 8 }}>
        <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#EEF0F4', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="calendar-outline" size={26} color="#1A1A2E" />
        </View>
        <Text style={{ fontSize: 14, color: '#94A3B8' }}>
          Puoi navigare fino a {maxWeeks} settimane
        </Text>
      </View>
    </View>
  );
};

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

export const IstruttoreHomeScreen = () => {
  const router = useRouter();
  const { instructorId, user, autoscuolaRole } = useSession();
  const { height: windowHeight, width: screenWidth } = useWindowDimensions();
  const safeInsets = useSafeAreaInsets();
  const canSwitchScope = autoscuolaRole === 'INSTRUCTOR_OWNER';
  const [calendarScope, setCalendarScope] = useState<'personal' | 'all'>('personal');
  const effectiveInstructorId = calendarScope === 'all' ? undefined : instructorId;
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
  const [sheetStudentProgress, setSheetStudentProgress] = useState<{ completed: number; required: number } | null>(null);
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
  const [examDrawerMode, setExamDrawerMode] = useState<'details' | 'timepicker'>('details');
  const [examTimeSaving, setExamTimeSaving] = useState(false);
  const [clusterDrawerAppts, setClusterDrawerAppts] = useState<AutoscuolaAppointmentWithRelations[] | null>(null);
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
  const [blockSheetMode, setBlockSheetMode] = useState<'form' | 'calendar' | 'startTime' | 'endTime'>('form');
  // Sick leave state
  const [sickSheetOpen, setSickSheetOpen] = useState(false);
  const [sickStartDate, setSickStartDate] = useState<Date>(() => new Date());
  const [sickEndDate, setSickEndDate] = useState<Date>(() => new Date());
  const [sickMultiDay, setSickMultiDay] = useState(false);
  const [sickHalfDay, setSickHalfDay] = useState(false);
  const [sickStartTime, setSickStartTime] = useState<Date>(() => { const d = new Date(); d.setHours(14, 0, 0, 0); return d; });
  const [sickPending, setSickPending] = useState(false);
  const [sickSheetMode, setSickSheetMode] = useState<'form' | 'startCalendar' | 'endCalendar' | 'timePicker'>('form');
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
  const [bookingLocationId, setBookingLocationId] = useState<string | null>(null);
  const [bookingLocationName, setBookingLocationName] = useState<string | null>(null);
  const [bookingLocationAddress, setBookingLocationAddress] = useState<string | null>(null);
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
  // ── Quick-book state (Google Calendar-style tap-to-create) ──
  const [quickBookOpen, setQuickBookOpen] = useState(false);
  const [quickBookDate, setQuickBookDate] = useState<Date>(new Date());
  const [quickBookHour, setQuickBookHour] = useState(9);
  const [quickBookMinutes, setQuickBookMinutes] = useState(0);
  const [quickBookDuration, setQuickBookDuration] = useState(60);
  const [quickBookStudentId, setQuickBookStudentId] = useState('');
  const [quickBookPending, setQuickBookPending] = useState(false);
  const [quickBookType, setQuickBookType] = useState<'lesson' | 'block'>('lesson');
  const [quickBookReason, setQuickBookReason] = useState('');
  const [qbHandleDragging, setQbHandleDragging] = useState(false);
  // Refs for quick-book drag handles
  const qbCurrentRef = useRef({ hour: 9, min: 0, dur: 60 });
  const qbDragOrigin = useRef({ hour: 9, min: 0, dur: 60 });
  const qbAllowedDurRef = useRef<number[]>([60]);
  const qbTypeRef = useRef<'lesson' | 'block'>('lesson');
  useEffect(() => {
    qbCurrentRef.current = { hour: quickBookHour, min: quickBookMinutes, dur: quickBookDuration };
  }, [quickBookHour, quickBookMinutes, quickBookDuration]);

  // Occupied intervals for collision detection (sorted by start)
  const qbOccupiedRef = useRef<Array<{ start: number; end: number }>>([]);
  useEffect(() => {
    const dayKey = `${quickBookDate.getFullYear()}-${String(quickBookDate.getMonth() + 1).padStart(2, '0')}-${String(quickBookDate.getDate()).padStart(2, '0')}`;
    const intervals: Array<{ start: number; end: number }> = [];
    for (const appt of appointments) {
      const s = new Date(appt.startsAt);
      if (`${s.getFullYear()}-${String(s.getMonth() + 1).padStart(2, '0')}-${String(s.getDate()).padStart(2, '0')}` !== dayKey) continue;
      if ((appt.status ?? '').toLowerCase() === 'cancelled') continue;
      const e = appt.endsAt ? new Date(appt.endsAt) : new Date(s.getTime() + 60 * 60 * 1000);
      intervals.push({ start: s.getHours() * 60 + s.getMinutes(), end: e.getHours() * 60 + e.getMinutes() });
    }
    for (const block of instructorBlocks) {
      const s = new Date(block.startsAt);
      if (`${s.getFullYear()}-${String(s.getMonth() + 1).padStart(2, '0')}-${String(s.getDate()).padStart(2, '0')}` !== dayKey) continue;
      const e = new Date(block.endsAt);
      intervals.push({ start: s.getHours() * 60 + s.getMinutes(), end: e.getHours() * 60 + e.getMinutes() });
    }
    intervals.sort((a, b) => a.start - b.start);
    qbOccupiedRef.current = intervals;
  }, [quickBookDate, appointments, instructorBlocks]);

  // Clamp a proposed [start, start+dur) range so it doesn't overlap any occupied interval
  const clampToFreeSlot = (proposedStart: number, dur: number): number => {
    const occupied = qbOccupiedRef.current;
    let start = proposedStart;
    for (const iv of occupied) {
      if (start < iv.end && start + dur > iv.start) {
        // Overlap detected — try to snap before or after
        const before = iv.start - dur;
        const after = iv.end;
        // Pick whichever is closer to the proposed start
        if (before >= 0 && Math.abs(before - proposedStart) <= Math.abs(after - proposedStart)) {
          start = before;
        } else {
          start = after;
        }
      }
    }
    // Final check: ensure the new position also doesn't overlap
    for (const iv of occupied) {
      if (start < iv.end && start + dur > iv.start) {
        return qbCurrentRef.current.hour * 60 + qbCurrentRef.current.min; // revert
      }
    }
    return start;
  };

  // Clamp a proposed duration so the block end doesn't overlap the next occupied interval
  const clampDuration = (start: number, proposedDur: number): number => {
    const occupied = qbOccupiedRef.current;
    let maxEnd = 21 * 60;
    for (const iv of occupied) {
      if (iv.start > start) {
        maxEnd = Math.min(maxEnd, iv.start);
        break;
      }
    }
    return Math.min(proposedDur, maxEnd - start);
  };

  // Top handle: moves start time in 15-min steps, keeps duration fixed
  const qbTopPan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onShouldBlockNativeResponder: () => true,
    onPanResponderGrant: () => {
      qbDragOrigin.current = { ...qbCurrentRef.current };
      setQbHandleDragging(true);
    },
    onPanResponderMove: (_, g) => {
      const delta = Math.round((g.dy / ROW_H) * 60 / 15) * 15;
      const origStart = qbDragOrigin.current.hour * 60 + qbDragOrigin.current.min;
      const dur = qbDragOrigin.current.dur;
      const rawStart = Math.max(0, Math.min(21 * 60 - dur, origStart + delta));
      const newStart = clampToFreeSlot(rawStart, dur);
      setQuickBookHour(Math.floor(newStart / 60));
      setQuickBookMinutes(newStart % 60);
    },
    onPanResponderRelease: () => setQbHandleDragging(false),
    onPanResponderTerminate: () => setQbHandleDragging(false),
  }), []);
  // Bottom handle: snaps duration to nearest allowed value
  const qbBottomPan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onShouldBlockNativeResponder: () => true,
    onPanResponderGrant: () => {
      qbDragOrigin.current = { ...qbCurrentRef.current };
      setQbHandleDragging(true);
    },
    onPanResponderMove: (_, g) => {
      const delta = Math.round((g.dy / ROW_H) * 60 / 15) * 15;
      const origStart = qbDragOrigin.current.hour * 60 + qbDragOrigin.current.min;
      const origEnd = origStart + qbDragOrigin.current.dur;
      const rawDur = origEnd + delta - origStart;
      if (qbTypeRef.current === 'block') {
        // Block: free-form 15-min snapping, clamped to next occupied slot
        const clamped = clampDuration(origStart, Math.max(15, Math.min(21 * 60 - origStart, rawDur)));
        setQuickBookDuration(clamped);
      } else {
        // Lesson: snap to allowed durations, then clamp
        const allowed = qbAllowedDurRef.current;
        const snapped = allowed.reduce((best, d) =>
          Math.abs(d - rawDur) < Math.abs(best - rawDur) ? d : best,
        );
        const clamped = clampDuration(origStart, snapped);
        setQuickBookDuration(clamped);
      }
    },
    onPanResponderRelease: () => setQbHandleDragging(false),
    onPanResponderTerminate: () => setQbHandleDragging(false),
  }), []);
  const qbHeaderCollapse = useSharedValue(1);
  useEffect(() => {
    qbHeaderCollapse.value = withTiming(quickBookOpen ? 0 : 1, { duration: 250 });
  }, [quickBookOpen]);
  const qbHeaderStyle = useAnimatedStyle(() => ({
    opacity: qbHeaderCollapse.value,
    maxHeight: interpolate(qbHeaderCollapse.value, [0, 1], [0, 200]),
    overflow: 'hidden' as const,
  }));

  /* Header: greeting scrolls away; month + day pills pin via the ScrollView's
     native stickyHeaderIndices (no custom scroll-driven animation needed). */
  const qbDrawerTranslate = useSharedValue(400);
  useEffect(() => {
    qbDrawerTranslate.value = quickBookOpen
      ? withTiming(0, { duration: 220 })
      : withTiming(400, { duration: 180 });
  }, [quickBookOpen]);
  const qbDrawerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: qbDrawerTranslate.value }],
  }));
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const rangeKeyRef = useRef<string | null>(null);
  const loadRequestRef = useRef(0);
  const lessonSheetScrollRef = useRef<ScrollView | null>(null);
  const bookingSheetScrollRef = useRef<ScrollView | null>(null);
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [agendaViewMode, setAgendaViewMode] = useState<'day' | 'week'>('day');
  const [calendarDrawerOpen, setCalendarDrawerOpen] = useState(false);
  const [guidedCalendarOpen, setGuidedCalendarOpen] = useState(false);
  const [bookingSheetMode, setBookingSheetMode] = useState<'form' | 'calendar' | 'timepicker' | 'locationPicker' | 'locationForm'>('form');
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
  const queryClient = useQueryClient();

  // ── Query hooks for cold-start cache hydration ──
  const bootstrapParams = useMemo(() => {
    if (!instructorId) return null;
    const from = calendarRange ? new Date(calendarRange.from) : new Date();
    const to = calendarRange ? new Date(calendarRange.to) : new Date();
    if (!calendarRange) {
      from.setDate(from.getDate() - 1);
      from.setHours(0, 0, 0, 0);
      to.setDate(to.getDate() + 14);
      to.setHours(23, 59, 59, 999);
    }
    return {
      ...(effectiveInstructorId ? { instructorId: effectiveInstructorId } : {}),
      from: from.toISOString(),
      to: to.toISOString(),
      limit: 280,
    };
  }, [instructorId, calendarRange, effectiveInstructorId]);

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
            ...(effectiveInstructorId ? { instructorId: effectiveInstructorId } : {}),
            from: from.toISOString(),
            to: to.toISOString(),
            limit: 280,
          }),
          regloApi.getAppointments({
            ...(effectiveInstructorId ? { instructorId: effectiveInstructorId } : {}),
            from: featuredFrom.toISOString(),
            to: featuredTo.toISOString(),
            limit: 220,
            light: true,
          }),
          regloApi.getAutoscuolaSettings(),
          // Lightweight fetch of sick_leave blocks over wide range for calendar dots
          regloApi.getInstructorBlocks({
            instructorId: effectiveInstructorId ?? instructorId!,
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
  }, [calendarRange, instructorId, effectiveInstructorId]);

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
  qbAllowedDurRef.current = bookingDurations;
  qbTypeRef.current = quickBookType;
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
    setBlockSheetMode('form');
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
  }, [blockDate, blockStartTime, blockEndTime, blockReason, blockRecurring, blockRecurringWeeks, loadData]);

  const openSickLeaveDrawer = useCallback(() => {
    setSickStartDate(new Date());
    setSickEndDate(new Date());
    setSickMultiDay(false);
    setSickHalfDay(false);
    const defaultTime = new Date();
    defaultTime.setHours(14, 0, 0, 0);
    setSickStartTime(defaultTime);
    setSickSheetMode('form');
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
    // Pre-populate location with the autoscuola's default sede
    setBookingLocationId(defaultLocation?.id ?? null);
    setBookingLocationName(defaultLocation?.name ?? null);
    setBookingLocationAddress(defaultLocation?.address ?? null);
    setBookingSheetMode('form');
    setBookingSheetOpen(true);
  }, [canInstructorBook, normalizeToQuarter, settings?.bookingSlotDurations, students, vehicles, selectedDate, defaultLocation, clusterDurations]);

  const openQuickBook = useCallback((date: Date, hour: number, minutes: number) => {
    if (!canInstructorBook) {
      setToast({
        text: 'La prenotazione da app è abilitata solo per allievi.',
        tone: 'info',
      });
      return;
    }
    // Check if the tapped slot overlaps with any existing appointment or block
    const tapStart = hour * 60 + minutes;
    const dayKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const hasCollision = [...appointments, ...instructorBlocks.map((b) => ({ startsAt: b.startsAt, endsAt: b.endsAt, status: 'active' }))].some((item) => {
      const s = new Date(item.startsAt);
      if (`${s.getFullYear()}-${String(s.getMonth() + 1).padStart(2, '0')}-${String(s.getDate()).padStart(2, '0')}` !== dayKey) return false;
      if ('status' in item && typeof item.status === 'string' && item.status.toLowerCase() === 'cancelled') return false;
      const e = item.endsAt ? new Date(item.endsAt) : new Date(s.getTime() + 60 * 60 * 1000);
      const iStart = s.getHours() * 60 + s.getMinutes();
      const iEnd = e.getHours() * 60 + e.getMinutes();
      return tapStart >= iStart && tapStart < iEnd;
    });
    if (hasCollision) return;
    const allowedDurations = (clusterDurations ?? settings?.bookingSlotDurations ?? [30, 60])
      .slice()
      .sort((a, b) => a - b);
    const dur = allowedDurations.includes(60) ? 60 : allowedDurations[0] ?? 60;
    // Find max duration before next occupied slot
    let maxEnd = 21 * 60;
    for (const item of [...appointments, ...instructorBlocks.map((b) => ({ startsAt: b.startsAt, endsAt: b.endsAt, status: 'active' }))]) {
      const s = new Date(item.startsAt);
      if (`${s.getFullYear()}-${String(s.getMonth() + 1).padStart(2, '0')}-${String(s.getDate()).padStart(2, '0')}` !== dayKey) continue;
      if ('status' in item && typeof item.status === 'string' && item.status.toLowerCase() === 'cancelled') continue;
      const iStart = s.getHours() * 60 + s.getMinutes();
      if (iStart > tapStart && iStart < maxEnd) maxEnd = iStart;
    }
    const clampedDur = Math.min(dur, maxEnd - tapStart);
    if (clampedDur < 15) return; // not enough space
    setQuickBookDate(date);
    setQuickBookHour(hour);
    setQuickBookMinutes(minutes);
    setQuickBookDuration(clampedDur);
    setQuickBookStudentId('');
    setQuickBookType('lesson');
    setQuickBookReason('');
    setQuickBookOpen(true);
  }, [canInstructorBook, clusterDurations, settings?.bookingSlotDurations, appointments, instructorBlocks]);

  const handleQuickBookConfirm = useCallback(async () => {
    if (!quickBookStudentId) {
      setToast({ text: 'Seleziona un allievo.', tone: 'danger' });
      return;
    }
    if (!instructorId) {
      setToast({ text: 'Profilo istruttore non disponibile.', tone: 'danger' });
      return;
    }
    const start = new Date(quickBookDate);
    start.setHours(quickBookHour, quickBookMinutes, 0, 0);
    const end = new Date(start.getTime() + quickBookDuration * 60 * 1000);

    setQuickBookPending(true);
    setToast(null);

    const doBook = async (skipWeeklyLimitCheck = false) => {
      await regloApi.confirmInstructorBooking({
        studentId: quickBookStudentId,
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
        instructorId,
        vehicleId: settings?.vehiclesEnabled !== false ? (vehicles[0]?.id ?? null) : null,
        ...(skipWeeklyLimitCheck ? { skipWeeklyLimitCheck: true } : {}),
      });
    };

    try {
      await doBook();
      setQuickBookOpen(false);
      setToast({ text: 'Guida prenotata.', tone: 'success' });
      await loadData();
    } catch (err: unknown) {
      const payload = (err as { payload?: Record<string, unknown> })?.payload;
      if (payload?.code === 'WEEKLY_LIMIT_CONFIRM') {
        setQuickBookPending(false);
        const msg = typeof payload.message === 'string'
          ? payload.message
          : "L'allievo ha raggiunto il limite settimanale. Vuoi procedere comunque?";
        Alert.alert('Limite settimanale', msg, [
          { text: 'Annulla', style: 'cancel' },
          {
            text: 'Procedi',
            onPress: async () => {
              setQuickBookPending(true);
              try {
                await doBook(true);
                setQuickBookOpen(false);
                setToast({ text: 'Guida prenotata.', tone: 'success' });
                await loadData();
              } catch (retryErr) {
                setToast({
                  text: retryErr instanceof Error ? retryErr.message : 'Errore nella prenotazione',
                  tone: 'danger',
                });
              } finally {
                setQuickBookPending(false);
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
      setQuickBookPending(false);
    }
  }, [quickBookStudentId, quickBookDate, quickBookHour, quickBookMinutes, quickBookDuration, instructorId, settings?.vehiclesEnabled, vehicles, loadData]);

  const handleQuickBlockConfirm = useCallback(async () => {
    const start = new Date(quickBookDate);
    start.setHours(quickBookHour, quickBookMinutes, 0, 0);
    const end = new Date(start.getTime() + quickBookDuration * 60 * 1000);

    setQuickBookPending(true);
    try {
      await regloApi.createInstructorBlock({
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
        ...(quickBookReason.trim() ? { reason: quickBookReason.trim() } : {}),
      });
      setQuickBookOpen(false);
      setToast({ text: 'Slot bloccato.', tone: 'success' });
      await loadData();
    } catch (err) {
      setToast({
        text: err instanceof Error ? err.message : 'Errore nel blocco slot',
        tone: 'danger',
      });
    } finally {
      setQuickBookPending(false);
    }
  }, [quickBookDate, quickBookHour, quickBookMinutes, quickBookDuration, quickBookReason, loadData]);

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
    if (settings?.vehiclesEnabled !== false && !bookingVehicleId) {
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
        vehicleId: settings?.vehiclesEnabled !== false ? (guidedSuggestion?.vehicleId ?? bookingVehicleId) : null,
        locationId: bookingLocationId,
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
    if (settings?.vehiclesEnabled !== false && !bookingVehicleId) {
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
        vehicleId: settings?.vehiclesEnabled !== false ? bookingVehicleId : null,
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
    // END is the last visible hour-slot label. The grid extends through 24:00
    // so events/blocks ending up to midnight are fully visible.
    const END = 24;
    let earliest = DEFAULT_START;
    // Check availability
    for (const h of availableHours) {
      if (h < earliest) earliest = h;
    }
    // Check appointments (skip timeless exams — they render as banners, not in the grid)
    for (const appt of appointments) {
      if (appt.type === 'esame' && !appt.endsAt) continue;
      const h = new Date(appt.startsAt).getHours();
      if (normalizeStatus(appt.status) !== 'cancelled' && h < earliest) earliest = h;
    }
    // Also extend earliest backwards for instructor blocks (e.g. a 06:00 block).
    for (const block of instructorBlocks) {
      const h = new Date(block.startsAt).getHours();
      if (h < earliest) earliest = h;
    }
    return Array.from({ length: END - earliest + 1 }, (_, i) => i + earliest);
  }, [availableHours, appointments, instructorBlocks]);

  // Raw (non-grouped) list — used for counts, stats, etc.
  const timelineAppointments = useMemo(() => {
    return [...appointments].sort((a, b) => getStartsAtTs(a) - getStartsAtTs(b));
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
    if (s === 'pending_review')
      return { border: '#F97316', badgeBg: '#FFF7ED', badgeText: '#EA580C', label: 'Da confermare', isExam: false as const };
    if (s === 'checked_in')
      return { border: '#1A1A2E', badgeBg: '#EEF0F4', badgeText: '#1A1A2E', label: 'In corso', isExam: false as const };
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
      monthsBack: 6,
      monthsCount: 18,
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
  const showLegacyGrid = false as boolean;

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

  // Opens the native quick-book formSheet, preset to a start time within a free
  // window. Reuses the existing booking/block API logic, parametrized.
  const openQuickBookSheet = useCallback((date: Date, startMinutes: number, windowStart: number, windowEnd: number) => {
    if (!canInstructorBook) {
      setToast({ text: 'La prenotazione da app è abilitata solo per allievi.', tone: 'info' });
      return;
    }
    const durations = (clusterDurations ?? settings?.bookingSlotDurations ?? [30, 60]).slice().sort((a, b) => a - b);
    const defaultDuration = durations.includes(60) ? 60 : durations[0] ?? 60;

    const createLesson = async ({ studentId, startMinutes: sm, duration }: { studentId: string; startMinutes: number; duration: number }) => {
      if (!instructorId) { setToast({ text: 'Profilo istruttore non disponibile.', tone: 'danger' }); return false; }
      const start = new Date(date); start.setHours(Math.floor(sm / 60), sm % 60, 0, 0);
      const end = new Date(start.getTime() + duration * 60 * 1000);
      const doBook = (skip = false) => regloApi.confirmInstructorBooking({
        studentId,
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
        instructorId,
        vehicleId: settings?.vehiclesEnabled !== false ? (vehicles[0]?.id ?? null) : null,
        ...(skip ? { skipWeeklyLimitCheck: true } : {}),
      });
      try {
        await doBook();
        setToast({ text: 'Guida prenotata.', tone: 'success' });
        await loadData();
        return true;
      } catch (err: unknown) {
        const payload = (err as { payload?: Record<string, unknown> })?.payload;
        if (payload?.code === 'WEEKLY_LIMIT_CONFIRM') {
          const msg = typeof payload.message === 'string' ? payload.message : "L'allievo ha raggiunto il limite settimanale. Vuoi procedere comunque?";
          const proceed = await new Promise<boolean>((resolve) => {
            Alert.alert('Limite settimanale', msg, [
              { text: 'Annulla', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Procedi', onPress: () => resolve(true) },
            ]);
          });
          if (!proceed) return false;
          try { await doBook(true); setToast({ text: 'Guida prenotata.', tone: 'success' }); await loadData(); return true; }
          catch (e2) { setToast({ text: e2 instanceof Error ? e2.message : 'Errore nella prenotazione', tone: 'danger' }); return false; }
        }
        setToast({ text: err instanceof Error ? err.message : 'Errore nella prenotazione', tone: 'danger' });
        return false;
      }
    };

    const createBlock = async ({ reason, startMinutes: sm, duration }: { reason: string; startMinutes: number; duration: number }) => {
      const start = new Date(date); start.setHours(Math.floor(sm / 60), sm % 60, 0, 0);
      const end = new Date(start.getTime() + duration * 60 * 1000);
      try {
        await regloApi.createInstructorBlock({ startsAt: start.toISOString(), endsAt: end.toISOString(), ...(reason.trim() ? { reason: reason.trim() } : {}) });
        setToast({ text: 'Slot bloccato.', tone: 'success' });
        await loadData();
        return true;
      } catch (err) {
        setToast({ text: err instanceof Error ? err.message : 'Errore nel blocco slot', tone: 'danger' });
        return false;
      }
    };

    const createSick = async ({ startMinutes: sm }: { startMinutes: number }) => {
      const pad = (n: number) => String(n).padStart(2, '0');
      const dateStr = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
      const startTime = `${pad(Math.floor(sm / 60))}:${pad(sm % 60)}`;
      try {
        const result = await regloApi.createInstructorSickLeave({ startDate: dateStr, endDate: dateStr, startTime });
        setToast({ text: `Malattia registrata. ${result.appointmentsCancelled} guide cancellate.`, tone: 'success' });
        await loadData();
        return true;
      } catch (err) {
        setToast({ text: err instanceof Error ? err.message : 'Errore nella registrazione malattia', tone: 'danger' });
        return false;
      }
    };

    quickBookStore.set({
      date,
      startMinutes: Math.max(windowStart, Math.min(windowEnd - 15, startMinutes)),
      windowStartMinutes: windowStart,
      windowEndMinutes: windowEnd,
      durations,
      defaultDuration,
      vehiclesEnabled: settings?.vehiclesEnabled !== false,
      studentOptions: bookingStudentOptions,
      allowBlock: true,
      onCreateLesson: createLesson,
      onCreateBlock: createBlock,
      onCreateSick: createSick,
    });
    router.push('/(tabs)/home/quick-book');
  }, [canInstructorBook, clusterDurations, settings, instructorId, vehicles, loadData, bookingStudentOptions, router]);

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

      // Optimistic update: patch the status everywhere it shows immediately, so
      // the home list / featured card reflect it without waiting on the BE.
      const lessonId = lesson.id;
      const optimistic: Partial<AutoscuolaAppointmentWithRelations> = {
        status: action,
        ...(types.length ? { types, type: types[0] } : {}),
      };
      const previous: Partial<AutoscuolaAppointmentWithRelations> = {
        status: lesson.status,
        type: lesson.type,
        types: lesson.types,
      };
      const applyPatch = (patch: Partial<AutoscuolaAppointmentWithRelations>) => {
        const map = (arr: AutoscuolaAppointmentWithRelations[]) =>
          arr.map((a) => (a.id === lessonId ? { ...a, ...patch } : a));
        setAppointments((p) => map(p));
        setFeaturedAppointments((p) => map(p));
        setSheetLesson((p) => (p && p.id === lessonId ? { ...p, ...patch } : p));
      };

      applyPatch(optimistic);
      setPendingAction(action);
      setError(null);

      try {
        await regloApi.updateAppointmentStatus(lessonId, {
          status: action,
          lessonType: types[0] || undefined,
          lessonTypes: types.length ? types : undefined,
        });
        setToast({ text: 'Stato aggiornato', tone: 'success' });
        if (options?.closeDrawerOnSuccess) {
          setSheetLesson(null);
        }
        // Reconcile with the BE in the background (keeps derived fields fresh).
        void loadData();
      } catch (err) {
        applyPatch(previous); // roll back the optimistic change
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

    // Optimistic update: patch the changed fields everywhere they show, close the
    // sheet immediately, then reconcile with the BE in the background.
    const lessonId = lesson.id;
    const optimistic: Partial<AutoscuolaAppointmentWithRelations> = {
      ...(payload.lessonTypes ? { types: payload.lessonTypes, type: payload.lessonType } : {}),
      ...(payload.rating !== undefined ? { rating: payload.rating } : {}),
      ...(payload.notes !== undefined ? { notes: payload.notes } : {}),
    };
    const previous: Partial<AutoscuolaAppointmentWithRelations> = {
      types: lesson.types,
      type: lesson.type,
      rating: lesson.rating,
      notes: lesson.notes,
    };
    const applyPatch = (patch: Partial<AutoscuolaAppointmentWithRelations>) => {
      const map = (arr: AutoscuolaAppointmentWithRelations[]) =>
        arr.map((a) => (a.id === lessonId ? { ...a, ...patch } : a));
      setAppointments((p) => map(p));
      setFeaturedAppointments((p) => map(p));
      setSheetLesson((p) => (p && p.id === lessonId ? { ...p, ...patch } : p));
    };

    applyPatch(optimistic);
    setToast(null);
    setError(null);

    void (async () => {
      try {
        await regloApi.updateAppointmentDetails(lessonId, payload);
        setToast({ text: 'Dettagli guida salvati.', tone: 'success' });
        void loadData();
      } catch (err) {
        applyPatch(previous); // roll back the optimistic change
        const message = err instanceof Error ? err.message : 'Errore aggiornando dettagli';
        setError(message);
        setToast({ text: message, tone: 'danger' });
      }
    })();

    return true;
  };

  // Instructor reassignment — checks availability, then auto-saves (optimistic).
  // Uses Alert (not toast) for the failure path since toasts render under the
  // modal route and would be invisible while the sheet stays open.
  const changeLessonInstructor = (
    lesson: AutoscuolaAppointmentWithRelations,
    instructor: { id: string; name: string },
  ) => {
    const lessonId = lesson.id;
    if (!instructor?.id || instructor.id === lesson.instructorId) return;
    if (!isDetailsEditable(lesson, now)) {
      Alert.alert('Guida non modificabile', 'Non puoi cambiare istruttore per questa guida.');
      return;
    }
    const prevId = lesson.instructorId;
    const prevInstr = lesson.instructor;
    const patch = (patchData: Partial<AutoscuolaAppointmentWithRelations>) => {
      const map = (arr: AutoscuolaAppointmentWithRelations[]) =>
        arr.map((a) => (a.id === lessonId ? { ...a, ...patchData } : a));
      setAppointments((p) => map(p));
      setFeaturedAppointments((p) => map(p));
      setSheetLesson((p) => (p && p.id === lessonId ? { ...p, ...patchData } : p));
    };
    // Optimistic update so the row reflects the choice immediately. The BE
    // validates instructor availability and rejects on conflict.
    patch({ instructorId: instructor.id, instructor: instructor as any });

    void (async () => {
      try {
        await regloApi.updateAppointmentDetails(lessonId, { instructorId: instructor.id });
        setToast({ text: 'Istruttore aggiornato.', tone: 'success' });
        void loadData();
      } catch (err: unknown) {
        patch({ instructorId: prevId, instructor: prevInstr }); // roll back
        Alert.alert('Istruttore non aggiornato', err instanceof Error ? err.message : 'Errore aggiornando istruttore.');
      }
    })();
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
        'Sei sicuro di voler eliminare definitivamente questa guida? Non verrà riposizionata e all’allievo verrà restituito il credito.',
        [
          { text: 'Annulla', style: 'cancel' },
          {
            text: 'Elimina',
            style: 'destructive',
            onPress: async () => {
              const lessonId = lesson.id;
              // Optimistic removal from the list + featured + drawer.
              setAppointments((prev) => prev.filter((a) => a.id !== lessonId));
              setFeaturedAppointments((prev) => prev.filter((a) => a.id !== lessonId));
              setSheetLesson((prev) => (prev && prev.id === lessonId ? null : prev));
              setPendingAction('reposition');
              setToast(null);
              try {
                const res = await regloApi.permanentlyCancelAppointment(lessonId);
                if (!res?.success) {
                  throw new Error(res?.message || 'Impossibile eliminare la guida.');
                }
                setToast({ text: 'Guida eliminata definitivamente.', tone: 'success' });
                void loadData();
              } catch (err) {
                // Re-fetch to restore the lesson if the delete failed.
                await loadData();
                setToast({
                  text: err instanceof Error ? err.message : 'Errore durante l’eliminazione.',
                  tone: 'danger',
                });
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
      vehicleText: lesson.vehicle?.name ?? 'Da assegnare',
      defaultLocation,
      isDetailsEditable: isDetailsEditable(lesson, now),
      showStatusActions: Boolean(actionAvail.enabled) && status !== 'proposal',
      allowPresente: status !== 'checked_in',
      showRating: ['checked_in', 'completed', 'no_show'].includes(status),
      pendingAction,
      menuOptions,
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
      onChangeLocation: (location) => {
        const lessonId = lesson.id;
        const prevId = lesson.locationId;
        const prevLoc = lesson.location;
        if (location.id === prevId) return; // already the current location — nothing to save
        setSheetLesson((prev) =>
          prev && prev.id === lessonId ? { ...prev, locationId: location.id, location } : prev,
        );
        regloApi
          .updateAppointmentDetails(lessonId, { locationId: location.id })
          .catch((err) => {
            setSheetLesson((prev) =>
              prev && prev.id === lessonId ? { ...prev, locationId: prevId, location: prevLoc } : prev,
            );
            setToast({ text: err instanceof Error ? err.message : 'Errore aggiornando il luogo.', tone: 'danger' });
          });
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
  }, [sheetLesson, sheetStudentProgress, pendingAction, now, settings, defaultLocation, instructorBookingMode]);

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
          disabled={Boolean(bookingPendingAction) || !bookingStudentId || (settings?.vehiclesEnabled !== false && !bookingVehicleId) || n === 0}
          fullWidth
        />
      );
    }

    return (
      <Button
        label={bookingPendingAction ? 'Prenotazione...' : 'Prenota guida'}
        tone="primary"
        onPress={!bookingPendingAction ? handleConfirmInstructorBooking : undefined}
        disabled={Boolean(bookingPendingAction) || !bookingStudentId || (settings?.vehiclesEnabled !== false && !bookingVehicleId)}
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
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style="dark" />
      <ToastNotice message={toast?.text ?? null} tone={toast?.tone} onHide={() => setToast(null)} />
      {agendaViewMode === 'week' ? (
        <>
          {/* ── Fixed header for weekly mode (collapses during quick-book) ── */}
          <Animated.View style={[{ paddingHorizontal: spacing.lg, paddingTop: safeInsets.top + spacing.sm, paddingBottom: spacing.sm, gap: spacing.md }, qbHeaderStyle]}>
            <View style={styles.header}>
              <View>
                <Text style={styles.title}>
                  Ciao, {userName} {'\uD83D\uDC4B'}
                </Text>
                <Text style={styles.subtitle}>Gestisci le tue guide</Text>
              </View>
            </View>

            {canSwitchScope && (
              <View style={scopeStyles.bar}>
                <Pressable
                  style={[scopeStyles.tab, calendarScope === 'personal' && scopeStyles.tabActive]}
                  onPress={() => setCalendarScope('personal')}
                >
                  <Text style={[scopeStyles.tabText, calendarScope === 'personal' && scopeStyles.tabTextActive]}>Le mie guide</Text>
                </Pressable>
                <Pressable
                  style={[scopeStyles.tab, calendarScope === 'all' && scopeStyles.tabActive]}
                  onPress={() => setCalendarScope('all')}
                >
                  <Text style={[scopeStyles.tabText, calendarScope === 'all' && scopeStyles.tabTextActive]}>Tutti gli istruttori</Text>
                </Pressable>
              </View>
            )}

            {!initialLoading && error ? <Text style={styles.error}>{error}</Text> : null}
            {featuredLesson ? (() => {
              const isLive = isLessonInProgressWindow(featuredLesson, now);
              return (
                <View style={[styles.nextBanner, isLive && styles.nextBannerLive]}>
                  <View style={styles.nextBannerLeft}>
                    {isLive ? (
                      <View style={styles.nextBannerDot} />
                    ) : (
                      <Ionicons name="time-outline" size={14} color="#6B7280" />
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
          </Animated.View>
        </>
      ) : null}

      <View style={agendaViewMode === 'week' ? { display: 'none' } : { flex: 1, paddingTop: safeInsets.top }}>
      <Animated.ScrollView
        contentContainerStyle={[styles.content, { paddingTop: 0 }, quickBookOpen && { paddingBottom: 500 }]}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!qbHandleDragging}
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
        {/* ── Header (collapses during quick-book) ── */}
        <Animated.View style={qbHeaderStyle}>
          <View style={styles.greetRow}>
            <Text style={styles.greetName} numberOfLines={1}>Ciao, {userName}</Text>
            {featuredLesson ? (
              <Text style={styles.greetNext} numberOfLines={1}>
                {(() => {
                  const d = new Date(featuredLesson.startsAt);
                  const t = new Date();
                  const sameDay = d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate();
                  const prefix = sameDay ? '' : `${smartDayLabel(featuredLesson.startsAt, now)} `;
                  return `${prefix}${formatTime(featuredLesson.startsAt)} · ${featuredLesson.student?.firstName ?? ''}`;
                })()}
              </Text>
            ) : null}
          </View>

          {canSwitchScope && (
            <View style={scopeStyles.bar}>
              <Pressable
                style={[scopeStyles.tab, calendarScope === 'personal' && scopeStyles.tabActive]}
                onPress={() => setCalendarScope('personal')}
              >
                <Text style={[scopeStyles.tabText, calendarScope === 'personal' && scopeStyles.tabTextActive]}>Le mie guide</Text>
              </Pressable>
              <Pressable
                style={[scopeStyles.tab, calendarScope === 'all' && scopeStyles.tabActive]}
                onPress={() => setCalendarScope('all')}
              >
                <Text style={[scopeStyles.tabText, calendarScope === 'all' && scopeStyles.tabTextActive]}>Tutti gli istruttori</Text>
              </Pressable>
            </View>
          )}

          {!initialLoading && error ? <Text style={styles.error}>{error}</Text> : null}

          {outOfAvailAppointments.length > 0 && (
            <Pressable
              onPress={() => setOutOfAvailSheetOpen(true)}
              style={oobStyles.banner}
            >
              <Ionicons name="alert-circle" size={18} color="#D97706" />
              <Text style={oobStyles.bannerText}>
                <Text style={oobStyles.bannerCount}>{outOfAvailAppointments.length}</Text>
                {' '}guid{outOfAvailAppointments.length === 1 ? 'a' : 'e'} fuori disponibilità
              </Text>
              <Text style={oobStyles.bannerAction}>Gestisci</Text>
            </Pressable>
          )}

          <View style={styles.greetDivider} />
        </Animated.View>

        {/* ── Day Pill Calendar ── */}
        <View style={styles.calendarSection}>
          <View style={styles.calendarMonthRow}>
            <Text style={styles.calendarMonthTitle}>{calendarMonthLabel}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Pressable
                onPress={() => setSelectedDate(new Date())}
                style={styles.calendarIconBtn}
              >
                <Ionicons name="return-down-back-outline" size={22} color="#1A1A2E" />
              </Pressable>
              <Pressable
                onPress={openAgendaCalendar}
                style={styles.calendarIconBtn}
              >
                <Ionicons name="calendar-outline" size={23} color="#1A1A2E" />
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
                    isDaySelected
                      ? styles.dayPillSelected
                      : isDayToday
                        ? styles.dayPillToday
                        : isDayHoliday
                          ? styles.dayPillHoliday
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
                    {canInstructorBook && !sickLeaveInfo ? 'Tocca un orario libero per prenotare al volo.' : 'Giornata libera — goditi la pausa!'}
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
                    return (
                      <Pressable
                        key={`timeless-day-${item.id}`}
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
                        style={({ pressed }) => ({
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 10,
                          paddingVertical: 10,
                          paddingHorizontal: 14,
                          borderRadius: 14,
                          backgroundColor: pressed ? '#E0E7FF' : '#EEF2FF',
                          borderWidth: 1,
                          borderColor: '#C7D2FE',
                        })}
                      >
                        <Ionicons name="school" size={18} color="#4338CA" />
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 13, fontWeight: '700', color: '#4338CA' }}>
                            Esame · Orario da definire
                          </Text>
                          <Text style={{ fontSize: 11, color: '#6366F1', marginTop: 1 }}>
                            {item.appointments.length} {item.appointments.length === 1 ? 'allievo' : 'allievi'}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color="#6366F1" />
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
              const sickFullDay = !!sickLeaveInfo && sickLeaveInfo.isHalfDay === false;

              // Airbnb-style time rail: a time pill per row, pills linked top-to
              // -bottom by a continuous vertical line (markers included).
              const Rail = ({ time, isFirst, isLast, muted }: { time: string; sub?: string; isFirst: boolean; isLast: boolean; muted?: boolean }) => (
                <View style={styles.itinRail}>
                  {!isFirst ? <View style={styles.railLineTop} /> : null}
                  {!isLast ? <View style={styles.railLineBottom} /> : null}
                  <View style={[styles.railPill, muted && styles.railPillMuted]}>
                    <Text style={[styles.railPillText, muted && styles.railPillTextMuted]}>{time}</Text>
                  </View>
                </View>
              );
              const renderRow = (row: ItinRow, i: number, isFirst: boolean, isLast: boolean) => {
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
                      <Rail time={itFmt(row.startMin)} sub={durationLabel(a)} isFirst={isFirst} isLast={isLast} />
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
                  const preview = g.appointments.slice(0, 2).map((a) => `${a.student?.firstName ?? ''} ${a.student?.lastName ?? ''}`.trim()).filter(Boolean).join(', ');
                  const more = count - 2;
                  return (
                    <View key={`exam-${g.id}`} style={styles.itinRow}>
                      <Rail time={itFmt(row.startMin)} sub={itFmt(row.endMin)} isFirst={isFirst} isLast={isLast} />
                      <Pressable onPress={() => setExamDrawerGroup({ id: g.id, startsAt: g.startsAt, endsAt: g.endsAt, instructorId: g.instructorId, instructorName: g.instructorName, notes: g.notes, appointments: g.appointments })} style={({ pressed }) => [styles.itinCard, pressed && styles.itinCardPressed]}>
                        <View style={styles.itinTop}>
                          <View style={[styles.itinAvatar, { backgroundColor: '#EEF2FF' }]}><Ionicons name="school" size={18} color="#4338CA" /></View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.itinName} numberOfLines={1}>{count} {count === 1 ? 'allievo all’esame' : 'allievi all’esame'}</Text>
                            <Text style={styles.itinMeta} numberOfLines={1}>{preview}{more > 0 ? ` +${more}` : ''}</Text>
                          </View>
                          <View style={[styles.itinStatusPill, { backgroundColor: '#EEF2FF' }]}>
                            <Text style={[styles.itinStatusPillText, { color: '#4338CA' }]}>Esame</Text>
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
                      <Rail time={itFmt(row.startMin)} sub={itFmt(row.endMin)} isFirst={isFirst} isLast={isLast} />
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
                    <Rail time={itFmt(row.startMin)} sub={itFmt(row.endMin)} isFirst={isFirst} isLast={isLast} muted />
                    <Pressable
                      onPress={() => Alert.alert(
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
              const rawWindows: Array<[number, number]> = availabilitySlots.length
                ? availabilitySlots.map((s) => [s.startMinutes, s.endMinutes] as [number, number])
                : [[8 * 60, 20 * 60]];
              rawWindows.sort((a, b) => a[0] - b[0]);
              const windows: Array<[number, number]> = [];
              for (const w of rawWindows) {
                const last = windows[windows.length - 1];
                if (last && w[0] <= last[1]) last[1] = Math.max(last[1], w[1]);
                else windows.push([w[0], w[1]]);
              }
              const freeIntervals: Array<[number, number]> = [];
              if (canShowFree) {
                for (const [ws, we] of windows) {
                  let cursor = ws;
                  for (const [os, oe] of occupied) {
                    if (oe <= cursor || os >= we) continue;
                    if (os > cursor) freeIntervals.push([cursor, Math.min(os, we)]);
                    cursor = Math.max(cursor, oe);
                    if (cursor >= we) break;
                  }
                  if (cursor < we) freeIntervals.push([cursor, we]);
                }
              }
              const freeRows = freeIntervals
                .map(([s, e]) => [nowMin !== null && s < nowMin ? Math.ceil(nowMin / 15) * 15 : s, e] as [number, number])
                .filter(([s, e]) => e - s >= MIN_FREE);

              type SeqItem = { kind: 'booked'; row: ItinRow; ri: number } | { kind: 'free'; s: number; e: number };
              const seq: SeqItem[] = [];
              rows.forEach((row, ri) => seq.push({ kind: 'booked', row, ri }));
              freeRows.forEach(([s, e]) => seq.push({ kind: 'free', s, e }));
              seq.sort((a, b) => (a.kind === 'booked' ? a.row.startMin : a.s) - (b.kind === 'booked' ? b.row.startMin : b.s));

              const renderFree = (s: number, e: number, key: string, isFirst: boolean, isLast: boolean) => (
                <View key={key} style={styles.itinRow}>
                  <Rail time={itFmt(s)} sub={gapLabel(e - s)} isFirst={isFirst} isLast={isLast} muted />
                  <View style={{ flex: 1 }}>
                    <BookableBand windowStart={s} windowEnd={e} onPick={(min) => openQuickBookSheet(selectedDate, min, s, e)} />
                  </View>
                </View>
              );

              const renderMarker = (min: number, text: string, key: string, isFirst: boolean, isLast: boolean) => (
                <View key={key} style={styles.itinRow}>
                  <View style={styles.itinRail}>
                    {!isFirst ? <View style={styles.railLineTop} /> : null}
                    {!isLast ? <View style={styles.railLineBottom} /> : null}
                    <View style={[styles.railPill, styles.railPillEndpoint]}>
                      <Text style={[styles.railPillText, styles.railPillTextMuted]}>{itFmt(min)}</Text>
                    </View>
                  </View>
                  <View style={styles.itinMarkerBody}>
                    <Text style={styles.itinMarkerText}>{text}</Text>
                  </View>
                </View>
              );

              const els: React.ReactNode[] = [];
              let nowShown = false;
              seq.forEach((item, idx) => {
                const startMin = item.kind === 'booked' ? item.row.startMin : item.s;
                if (!nowShown && nowMin !== null && nowMin < startMin) {
                  els.push(
                    <View key={`now-${idx}`} style={styles.itinRow}>
                      <View style={styles.itinRail}>
                        <View style={styles.railLineTop} />
                        <View style={styles.railLineBottom} />
                        <View style={[styles.railPill, styles.railPillNow]}>
                          <Text style={[styles.railPillText, styles.railPillTextNow]}>{itFmt(nowMin)}</Text>
                        </View>
                      </View>
                      <View style={styles.itinNowBody}>
                        <View style={styles.itinNowLine} />
                        <Text style={styles.itinNowLabel}>Adesso</Text>
                      </View>
                    </View>,
                  );
                  nowShown = true;
                }
                // Markers are the endpoints — interior rows never start/end the rail.
                if (item.kind === 'booked') els.push(renderRow(item.row, item.ri, false, false));
                else els.push(renderFree(item.s, item.e, `free-${idx}`, false, false));
              });
              return (
                <View style={styles.itinerary}>
                  {rows.length === 0 ? (
                    <Text style={styles.dayEmptyInline}>Nessuna guida oggi · tieni premuto uno slot libero per prenotare</Text>
                  ) : null}
                  {renderMarker(dayBookWindow.start, 'Inizio disponibilità', 'mk-top', true, false)}
                  {els}
                  {renderMarker(dayBookWindow.end, 'Fine disponibilità', 'mk-bottom', false, true)}
                </View>
              );
            })()}

            {/* Legacy grid (tap+drag) disabled — quick-book is now a drawer over the itinerary */}
            {showLegacyGrid && quickBookOpen && (
            <View style={[styles.timelineSection, { position: 'relative', height: HOUR_SLOTS.length * ROW_H }]}>
              {/* ── Tap-to-book / tap-to-dismiss ── */}
              {canInstructorBook && (
                <Pressable
                  style={{ position: 'absolute', top: 0, left: 60, right: 0, bottom: 0, zIndex: 1 }}
                  onPress={(e) => {
                    if (quickBookOpen) {
                      setQuickBookOpen(false);
                      return;
                    }
                    const y = e.nativeEvent.locationY;
                    const hourOffset = y / ROW_H;
                    const hour = HOUR_SLOTS[0] + Math.floor(hourOffset);
                    const minutes = Math.floor((hourOffset % 1) * 4) * 15;
                    openQuickBook(selectedDate, hour, minutes);
                  }}
                />
              )}
              {/* ── Grid layer: hour labels + lines + availability ── */}
              {HOUR_SLOTS.map((hour, idx) => {
                const coverage = hourAvailCoverage.get(hour);
                return (
                  <View key={`grid-${hour}`} style={{ position: 'absolute', top: idx * ROW_H, left: 0, right: 0, height: ROW_H, flexDirection: 'row' }} pointerEvents="none">
                    <Text style={styles.hourLabel}>{String(hour).padStart(2, '0')}:00</Text>
                    <View style={{ flex: 1, borderTopWidth: 1, borderTopColor: '#F1F5F9', position: 'relative' }}>
                      {coverage ? (
                        <View style={{ position: 'absolute', left: 0, width: 3, top: coverage.top * ROW_H, height: (coverage.bottom - coverage.top) * ROW_H, backgroundColor: '#1A1A2E', borderRadius: 1.5 }} />
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
              {/* ── Cluster blocks for "all instructors" scope ── */}
              {calendarScope === 'all' && timelineClusters.map((cluster, ci) => {
                if (cluster.kind !== 'cluster') return null;
                const firstHourMin = HOUR_SLOTS[0] * 60;
                const topPx = ((cluster.startMin - firstHourMin) / 60) * ROW_H;
                const blockH = Math.max(44, ((cluster.endMin - cluster.startMin) / 60) * ROW_H);
                const count = cluster.items.length;
                const startH = Math.floor(cluster.startMin / 60);
                const startM = cluster.startMin % 60;
                const endH = Math.floor(cluster.endMin / 60);
                const endM = Math.round(cluster.endMin % 60);
                const fmt = (h: number, m: number) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                const allAppts = cluster.items
                  .filter((it) => it.kind === 'appointment')
                  .map((it) => (it as { kind: 'appointment'; appointment: AutoscuolaAppointmentWithRelations }).appointment);
                const instructorNames = [...new Set(allAppts.map((a) => a.instructor?.name).filter(Boolean))];
                const isCompact = blockH < 55;
                return (
                  <Pressable
                    key={`cluster-${ci}`}
                    onPress={() => setClusterDrawerAppts(allAppts)}
                    style={[
                      styles.timelineBlock,
                      {
                        borderLeftColor: '#1A1A2E',
                        borderLeftWidth: 4,
                        backgroundColor: '#EEF0F4',
                        position: 'absolute',
                        top: topPx,
                        left: 60,
                        right: 0,
                        height: blockH,
                        zIndex: 10,
                        padding: isCompact ? 6 : 14,
                      },
                    ]}
                  >
                    {isCompact ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                        <Ionicons name="layers-outline" size={14} color={'#1A1A2E'} />
                        <Text style={{ fontSize: 13, fontWeight: '700', color: '#1A1A2E' }} numberOfLines={1}>
                          {count} guide · {fmt(startH, startM)}
                        </Text>
                        <Text style={{ fontSize: 12, color: '#64748B', flex: 1 }} numberOfLines={1}>
                          {instructorNames.slice(0, 2).join(', ')}{instructorNames.length > 2 ? ` +${instructorNames.length - 2}` : ''}
                        </Text>
                      </View>
                    ) : (
                      <>
                        <View style={styles.timelineBlockHeader}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Ionicons name="layers-outline" size={16} color={'#1A1A2E'} />
                            <Text style={[styles.timelineBlockTime, { color: '#1A1A2E' }]}>
                              {fmt(startH, startM)} {'\u2013'} {fmt(endH, endM)}
                            </Text>
                          </View>
                          <View style={[styles.timelineStatusBadge, { backgroundColor: '#EEF0F4' }]}>
                            <Text style={[styles.timelineStatusText, { color: '#1A1A2E' }]}>
                              {count} GUIDE
                            </Text>
                          </View>
                        </View>
                        <Text style={[styles.timelineBlockStudent, { color: '#1E293B' }]} numberOfLines={1}>
                          {instructorNames.join(', ')}
                        </Text>
                        <Text style={[styles.timelineBlockMeta, { color: '#64748B' }]} numberOfLines={1}>
                          Tocca per vedere i dettagli
                        </Text>
                      </>
                    )}
                  </Pressable>
                );
              })}
              {/* ── Blocks layer: appointments + exam groups + instructor blocks ── */}
              {(calendarScope === 'all'
                ? timelineClusters.filter((c) => c.kind === 'single').map((c) => (c as { kind: 'single'; item: (typeof timelineItems)[number] }).item)
                : timelineItems
              ).map((item) => {
                if (item.kind === 'examGroup') {
                  // Timeless exams are rendered as banners outside the grid
                  if (!item.endsAt) return null;
                  const startDate = new Date(item.startsAt);
                  const startMin = startDate.getHours() * 60 + startDate.getMinutes();
                  const endTs = new Date(item.endsAt).getTime();
                  const durationMin = (endTs - startDate.getTime()) / (60 * 1000);
                  const firstHourMin = HOUR_SLOTS[0] * 60;
                  const topPx = ((startMin - firstHourMin) / 60) * ROW_H;
                  const blockH = Math.max(36, (durationMin / 60) * ROW_H);
                  const isCompact = blockH < 55;
                  const studentsCount = item.appointments.length;
                  const studentsPreview = item.appointments
                    .slice(0, 2)
                    .map((a) => `${a.student?.firstName ?? ''} ${a.student?.lastName ?? ''}`.trim())
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
                          left: 60,
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
                            {formatTime(item.startsAt)} {'\u2013'} {formatTime(item.endsAt)}
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
                                {formatTime(item.startsAt)} {'\u2013'} {formatTime(item.endsAt)}
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
                const apptStatus = normalizeStatus(appt.status);
                const isTerminal = apptStatus === 'completed' || apptStatus === 'no_show' || apptStatus === 'cancelled';
                const isActive = !isTerminal && isLessonInProgressWindow(appt, now);
                const actionAvail = getActionAvailability(appt, now, settings?.autoCheckinEnabled);
                const isCheckedIn = apptStatus === 'checked_in';
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
                        left: 60,
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
                          {formatTime(appt.startsAt)}
                        </Text>
                        <Text style={{ fontSize: 13, color: '#475569', flex: 1 }} numberOfLines={1}>
                          {calendarScope === 'all' && appt.instructor?.name ? `${appt.instructor.name} · ` : ''}{appt.student?.firstName} {appt.student?.lastName}
                        </Text>
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
                          {calendarScope === 'all' && appt.instructor?.name ? `${appt.instructor.name} \u00B7 ` : ''}{appt.student?.firstName} {appt.student?.lastName}
                        </Text>
                        <Text style={styles.timelineBlockMeta} numberOfLines={1}>
                          {config.isExam
                            ? `Esame di guida \u00B7 ${durationLabel(appt)}`
                            : [settings?.vehiclesEnabled !== false ? appt.vehicle?.name : null, durationLabel(appt)].filter(Boolean).join(' \u00B7 ')}
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

                        {null}
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
                    onPress={() => Alert.alert(
                      isSickBlock ? 'Rimuovi malattia' : 'Rimuovi blocco',
                      isSickBlock
                        ? 'Vuoi rimuovere la segnalazione di malattia? Le guide già cancellate non verranno ripristinate.'
                        : `Vuoi rimuovere il blocco${block.reason ? ` "${block.reason}"` : ''} dalle ${formatTime(block.startsAt)} alle ${formatTime(block.endsAt)}?`,
                      [
                        { text: 'Annulla', style: 'cancel' },
                        { text: 'Rimuovi', style: 'destructive', onPress: () => handleDeleteBlock(block.id) },
                      ],
                    )}
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
                          {isSickBlock ? (
                            <View style={[styles.timelineStatusBadge, { backgroundColor: blockBadgeBg }]}>
                              <Text style={[styles.timelineStatusText, { color: blockBadgeText }]}>{blockLabel}</Text>
                            </View>
                          ) : null}
                        </View>
                        <Text style={[styles.timelineBlockStudent, { color: blockTextColor }]}>
                          {isSickBlock ? 'Guide cancellate e allievi avvisati' : (block.reason || 'Slot bloccato')}
                        </Text>
                      </>
                    )}
                  </Pressable>
                );
              })}
              {/* ── Quick-book preview block with drag handles ── */}
              {quickBookOpen && agendaViewMode === 'day' && (() => {
                const qbDateStr = `${quickBookDate.getFullYear()}-${String(quickBookDate.getMonth() + 1).padStart(2, '0')}-${String(quickBookDate.getDate()).padStart(2, '0')}`;
                const selDateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
                if (qbDateStr !== selDateStr) return null;
                const startMin = quickBookHour * 60 + quickBookMinutes;
                const firstHourMin = HOUR_SLOTS[0] * 60;
                const topPx = ((startMin - firstHourMin) / 60) * ROW_H;
                const blockH = (quickBookDuration / 60) * ROW_H;
                const endTotal = startMin + quickBookDuration;
                const endHour = Math.floor(endTotal / 60);
                const endMin = endTotal % 60;
                const isBlock = quickBookType === 'block';
                const previewColor = isBlock ? '#94A3B8' : '#1A1A2E';
                const previewBg = isBlock ? '#F8FAFC' : '#EEF0F4';
                const previewLabel = isBlock
                  ? (quickBookReason.trim() || 'Blocca slot')
                  : (quickBookStudentId
                    ? (students.find((s) => s.id === quickBookStudentId)?.firstName ?? 'Nuova guida')
                    : 'Nuova guida');
                const showHandles = isBlock || bookingDurations.length > 1;
                return (
                  <View
                    pointerEvents="box-none"
                    style={{
                      position: 'absolute',
                      top: topPx - (showHandles ? 12 : 0),
                      left: 60,
                      right: 0,
                      height: blockH + (showHandles ? 24 : 0),
                      zIndex: 15,
                    }}
                  >
                    {/* Block body */}
                    <View
                      pointerEvents="none"
                      style={{
                        position: 'absolute',
                        top: showHandles ? 12 : 0,
                        left: 0,
                        right: 0,
                        height: blockH,
                        backgroundColor: previewBg,
                        borderWidth: 2,
                        borderColor: previewColor,
                        borderRadius: 12,
                        borderStyle: 'dashed',
                        justifyContent: 'center',
                        paddingHorizontal: 14,
                      }}
                    >
                      <Text style={{ fontSize: 14, fontWeight: '700', color: previewColor }}>
                        {String(quickBookHour).padStart(2, '0')}:{String(quickBookMinutes).padStart(2, '0')} – {String(endHour).padStart(2, '0')}:{String(endMin).padStart(2, '0')}
                      </Text>
                      {blockH >= 50 && (
                        <Text style={{ fontSize: 12, color: previewColor, opacity: 0.6, marginTop: 2 }}>
                          {previewLabel}
                        </Text>
                      )}
                    </View>
                    {/* Drag handles */}
                    {showHandles && (
                      <>
                        {/* Top drag handle (move start time) */}
                        <View
                          {...qbTopPan.panHandlers}
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            height: 24,
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 2,
                          }}
                        >
                          <View style={{
                            width: 36,
                            height: 6,
                            borderRadius: 3,
                            backgroundColor: previewColor,
                          }} />
                        </View>
                        {/* Bottom drag handle */}
                        <View
                          {...qbBottomPan.panHandlers}
                          style={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            right: 0,
                            height: 24,
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 2,
                          }}
                        >
                          <View style={{
                            width: 36,
                            height: 6,
                            borderRadius: 3,
                            backgroundColor: previewColor,
                          }} />
                    </View>
                      </>
                    )}
                  </View>
                );
              })()}
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
            )}
          </View>
        )}
      </Animated.ScrollView>
      </View>

      {agendaViewMode === 'week' ? (
        <>
          {/* Timeless exam banners */}
          {(() => {
            const timelessExams = appointments.filter(
              (a) => a.type === 'esame' && !a.endsAt && (a.status ?? '').toLowerCase() !== 'cancelled',
            );
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
                        setExamDrawerGroup({
                          id: `exam-${startsAt}`,
                          startsAt: first.startsAt,
                          endsAt: first.endsAt,
                          instructorId: first.instructorId,
                          instructorName: first.instructor?.name ?? null,
                          notes: first.notes,
                          appointments: appts,
                        });
                      }}
                      style={({ pressed }) => ({
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 10,
                        paddingVertical: 10,
                        paddingHorizontal: 14,
                        borderRadius: 14,
                        backgroundColor: pressed ? '#E0E7FF' : '#EEF2FF',
                        borderWidth: 1,
                        borderColor: '#C7D2FE',
                      })}
                    >
                      <Ionicons name="school" size={18} color="#4338CA" />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: '#4338CA' }}>
                          Esame · {dayLabel}
                        </Text>
                        <Text style={{ fontSize: 11, color: '#6366F1', marginTop: 1 }}>
                          {appts.length} {appts.length === 1 ? 'allievo' : 'allievi'} · Orario da definire
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color="#6366F1" />
                    </Pressable>
                  );
                })}
              </View>
            );
          })()}
          <WeeklyAgendaView
            appointments={appointments}
            instructorBlocks={instructorBlocks}
            holidays={holidays}
            loading={appointmentsLoading}
            clusterMode={calendarScope === 'all'}
            onPressCluster={(appts) => setClusterDrawerAppts(appts)}
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
            onPressBlock={(block) => {
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
            onPressEmptySlot={(date, hour, minutes) => {
              if (quickBookOpen) { setQuickBookOpen(false); return; }
              openQuickBook(date, hour, minutes);
            }}
            onDateChange={(weekStart: Date) => {
              setSelectedDate(weekStart);
            }}
            quickBookPreview={quickBookOpen ? {
              date: quickBookDate,
              hour: quickBookHour,
              minutes: quickBookMinutes,
              duration: quickBookDuration,
            } : null}
            quickBookTopPanHandlers={bookingDurations.length > 1 ? qbTopPan.panHandlers : undefined}
            quickBookBottomPanHandlers={bookingDurations.length > 1 ? qbBottomPan.panHandlers : undefined}
            quickBookDragging={qbHandleDragging}
          />
        </>
      ) : null}

      {/* ── Quick-book inline drawer (no modal/backdrop) ── */}
      {quickBookOpen && (
        <Animated.View
          style={[
            {
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 62 + safeInsets.bottom + keyboardHeight,
              backgroundColor: '#FFFFFF',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              borderBottomLeftRadius: 24,
              borderBottomRightRadius: 24,
              marginHorizontal: 8,
              paddingHorizontal: 20,
              paddingTop: 12,
              paddingBottom: 16,
              shadowColor: '#000',
              shadowOpacity: 0.15,
              shadowRadius: 24,
              shadowOffset: { width: 0, height: -10 },
              elevation: 16,
              zIndex: 50,
            },
            qbDrawerStyle,
          ]}
        >
          {/* Handle */}
          <View style={{ alignItems: 'center', marginBottom: 10 }}>
            <View style={{ width: 36, height: 5, borderRadius: 2.5, backgroundColor: '#D1D5DB' }} />
          </View>

          {/* Segmented control: Guida / Blocca slot */}
          <View style={{ flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 12, padding: 3, marginBottom: 14 }}>
            <Pressable
              onPress={() => setQuickBookType('lesson')}
              style={({ pressed }) => ({
                flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center',
                backgroundColor: quickBookType === 'lesson' ? '#FFFFFF' : 'transparent',
                ...(quickBookType === 'lesson' ? { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2 } : {}),
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: quickBookType === 'lesson' ? '#1A1A2E' : '#94A3B8' }}>Guida</Text>
            </Pressable>
            <Pressable
              onPress={() => setQuickBookType('block')}
              style={({ pressed }) => ({
                flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center',
                backgroundColor: quickBookType === 'block' ? '#FFFFFF' : 'transparent',
                ...(quickBookType === 'block' ? { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2 } : {}),
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: quickBookType === 'block' ? '#64748B' : '#94A3B8' }}>Blocca slot</Text>
            </Pressable>
          </View>

          {/* Date + start-time stepper */}
          {(() => {
            const shiftStart = (delta: number) => {
              const total = Math.max(6 * 60, Math.min(21 * 60 + 45, quickBookHour * 60 + quickBookMinutes + delta));
              setQuickBookHour(Math.floor(total / 60));
              setQuickBookMinutes(total % 60);
            };
            const endMin = quickBookHour * 60 + quickBookMinutes + quickBookDuration;
            const endLabel = `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;
            return (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: '#94A3B8', textTransform: 'capitalize' }}>
                    {quickBookDate.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'short' })}
                  </Text>
                  <Text style={{ fontSize: 20, fontWeight: '700', color: '#1A1A2E', letterSpacing: -0.3, marginTop: 1 }}>
                    {String(quickBookHour).padStart(2, '0')}:{String(quickBookMinutes).padStart(2, '0')}
                    <Text style={{ fontSize: 15, fontWeight: '500', color: '#94A3B8' }}>{'  –  '}{endLabel}</Text>
                  </Text>
                </View>
                <Pressable onPress={() => shiftStart(-15)} style={({ pressed }) => [styles.qbStepBtn, pressed && { opacity: 0.6 }]}>
                  <Ionicons name="remove" size={20} color="#1A1A2E" />
                </Pressable>
                <Pressable onPress={() => shiftStart(15)} style={({ pressed }) => [styles.qbStepBtn, pressed && { opacity: 0.6 }]}>
                  <Ionicons name="add" size={20} color="#1A1A2E" />
                </Pressable>
              </View>
            );
          })()}

          {quickBookType === 'lesson' ? (
            <>
              {/* Student selector */}
              <View style={{ marginBottom: 14 }}>
                <SearchableSelect
                  placeholder="Seleziona allievo..."
                  value={quickBookStudentId || null}
                  options={bookingStudentOptions}
                  onChange={setQuickBookStudentId}
                />
              </View>

              {/* Duration chips */}
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
                {bookingDurations.map((dur) => {
                  const isActive = quickBookDuration === dur;
                  return (
                    <Pressable
                      key={dur}
                      onPress={() => setQuickBookDuration(dur)}
                      style={({ pressed }) => ({
                        paddingHorizontal: 16,
                        paddingVertical: 8,
                        borderRadius: 20,
                        backgroundColor: isActive ? '#1A1A2E' : '#F1F5F9',
                        borderWidth: 1,
                        borderColor: isActive ? '#1A1A2E' : '#E2E8F0',
                        opacity: pressed ? 0.8 : 1,
                      })}
                    >
                      <Text style={{ fontSize: 14, fontWeight: '600', color: isActive ? '#FFFFFF' : '#64748B' }}>
                        {dur} min
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : (
            <>
              {/* Reason input */}
              <View style={{ marginBottom: 18 }}>
                <TextInput
                  placeholder="Motivo (opzionale)"
                  placeholderTextColor="#94A3B8"
                  value={quickBookReason}
                  onChangeText={setQuickBookReason}
                  style={{
                    backgroundColor: '#F8FAFC',
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: '#E2E8F0',
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    fontSize: 15,
                    color: '#1E293B',
                  }}
                />
              </View>
            </>
          )}

          {/* Buttons */}
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Pressable
              onPress={() => setQuickBookOpen(false)}
              disabled={quickBookPending}
              style={({ pressed }) => ({
                flex: 1,
                paddingVertical: 14,
                borderRadius: 20,
                backgroundColor: '#F1F5F9',
                alignItems: 'center',
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Text style={{ fontSize: 15, fontWeight: '600', color: '#64748B' }}>Annulla</Text>
            </Pressable>
            <Pressable
              onPress={quickBookPending ? undefined : (quickBookType === 'lesson' ? handleQuickBookConfirm : handleQuickBlockConfirm)}
              disabled={quickBookPending || (quickBookType === 'lesson' && !quickBookStudentId)}
              style={({ pressed }) => ({
                flex: 1,
                paddingVertical: 14,
                borderRadius: 20,
                backgroundColor: quickBookType === 'lesson'
                  ? (!quickBookStudentId ? '#D6D9E0' : '#1A1A2E')
                  : '#64748B',
                alignItems: 'center',
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFFFFF' }}>
                {quickBookPending
                  ? (quickBookType === 'lesson' ? 'Prenoto...' : 'Blocco...')
                  : (quickBookType === 'lesson' ? 'Prenota' : 'Blocca')}
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      )}

      {/* ── Sick Leave BottomSheet ── */}
      <NativePageSheet
        visible={sickSheetOpen}
        onClose={() => {
          if (sickPending) return;
          if (sickSheetMode !== 'form') { setSickSheetMode('form'); return; }
          setSickSheetOpen(false);
        }}
        title={sickSheetMode === 'startCalendar' ? 'Seleziona data inizio' : sickSheetMode === 'endCalendar' ? 'Seleziona data fine' : sickSheetMode === 'timePicker' ? 'Seleziona orario' : 'Registra malattia'}
        closeDisabled={sickPending}
        footer={sickSheetMode === 'form' ? (
          <Pressable
            onPress={sickPending ? undefined : handleCreateSickLeave}
            disabled={sickPending}
            style={({ pressed }) => [styles.ctaButton, pressed && styles.ctaButtonPressed, sickPending && styles.ctaButtonDisabled]}
          >
            <Text style={styles.ctaButtonLabel}>{sickPending ? 'Registrazione...' : 'Conferma malattia'}</Text>
          </Pressable>
        ) : undefined}
      >
        {sickSheetMode === 'startCalendar' && (
          <Animated.View entering={FadeInRight.duration(220)} exiting={FadeOutRight.duration(160)}>
            <InlineCalendarPicker
              selectedDate={sickStartDate}
              maxWeeks={52}
              onSelectDate={(d) => {
                setSickStartDate(d);
                if (!sickMultiDay || d > sickEndDate) setSickEndDate(d);
                setSickSheetMode('form');
              }}
            />
          </Animated.View>
        )}
        {sickSheetMode === 'endCalendar' && (
          <Animated.View entering={FadeInRight.duration(220)} exiting={FadeOutRight.duration(160)}>
            <InlineCalendarPicker
              selectedDate={sickEndDate}
              maxWeeks={52}
              onSelectDate={(d) => {
                setSickEndDate(d);
                setSickSheetMode('form');
              }}
            />
          </Animated.View>
        )}
        {sickSheetMode === 'timePicker' && (
          <Animated.View entering={FadeInRight.duration(220)} exiting={FadeOutRight.duration(160)}>
            <InlineTimePicker
              selectedTime={sickStartTime}
              onSelectTime={(date) => {
                setSickStartTime(date);
                setSickSheetMode('form');
              }}
            />
          </Animated.View>
        )}
        {sickSheetMode === 'form' && <Animated.View entering={FadeInLeft.duration(220)} exiting={FadeOutLeft.duration(160)}>
        <View style={{ gap: spacing.md }}>
          {/* Hero illustration */}
          <View style={{ alignItems: 'center', paddingTop: 4, paddingBottom: 8 }}>
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center', marginBottom: 8, shadowColor: '#F59E0B', shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } }}>
              <Ionicons name="medkit" size={26} color="#D97706" />
            </View>
            <Text style={{ fontSize: 13, color: '#64748B', textAlign: 'center' }}>
              Registra un periodo di malattia.{'\n'}Le guide in conflitto verranno cancellate.
            </Text>
          </View>

          {/* Single day picker */}
          {!sickMultiDay && (
            <Pressable
              onPress={() => setSickSheetMode('startCalendar')}
              style={({ pressed }) => [styles.bookingFieldCard, pressed && { backgroundColor: '#F1F5F9' }]}
            >
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                <View style={[styles.bookingFieldIconCircle, { backgroundColor: '#FEF3C7' }]}>
                  <Ionicons name="calendar-outline" size={18} color="#D97706" />
                </View>
                <View>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: '#B45309', letterSpacing: 0.3 }}>GIORNO</Text>
                  <Text style={styles.bookingFieldText}>
                    {sickStartDate.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </Text>
                </View>
              </View>
              <Text style={styles.bookingFieldChevron}>{'\u203A'}</Text>
            </Pressable>
          )}

          {/* Multi-day date range */}
          {sickMultiDay && (
            <View style={{ backgroundColor: '#FFFBEB', borderRadius: radii.sm, padding: 4, gap: 4 }}>
              <Pressable
                onPress={() => setSickSheetMode('startCalendar')}
                style={({ pressed }) => ({
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                  backgroundColor: pressed ? '#FEF9C3' : '#FFFFFF', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12,
                })}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={[styles.bookingFieldIconCircle, { backgroundColor: '#FEF3C7' }]}>
                    <Ionicons name="calendar-outline" size={18} color="#D97706" />
                  </View>
                  <View>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: '#B45309', letterSpacing: 0.3 }}>DAL</Text>
                    <Text style={styles.bookingFieldText}>
                      {sickStartDate.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </Text>
                  </View>
                </View>
                <Text style={styles.bookingFieldChevron}>{'\u203A'}</Text>
              </Pressable>
              <View style={{ height: 1, backgroundColor: '#FDE68A', marginHorizontal: 14 }} />
              <Pressable
                onPress={() => setSickSheetMode('endCalendar')}
                style={({ pressed }) => ({
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                  backgroundColor: pressed ? '#FEF9C3' : '#FFFFFF', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12,
                })}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={[styles.bookingFieldIconCircle, { backgroundColor: '#FEF3C7' }]}>
                    <Ionicons name="calendar-outline" size={18} color="#D97706" />
                  </View>
                  <View>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: '#B45309', letterSpacing: 0.3 }}>AL</Text>
                    <Text style={styles.bookingFieldText}>
                      {sickEndDate.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </Text>
                  </View>
                </View>
                <Text style={styles.bookingFieldChevron}>{'\u203A'}</Text>
              </Pressable>
            </View>
          )}

          {/* Multi-day toggle */}
          <View style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            backgroundColor: '#F8FAFC', borderRadius: radii.sm, paddingHorizontal: 16, paddingVertical: 14,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
              <View style={[styles.bookingFieldIconCircle, { backgroundColor: '#F1F5F9' }]}>
                <Ionicons name="calendar-number-outline" size={18} color="#64748B" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: '#1E293B' }}>Più giorni</Text>
                <Text style={{ fontSize: 12, color: '#94A3B8', marginTop: 1 }}>Imposta un periodo di malattia</Text>
              </View>
            </View>
            <Switch
              value={sickMultiDay}
              onValueChange={(val) => {
                setSickMultiDay(val);
                if (val) setSickEndDate(new Date(sickStartDate));
                else setSickEndDate(new Date(sickStartDate));
              }}
              trackColor={{ false: '#E2E8F0', true: '#FACC15' }}
              thumbColor="#FFFFFF"
            />
          </View>

          {/* Half day toggle */}
          <View style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            backgroundColor: '#F8FAFC', borderRadius: radii.sm, paddingHorizontal: 16, paddingVertical: 14,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
              <View style={[styles.bookingFieldIconCircle, { backgroundColor: '#F1F5F9' }]}>
                <Ionicons name="time-outline" size={18} color="#64748B" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: '#1E293B' }}>Mezza giornata</Text>
                <Text style={{ fontSize: 12, color: '#94A3B8', marginTop: 1 }}>Inizia a un orario specifico</Text>
              </View>
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
              onPress={() => setSickSheetMode('timePicker')}
              style={({ pressed }) => [styles.bookingFieldCard, pressed && { backgroundColor: '#F1F5F9' }]}
            >
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                <View style={[styles.bookingFieldIconCircle, { backgroundColor: '#EEF0F4' }]}>
                  <Ionicons name="time-outline" size={18} color="#1A1A2E" />
                </View>
                <View>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#94A3B8', letterSpacing: 0.5 }}>ORARIO INIZIO</Text>
                  <Text style={styles.bookingFieldText}>
                    {`${String(sickStartTime.getHours()).padStart(2, '0')}:${String(sickStartTime.getMinutes()).padStart(2, '0')}`}
                  </Text>
                </View>
              </View>
              <Text style={styles.bookingFieldChevron}>{'\u203A'}</Text>
            </Pressable>
          )}
        </View>
        </Animated.View>}
      </NativePageSheet>

      {/* ── FAB Menu ── */}
      {!quickBookOpen && (
        <FabMenu
          canBook={canInstructorBook}
          disabled={isPending || Boolean(bookingPendingAction)}
          onBookLesson={openBookingDrawer}
          onBlockSlot={openBlockDrawer}
          onCreateExam={() => router.push('/(tabs)/home/create-exam')}
          onSickLeave={openSickLeaveDrawer}
        />
      )}

      {/* Screen-level scrub bubble (follows the finger during hold-to-book) */}
      <ScrubBubble />

      {/* ── Placeholder to keep old refs working ── */}
      {/* old content removed — timeline is above */}

      {/* ── Booking ── */}
      <NativePageSheet
        visible={bookingSheetOpen}
        onClose={() => {
          if (bookingPendingAction) return;
          if (bookingSheetMode !== 'form') { setBookingSheetMode('form'); return; }
          setBookingSheetOpen(false);
          setEmergencyAllStudents(false);
        }}
        title={
          bookingSheetMode === 'calendar' ? 'Seleziona data'
            : bookingSheetMode === 'timepicker' ? 'Seleziona orario'
            : bookingSheetMode === 'locationPicker' ? 'Scegli il luogo'
            : bookingSheetMode === 'locationForm' ? 'Aggiungi luogo'
            : 'Nuova prenotazione'
        }
        closeDisabled={Boolean(bookingPendingAction)}
        footer={bookingSheetMode === 'form' ? bookingSheetFooter : undefined}
      >
        {bookingSheetMode === 'calendar' && (() => {
          const calSelectedDate = editingEntryId
            ? (multiBookingEntries.find((e) => e.id === editingEntryId)?.date ?? bookingDate)
            : bookingDate;
          return (
            <Animated.View entering={FadeInRight.duration(220)} exiting={FadeOutRight.duration(160)}>
              <InlineCalendarPicker
                selectedDate={calSelectedDate}
                maxWeeks={Number(settings?.availabilityWeeks) || 4}
                bookedDates={bookedDatesSet}
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
                  setBookingSheetMode('form');
                }}
              />
            </Animated.View>
          );
        })()}
        {bookingSheetMode === 'timepicker' && (() => {
          const tpSelectedTime = editingEntryId
            ? (multiBookingEntries.find((e) => e.id === editingEntryId)?.startTime ?? bookingStartTime)
            : bookingStartTime;
          return (
            <Animated.View entering={FadeInRight.duration(220)} exiting={FadeOutRight.duration(160)}>
              <InlineTimePicker
                selectedTime={tpSelectedTime}
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
                  setBookingSheetMode('form');
                }}
              />
            </Animated.View>
          );
        })()}
        {bookingSheetMode === 'form' && <Animated.View entering={FadeInLeft.duration(220)} exiting={FadeOutLeft.duration(160)}><ScrollView
          ref={bookingSheetScrollRef}
          style={[styles.sheetScroll, { flex: 1 }]}
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
              trackColor={{ false: '#E2E8F0', true: '#1A1A2E' }}
              thumbColor="#fff"
              disabled={Boolean(bookingPendingAction)}
            />
          </View>

          {/* ── LUOGO (visible in both single + multi mode) ── */}
          <View style={{ marginTop: spacing.md }}>
            <Text style={styles.bookingSectionLabel}>Luogo</Text>
            <Pressable
              onPress={() => setBookingSheetMode('locationPicker')}
              style={({ pressed }) => [{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                paddingVertical: 14,
                paddingHorizontal: 14,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: '#FFFFFF',
                minHeight: 56,
              }, pressed && { opacity: 0.7 }]}
            >
              <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: '#EEF0F4', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="location" size={18} color={'#1A1A2E'} />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{ color: colors.textPrimary, fontSize: 15, fontWeight: '600' }}
                  numberOfLines={1}
                >
                  {bookingLocationName ?? "Sede dell'autoscuola"}
                </Text>
                {bookingLocationAddress ? (
                  <Text
                    style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}
                    numberOfLines={1}
                  >
                    {bookingLocationAddress}
                  </Text>
                ) : null}
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
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
                          setBookingSheetMode('calendar');
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
                          setBookingSheetMode('timepicker');
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
                    <Ionicons name="add-circle-outline" size={18} color={'#1A1A2E'} />
                    <Text style={{ color: '#1A1A2E', fontSize: 14, fontWeight: '600', marginLeft: 6 }}>
                      Aggiungi guida
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </>
          ) : (
            <>
              {/* ── GIORNO + ORA INIZIO (single mode, 2-col row) ── */}
              <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.bookingSectionLabel}>Giorno</Text>
                  <Pressable
                    onPress={() => setBookingSheetMode('calendar')}
                    style={styles.bookingFieldCard}
                  >
                    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', flex: 1 }}>
                      <View style={[styles.bookingFieldIconCircle, { backgroundColor: '#FEF9C3' }]}>
                        <Ionicons name="calendar-outline" size={16} color="#CA8A04" />
                      </View>
                      <Text style={[styles.bookingFieldText, { flexShrink: 1 }]} numberOfLines={1}>
                        {bookingDate.toLocaleDateString('it-IT', {
                          weekday: 'short',
                          day: '2-digit',
                          month: 'short',
                        })}
                      </Text>
                    </View>
                    <Text style={styles.bookingFieldChevron}>{'›'}</Text>
                  </Pressable>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.bookingSectionLabel}>Ora inizio</Text>
                  <Pressable
                    onPress={() => setBookingSheetMode('timepicker')}
                    style={styles.bookingFieldCard}
                  >
                    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', flex: 1 }}>
                      <View style={[styles.bookingFieldIconCircle, { backgroundColor: '#EEF0F4' }]}>
                        <Ionicons name="time-outline" size={16} color="#1A1A2E" />
                      </View>
                      <Text style={[styles.bookingFieldText, { flexShrink: 1 }]} numberOfLines={1}>
                        {bookingStartTime.toTimeString().slice(0, 5)}
                      </Text>
                    </View>
                    <Text style={styles.bookingFieldChevron}>{'\u203A'}</Text>
                  </Pressable>
                </View>
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
              {settings?.vehiclesEnabled !== false && (
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
              )}

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

        </ScrollView></Animated.View>}

        {bookingSheetMode === 'locationPicker' && (
          <Animated.View entering={FadeInRight.duration(220)} exiting={FadeOutRight.duration(160)}>
            <InlineLocationPicker
              selectedLocationId={bookingLocationId ?? defaultLocation?.id ?? null}
              onSelect={(location) => {
                setBookingLocationId(location.id);
                setBookingLocationName(location.name);
                setBookingLocationAddress(location.address);
                setBookingSheetMode('form');
              }}
              onRequestCreate={() => setBookingSheetMode('locationForm')}
            />
          </Animated.View>
        )}

        {bookingSheetMode === 'locationForm' && (
          <Animated.View entering={FadeInRight.duration(220)} exiting={FadeOutRight.duration(160)}>
            <InlineLocationForm
              onCancel={() => setBookingSheetMode('locationPicker')}
              onSubmit={async (values) => {
                const created = await regloApi.createLocation(values);
                setBookingLocationId(created.id);
                setBookingLocationName(created.name);
                setBookingLocationAddress(created.address);
                setBookingSheetMode('form');
              }}
            />
          </Animated.View>
        )}
      </NativePageSheet>

      <CalendarDrawer
        visible={guidedCalendarOpen}
        onClose={() => {
          setGuidedCalendarOpen(false);
        }}
        onClosed={() => setBookingSheetOpen(true)}
        onSelectDate={(date) => {
          setGuidedPreferredDate(date);
          setGuidedSuggestion(null);
          setGuidedCalendarOpen(false);
        }}
        selectedDate={guidedPreferredDate ?? new Date()}
        maxWeeks={Number(settings?.availabilityWeeks) || 4}
        caption={null}
      />

      {/* ── Block Slot BottomSheet ── */}
      <NativePageSheet
        visible={blockSheetOpen}
        onClose={() => {
          if (blockPending) return;
          if (blockSheetMode !== 'form') { setBlockSheetMode('form'); return; }
          setBlockSheetOpen(false);
        }}
        title={blockSheetMode === 'calendar' ? 'Seleziona data' : blockSheetMode === 'startTime' ? 'Seleziona ora inizio' : blockSheetMode === 'endTime' ? 'Seleziona ora fine' : 'Blocca slot'}
        closeDisabled={blockPending}
        footer={blockSheetMode === 'form' ? (
          <Button
            label={blockPending ? 'Creazione...' : 'Blocca slot'}
            tone="primary"
            onPress={!blockPending ? handleCreateBlock : undefined}
            disabled={blockPending}
            fullWidth
          />
        ) : undefined}
      >
        {blockSheetMode === 'calendar' && (
          <Animated.View entering={FadeInRight.duration(220)} exiting={FadeOutRight.duration(160)}>
            <InlineCalendarPicker
              selectedDate={blockDate}
              maxWeeks={52}
              onSelectDate={(date) => {
                setBlockDate(date);
                setBlockSheetMode('form');
              }}
            />
          </Animated.View>
        )}
        {blockSheetMode === 'startTime' && (
          <Animated.View entering={FadeInRight.duration(220)} exiting={FadeOutRight.duration(160)}>
            <InlineTimePicker
              selectedTime={blockStartTime}
              onSelectTime={(date) => {
                setBlockStartTime(date);
                setBlockSheetMode('form');
              }}
            />
          </Animated.View>
        )}
        {blockSheetMode === 'endTime' && (
          <Animated.View entering={FadeInRight.duration(220)} exiting={FadeOutRight.duration(160)}>
            <InlineTimePicker
              selectedTime={blockEndTime}
              onSelectTime={(date) => {
                setBlockEndTime(date);
                setBlockSheetMode('form');
              }}
            />
          </Animated.View>
        )}
        {blockSheetMode === 'form' && <Animated.View entering={FadeInLeft.duration(220)} exiting={FadeOutLeft.duration(160)}>
        <View style={{ gap: spacing.md }}>
          <View>
            <Text style={styles.bookingSectionLabel}>Giorno</Text>
            <Pressable
              onPress={() => setBlockSheetMode('calendar')}
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
                onPress={() => setBlockSheetMode('startTime')}
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
                onPress={() => setBlockSheetMode('endTime')}
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
        </Animated.View>}
      </NativePageSheet>

      {/* ── Out of Availability ── */}
      <NativePageSheet
        visible={outOfAvailSheetOpen}
        onClose={() => setOutOfAvailSheetOpen(false)}
        title="Guide fuori disponibilità"
      >
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
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
      </NativePageSheet>

      {/* ── Exam details drawer ── */}
      <NativePageSheet
        visible={Boolean(examDrawerGroup)}
        onClose={() => { setExamDrawerGroup(null); setExamDrawerMode('details'); }}
      >
        {examDrawerMode === 'timepicker' && examDrawerGroup ? (
          <View style={{ paddingBottom: 12 }}>
            <Pressable
              onPress={() => setExamDrawerMode('details')}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 }}
            >
              <Ionicons name="arrow-back" size={20} color="#4338CA" />
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#4338CA' }}>Scegli orario esame</Text>
            </Pressable>
            <InlineTimePicker
              selectedTime={examDrawerGroup.endsAt ? new Date(examDrawerGroup.startsAt) : (() => { const d = new Date(); d.setHours(9, 0, 0, 0); return d; })()}
              loading={examTimeSaving}
              onSelectTime={async (d) => {
                if (!examDrawerGroup) return;
                setExamTimeSaving(true);
                const ids = examDrawerGroup.appointments.map((a) => a.id);
                const startsAtDate = new Date(examDrawerGroup.startsAt);
                const newStart = new Date(startsAtDate);
                newStart.setHours(d.getHours(), d.getMinutes(), 0, 0);
                const newEnd = new Date(newStart.getTime() + 60 * 60 * 1000);
                try {
                  await regloApi.updateExamTime({
                    appointmentIds: ids,
                    startsAt: newStart.toISOString(),
                    endsAt: newEnd.toISOString(),
                  });
                  setExamDrawerGroup({
                    ...examDrawerGroup,
                    startsAt: newStart.toISOString(),
                    endsAt: newEnd.toISOString(),
                  });
                  setExamDrawerMode('details');
                  loadData();
                } catch {
                  Alert.alert('Errore', 'Impossibile aggiornare l\u2019orario.');
                } finally {
                  setExamTimeSaving(false);
                }
              }}
            />
          </View>
        ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="school" size={20} color="#4338CA" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: '#1E293B' }}>Esame di guida</Text>
              {examDrawerGroup ? (
                <Text style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>
                  {formatDay(examDrawerGroup.startsAt)}
                  {examDrawerGroup.endsAt
                    ? ` · ${formatTime(examDrawerGroup.startsAt)} – ${formatTime(examDrawerGroup.endsAt)}`
                    : ' · Orario da definire'}
                </Text>
              ) : null}
            </View>
          </View>

          {/* Imposta / Modifica orario */}
          {examDrawerGroup ? (
            <Pressable
              onPress={() => setExamDrawerMode('timepicker')}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 14, backgroundColor: '#EEF2FF', borderWidth: 1, borderColor: '#C7D2FE', marginBottom: 12 }}
            >
              <Ionicons name="time-outline" size={16} color="#4338CA" />
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#4338CA', flex: 1 }}>
                {examDrawerGroup.endsAt ? 'Modifica orario' : 'Imposta orario'}
              </Text>
              <Ionicons name="chevron-forward" size={16} color="#6366F1" />
            </Pressable>
          ) : null}

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
              const name = a.student ? `${a.student.firstName} ${a.student.lastName}`.trim() : 'Allievo';
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
        )}
      </NativePageSheet>

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
                <View style={[styles.fabPillIcon, { backgroundColor: '#EEF0F4' }]}>
                  <Ionicons name="calendar-outline" size={20} color="#1A1A2E" />
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

const COMPACT_HEADER_H = 44;
const LARGE_TITLE_H = 64;
// Max height for the in-sheet picker formsheets (instructor / location): hugs
// content for short lists, scrolls beyond this.
const PICKER_MAX_H = 460;

const scopeStyles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: '#EBEBEB',
    borderRadius: 14,
    padding: 4,
    marginTop: 14,
    marginBottom: 4,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#1A1A2E',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  tabTextActive: {
    color: '#1A1A2E',
    fontWeight: '700',
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
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
    paddingTop: spacing.sm,
  },
  greetName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1A1A2E',
    letterSpacing: -0.2,
  },
  greetNext: {
    flexShrink: 1,
    textAlign: 'right',
    fontSize: 13,
    fontWeight: '500',
    color: '#94A3B8',
  },
  greetDivider: {
    height: 1,
    backgroundColor: '#C2C7D6',
    marginTop: 12,
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

  /* ── CTA Button ── */
  ctaButton: {
    backgroundColor: '#1A1A2E',
    borderRadius: radii.sm,
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    shadowColor: '#1A1A2E',
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
    backgroundColor: '#FDFDFD',
    marginHorizontal: -spacing.lg,
    marginTop: -spacing.lg, // cancel the content container's `gap: spacing.lg` at this boundary
    paddingHorizontal: spacing.lg,
    paddingTop: 13,
    paddingBottom: spacing.sm,
  },
  calendarMonthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  calendarMonthTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#1A1A2E',
    letterSpacing: -0.5,
    lineHeight: 26,
  },
  calendarIconBtn: {
    width: 40,
    height: 30,
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
    backgroundColor: '#1A1A2E',
    borderWidth: 0,
    shadowColor: '#1A1A2E',
    shadowOpacity: 0.22,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  dayPillUnselected: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#ECECEC',
  },
  dayPillToday: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#1A1A2E',
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
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ECECEC',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#1A1A2E',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
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
  qbStepBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },

  /* ── Itinerary list (Airbnb-style day view) ── */
  itinerary: { marginBottom: 12 },
  itinRow: { flexDirection: 'row', alignItems: 'stretch' },
  itinRail: { width: 84, paddingTop: 16, alignItems: 'center', position: 'relative' },
  // Line linking the time pills, with a small gap above/below each pill.
  railLineTop: { position: 'absolute', left: 41, top: 0, height: 12, width: 2, backgroundColor: '#E6E8EC', borderRadius: 1 },
  railLineBottom: { position: 'absolute', left: 41, top: 46, bottom: -14, width: 2, backgroundColor: '#E6E8EC', borderRadius: 1 },
  railPill: {
    minHeight: 26, minWidth: 52, paddingHorizontal: 9, justifyContent: 'center', alignItems: 'center',
    borderRadius: 13, backgroundColor: '#EEF0F4',
  },
  railPillMuted: { backgroundColor: '#F1F3F7' },
  railPillEndpoint: { backgroundColor: '#F1F3F7' },
  railPillNow: { backgroundColor: '#FEE2E2' },
  railPillText: { fontSize: 13, fontWeight: '700', color: '#1A1A2E', letterSpacing: -0.2, fontVariant: ['tabular-nums'] },
  railPillTextMuted: { color: '#94A3B8' },
  railPillTextNow: { color: '#EF4444' },
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
  itinCardActive: { borderWidth: 1.5, borderColor: '#1A1A2E' },
  itinCardMuted: { backgroundColor: '#F7F8FA', shadowOpacity: 0, elevation: 0 },
  itinCardPressed: { opacity: 0.95, transform: [{ scale: 0.992 }] },
  itinTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  itinAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#EEF0F4', alignItems: 'center', justifyContent: 'center' },
  itinAvatarText: { fontSize: 15, fontWeight: '700', color: '#1A1A2E' },
  itinName: { fontSize: 16, fontWeight: '700', color: '#1A1A2E', letterSpacing: -0.2 },
  itinMeta: { fontSize: 13, fontWeight: '500', color: '#94A3B8', marginTop: 2 },
  itinStatusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, marginLeft: 8, flexShrink: 0 },
  itinStatusPillText: { fontSize: 11.5, fontWeight: '700', letterSpacing: 0.1 },
  itinActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  itinActBtn: { flex: 1, minHeight: 44, paddingVertical: 11, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  itinActCheck: { backgroundColor: '#1A1A2E' },
  itinActCheckText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  itinActNo: { backgroundColor: '#F1F5F9' },
  itinActNoText: { fontSize: 14, fontWeight: '700', color: '#64748B' },
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
  dayEmptyInline: { fontSize: 13, fontWeight: '500', color: '#9AA1AC', marginBottom: 14, marginLeft: 84, lineHeight: 18 },
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
  fabOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
    zIndex: 50,
  },
  fabMenuContainer: {
    position: 'absolute',
    bottom: 88,
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
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ECECEC',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
    marginTop: spacing.sm,
    shadowColor: '#1A1A2E',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  bannerText: {
    flex: 1,
    fontSize: 14,
    color: '#1A1A2E',
  },
  bannerCount: {
    fontWeight: '700',
    color: '#1A1A2E',
  },
  bannerAction: {
    fontSize: 13,
    fontWeight: '700',
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
