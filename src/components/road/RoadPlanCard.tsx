import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import type { RoadPlan, RoadPlanStop } from '../../types/regloApi';
import { CLAY } from '../../theme/clay';
import { ClaySurface } from '../clay/ClaySurface';
import { ClayToggle } from '../clay/ClayToggle';
import { SkeletonBlock } from '../Skeleton';
import { SEGMENT_TIMING } from '../../utils/motion';
import { usePlan, usePlanChoice } from '../../road/planStore';

/**
 * REG-649 Reglo Road — «Il giro» nei fogli di partenza (tab Road, invito,
 * foglio della guida, «Avvia guida»).
 *
 * Una card clay: «Il giro · circa N min», le tappe numerate in ordine (via o
 * percorso d'esame, il motivo, i minuti di strada) e in fondo «Segui il giro»
 * con l'interruttore: spento = senza giro (le tappe restano, attenuate,
 * così la card non cambia altezza). Il numero è lo stesso del segnaposto
 * sulla mappa. Niente pillole: motivi e minuti sono righe secondarie.
 *
 * Il giro arriva già scaricato (`planStore`, §15.8): qui nessuna chiamata.
 * Non c'è niente da mostrare (interruttore spento, nessuna tappa, rete giù)
 * → la card non c'è.
 */
export const RoadPlanCard = React.memo(function RoadPlanCard({
  studentId,
  durationMin,
  style,
  testID = 'road-plan',
}: {
  studentId: string | null | undefined;
  durationMin: number;
  style?: object;
  testID?: string;
}) {
  const res = usePlan(studentId, durationMin);
  const [on, setOn] = usePlanChoice(studentId);
  if (res === undefined) return studentId ? <PlanSkeleton style={style} /> : null;
  const plan = res?.plan;
  if (!plan?.stops.length) return null;
  return <PlanBody plan={plan} on={on} onToggle={setOn} style={style} testID={testID} />;
});

/**
 * Tab Road, nel briefing di ogni volto: il giro in una riga («Il giro · Via
 * Roma, Via Sacchi · circa 16 min»), le tappe numerate sono sulla mappa. Le
 * tappe per esteso e «Segui il giro» stanno nel foglio dove si parte, così i
 * tre briefing sovrapposti restano bassi (una riga in più al massimo).
 */
export const RoadPlanLine = React.memo(function RoadPlanLine({
  studentId,
  durationMin,
}: {
  studentId: string | null | undefined;
  durationMin: number;
}) {
  const res = usePlan(studentId, durationMin);
  const [on] = usePlanChoice(studentId);
  const stops = res?.plan?.stops ?? [];
  if (!stops.length) return null;
  return (
    <View style={s.line} testID="road-tab-plan">
      <Text style={[s.lineTx, !on && { color: CLAY.ink3 }]} numberOfLines={1}>
        <Text style={s.lineHead}>{on ? 'Il giro' : 'Senza giro'}</Text>
        {' · '}
        {stops.map((x) => x.title).join(', ')}
        {` · circa ${res!.plan!.minutes} min`}
      </Text>
    </View>
  );
});

export function hasPlanStops(plan: RoadPlan | null | undefined) {
  return !!plan?.stops.length;
}

function PlanBody({
  plan,
  on,
  onToggle,
  style,
  testID,
}: {
  plan: RoadPlan;
  on: boolean;
  onToggle: (v: boolean) => void;
  style?: object;
  testID: string;
}) {
  const dim = useSharedValue(on ? 1 : 0.38);
  useEffect(() => {
    dim.value = withTiming(on ? 1 : 0.38, SEGMENT_TIMING);
  }, [on, dim]);
  const fade = useAnimatedStyle(() => ({ opacity: dim.value }));
  return (
    <ClaySurface style={[s.card, style]} testID={testID}>
      <Animated.View style={fade}>
        <Text style={s.title}>
          Il giro <Text style={s.titleMeta}>· circa {plan.minutes} min</Text>
        </Text>
        {plan.stops.map((st, i) => (
          <StopRow key={st.key} stop={st} index={i} />
        ))}
      </Animated.View>
      <View style={s.toggleRow}>
        <Text style={s.toggleTx}>Segui il giro</Text>
        <ClayToggle value={on} onValueChange={onToggle} accessibilityLabel="Segui il giro" testID={`${testID}-toggle`} />
      </View>
    </ClaySurface>
  );
}

const StopRow = React.memo(function StopRow({ stop, index }: { stop: RoadPlanStop; index: number }) {
  return (
    <View style={[s.row, index > 0 && s.sep]} testID="road-plan-stop">
      <View style={s.num}>
        <Text style={s.numTx}>{index + 1}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.stopTitle} numberOfLines={1}>{stop.title}</Text>
        <Text style={s.reason} numberOfLines={2}>{stop.reason}</Text>
      </View>
      {stop.minutes > 0 ? <Text style={s.minutes}>{stop.minutes} min</Text> : null}
    </View>
  );
});

/** Stessa forma della card (titolo + due tappe + interruttore): all'arrivo non salta niente. */
function PlanSkeleton({ style }: { style?: object }) {
  return (
    <ClaySurface style={[s.card, style]} testID="road-plan-skeleton">
      <SkeletonBlock width="46%" height={17} radius={6} />
      {[0, 1].map((i) => (
        <View key={i} style={[s.row, i > 0 && s.sep]}>
          <SkeletonBlock width={26} height={26} radius={13} />
          <View style={{ flex: 1, gap: 6 }}>
            <SkeletonBlock width="62%" height={14} radius={5} />
            <SkeletonBlock width="84%" height={12} radius={5} />
          </View>
        </View>
      ))}
      <View style={s.toggleRow}>
        <SkeletonBlock width={96} height={15} radius={5} />
        <SkeletonBlock width={50} height={30} radius={15} />
      </View>
    </ClaySurface>
  );
}

const s = StyleSheet.create({
  card: { marginTop: 14 },
  line: { marginTop: 12, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: CLAY.hairline },
  lineTx: { fontSize: 14.5, fontWeight: '400', color: CLAY.ink2, letterSpacing: -0.15 },
  lineHead: { fontWeight: '600', color: CLAY.ink },
  title: { fontSize: 15, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.2, marginBottom: 4 },
  titleMeta: { fontWeight: '400', color: CLAY.ink3 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 10 },
  sep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: CLAY.hairline },
  // Lo stesso numero del segnaposto sulla mappa: nero, cifra bianca.
  num: { marginTop: -1, width: 26, height: 26, borderRadius: 13, backgroundColor: CLAY.ink, alignItems: 'center', justifyContent: 'center' },
  numTx: { color: '#FFFFFF', fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
  stopTitle: { fontSize: 15, fontWeight: '500', color: CLAY.ink, letterSpacing: -0.2 },
  reason: { fontSize: 13.5, fontWeight: '400', color: CLAY.ink3, marginTop: 2, lineHeight: 18 },
  minutes: { fontSize: 13.5, fontWeight: '500', color: CLAY.ink3, fontVariant: ['tabular-nums'], marginTop: 2 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: CLAY.hairline,
  },
  toggleTx: { fontSize: 15, fontWeight: '500', color: CLAY.ink, letterSpacing: -0.2 },
});
