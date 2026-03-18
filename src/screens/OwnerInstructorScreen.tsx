import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  LayoutAnimation,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../components/Screen';
import { BottomSheet } from '../components/BottomSheet';
import { TimePickerDrawer } from '../components/TimePickerDrawer';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { SkeletonBlock } from '../components/Skeleton';
import { ToastNotice } from '../components/ToastNotice';
import { MiniCalendar } from '../components/MiniCalendar';
import RangesEditor from '../components/RangesEditor';
import { regloApi } from '../services/regloApi';
import {
  AutoscuolaAppointmentWithRelations,
  AutoscuolaInstructor,
  AutoscuolaSettings,
  DailyAvailabilityOverride,
  TimeRange,
} from '../types/regloApi';
import { colors, radii, spacing } from '../theme';

// ─── Helpers ──────────────────────────────────────────────────

const STATUS_GREEN = '#22C55E';
const STATUS_RED = '#EF4444';
const STATUS_GRAY = '#CBD5E1';

const getInitials = (name: string): string => {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
};

const isInstructorBusy = (
  instructorId: string,
  appointments: AutoscuolaAppointmentWithRelations[],
  now: Date,
): boolean => {
  return appointments.some((appt) => {
    if (appt.instructorId !== instructorId) return false;
    const validStatuses = ['scheduled', 'confirmed', 'checked_in'];
    if (!validStatuses.includes(appt.status)) return false;
    const start = new Date(appt.startsAt);
    const end = appt.endsAt
      ? new Date(appt.endsAt)
      : new Date(start.getTime() + 30 * 60 * 1000);
    return start <= now && now < end;
  });
};

type InstructorStatus = 'free' | 'busy' | 'offline';

const getInstructorStatus = (
  instructor: AutoscuolaInstructor,
  appointments: AutoscuolaAppointmentWithRelations[],
  now: Date,
): InstructorStatus => {
  if (instructor.status !== 'active') return 'offline';
  if (isInstructorBusy(instructor.id, appointments, now)) return 'busy';
  return 'free';
};

const statusColor = (status: InstructorStatus): string => {
  switch (status) {
    case 'free':
      return STATUS_GREEN;
    case 'busy':
      return STATUS_RED;
    case 'offline':
      return STATUS_GRAY;
  }
};

const statusLabel = (status: InstructorStatus): string => {
  switch (status) {
    case 'free':
      return 'Libero';
    case 'busy':
      return 'In guida';
    case 'offline':
      return 'Offline';
  }
};


const isToday = (dateStr: string): boolean => {
  const d = new Date(dateStr);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
};

const dayLetters = ['D', 'L', 'M', 'M', 'G', 'V', 'S'];

const buildTime = (hours: number, minutes: number) => {
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
};

const pad = (value: number) => value.toString().padStart(2, '0');

const toDateString = (value: Date) => {
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
};

const addDays = (date: Date, amount: number) => {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + amount);
  return copy;
};

const ITALIAN_DAYS = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
const ITALIAN_MONTHS_SHORT = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

/** Detect ranges from contiguous sorted slots. Gaps >= 60 min create a new range. */
const detectRangesFromSlots = (
  slots: Array<{ startsAt: string; endsAt: string; status?: string }>,
): TimeRange[] => {
  const usable = slots
    .filter((s) => s.status !== 'cancelled')
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  if (!usable.length) return [];
  const ranges: TimeRange[] = [];
  let rangeStart = new Date(usable[0].startsAt);
  let rangeEnd = new Date(usable[0].endsAt);
  for (let i = 1; i < usable.length; i++) {
    const slotStart = new Date(usable[i].startsAt);
    const slotEnd = new Date(usable[i].endsAt);
    const gap = slotStart.getTime() - rangeEnd.getTime();
    if (gap >= 60 * 60 * 1000) {
      // gap >= 60 min -> finalize current range, start new one
      ranges.push({
        startMinutes: rangeStart.getHours() * 60 + rangeStart.getMinutes(),
        endMinutes: rangeEnd.getHours() * 60 + rangeEnd.getMinutes(),
      });
      rangeStart = slotStart;
    }
    rangeEnd = slotEnd;
  }
  ranges.push({
    startMinutes: rangeStart.getHours() * 60 + rangeStart.getMinutes(),
    endMinutes: rangeEnd.getHours() * 60 + rangeEnd.getMinutes(),
  });
  return ranges;
};

// ─── Component ────────────────────────────────────────────────

export const OwnerInstructorScreen = () => {
  const router = useRouter();
  const [instructors, setInstructors] = useState<AutoscuolaInstructor[]>([]);
  const [selectedInstructorId, setSelectedInstructorId] = useState<string | null>(null);
  const [appointments, setAppointments] = useState<AutoscuolaAppointmentWithRelations[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [settings, setSettings] = useState<AutoscuolaSettings | null>(null);

  // Invite drawer state
  const [inviteDrawerOpen, setInviteDrawerOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteSending, setInviteSending] = useState(false);

  // Availability drawer state
  const [availDrawerOpen, setAvailDrawerOpen] = useState(false);
  const [availDays, setAvailDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [availLoading, setAvailLoading] = useState(false);
  const [availSaving, setAvailSaving] = useState(false);
  // Tab state: 'default' = Predefinito, 'calendar' = Calendario
  const [activeTab, setActiveTab] = useState<'default' | 'calendar'>('default');
  // Default tab: ranges replacing morning/afternoon
  const [defaultRanges, setDefaultRanges] = useState<TimeRange[]>([{ startMinutes: 480, endMinutes: 720 }]);
  // Calendar tab
  const [overrides, setOverrides] = useState<DailyAvailabilityOverride[]>([]);
  const [calSelectedDate, setCalSelectedDate] = useState<string | null>(null);
  const [calRanges, setCalRanges] = useState<TimeRange[]>([]);
  const [calSaving, setCalSaving] = useState(false);
  // Unified time picker context
  const [timePickerContext, setTimePickerContext] = useState<{
    tab: 'default' | 'calendar';
    rangeIndex: number;
    field: 'start' | 'end';
  } | null>(null);

  const loadData = useCallback(async () => {
    setError(null);
    try {
      const from = new Date();
      from.setDate(from.getDate() - 1);
      from.setHours(0, 0, 0, 0);
      const to = new Date();
      to.setDate(to.getDate() + 7);
      to.setHours(23, 59, 59, 999);

      const [agendaBootstrap, settingsRes] = await Promise.all([
        regloApi.getAgendaBootstrap({
          instructorId: selectedInstructorId ?? undefined,
          from: from.toISOString(),
          to: to.toISOString(),
          limit: 180,
        }),
        regloApi.getAutoscuolaSettings(),
      ]);
      setInstructors(agendaBootstrap.instructors);
      setAppointments(agendaBootstrap.appointments);
      setSettings(settingsRes);
      if (!selectedInstructorId && agendaBootstrap.instructors.length) {
        setSelectedInstructorId(agendaBootstrap.instructors[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore nel caricamento');
    } finally {
      setInitialLoading(false);
    }
  }, [selectedInstructorId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const now = useMemo(() => new Date(), [appointments]); // refreshes on new data

  const selectedInstructor = useMemo(
    () => instructors.find((item) => item.id === selectedInstructorId) ?? null,
    [instructors, selectedInstructorId],
  );

  const busyCount = useMemo(
    () => instructors.filter((i) => isInstructorBusy(i.id, appointments, now)).length,
    [instructors, appointments, now],
  );

  // Today's stats for selected instructor
  const todayStats = useMemo(() => {
    if (!selectedInstructorId) return { total: 0, completed: 0, upcoming: 0 };
    const todayAppts = appointments.filter(
      (a) =>
        a.instructorId === selectedInstructorId &&
        a.status !== 'cancelled' &&
        isToday(a.startsAt),
    );
    const completed = todayAppts.filter(
      (a) => a.status === 'completed' || a.status === 'checked_out',
    ).length;
    const upcoming = todayAppts.filter((a) => new Date(a.startsAt) > now).length;
    return { total: todayAppts.length, completed, upcoming };
  }, [appointments, selectedInstructorId, now]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const selectedStatus: InstructorStatus = selectedInstructor
    ? getInstructorStatus(selectedInstructor, appointments, now)
    : 'offline';

  // ─── Availability Drawer Logic ─────────────────────────────

  const loadInstructorAvailability = useCallback(async (instructorId: string) => {
    setAvailLoading(true);
    try {
      const anchor = new Date();
      anchor.setHours(0, 0, 0, 0);
      const dates = Array.from({ length: 7 }, (_, i) => addDays(anchor, i));
      const responses = await Promise.all(
        dates.map((day) =>
          regloApi.getAvailabilitySlots({
            ownerType: 'instructor',
            ownerId: instructorId,
            date: toDateString(day),
          }),
        ),
      );

      // Build detected ranges per day and merge into a single set of ranges
      const activeDays: number[] = [];
      let mergedRanges: TimeRange[] = [];

      responses.forEach((response, index) => {
        if (!response || response.length === 0) return;
        const detected = detectRangesFromSlots(response);
        if (detected.length === 0) return;
        activeDays.push(dates[index].getDay());
        // Use the ranges from the first active day as the default template
        if (mergedRanges.length === 0) {
          mergedRanges = detected;
        }
      });

      if (activeDays.length) {
        setAvailDays(Array.from(new Set(activeDays)).sort());
        setDefaultRanges(mergedRanges);
      } else {
        setAvailDays([]);
        setDefaultRanges([{ startMinutes: 480, endMinutes: 720 }]);
      }
    } catch {
      setError('Errore caricando disponibilità istruttore');
    } finally {
      setAvailLoading(false);
    }
  }, []);

  const openAvailDrawer = useCallback(async () => {
    if (!selectedInstructorId) return;
    setActiveTab('default');
    setCalSelectedDate(null);
    setCalRanges([]);
    setAvailDrawerOpen(true);
    await loadInstructorAvailability(selectedInstructorId);
    // Load daily overrides
    try {
      const res = await regloApi.getDailyAvailabilityOverrides({
        ownerType: 'instructor',
        ownerId: selectedInstructorId,
      });
      setOverrides(res ?? []);
    } catch {
      setOverrides([]);
    }
  }, [selectedInstructorId, loadInstructorAvailability]);

  const closeAvailDrawer = useCallback(() => {
    if (availSaving || calSaving) return;
    setAvailDrawerOpen(false);
  }, [availSaving, calSaving]);

  const toggleAvailDay = (day: number) => {
    setAvailDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort(),
    );
  };

  const handleSwitchTab = useCallback((tab: 'default' | 'calendar') => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveTab(tab);
    setTimePickerContext(null);
  }, []);

  // ── Calendar tab: select a date ──
  const handleCalSelectDate = useCallback((dateStr: string) => {
    setCalSelectedDate(dateStr);
    // Check if there's an existing override for this date
    const existing = overrides.find((o) => (typeof o.date === 'string' ? o.date.slice(0, 10) : '') === dateStr);
    if (existing) {
      setCalRanges(existing.ranges.map((r) => ({ ...r })));
    } else {
      // Pre-fill from default ranges
      setCalRanges(defaultRanges.map((r) => ({ ...r })));
    }
  }, [overrides, defaultRanges]);

  // ── Calendar tab: save override for selected date ──
  const handleCalSaveOverride = useCallback(async () => {
    if (!selectedInstructorId || !calSelectedDate) return;
    // Validate ranges
    for (let i = 0; i < calRanges.length; i++) {
      if (calRanges[i].endMinutes <= calRanges[i].startMinutes) {
        setError(`Fascia ${i + 1}: orario non valido`);
        return;
      }
    }
    setCalSaving(true);
    try {
      await regloApi.setDailyAvailabilityOverride({
        ownerType: 'instructor',
        ownerId: selectedInstructorId,
        date: calSelectedDate,
        ranges: calRanges,
      });
      // Refresh overrides
      try {
        const res = await regloApi.getDailyAvailabilityOverrides({
          ownerType: 'instructor',
          ownerId: selectedInstructorId,
        });
        setOverrides(res ?? []);
      } catch { /* ignore */ }
      setSuccessMsg('Override salvato');
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore salvando override');
    } finally {
      setCalSaving(false);
    }
  }, [selectedInstructorId, calSelectedDate, calRanges]);

  // ── Calendar tab: reset override for selected date ──
  const handleCalResetOverride = useCallback(async () => {
    if (!selectedInstructorId || !calSelectedDate) return;
    setCalSaving(true);
    try {
      await regloApi.deleteDailyAvailabilityOverride({
        ownerType: 'instructor',
        ownerId: selectedInstructorId,
        date: calSelectedDate,
      });
      setOverrides((prev) => prev.filter((o) => (typeof o.date === 'string' ? o.date.slice(0, 10) : '') !== calSelectedDate));
      // Reset to default
      setCalRanges(defaultRanges.map((r) => ({ ...r })));
      setSuccessMsg('Override rimosso');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore rimuovendo override');
    } finally {
      setCalSaving(false);
    }
  }, [selectedInstructorId, calSelectedDate, defaultRanges]);

  // ── Computed: set of dates with overrides (for calendar dots) ──
  const overrideDates = useMemo(
    () => new Set(overrides.map((o) => typeof o.date === 'string' ? o.date.slice(0, 10) : '')),
    [overrides],
  );

  // ── Calendar tab: format selected date label ──
  const calDateLabel = useMemo(() => {
    if (!calSelectedDate) return '';
    const [y, m, d] = calSelectedDate.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return `${ITALIAN_DAYS[date.getDay()]} ${d} ${ITALIAN_MONTHS_SHORT[m - 1]}`;
  }, [calSelectedDate]);

  const hasCalOverride = calSelectedDate != null && overrideDates.has(calSelectedDate);

  // ── Default tab: save availability ──
  const handleSaveAvailability = useCallback(async () => {
    if (!selectedInstructorId) return;

    if (!availDays.length) {
      setError('Seleziona almeno un giorno');
      return;
    }
    if (!defaultRanges.length) {
      setError('Aggiungi almeno una fascia oraria');
      return;
    }
    // Validate ranges
    for (let i = 0; i < defaultRanges.length; i++) {
      if (defaultRanges[i].endMinutes <= defaultRanges[i].startMinutes) {
        setError(`Fascia ${i + 1}: orario non valido`);
        return;
      }
    }

    setAvailSaving(true);
    try {
      const anchor = new Date();
      anchor.setHours(0, 0, 0, 0);
      const resetStart = new Date(anchor);
      resetStart.setHours(0, 0, 0, 0);
      const resetEnd = new Date(anchor);
      resetEnd.setHours(23, 59, 0, 0);

      // Delete existing slots
      try {
        await regloApi.deleteAvailabilitySlots({
          ownerType: 'instructor',
          ownerId: selectedInstructorId,
          startsAt: resetStart.toISOString(),
          endsAt: resetEnd.toISOString(),
          daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
          weeks: settings?.availabilityWeeks ?? 4,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (!/nessuno slot/i.test(message)) throw err;
      }

      // Build primary range (first) + optional second range
      const primary = defaultRanges[0];
      const startDate = new Date(anchor);
      startDate.setHours(Math.floor(primary.startMinutes / 60), primary.startMinutes % 60, 0, 0);
      const endDate = new Date(anchor);
      endDate.setHours(Math.floor(primary.endMinutes / 60), primary.endMinutes % 60, 0, 0);

      const secondRange: { startsAt2?: string; endsAt2?: string } = {};
      if (defaultRanges.length >= 2) {
        const r2 = defaultRanges[1];
        const s2 = new Date(anchor);
        s2.setHours(Math.floor(r2.startMinutes / 60), r2.startMinutes % 60, 0, 0);
        const e2 = new Date(anchor);
        e2.setHours(Math.floor(r2.endMinutes / 60), r2.endMinutes % 60, 0, 0);
        secondRange.startsAt2 = s2.toISOString();
        secondRange.endsAt2 = e2.toISOString();
      }

      await regloApi.createAvailabilitySlots({
        ownerType: 'instructor',
        ownerId: selectedInstructorId,
        startsAt: startDate.toISOString(),
        endsAt: endDate.toISOString(),
        ...secondRange,
        daysOfWeek: availDays,
        weeks: settings?.availabilityWeeks ?? 4,
        ranges: defaultRanges,
      });

      setError(null);
      setAvailDrawerOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore salvando disponibilità');
    } finally {
      setAvailSaving(false);
    }
  }, [selectedInstructorId, availDays, defaultRanges, settings]);

  // ─── Invite Logic ──────────────────────────────────────────

  const handleSendInvite = useCallback(async () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      setError('Inserisci un indirizzo email valido');
      return;
    }
    setInviteSending(true);
    try {
      await regloApi.createInvite({ email, autoscuolaRole: 'INSTRUCTOR' });
      setInviteDrawerOpen(false);
      setInviteEmail('');
      setSuccessMsg('Invito inviato!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore nell\'invio dell\'invito');
    } finally {
      setInviteSending(false);
    }
  }, [inviteEmail]);

  // ─── Render ───────────────────────────────────────────────

  return (
    <Screen>
      <StatusBar style="dark" />
      <ToastNotice message={error} tone="danger" onHide={() => setError(null)} />
      <ToastNotice message={successMsg} tone="success" onHide={() => setSuccessMsg(null)} />

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
        {/* ── Header ─────────────────────────────── */}
        <View style={styles.header}>
          <Text style={styles.title}>I tuoi istruttori</Text>
          <Text style={styles.subtitle}>
            {initialLoading
              ? '...'
              : `${instructors.length} istruttori \u2022 ${busyCount} in guida`}
          </Text>
        </View>

        {/* ── Live Status Circle Row ─────────────── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.circleRow}
        >
          {initialLoading
            ? Array.from({ length: 4 }).map((_, i) => (
                <View key={`skel-circle-${i}`} style={styles.circleItem}>
                  <SkeletonBlock width={68} height={68} radius={34} />
                  <SkeletonBlock width={48} height={10} radius={5} style={{ marginTop: 6 }} />
                </View>
              ))
            : instructors.map((instructor) => {
                const status = getInstructorStatus(instructor, appointments, now);
                const ringColor = statusColor(status);
                const isSelected = selectedInstructorId === instructor.id;
                const firstName = instructor.name.split(/\s+/)[0];

                return (
                  <Pressable
                    key={instructor.id}
                    style={styles.circleItem}
                    onPress={() => setSelectedInstructorId(instructor.id)}
                  >
                    <View
                      style={[
                        styles.circleOuter,
                        { backgroundColor: ringColor },
                        isSelected && styles.circleSelected,
                        isSelected && { shadowColor: ringColor },
                      ]}
                    >
                      <View style={styles.circleWhiteRing}>
                        <View style={styles.circleInner}>
                          <Text style={styles.circleInitials}>
                            {getInitials(instructor.name)}
                          </Text>
                        </View>
                      </View>
                      {/* Status dot */}
                      <View
                        style={[
                          styles.statusDot,
                          { backgroundColor: ringColor },
                        ]}
                      />
                    </View>
                    <Text style={styles.circleName} numberOfLines={1}>
                      {firstName}
                    </Text>
                  </Pressable>
                );
              })}
        </ScrollView>

        {/* ── Selected Instructor Detail Card ────── */}
        {initialLoading ? (
          <View style={styles.detailCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <SkeletonBlock width={52} height={52} radius={26} />
              <View style={{ flex: 1, gap: 8 }}>
                <SkeletonBlock width="60%" height={18} />
                <SkeletonBlock width="40%" height={13} />
              </View>
            </View>
            <View style={styles.divider} />
            <SkeletonBlock width="30%" height={12} />
            <SkeletonBlock width="100%" height={36} />
            <View style={styles.divider} />
            <SkeletonBlock width="25%" height={12} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <SkeletonBlock width="30%" height={32} radius={999} />
              <SkeletonBlock width="30%" height={32} radius={999} />
              <SkeletonBlock width="30%" height={32} radius={999} />
            </View>
          </View>
        ) : selectedInstructor ? (
          <View style={styles.detailCard}>
            {/* Top row */}
            <View style={styles.detailTop}>
              <View style={styles.detailAvatarSmall}>
                <Text style={styles.detailAvatarInitials}>
                  {getInitials(selectedInstructor.name)}
                </Text>
              </View>
              <View style={styles.detailInfo}>
                <Text style={styles.detailName}>{selectedInstructor.name}</Text>
                <Text style={styles.detailMeta}>
                  {selectedInstructor.phone ?? 'Nessun contatto'}
                </Text>
              </View>
              <View
                style={[
                  styles.statusPill,
                  { backgroundColor: statusColor(selectedStatus) + '18' },
                ]}
              >
                <View
                  style={[
                    styles.statusPillDot,
                    { backgroundColor: statusColor(selectedStatus) },
                  ]}
                />
                <Text
                  style={[
                    styles.statusPillText,
                    { color: statusColor(selectedStatus) },
                  ]}
                >
                  {statusLabel(selectedStatus)}
                </Text>
              </View>
            </View>

            {/* Divider */}
            <View style={styles.divider} />

            {/* Oggi */}
            <View>
              <Text style={styles.sectionLabel}>OGGI</Text>
              <View style={styles.statsRow}>
                <View style={[styles.statBadge, { backgroundColor: '#FEF9C3' }]}>
                  <Text style={[styles.statBadgeText, { color: '#CA8A04' }]}>
                    {todayStats.total} lezioni
                  </Text>
                </View>
                <View style={[styles.statBadge, { backgroundColor: '#DCFCE7' }]}>
                  <Text style={[styles.statBadgeText, { color: '#16A34A' }]}>
                    {todayStats.completed} completate
                  </Text>
                </View>
                <View style={[styles.statBadge, { backgroundColor: '#F1F5F9' }]}>
                  <Text style={[styles.statBadgeText, { color: '#64748B' }]}>
                    {todayStats.upcoming} prossime
                  </Text>
                </View>
              </View>
            </View>

            {/* Divider */}
            <View style={styles.divider} />

            {/* Action buttons */}
            <View style={styles.actionRow}>
              <Pressable
                style={styles.btnOutline}
                onPress={openAvailDrawer}
              >
                <Text style={styles.btnOutlineText}>Modifica disponibilità</Text>
              </Pressable>
              <Pressable
                style={styles.btnPrimary}
                onPress={() => router.navigate('/(tabs)/home')}
              >
                <Text style={styles.btnPrimaryText}>Vedi agenda</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.detailCard}>
            <View style={styles.placeholderContainer}>
              <Ionicons name="arrow-up" size={28} color="#94A3B8" />
              <Text style={styles.placeholderText}>Seleziona un istruttore</Text>
            </View>
          </View>
        )}

        {/* ── Invite CTA ─────────────────────────── */}
        <Pressable
          style={styles.inviteBtn}
          onPress={() => {
            setInviteEmail('');
            setInviteDrawerOpen(true);
          }}
        >
          <Ionicons name="person-add-outline" size={18} color="#CA8A04" />
          <Text style={styles.inviteBtnText}>+ Invita nuovo istruttore</Text>
        </Pressable>
      </ScrollView>

      {/* ── Invite Instructor BottomSheet ─────────── */}
      <BottomSheet
        visible={inviteDrawerOpen}
        title="Invita istruttore"
        onClose={() => { if (!inviteSending) setInviteDrawerOpen(false); }}
        closeDisabled={inviteSending}
        showHandle
        footer={
          <View style={styles.sheetFooter}>
            <Button
              label={inviteSending ? 'Invio in corso...' : 'Invia invito'}
              tone="primary"
              onPress={inviteSending ? undefined : handleSendInvite}
              disabled={inviteSending}
              fullWidth
            />
          </View>
        }
      >
        <View style={styles.sheetContent}>
          <Text style={styles.inviteDescription}>
            Inserisci l'email dell'istruttore. Riceverà un invito per scaricare l'app e unirsi alla tua autoscuola.
          </Text>
          <Input
            placeholder="Email istruttore"
            value={inviteEmail}
            onChangeText={setInviteEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      </BottomSheet>

      {/* ── Availability Editor BottomSheet ──────── */}
      <BottomSheet
        visible={availDrawerOpen}
        title={selectedInstructor ? `Disponibilità di ${selectedInstructor.name.split(/\s+/)[0]}` : 'Disponibilità'}
        onClose={closeAvailDrawer}
        closeDisabled={availSaving || calSaving}
        showHandle
        footer={
          activeTab === 'default' ? (
            <View style={styles.sheetFooter}>
              <Button
                label={availSaving ? 'Salvataggio...' : 'Salva disponibilità'}
                tone="primary"
                onPress={availSaving ? undefined : handleSaveAvailability}
                disabled={availSaving}
                fullWidth
              />
            </View>
          ) : undefined
        }
      >
        <View style={styles.sheetContent}>
          {availLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.loadingText}>Caricamento disponibilità...</Text>
            </View>
          ) : (
            <>
              {/* ── Tab chips ── */}
              <View style={styles.tabChipRow}>
                <Pressable
                  onPress={() => handleSwitchTab('default')}
                  style={[
                    styles.tabChip,
                    activeTab === 'default' && styles.tabChipActive,
                  ]}
                >
                  <Text style={[styles.tabChipText, activeTab === 'default' && styles.tabChipTextActive]}>
                    Predefinito
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => handleSwitchTab('calendar')}
                  style={[
                    styles.tabChip,
                    activeTab === 'calendar' && styles.tabChipActive,
                  ]}
                >
                  <Text style={[styles.tabChipText, activeTab === 'calendar' && styles.tabChipTextActive]}>
                    Calendario
                  </Text>
                </Pressable>
              </View>

              {/* ── Tab 1: Predefinito ── */}
              {activeTab === 'default' && (
                <>
                  <View style={styles.dayCircleRow}>
                    {dayLetters.map((letter, index) => (
                      <Pressable
                        key={`day-${index}`}
                        onPress={() => toggleAvailDay(index)}
                        style={[
                          styles.dayCircle,
                          availDays.includes(index) ? styles.dayCircleActive : styles.dayCircleInactive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.dayCircleText,
                            availDays.includes(index) ? styles.dayCircleTextActive : styles.dayCircleTextInactive,
                          ]}
                        >
                          {letter}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <RangesEditor
                    ranges={defaultRanges}
                    onChange={setDefaultRanges}
                    onAddRange={() => {
                      setDefaultRanges((prev) => [...prev, { startMinutes: 540, endMinutes: 1080 }]);
                    }}
                    disabled={availSaving}
                  />
                </>
              )}

              {/* ── Tab 2: Calendario ── */}
              {activeTab === 'calendar' && (
                <>
                  <MiniCalendar
                    selectedDate={calSelectedDate}
                    onSelectDate={handleCalSelectDate}
                    markedDates={overrideDates}
                  />
                  {calSelectedDate && (
                    <Animated.View entering={FadeIn.duration(250)} style={styles.calDayDetail}>
                      <Text style={styles.calDayLabel}>{calDateLabel}</Text>
                      {hasCalOverride && (
                        <View style={styles.calOverrideBadge}>
                          <Text style={styles.calOverrideBadgeText}>Override attivo</Text>
                        </View>
                      )}
                      <RangesEditor
                        ranges={calRanges}
                        onChange={setCalRanges}
                        onAddRange={() => {
                          setCalRanges((prev) => [...prev, { startMinutes: 540, endMinutes: 1080 }]);
                        }}
                        disabled={calSaving}
                      />
                      <View style={styles.calActionRow}>
                        <Pressable
                          style={[styles.calBtn, styles.calBtnPrimary]}
                          onPress={calSaving ? undefined : handleCalSaveOverride}
                          disabled={calSaving}
                        >
                          {calSaving ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <Text style={styles.calBtnPrimaryText}>Salva</Text>
                          )}
                        </Pressable>
                        {hasCalOverride && (
                          <Pressable
                            style={[styles.calBtn, styles.calBtnOutline]}
                            onPress={calSaving ? undefined : handleCalResetOverride}
                            disabled={calSaving}
                          >
                            <Text style={styles.calBtnOutlineText}>Ripristina predefinito</Text>
                          </Pressable>
                        )}
                      </View>
                    </Animated.View>
                  )}
                </>
              )}
            </>
          )}
        </View>
      </BottomSheet>

      {/* ── Unified Time Picker Drawer ───────────────── */}
      <TimePickerDrawer
        visible={timePickerContext !== null}
        selectedTime={(() => {
          if (!timePickerContext) return buildTime(9, 0);
          const ranges = timePickerContext.tab === 'default' ? defaultRanges : calRanges;
          const range = ranges[timePickerContext.rangeIndex];
          if (!range) return buildTime(9, 0);
          const mins = timePickerContext.field === 'start' ? range.startMinutes : range.endMinutes;
          return buildTime(Math.floor(mins / 60), mins % 60);
        })()}
        onSelectTime={(date) => {
          if (!timePickerContext) return;
          const minutes = date.getHours() * 60 + date.getMinutes();
          const { tab, rangeIndex, field } = timePickerContext;
          const key = field === 'start' ? 'startMinutes' : 'endMinutes';
          if (tab === 'default') {
            setDefaultRanges((prev) =>
              prev.map((r, i) => (i === rangeIndex ? { ...r, [key]: minutes } : r)),
            );
          } else {
            setCalRanges((prev) =>
              prev.map((r, i) => (i === rangeIndex ? { ...r, [key]: minutes } : r)),
            );
          }
        }}
        onClose={() => {
          setTimePickerContext(null);
          setTimeout(() => setAvailDrawerOpen(true), 350);
        }}
      />
    </Screen>
  );
};

// ─── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.xxl * 2 + spacing.md,
  },

  // Header
  header: {
    gap: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1E293B',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748B',
  },

  // Circle row
  circleRow: {
    paddingHorizontal: 6,
    paddingVertical: 10,
    gap: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  circleItem: {
    alignItems: 'center',
    width: 70,
  },
  circleOuter: {
    width: 66,
    height: 66,
    borderRadius: 33,
    padding: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleSelected: {
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
  circleWhiteRing: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
    padding: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleInner: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#FCE7F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleInitials: {
    fontSize: 20,
    fontWeight: '700',
    color: '#EC4899',
  },
  statusDot: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  circleName: {
    fontSize: 12,
    fontWeight: '500',
    color: '#1E293B',
    textAlign: 'center',
    width: 70,
    marginTop: 6,
  },

  // Detail card
  detailCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    gap: 0,
  },
  detailTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  detailAvatarSmall: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FCE7F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailAvatarInitials: {
    fontSize: 18,
    fontWeight: '700',
    color: '#EC4899',
  },
  detailInfo: {
    flex: 1,
    gap: 2,
  },
  detailName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  detailMeta: {
    fontSize: 13,
    fontWeight: '500',
    color: '#94A3B8',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statusPillDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusPillText: {
    fontSize: 13,
    fontWeight: '600',
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 16,
  },

  // Section label
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 12,
  },

  // Day circles

  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  statBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statBadgeText: {
    fontSize: 13,
    fontWeight: '700',
  },

  // Action buttons
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  btnOutline: {
    flex: 1,
    height: 48,
    borderRadius: radii.sm,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnOutlineText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
    textAlign: 'center',
  },
  btnPrimary: {
    flex: 1,
    height: 48,
    borderRadius: radii.sm,
    backgroundColor: '#EC4899',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Placeholder
  placeholderContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 10,
  },
  placeholderText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#94A3B8',
  },

  // BottomSheet content
  sheetContent: {
    gap: spacing.sm,
  },
  sheetFooter: {
    width: '100%',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748B',
  },

  // Tab chips
  tabChipRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  tabChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radii.sm,
    backgroundColor: '#F1F5F9',
  },
  tabChipActive: {
    backgroundColor: '#FACC15',
  },
  tabChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  tabChipTextActive: {
    color: '#FFFFFF',
  },

  // Day circles
  dayCircleRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  dayCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleActive: {
    backgroundColor: '#FACC15',
  },
  dayCircleInactive: {
    backgroundColor: '#F1F5F9',
  },
  dayCircleText: {
    fontSize: 13,
    fontWeight: '700',
  },
  dayCircleTextActive: {
    color: '#FFFFFF',
  },
  dayCircleTextInactive: {
    color: '#64748B',
  },

  // Calendar day detail accordion
  calDayDetail: {
    gap: spacing.sm,
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: spacing.sm,
  },
  calDayLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  calOverrideBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FEF9C3',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  calOverrideBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#CA8A04',
  },
  calActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  calBtn: {
    flex: 1,
    height: 44,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calBtnPrimary: {
    backgroundColor: '#EC4899',
  },
  calBtnPrimaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  calBtnOutline: {
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  calBtnOutlineText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
  },

  // Invite description
  inviteDescription: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748B',
    lineHeight: 20,
  },

  // Invite button
  inviteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: radii.sm,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#FACC15',
  },
  inviteBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#CA8A04',
  },
});
