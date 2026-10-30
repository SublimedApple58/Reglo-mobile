import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { MaterialIcons } from '@expo/vector-icons';

import { formatDistance, maneuverGlyph, type NavState } from '../../road/navGuide';
import { ROAD_TEXT_IN } from '../../road/motion';
import { CLAY, CLAY_SHADOW } from '../../theme';

/**
 * REG-680 Reglo Road — la card in alto della guida: la prossima svolta (glifo
 * bianco sul quadrato nero, distanza grande, l'indicazione di Google) e sotto
 * la prossima tappa del giro con quanto manca. Senza svolte (backend vecchio,
 * Google giù) o fuori dal giro resta solo la riga della tappa.
 */
export const RoadNavCard = React.memo(function RoadNavCard({ nav, style }: { nav: NavState; style?: object }) {
  const { step, stop, offLine } = nav;
  if (!step && !stop && !offLine) return null;
  const d = step ? formatDistance(step.meters) : null;
  const stopD = stop ? formatDistance(stop.meters) : null;

  return (
    <View style={[s.card, CLAY_SHADOW.raise, style]} testID="road-nav-card">
      {step && d ? (
        <View style={s.row} accessibilityLabel={`Tra ${d.value} ${d.unit === 'm' ? 'metri' : 'chilometri'}: ${step.text}`}>
          <View style={s.glyph}>
            <Animated.View key={step.maneuver} entering={ROAD_TEXT_IN}>
              <MaterialIcons name={maneuverGlyph(step.maneuver) as never} size={34} color="#FFFFFF" />
            </Animated.View>
          </View>
          <View style={s.texts}>
            <Text style={s.dist}>
              {d.value}
              <Text style={s.unit}> {d.unit}</Text>
            </Text>
            <Text style={s.what} numberOfLines={2}>{step.text}</Text>
          </View>
        </View>
      ) : offLine ? (
        <View style={s.row}>
          <View style={[s.glyph, s.glyphSoft]}>
            <MaterialIcons name="alt-route" size={30} color={CLAY.ink} />
          </View>
          <View style={s.texts}>
            <Text style={s.offT1}>Fuori dal giro</Text>
            <Text style={s.what} numberOfLines={1}>Ricalcolo la strada per la prossima tappa</Text>
          </View>
        </View>
      ) : null}

      {stop && stopD ? (
        <View style={[s.next, (step || offLine) && s.nextSep]} accessibilityLabel={`Tappa ${stop.n}: ${stop.title}, tra ${stopD.value} ${stopD.unit}`}>
          <View style={s.num}>
            <Text style={s.numTx}>{stop.n}</Text>
          </View>
          <Text style={s.nextTx} numberOfLines={1}>
            <Text style={s.nextTitle}>{stop.title}</Text>
            {stop.street ? ` · ${stop.street}` : ''}
          </Text>
          <Text style={s.nextKm}>
            {stopD.value} {stopD.unit}
          </Text>
        </View>
      ) : null}
    </View>
  );
});

const s = StyleSheet.create({
  card: {
    position: 'absolute',
    left: 12,
    right: 12,
    borderRadius: 28,
    backgroundColor: CLAY.surface,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  glyph: { width: 58, height: 58, borderRadius: 18, backgroundColor: CLAY.ink, alignItems: 'center', justifyContent: 'center' },
  glyphSoft: { backgroundColor: 'rgba(17,17,17,0.06)' },
  texts: { flex: 1, minWidth: 0 },
  dist: { fontSize: 30, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.8, lineHeight: 34, fontVariant: ['tabular-nums'] },
  unit: { fontSize: 18, fontWeight: '500', color: CLAY.ink3, letterSpacing: 0 },
  what: { fontSize: 16, fontWeight: '500', color: CLAY.ink2, lineHeight: 20, marginTop: 1 },
  offT1: { fontSize: 19, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.3 },
  next: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  nextSep: { marginTop: 12, paddingTop: 11, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(17,17,17,0.14)' },
  num: { width: 24, height: 24, borderRadius: 12, backgroundColor: CLAY.ink, alignItems: 'center', justifyContent: 'center' },
  numTx: { fontSize: 12.5, fontWeight: '600', color: '#FFFFFF', fontVariant: ['tabular-nums'] },
  nextTx: { flex: 1, minWidth: 0, fontSize: 15, color: CLAY.ink3 },
  nextTitle: { color: CLAY.ink, fontWeight: '600' },
  nextKm: { fontSize: 15, color: CLAY.ink3, fontVariant: ['tabular-nums'] },
});
