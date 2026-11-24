import React, { useMemo, useState, useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { FormSheet } from '../components/SheetScaffold';
import { RoadRouteMap } from '../components/road/RoadMiniMap';
import { useSession } from '../context/SessionContext';
import { regloApi } from '../services/regloApi';
import { roadRouteMapStore } from '../road/routeMapStore';
import { formatKm, formatMinutes } from '../road/format';
import { doneLessonStore } from '../stores/doneLessonStore';
import { CLAY, CLAY_SHADOW } from '../theme/clay';
import { FlatRow, HomeSection } from './allievoHome/HomeSections';
import {
  durationWords,
  LESSON_STATUS_LINE,
  lessonMinutes,
  lessonPayment,
  lessonStatus,
  lessonTypeWord,
  longDay,
  paidHow,
  scoreWord,
  timeRangeWords,
} from '../utils/studentLessons';
import type { RoadDetail } from '../types/regloApi';

const MAP_IN = FadeIn.duration(220).reduceMotion(ReduceMotion.Never);

export const roadForAppointmentKey = (companyId: string | null, appointmentId: string) =>
  ['road-appointment', companyId, appointmentId] as const;

/** La traccia della guida per l'allievo: `null` se Road non c'era o non è condiviso. */
export const fetchRoadForAppointment = async (appointmentId: string): Promise<RoadDetail | null> => {
  const d = await regloApi.getRoadForAppointment(appointmentId);
  return d && d.track?.length ? d : null;
};

/**
 * REG-786 — foglio della guida fatta (anteprime D1/D2): percorso Road con gli
 * errori SOLO se Road è acceso e l'autoscuola condivide note e percorsi con
 * l'allievo (il server lo decide: altrimenti risponde null), poi il pagamento
 * e il pagellino in parole. Il pagellino arriva solo se l'autoscuola ha aperto
 * le note all'allievo (lo filtra il server).
 */
export function StudentDoneLessonSheet() {
  const router = useRouter();
  const { activeCompanyId } = useSession();
  const live = useSyncExternalStore(doneLessonStore.subscribe, doneLessonStore.get);
  // Il seed vale per tutta la vita del foglio: chi apre un'altra guida dopo non lo cambia sotto.
  const [data] = useState(() => live);
  const lesson = data?.lesson;
  const status = lesson ? lessonStatus(lesson) : '';

  const roadQuery = useQuery({
    queryKey: roadForAppointmentKey(activeCompanyId, lesson?.id ?? ''),
    queryFn: () => fetchRoadForAppointment(lesson!.id),
    enabled: !!lesson && !!data?.roadVisible && status === 'completed',
    staleTime: 10 * 60 * 1000,
  });
  const road = roadQuery.data ?? null;

  const review = useMemo(() => (road?.markers ?? []).filter((m) => m.sentiment !== 'good'), [road]);
  const evaluations = useMemo(
    () => (lesson?.evaluations ?? []).filter((e) => !e.notApplicable && e.score != null),
    [lesson],
  );

  if (!data || !lesson) return <FormSheet />;

  const payment = lessonPayment(lesson, data.manualMode);
  const statusLine = LESSON_STATUS_LINE[status] ?? null;
  const title = [lessonTypeWord(lesson), durationWords(lessonMinutes(lesson))].filter(Boolean).join(' · ');
  const meta = [timeRangeWords(lesson), lesson.instructor?.name, lesson.vehicle?.name].filter(Boolean).join(' · ');

  return (
    <FormSheet testID="done-lesson-sheet" title={<Text style={s.navTitle}>{longDay(lesson.startsAt)}</Text>}>
      {road ? (
        <Animated.View entering={MAP_IN}>
          <Pressable
            onPress={() => {
              roadRouteMapStore.set(road);
              router.push('/(tabs)/guide/road-map');
            }}
            accessibilityRole="button"
            accessibilityLabel="Apri la mappa del percorso"
            testID="done-lesson-map"
            style={s.mapCard}
          >
            <RoadRouteMap track={road.track} markers={road.markers} stops={road.stops} style={s.map} />
          </Pressable>
        </Animated.View>
      ) : null}

      <View style={road ? s.headWithMap : s.head}>
        <Text style={s.title}>{title}</Text>
        <Text style={s.meta}>{meta}</Text>
        {statusLine ? <Text style={[s.status, { color: statusLine.color }]}>{statusLine.label}</Text> : null}
      </View>

      {road ? (
        <Animated.View entering={MAP_IN} style={s.stats}>
          <Stat value={`${formatKm(road.distanceMeters)} km`} label="percorsi" />
          <Stat value={`${formatMinutes(road.durationSec)} min`} label="alla guida" />
          <Stat value={String(review.length)} label="da rivedere" />
        </Animated.View>
      ) : null}

      {payment ? (
        <HomeSection title="Pagamento">
          {payment === 'due' ? (
            <FlatRow first strong title="Da pagare" subtitle="Saldala in segreteria" />
          ) : (
            <FlatRow first title="Pagata" subtitle={paidHow(lesson)} />
          )}
        </HomeSection>
      ) : null}

      {review.length ? (
        <HomeSection title="Lungo il percorso">
          {review.map((m, i) => (
            <FlatRow
              key={m.id}
              first={i === 0}
              leading={
                <View style={s.num}>
                  <Text style={s.numTx}>{i + 1}</Text>
                </View>
              }
              title={m.label}
              subtitle={m.street}
            />
          ))}
        </HomeSection>
      ) : null}

      {evaluations.length ? (
        <HomeSection title="Valutazione" footer="Le vedi perché la tua autoscuola le condivide.">
          {evaluations.map((e, i) => (
            <FlatRow key={e.itemId} first={i === 0} title={e.label} value={scoreWord(e.score as number, e.scaleMax)} />
          ))}
        </HomeSection>
      ) : null}
    </FormSheet>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  navTitle: { fontSize: 17, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.3 },
  mapCard: { height: 210, borderRadius: 28, overflow: 'hidden', backgroundColor: CLAY.surface, marginTop: 4, ...CLAY_SHADOW.raise },
  map: { flex: 1 },
  head: { paddingTop: 4 },
  headWithMap: { paddingTop: 18 },
  title: { fontSize: 26, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.6 },
  meta: { fontSize: 16, color: CLAY.ink2, marginTop: 3 },
  status: { fontSize: 15, fontWeight: '500', marginTop: 4 },
  stats: { flexDirection: 'row', gap: 22, marginTop: 14 },
  statValue: { fontSize: 22, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.5 },
  statLabel: { fontSize: 13, color: CLAY.ink3 },
  num: { width: 26, height: 26, borderRadius: 13, backgroundColor: CLAY.ink, alignItems: 'center', justifyContent: 'center', ...CLAY_SHADOW.ink },
  numTx: { fontSize: 13, fontWeight: '600', color: '#FFFFFF' },
});
