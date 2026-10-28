import React from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { CLAY, CLAY_SHADOW } from '../../theme/clay';
import { SFSymbol } from '../SFSymbol';

/**
 * Controlli mappa clay (§0), come in Apple Maps: velocità e «centra» in
 * un'unica colonna bianca in rilievo, a destra sopra il pannello. Mai sopra
 * il logo Maps né «Legal» (stanno a sinistra). `bottom` lo decide la schermata.
 */
export function ClayMapControls({
  speedKmh,
  following,
  onRecenter,
  style,
}: {
  speedKmh: number;
  following: boolean;
  onRecenter: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[s.col, CLAY_SHADOW.raise, style]}>
      <View style={s.speed} accessibilityLabel={`${speedKmh} chilometri orari`}>
        <Text style={s.num}>{speedKmh}</Text>
        <Text style={s.unit}>km/h</Text>
      </View>
      <View style={s.sep} />
      <Pressable
        onPress={onRecenter}
        style={({ pressed }) => [s.loc, pressed && s.locPressed]}
        accessibilityRole="button"
        accessibilityLabel="Centra sulla tua posizione"
        testID="road-recenter"
      >
        <SFSymbol
          name={following ? 'location.fill' : 'location'}
          size={19}
          color={following ? CLAY.ink : CLAY.ink2}
          // Ripiego: freccia piena Material, la più vicina a location.fill.
          fallback="near-me"
        />
      </Pressable>
    </View>
  );
}

const W = 56;

const s = StyleSheet.create({
  col: { position: 'absolute', right: 14, width: W, borderRadius: W / 2, backgroundColor: CLAY.surface },
  speed: { height: 62, alignItems: 'center', justifyContent: 'center' },
  num: { fontSize: 21, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.5, lineHeight: 23, fontVariant: ['tabular-nums'] },
  unit: { fontSize: 10.5, fontWeight: '500', color: CLAY.ink3, marginTop: 1 },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(17,17,17,0.14)', marginHorizontal: 13 },
  loc: { height: 52, alignItems: 'center', justifyContent: 'center', borderBottomLeftRadius: W / 2, borderBottomRightRadius: W / 2 },
  locPressed: { backgroundColor: 'rgba(17,17,17,0.04)' },
});
