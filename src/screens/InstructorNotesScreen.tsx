import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { ToastNotice, ToastTone } from '../components/ToastNotice';
import { SkeletonBlock } from '../components/Skeleton';
import { ClayPageHeader } from '../components/ClayPageHeader';
import {
  Avatar,
  ClayEmpty,
  ClayIconButton,
  ClayList,
  ClayListRow,
  ClaySearchField,
  ClaySegmented,
  ClaySurface,
} from '../components/clay';
import { CLAY } from '../theme/clay';
import { VITA_ART } from '../theme/vitaArt';
import { useSession } from '../context/SessionContext';
import { regloApi } from '../services/regloApi';
import { AutoscuolaAppointmentWithRelations, AutoscuolaCase } from '../types/regloApi';
import { REQUIRED_LESSONS, isMandatoryLessonDuration } from '../utils/mandatoryLessons';

const monthsShort = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
const H_PAD = 20;
const dayMonth = (iso: string) => `${new Date(iso).getDate()} ${monthsShort[new Date(iso).getMonth()]}`;

/** Lunedì 00:00 → lunedì successivo, ora locale. */
function weekBounds(now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { start: start.getTime(), end: end.getTime() };
}

type StudentEntry = {
  id: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  assignedInstructorId?: string | null;
};

/**
 * Tab «Allievi» — REG-639 «vita ovunque» (anteprima approvata 28/10): titolo
 * con una riga umana, ricerca clay sempre visibile, «I miei / Tutti» come
 * segmentato clay (solo in modalità autonoma), l'esame più vicino in evidenza
 * con l'oggetto 3D, poi una lista sola con i volti. Il dettaglio è un form
 * sheet (`notes/[studentId]`). Niente pallini, chip né pillole.
 */
export const InstructorNotesScreen = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { instructorId } = useSession();
  const [students, setStudents] = useState<StudentEntry[]>([]);
  const [allAppointments, setAllAppointments] = useState<AutoscuolaAppointmentWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<{ text: string; tone: ToastTone } | null>(null);
  const [autonomousMode, setAutonomousMode] = useState(false);
  const [cases, setCases] = useState<AutoscuolaCase[]>([]);
  const [segment, setSegment] = useState<'mine' | 'all'>('mine');
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [bootstrap, appts, instrSettings, allCases] = await Promise.all([
        regloApi.getAgendaBootstrap({
          ...(instructorId ? { instructorId } : {}),
          from: new Date(0).toISOString(),
          to: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          limit: 1,
        }),
        regloApi.getAppointments({ limit: 500 }),
        instructorId ? regloApi.getInstructorSettings().catch(() => null) : Promise.resolve(null),
        regloApi.getCases().catch(() => [] as AutoscuolaCase[]),
      ]);
      setStudents(bootstrap.students);
      setAllAppointments(appts.filter((a) => (a.status ?? '').trim().toLowerCase() !== 'cancelled'));
      setCases(allCases);
      if (instrSettings) setAutonomousMode(instrSettings.autonomousMode);
    } catch {
      setToast({ text: 'Errore nel caricamento', tone: 'danger' });
    } finally {
      setLoading(false);
    }
  }, [instructorId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const studentInfo = useMemo(() => {
    const map = new Map<string, { total: number; completed: number }>();
    for (const appt of allAppointments) {
      const cur = map.get(appt.studentId) ?? { total: 0, completed: 0 };
      cur.total += 1;
      const st = (appt.status ?? '').trim().toLowerCase();
      // `total` conta tutte le guide; `completed` alimenta l'obbligo, quindi
      // prende SOLO le guide da 60 minuti (stesso criterio del BE).
      if ((st === 'completed' || st === 'checked_in') && isMandatoryLessonDuration(appt)) {
        cur.completed += 1;
      }
      map.set(appt.studentId, cur);
    }
    return map;
  }, [allAppointments]);

  const studentExam = useMemo(() => {
    const map = new Map<string, string>();
    const now = Date.now();
    for (const c of cases) {
      const d = c.drivingExamAt ?? c.theoryExamAt;
      if (d && new Date(d).getTime() > now && !map.has(c.studentId)) map.set(c.studentId, d);
    }
    return map;
  }, [cases]);

  const useClusters = autonomousMode && !!instructorId;
  const mineCount = useMemo(
    () => students.filter((s) => s.assignedInstructorId === instructorId).length,
    [students, instructorId],
  );
  const visibleStudents = useMemo(() => {
    if (!useClusters || segment === 'all') return students;
    return students.filter((s) => s.assignedInstructorId === instructorId);
  }, [useClusters, segment, students, instructorId]);

  const navigateToStudent = (student: StudentEntry) => {
    router.push({
      pathname: '/(tabs)/notes/[studentId]',
      params: { studentId: student.id, name: `${student.firstName} ${student.lastName}` },
    } as never);
  };

  const query = searchQuery.trim().toLowerCase();
  const shown = useMemo(
    () => (query ? students.filter((st) => `${st.firstName} ${st.lastName}`.toLowerCase().includes(query)) : visibleStudents),
    [query, students, visibleStudents],
  );

  // «3 guidano con te questa settimana»: allievi distinti con una guida mia
  // (non annullata) da lunedì a domenica.
  const drivingThisWeek = useMemo(() => {
    if (!instructorId) return 0;
    const { start, end } = weekBounds();
    const ids = new Set<string>();
    for (const a of allAppointments) {
      const t = new Date(a.startsAt).getTime();
      if (a.instructorId === instructorId && t >= start && t < end) ids.add(a.studentId);
    }
    return ids.size;
  }, [allAppointments, instructorId]);

  // Il prossimo esame fra gli allievi visibili: la card in evidenza.
  const nextExam = useMemo(() => {
    let best: { student: StudentEntry; iso: string } | null = null;
    for (const st of visibleStudents) {
      const iso = studentExam.get(st.id);
      if (iso && (!best || new Date(iso) < new Date(best.iso))) best = { student: st, iso };
    }
    return best;
  }, [visibleStudents, studentExam]);

  const lead = loading
    ? ' '
    : [
        `${visibleStudents.length} ${visibleStudents.length === 1 ? 'allievo' : 'allievi'}`,
        drivingThisWeek > 0
          ? `${drivingThisWeek} ${drivingThisWeek === 1 ? 'guida' : 'guidano'} con te questa settimana`
          : null,
      ].filter(Boolean).join(' · ');

  const rowSubtitle = (st: StudentEntry) => {
    const info = studentInfo.get(st.id) ?? { total: 0, completed: 0 };
    const done = Math.min(info.completed, REQUIRED_LESSONS);
    const exam = studentExam.get(st.id);
    const base =
      info.total === 0
        ? 'Nessuna guida ancora'
        : done >= REQUIRED_LESSONS
          ? `${REQUIRED_LESSONS} di ${REQUIRED_LESSONS} · obbligo completato`
          : `${done} di ${REQUIRED_LESSONS} guide`;
    return exam ? `${base} · esame il ${dayMonth(exam)}` : base;
  };

  const examCard = (() => {
    if (!nextExam || query) return null;
    const info = studentInfo.get(nextExam.student.id) ?? { total: 0, completed: 0 };
    const missing = Math.max(0, REQUIRED_LESSONS - info.completed);
    return (
      <Animated.View entering={FadeIn.duration(260)}>
        <ClaySurface
          radius={26}
          onPress={() => navigateToStudent(nextExam.student)}
          style={s.examCard}
          testID="students-next-exam"
          accessibilityLabel={`${nextExam.student.firstName} all'esame il ${dayMonth(nextExam.iso)}`}
        >
          <Image source={VITA_ART.esame} style={s.examArt} />
          <View style={s.examMain}>
            <Text style={s.examTitle} numberOfLines={1}>
              {nextExam.student.firstName} all’esame il {dayMonth(nextExam.iso)}
            </Text>
            <Text style={s.examSub} numberOfLines={1}>
              {missing === 0 ? 'Obbligo guide completato' : `Mancano ${missing} ${missing === 1 ? 'guida' : 'guide'} all’obbligo`}
            </Text>
          </View>
        </ClaySurface>
      </Animated.View>
    );
  })();

  return (
    <View style={s.root}>
      <StatusBar style="dark" />
      <ToastNotice message={toast?.text ?? null} tone={toast?.tone} onHide={() => setToast(null)} />
      <ScrollView
        contentContainerStyle={[s.content, { paddingTop: insets.top }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={CLAY.ink} colors={[CLAY.ink]} />}
      >
        <ClayPageHeader
          title="Allievi"
          subtitle={lead}
          actions={
            autonomousMode ? (
              <ClayIconButton
                icon={<Ionicons name="options-outline" size={20} color={CLAY.ink} />}
                onPress={() => router.push('/(tabs)/notes/cluster-settings' as never)}
                accessibilityLabel="Impostazioni allievi"
                testID="students-settings"
              />
            ) : undefined
          }
        />

        <ClaySearchField
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Cerca un allievo"
          returnKeyType="search"
          clearButtonMode="while-editing"
          style={s.search}
          testID="students-search"
        />

        {useClusters && !query ? (
          <ClaySegmented
            options={[
              { value: 'mine', label: mineCount ? `I miei · ${mineCount}` : 'I miei', testID: 'students-mine' },
              { value: 'all', label: 'Tutti', testID: 'students-all' },
            ]}
            value={segment}
            onChange={setSegment}
            style={s.segmented}
          />
        ) : null}

        {examCard}

        {loading ? (
          <ClaySurface padded={false} style={s.list}>
            {Array.from({ length: 6 }).map((_, i) => (
              <View key={i} style={s.skRow}>
                <SkeletonBlock width={46} height={46} radius={23} />
                <View style={{ flex: 1, gap: 7 }}>
                  <SkeletonBlock width="50%" height={15} radius={6} />
                  <SkeletonBlock width="70%" height={12} radius={6} />
                </View>
              </View>
            ))}
          </ClaySurface>
        ) : shown.length === 0 ? (
          <ClayEmpty
            icon={VITA_ART.volante}
            title={query ? 'Nessun risultato' : 'Ancora nessun allievo'}
            text={query ? `Nessun allievo si chiama «${searchQuery.trim()}».` : 'Quando l’autoscuola ti assegna un allievo, lo trovi qui.'}
          />
        ) : (
          <Animated.View key={`${segment}-${query ? 'q' : ''}`} entering={FadeIn.duration(220)}>
            <ClayList style={s.list}>
              {shown.map((st) => (
                <ClayListRow
                  key={st.id}
                  leading={<Avatar userId={st.id} name={`${st.firstName} ${st.lastName}`} size={46} />}
                  title={`${st.firstName} ${st.lastName}`}
                  subtitle={rowSubtitle(st)}
                  onPress={() => navigateToStudent(st)}
                  testID={`student-row-${st.id}`}
                />
              ))}
            </ClayList>
          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
};

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: CLAY.bg },
  content: { paddingHorizontal: H_PAD, paddingBottom: 130 },
  search: { marginTop: 18 },
  segmented: { marginTop: 12 },
  examCard: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 16, paddingVertical: 14, paddingHorizontal: 18 },
  examArt: { width: 54, height: 54 },
  examMain: { flex: 1, minWidth: 0 },
  examTitle: { fontSize: 17, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.3 },
  examSub: { fontSize: 14.5, color: CLAY.ink3, marginTop: 2 },
  list: { marginTop: 16 },
  skRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, paddingHorizontal: 18 },
});
