import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '../components/Screen';
import { Card } from '../components/Card';
import { NativePageSheet } from '../components/NativePageSheet';
import { manageLessonStore, type ManageLessonData, type ManageLessonDetailsPayload, type ManageLessonVehicle } from '../stores/manageLessonStore';
import { swapStore } from '../stores/swapStore';
import { rescheduleStore } from '../stores/rescheduleStore';
import { homeAddSheetStore } from '../stores/homeAddSheetStore';
import { bookingSheetStore } from '../stores/bookingSheetStore';
import { blockSheetStore } from '../stores/blockSheetStore';
import { sickLeaveSheetStore } from '../stores/sickLeaveSheetStore';
import { examSheetStore } from '../stores/examSheetStore';
import { groupLessonSheetStore } from '../stores/groupLessonSheetStore';
import { outOfAvailStore } from '../stores/outOfAvailStore';
import { cancelFaultStore, type CancelFault } from '../stores/cancelFaultStore';
import { lessonInvolvesInstructor, unionCoInstructors } from '../utils/coInstructors';
import { groupOutOfAvailability } from '../utils/outOfAvailability';
import { ScrubBubble } from '../components/BookableBand';
import { requestRoadCheck } from '../road/entryFlow';
import WeeklyAgendaView from '../components/WeeklyAgendaView';
import { ClaySurface } from '../components/clay';
import { AgendaTodayCard } from '../components/agenda/AgendaTodayCard';
import { VITA_ART, greetingFor } from '../theme/vitaArt';
import { CLAY, CLAY_CTA } from '../theme/clay';
import { primaryCtaShadow } from '../components/GradientCTA';
import { blockKindOf } from '../utils/weeklyAgenda';
import { examManageStore } from '../stores/examManageStore';
import { groupLessonManageStore } from '../stores/groupLessonManageStore';
import { ToastNotice, ToastTone } from '../components/ToastNotice';
import { regloApi } from '../services/regloApi';
import {
  AutoscuolaAppointmentWithRelations,
  AutoscuolaInstructor,
  AutoscuolaLocation,
  AutoscuolaSettings,
  AutoscuolaStudentPhase,
  AutoscuolaVehicle,
  InstructorBlock,
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

import { AvailabilityButton, InboxBellButton } from '../components/InboxBellButton';
import { prefetchRoadForAppointment } from '../road/roadAppointmentQuery';
import { useRoadEnabled } from '../hooks/useRoadEnabled';
import { useInstructorTabs } from '../hooks/useInstructorTabs';

// REG-638: icona del bottone «Entra in Road» (stessa della live card).

type InstructorActionStatus = 'checked_in' | 'no_show';
type DrawerAction = InstructorActionStatus | 'save_details';
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


const normalizeStatus = (value: string | null | undefined) =>
  (value ?? '').trim().toLowerCase();



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


const getLessonStateLabel = (lesson: AutoscuolaAppointmentWithRelations, now: Date) => {
  const meta = getLessonStateMeta(lesson, now);
  return meta?.label ?? lesson.status;
};



const addDays = (date: Date, amount: number) => {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + amount);
  return copy;
};



/* ── Inline Calendar Picker (no Modal, renders inside BottomSheet) ── */


/* ── Inline Time Picker (no Modal, renders inside BottomSheet) ── */


export const IstruttoreHomeScreen = ({ ownerMode = false }: { ownerMode?: boolean } = {}) => {
  const router = useRouter();
  // REG-638 «T1 piatta»: Disponibilità e Notifiche non sono più tab per l'istruttore,
  // si aprono da orologio e campanella in testa all'Agenda.
  const headerActions = useInstructorTabs().instructorApp && !ownerMode;
  const { instructorId, autoscuolaRole, activeCompanyId, user } = useSession();
  const { width: screenWidth } = useWindowDimensions();
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
  const [students, setStudents] = useState<Array<{ id: string; firstName: string; lastName: string; phone?: string | null; assignedInstructorId?: string | null; licenseCategory?: string | null; transmission?: string | null; studentPhase?: AutoscuolaStudentPhase; defaultLocationId?: string | null; defaultLocationName?: string | null }>>([]);
  const [vehicles, setVehicles] = useState<Array<{ id: string; name: string; color?: string | null; assignedInstructorId?: string | null; poolInstructorIds?: string[] | null; licenseCategory?: string | null; transmission?: string | null }>>([]);
  const [settings, setSettings] = useState<AutoscuolaSettings | null>(null);
  const [studentCompletedMinutes, setStudentCompletedMinutes] = useState<Record<string, number>>({});
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
  const [clusterDrawerAppts, setClusterDrawerAppts] = useState<AutoscuolaAppointmentWithRelations[] | null>(null);
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
  const rangeKeyRef = useRef<string | null>(null);
  const loadRequestRef = useRef(0);
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const selectedWeekKey = useMemo(() => {
    const m = new Date(selectedDate);
    const dow = m.getDay();
    m.setDate(m.getDate() + (dow === 0 ? -6 : 1 - dow));
    m.setHours(0, 0, 0, 0);
    return m.getTime();
  }, [selectedDate]);
  const [instructorList, setInstructorList] = useState<AutoscuolaInstructor[]>([]);
  const [instructorListLoading, setInstructorListLoading] = useState(false);
  // Per-day availability cache (day view): seed instantly on day change so a
  // revisited day is stable (no stale-previous-day flash, no reload glitch).
  // Keyed by YYYY-MM-DD. Loaded for a 3-week window (prev/current/next) so the
  // weekly pager can swipe to adjacent weeks with availability already present.
  const [weekAvailability, setWeekAvailability] = useState<Record<string, Array<{ startMinutes: number; endMinutes: number }>>>({});
  const [outOfAvailAppointments, setOutOfAvailAppointments] = useState<OutOfAvailabilityAppointment[]>([]);
  const [holidays, setHolidays] = useState<Set<string>>(new Set());
  const [instructorAutonomousMode, setInstructorAutonomousMode] = useState(false);
  const [clusterDurations, setClusterDurations] = useState<number[] | null>(null);
  const dayScrollRef = useRef<ScrollView | null>(null);
  const queryClient = useQueryClient();
  const { enabled: roadEnabled } = useRoadEnabled();
  // Cross-fade applied to the day timeline when a background (stale-while-
  // revalidate) refresh swaps in fresh BE data over an already-painted day.
  const timelineFadeSV = useSharedValue(1);

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
    const matchesScope = (item: {
      instructorId?: string | null;
      coInstructors?: Array<{ id: string }> | null;
    }) => (effectiveInstructorId ? lessonInvolvesInstructor(item, effectiveInstructorId) : true);
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
      const matchesScope = (item: {
        instructorId?: string | null;
        coInstructors?: Array<{ id: string }> | null;
      }) => (effectiveInstructorId ? lessonInvolvesInstructor(item, effectiveInstructorId) : true);
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
    regloApi.getStudentsCompletedHours().then(setStudentCompletedMinutes).catch(() => {});
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setClockTick(Date.now());
    }, 30_000);
    return () => clearInterval(interval);
  }, []);


  const now = useMemo(() => new Date(clockTick), [clockTick]);
  const bookingActors = settings?.appBookingActors ?? 'students';
  const instructorBookingMode = settings?.instructorBookingMode ?? 'manual_engine';
  // Colore blocchi agenda (pannello web "Aspetto"): criterio + override + eccezioni.
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
  // Chi può ricevere una guida (REG-499): solo la fase PRATICA. Un AWAITING non
  // ha il percorso attivato, un TEORIA non ha ancora il foglio rosa e un
  // PATENTATO ha finito — nel picker dell'istruttore erano tutti selezionabili,
  // e i due estremi (patentati e teoria) sono proprio quelli che Tiziano vedeva
  // in lista. La fase arriva già nel bootstrap agenda, bastava guardarla.
  // Nota: `studentPhase` assente = autoscuola legacy senza fasi → il default
  // dello schema è PRATICA, quindi l'allievo resta prenotabile (mai una lista
  // vuota per chi le fasi non le usa).
  const bookableStudents = useMemo(
    () => students.filter((s) => (s.studentPhase ?? 'PRATICA') === 'PRATICA'),
    [students],
  );
  const bookingStudentOptions = useMemo(() => {
    const toOption = (student: typeof students[number], offCluster: boolean) => ({
      value: student.id,
      label: `${student.firstName} ${student.lastName}`.trim(),
      subtitle: offCluster ? 'Non assegnato a te' : (null as string | null),
      licenseCategory: student.licenseCategory ?? null,
      transmission: student.transmission ?? null,
      // Luogo di default (REG-392): precompila il Luogo alla selezione dell'allievo.
      defaultLocationId: student.defaultLocationId ?? null,
      defaultLocationName: student.defaultLocationName ?? null,
    });
    if (!clustersActive) {
      // No cluster lock \u2014 all students are equivalent
      return bookableStudents.map((s) => toOption(s, false));
    }
    // Clusters active: own students first, then others (marked)
    const bookable = new Set(bookableStudents.map((s) => s.id));
    return [
      ...assignedStudents.filter((s) => bookable.has(s.id)).map((s) => toOption(s, false)),
      ...unassignedStudents.filter((s) => bookable.has(s.id)).map((s) => toOption(s, true)),
    ];
  }, [bookableStudents, assignedStudents, unassignedStudents, clustersActive]);
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
      coInstructors?: Array<{ id: string; name: string }> | null;
      notes: string | null;
      appointments: AutoscuolaAppointmentWithRelations[];
    }) => {
      examManageStore.set({
        ...g,
        coInstructors: g.coInstructors ?? null,
        readOnly: ownerMode,
        onChanged: () => { loadData(); },
      });
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
      onApplied: async () => { await loadData(); },
      onDone: (message) => { setToast({ text: message, tone: 'success' }); },
    });
    router.push('/(tabs)/home/create-group-lesson');
  }, [selectedDate, loadData, router]);






  // Out-of-availability banner count: a group lesson's participants are ONE guida.
  // Veicolo esclusivo dell'istruttore: nome e colore nella card «Guida» del «+».
  const myVehicle = useMemo(() => {
    const v = instructorId ? vehicles.find((x) => x.assignedInstructorId === instructorId) : undefined;
    return v ? { name: v.name, color: v.color ?? null } : null;
  }, [vehicles, instructorId]);

  const outOfAvailCount = useMemo(
    () => groupOutOfAvailability(outOfAvailAppointments).length,
    [outOfAvailAppointments],
  );
  // `appointments` now holds the whole fetch window; the day grid renders only
  // the selected day. Filtering here (instead of refetching per day) is what
  // makes day-to-day navigation instant with no skeleton.

  // Raw (non-grouped) list — used for counts, stats, etc.

  // Timeline items: exams grouped by time; other appointments as-is



  // Helper: extract YYYY-MM-DD from ISO string without timezone issues

  // Collect all sick leave dates (using local date, timezone-safe)





  // Per-hour availability coverage: { topFraction, bottomFraction } where 0=start of hour, 1=end

  // NOW line position — fractional hour offset for today only

  const MANDATORY_MINUTES_THRESHOLD = 480; // 8 hours

  const timelineStatusConfig = (status: string, type?: string | null, opts?: { durationMin?: number; studentId?: string }) => {
    const s = normalizeStatus(status);
    // Exam: distinctive purple/indigo theme, overrides normal status visuals
    if (type === 'esame' && s !== 'cancelled' && s !== 'no_show') {
      return { border: '#7C3AED', badgeBg: '#F1F1F1', badgeText: '#6D28D9', label: 'ESAME', isExam: true as const };
    }
    // Group lesson: teal theme (mirrors the agenda card accent).
    if (type === 'group_lesson' && s !== 'cancelled' && s !== 'no_show') {
      return { border: '#10B981', badgeBg: '#D1FAE5', badgeText: '#047857', label: 'GRUPPO', isExam: false as const };
    }
    if (s === 'pending_review')
      return { border: '#F97316', badgeBg: '#FFF7ED', badgeText: '#EA580C', label: 'Da confermare', isExam: false as const };
    if (s === 'checked_in')
      return { border: '#111111', badgeBg: '#F0F0F0', badgeText: '#111111', label: 'In corso', isExam: false as const };
    if (s === 'completed')
      return { border: '#22C55E', badgeBg: '#F0FDF4', badgeText: '#16A34A', label: 'Completata', isExam: false as const };
    if (s === 'no_show' || s === 'cancelled')
      return { border: '#929292', badgeBg: '#F2F2F2', badgeText: '#6A6A6A', label: s === 'no_show' ? 'Assente' : 'Annullata', isExam: false as const };
    // Scheduled/confirmed: mandatory if student has < 8h completed AND lesson is ≥ 60 min
    const completedMins = opts?.studentId ? (studentCompletedMinutes[opts.studentId] ?? 0) : 0;
    const isMandatory = completedMins < MANDATORY_MINUTES_THRESHOLD && (opts?.durationMin ?? 0) >= 60;
    if (isMandatory) {
      return { border: '#14B8A6', badgeBg: '#F0FDFA', badgeText: '#0F766E', label: 'Obbligatoria', isExam: false as const };
    }
    return { border: '#FACC15', badgeBg: '#FEF9C3', badgeText: '#CA8A04', label: 'Programmata', isExam: false as const };
  };

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
    // Percorso Road chiesto subito: il foglio si apre con la card già al suo
    // posto invece di vederla comparire dopo (REG-639 fluidità).
    prefetchRoadForAppointment(queryClient, lesson, roadEnabled);
    // Seed the store synchronously so the route paints immediately, then push.
    manageLessonStore.set(buildManageSnapshot(lesson, null));
    router.push('/(tabs)/home/manage-lesson');
  };


  // Lazily load the instructors list when the user first opens the picker.

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






  // Group by day for section headers


  // ── Calendar day-pills logic (mirroring AllievoHomeScreen) ──
  const ITALIAN_WEEKDAYS = ['DOM', 'LUN', 'MAR', 'MER', 'GIO', 'VEN', 'SAB'] as const;
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


  // Legacy tap+drag grid is disabled (quick-book is now a native formSheet).
  // Kept renderable-but-off via a non-literal flag so TS still type-checks the
  // block; remove the block entirely in a later cleanup.

  // Overall bookable window for the selected day (earliest..latest availability,
  // or a sensible default when none is set).



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


  useEffect(() => {
    if (dayScrollMountedRef.current) {
      scrollToDay(true);
    }
  }, [scrollToDay]);


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
    {
      // Griglia (unica vista): settimana intera Lun–Sab.
      const day = selectedDate.getDay();
      const mondayOffset = day === 0 ? -6 : 1 - day;
      const from = new Date(selectedDate);
      from.setDate(from.getDate() + mondayOffset);
      from.setHours(0, 0, 0, 0);
      const to = new Date(from);
      to.setDate(to.getDate() + 5); // Saturday
      to.setHours(23, 59, 59, 999);
    }

    // Load availability for a 3-week window (prev/current/next) in weekly mode,
    // keyed by date, so the horizontal week-pager always has the neighbouring
    // weeks ready and swiping never flashes empty availability.
    if (instructorId) {
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
    // REG-639: dipende dalla SETTIMANA, non dal giorno — nella vista Giorno si
    // cambia giorno a ogni tocco e le 21 chiamate partirebbero ogni volta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWeekKey, instructorId]);

  // Re-fetch data when screen regains focus (e.g. after changing availability).
  // Gated: returning from a sheet/tab fires 'focus' constantly; without a gate
  // every re-entry re-ran 4 fetch families. Skip the network refresh when the
  // last one was < 30s ago. loadData uses force:false so it reuses the fresh TanStack cache.
  const navigation = useNavigation();
  const lastFocusRefreshRef = useRef(0);
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      const nowMs = Date.now();
      if (nowMs - lastFocusRefreshRef.current < 30_000) return;
      lastFocusRefreshRef.current = nowMs;
      loadData({ force: false });
        loadOutOfAvailability();
      loadHolidays();
    });
    return unsubscribe;
  }, [navigation, loadData, loadOutOfAvailability]);

  const refreshAndSyncDrawer = useCallback(
    async (lessonId: string) => {
      const refreshed = await loadData();
      const refreshedLesson = refreshed.find((item) => item.id === lessonId) ?? null;
      if (!refreshedLesson) {
        setSheetLesson(null);
        return;
      }
      setSheetLesson(refreshedLesson);
    },
    [loadData],
  );

  const executeStatusAction = useCallback(
    async (
      lesson: AutoscuolaAppointmentWithRelations,
      action: InstructorActionStatus,
      options?: { lessonTypes?: string[]; closeDrawerOnSuccess?: boolean; correction?: boolean },
    ) => {
      setToast(null);
      const availability = getActionAvailability(lesson, new Date(), settings?.autoCheckinEnabled);
      // In correzione (guida passata) la finestra "live" è chiusa: si salta il
      // gate temporale e si lascia correggere l'esito. Il backend applica
      // comunque la sua guardia (istruttore, "troppo presto").
      if (!availability.enabled && !options?.correction) {
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
        // REG-638: «Presente» = la guida parte → proponi subito Reglo Road
        // (anche se l'invito era stato chiuso prima della guida).
        if (action === 'checked_in') requestRoadCheck({ force: true });
        setToast({
          text: options?.correction
            ? `Esito corretto: ${action === 'checked_in' ? 'Presente' : 'Assente'}`
            : 'Stato aggiornato',
          tone: 'success',
        });
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

    const payload: {
      lessonType?: string;
      lessonTypes?: string[];
      notes?: string | null;
      evaluations?: Array<{ itemId: string; score: number | null; notApplicable?: boolean }>;
    } = {};
    const initialTypes = resolveInitialLessonTypes(lesson);
    const typesChanged = JSON.stringify([...input.lessonTypes].sort()) !== JSON.stringify([...initialTypes].sort());
    if (input.lessonTypes.length && typesChanged) {
      payload.lessonTypes = input.lessonTypes;
      payload.lessonType = input.lessonTypes[0];
    }

    const currentNotes = normalizeNotes(input.notes);
    const initialNotes = normalizeNotes(lesson.notes);
    if (currentNotes !== initialNotes) {
      payload.notes = currentNotes || null;
    }

    // Pagellino: il foglio lo manda solo se è cambiato. Attenzione all'array
    // VUOTO: è il modo di dire "ho tolto tutte le voci", quindi si inoltra.
    if (input.evaluations !== undefined) {
      payload.evaluations = input.evaluations;
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
      // refreshAndSyncDrawer (not just loadData) so the open sheet's store
      // snapshot picks up the saved tipo/voto/note — otherwise reopening the
      // details sub-sheet right after saving shows stale values.
      await refreshAndSyncDrawer(lessonId);
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


  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    loadOutOfAvailability();
    setRefreshing(false);
  }, [loadData, loadOutOfAvailability]);

  // Permanent delete ("Elimina definitivamente") — same action as the web. Soft
  // delete on the BE (status→cancelled, refunds credit, notifies the student),
  // available regardless of the lesson time/status. Confirmed before running.
  /**
   * REG-587 — annullamento di una guida futura oltre il limite di preavviso.
   * Prima di toccare qualunque cosa chiede DI CHI è l'imprevisto: se è
   * dell'autoscuola l'allievo non paga penali e la guida non finisce nella coda
   * "Cancellazioni tardive" del titolare. Passa dall'endpoint `annul`, lo
   * stesso del web, non dal permanent-delete (che non rilascia gli slot).
   */
  const annulWithFault = useCallback(
    async (lesson: AutoscuolaAppointmentWithRelations, fault: CancelFault) => {
      const lessonId = lesson.id;
      setPendingAction('save_details');
      setToast(null);
      try {
        // `request` scarta l'envelope e LANCIA su success:false → basta await.
        await regloApi.annulAppointment(lessonId, fault);
        await loadData();
        setSheetLesson((prev) => (prev && prev.id === lessonId ? null : prev));
        setToast({
          text:
            fault === 'school'
              ? 'Guida annullata. Nessuna penale per l’allievo.'
              : 'Guida annullata. La valuta il titolare in Cancellazioni tardive.',
          tone: 'success',
        });
      } catch (err) {
        // Come per il delete: la cancellazione spesso passa lato server anche
        // quando la chiamata scade (notifiche lente) — controlla la verità del BE.
        const refreshed = await loadData();
        const stillActive = refreshed.some((a) => a.id === lessonId);
        if (stillActive) {
          setToast({
            text: err instanceof Error ? err.message : 'Errore durante l’annullamento.',
            tone: 'danger',
          });
        } else {
          setSheetLesson((prev) => (prev && prev.id === lessonId ? null : prev));
          setToast({ text: 'Guida annullata.', tone: 'success' });
        }
      } finally {
        setPendingAction(null);
      }
    },
    [loadData],
  );

  /** La domanda ha senso solo se c'è davvero una penale in ballo: guida futura, non esame/gruppo, oltre il cutoff. */
  const needsFaultQuestion = useCallback(
    (lesson: AutoscuolaAppointmentWithRelations) => {
      const type = (lesson.type ?? '').trim().toLowerCase();
      if (type === 'esame' || type === 'group_lesson' || lesson.groupLessonId) return false;
      const status = (lesson.status ?? '').trim().toLowerCase();
      if (status !== 'scheduled' && status !== 'confirmed') return false;
      if (new Date(lesson.startsAt).getTime() <= Date.now()) return false;
      if (!lesson.penaltyCutoffAt) return false;
      return Date.now() > new Date(lesson.penaltyCutoffAt).getTime();
    },
    [],
  );

  const askCancelFault = useCallback(
    (lesson: AutoscuolaAppointmentWithRelations) => {
      const startsAt = new Date(lesson.startsAt);
      const mins = Math.max(0, Math.round((startsAt.getTime() - Date.now()) / 60000));
      const h = Math.floor(mins / 60);
      const countdownLabel = h > 0 ? (mins % 60 ? `${h}h ${mins % 60}min` : `${h}h`) : `${mins} min`;
      cancelFaultStore.set({
        studentName:
          `${lesson.student?.firstName ?? ''} ${lesson.student?.lastName ?? ''}`.trim() || 'L’allievo',
        whenLabel: `${formatDay(lesson.startsAt)} · ${formatTime(lesson.startsAt)}`,
        countdownLabel,
        countdownMinutes: mins,
        coverage: lesson.creditApplied ? 'credit' : lesson.paymentRequired ? 'money' : 'none',
        onPick: (fault) => {
          void annulWithFault(lesson, fault);
        },
      });
      router.push('/(tabs)/home/cancel-fault');
    },
    [annulWithFault, router],
  );

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
      return {
        id: v.id,
        name: v.name,
        subtitle: parts.join(' · ') || null,
        licenseCategory: v.licenseCategory ?? null,
        transmission: v.transmission ?? null,
        assignedInstructorId: v.assignedInstructorId ?? null,
        poolInstructorIds: v.poolInstructorIds ?? null,
      };
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
      '#111111': 'live',
      '#22C55E': 'confirmed',
      '#F97316': 'pending_review',
      '#929292': 'pending_review',
      '#A78BFA': 'pending_review',
    };
    const stateMeta = { label: config.label, tone: toneMap[config.border] ?? 'scheduled' };

    const actionAvail = getActionAvailability(lesson, now, settings?.autoCheckinEnabled);
    const startsFuture = new Date(lesson.startsAt).getTime() > Date.now();

    // Correzione esito su guida passata: la finestra "live" è chiusa ma la guida
    // è ancora correggibile (non annullata/proposta e non "troppo presto"), così
    // l'istruttore può sistemare l'esito senza limite di tempo (es. annullare
    // un'assenza messa per sbaglio).
    const isTooEarly =
      new Date(lesson.startsAt).getTime() - 10 * 60 * 1000 > now.getTime();
    const correctable =
      status !== 'cancelled' && status !== 'proposal' && !isTooEarly;
    const liveEnabled = Boolean(actionAvail.enabled);
    const correctionMode = !ownerMode && correctable && !liveEnabled;
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
      durationMin: (() => {
        const st = new Date(lesson.startsAt).getTime();
        const en = lesson.endsAt ? new Date(lesson.endsAt).getTime() : st + 30 * 60000;
        return Math.max(1, Math.round((en - st) / 60000));
      })(),
      vehiclesEnabled: settings?.vehiclesEnabled !== false,
      // Resolve from the relation, falling back to the vehicles list by id.
      // Append the auto al seguito (follow car) when present.
      vehicleText:
        [
          lesson.vehicle?.name ?? vehicles.find((v) => v.id === lesson.vehicleId)?.name,
          ...(lesson.extraMotoVehicles ?? []).map((v) => v.name),
          lesson.followVehicle?.name,
        ]
          .filter(Boolean)
          .join(' + ') || 'Da assegnare',
      vehicles: vehicleOptions,
      studentLicense: (() => {
        const st = students.find((s) => s.id === lesson.studentId);
        return st ? { licenseCategory: st.licenseCategory ?? null, transmission: st.transmission ?? null } : null;
      })(),
      followCarRules: settings?.followCarRules,
      defaultLocation,
      isDetailsEditable: !ownerMode && isDetailsEditable(lesson, now),
      readOnly: ownerMode,
      showStatusActions: !ownerMode && correctable,
      correctionMode,
      // In correzione mostriamo entrambi i bottoni (per scegliere l'esito giusto);
      // nel flusso live si nasconde "Presente" quando la guida è già checked_in.
      allowPresente: correctionMode ? true : status !== 'checked_in',
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
          correction: correctionMode,
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
          // Annullamento tardivo di una guida futura → prima la domanda su chi
          // ha avuto l'imprevisto (REG-587). Tutti gli altri casi (guide
          // passate, esami, gruppi, annullamenti nei tempi) restano sul
          // permanent-delete di sempre.
          if (needsFaultQuestion(lesson)) askCancelFault(lesson);
          else handlePermanentDelete(lesson);
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
      onChangeExtraMotos: async (vehicleIds) => {
        const lessonId = lesson.id;
        try {
          await regloApi.updateAppointmentDetails(lessonId, { extraMotoVehicleIds: vehicleIds });
          await refreshAndSyncDrawer(lessonId);
        } catch (err) {
          setToast({ text: err instanceof Error ? err.message : 'Errore aggiornando le moto.', tone: 'danger' });
        }
      },
      onChangeFollowVehicle: async (vehicleId) => {
        const lessonId = lesson.id;
        if ((vehicleId ?? null) === (lesson.followVehicle?.id ?? null)) return; // already current
        try {
          await regloApi.updateAppointmentDetails(lessonId, { followVehicleId: vehicleId ?? null });
          await refreshAndSyncDrawer(lessonId);
        } catch (err) {
          setToast({ text: err instanceof Error ? err.message : "Errore aggiornando l'auto al seguito.", tone: 'danger' });
        }
      },
      onChangeDuration: async (min) => {
        const lessonId = lesson.id;
        const st = new Date(lesson.startsAt).getTime();
        const en = lesson.endsAt ? new Date(lesson.endsAt).getTime() : st + 30 * 60000;
        const cur = Math.max(1, Math.round((en - st) / 60000));
        if (min === cur) return; // già la durata attuale — niente da salvare
        try {
          await regloApi.updateAppointmentDetails(lessonId, { durationMin: min });
          await refreshAndSyncDrawer(lessonId);
        } catch (err) {
          setToast({ text: err instanceof Error ? err.message : 'Errore aggiornando la durata.', tone: 'danger' });
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
  }, [sheetLesson, sheetStudentProgress, pendingAction, now, settings, defaultLocation, instructorBookingMode, vehicleOptions, students]);


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
  const seedBlockStore = useCallback((initialDate: Date, presetStartMinutes?: number, presetDurationMinutes?: number, kind?: 'generic' | 'theory') => {
    blockSheetStore.set({
      ...(kind ? { kind } : {}),
      initialDate: initialDate.toISOString(),
      ...(presetStartMinutes != null ? { presetStartMinutes } : {}),
      ...(presetDurationMinutes != null ? { presetDurationMinutes } : {}),
      instructorId: effectiveInstructorId ?? instructorId ?? '',
      onApplied: async () => { await loadData(); },
      onDone: (message) => { setToast({ text: message, tone: 'success' }); },
    });
  }, [effectiveInstructorId, instructorId, loadData]);

  const openBlockDrawer = useCallback(() => {
    seedBlockStore(selectedDate);
    router.push('/(tabs)/home/block-slot');
  }, [seedBlockStore, selectedDate, router]);

  const openTheoryDrawer = useCallback(() => {
    seedBlockStore(selectedDate, undefined, undefined, 'theory');
    router.push('/(tabs)/home/theory-lesson');
  }, [seedBlockStore, selectedDate, router]);

  // Apre il form blocco in modalità MODIFICA, pre-riempiendo da un blocco esistente.
  const openBlockEdit = useCallback((block: InstructorBlock) => {
    const start = new Date(block.startsAt);
    const end = new Date(block.endsAt);
    const startMinutes = start.getHours() * 60 + start.getMinutes();
    const durationMinutes = Math.max(15, Math.round((end.getTime() - start.getTime()) / 60000));
    const kind: 'generic' | 'theory' = blockKindOf(block.reason) === 'theory' ? 'theory' : 'generic';
    blockSheetStore.set({
      kind,
      blockId: block.id,
      initialDate: start.toISOString(),
      presetStartMinutes: startMinutes,
      presetDurationMinutes: durationMinutes,
      reason: block.reason ?? undefined,
      description: block.description ?? undefined,
      instructorId: block.instructorId,
      onApplied: async () => { await loadData(); },
      onDone: (message) => { setToast({ text: message, tone: 'success' }); },
    });
    router.push(kind === 'theory' ? '/(tabs)/home/theory-lesson' : '/(tabs)/home/block-slot');
  }, [loadData, router]);

  // Tap su un blocco in agenda: teorica/generico → modifica; malattia/ferie →
  // rimozione (hanno flussi propri, niente edit).
  const handlePressBlock = useCallback((block: InstructorBlock) => {
    const bk = blockKindOf(block.reason);
    if (bk === 'theory' || bk === 'generic') { openBlockEdit(block); return; }
    const isSick = bk === 'sick';
    Alert.alert(
      isSick ? 'Rimuovi malattia' : 'Rimuovi ferie',
      isSick
        ? 'Vuoi rimuovere la segnalazione di malattia? Le guide già cancellate non verranno ripristinate.'
        : 'Vuoi rimuovere le ferie? Le guide già cancellate non verranno ripristinate.',
      [{ text: 'Annulla', style: 'cancel' }, { text: 'Rimuovi', style: 'destructive', onPress: () => handleDeleteBlock(block.id) }],
    );
  }, [openBlockEdit, handleDeleteBlock]);

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
      vehicles: vehicles.map((v) => ({ id: v.id, name: v.name, licenseCategory: v.licenseCategory ?? null, transmission: v.transmission ?? null, color: v.color ?? null })),
      followCarRules: settings?.followCarRules,
      studentOptions: bookingStudentOptions,
      defaultLocation: defaultLocation
        ? { id: defaultLocation.id, name: defaultLocation.name, address: defaultLocation.address ?? null }
        : null,
      bookedDateKeys: Array.from(bookedDatesSet),
      onApplied: async () => { await loadData(); },
      onDone: (message) => { setToast({ text: message, tone: 'success' }); },
    });
  }, [canInstructorBook, settings?.vehiclesEnabled, settings?.availabilityWeeks, settings?.followCarRules, instructorId, bookingDurations, vehicles, bookingStudentOptions, defaultLocation, bookedDatesSet, loadData]);

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
    // The ghost duration (free 15' steps) is carried through AS-IS. The booking
    // (guida) form snaps it to the nearest guide duration; the block (blocca slot)
    // form keeps it exact.
    seedBookingStore(date, preset, durationMinutes ?? undefined);
    seedBlockStore(date, preset, durationMinutes ?? undefined);
    router.push('/(tabs)/home/quick-book');
  }, [canInstructorBook, seedBookingStore, seedBlockStore, router]);

  const openExamFromAgenda = useCallback((appts: AutoscuolaAppointmentWithRelations[]) => {
    if (!appts.length) return;
    const first = appts[0];
    openExamManage({
      startsAt: first.startsAt,
      endsAt: first.endsAt,
      instructorId: first.instructorId,
      instructorName: first.instructor?.name ?? null,
      // REG-585: unione dei colleghi su tutte le righe dell'esame.
      coInstructors: unionCoInstructors(appts),
      notes: first.notes,
      appointments: appts,
    });
  }, [openExamManage]);

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

  // Ambito per il titolare-istruttore (REG-639): due voci di testo, niente chip.
  const scopeTabs = canSwitchScope ? (
    <View style={hd.scope}>
      {(['personal', 'all'] as const).map((v) => (
        <Pressable
          key={v}
          onPress={() => setCalendarScope(v)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityState={{ selected: calendarScope === v }}
        >
          <Text style={[hd.scopeTx, calendarScope === v && hd.scopeOn]}>
            {v === 'personal' ? 'Le mie guide' : 'Tutti gli istruttori'}
          </Text>
        </Pressable>
      ))}
    </View>
  ) : null;

  // Direzione «D · Mix» (REG-639): sopra il titolo il saluto che cambia con
  // l'ora; la data di oggi la dice la card «Oggi» e la griglia.
  const firstName = user?.name?.trim().split(/\s+/)[0] ?? '';
  const greeting = `${greetingFor(now)}${firstName ? `, ${firstName}` : ''}`;

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <StatusBar style="dark" />
      <ToastNotice message={toast?.text ?? null} tone={toast?.tone} onHide={() => setToast(null)} />
      {/* Agenda REG-639: solo la settimana (griglia) con testata clay. */}
      <View style={{ flex: 1, paddingTop: safeInsets.top }}>
        <View style={hd.wrap}>
          <View style={hd.top}>
            <View style={hd.titles}>
              <Text style={hd.greet} numberOfLines={1}>
                {greeting}
              </Text>
              <Text style={hd.title} accessibilityRole="header">Agenda</Text>
            </View>
            {headerActions ? (
              <View style={styles.headerActions}>
                <AvailabilityButton />
                <InboxBellButton />
              </View>
            ) : null}
          </View>
          {scopeTabs}
          {!initialLoading && error ? <Text style={styles.error}>{error}</Text> : null}
          {effectiveInstructorId && !initialLoading ? (
            <AgendaTodayCard
              appointments={appointments}
              instructorBlocks={instructorBlocks}
              instructorId={effectiveInstructorId}
              now={now}
            />
          ) : null}
          {outOfAvailAppointments.length > 0 && (
            <ClaySurface
              size="sm"
              padded={false}
              radius={18}
              style={hd.oob}
              onPress={() => {
                outOfAvailStore.set({
                  appointments: outOfAvailAppointments,
                  onChanged: () => { loadOutOfAvailability(); loadData(); },
                  onOpenGroupLesson: openGroupLessonManage,
                });
                router.push('/(tabs)/home/out-of-availability');
              }}
              accessibilityLabel={`${outOfAvailCount} guide fuori disponibilità, gestisci`}
            >
              <Image source={VITA_ART.campanella} style={hd.oobArt} />
              <Text style={hd.oobTx} numberOfLines={1}>
                {outOfAvailCount} guid{outOfAvailCount === 1 ? 'a' : 'e'} fuori disponibilità
              </Text>
              <Text style={hd.oobAction}>Gestisci</Text>
              <Ionicons name="chevron-forward" size={17} color={CLAY.chevron} />
            </ClaySurface>
          )}
        </View>

        {/* Agenda = SOLO la vista settimanale (REG-638; confermato da Tiziano 29/10). */}
          <WeeklyAgendaView
            appointments={appointments}
            instructorBlocks={instructorBlocks}
            holidays={holidays}
            anchorDate={selectedDate}
            readOnly={ownerMode}
            loading={appointmentsLoading}
            refreshing={refreshing}
            onRefresh={handleRefresh}
            myInstructorId={effectiveInstructorId ?? null}
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
            onPressExam={openExamFromAgenda}
            onPressGroupLesson={(groupLessonId) => openGroupLessonManage(groupLessonId)}
            onPressBlock={ownerMode ? undefined : (block) => handlePressBlock(block)}
            onBookAt={(ownerMode || !canInstructorBook) ? undefined : (date, startMin, winStart, winEnd, durMin) => {
              openQuickBookSheet(date, startMin, winStart, winEnd, durMin);
            }}
            allowedDurations={bookingDurations}
            onGhostActiveChange={setGhostCtaActive}
          />
      </View>

      {/* ── FAB Menu (nascosto per il titolare: home in sola lettura;
           e mentre la CTA del blocco fantasma occupa il fondo schermo) ── */}
      {!ownerMode && !ghostCtaActive && (
        <FabMenu
          canBook={canInstructorBook}
          canGroupLesson={settings?.groupLessonsEnabled === true}
          myVehicle={myVehicle}
          disabled={isPending}
          onBookLesson={openNewBooking}
          onBlockSlot={openBlockDrawer}
          onTheoryLesson={openTheoryDrawer}
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
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#F0F0F0', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="layers" size={20} color={'#111111'} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: '#222222' }}>
                {clusterDrawerAppts?.length ?? 0} guide contemporanee
              </Text>
              {clusterDrawerAppts?.[0] ? (
                <Text style={{ fontSize: 13, color: '#6A6A6A', marginTop: 2 }}>
                  {formatDay(clusterDrawerAppts[0].startsAt)}
                </Text>
              ) : null}
            </View>
          </View>

          <View style={{ borderRadius: 14, borderWidth: 1, borderColor: '#DDDDDD', backgroundColor: '#FFFFFF', overflow: 'hidden' }}>
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
                    borderBottomColor: '#F2F2F2',
                    backgroundColor: pressed ? '#F7F7F7' : '#FFFFFF',
                  })}
                >
                  <View style={{ width: 4, height: 36, borderRadius: 2, backgroundColor: cfg.border }} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: '#222222' }}>
                        {formatTime(a.startsAt)} {'\u2013'} {formatTime(a.endsAt ?? a.startsAt)}
                      </Text>
                      <View style={[styles.timelineStatusBadge, { backgroundColor: cfg.badgeBg }]}>
                        <Text style={[styles.timelineStatusText, { color: cfg.badgeText, fontSize: 9 }]}>
                          {cfg.label}
                        </Text>
                      </View>
                    </View>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#222222' }} numberOfLines={1}>
                      {studentName}
                    </Text>
                    {instrName ? (
                      <Text style={{ fontSize: 12, color: '#6A6A6A' }} numberOfLines={1}>
                        {instrName}
                      </Text>
                    ) : null}
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#C4C4C4" />
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </NativePageSheet>


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
  onTheoryLesson,
  onCreateExam,
  onCreateGroupLesson,
  onSickLeave,
  myVehicle,
}: {
  canBook: boolean;
  canGroupLesson: boolean;
  myVehicle: { name: string; color: string | null } | null;
  disabled: boolean;
  onBookLesson: () => void;
  onBlockSlot: () => void;
  onTheoryLesson: () => void;
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
      onTheory: onTheoryLesson,
      onExam: onCreateExam,
      onGroupLesson: onCreateGroupLesson,
      onSick: onSickLeave,
      myVehicle,
    });
    router.push('/(tabs)/home/add-action');
  }, [myVehicle, canBook, canGroupLesson, onBookLesson, onBlockSlot, onTheoryLesson, onCreateExam, onCreateGroupLesson, onSickLeave, router]);

  return (
    <AnimatedPressable
      onPress={disabled ? undefined : openMenu}
      onPressIn={() => { fabScale.value = withTiming(0.92, { duration: 90 }); }}
      onPressOut={() => { fabScale.value = withTiming(1, { duration: 120 }); }}
      style={[styles.fab, disabled && { opacity: 0.5 }, fabStyle]}
      testID="agenda-fab"
      accessibilityLabel="Nuovo"
    >
      <Ionicons name="add" size={28} color="#FFFFFF" />
    </AnimatedPressable>
  );
};

const LARGE_TITLE_H = 64;
// Max height for the in-sheet picker formsheets (instructor / location): hugs
// content for short lists, scrolls beyond this.


const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.xxl * 2 + spacing.md,
  },
  headerActions: { marginLeft: 'auto', flexDirection: 'row', gap: 10 },
  greetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  greetName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#929292',
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
    color: '#222222',
  },
  subtitle: {
    ...typography.body,
    color: '#6A6A6A',
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
    backgroundColor: '#E8E8E8',
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
    color: '#111111',
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
    color: '#111111',
  },
  largeSub: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6A6A6A',
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
    backgroundColor: '#F4F4F4',
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
    color: '#111111',
    letterSpacing: -0.6,
    lineHeight: 26,
  },
  calendarMonthYear: {
    color: '#929292',
    fontWeight: '600',
  },
  calendarTodayChip: {
    height: 34,
    paddingHorizontal: 15,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#111111',
    shadowOpacity: 0.10,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  calendarTodayChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111111',
  },
  calendarIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#111111',
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
    backgroundColor: '#111111',
    borderWidth: 0,
    shadowColor: '#111111',
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
    backgroundColor: '#EBEBEB',
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
    color: '#929292',
  },
  dayPillWeekdayToday: {
    color: '#111111',
  },
  dayPillNumber: {
    fontSize: 20,
    fontWeight: '700',
  },
  dayPillNumberSelected: {
    color: '#FFFFFF',
  },
  dayPillNumberUnselected: {
    color: '#111111',
  },
  dayPillNumberToday: {
    color: '#111111',
  },

  dayPillDot: {
    position: 'absolute',
    bottom: 8,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#111111',
  },
  dayPillDotHighlight: {
    backgroundColor: '#FACC15',
  },
  // Exam / sick dots: absolute like the booking dot, so the weekday + number
  // stay vertically aligned across every day (inline dots used to push them up).
  dayPillExamDot: {
    backgroundColor: '#111111',
  },
  dayPillSickDot: {
    backgroundColor: '#C2410C',
  },
  dayPillFerieDot: {
    backgroundColor: '#0F766E',
  },
  dayPillTheoryDot: {
    backgroundColor: '#111111',
  },
  dayPillHoliday: {
    backgroundColor: '#FFF3DD',
  },
  dayPillWeekdayHoliday: {
    color: '#D97706',
  },
  dayPillNumberHoliday: {
    color: '#D97706',
  },
  dayPillHolidayDot: {
    position: 'absolute',
    bottom: 8,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D97706',
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
    color: '#929292',
    marginTop: 2,
  },

  /* ── Agenda Section ── */
  agendaSection: {
    gap: spacing.sm,
  },
  agendaSectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#222222',
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
    borderColor: '#DDDDDD',
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
    color: '#222222',
    flex: 1,
  },
  agendaStudent: {
    fontSize: 14,
    lineHeight: 20,
    color: '#222222',
    fontWeight: '500',
  },
  agendaMeta: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    color: '#6A6A6A',
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
    backgroundColor: '#F0F0F0',
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
    color: '#111111',
  },
  sheetMoreBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F2F2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetSaveBtn: {
    backgroundColor: '#111111',
    minHeight: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#111111',
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
    shadowColor: '#111111',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  modalInfoBold: {
    fontSize: 16,
    fontWeight: '700',
    color: '#222222',
  },
  modalInfoName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#222222',
  },
  modalInfoPhone: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111111',
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
    borderColor: '#DDDDDD',
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
    backgroundColor: '#111111',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#111111',
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
    color: '#929292',
  },
  modalSection: {
    gap: 4,
  },
  modalSectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#929292',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  /* ── Grouped detail list (istruttore + luogo) ── */
  detailGroupCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ECECEC',
    shadowColor: '#111111',
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
    backgroundColor: '#F0F0F0',
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
    color: '#929292',
  },
  detailRowValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111111',
  },
  detailRowSub: {
    fontSize: 13,
    color: '#929292',
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
    backgroundColor: '#F2F2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerAvatarActive: {
    backgroundColor: '#111111',
  },
  pickerName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111111',
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
  availBadgeNeutral: { backgroundColor: '#F2F2F2' },
  availBadgeNeutralText: { color: '#6A6A6A', fontSize: 13 },
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
    color: '#929292',
  },
  sheetProgressCount: {
    fontSize: 14,
    fontWeight: '700',
    color: '#222222',
  },
  sheetProgressBarBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#DDDDDD',
  },
  sheetProgressBarFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#111111',
  },
  sheetProgressHint: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6A6A6A',
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
    color: '#111111',
    backgroundColor: '#F7F7F7',
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
    borderColor: '#DDDDDD',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    gap: 2,
  },
  datePickerLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#929292',
    letterSpacing: 0.3,
  },
  datePickerValue: {
    fontSize: 15,
    fontWeight: '500',
    color: '#222222',
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
    backgroundColor: 'rgba(27,27,27, 0.3)',
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
    backgroundColor: '#F7F7F7',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bookingStudentName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#222222',
  },
  bookingStudentChange: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111111',
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
    shadowColor: '#111111',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  nextBannerLive: {
    backgroundColor: '#F0F0F0',
    borderColor: '#DADADA',
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
    backgroundColor: '#111111',
  },
  nextBannerLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111111',
  },
  nextBannerInfo: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6A6A6A',
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
    borderColor: '#F2F2F2',
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
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyDayTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#222222',
  },
  emptyDaySubtitle: {
    fontSize: 13,
    color: '#929292',
    marginTop: 2,
    lineHeight: 18,
  },

  /* ── Empty state (Fluent, centered) ── */
  dayEmpty: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24 },
  dayEmptyImg: { width: 76, height: 76, resizeMode: 'contain', marginBottom: 16 },
  dayEmptyTitle: { fontSize: 19, fontWeight: '700', color: '#111111', letterSpacing: -0.3 },
  dayEmptySub: { fontSize: 14, fontWeight: '500', color: '#929292', marginTop: 6, textAlign: 'center', lineHeight: 20, maxWidth: 280 },
  dayEmptyCta: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 20,
    paddingVertical: 13, paddingHorizontal: 22, borderRadius: 26,
    ...primaryCtaShadow,
  },
  dayEmptyCtaText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.2 },

  /* ── Itinerary list (Airbnb-style day view) ── */
  itinerary: { marginBottom: 12 },
  itinRow: { flexDirection: 'row', alignItems: 'stretch' },
  itinRail: { width: 84, paddingTop: 16, alignItems: 'center', position: 'relative' },
  // Line linking the time pills, with a small gap above/below each pill.
  railLineTop: { position: 'absolute', left: 41, top: 0, height: 12, width: 2, backgroundColor: '#E8E8E8', borderRadius: 1 },
  railLineBottom: { position: 'absolute', left: 41, top: 46, bottom: -14, width: 2, backgroundColor: '#E8E8E8', borderRadius: 1 },
  railLineFull: { position: 'absolute', left: 41, top: 0, bottom: -14, width: 2, backgroundColor: '#E8E8E8', borderRadius: 1 },
  railPill: {
    minHeight: 26, minWidth: 52, paddingHorizontal: 9, justifyContent: 'center', alignItems: 'center',
    borderRadius: 13, backgroundColor: '#F0F0F0',
  },
  railPillMuted: { backgroundColor: '#F1F3F7' },
  railPillEndpoint: { backgroundColor: '#F1F3F7' },
  railPillNow: { backgroundColor: '#DCFCE7' },
  railPillText: { fontSize: 13, fontWeight: '700', color: '#111111', letterSpacing: -0.2, fontVariant: ['tabular-nums'] },
  railPillTextMuted: { color: '#929292' },
  railPillTextNow: { color: '#16A34A' },
  // Past portion of the rail is illuminated (green); future stays grey.
  lineLive: { backgroundColor: '#22C55E' },
  // In-progress lesson rail: start pill (light green) + current-time pill (solid green).
  itinRailNow: { width: 84, paddingTop: 16, alignItems: 'center', position: 'relative' },
  railFlowMid: { width: 2, height: 14, backgroundColor: '#22C55E', borderRadius: 1, marginVertical: 3 },
  railFlowFill: { width: 2, flex: 1, minHeight: 12, backgroundColor: '#E8E8E8', borderRadius: 1, marginTop: 3, marginBottom: -14 },
  railPillCurrent: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8 },
  railCurrentDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#16A34A' },
  // Current-time marker: a coloured dot centred on the rail line (left 41, w2 → centre 42),
  // green line above (past), grey below (future).
  itinNowRow: { flexDirection: 'row', height: 18 },
  railNowLineTop: { position: 'absolute', left: 41, top: 0, height: 9, width: 2, backgroundColor: '#22C55E', borderRadius: 1 },
  railNowLineBottom: { position: 'absolute', left: 41, top: 9, bottom: -14, width: 2, backgroundColor: '#E8E8E8', borderRadius: 1 },
  railNowDot: { position: 'absolute', left: 36, top: 3, width: 12, height: 12, borderRadius: 6, backgroundColor: '#16A34A', borderWidth: 2.5, borderColor: '#FFFFFF', zIndex: 3 },
  itinCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 14,
    marginBottom: 14,
    shadowColor: '#111111',
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
    backgroundColor: '#F7F7F7', borderRadius: 22, padding: 14, marginBottom: 14,
    shadowColor: '#8B5CF6', shadowOpacity: 0.22, shadowRadius: 14, shadowOffset: { width: 0, height: 5 }, elevation: 4,
  },
  examGroupIcon: { width: 42, height: 42 },
  examGroupLabel: { fontSize: 12, fontWeight: '600', color: '#6D28D9' },
  examGroupTitle: { fontSize: 16, fontWeight: '600', color: '#4C1D95', letterSpacing: -0.2, marginTop: 2 },
  // Lezione teorica — sorella indaco della card esame (icona libri 3D).
  theoryItinCard: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#EFEDE8', borderRadius: 22, padding: 14, marginBottom: 14,
    shadowColor: '#111111', shadowOpacity: 0.22, shadowRadius: 14, shadowOffset: { width: 0, height: 5 }, elevation: 4,
  },
  theoryItinIcon: { width: 42, height: 42 },
  theoryItinLabel: { fontSize: 12, fontWeight: '600', color: '#111111' },
  theoryItinTitle: { fontSize: 16, fontWeight: '600', color: '#111111', letterSpacing: -0.2, marginTop: 2 },
  // Group-lesson card — bigger than a normal lesson, teal accent, NO student name.
  groupLessonCard: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#ECFDF5', borderRadius: 22, paddingVertical: 20, paddingHorizontal: 16, marginBottom: 14,
    shadowColor: '#10B981', shadowOpacity: 0.22, shadowRadius: 14, shadowOffset: { width: 0, height: 5 }, elevation: 4,
  },
  groupLessonCardMoto: { backgroundColor: '#FFEDD5', shadowColor: '#F97316' },
  groupLessonIcon: { width: 48, height: 48 },
  groupLessonLabel: { fontSize: 12.5, fontWeight: '600', color: '#0F766E' },
  groupLessonLabelMoto: { color: '#C2410C' },
  groupLessonTitle: { fontSize: 16, fontWeight: '600', color: '#115E59', letterSpacing: -0.2, marginTop: 2 },
  groupLessonTitleMoto: { color: '#9A3412' },
  // Chip tipo guida moto (birilli/strada) sulla card gruppo-moto della lista
  // itinerario — pill bianca, testo/icona arancio (REG-406).
  // REG-585: riga "condivisa con ..." sulla card della guida di gruppo.
  glSharedRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  glSharedText: { flex: 1, fontSize: 11.5, fontWeight: '600', color: '#047857' },
  glItinMotoChip: { flexDirection: 'row', alignItems: 'center', gap: 3, alignSelf: 'flex-start', marginTop: 5, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, backgroundColor: '#FFFFFF' },
  glItinMotoChipText: { fontSize: 10.5, fontWeight: '700', color: '#C2410C', letterSpacing: 0.2 },
  // Badge di tipo: stesso pill del web (bordo + fondo tenue + testo in tinta),
  // cosi' la card si riconosce a colpo d'occhio come di la'.
  typeBadge: {
    alignSelf: 'flex-start', marginTop: 6, borderWidth: 1, borderRadius: 999,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  typeBadgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  badgeGroup: { borderColor: '#99F6E4', backgroundColor: 'rgba(153,246,228,0.6)' },
  badgeGroupText: { color: '#0F766E' },
  badgeMoto: { borderColor: '#FED7AA', backgroundColor: 'rgba(254,215,170,0.6)' },
  badgeMotoText: { color: '#C2410C' },
  badgeExam: { borderColor: '#E6E6E6', backgroundColor: 'rgba(221,214,254,0.6)' },
  badgeExamText: { color: '#6D28D9' },
  glSeats: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 9 },
  glSeat: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#0F766E' },
  glSeatEmpty: { backgroundColor: '#A7D8CE' },
  glSeatMoto: { backgroundColor: '#C2410C' },
  glSeatEmptyMoto: { backgroundColor: '#FCD9B8' },
  glSeatsText: { fontSize: 12, fontWeight: '500', color: '#0F766E', marginLeft: 4 },
  glSeatsTextMoto: { color: '#C2410C' },
  itinTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  itinAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#F0F0F0', alignItems: 'center', justifyContent: 'center' },
  itinAvatarText: { fontSize: 15, fontWeight: '700', color: '#111111' },
  itinName: { fontSize: 16, fontWeight: '700', color: '#111111', letterSpacing: -0.2 },
  itinMeta: { fontSize: 13, fontWeight: '500', color: '#929292', marginTop: 2 },
  itinStatusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, marginLeft: 8, flexShrink: 0 },
  itinStatusPillText: { fontSize: 11.5, fontWeight: '700', letterSpacing: 0.1 },
  itinActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  itinRoadBtn: { minHeight: 46, marginTop: 10, borderRadius: 999, backgroundColor: '#111111', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  itinRoadIc: { width: 20, height: 20 },
  itinCar: { width: 52, height: 42 },
  itinStatusPillLive: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  itinLiveDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#E5484D' },
  itinRoadTx: { fontSize: 14.5, fontWeight: '600', color: '#FFFFFF' },
  itinActBtn: { flex: 1, minHeight: 46, paddingVertical: 11, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  itinActCheck: { backgroundColor: '#111111' },
  itinActCheckText: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  itinActNo: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: '#EBEBEB' },
  itinActNoText: { fontSize: 14, fontWeight: '600', color: '#6A6A6A' },
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
  itinGapText: { fontSize: 13, fontWeight: '600', color: '#9E9E9E' },
  itinGapAdd: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  itinGapAddText: { fontSize: 13, fontWeight: '700', color: '#111111' },
  itinFree: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, paddingHorizontal: 14, marginBottom: 14,
    borderRadius: 18, borderWidth: 1.5, borderColor: '#E6E6EA', borderStyle: 'dashed',
    backgroundColor: 'transparent',
  },
  itinFreeAdd: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F0F0F0', alignItems: 'center', justifyContent: 'center' },
  itinFreeTitle: { fontSize: 14, fontWeight: '700', color: '#111111', letterSpacing: -0.1 },
  itinFreeSub: { fontSize: 12, fontWeight: '500', color: '#9E9E9E', marginTop: 1 },
  itinMarkerBody: { flex: 1, paddingTop: 22, marginBottom: 14 },
  itinMarkerText: { fontSize: 13, fontWeight: '700', color: '#595959', letterSpacing: 0.1 },
  dayEmptyInline: { fontSize: 13, fontWeight: '500', color: '#9E9E9E', textAlign: 'center', marginTop: 4, marginBottom: 16, paddingHorizontal: 24, lineHeight: 18 },
  itinNowBody: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 22, marginBottom: 14 },
  itinNowLine: { flex: 1, height: 1.5, backgroundColor: '#C13515', opacity: 0.45 },
  itinNowLabel: { fontSize: 11, fontWeight: '700', color: '#C13515' },
  hourLabel: {
    width: 46,
    fontSize: 12,
    fontWeight: '500',
    color: '#929292',
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
    borderLeftColor: '#DDDDDD',
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
    color: '#C4C4C4',
    letterSpacing: 0.3,
  },
  emptyHourLine: {
    height: 1,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F2',
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
    borderColor: '#F2F2F2',
    shadowColor: '#6A6A6A',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    overflow: 'hidden' as const,
  },
  timelineBlockActive: {
    backgroundColor: '#F4F4F4',
    borderLeftWidth: 5,
    borderLeftColor: '#111111',
    borderColor: '#D9D9D9',
    shadowColor: '#111111',
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
    color: '#222222',
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
    color: '#444444',
  },
  timelineBlockMeta: {
    fontSize: 12,
    fontWeight: '500',
    color: '#929292',
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
    backgroundColor: '#F2F2F2',
  },
  timelineNoShowText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6A6A6A',
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
    color: '#929292',
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
    backgroundColor: '#F7F7F7',
    borderRadius: 10,
  },
  timelineWaitingText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#929292',
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
    backgroundColor: '#C13515',
    marginLeft: -6,
    shadowColor: '#C13515',
    shadowOpacity: 0.4,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  nowLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#C13515',
    opacity: 0.7,
  },
  nowLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#C13515',
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
    alignItems: 'center',
    justifyContent: 'center',
    // REG-639: nero clay gonfio, come la CTA primaria (variante A).
    ...CLAY_CTA.primary,
    zIndex: 52,
  },
});


/* Testata dell'Agenda — REG-639 clay (notte 28/10/2026). */
const hd = StyleSheet.create({
  wrap: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 12 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  titles: { flex: 1, minWidth: 0 },
  title: { fontSize: 32, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.9 },
  greet: { fontSize: 15, fontWeight: '500', color: CLAY.ink3, marginBottom: 1 },
  scope: { flexDirection: 'row', gap: 20, marginTop: 14 },
  scopeTx: { fontSize: 15, fontWeight: '500', color: CLAY.ink4 },
  scopeOn: { color: CLAY.ink, fontWeight: '600' },
  oob: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10, paddingVertical: 10, paddingHorizontal: 14 },
  oobArt: { width: 30, height: 30 },
  oobTx: { flex: 1, fontSize: 15, fontWeight: '500', color: CLAY.ink },
  oobAction: { fontSize: 15, fontWeight: '600', color: CLAY.ink },
});
