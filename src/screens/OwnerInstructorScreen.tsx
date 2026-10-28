import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter, useSegments } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ClayLargeTitleScroll } from '../components/ClayLargeTitle';
import { SkeletonBlock } from '../components/Skeleton';
import { ToastNotice } from '../components/ToastNotice';
import {
  Avatar,
  ClayButton,
  ClayEmpty,
  ClayIconButton,
  ClayList,
  ClayListRow,
  ClaySearchField,
  ClaySection,
  ClayStat,
  ClaySurface,
} from '../components/clay';
import { regloApi } from '../services/regloApi';
import { ownerInstructorSheetStore } from '../stores/ownerInstructorSheetStore';
import {
  AutoscuolaAppointmentWithRelations,
  AutoscuolaInstructor,
  AutoscuolaSettings,
} from '../types/regloApi';
import { CLAY } from '../theme/clay';
import { MORALE_ART } from '../theme/moraleArt';

// ─── Helpers ──────────────────────────────────────────────────

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

/** La ricerca compare solo quando la lista è lunga. */
const SEARCH_THRESHOLD = 5;

// ─── Component ────────────────────────────────────────────────

export const OwnerInstructorScreen = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // La schermata vive in due stack: role/ (tab Istruttore del titolare) e
  // more/ (INSTRUCTOR_OWNER, spinta da «Tu» → con indietro). I fogli sono
  // registrati in entrambi: si apre quello dello stack corrente.
  const segments = useSegments();
  const stack = (segments as string[]).includes('more') ? 'more' : 'role';
  const pushed = stack === 'more';
  const scrollRef = useRef<ScrollView | null>(null);

  const [instructors, setInstructors] = useState<AutoscuolaInstructor[]>([]);
  const [selectedInstructorId, setSelectedInstructorId] = useState<string | null>(null);
  const [appointments, setAppointments] = useState<AutoscuolaAppointmentWithRelations[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [settings, setSettings] = useState<AutoscuolaSettings | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

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

  const todayLessonCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const a of appointments) {
      if (a.instructorId && a.status !== 'cancelled' && isToday(a.startsAt)) {
        counts[a.instructorId] = (counts[a.instructorId] ?? 0) + 1;
      }
    }
    return counts;
  }, [appointments]);

  // REG-639 «vita»: la giornata dell'autoscuola in un numero (tutti gli istruttori).
  const schoolToday = useMemo(() => {
    const today = appointments
      .filter((a) => a.status !== 'cancelled' && isToday(a.startsAt))
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
    if (!today.length) return { count: 0, line: 'Giornata libera in autoscuola' };
    const hhmm = (iso: string) => {
      const d = new Date(iso);
      return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
    };
    const last = today[today.length - 1];
    return {
      count: today.length,
      line:
        today.length === 1
          ? `oggi · alle ${hhmm(today[0].startsAt)}`
          : `oggi · la prima alle ${hhmm(today[0].startsAt)}, l’ultima alle ${hhmm(last.startsAt)}`,
    };
  }, [appointments]);

  const filteredInstructors = useMemo(() => {
    if (!searchQuery.trim()) return instructors;
    const q = searchQuery.toLowerCase().trim();
    return instructors.filter((i) => i.name.toLowerCase().includes(q));
  }, [instructors, searchQuery]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const selectedStatus: InstructorStatus = selectedInstructor
    ? getInstructorStatus(selectedInstructor, appointments, now)
    : 'offline';

  // ─── Fogli (route FORM_SHEET dello stack corrente) ────────

  const openAvailSheet = useCallback(() => {
    if (!selectedInstructor) return;
    ownerInstructorSheetStore.setAvailability({
      instructorId: selectedInstructor.id,
      instructorName: selectedInstructor.name,
      availabilityWeeks: settings?.availabilityWeeks ?? 4,
    });
    router.push(`/(tabs)/${stack}/instructor-availability` as never);
  }, [selectedInstructor, settings, router, stack]);

  const openInviteSheet = useCallback(() => {
    ownerInstructorSheetStore.setInvite({ onSent: () => setSuccessMsg('Invito inviato!') });
    router.push(`/(tabs)/${stack}/instructor-invite` as never);
  }, [router, stack]);

  const selectInstructor = useCallback((id: string) => {
    setSelectedInstructorId(id);
    // Il riepilogo dell'istruttore scelto sta in cima: lo riporto in vista.
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, []);

  // ─── Render ───────────────────────────────────────────────

  const lessonsLabel = (n: number) => `${n} ${n === 1 ? 'guida' : 'guide'} oggi`;

  return (
    <View style={s.root}>
      <StatusBar style="dark" />
      <ToastNotice message={error} tone="danger" onHide={() => setError(null)} />
      <ToastNotice message={successMsg} tone="success" onHide={() => setSuccessMsg(null)} />

      <ClayLargeTitleScroll
        ref={scrollRef as never}
        title="I tuoi istruttori"
        subtitle={
          initialLoading
            ? ' '
            : `${instructors.length} ${instructors.length === 1 ? 'istruttore' : 'istruttori'} · ${busyCount} in guida`
        }
        onBack={pushed ? () => router.back() : undefined}
        actions={
          <ClayIconButton
            icon="add"
            onPress={openInviteSheet}
            accessibilityLabel="Invita istruttore"
            testID="owner-instructors-invite"
          />
        }
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={CLAY.ink}
            colors={[CLAY.ink]}
          />
        }
      >
        {initialLoading ? (
          <ClayList style={s.firstBlock}>
            {Array.from({ length: 3 }).map((_, i) => (
              <View key={`skel-${i}`} style={s.skelRow}>
                <SkeletonBlock width={44} height={44} radius={22} />
                <View style={s.skelText}>
                  <SkeletonBlock width="55%" height={15} />
                  <SkeletonBlock width="35%" height={12} />
                </View>
              </View>
            ))}
          </ClayList>
        ) : instructors.length === 0 ? (
          <ClayEmpty
            icon={MORALE_ART.piantina}
            title="Nessun istruttore"
            text="Invita il primo istruttore della tua autoscuola."
            action={<ClayButton title="Invita istruttore" onPress={openInviteSheet} />}
          />
        ) : (
          <>
            {schoolToday ? (
              <ClaySurface radius={26} style={s.dayCard} testID="owner-instructors-day">
                <Image source={PERSONE_ART} style={s.dayArt} />
                <View style={s.dayMain}>
                  <Text style={s.dayNum}>
                    {schoolToday.count === 0
                      ? 'Oggi nessuna guida'
                      : `${schoolToday.count} ${schoolToday.count === 1 ? 'guida' : 'guide'}`}
                  </Text>
                  <Text style={s.daySub} numberOfLines={2}>{schoolToday.line}</Text>
                </View>
              </ClaySurface>
            ) : null}

            {/* ── Istruttore scelto: oggi + azioni ─────── */}
            {selectedInstructor ? (
              <View style={s.firstBlock}>
                <ClayList>
                  <ClayListRow
                    leading={<Avatar userId={selectedInstructor.userId} name={selectedInstructor.name} size={48} />}
                    title={selectedInstructor.name}
                    subtitle={`${statusLabel(selectedStatus)} · ${selectedInstructor.phone ?? 'Nessun contatto'}`}
                    testID="owner-instructors-selected"
                  />
                </ClayList>
                <View style={s.stats}>
                  <ClayStat value={todayStats.total} label="guide oggi" />
                  <ClayStat value={todayStats.completed} label="completate" />
                  <ClayStat value={todayStats.upcoming} label="prossime" />
                </View>
                <View style={s.actions}>
                  <ClayButton
                    title="Vedi agenda"
                    onPress={() => router.navigate('/(tabs)/home')}
                    testID="owner-instructors-agenda"
                  />
                  <ClayButton
                    title="Modifica disponibilità"
                    variant="secondary"
                    onPress={openAvailSheet}
                    testID="owner-instructors-availability"
                  />
                </View>
              </View>
            ) : null}

            {/* ── Tutti gli istruttori ─────────────────── */}
            <ClaySection title="Istruttori">
              {instructors.length > SEARCH_THRESHOLD ? (
                <ClaySearchField
                  placeholder="Cerca istruttore"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  returnKeyType="search"
                  autoCorrect={false}
                  clearButtonMode="while-editing"
                  style={s.search}
                />
              ) : null}
              {filteredInstructors.length ? (
                <ClayList>
                  {filteredInstructors.map((instructor) => {
                    const status = getInstructorStatus(instructor, appointments, now);
                    const isSelected = selectedInstructorId === instructor.id;
                    return (
                      <ClayListRow
                        key={instructor.id}
                        leading={<Avatar userId={instructor.userId} name={instructor.name} size={44} />}
                        title={instructor.name}
                        subtitle={`${statusLabel(status)} · ${lessonsLabel(todayLessonCounts[instructor.id] ?? 0)}`}
                        onPress={() => selectInstructor(instructor.id)}
                        chevron={false}
                        trailing={isSelected ? <Ionicons name="checkmark" size={20} color={CLAY.ink} /> : null}
                        testID={`owner-instructors-row-${instructor.id}`}
                      />
                    );
                  })}
                </ClayList>
              ) : (
                <Text style={s.noResults}>Nessun istruttore trovato</Text>
              )}
            </ClaySection>
          </>
        )}
      </ClayLargeTitleScroll>
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────

const PERSONE_ART = require('../../assets/icons3d-ai/persone.png');

const s = StyleSheet.create({
  dayCard: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 20, paddingVertical: 16, paddingHorizontal: 18 },
  dayArt: { width: 58, height: 58 },
  dayMain: { flex: 1, minWidth: 0 },
  dayNum: { fontSize: 26, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.7 },
  daySub: { fontSize: 14.5, color: CLAY.ink3, marginTop: 1 },
  root: { flex: 1, backgroundColor: CLAY.bg },
  content: { paddingHorizontal: 20, paddingBottom: 120 },
  back: { marginBottom: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  titles: { flex: 1, minWidth: 0 },
  title: { fontSize: 32, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.9 },
  subtitle: { fontSize: 15, color: CLAY.ink3, marginTop: 1 },
  firstBlock: { marginTop: 22 },
  stats: { flexDirection: 'row', gap: 10, marginTop: 12 },
  actions: { gap: 10, marginTop: 16 },
  search: { marginBottom: 12 },
  noResults: { fontSize: 15, color: CLAY.ink3, paddingHorizontal: 4, paddingVertical: 8 },
  skelRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, paddingHorizontal: 18 },
  skelText: { flex: 1, gap: 8 },
});
