import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { ToastNotice, ToastTone } from '../components/ToastNotice';
import { SkeletonBlock } from '../components/Skeleton';
import { ClayLargeTitle, ClayNavBar, useLargeTitleScroll } from '../components/ClayLargeTitle';
import {
  Avatar,
  ClayEmpty,
  ClayIconButton,
  ClayListRow,
  ClaySegmented,
  ClaySurface,
} from '../components/clay';
import { CLAY } from '../theme/clay';
import { CLAY_RADIUS } from '../theme/spacing';
import { VITA_ART } from '../theme/vitaArt';
import { useSession } from '../context/SessionContext';
import { regloApi } from '../services/regloApi';
import { AutoscuolaAppointmentWithRelations, AutoscuolaCase } from '../types/regloApi';
import { REQUIRED_LESSONS, isMandatoryLessonDuration } from '../utils/mandatoryLessons';
import { isCompanyManualMode, isLessonUnpaid } from '../utils/lessonPayments';
import { formatDay, formatTime } from '../utils/date';
import { selectionAsync } from '../utils/haptics';

const monthsShort = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
const H_PAD = 20;
/**
 * «N da pagare» in nero 600 solo da qui in su (Tiziano, 28/10): sotto è grigio
 * normale come il resto della riga, così la lista non è tutta nera.
 */
const DUE_STRONG_FROM = 3;
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
  const { instructorId } = useSession();
  const [students, setStudents] = useState<StudentEntry[]>([]);
  const [allAppointments, setAllAppointments] = useState<AutoscuolaAppointmentWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<{ text: string; tone: ToastTone } | null>(null);
  const [autonomousMode, setAutonomousMode] = useState(false);
  const [cases, setCases] = useState<AutoscuolaCase[]>([]);
  const [segment, setSegment] = useState<'mine' | 'all'>('mine');
  /** Tutte le guide, annullate comprese: le penali tardive sono da pagare. */
  const [rawAppointments, setRawAppointments] = useState<AutoscuolaAppointmentWithRelations[]>([]);
  const [manualPayments, setManualPayments] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const { scrollY, onScroll } = useLargeTitleScroll();

  const loadData = useCallback(async () => {
    try {
      const [bootstrap, appts, instrSettings, allCases, companySettings] = await Promise.all([
        regloApi.getAgendaBootstrap({
          ...(instructorId ? { instructorId } : {}),
          from: new Date(0).toISOString(),
          to: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          limit: 1,
        }),
        regloApi.getAppointments({ limit: 500 }),
        instructorId ? regloApi.getInstructorSettings().catch(() => null) : Promise.resolve(null),
        regloApi.getCases().catch(() => [] as AutoscuolaCase[]),
        regloApi.getAutoscuolaSettings().catch(() => null),
      ]);
      setStudents(bootstrap.students);
      setAllAppointments(appts.filter((a) => (a.status ?? '').trim().toLowerCase() !== 'cancelled'));
      setRawAppointments(appts);
      setManualPayments(
        companySettings
          ? isCompanyManualMode({
              autoPaymentsEnabled: companySettings.autoPaymentsEnabled,
              lessonCreditFlowEnabled: companySettings.lessonCreditFlowEnabled,
              lessonCreditsRequired: companySettings.lessonCreditsRequired,
            })
          : false,
      );
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

  /**
   * Il prossimo passo per ogni allievo (giro «memorabile»): la prossima guida
   * in programma e quante guide ha da pagare.
   */
  const studentNext = useMemo(() => {
    const map = new Map<string, { next: string | null; unpaid: number }>();
    const now = Date.now();
    for (const a of rawAppointments) {
      const cur = map.get(a.studentId) ?? { next: null, unpaid: 0 };
      const st = (a.status ?? '').trim().toLowerCase();
      const t = new Date(a.startsAt).getTime();
      if ((st === 'scheduled' || st === 'confirmed') && t > now && (!cur.next || t < new Date(cur.next).getTime())) {
        cur.next = a.startsAt;
      }
      if (manualPayments && isLessonUnpaid(a, true)) cur.unpaid += 1;
      map.set(a.studentId, cur);
    }
    return map;
  }, [rawAppointments, manualPayments]);

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

  const navigateToStudent = useCallback(
    (student: StudentEntry) => {
      router.push({
        pathname: '/(tabs)/notes/[studentId]',
        params: { studentId: student.id, name: `${student.firstName} ${student.lastName}` },
      } as never);
    },
    [router],
  );

  const query = searchQuery.trim().toLowerCase();
  const shown = useMemo(
    () => (query ? students.filter((st) => `${st.firstName} ${st.lastName}`.toLowerCase().includes(query)) : visibleStudents),
    [query, students, visibleStudents],
  );

  // Chi ha una guida mia (non annullata) da lunedì a domenica: calcolato UNA
  // volta sola sulle guide (fluidità 29/10), non a ogni «I miei / Tutti».
  const weekIds = useMemo(() => {
    const ids = new Set<string>();
    if (!instructorId) return ids;
    const { start, end } = weekBounds();
    for (const a of allAppointments) {
      const t = new Date(a.startsAt).getTime();
      if (a.instructorId === instructorId && t >= start && t < end) ids.add(a.studentId);
    }
    return ids;
  }, [allAppointments, instructorId]);
  /** Chi guida con me questa settimana (fra gli allievi in lista): i volti in cima. */
  const weekFaces = useMemo(() => visibleStudents.filter((st) => weekIds.has(st.id)), [visibleStudents, weekIds]);
  // «3 guidano con te questa settimana»: solo fra gli allievi in lista
  // («5 allievi · 6 guidano con te» non torna).
  const drivingThisWeek = weekFaces.length;

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



  const facesStrip =
    weekFaces.length > 0 && !query && !searching && !loading ? (
      <Animated.View entering={FadeIn.duration(260)} style={s.faces}>
        <Text style={s.facesTitle}>Guidano con te questa settimana</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.facesRow} style={s.facesScroll}>
          {weekFaces.map((st) => (
            <Pressable
              key={st.id}
              onPress={() => {
                void selectionAsync().catch(() => {});
                navigateToStudent(st);
              }}
              style={({ pressed }) => [s.face, pressed && { opacity: 0.6 }]}
              accessibilityRole="button"
              accessibilityLabel={`${st.firstName} ${st.lastName}`}
              testID={`students-face-${st.id}`}
            >
              <Avatar userId={st.id} name={`${st.firstName} ${st.lastName}`} size={58} />
              <Text style={s.faceName} numberOfLines={1}>{st.firstName}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </Animated.View>
    ) : null;

  const examCard = (() => {
    if (!nextExam || query || searching) return null;
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

  // Righe montate UNA volta sola (fluidità 29/10, Tiziano): la lista ha
  // sempre tutti gli allievi; «I miei / Tutti» e la ricerca nascondono le
  // righe che non c'entrano, senza smontarle né rimontare la lista.
  const shownIds = useMemo(() => new Set(shown.map((st) => st.id)), [shown]);
  const order = useMemo(() => {
    const pos = new Map<string, number>();
    shown.forEach((st, i) => pos.set(st.id, i));
    return pos;
  }, [shown]);
  const [rowBase, setRowBase] = useState(0);
  const onRowBase = useCallback((h: number) => setRowBase((prev) => (prev ? prev : h)), []);
  const listShown = !loading && shown.length > 0;
  // La superficie clay dietro le righe (prima `ClayList`): altezza dalle righe
  // visibili, così ombra e bianco seguono la lista nello stesso commit.
  const backdropH = listShown && rowBase ? shown.length * rowBase + LIST_INSET * 2 : 0;

  const renderItem = useCallback(
    ({ item }: { item: StudentEntry }) => {
      const i = order.get(item.id);
      const hidden = i === undefined;
      return (
        <StudentRow
          st={item}
          hidden={hidden}
          first={i === 0}
          last={i === shown.length - 1}
          info={studentInfo.get(item.id)}
          step={studentNext.get(item.id)}
          exam={studentExam.get(item.id)}
          onOpen={navigateToStudent}
          onBase={onRowBase}
        />
      );
    },
    [order, shown.length, studentInfo, studentNext, studentExam, navigateToStudent, onRowBase],
  );

  const header = (
    <View>
      {searching ? null : <ClayLargeTitle title="Allievi" subtitle={lead} />}
      {useClusters && !searching ? (
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

      {facesStrip}

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
        <View style={s.listGap} />
      )}
      {backdropH ? (
        <View pointerEvents="none" style={[s.backdrop, { height: backdropH }]}>
          <ClaySurface padded={false} style={s.backdropFill} />
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={s.root}>
      <StatusBar style="dark" />
      <ToastNotice message={toast?.text ?? null} tone={toast?.tone} onHide={() => setToast(null)} />
      <ClayNavBar
        title="Allievi"
        scrollY={scrollY}
        search={{
          active: searching,
          onActiveChange: setSearching,
          value: searchQuery,
          onChangeText: setSearchQuery,
          placeholder: 'Cerca un allievo',
          testID: 'students-search',
        }}
        actions={
          <>
            <ClayIconButton
              icon={<Ionicons name="search" size={19} color={CLAY.ink} />}
              onPress={() => setSearching(true)}
              accessibilityLabel="Cerca un allievo"
              testID="students-search-open"
            />
            {autonomousMode ? (
              <ClayIconButton
                icon={<Ionicons name="options-outline" size={20} color={CLAY.ink} />}
                onPress={() => router.push('/(tabs)/notes/cluster-settings' as never)}
                accessibilityLabel="Il mio gruppo"
                testID="students-settings"
              />
            ) : null}
          </>
        }
      />
      <Animated.FlatList
        data={loading ? EMPTY : students}
        keyExtractor={keyOf}
        renderItem={renderItem}
        ListHeaderComponent={header}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        initialNumToRender={14}
        windowSize={9}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={CLAY.ink} colors={[CLAY.ink]} />}
      />
    </View>
  );
};

const EMPTY: StudentEntry[] = [];
const keyOf = (st: StudentEntry) => st.id;
/** Respiro sopra la prima e sotto l'ultima riga (lo stesso di `ClayList`). */
const LIST_INSET = 4;

type StudentInfo = { total: number; completed: number };
type StudentStep = { next: string | null; unpaid: number };

function rowSubtitle(info: StudentInfo | undefined, step: StudentStep | undefined, exam: string | undefined) {
  const done = Math.min(info?.completed ?? 0, REQUIRED_LESSONS);
  // Il prossimo passo prima del contatore: la prossima guida e il da
  // riscuotere (in nero solo da DUE_STRONG_FROM in su). Il contatore delle guide resta solo se non c'è altro.
  const when = exam
    ? `Esame il ${dayMonth(exam)}`
    : step?.next
      ? `Prossima ${formatDay(step.next)} · ${formatTime(step.next)}`
      : null;
  const due = step?.unpaid ? (step.unpaid === 1 ? '1 da pagare' : `${step.unpaid} da pagare`) : null;
  if (when || due) {
    return (
      <Text style={s.rowSub} numberOfLines={1}>
        {when}
        {when && due ? ' · ' : null}
        {due ? <Text style={(step?.unpaid ?? 0) >= DUE_STRONG_FROM ? s.rowDue : null}>{due}</Text> : null}
      </Text>
    );
  }
  return !info || info.total === 0
    ? 'Nessuna guida ancora'
    : done >= REQUIRED_LESSONS
      ? `${REQUIRED_LESSONS} di ${REQUIRED_LESSONS} · obbligo completato`
      : `${done} di ${REQUIRED_LESSONS} guide`;
}

/**
 * Riga allievo in memo: si ridisegna solo se cambia lei (posizione, dati,
 * visibilità). Nascosta = `display: none`, resta montata; quando torna
 * visibile entra in dissolvenza (200 ms, thread UI).
 */
const StudentRow = React.memo(function StudentRow({
  st,
  hidden,
  first,
  last,
  info,
  step,
  exam,
  onOpen,
  onBase,
}: {
  st: StudentEntry;
  hidden: boolean;
  first: boolean;
  last: boolean;
  info: StudentInfo | undefined;
  step: StudentStep | undefined;
  exam: string | undefined;
  onOpen: (st: StudentEntry) => void;
  onBase: (h: number) => void;
}) {
  const opacity = useSharedValue(1);
  const wasHidden = useRef(hidden);
  useEffect(() => {
    if (wasHidden.current && !hidden) {
      opacity.value = 0;
      opacity.value = withTiming(1, { duration: 200, easing: Easing.bezier(0.25, 0.1, 0.25, 1), reduceMotion: ReduceMotion.Never });
    }
    wasHidden.current = hidden;
  }, [hidden, opacity]);
  const fade = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const name = `${st.firstName} ${st.lastName}`;
  return (
    <Animated.View
      style={[first && s.rowFirst, last && s.rowLast, hidden && s.rowHidden, fade]}
      onLayout={
        hidden
          ? undefined
          : (e) => onBase(e.nativeEvent.layout.height - (first ? LIST_INSET : 0) - (last ? LIST_INSET : 0))
      }
    >
      <ClayListRow
        leading={<Avatar userId={st.id} name={name} size={46} />}
        title={name}
        subtitle={rowSubtitle(info, step, exam)}
        onPress={() => onOpen(st)}
        divider={!first}
        first={first}
        last={last}
        testID={`student-row-${st.id}`}
      />
    </Animated.View>
  );
});

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: CLAY.bg },
  content: { paddingHorizontal: H_PAD, paddingTop: 4, paddingBottom: 130 },
  segmented: { marginTop: 18 },
  examCard: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 16, paddingVertical: 14, paddingHorizontal: 18 },
  examArt: { width: 54, height: 54 },
  examMain: { flex: 1, minWidth: 0 },
  examTitle: { fontSize: 17, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.3 },
  examSub: { fontSize: 14.5, color: CLAY.ink3, marginTop: 2 },
  list: { marginTop: 16 },
  listGap: { height: 16 },
  // Superficie clay dietro le righe: parte dove finisce l'intestazione.
  backdrop: { position: 'absolute', top: '100%', left: 0, right: 0 },
  backdropFill: { flex: 1 },
  rowFirst: { borderTopLeftRadius: CLAY_RADIUS.card, borderTopRightRadius: CLAY_RADIUS.card, overflow: 'hidden' },
  rowLast: { borderBottomLeftRadius: CLAY_RADIUS.card, borderBottomRightRadius: CLAY_RADIUS.card, overflow: 'hidden' },
  rowHidden: { display: 'none' },
  rowSub: { flexShrink: 1, fontSize: 13.5, color: CLAY.ink3 },
  rowDue: { color: CLAY.ink, fontWeight: '600' },
  faces: { marginTop: 20 },
  facesTitle: { fontSize: 17, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.3, paddingHorizontal: 2 },
  // Le ombre dei volti escono dallo scroll orizzontale: margine compensato (§0.4).
  facesScroll: { marginHorizontal: -H_PAD },
  facesRow: { gap: 16, paddingHorizontal: H_PAD, paddingTop: 12, paddingBottom: 6 },
  face: { alignItems: 'center', width: 64 },
  faceName: { fontSize: 13.5, fontWeight: '500', color: CLAY.ink, marginTop: 7 },
  skRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, paddingHorizontal: 18 },
});
