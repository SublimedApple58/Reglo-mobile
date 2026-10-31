import React from 'react';
import { ExpandableText } from './ExpandableText';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

import { formatDistance, hotspotLine, hotspotStatusLine, HOTSPOT_AHEAD_M, type HotspotAlert } from '../../road/navGuide';
import { markerArt } from '../../road/markerArt';
import { ROAD_TEXT_IN } from '../../road/motion';
import type { RoadHotspotOutcome } from '../../types/regloApi';
import { CLAY_CTA, CLAY_SHADOW } from '../../theme';
import { DAY, NIGHT, roadPalette, type RoadPalette } from '../../road/night';

/**
 * REG-681 Reglo Road — il punto critico dell'allievo che si avvicina.
 *
 * - 180 m prima: «Tra 120 m · via», il tipo, la frase precisa (la nota
 *   dell'istruttore se c'è, altrimenti tipo e quante volte) e una barra sottile
 *   che si riempie avvicinandosi.
 * - Sul punto e per 15 s dopo: due bottoni grandi «Meglio» / «Ancora no»
 *   (un tocco, aptica). Se non si tocca niente non si salva niente.
 * - Dopo il tocco: «Segnato» con «Annulla» per qualche secondo, poi si chiude.
 */
export const RoadHotspotCard = React.memo(function RoadHotspotCard({
  alert,
  decided,
  onDecide,
  onUndo,
  onClose,
  style,
  night = false,
}: {
  /** REG-697: card scura di notte. */
  night?: boolean;
  alert: HotspotAlert;
  decided: RoadHotspotOutcome | null;
  onDecide: (outcome: RoadHotspotOutcome) => void;
  onUndo: () => void;
  onClose: () => void;
  style?: object;
}) {
  const s = night ? NIGHT_S : DAY_S;
  const P = roadPalette(night);
  const h = alert.hotspot;
  const d = formatDistance(alert.meters);
  const top =
    alert.phase === 'ahead'
      ? `Tra ${d.value} ${d.unit}${h.street ? ` · ${h.street}` : ''}`
      : alert.phase === 'at'
        ? `Ci sei${h.street ? ` · ${h.street}` : ''}`
        : 'Com’è andata questa volta?';
  const status = hotspotStatusLine(h);
  const progress = alert.phase === 'ahead' ? Math.max(0, Math.min(1, 1 - alert.meters / HOTSPOT_AHEAD_M)) : 1;
  const asking = alert.phase !== 'ahead' && !decided;

  return (
    <View style={[s.card, CLAY_SHADOW.raise, style]} testID="road-hotspot-card">
      <Pressable onPress={onClose} style={s.row} accessibilityRole="button" accessibilityHint="Chiude l'avviso">
        <View style={s.icon}>
          <Image source={markerArt(h.kind)} style={s.img} resizeMode="contain" />
        </View>
        <View style={s.texts}>
          <Animated.Text key={alert.phase} entering={ROAD_TEXT_IN} style={s.t1} numberOfLines={1}>
            {top}
          </Animated.Text>
          <Text style={s.t2} numberOfLines={1}>{h.label}</Text>
          {/* Note e stato lunghi: toccandoli si leggono per intero (Tiziano 31/10). */}
          <ExpandableText text={hotspotLine(h)} numberOfLines={2} style={s.t3} testID="road-hotspot-note" />
          {status ? <ExpandableText text={status} numberOfLines={1} style={s.t4} testID="road-hotspot-status" /> : null}
        </View>
      </Pressable>

      {asking ? (
        <Animated.View entering={ROAD_TEXT_IN} style={s.btns}>
          <Pressable
            onPress={() => onDecide('better')}
            style={({ pressed }) => [s.btn, s.btnInk, pressed ? CLAY_CTA.primaryPressed : CLAY_CTA.primary, night && s.btnInk]}
            accessibilityRole="button"
            accessibilityLabel={`${h.label}: questa volta meglio`}
            hitSlop={6}
            testID="road-hotspot-better"
          >
            <Ionicons name="checkmark" size={22} color={P.onInk} />
            <Text style={s.btnInkTx}>Meglio</Text>
          </Pressable>
          <Pressable
            onPress={() => onDecide('worse')}
            style={({ pressed }) => [s.btn, s.btnWhite, CLAY_SHADOW.raiseSm, pressed && { transform: [{ scale: 0.97 }] }]}
            accessibilityRole="button"
            accessibilityLabel={`${h.label}: ancora no`}
            hitSlop={6}
            testID="road-hotspot-worse"
          >
            <Ionicons name="close" size={22} color={P.ink} />
            <Text style={s.btnWhiteTx}>Ancora no</Text>
          </Pressable>
        </Animated.View>
      ) : null}

      {decided ? (
        <Animated.View entering={ROAD_TEXT_IN} style={s.done}>
          <Ionicons name={decided === 'better' ? 'checkmark-circle' : 'close-circle'} size={22} color={P.ink} />
          <Text style={s.doneTx}>{decided === 'better' ? 'Segnato: meglio' : 'Segnato: ancora no'}</Text>
          <Pressable onPress={onUndo} hitSlop={10} style={({ pressed }) => [s.undo, pressed && { opacity: 0.6 }]} testID="road-hotspot-undo">
            <Text style={s.undoTx}>Annulla</Text>
          </Pressable>
        </Animated.View>
      ) : null}

      {alert.phase === 'ahead' ? (
        <View style={s.track}>
          <View style={[s.bar, { width: `${progress * 100}%` }]} />
        </View>
      ) : null}
    </View>
  );
});

/** REG-697: stessi stili di giorno e di notte, cambia solo la palette. */
const makeStyles = (P: RoadPalette, night: boolean) =>
  StyleSheet.create({
  card: {
    position: 'absolute',
    left: 12,
    right: 12,
    borderRadius: 28,
    backgroundColor: P.surface,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  icon: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  img: { width: 48, height: 48 },
  texts: { flex: 1, minWidth: 0 },
  t1: { fontSize: 13.5, fontWeight: '500', color: P.ink3 },
  t2: { fontSize: 18, fontWeight: '600', color: P.ink, letterSpacing: -0.3, marginTop: 1 },
  t3: { fontSize: 15, color: P.ink2, lineHeight: 19, marginTop: 2 },
  t4: { fontSize: 13.5, color: P.ink3, marginTop: 3 },
  btns: { flexDirection: 'row', gap: 10, marginTop: 14 },
  btn: { flex: 1, height: 58, borderRadius: 29, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  btnInk: { backgroundColor: night ? P.ink : '#1E1E1E' },
  btnInkTx: { fontSize: 17, fontWeight: '600', color: P.onInk },
  btnWhite: { backgroundColor: P.surface2 },
  btnWhiteTx: { fontSize: 17, fontWeight: '600', color: P.ink },
  done: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: P.hair },
  doneTx: { flex: 1, fontSize: 16, fontWeight: '600', color: P.ink },
  undo: { paddingHorizontal: 6, paddingVertical: 4 },
  undoTx: { fontSize: 16, fontWeight: '600', color: P.ink3 },
  track: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, backgroundColor: P.soft },
  bar: { height: 3, backgroundColor: P.ink },
  });
const DAY_S = makeStyles(DAY, false);
const NIGHT_S = makeStyles(NIGHT, true);
