import React, { useEffect } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { FormSheet } from '../SheetScaffold';
import { ClayButton, ClayList, ClayListRow } from '../clay';
import { CLAY, CLAY_SHADOW } from '../../theme/clay';
import { ROAD_EXAM_ART } from '../../road/markerArt';
import { formatKm, formatMinutes } from '../../road/format';
import type { RoadDetail } from '../../types/regloApi';
import { RoadRouteMap } from './RoadMiniMap';

const MONTHS = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
const EXAM_INK = '#8B5CF6';
const IN_MS = 260;
const EASE = Easing.out(Easing.cubic);

/** Quattro scintille leggere (viola e ambra) attorno alla bandiera, niente coriandoli. */
const SPARKS = [
  { left: -44, top: 14, size: 7, color: 'rgba(139,92,246,0.5)', delay: 60 },
  { left: 70, top: 4, size: 5, color: 'rgba(245,165,36,0.7)', delay: 120 },
  { left: 84, top: 62, size: 6, color: 'rgba(139,92,246,0.35)', delay: 160 },
  { left: -54, top: 70, size: 5, color: 'rgba(245,165,36,0.5)', delay: 200 },
];

function Spark({ left, top, size, color, delay }: (typeof SPARKS)[number]) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(delay, withTiming(1, { duration: IN_MS, easing: EASE, reduceMotion: ReduceMotion.Never }));
  }, [p, delay]);
  const st = useAnimatedStyle(() => ({ opacity: p.value, transform: [{ scale: 0.6 + 0.4 * p.value }] }));
  return <Animated.View style={[s.spark, { left, top, width: size, height: size, borderRadius: size / 2, backgroundColor: color }, st]} />;
}

/**
 * R4 Road Exam — fine registrazione (anteprima approvata da Tiziano il
 * 10/11/2026): un piccolo momento di gioia, misurato. Bandiera a scacchi 3D
 * che entra morbida (da 0,92 a 1 in 260 ms, senza rimbalzo) e quattro
 * scintille; poi il percorso salvato con la linea viola dell'esame, chi è
 * l'esaminatore, km e minuti, luogo. Il percorso d'esame lo crea il server.
 */
export function ExamSaved({ summary, onClose }: { summary: RoadDetail; onClose: () => void }) {
  const exam = summary.lesson.exam ?? null;
  const examiners = exam?.examiners?.length ? exam.examiners : summary.examiners ?? [];
  const who = examiners.join(', ');
  const d = new Date(summary.lesson.startsAt);
  const name = `Esame ${d.getDate()} ${MONTHS[d.getMonth()]}${who ? ` · ${who}` : ''}`;
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withTiming(1, { duration: IN_MS, easing: EASE, reduceMotion: ReduceMotion.Never });
  }, [p]);
  const flag = useAnimatedStyle(() => ({ opacity: p.value, transform: [{ scale: 0.92 + 0.08 * p.value }] }));

  return (
    <FormSheet
      onClose={onClose}
      closeOnGesture
      testID="road-exam-saved"
      cta={<ClayButton title="Fine" onPress={onClose} testID="road-exam-saved-close" />}
    >
      <View style={s.head}>
        <View>
          <Animated.View style={flag}>
            <Image source={ROAD_EXAM_ART.bandiera} style={s.flag} resizeMode="contain" />
          </Animated.View>
          {SPARKS.map((sp, i) => (
            <Spark key={i} {...sp} />
          ))}
        </View>
        <Text style={s.title}>Percorso salvato</Text>
        <Text style={s.sub} numberOfLines={1}>
          {name}
        </Text>
      </View>

      <View style={[s.mapWrap, CLAY_SHADOW.raise]}>
        <RoadRouteMap track={summary.track} markers={[]} stops={[]} ink={EXAM_INK} style={s.map} />
      </View>

      <ClayList style={s.block}>
        <ClayListRow title={examiners.length > 1 ? 'Esaminatori' : 'Esaminatore'} trailing={<Text style={s.value}>{who || 'Non scritto'}</Text>} />
        <ClayListRow
          title="Percorso"
          trailing={<Text style={s.value}>{`${formatKm(summary.distanceMeters)} km · ${formatMinutes(summary.durationSec)} min`}</Text>}
        />
        {exam?.place ? <ClayListRow title="Luogo" trailing={<Text style={s.value} numberOfLines={1}>{exam.place}</Text>} /> : null}
      </ClayList>
      <Text style={s.note}>
        {who ? `Lo trovi in Road › Percorsi d'esame, sotto ${who}.` : "Lo trovi in Road › Percorsi d'esame: il titolare lo assegna a un esaminatore."}
      </Text>
    </FormSheet>
  );
}

const s = StyleSheet.create({
  head: { alignItems: 'center', paddingTop: 2 },
  flag: { width: 96, height: 96 },
  spark: { position: 'absolute' },
  title: { fontSize: 24, fontWeight: '600', letterSpacing: -0.5, color: CLAY.ink, marginTop: 8, textAlign: 'center' },
  sub: { fontSize: 14.5, color: CLAY.ink3, marginTop: 2, textAlign: 'center' },
  mapWrap: { height: 170, borderRadius: 22, marginTop: 16, backgroundColor: CLAY.surface },
  map: { flex: 1, borderRadius: 22, overflow: 'hidden' },
  block: { marginTop: 14 },
  value: { fontSize: 15, color: CLAY.ink3, maxWidth: 210 },
  note: { fontSize: 12.5, lineHeight: 17, color: '#8E8E8E', marginTop: 12 },
});
