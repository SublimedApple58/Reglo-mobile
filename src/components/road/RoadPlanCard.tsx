import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { InteractionManager, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import type { RoadPlanStop } from '../../types/regloApi';
import { CLAY } from '../../theme/clay';
import { ClaySurface } from '../clay/ClaySurface';
import { ClayToggle } from '../clay/ClayToggle';
import { SkeletonBlock } from '../Skeleton';
import { SOFT } from '../../utils/motion';

/** Dissolvenza della miniatura: 240 ms, senza rimbalzo, mai spenta da «Riduci movimento». */
const THUMB_FADE = { duration: 240, easing: SOFT, reduceMotion: ReduceMotion.Never } as const;
import {
  hasPlanOverride,
  planMinutesFor,
  planStopLabel,
  prefetchPlanRoute,
  prefetchSavedPlan,
  usePlan,
  retryPlan,
  usePlanChoice,
  usePlanFailed,
  usePlanRoute,
} from '../../road/planStore';
import { roadFreeStore, warmRoadFree } from '../../road/freeStartStore';
import { GIRO_SHEET_ROUTE, giroSheetStore } from '../../road/giroSheetStore';
import { orderGuideStops } from '../../road/roadGuide';
import { RoadPlanMap } from './RoadPlanMap';

/**
 * REG-649/667/669 Reglo Road — il giro di una guida.
 *
 * Il giro arriva già scaricato (`planStore`, §15.8): qui nessuna chiamata al
 * tocco. Non c'è niente da mostrare (nessuna tappa, rete giù) → niente card.
 */
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

/**
 * REG-667 — il giro nel dettaglio di una guida futura, in una riga sola (QA
 * 30/10: la lista delle tappe riempiva il dettaglio): miniatura con la linea e
 * le tappe numerate, «Il giro · circa N min» e le tappe in breve; sotto «Segui
 * il giro». Tocco sulla riga = foglio «Il giro» con mappa grande e tappe
 * modificabili. Linea e sede arrivano all'apertura del dettaglio, mai al tocco.
 *
 * REG-669: la stessa riga nel foglio «Entri in modalità Road?» (con la guida:
 * giro salvato e foglio modificabile) e in «Avvia guida» (senza guida in
 * agenda: sola anteprima, niente su cui salvare → niente tocco né freccia).
 */
export const RoadPlanRow = React.memo(function RoadPlanRow({
  appointmentId,
  studentId,
  studentName,
  durationMin,
  style,
  testID = 'road-plan-row',
}: {
  /** La guida. Senza = partenza libera: sola anteprima. */
  appointmentId?: string | null;
  studentId: string | null | undefined;
  studentName?: string | null;
  durationMin: number;
  style?: object;
  testID?: string;
}) {
  const router = useRouter();
  const res = usePlan(studentId, durationMin, appointmentId);
  const failed = usePlanFailed(studentId, durationMin);
  const [on, setOn] = usePlanChoice(studentId);
  const free = useSyncExternalStore(roadFreeStore.subscribe, roadFreeStore.get);
  const hq = free?.headquarters ?? null;
  const start = hq ? { lat: hq.lat, lng: hq.lng } : null;
  const plan = res?.plan ?? null;
  const stops = plan?.stops ?? null;
  // Giro modificato dall'istruttore: il suo ordine, niente riottimizzazione.
  const custom = hasPlanOverride(appointmentId);
  const route = usePlanRoute(start, stops, !custom);
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      if (!free) warmRoadFree();
      prefetchSavedPlan(appointmentId);
      if (start && stops?.length) void prefetchPlanRoute(start, stops, !custom);
    });
    return () => task.cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [free, start?.lat, start?.lng, stops, custom]);

  if (res === undefined) return studentId ? <PlanSkeleton style={style} /> : null;
  if (failed && studentId) {
    return (
      <ClaySurface padded={false} style={[s.rowCard, style]} testID={`${testID}-error`}>
        <Pressable
          onPress={() => retryPlan(studentId, durationMin)}
          style={({ pressed }) => [s.rowMain, pressed && s.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Riprova a caricare il giro"
          testID={`${testID}-retry`}
        >
          <View style={s.rowText}>
            <Text style={s.title}>Giro non caricato</Text>
            <Text style={s.rowStop}>Si parte senza giro. Tocca per riprovare.</Text>
          </View>
          <Ionicons name="refresh" size={17} color={CLAY.ink3} />
        </Pressable>
      </ClaySurface>
    );
  }
  if (!plan?.stops.length) return null;
  const ordered = custom ? plan.stops : orderGuideStops(plan.stops, route?.order);
  const minutes = planMinutesFor(route?.lengthMeters, ordered.length) ?? plan.minutes;
  const open = () => {
    if (!studentId || !appointmentId) return;
    giroSheetStore.set({ appointmentId, studentId, durationMin, studentName });
    router.push(GIRO_SHEET_ROUTE as never);
  };
  const editable = !!appointmentId;
  return (
    <ClaySurface padded={false} style={[s.rowCard, style]} testID={testID}>
      <Pressable
        onPress={open}
        disabled={!editable}
        style={({ pressed }) => [s.rowMain, pressed && s.pressed]}
        accessibilityRole={editable ? 'button' : undefined}
        accessibilityLabel={editable ? 'Apri il giro' : undefined}
        testID={`${testID}-open`}
      >
        <PlanThumb line={route?.line} stops={ordered} start={start} lineReady={route !== undefined} dimmed={!on} />
        <View style={[s.rowText, !on && s.dim]}>
          <Text style={s.title} numberOfLines={1}>
            Il giro <Text style={s.titleMeta}>· circa {minutes} min</Text>
          </Text>
          {ordered.map((st, i) => (
            <Text key={st.key} style={s.rowStop} numberOfLines={1}>
              {i + 1}  {planStopLabel(st)}
            </Text>
          ))}
        </View>
        {editable ? <Ionicons name="chevron-forward" size={17} color="#B9B9B9" /> : null}
      </Pressable>
      <View style={s.rowToggle}>
        <Text style={s.toggleTx}>Segui il giro</Text>
        <ClayToggle value={on} onValueChange={setOn} accessibilityLabel="Segui il giro" testID={`${testID}-toggle`} />
      </View>
    </ClaySurface>
  );
});

/** Stessa forma della riga (miniatura, titolo, due tappe, interruttore): all'arrivo non salta niente. */
function PlanSkeleton({ style }: { style?: object }) {
  return (
    <ClaySurface padded={false} style={[s.rowCard, style]} testID="road-plan-skeleton">
      <View style={s.rowMain}>
        <SkeletonBlock width={92} height={92} radius={16} />
        <View style={[s.rowText, { gap: 8 }]}>
          <SkeletonBlock width="58%" height={15} radius={5} />
          <SkeletonBlock width="74%" height={13} radius={5} />
          <SkeletonBlock width="66%" height={13} radius={5} />
        </View>
      </View>
      <View style={s.rowToggle}>
        <SkeletonBlock width={96} height={15} radius={5} />
        <SkeletonBlock width={50} height={30} radius={15} />
      </View>
    </ClaySurface>
  );
}

/**
 * La miniatura: skeleton finché la mappa non è pronta e la linea non è
 * arrivata (o non c'è), poi la mappa entra in dissolvenza (240 ms, senza
 * rimbalzo). La mappa si monta subito, invisibile, così carica intanto.
 */
function PlanThumb({
  line,
  stops,
  start,
  lineReady,
  dimmed,
}: {
  line: Array<[number, number]> | null | undefined;
  stops: RoadPlanStop[];
  start: { lat: number; lng: number } | null;
  lineReady: boolean;
  dimmed: boolean;
}) {
  const [mapReady, setMapReady] = useState(false);
  // Se la mappa non avvisa (Android liteMode), dopo poco si mostra comunque.
  useEffect(() => {
    const t = setTimeout(() => setMapReady(true), 1500);
    return () => clearTimeout(t);
  }, []);
  const shown = mapReady && lineReady;
  const fade = useSharedValue(0);
  useEffect(() => {
    if (shown) fade.value = withTiming(1, THUMB_FADE);
  }, [shown, fade]);
  const style = useAnimatedStyle(() => ({ opacity: fade.value }));
  return (
    <View style={[s.thumb, dimmed && s.dim]} pointerEvents="none" testID="road-plan-thumb">
      {!shown ? <SkeletonBlock width={92} height={92} radius={16} style={StyleSheet.absoluteFill} /> : null}
      <Animated.View style={[StyleSheet.absoluteFill, style]}>
        <RoadPlanMap line={line} stops={stops} start={start} small onReady={() => setMapReady(true)} />
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  line: { marginTop: 12, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: CLAY.hairline },
  lineTx: { fontSize: 14.5, fontWeight: '400', color: CLAY.ink2, letterSpacing: -0.15 },
  lineHead: { fontWeight: '600', color: CLAY.ink },
  title: { fontSize: 15, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.2, marginBottom: 4 },
  titleMeta: { fontWeight: '400', color: CLAY.ink3 },
  toggleTx: { fontSize: 15, fontWeight: '500', color: CLAY.ink, letterSpacing: -0.2 },
  rowCard: { marginTop: 14 },
  rowMain: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, paddingRight: 16 },
  pressed: { opacity: 0.7 },
  thumb: { width: 92, height: 92, borderRadius: 16, overflow: 'hidden', backgroundColor: '#F2F1EE' },
  dim: { opacity: 0.4 },
  rowText: { flex: 1, minWidth: 0, gap: 3 },
  rowStop: { fontSize: 14, color: CLAY.ink3, letterSpacing: -0.1 },
  rowToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: CLAY.hairline,
  },
});
