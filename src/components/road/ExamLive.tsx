import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { CLAY, CLAY_EXAM, CLAY_SHADOW } from '../../theme/clay';
import { formatKm } from '../../road/format';
import { useRoadSelector } from '../../road/roadStore';
import { ExamCta } from './ExamCta';

/**
 * R4 Road Exam in guida — variante B scelta da Tiziano (10/11/2026): base
 * bianca clay come Road; card in alto neutra; nel pannello in basso il viola
 * dice «sei in modalità esame»: pallino che pulsa piano, cifre e CTA viola.
 * Solo il tracciato: niente «Segnala», pagellino, note.
 */

/** Card in alto: «Esame · 3 allievi», esaminatori e luogo. */
export function ExamTopCard({ top }: { top: number }) {
  const exam = useRoadSelector((s) => s.session?.lesson?.exam ?? null);
  const examiners = useRoadSelector((s) => s.session?.examiners);
  const n = exam?.studentCount ?? 0;
  const who = (exam?.examiners?.length ? exam.examiners : examiners ?? []).join(', ');
  const sub = [who, exam?.place].filter(Boolean).join(' · ');
  return (
    <View pointerEvents="none" style={[s.top, CLAY_SHADOW.raise, { top }]} testID="road-exam-top">
      <Text style={s.topTitle} numberOfLines={1}>
        {n === 1 ? 'Esame · 1 allievo' : n > 1 ? `Esame · ${n} allievi` : 'Esame di guida'}
      </Text>
      {sub ? (
        <Text style={s.topSub} numberOfLines={1}>
          {sub}
        </Text>
      ) : null}
    </View>
  );
}

const PULSE_MS = 1600;
const EASE = Easing.inOut(Easing.quad);

/** Il pallino di registrazione: alone che si allarga e sfuma, piano. */
function RecDot() {
  const p = useSharedValue(0);
  useEffect(() => {
    // «Riduci movimento» non spegne niente (regola fissa).
    p.value = withRepeat(withTiming(1, { duration: PULSE_MS, easing: EASE, reduceMotion: ReduceMotion.Never }), -1, false);
  }, [p]);
  const halo = useAnimatedStyle(() => ({ opacity: 0.45 * (1 - p.value), transform: [{ scale: 1 + p.value * 1.4 }] }));
  return (
    <View style={s.rec}>
      <Animated.View style={[s.recHalo, halo]} />
      <View style={s.recDot} />
    </View>
  );
}

const NUM_IN = FadeIn.duration(200).easing(Easing.out(Easing.cubic)).reduceMotion(ReduceMotion.Never);

/** Cifra che cambia in dissolvenza (200 ms), niente salti di botto. */
function Num({ value, unit, label }: { value: string; unit: string; label: string }) {
  return (
    <View>
      <View style={s.numRow}>
        <Animated.Text key={value} entering={NUM_IN} style={s.num}>
          {value}
        </Animated.Text>
        <Text style={s.unit}>{unit}</Text>
      </View>
      <Text style={s.label}>{label}</Text>
    </View>
  );
}

/** Pannello in basso: pallino, km e minuti registrati, «Termina registrazione». */
export function ExamPanel({
  onLayoutH,
  onTermina,
  ending,
  insetsBottom,
}: {
  onLayoutH: (h: number) => void;
  onTermina: () => void;
  ending: boolean;
  insetsBottom: number;
}) {
  const startedAt = useRoadSelector((s) => s.session?.startedAt ?? null);
  const distance = useRoadSelector((s) => s.distanceMeters);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);
  const minutes = startedAt ? Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 60_000)) : 0;
  return (
    <View
      style={[s.panel, CLAY_SHADOW.raise, { paddingBottom: Math.max(16, insetsBottom) }]}
      onLayout={(e) => onLayoutH(e.nativeEvent.layout.height)}
      testID="road-exam-panel"
    >
      <View style={s.recRow}>
        <RecDot />
        <Text style={s.recTx}>Registro il percorso</Text>
      </View>
      <View style={s.nums}>
        <Num value={formatKm(distance)} unit="km" label="Percorso" />
        <Num value={String(minutes)} unit="min" label="Registrati" />
      </View>
      <ExamCta title="Termina registrazione" loading={ending} onPress={onTermina} style={s.cta} testID="road-exam-end" />
    </View>
  );
}

const s = StyleSheet.create({
  top: {
    position: 'absolute',
    left: 12,
    right: 12,
    borderRadius: 24,
    backgroundColor: CLAY.surface,
    paddingVertical: 12,
    paddingHorizontal: 18,
  },
  topTitle: { fontSize: 17, fontWeight: '600', letterSpacing: -0.3, color: CLAY.ink },
  topSub: { fontSize: 13.5, color: CLAY.ink3, marginTop: 1 },
  panel: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 8,
    borderRadius: 36,
    backgroundColor: CLAY.surface,
    paddingTop: 20,
    paddingHorizontal: 22,
  },
  recRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rec: { width: 7, height: 7, alignItems: 'center', justifyContent: 'center' },
  recHalo: { position: 'absolute', width: 15, height: 15, borderRadius: 8, backgroundColor: 'rgba(139,92,246,0.35)' },
  recDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#8B5CF6' },
  recTx: { fontSize: 13, fontWeight: '600', color: CLAY_EXAM.ink2 },
  nums: { flexDirection: 'row', gap: 34, marginTop: 12 },
  numRow: { flexDirection: 'row', alignItems: 'baseline' },
  num: { fontSize: 30, fontWeight: '600', letterSpacing: -0.8, color: CLAY_EXAM.ink, fontVariant: ['tabular-nums'] },
  unit: { fontSize: 15, fontWeight: '500', color: CLAY_EXAM.label, marginLeft: 2 },
  label: { fontSize: 13, color: CLAY_EXAM.label, marginTop: 1 },
  cta: { marginTop: 18 },
});
