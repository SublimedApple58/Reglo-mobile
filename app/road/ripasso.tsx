import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { RoadRouteMap, roadMarkerKey } from '../../src/components/road/RoadMiniMap';
import { SentimentBadge, sentimentColor } from '../../src/components/road/RoadSentiment';
import { ExpandableText } from '../../src/components/road/ExpandableText';
import { ClayButton, ClayIconButton } from '../../src/components/clay';
import { CLAY, CLAY_SHADOW } from '../../src/theme';
import { CTA_HEIGHT } from '../../src/theme/spacing';
import { useRoadSelector } from '../../src/road/roadStore';
import { openRoadMarkerSheet } from '../../src/road/markerEdit';
import { markerArt } from '../../src/road/markerArt';
import { formatHm } from '../../src/road/format';
import { ripassoHandoff, ripassoOrder } from '../../src/road/ripasso';
import { SWITCH_IN, SWITCH_OUT, SWITCH_LAYOUT } from '../../src/utils/motion';
import type { RoadMarker } from '../../src/types/regloApi';

/**
 * Parte bassa della mappa coperta dalla card: FISSA (la card più alta), non
 * misurata. La MapView non deve ricevere props che cambiano a ogni scheda:
 * succedeva coi margini legati all'altezza della card e i segnaposti sparivano.
 */
const CARD_COVER = 300;

/**
 * REG-715 — «Ripassa con [allievo]»: a fine guida, dal riepilogo, le
 * segnalazioni una alla volta (prima «da migliorare», poi «fatto bene», in
 * ordine di tempo: `ripassoOrder`). Mappa a tutto schermo zoomata sulla
 * segnalazione, card in basso con simbolo, via, ora e nota; «⋯» corregge sul
 * posto (anche senza rete, REG-714). All'ultima: «Compila il pagellino» (si
 * apre dal riepilogo) oppure «Fine». Non parte mai da solo.
 */
export default function RipassoScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const summary = useRoadSelector((s) => s.summary);
  const evaluationOn = useRoadSelector((s) => s.evaluationEnabled);

  // L'ordine si fissa all'apertura (per clientId): correggere non fa saltare le schede.
  const [order] = useState(() => (summary ? ripassoOrder(summary.markers) : []));
  const markers = summary?.markers;
  const byKey = useMemo(() => new Map((markers ?? []).map((m) => [roadMarkerKey(m), m])), [markers]);
  const steps = useMemo(() => order.filter((k) => byKey.has(k)), [order, byKey]);

  const [idx, setIdx] = useState(0);
  const i = Math.max(0, Math.min(idx, steps.length - 1));
  const current = steps.length ? byKey.get(steps[i]) ?? null : null;
  const last = i === steps.length - 1;

  // Tutte eliminate: niente da ripassare.
  useEffect(() => {
    if (summary && !steps.length) router.back();
  }, [summary, steps.length, router]);

  const goTo = useCallback(
    (next: number) => {
      void Haptics.selectionAsync();
      setIdx(next);
    },
    [],
  );

  const onPin = useCallback(
    (key: string) => {
      const n = steps.indexOf(key);
      if (n >= 0 && n !== i) goTo(n);
    },
    [steps, i, goTo],
  );

  const mapInsets = useMemo(() => ({ top: insets.top + 56, bottom: insets.bottom + 10 + CARD_COVER }), [insets.top, insets.bottom]);

  if (!summary || !current) return <View style={s.root} />;

  const correct = () => openRoadMarkerSheet({ sessionId: summary.id, clientId: current.clientId, live: false });
  const pagellino = () => {
    ripassoHandoff.requestPagellino();
    router.back();
  };

  return (
    <View style={s.root} testID="road-ripasso">
      <RoadRouteMap
        track={summary.track}
        markers={summary.markers}
        stops={summary.stops}
        interactive
        selectedId={roadMarkerKey(current)}
        onPressMarker={onPin}
        insets={mapInsets}
        style={StyleSheet.absoluteFill}
        edgePadding={40}
      />

      <View style={[s.bar, { top: insets.top + 8 }]} pointerEvents="box-none">
        <View style={[s.chip, CLAY_SHADOW.raiseSm]}>
          <Text style={s.chipTx} testID="road-ripasso-count">
            {i + 1} di {steps.length}
          </Text>
        </View>
        <ClayIconButton icon="close" onPress={() => router.back()} accessibilityLabel="Chiudi il ripasso" testID="road-ripasso-close" />
      </View>

      <Animated.View
        layout={SWITCH_LAYOUT}
        style={[s.card, CLAY_SHADOW.raise, { bottom: insets.bottom + 10 }]}
      >
        <Animated.View key={steps[i]} entering={SWITCH_IN} exiting={SWITCH_OUT}>
          <MarkerCard marker={current} onMore={correct} />
        </Animated.View>

        <View style={s.actions}>
          {last ? (
            <>
              <ClayButton
                variant="secondary"
                title="Fine"
                onPress={() => router.back()}
                style={evaluationOn ? s.done : s.flex}
                testID="road-ripasso-done"
              />
              {evaluationOn ? (
                <ClayButton title="Compila il pagellino" onPress={pagellino} style={s.flex} testID="road-ripasso-pagellino" />
              ) : null}
            </>
          ) : (
            <>
              {i > 0 ? (
                <ClayIconButton
                  icon="back"
                  size="lg"
                  onPress={() => goTo(i - 1)}
                  accessibilityLabel="Segnalazione precedente"
                  testID="road-ripasso-prev"
                  style={s.prev}
                />
              ) : null}
              <ClayButton title="Avanti" onPress={() => goTo(i + 1)} style={s.flex} testID="road-ripasso-next" />
            </>
          )}
        </View>
      </Animated.View>
    </View>
  );
}

/** La segnalazione: simbolo 3D col segno, etichetta, via e ora, giudizio, nota. */
function MarkerCard({ marker: m, onMore }: { marker: RoadMarker; onMore: () => void }) {
  const sub = [m.street, formatHm(m.recordedAt)].filter(Boolean).join(' · ');
  return (
    <View>
      <View style={s.head}>
        <View style={s.sy}>
          <Image source={markerArt(m.kind)} style={s.img} resizeMode="contain" />
          {m.sentiment ? <SentimentBadge sentiment={m.sentiment} size={22} style={s.sg} /> : null}
        </View>
        <View style={s.tx}>
          <Text style={s.title} numberOfLines={2}>{m.label}</Text>
          <Text style={s.sub} numberOfLines={1}>{sub}</Text>
        </View>
        <Pressable
          onPress={onMore}
          hitSlop={8}
          style={({ pressed }) => [s.more, pressed && { opacity: 0.6 }]}
          accessibilityRole="button"
          accessibilityLabel={`Correggi «${m.label}»`}
          testID="road-ripasso-more"
        >
          <Ionicons name="ellipsis-horizontal" size={20} color={CLAY.ink3} />
        </Pressable>
      </View>
      {m.sentiment ? (
        <View style={s.verdict}>
          <View style={[s.dot, { backgroundColor: sentimentColor(m.sentiment) }]} />
          <Text style={s.verdictTx}>{m.sentiment === 'good' ? 'Fatto bene' : 'Da migliorare'}</Text>
        </View>
      ) : null}
      {m.note ? <ExpandableText text={m.note} numberOfLines={3} style={s.note} /> : null}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: CLAY.bg },
  bar: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  // Come la mappa a tutto schermo del percorso: capsula bianca in rilievo.
  chip: { height: 40, paddingHorizontal: 16, borderRadius: 20, justifyContent: 'center', backgroundColor: CLAY.surface },
  chipTx: { fontSize: 14.5, fontWeight: '600', color: CLAY.ink, fontVariant: ['tabular-nums'] },
  card: {
    position: 'absolute',
    left: 12,
    right: 12,
    borderRadius: 30,
    backgroundColor: CLAY.surface,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  sy: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  img: { width: 46, height: 46 },
  sg: { position: 'absolute', right: -4, bottom: -4 },
  tx: { flex: 1, minWidth: 0 },
  title: { fontSize: 20, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.4 },
  sub: { fontSize: 14, fontWeight: '400', color: CLAY.ink3, marginTop: 2, fontVariant: ['tabular-nums'] },
  more: { width: 36, height: 36, marginRight: -8, alignSelf: 'flex-start', alignItems: 'center', justifyContent: 'center' },
  verdict: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 14 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  verdictTx: { fontSize: 15, fontWeight: '500', color: CLAY.ink, letterSpacing: -0.2 },
  note: { fontSize: 15, fontWeight: '400', color: CLAY.ink2, lineHeight: 21, marginTop: 8 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 20 },
  prev: { width: CTA_HEIGHT, height: CTA_HEIGHT, borderRadius: CTA_HEIGHT / 2 },
  flex: { flex: 1 },
  // «Fine» accanto a «Compila il pagellino»: largo quanto basta, il resto alla CTA.
  done: { width: 104 },
});
