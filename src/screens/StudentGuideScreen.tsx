import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Image, RefreshControl, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, ReduceMotion } from 'react-native-reanimated';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { ClayNavBar, ClayLargeTitle, useLargeTitleScroll } from '../components/ClayLargeTitle';
import { ClaySurface, Icon3D } from '../components/clay';
import { SkeletonBlock } from '../components/Skeleton';
import { ToastNotice, ToastTone } from '../components/ToastNotice';
import { useSession } from '../context/SessionContext';
import { useAppointments } from '../hooks/queries/useAppointments';
import { useAutoscuolaSettings } from '../hooks/queries/useAutoscuolaSettings';
import { useBookingOptions } from '../hooks/queries/useBookingOptions';
import { useStudentSwaps } from '../hooks/useStudentSwaps';
import { useStudentLessonActions } from '../hooks/useStudentLessonActions';
import { doneLessonStore } from '../stores/doneLessonStore';
import { CLAY } from '../theme/clay';
import { isCompanyManualMode } from '../utils/lessonPayments';
import { studentEvaluationLevels } from '../utils/evaluationSheet';
import {
  drivingTimeWords,
  isDoneLesson,
  isPastLesson,
  isUpcomingLesson,
  isExamLesson,
  LESSON_STATUS_LINE,
  lessonMinutes,
  lessonPayment,
  lessonStatus,
  lessonTypeWord,
  durationWords,
  monthLong,
  monthShort,
  scoreWord,
  timeRangeWords,
  weekdayWord,
} from '../utils/studentLessons';
import { fetchRoadForAppointment, roadForAppointmentKey } from './StudentDoneLessonSheet';
import { FlatRow, HomeSection } from './allievoHome/HomeSections';
import type { AutoscuolaAppointmentWithRelations } from '../types/regloApi';

const ART = {
  cartina: require('../../assets/vita/cartina-road.jpg'),
  volante: require('../../assets/vita/volante.png'),
  stella: require('../../assets/vita/stella.png'),
};

const IN = FadeIn.duration(220).reduceMotion(ReduceMotion.Never);
const OUT = FadeOut.duration(150).reduceMotion(ReduceMotion.Never);
/** Guide fatte mostrate prima di «Tutte». */
const DONE_PREVIEW = 8;
/** Percorsi Road pronti in cache prima del tocco (le ultime guide fatte). */
const ROAD_PREFETCH = 6;

type DoneItem =
  | { kind: 'month'; key: string; title: string; showAll: boolean }
  | { kind: 'lesson'; key: string; lesson: AutoscuolaAppointmentWithRelations; first: boolean };

const DateLead = memo(function DateLead({ iso }: { iso: string }) {
  return (
    <View style={s.dt}>
      <Text style={s.dtNum}>{new Date(iso).getDate()}</Text>
      <Text style={s.dtMonth}>{monthShort(iso)}</Text>
    </View>
  );
});

/** Una guida fatta: tipo · durata, istruttore, a destra pagamento o stato (REG-785). */
const DoneRow = memo(function DoneRow({
  lesson,
  first,
  manualMode,
  onOpen,
}: {
  lesson: AutoscuolaAppointmentWithRelations;
  first: boolean;
  manualMode: boolean;
  onOpen: (lesson: AutoscuolaAppointmentWithRelations) => void;
}) {
  const payment = lessonPayment(lesson, manualMode);
  const statusLine = LESSON_STATUS_LINE[lessonStatus(lesson)] ?? null;
  // Una sola parola a destra: il debito vince, poi assente/annullata, poi «Pagata».
  const value = payment === 'due' ? 'Da pagare' : statusLine ? statusLine.label : payment === 'paid' ? 'Pagata' : null;
  const valueStyle =
    payment === 'due' ? s.due : statusLine ? [s.paid, { color: statusLine.color }] : s.paid;
  const subtitle = [lesson.instructor?.name ?? null, payment === 'due' && statusLine ? statusLine.label : null]
    .filter(Boolean)
    .join(' · ');
  return (
    <FlatRow
      first={first}
      leading={<DateLead iso={lesson.startsAt} />}
      title={[lessonTypeWord(lesson), durationWords(lessonMinutes(lesson))].filter(Boolean).join(' · ')}
      subtitle={subtitle || null}
      value={value}
      valueStyle={valueStyle}
      onPress={() => onOpen(lesson)}
      testID={`guide-done-${lesson.id}`}
    />
  );
});

/**
 * REG-786 — tab «Guide» dell'allievo (anteprima V1b approvata da Tiziano il
 * 24/11): una pagina sola. Riepilogo (guide fatte, ore al volante), «Come stai
 * andando» se l'autoscuola condivide il pagellino, le guide in arrivo e le
 * guide fatte col pagamento. Dati: lista guide completa dell'allievo (ramo
 * pieno: porta stato del pagamento e pagellino), in cache TanStack.
 */
export function StudentGuideScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, activeCompanyId } = useSession();
  const studentId = user?.id ?? null;
  const { scrollY, onScroll } = useLargeTitleScroll();
  const [toast, setToast] = useState<{ text: string; tone: ToastTone } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showAllDone, setShowAllDone] = useState(false);

  const settings = useAutoscuolaSettings().data ?? null;
  const bookingOptions = useBookingOptions(studentId).data ?? null;
  const swapEnabled = (bookingOptions?.swapEnabled ?? settings?.swapEnabled) === true;
  const manualMode = isCompanyManualMode(settings);
  const notesShared = settings?.studentNotesEnabled === true;
  const roadVisible = notesShared && settings?.roadEnabled === true;

  // Tre anni indietro, quattro mesi avanti: lo storico intero di un allievo.
  const params = useMemo(() => {
    if (!studentId) return null;
    const from = new Date();
    from.setMonth(from.getMonth() - 36);
    from.setHours(0, 0, 0, 0);
    const to = new Date();
    to.setDate(to.getDate() + 120);
    to.setHours(23, 59, 59, 999);
    return { studentId, from: from.toISOString(), to: to.toISOString(), limit: 500 };
  }, [studentId]);
  const query = useAppointments(params);
  const all = useMemo(() => query.data ?? [], [query.data]);
  const ready = !!query.data || query.isError;

  const { myOffers } = useStudentSwaps({ enabled: swapEnabled });
  const mySwapByAppointment = useMemo(() => new Map(myOffers.map((o) => [o.appointmentId, o.id])), [myOffers]);

  const notice = useCallback((text: string, tone: ToastTone) => setToast({ text, tone }), []);
  const { openUpcoming } = useStudentLessonActions({
    stack: 'guide',
    studentId,
    settings,
    swapEnabled,
    canCancel: bookingOptions?.studentCancellationEnabled === true,
    mySwapByAppointment,
    notice,
  });

  const upcoming = useMemo(
    () =>
      all
        .filter((l) => isUpcomingLesson(l) && !isExamLesson(l))
        .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()),
    [all],
  );
  const past = useMemo(
    () => all.filter((l) => isPastLesson(l)).sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime()),
    [all],
  );
  const done = useMemo(() => past.filter((l) => isDoneLesson(l)), [past]);

  const recap = useMemo(() => {
    const minutes = done.reduce((sum, l) => sum + (lessonMinutes(l) ?? 0), 0);
    const oldest = done[done.length - 1];
    let since: string | null = null;
    if (oldest) {
      const d = new Date(oldest.startsAt);
      since = `Da ${monthLong(oldest.startsAt)}${d.getFullYear() !== new Date().getFullYear() ? ` ${d.getFullYear()}` : ''}`;
    }
    return { count: done.length, minutes, since };
  }, [done]);

  // «Come stai andando»: l'ultimo voto di ogni voce, la più debole in parole.
  const progressLine = useMemo(() => {
    if (!notesShared) return null;
    const levels = studentEvaluationLevels(done);
    if (!levels) return null;
    const weak = levels.items.filter((i) => scoreWord(i.score, i.scaleMax) !== 'Bene');
    if (!weak.length) return 'Tutto bene finora';
    const w = levels.weakest ?? weak[0];
    const word = scoreWord(w.score, w.scaleMax).toLowerCase();
    const head = `${w.label} ${word}`;
    // Una riga sola: con una voce lunga la coda si toglie.
    const tail = weak.length === 1 ? 'il resto ok' : `altre ${weak.length - 1} da rifinire`;
    return head.length + tail.length > 36 ? head : `${head} · ${tail}`;
  }, [done, notesShared]);

  // Percorsi delle ultime guide in cache: il foglio si apre già con la mappa.
  useEffect(() => {
    if (!roadVisible) return;
    done
      .filter((l) => lessonStatus(l) === 'completed')
      .slice(0, ROAD_PREFETCH)
      .forEach((l) =>
        queryClient.prefetchQuery({
          queryKey: roadForAppointmentKey(activeCompanyId, l.id),
          queryFn: () => fetchRoadForAppointment(l.id),
          staleTime: 10 * 60 * 1000,
        }),
      );
  }, [roadVisible, done, queryClient, activeCompanyId]);

  const openDone = useCallback(
    (lesson: AutoscuolaAppointmentWithRelations) => {
      doneLessonStore.set({ lesson, manualMode, roadVisible });
      router.push('/(tabs)/guide/lesson');
    },
    [manualMode, roadVisible, router],
  );

  const doneItems = useMemo<DoneItem[]>(() => {
    const shown = showAllDone ? past : past.slice(0, DONE_PREVIEW);
    const items: DoneItem[] = [];
    let month = '';
    shown.forEach((l) => {
      const d = new Date(l.startsAt);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (key !== month) {
        const label = monthLong(l.startsAt) + (d.getFullYear() !== new Date().getFullYear() ? ` ${d.getFullYear()}` : '');
        items.push({
          kind: 'month',
          key: `m-${key}`,
          title: month ? label.charAt(0).toUpperCase() + label.slice(1) : `Fatte · ${label}`,
          showAll: !month && !showAllDone && past.length > DONE_PREVIEW,
        });
        month = key;
        items.push({ kind: 'lesson', key: l.id, lesson: l, first: true });
      } else {
        items.push({ kind: 'lesson', key: l.id, lesson: l, first: false });
      }
    });
    return items;
  }, [past, showAllDone]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await query.refetch();
    } finally {
      setRefreshing(false);
    }
  }, [query]);

  const renderItem = useCallback(
    ({ item }: { item: DoneItem }) =>
      item.kind === 'month' ? (
        <View style={[s.monthHead, item.title.startsWith('Fatte') ? s.monthFirst : null]}>
          <Text style={s.sect}>{item.title}</Text>
          {item.showAll ? (
            <Text style={s.secl} onPress={() => setShowAllDone(true)} suppressHighlighting testID="guide-done-all">
              Tutte
            </Text>
          ) : null}
        </View>
      ) : (
        <DoneRow lesson={item.lesson} first={item.first} manualMode={manualMode} onOpen={openDone} />
      ),
    [manualMode, openDone],
  );

  const header = (
    <>
      <ClayLargeTitle title="Guide" />
      {!ready ? (
        <Animated.View exiting={OUT} style={s.skeleton}>
          <SkeletonBlock width="100%" height={258} radius={28} />
          <View style={s.skeletonRows}>
            <SkeletonBlock width="38%" height={16} radius={8} />
            <SkeletonBlock width="100%" height={44} radius={12} />
            <SkeletonBlock width="100%" height={44} radius={12} />
          </View>
        </Animated.View>
      ) : (
        <Animated.View entering={IN}>
          <ClaySurface padded={false} style={s.card} accessibilityLabel={`${recap.count} guide fatte`}>
            {roadVisible ? (
              <View style={s.cover}>
                <Image source={ART.cartina} style={s.coverImg} resizeMode="cover" accessibilityIgnoresInvertColors />
              </View>
            ) : (
              <View style={[s.cover, s.coverPlain]}>
                <Icon3D source={ART.volante} size={84} />
              </View>
            )}
            <View style={s.bb}>
              {recap.since ? <Text style={s.when}>{recap.since}</Text> : null}
              <View style={s.bigNum}>
                <Text style={s.bigNumValue}>{recap.count}</Text>
                <Text style={s.bigNumLabel}>{recap.count === 1 ? 'guida fatta' : 'guide fatte'}</Text>
              </View>
              <Text style={s.stats}>
                {recap.count ? `${drivingTimeWords(recap.minutes)} al volante` : 'Qui trovi le guide che fai.'}
              </Text>
            </View>
          </ClaySurface>

          {progressLine ? (
            <View style={s.under}>
              <FlatRow
                first
                strong
                leading={<Icon3D source={ART.stella} size={34} />}
                title="Come stai andando"
                subtitle={progressLine}
                onPress={() => router.push('/(tabs)/guide/notes')}
                testID="guide-progress"
              />
            </View>
          ) : null}

          {upcoming.length ? (
            <HomeSection title="In arrivo">
              {upcoming.map((l, i) => {
                const swapAsked = mySwapByAppointment.has(l.id);
                const who = l.groupLessonId ? 'Guida di gruppo' : l.instructor?.name ?? 'Istruttore da assegnare';
                const extra = swapAsked ? 'sostituzione richiesta' : l.groupLessonId ? null : lessonTypeWord(l).toLowerCase();
                return (
                  <FlatRow
                    key={l.id}
                    first={i === 0}
                    leading={<DateLead iso={l.startsAt} />}
                    title={`${weekdayWord(l.startsAt)} · ${timeRangeWords(l)}`}
                    subtitle={extra && extra !== 'guida' ? `${who} · ${extra}` : who}
                    onPress={() => openUpcoming(l, all)}
                    testID={`guide-upcoming-${l.id}`}
                  />
                );
              })}
            </HomeSection>
          ) : null}
        </Animated.View>
      )}
    </>
  );

  return (
    <View style={s.root}>
      <StatusBar style="dark" />
      <ToastNotice message={toast?.text ?? null} tone={toast?.tone} onHide={() => setToast(null)} />
      <ClayNavBar title="Guide" scrollY={scrollY} />
      <Animated.FlatList
        data={ready ? doneItems : []}
        keyExtractor={(item) => item.key}
        renderItem={renderItem}
        ListHeaderComponent={header}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        initialNumToRender={12}
        windowSize={7}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={CLAY.ink3} />}
        testID="guide-screen"
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: CLAY.bg },
  scroll: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 120 },
  skeleton: { marginTop: 18, gap: 14 },
  skeletonRows: { marginTop: 14, gap: 14 },
  card: { marginTop: 18, borderRadius: 28 },
  cover: { height: 118, overflow: 'hidden', borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  coverPlain: { height: 110, alignItems: 'center', justifyContent: 'center' },
  coverImg: { width: '100%', height: '100%' },
  bb: { paddingTop: 14, paddingHorizontal: 20, paddingBottom: 20 },
  when: { fontSize: 13.5, color: CLAY.ink3 },
  bigNum: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 2 },
  bigNumValue: { fontSize: 44, lineHeight: 48, fontWeight: '600', color: CLAY.ink, letterSpacing: -1.5 },
  bigNumLabel: { fontSize: 18, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.4 },
  stats: { fontSize: 15, color: CLAY.ink2, marginTop: 6 },
  under: { marginTop: 10 },
  monthHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 28, marginBottom: 4, paddingHorizontal: 2 },
  monthFirst: { marginTop: 28 },
  sect: { fontSize: 17, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.3 },
  secl: { fontSize: 15, fontWeight: '500', color: CLAY.ink3 },
  dt: { alignItems: 'center' },
  dtNum: { fontSize: 22, lineHeight: 24, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.5 },
  dtMonth: { fontSize: 12.5, color: CLAY.ink3 },
  due: { color: CLAY.ink, fontWeight: '600' },
  paid: { fontSize: 15, color: CLAY.ink3 },
});
