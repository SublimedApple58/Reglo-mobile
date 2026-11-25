import React, { useMemo, useState, useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { FormSheet } from '../components/SheetScaffold';
import { ClaySurface, Icon3D } from '../components/clay';
import { SkeletonBlock } from '../components/Skeleton';
import { RoadRouteMap } from '../components/road/RoadMiniMap';
import {
  EvaluationLine,
  EvaluationRows,
  evaluationHeadline,
  firstName,
  InstructorRow,
  LESSON_ART,
  LessonHero,
  LessonPlaceRow,
  MarkerRows,
  VehicleRow,
} from '../components/studentLesson/LessonSheetParts';
import { useSession } from '../context/SessionContext';
import { regloApi } from '../services/regloApi';
import { roadRouteMapStore } from '../road/routeMapStore';
import { formatKm, formatMinutes } from '../road/format';
import { DoneLessonData, doneLessonStore } from '../stores/doneLessonStore';
import { CLAY } from '../theme/clay';
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
  timeRangeWords,
} from '../utils/studentLessons';
import type { RoadDetail } from '../types/regloApi';

const IN = FadeIn.duration(220).reduceMotion(ReduceMotion.Never);
const MAP_H = 236;

export const roadForAppointmentKey = (companyId: string | null, appointmentId: string) =>
  ['road-appointment', companyId, appointmentId] as const;

/** La traccia della guida per l'allievo: `null` se Road non c'era o non è condiviso. */
export const fetchRoadForAppointment = async (appointmentId: string): Promise<RoadDetail | null> => {
  const d = await regloApi.getRoadForAppointment(appointmentId);
  return d && d.track?.length ? d : null;
};

/** Rotta della tab Guide: il seed arriva da `doneLessonStore`. */
export function StudentDoneLessonSheet() {
  const live = useSyncExternalStore(doneLessonStore.subscribe, doneLessonStore.get);
  // Il seed vale per tutta la vita del foglio: chi apre un'altra guida dopo non lo cambia sotto.
  const [data] = useState(() => live);
  if (!data) return <FormSheet />;
  return <DoneLessonSheetView data={data} stack="guide" />;
}

/**
 * REG-789 — foglio della guida passata, direzione B «protagonista» (Tiziano,
 * 25/11/2026). UNA cosa grande per caso:
 * - percorso Road (solo se Road è acceso e l'autoscuola condivide i percorsi:
 *   lo decide il server, altrimenti risponde null) → mappa in card + numeri,
 *   poi «Da ripassare» / «Fatto bene» a righe con le icone 3D, il pagellino;
 * - senza Road e da pagare → il salvadanaio grande;
 * - senza Road con il pagellino → la stella con la frase («Bene in 3 voci su 4»);
 * - altrimenti → l'auto 3D con tipo e durata.
 * Il resto (istruttore, auto, luogo, pagamento) a righe. Usata anche dal
 * dettaglio guida aperto dalle note (`lesson-detail` per le guide passate).
 */
export function DoneLessonSheetView({ data, stack }: { data: DoneLessonData; stack: 'home' | 'guide' }) {
  const router = useRouter();
  const { activeCompanyId } = useSession();
  const { lesson, manualMode, roadVisible } = data;
  const status = lessonStatus(lesson);

  const roadEnabled = roadVisible && status === 'completed';
  const roadQuery = useQuery({
    queryKey: roadForAppointmentKey(activeCompanyId, lesson.id),
    queryFn: () => fetchRoadForAppointment(lesson.id),
    enabled: roadEnabled,
    staleTime: 10 * 60 * 1000,
  });
  const road = roadQuery.data ?? null;
  const roadLoading = roadEnabled && roadQuery.isLoading;

  const { review, good } = useMemo(() => {
    const markers = road?.markers ?? [];
    return { review: markers.filter((m) => m.sentiment !== 'good'), good: markers.filter((m) => m.sentiment === 'good') };
  }, [road]);
  const evaluations = useMemo<EvaluationLine[]>(
    () =>
      (lesson.evaluations ?? [])
        .filter((e) => !e.notApplicable && e.score != null)
        .map((e) => ({ key: e.itemId, label: e.label, score: e.score as number, scaleMax: e.scaleMax })),
    [lesson],
  );

  const payment = lessonPayment(lesson, manualMode);
  const statusLine = LESSON_STATUS_LINE[status] ?? null;
  const minutes = lessonMinutes(lesson);
  const typeWord = lessonTypeWord(lesson);
  const subtitle = [typeWord, timeRangeWords(lesson)].filter(Boolean).join(' · ');
  const teacher = firstName(lesson.instructor?.name);

  const paymentRows = payment ? (
    payment === 'due' ? (
      <FlatRow first strong title="Da pagare" subtitle="Saldala in segreteria" />
    ) : (
      <FlatRow first title="Pagata" subtitle={paidHow(lesson)} />
    )
  ) : null;

  const detailRows = (
    <>
      <InstructorRow first instructor={lesson.instructor} subtitle={durationWords(minutes) ?? 'Istruttore'} />
      {lesson.vehicle ? <VehicleRow vehicle={lesson.vehicle} /> : null}
      {lesson.location ? <LessonPlaceRow location={lesson.location} /> : null}
    </>
  );

  const openMap = () => {
    if (!road) return;
    roadRouteMapStore.set(road);
    router.push(`/(tabs)/${stack}/road-map`);
  };

  let body: React.ReactNode;
  if (roadLoading || road) {
    // ── Con Road: il percorso è il protagonista ──
    body = (
      <>
        <ClaySurface padded={false} style={s.mapCard}>
          <View style={s.mapClip}>
            {road ? (
              <Animated.View entering={IN}>
                <Pressable
                  onPress={openMap}
                  accessibilityRole="button"
                  accessibilityLabel="Apri la mappa del percorso"
                  testID="done-lesson-map"
                >
                  <RoadRouteMap track={road.track} markers={road.markers} stops={road.stops} style={s.map} />
                </Pressable>
                <View style={s.stats}>
                  <Stat value={`${formatKm(road.distanceMeters)} km`} label="percorsi" />
                  <Stat value={`${formatMinutes(road.durationSec)} min`} label="alla guida" />
                  <Stat value={String(review.length)} label="da ripassare" />
                </View>
              </Animated.View>
            ) : (
              <View>
                <SkeletonBlock height={MAP_H} radius={0} />
                <View style={s.stats}>
                  <SkeletonBlock width={70} height={34} />
                  <SkeletonBlock width={70} height={34} />
                  <SkeletonBlock width={70} height={34} />
                </View>
              </View>
            )}
          </View>
        </ClaySurface>
        {statusLine ? <Text style={[s.statusLine, { color: statusLine.color }]}>{statusLine.label}</Text> : null}
        {payment === 'due' ? <HomeSection title="Pagamento">{paymentRows}</HomeSection> : null}
        {review.length ? (
          <HomeSection title="Da ripassare">
            <MarkerRows markers={review} withTime onPress={openMap} />
          </HomeSection>
        ) : null}
        {good.length ? (
          <HomeSection title="Fatto bene">
            <MarkerRows markers={good} />
          </HomeSection>
        ) : null}
        {evaluations.length ? (
          <HomeSection title={teacher ? `Il pagellino di ${teacher}` : 'Pagellino'}>
            <EvaluationRows items={evaluations} />
          </HomeSection>
        ) : null}
        {payment === 'paid' ? <View style={s.tail}>{paymentRows}</View> : null}
      </>
    );
  } else if (payment === 'due') {
    // ── Senza Road, da pagare: il pagamento è il protagonista ──
    body = (
      <>
        <LessonHero art={LESSON_ART.salvadanaio} size={112} title="Da pagare" subtitle="Saldala in segreteria." />
        {statusLine ? <Text style={[s.statusLine, s.center, { color: statusLine.color }]}>{statusLine.label}</Text> : null}
        <View style={s.rows}>{detailRows}</View>
        {evaluations.length ? (
          <HomeSection title={teacher ? `Il pagellino di ${teacher}` : 'Pagellino'}>
            <EvaluationRows items={evaluations} />
          </HomeSection>
        ) : null}
      </>
    );
  } else if (evaluations.length) {
    // ── Senza Road, con il pagellino: com'è andata ──
    body = (
      <>
        <LessonHero
          art={LESSON_ART.stella}
          size={64}
          title={evaluationHeadline(evaluations)}
          subtitle={teacher ? `Il pagellino di ${teacher}` : 'Il tuo pagellino'}
        />
        <ClaySurface padded={false} style={s.evalCard}>
          <View style={s.evalClip}>
            <EvaluationRows items={evaluations} />
          </View>
        </ClaySurface>
        {statusLine ? <Text style={[s.statusLine, { color: statusLine.color }]}>{statusLine.label}</Text> : null}
        <View style={s.rows}>
          {detailRows}
          {paymentRows ? <View style={s.divided}>{paymentRows}</View> : null}
        </View>
      </>
    );
  } else {
    // ── Senza Road né pagellino: la guida stessa ──
    body = (
      <>
        <LessonHero
          art={LESSON_ART.auto}
          size={104}
          title={[typeWord, durationWords(minutes)].filter(Boolean).join(' · ')}
          subtitle={statusLine ? null : 'Guida fatta'}
        />
        {statusLine ? <Text style={[s.statusLine, s.center, { color: statusLine.color }]}>{statusLine.label}</Text> : null}
        <View style={s.rows}>
          {detailRows}
          {paymentRows ? <View style={s.divided}>{paymentRows}</View> : null}
        </View>
      </>
    );
  }

  const roadSubtitle = [typeWord, timeRangeWords(lesson), teacher, lesson.vehicle?.name].filter(Boolean).join(' · ');

  return (
    <FormSheet
      testID="done-lesson-sheet"
      title={longDay(lesson.startsAt)}
      subtitle={roadLoading || road ? roadSubtitle : subtitle}
    >
      {body}
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
  mapCard: { marginTop: 6 },
  mapClip: { borderRadius: 28, overflow: 'hidden' },
  map: { height: MAP_H },
  stats: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 16 },
  statValue: { fontSize: 22, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.5 },
  statLabel: { fontSize: 13, color: CLAY.ink3, marginTop: 1 },
  statusLine: { fontSize: 15, fontWeight: '500', marginTop: 14 },
  center: { textAlign: 'center', marginTop: 6 },
  rows: { marginTop: 18 },
  divided: { borderTopWidth: 0.5, borderTopColor: 'rgba(17,17,17,0.12)' },
  tail: { marginTop: 18 },
  evalCard: { marginTop: 18 },
  evalClip: { borderRadius: 28, overflow: 'hidden', paddingHorizontal: 18 },
});
