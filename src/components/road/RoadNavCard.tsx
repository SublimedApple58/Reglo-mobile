import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { MaterialIcons } from '@expo/vector-icons';

import { formatDistance, maneuverGlyph, type NavState } from '../../road/navGuide';
import { ROAD_TEXT_IN } from '../../road/motion';
import { CLAY_SHADOW } from '../../theme';
import { DAY, NIGHT, roadPalette, type RoadPalette } from '../../road/night';

/**
 * REG-680 Reglo Road — la card in alto della guida: la prossima svolta (glifo
 * bianco sul quadrato nero, distanza grande, l'indicazione di Google) e sotto
 * la prossima tappa del giro con quanto manca. Senza svolte (backend vecchio,
 * Google giù) o fuori dal giro resta solo la riga della tappa.
 * REG-690: banner di manovra grande come Apple Mappe / Google Maps (glifo 68,
 * distanza 40) e, se la svolta dopo arriva entro 250 m, la riga «Poi …».
 */
export const RoadNavCard = React.memo(function RoadNavCard({
  nav,
  style,
  night = false,
}: {
  nav: NavState;
  style?: object;
  /** REG-697: card scura di notte. */
  night?: boolean;
}) {
  const s = night ? NIGHT_S : DAY_S;
  const P = roadPalette(night);
  const { step, then, stop, offLine } = nav;
  if (!step && !stop && !offLine) return null;
  const d = step ? formatDistance(step.meters) : null;
  const stopD = stop ? formatDistance(stop.meters) : null;

  return (
    <View style={[s.card, CLAY_SHADOW.raise, style]} testID="road-nav-card">
      {step && d ? (
        <View style={s.row} accessibilityLabel={`Tra ${d.value} ${d.unit === 'm' ? 'metri' : 'chilometri'}: ${step.text}`}>
          <View style={s.glyph}>
            <Animated.View key={step.maneuver} entering={ROAD_TEXT_IN}>
              <MaterialIcons name={maneuverGlyph(step.maneuver) as never} size={46} color={P.onInk} />
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
      ) : null}
      {step && then ? (
        <View style={[s.next, s.nextSep]} accessibilityLabel={`Poi: ${then.text}`} testID="road-nav-then">
          <Text style={s.thenLabel}>Poi</Text>
          <MaterialIcons name={maneuverGlyph(then.maneuver) as never} size={22} color={P.ink} />
          <Text style={s.nextTx} numberOfLines={1}>{then.text}</Text>
        </View>
      ) : null}
      {!step && offLine ? (
        <View style={s.row}>
          <View style={[s.glyph, s.glyphSoft]}>
            <MaterialIcons name="alt-route" size={30} color={P.ink} />
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

/** REG-697: stessi stili di giorno e di notte, cambia solo la palette. */
const makeStyles = (P: RoadPalette) =>
  StyleSheet.create({
  card: {
    position: 'absolute',
    left: 12,
    right: 12,
    borderRadius: 28,
    backgroundColor: P.surface,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  glyph: { width: 68, height: 68, borderRadius: 20, backgroundColor: P.ink, alignItems: 'center', justifyContent: 'center' },
  glyphSoft: { backgroundColor: P.soft },
  texts: { flex: 1, minWidth: 0 },
  dist: { fontSize: 40, fontWeight: '600', color: P.ink, letterSpacing: -1.2, lineHeight: 44, fontVariant: ['tabular-nums'] },
  unit: { fontSize: 21, fontWeight: '500', color: P.ink3, letterSpacing: 0 },
  what: { fontSize: 18, fontWeight: '500', color: P.ink, lineHeight: 22, marginTop: 1, letterSpacing: -0.2 },
  thenLabel: { fontSize: 15, fontWeight: '600', color: P.ink },
  offT1: { fontSize: 19, fontWeight: '600', color: P.ink, letterSpacing: -0.3 },
  next: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  nextSep: { marginTop: 12, paddingTop: 11, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: P.hair },
  num: { width: 24, height: 24, borderRadius: 12, backgroundColor: P.ink, alignItems: 'center', justifyContent: 'center' },
  numTx: { fontSize: 12.5, fontWeight: '600', color: P.onInk, fontVariant: ['tabular-nums'] },
  nextTx: { flex: 1, minWidth: 0, fontSize: 15, color: P.ink3 },
  nextTitle: { color: P.ink, fontWeight: '600' },
  nextKm: { fontSize: 15, color: P.ink3, fontVariant: ['tabular-nums'] },
  });
const DAY_S = makeStyles(DAY);
const NIGHT_S = makeStyles(NIGHT);
