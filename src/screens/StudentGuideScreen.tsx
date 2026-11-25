import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeOut, ReduceMotion } from 'react-native-reanimated';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { ClayNavBar, NAV_BAR_H } from '../components/ClayLargeTitle';
import { COVER_OVERLAP, StretchyCover, StretchySpacer, stretchyPanel, useStretchyCover } from '../components/clay/StretchyCover';
import { CLAY_ROW_PRESSED, ClaySurface, Icon3D } from '../components/clay';
import { SkeletonBlock } from '../components/Skeleton';
import { firstName } from '../components/studentLesson/LessonSheetParts';
import { useTabBarOverlap } from '../components/tabBarSpace';
import { useSession } from '../context/SessionContext';
import { useAppointments } from '../hooks/queries/useAppointments';
import { useAutoscuolaSettings } from '../hooks/queries/useAutoscuolaSettings';
import { car34Art } from '../road/markerArt';
import { formatKm } from '../road/format';
import { doneLessonStore } from '../stores/doneLessonStore';
import { CLAY, CLAY_SHADOW } from '../theme/clay';
import { isCompanyManualMode } from '../utils/lessonPayments';
import { studentEvaluationLevels, type StudentEvaluationLevel } from '../utils/evaluationSheet';
import {
  isDoneLesson,
  isExamLesson,
  isPastLesson,
  isUpcomingLesson,
  LESSON_STATUS_LINE,
  lessonMinutes,
  lessonPayment,
  lessonStatus,
  lessonTypeWord,
  durationWords,
  monthLong,
  monthShort,
  scoreWord,
  weekdayWord,
} from '../utils/studentLessons';
import { fetchRoadForAppointment, roadForAppointmentKey } from './StudentDoneLessonSheet';
import type { AutoscuolaAppointmentWithRelations, RoadDetail } from '../types/regloApi';

const COVER = require('../../assets/vita/guide-strada.jpg');
const STELLA = require('../../assets/vita/stella.png');

const IN = FadeIn.duration(220).reduceMotion(ReduceMotion.Never);
const OUT = FadeOut.duration(150).reduceMotion(ReduceMotion.Never);
const THUMB_IN = FadeIn.duration(200).reduceMotion(ReduceMotion.Never);
/** Guide fatte mostrate prima di «Tutte». */
const DONE_PREVIEW = 8;
/** Percorsi Road pronti in cache prima del tocco (le ultime guide fatte). */
const ROAD_PREFETCH = 6;
/** Le righe più in alto chiedono il percorso per la miniatura; le altre la usano solo se è già in cache. */
const ROAD_THUMB_FETCH = 12;
const ROAD_STALE = 10 * 60 * 1000;
/** Altezza stimata di una riga e di un mese: serve alla copertina per riempire lo spazio con poche guide. */
const ROW_H = 66;
const MONTH_H = 58;
/** Ambra della voce da rifinire (lo stesso della stella 3D). */
const AMBER = '#F5A524';
const AMBER_INK = '#A86200';

type DoneItem =
  | { kind: 'month'; key: string; title: string; showAll: boolean }
  | {
      kind: 'lesson';
      key: string;
      lesson: AutoscuolaAppointmentWithRelations;
      first: boolean;
      index: number;
    };

/** «17 h», «9 h 30», «45 min». */
const hoursWords = (minutes: number) => {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m}` : `${h} h`;
};

const hm = (iso: string) => {
  const d = new Date(iso);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/** «oggi», «domani», altrimenti il giorno della settimana («venerdì»). */
const dayWords = (iso: string) => {
  const d = new Date(iso);
  d.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (days === 0) return 'oggi';
  if (days === 1) return 'domani';
  return weekdayWord(iso).toLowerCase();
};

// ── Livello 1: «Come stai andando», una scala per voce (anteprima B1) ─────────

/** Al massimo 5 segmenti: le scale più lunghe si riportano su 5. */
const segmentsOf = (item: StudentEvaluationLevel) => {
  const total = Math.min(5, Math.max(1, item.scaleMax));
  const filled = Math.round((item.score / item.scaleMax) * total);
  return { total, filled };
};

const VoiceRow = memo(function VoiceRow({ item }: { item: StudentEvaluationLevel }) {
  const word = scoreWord(item.score, item.scaleMax);
  const weak = word !== 'Bene';
  const { total, filled } = segmentsOf(item);
  return (
    <View style={s.voice} accessibilityLabel={`${item.label}: ${word}`}>
      <View style={s.voiceText}>
        <Text style={[s.voiceLabel, weak && s.voiceWeak]} numberOfLines={1}>
          {item.label}
        </Text>
        {weak ? <Text style={s.voiceWord}>{word}</Text> : null}
      </View>
      <View style={s.seg}>
        {Array.from({ length: total }, (_, k) => (
          <View key={k} style={[s.segCell, k < filled && (weak ? s.segAmber : s.segInk)]} />
        ))}
      </View>
    </View>
  );
});

const ProgressCard = memo(function ProgressCard({ items, onPress }: { items: StudentEvaluationLevel[]; onPress: () => void }) {
  const good = items.filter((i) => scoreWord(i.score, i.scaleMax) === 'Bene').length;
  const headline =
    good === items.length
      ? items.length === 1
        ? 'Bene, per ora'
        : 'Bene in tutte le voci'
      : `Bene in ${good} ${good === 1 ? 'voce' : 'voci'} su ${items.length}`;
  // Le voci deboli per prime (la più debole in cima), poi le altre: al massimo 4.
  const shown = useMemo(() => {
    const ratio = (i: StudentEvaluationLevel) => i.score / i.scaleMax;
    const weak = items.filter((i) => scoreWord(i.score, i.scaleMax) !== 'Bene').sort((a, b) => ratio(a) - ratio(b));
    const rest = items.filter((i) => scoreWord(i.score, i.scaleMax) === 'Bene');
    return [...weak, ...rest].slice(0, 4);
  }, [items]);

  return (
    <ClaySurface style={s.progress} onPress={onPress} accessibilityLabel={`Come stai andando: ${headline}`} testID="guide-progress">
      <View style={s.progressHead}>
        <View style={s.star}>
          <Svg style={s.starGlow} width={92} height={92} pointerEvents="none">
            <Defs>
              <RadialGradient id="starGlow" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor="#FFE6B3" stopOpacity={1} />
                <Stop offset="0.7" stopColor="#FFE6B3" stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Rect width={92} height={92} fill="url(#starGlow)" />
          </Svg>
          <Icon3D source={STELLA} size={56} />
        </View>
        <View style={s.progressTitle}>
          <Text style={s.over}>Come stai andando</Text>
          <Text style={s.mid}>{headline}</Text>
        </View>
      </View>
      <View style={s.voices}>
        {shown.map((i) => (
          <VoiceRow key={i.itemId} item={i} />
        ))}
      </View>
    </ClaySurface>
  );
});

// ── Livello 2: numeri e «In programma» ────────────────────────────────────────

const NumLine = memo(function NumLine({ count, minutes, since }: { count: number; minutes: number; since: string | null }) {
  return (
    <View style={s.nums} accessibilityLabel={`${count} guide fatte, ${hoursWords(minutes)} al volante${since ? `, ${since}` : ''}`}>
      <Text style={s.num}>{count}</Text>
      <Text style={s.numLabel}>{count === 1 ? 'guida fatta' : 'guide fatte'}</Text>
      {minutes ? (
        <>
          <Text style={s.num}>{hoursWords(minutes)}</Text>
          <Text style={s.numLabel}>al volante</Text>
        </>
      ) : null}
      {since ? <Text style={[s.numLabel, s.numLast]}>{since}</Text> : null}
    </View>
  );
});

/** Le tessere delle prossime guide, impilate: davanti la prima, dietro (vuote) le altre. */
const DateFan = memo(function DateFan({ iso, count }: { iso: string; count: number }) {
  return (
    <View style={s.fan}>
      {count > 2 ? <View style={[s.fanTile, s.fanBack2]} /> : null}
      {count > 1 ? <View style={[s.fanTile, s.fanBack1]} /> : null}
      <View style={s.fanTile}>
        <Text style={s.fanDay}>{new Date(iso).getDate()}</Text>
        <Text style={s.fanMonth}>{monthShort(iso)}</Text>
      </View>
    </View>
  );
});

const UpcomingCard = memo(function UpcomingCard({ next, count, onPress }: { next: string; count: number; onPress: () => void }) {
  const line = `La prossima ${dayWords(next)} alle ${hm(next)}`;
  return (
    <ClaySurface
      padded={false}
      style={s.upcoming}
      onPress={onPress}
      accessibilityLabel={`In programma: ${count}. ${line}`}
      testID="guide-upcoming"
    >
      <DateFan iso={next} count={count} />
      <View style={s.upcomingText}>
        <Text style={s.upcomingTitle}>In programma · {count}</Text>
        <Text style={s.upcomingLine} numberOfLines={1}>
          {line}
        </Text>
      </View>
      <ChevronGlyph />
    </ClaySurface>
  );
});

const ChevronGlyph = () => (
  <Svg width={9} height={15} viewBox="0 0 9 15">
    <Path d="M1.5 1.5l6 6-6 6" stroke={CLAY.ink3} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

// ── Livello 3: le guide fatte (anteprima F1) ─────────────────────────────────

const THUMB = 48;
const THUMB_PAD = 9;

/** La traccia della guida dentro la tessera: proiezione piana, punti ridotti, nessuna mappa. */
const routePath = (track: RoadDetail['track']) => {
  const step = Math.max(1, Math.floor(track.length / 80));
  const pts = track.filter((_, i) => i % step === 0 || i === track.length - 1);
  const lat0 = (pts[0][0] * Math.PI) / 180;
  const xy = pts.map(([lat, lng]) => [lng * Math.cos(lat0), -lat] as const);
  const xs = xy.map((p) => p[0]);
  const ys = xy.map((p) => p[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const w = Math.max(...xs) - minX || 1e-6;
  const h = Math.max(...ys) - minY || 1e-6;
  const box = THUMB - THUMB_PAD * 2;
  const k = box / Math.max(w, h);
  const ox = THUMB_PAD + (box - w * k) / 2;
  const oy = THUMB_PAD + (box - h * k) / 2;
  const out = xy.map(([x, y]) => [ox + (x - minX) * k, oy + (y - minY) * k] as const);
  const d = out.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join('');
  return { d, start: out[0], end: out[out.length - 1] };
};

const RouteThumb = memo(function RouteThumb({ track }: { track: RoadDetail['track'] }) {
  const r = useMemo(() => routePath(track), [track]);
  return (
    <Animated.View entering={THUMB_IN}>
      <Svg width={THUMB} height={THUMB}>
        <Path d={r.d} stroke="#FFFFFF" strokeWidth={5.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <Path d={r.d} stroke={CLAY.ink} strokeWidth={2.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <Circle cx={r.start[0]} cy={r.start[1]} r={3.4} fill={AMBER} stroke="#FFFFFF" strokeWidth={1.5} />
        <Circle cx={r.end[0]} cy={r.end[1]} r={3.8} fill="#E5484D" stroke="#FFFFFF" strokeWidth={1.5} />
      </Svg>
    </Animated.View>
  );
});

/** Una guida fatta: miniatura del percorso (o l'auto 3D), giorno e tipo, durata · istruttore · km, a destra una parola. */
const DoneRow = memo(function DoneRow({
  lesson,
  first,
  fetchRoad,
  roadVisible,
  companyId,
  manualMode,
  onOpen,
}: {
  lesson: AutoscuolaAppointmentWithRelations;
  first: boolean;
  fetchRoad: boolean;
  roadVisible: boolean;
  companyId: string | null;
  manualMode: boolean;
  onOpen: (lesson: AutoscuolaAppointmentWithRelations) => void;
}) {
  const completed = lessonStatus(lesson) === 'completed';
  const road = useQuery({
    queryKey: roadForAppointmentKey(companyId, lesson.id),
    queryFn: () => fetchRoadForAppointment(lesson.id),
    enabled: roadVisible && completed && fetchRoad,
    staleTime: ROAD_STALE,
  }).data;
  const waitingRoad = roadVisible && completed && fetchRoad && road === undefined;

  const payment = lessonPayment(lesson, manualMode);
  const statusLine = LESSON_STATUS_LINE[lessonStatus(lesson)] ?? null;
  // Una sola parola a destra: il debito vince, poi assente/annullata, poi «Pagata».
  const value = payment === 'due' ? 'Da pagare' : statusLine ? statusLine.label : payment === 'paid' ? 'Pagata' : null;
  const d = new Date(lesson.startsAt);
  const type = lessonTypeWord(lesson);
  const title = `${weekdayWord(lesson.startsAt)} ${d.getDate()}${type === 'Guida' ? '' : ` · ${type.toLowerCase()}`}`;
  const subtitle = [
    durationWords(lessonMinutes(lesson)),
    firstName(lesson.instructor?.name),
    road ? `${formatKm(road.distanceMeters)} km` : null,
    payment === 'due' && statusLine ? statusLine.label : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Pressable
      onPress={() => onOpen(lesson)}
      style={({ pressed }) => [s.doneRow, pressed && CLAY_ROW_PRESSED]}
      accessibilityRole="button"
      testID={`guide-done-${lesson.id}`}
    >
      <View style={s.thumb}>
        {road ? (
          <RouteThumb track={road.track} />
        ) : waitingRoad ? null : (
          <Icon3D source={car34Art(lesson.vehicle?.color)} size={32} width={40} />
        )}
      </View>
      <View style={[s.doneBody, !first && s.divider]}>
        <View style={s.doneText}>
          <Text style={s.doneTitle} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={s.doneSub} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {value ? <Text style={payment === 'due' ? s.due : [s.paid, statusLine ? { color: statusLine.color } : null]}>{value}</Text> : null}
        <ChevronGlyph />
      </View>
    </Pressable>
  );
});

/**
 * Tab «Guide» dell'allievo. REG-791 (anteprime B1 + F1, Tiziano 25/11/2026):
 * sezione con copertina elastica (strada 3D) e il foglio bianco che ci sale,
 * come Scambi. Livello 1: «Come stai andando» con una scala a segmenti per
 * voce del pagellino (la voce da rifinire in ambra), solo se l'autoscuola
 * condivide il pagellino. Livello 2: guide fatte e ore al volante in una riga,
 * poi «In programma · N» che apre la pagina delle guide future
 * (`guide/upcoming`). Livello 3: le guide fatte per mese, con la miniatura
 * del percorso Road (traccia disegnata, nessuna mappa) o l'auto 3D.
 * Dati: lista guide completa dell'allievo (ramo pieno: pagamento e
 * pagellino), in cache TanStack.
 */
export function StudentGuideScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const barOverlap = useTabBarOverlap();
  const { user, activeCompanyId } = useSession();
  const studentId = user?.id ?? null;
  const [viewH, setViewH] = useState(0);
  const stretch = useStretchyCover({
    base: Math.round(height * 0.3),
    viewportHeight: viewH || height,
    bottomInset: barOverlap,
  });
  const [headerH, setHeaderH] = useState(0);
  const [showAllDone, setShowAllDone] = useState(false);

  const settings = useAutoscuolaSettings().data ?? null;
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
    return {
      studentId,
      from: from.toISOString(),
      to: to.toISOString(),
      limit: 500,
    };
  }, [studentId]);
  const query = useAppointments(params);
  const all = useMemo(() => query.data ?? [], [query.data]);
  const ready = !!query.data || query.isError;

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
      since = `da ${monthLong(oldest.startsAt)}${d.getFullYear() !== new Date().getFullYear() ? ` ${d.getFullYear()}` : ''}`;
    }
    return { count: done.length, minutes, since };
  }, [done]);

  // «Come stai andando»: l'ultimo voto di ogni voce (solo col pagellino condiviso).
  const levels = useMemo(() => (notesShared ? studentEvaluationLevels(done) : null), [done, notesShared]);

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
          staleTime: ROAD_STALE,
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
  const openUpcoming = useCallback(() => router.push('/(tabs)/guide/upcoming'), [router]);
  const openNotes = useCallback(() => router.push('/(tabs)/guide/notes'), [router]);

  const doneItems = useMemo<DoneItem[]>(() => {
    const shown = showAllDone ? past : past.slice(0, DONE_PREVIEW);
    const items: DoneItem[] = [];
    let month = '';
    shown.forEach((l, index) => {
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
        items.push({
          kind: 'lesson',
          key: l.id,
          lesson: l,
          first: true,
          index,
        });
      } else {
        items.push({
          kind: 'lesson',
          key: l.id,
          lesson: l,
          first: false,
          index,
        });
      }
    });
    return items;
  }, [past, showAllDone]);

  // La copertina riempie lo spazio sopra il foglio quando le guide sono poche:
  // altezza del contenuto = intestazione misurata + righe stimate + piede.
  const { setPanelHeight } = stretch;
  useEffect(() => {
    if (!headerH) return;
    const rows = ready ? doneItems.reduce((h, i) => h + (i.kind === 'month' ? MONTH_H : ROW_H), -SHADOW_ROOM) : 0;
    setPanelHeight(headerH + rows + FOOT_H);
  }, [headerH, doneItems, ready, setPanelHeight]);

  const renderItem = useCallback(
    ({ item, index }: { item: DoneItem; index: number }) =>
      item.kind === 'month' ? (
        <View style={[s.monthHead, index === 0 && s.monthHeadFirst]}>
          <Text style={s.sect}>{item.title}</Text>
          {item.showAll ? (
            <Text style={s.secl} onPress={() => setShowAllDone(true)} suppressHighlighting testID="guide-done-all">
              Tutte
            </Text>
          ) : null}
        </View>
      ) : (
        <View style={s.rowWrap}>
          <DoneRow
            lesson={item.lesson}
            first={item.first}
            fetchRoad={item.index < ROAD_THUMB_FETCH}
            roadVisible={roadVisible}
            companyId={activeCompanyId}
            manualMode={manualMode}
            onOpen={openDone}
          />
        </View>
      ),
    [manualMode, openDone, roadVisible, activeCompanyId],
  );

  const header = (
    <View onLayout={(e) => setHeaderH(Math.round(e.nativeEvent.layout.height))}>
      <StretchySpacer style={stretch.spacerStyle} />
      <View style={[stretchyPanel, s.panel]}>
        <Text style={s.title} accessibilityRole="header">
          Guide
        </Text>
        {!ready ? (
          <Animated.View exiting={OUT} style={s.skeleton}>
            <SkeletonBlock width="100%" height={notesShared ? 236 : 40} radius={notesShared ? 28 : 12} />
            <SkeletonBlock width="100%" height={76} radius={24} />
            <View style={s.skeletonRows}>
              <SkeletonBlock width="38%" height={16} radius={8} />
              <SkeletonBlock width="100%" height={48} radius={14} />
              <SkeletonBlock width="100%" height={48} radius={14} />
            </View>
          </Animated.View>
        ) : (
          <Animated.View entering={IN}>
            {levels?.items.length ? <ProgressCard items={levels.items} onPress={openNotes} /> : null}
            {recap.count ? (
              <NumLine count={recap.count} minutes={recap.minutes} since={recap.since} />
            ) : (
              <Text style={s.lead}>Qui trovi le guide che fai, con il percorso quando c'è.</Text>
            )}
            {upcoming.length ? <UpcomingCard next={upcoming[0].startsAt} count={upcoming.length} onPress={openUpcoming} /> : null}
          </Animated.View>
        )}
      </View>
    </View>
  );

  return (
    <View style={s.root} onLayout={(e) => setViewH(Math.round(e.nativeEvent.layout.height))}>
      <StatusBar style="dark" />
      <StretchyCover style={stretch.coverStyle} testID="guide-cover">
        <Image source={COVER} style={s.coverImg} resizeMode="cover" accessibilityIgnoresInvertColors />
      </StretchyCover>

      <Animated.FlatList
        style={StyleSheet.absoluteFill}
        data={ready ? doneItems : []}
        keyExtractor={(item) => item.key}
        renderItem={renderItem}
        ListHeaderComponent={header}
        ListFooterComponent={<View style={[s.foot, { height: FOOT_H + barOverlap }]} />}
        onScroll={stretch.onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        initialNumToRender={12}
        windowSize={7}
        testID="guide-screen"
      />

      {/* Barra trasparente sulla copertina, bianca col titolo quando il foglio ci passa sotto. */}
      <ClayNavBar title="Guide" scrollY={stretch.scrollY} overlay={stretch.coverHeight - COVER_OVERLAP - (insets.top + NAV_BAR_H) + 30} />
    </View>
  );
}

const FOOT_H = 28;
/** Spazio sotto il pannello per l'ombra della card, tolto alla prima intestazione del mese. */
const SHADOW_ROOM = 20;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: CLAY.bg },
  coverImg: { width: '100%', height: '100%' },
  // L'ombra dell'ultima card («In programma») scende ~20 pt sotto: deve stare
  // DENTRO il pannello, perché la cella dopo (sfondo pieno) la coprirebbe.
  panel: { paddingTop: 26, paddingHorizontal: 20, paddingBottom: 4 + SHADOW_ROOM },
  title: {
    fontSize: 32,
    fontWeight: '600',
    color: CLAY.ink,
    letterSpacing: -0.9,
  },
  lead: { fontSize: 15.5, lineHeight: 21, color: CLAY.ink2, marginTop: 6 },
  skeleton: { marginTop: 20, gap: 14 },
  skeletonRows: { marginTop: 10, gap: 14 },

  progress: { marginTop: 20, paddingTop: 18, paddingBottom: 12 },
  progressHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  star: {
    width: 58,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
  },
  starGlow: { position: 'absolute', left: -17, top: -17 },
  progressTitle: { flex: 1, minWidth: 0 },
  over: { fontSize: 14, color: CLAY.ink3 },
  mid: {
    fontSize: 21,
    lineHeight: 26,
    fontWeight: '600',
    color: CLAY.ink,
    letterSpacing: -0.5,
  },
  voices: {
    marginTop: 12,
    paddingTop: 6,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(17,17,17,0.12)',
  },
  voice: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 38 },
  voiceText: { flex: 1, minWidth: 0 },
  voiceLabel: { fontSize: 15, color: CLAY.ink2 },
  voiceWeak: { color: CLAY.ink, fontWeight: '600' },
  voiceWord: {
    fontSize: 12.5,
    fontWeight: '500',
    color: AMBER_INK,
    marginTop: -1,
  },
  seg: { flexDirection: 'row', gap: 4 },
  segCell: {
    width: 22,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ECEBE8',
  },
  segInk: { backgroundColor: '#1E1E1E' },
  segAmber: { backgroundColor: AMBER },

  nums: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    marginTop: 22,
    columnGap: 6,
  },
  num: {
    fontSize: 28,
    fontWeight: '600',
    color: CLAY.ink,
    letterSpacing: -0.9,
  },
  numLabel: { fontSize: 15, color: CLAY.ink3, marginRight: 14 },
  numLast: { marginRight: 0 },

  upcoming: {
    marginTop: 14,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingLeft: 14,
    paddingRight: 18,
  },
  fan: { width: 62, height: 54 },
  fanTile: {
    position: 'absolute',
    left: 0,
    top: 2,
    width: 44,
    height: 48,
    borderRadius: 14,
    backgroundColor: CLAY.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...CLAY_SHADOW.raiseSm,
  },
  fanBack1: {
    left: 7,
    top: 3,
    backgroundColor: '#FAF9F7',
    transform: [{ rotate: '4deg' }],
  },
  fanBack2: {
    left: 14,
    top: 6,
    backgroundColor: '#F4F2EE',
    transform: [{ rotate: '9deg' }],
  },
  fanDay: {
    fontSize: 18,
    lineHeight: 20,
    fontWeight: '600',
    color: CLAY.ink,
    letterSpacing: -0.5,
  },
  fanMonth: { fontSize: 10.5, color: CLAY.ink3 },
  upcomingText: { flex: 1, minWidth: 0 },
  upcomingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: CLAY.ink,
    letterSpacing: -0.2,
  },
  upcomingLine: { fontSize: 14, color: CLAY.ink3, marginTop: 2 },

  monthHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingTop: 28,
    paddingBottom: 4,
    paddingHorizontal: 22,
    backgroundColor: CLAY.bg,
  },
  monthHeadFirst: { paddingTop: 28 - SHADOW_ROOM },
  sect: {
    fontSize: 17,
    fontWeight: '600',
    color: CLAY.ink,
    letterSpacing: -0.3,
  },
  secl: { fontSize: 15, fontWeight: '500', color: CLAY.ink3 },
  rowWrap: { paddingHorizontal: 20, backgroundColor: CLAY.bg },
  doneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: ROW_H,
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: 15,
    backgroundColor: '#F4F2EE',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...CLAY_SHADOW.raiseSm,
  },
  doneBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    alignSelf: 'stretch',
    paddingVertical: 12,
  },
  divider: { borderTopWidth: 0.5, borderTopColor: 'rgba(17,17,17,0.12)' },
  doneText: { flex: 1, minWidth: 0 },
  doneTitle: {
    fontSize: 15.5,
    fontWeight: '500',
    color: CLAY.ink,
    letterSpacing: -0.2,
  },
  doneSub: { fontSize: 14, color: CLAY.ink3, marginTop: 2 },
  due: { fontSize: 15, color: CLAY.ink, fontWeight: '600' },
  paid: { fontSize: 15, color: CLAY.ink3 },
  foot: { backgroundColor: CLAY.bg },
});
