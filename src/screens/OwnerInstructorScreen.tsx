import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
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
import { regloApi } from '../services/regloApi';
import {
  AutoscuolaAppointmentWithRelations,
  AutoscuolaInstructor,
  AutoscuolaSettings,
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

const toTimeString = (value: Date) => value.toTimeString().slice(0, 5);

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
  const [morningActive, setMorningActive] = useState(true);
  const [afternoonActive, setAfternoonActive] = useState(false);
  const [morningStart, setMorningStart] = useState(buildTime(8, 0));
  const [morningEnd, setMorningEnd] = useState(buildTime(12, 0));
  const [afternoonStart, setAfternoonStart] = useState(buildTime(14, 0));
  const [afternoonEnd, setAfternoonEnd] = useState(buildTime(18, 0));
  const [availLoading, setAvailLoading] = useState(false);
  const [availSaving, setAvailSaving] = useState(false);
  const [timePickerTarget, setTimePickerTarget] = useState<
    'morningStart' | 'morningEnd' | 'afternoonStart' | 'afternoonEnd' | null
  >(null);

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

      const ranges: Array<{ dayIndex: number; startMin: number; endMin: number }> = [];
      responses.forEach((response, index) => {
        if (!response || response.length === 0) return;
        const usable = response
          .filter((s) => s.status !== 'cancelled')
          .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
        if (!usable.length) return;
        const first = new Date(usable[0].startsAt);
        const last = new Date(usable[usable.length - 1].endsAt);
        ranges.push({
          dayIndex: dates[index].getDay(),
          startMin: first.getHours() * 60 + first.getMinutes(),
          endMin: last.getHours() * 60 + last.getMinutes(),
        });
      });

      if (ranges.length) {
        const daySet = Array.from(new Set(ranges.map((r) => r.dayIndex))).sort();
        const minStart = Math.min(...ranges.map((r) => r.startMin));
        const maxEnd = Math.max(...ranges.map((r) => r.endMin));
        setAvailDays(daySet);

        // Detect if there's a gap (>= 60 min break) suggesting two ranges
        // For now, use the full range as morning; check if the weekly availability
        // has startMinutes2/endMinutes2 by looking at the slot pattern
        const midpoint = 12 * 60; // noon
        if (minStart < midpoint && maxEnd > midpoint + 60) {
          // Likely a full-day range, present as single morning
          setMorningActive(true);
          setAfternoonActive(false);
          setMorningStart(buildTime(Math.floor(minStart / 60), minStart % 60));
          setMorningEnd(buildTime(Math.floor(maxEnd / 60), maxEnd % 60));
        } else {
          setMorningActive(true);
          setAfternoonActive(false);
          setMorningStart(buildTime(Math.floor(minStart / 60), minStart % 60));
          setMorningEnd(buildTime(Math.floor(maxEnd / 60), maxEnd % 60));
        }
      } else {
        setAvailDays([]);
        setMorningActive(true);
        setAfternoonActive(false);
        setMorningStart(buildTime(8, 0));
        setMorningEnd(buildTime(12, 0));
        setAfternoonStart(buildTime(14, 0));
        setAfternoonEnd(buildTime(18, 0));
      }
    } catch {
      setError('Errore caricando disponibilità istruttore');
    } finally {
      setAvailLoading(false);
    }
  }, []);

  const openAvailDrawer = useCallback(async () => {
    if (!selectedInstructorId) return;
    setAvailDrawerOpen(true);
    await loadInstructorAvailability(selectedInstructorId);
  }, [selectedInstructorId, loadInstructorAvailability]);

  const closeAvailDrawer = useCallback(() => {
    if (availSaving) return;
    setAvailDrawerOpen(false);
  }, [availSaving]);

  const toggleAvailDay = (day: number) => {
    setAvailDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort(),
    );
  };

  const handleSaveAvailability = useCallback(async () => {
    if (!selectedInstructorId) return;
    if (!availDays.length) {
      setError('Seleziona almeno un giorno');
      return;
    }
    if (!morningActive && !afternoonActive) {
      setError('Attiva almeno una fascia oraria');
      return;
    }

    // Determine primary and secondary ranges
    const primaryStart = morningActive ? morningStart : afternoonStart;
    const primaryEnd = morningActive ? morningEnd : afternoonEnd;
    if (primaryEnd <= primaryStart) {
      setError('Orario non valido');
      return;
    }
    const hasSecondRange = morningActive && afternoonActive;
    if (hasSecondRange && afternoonEnd <= afternoonStart) {
      setError('Orario pomeriggio non valido');
      return;
    }

    setAvailSaving(true);
    try {
      const anchor = new Date();
      anchor.setHours(0, 0, 0, 0);
      const start = new Date(anchor);
      start.setHours(primaryStart.getHours(), primaryStart.getMinutes(), 0, 0);
      const end = new Date(anchor);
      end.setHours(primaryEnd.getHours(), primaryEnd.getMinutes(), 0, 0);
      const resetStart = new Date(anchor);
      resetStart.setHours(0, 0, 0, 0);
      const resetEnd = new Date(anchor);
      resetEnd.setHours(23, 59, 0, 0);

      // Build optional second range
      const secondRange: { startsAt2?: string; endsAt2?: string } = {};
      if (hasSecondRange) {
        const s2 = new Date(anchor);
        s2.setHours(afternoonStart.getHours(), afternoonStart.getMinutes(), 0, 0);
        const e2 = new Date(anchor);
        e2.setHours(afternoonEnd.getHours(), afternoonEnd.getMinutes(), 0, 0);
        secondRange.startsAt2 = s2.toISOString();
        secondRange.endsAt2 = e2.toISOString();
      }

      // Clear existing slots
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

      // Create new slots
      await regloApi.createAvailabilitySlots({
        ownerType: 'instructor',
        ownerId: selectedInstructorId,
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
        ...secondRange,
        daysOfWeek: availDays,
        weeks: settings?.availabilityWeeks ?? 4,
      });

      setError(null);
      setAvailDrawerOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore salvando disponibilità');
    } finally {
      setAvailSaving(false);
    }
  }, [selectedInstructorId, availDays, morningActive, afternoonActive, morningStart, morningEnd, afternoonStart, afternoonEnd, settings]);

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
        closeDisabled={availSaving}
        showHandle
        footer={
          <View style={styles.sheetFooter}>
            <Button
              label={availSaving ? 'Salvataggio...' : 'Salva disponibilità'}
              tone="primary"
              onPress={availSaving ? undefined : handleSaveAvailability}
              disabled={availSaving}
              fullWidth
            />
          </View>
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
              {/* Day circles */}
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

              {/* ── Mattina ─────────────────────── */}
              <Pressable onPress={() => setMorningActive((v) => !v)} style={styles.slotToggleRow}>
                <Text style={[styles.slotToggleLabel, morningActive && styles.slotToggleLabelActive]}>
                  Mattina
                </Text>
                <View style={[styles.slotToggleDot, morningActive && styles.slotToggleDotActive]} />
              </Pressable>
              {morningActive && (
                <View style={styles.timeCardsRow}>
                  <Pressable
                    onPress={() => {
                      setAvailDrawerOpen(false);
                      setTimeout(() => setTimePickerTarget('morningStart'), 350);
                    }}
                    style={({ pressed }) => [styles.timeCard, pressed && { opacity: 0.85 }]}
                  >
                    <Text style={styles.timeCardLabel}>Inizio</Text>
                    <View style={styles.timeCardRow}>
                      <Ionicons name="time-outline" size={16} color="#EC4899" />
                      <Text style={styles.timeCardValue}>{toTimeString(morningStart)}</Text>
                    </View>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setAvailDrawerOpen(false);
                      setTimeout(() => setTimePickerTarget('morningEnd'), 350);
                    }}
                    style={({ pressed }) => [styles.timeCard, pressed && { opacity: 0.85 }]}
                  >
                    <Text style={styles.timeCardLabel}>Fine</Text>
                    <View style={styles.timeCardRow}>
                      <Ionicons name="time-outline" size={16} color="#EC4899" />
                      <Text style={styles.timeCardValue}>{toTimeString(morningEnd)}</Text>
                    </View>
                  </Pressable>
                </View>
              )}

              {/* ── Pomeriggio ──────────────────── */}
              <Pressable onPress={() => setAfternoonActive((v) => !v)} style={styles.slotToggleRow}>
                <Text style={[styles.slotToggleLabel, afternoonActive && styles.slotToggleLabelActive]}>
                  Pomeriggio
                </Text>
                <View style={[styles.slotToggleDot, afternoonActive && styles.slotToggleDotActive]} />
              </Pressable>
              {afternoonActive && (
                <View style={styles.timeCardsRow}>
                  <Pressable
                    onPress={() => {
                      setAvailDrawerOpen(false);
                      setTimeout(() => setTimePickerTarget('afternoonStart'), 350);
                    }}
                    style={({ pressed }) => [styles.timeCard, pressed && { opacity: 0.85 }]}
                  >
                    <Text style={styles.timeCardLabel}>Inizio</Text>
                    <View style={styles.timeCardRow}>
                      <Ionicons name="time-outline" size={16} color="#EC4899" />
                      <Text style={styles.timeCardValue}>{toTimeString(afternoonStart)}</Text>
                    </View>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setAvailDrawerOpen(false);
                      setTimeout(() => setTimePickerTarget('afternoonEnd'), 350);
                    }}
                    style={({ pressed }) => [styles.timeCard, pressed && { opacity: 0.85 }]}
                  >
                    <Text style={styles.timeCardLabel}>Fine</Text>
                    <View style={styles.timeCardRow}>
                      <Ionicons name="time-outline" size={16} color="#EC4899" />
                      <Text style={styles.timeCardValue}>{toTimeString(afternoonEnd)}</Text>
                    </View>
                  </Pressable>
                </View>
              )}
            </>
          )}
        </View>
      </BottomSheet>

      {/* ── Time Picker Drawer ───────────────────── */}
      <TimePickerDrawer
        visible={timePickerTarget !== null}
        selectedTime={
          timePickerTarget === 'morningStart' ? morningStart
            : timePickerTarget === 'morningEnd' ? morningEnd
            : timePickerTarget === 'afternoonStart' ? afternoonStart
            : afternoonEnd
        }
        onSelectTime={(date) => {
          if (timePickerTarget === 'morningStart') setMorningStart(date);
          else if (timePickerTarget === 'morningEnd') setMorningEnd(date);
          else if (timePickerTarget === 'afternoonStart') setAfternoonStart(date);
          else if (timePickerTarget === 'afternoonEnd') setAfternoonEnd(date);
        }}
        onClose={() => {
          setTimePickerTarget(null);
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

  // Slot toggle rows (Mattina / Pomeriggio)
  slotToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 4,
    marginTop: 4,
  },
  slotToggleLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#94A3B8',
  },
  slotToggleLabelActive: {
    color: '#1E293B',
  },
  slotToggleDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#E2E8F0',
  },
  slotToggleDotActive: {
    backgroundColor: '#22C55E',
  },

  // Time cards
  timeCardsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  timeCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    gap: 4,
  },
  timeCardLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
  },
  timeCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeCardValue: {
    fontSize: 15,
    fontWeight: '700',
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
