import React, { useCallback, useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, ReduceMotion } from 'react-native-reanimated';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { ClayNavBar, ClayLargeTitle, useLargeTitleScroll } from '../components/ClayLargeTitle';
import { SkeletonBlock } from '../components/Skeleton';
import { ToastNotice, ToastTone } from '../components/ToastNotice';
import { UpcomingLessonRow } from '../components/studentLesson/UpcomingLessonRow';
import { useSession } from '../context/SessionContext';
import { useAppointments } from '../hooks/queries/useAppointments';
import { useAutoscuolaSettings } from '../hooks/queries/useAutoscuolaSettings';
import { useBookingOptions } from '../hooks/queries/useBookingOptions';
import { useStudentSwaps } from '../hooks/useStudentSwaps';
import { useStudentLessonActions } from '../hooks/useStudentLessonActions';
import { CLAY } from '../theme/clay';
import { isExamLesson, isUpcomingLesson, mondayOf, weekTitle } from '../utils/studentLessons';
import type { AutoscuolaAppointmentWithRelations } from '../types/regloApi';

const IN = FadeIn.duration(220).reduceMotion(ReduceMotion.Never);
const OUT = FadeOut.duration(150).reduceMotion(ReduceMotion.Never);

type Item =
  | { kind: 'week'; key: string; title: string }
  | { kind: 'lesson'; key: string; lesson: AutoscuolaAppointmentWithRelations; first: boolean };

/**
 * REG-791 — «In programma» (anteprima P1, Tiziano 25/11/2026): tutte le guide
 * future dell'allievo in una pagina (push, non foglio: il tocco su una riga
 * apre già il foglio della guida), divise per settimana come «Lascia una
 * guida». Esami esclusi: hanno la loro card in home. Si apre dalla tab Guide
 * e da «Prossime guide» della home (`stack` = lo stack in cui sta, per aprire
 * il foglio della guida lì).
 */
export function StudentUpcomingScreen({ stack }: { stack: 'guide' | 'home' }) {
  const router = useRouter();
  const { user } = useSession();
  const studentId = user?.id ?? null;
  const { scrollY, onScroll } = useLargeTitleScroll();
  const [toast, setToast] = useState<{ text: string; tone: ToastTone } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const settings = useAutoscuolaSettings().data ?? null;
  const bookingOptions = useBookingOptions(studentId).data ?? null;
  const swapEnabled = (bookingOptions?.swapEnabled ?? settings?.swapEnabled) === true;

  // Stessa finestra del foglio «Lascia una guida»: la cache è condivisa.
  const params = useMemo(() => {
    if (!studentId) return null;
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const to = new Date();
    to.setDate(to.getDate() + 120);
    to.setHours(23, 59, 59, 999);
    return { studentId, from: from.toISOString(), to: to.toISOString(), limit: 200 };
  }, [studentId]);
  const query = useAppointments(params);
  const all = useMemo(() => query.data ?? [], [query.data]);
  const { myOffers, myReady } = useStudentSwaps({ enabled: swapEnabled });
  // Le guide lasciate a un compagno compaiono subito con l'orologio: si aspettano anche le richieste.
  const ready = (!!query.data || query.isError) && myReady;
  const mySwapByAppointment = useMemo(() => new Map(myOffers.map((o) => [o.appointmentId, o.id])), [myOffers]);

  const notice = useCallback((text: string, tone: ToastTone) => setToast({ text, tone }), []);
  const { openUpcoming } = useStudentLessonActions({
    stack,
    studentId,
    settings,
    swapEnabled,
    canCancel: bookingOptions?.studentCancellationEnabled === true,
    mySwapByAppointment,
    notice,
  });
  const open = useCallback((l: AutoscuolaAppointmentWithRelations) => openUpcoming(l, all), [openUpcoming, all]);

  const upcoming = useMemo(
    () =>
      all
        .filter((l) => isUpcomingLesson(l) && !isExamLesson(l))
        .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()),
    [all],
  );

  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    let week = '';
    for (const l of upcoming) {
      const monday = mondayOf(new Date(l.startsAt));
      const wk = monday.toISOString();
      const first = wk !== week;
      if (first) {
        week = wk;
        out.push({ kind: 'week', key: `w-${wk}`, title: weekTitle(monday) });
      }
      out.push({ kind: 'lesson', key: l.id, lesson: l, first });
    }
    return out;
  }, [upcoming]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await query.refetch();
    } finally {
      setRefreshing(false);
    }
  }, [query]);

  const renderItem = useCallback(
    ({ item }: { item: Item }) =>
      item.kind === 'week' ? (
        <Text style={s.week}>{item.title}</Text>
      ) : (
        <UpcomingLessonRow
          lesson={item.lesson}
          swapAsked={mySwapByAppointment.has(item.lesson.id)}
          first={item.first}
          chevron
          onPress={open}
        />
      ),
    [mySwapByAppointment, open],
  );

  const n = upcoming.length;
  const subtitle = !ready ? null : n ? `${n} ${n === 1 ? 'guida' : 'guide'}. Tocca una guida per i dettagli.` : null;

  const header = (
    <>
      <ClayLargeTitle title="In programma" subtitle={subtitle} />
      {!ready ? (
        <Animated.View exiting={OUT} style={s.skeleton}>
          <SkeletonBlock width="38%" height={16} radius={8} />
          <SkeletonBlock width="100%" height={60} radius={18} />
          <SkeletonBlock width="100%" height={60} radius={18} />
          <SkeletonBlock width="100%" height={60} radius={18} />
        </Animated.View>
      ) : !n ? (
        <Animated.View entering={IN}>
          <Text style={s.empty}>Nessuna guida in programma, per ora.</Text>
        </Animated.View>
      ) : null}
    </>
  );

  return (
    <View style={s.root}>
      <StatusBar style="dark" />
      <ToastNotice message={toast?.text ?? null} tone={toast?.tone} onHide={() => setToast(null)} />
      <ClayNavBar title="In programma" scrollY={scrollY} onBack={() => router.back()} />
      <Animated.FlatList
        data={ready ? items : []}
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
        testID="upcoming-screen"
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: CLAY.bg },
  scroll: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 120 },
  skeleton: { marginTop: 18, gap: 14 },
  week: { fontSize: 15, fontWeight: '600', color: CLAY.ink3, marginTop: 22, marginBottom: 2, paddingHorizontal: 2 },
  empty: { fontSize: 16, lineHeight: 22, color: CLAY.ink3, marginTop: 18 },
});
