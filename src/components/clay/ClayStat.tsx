import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { CLAY } from '../../theme/clay';
import { CLAY_RADIUS } from '../../theme/spacing';
import { SHEET_NIGHT, useSheetNight } from '../../theme/night';
import { ClaySurface } from './ClaySurface';

/**
 * Tessera numero clay (§0): numero grande con unità più piccola, etichetta.
 * Niente icona: il numero È il contenuto (§0.4). In fila da tre con `flex: 1`.
 * Cifre tabellari.
 */
export function ClayStat({
  value,
  unit,
  label,
  style,
}: {
  value: string | number;
  unit?: string;
  label: string;
  style?: StyleProp<ViewStyle>;
}) {
  // Ricca 7: fogli di Road di notte.
  const night = useSheetNight();
  return (
    <ClaySurface radius={CLAY_RADIUS.tile} padded={false} style={[s.tile, style]}>
      <Text style={[s.value, night && n.ink]}>
        {value}
        {unit ? <Text style={[s.unit, night && n.ink3]}> {unit}</Text> : null}
      </Text>
      <Text style={[s.label, night && n.ink3]} numberOfLines={1}>
        {label}
      </Text>
    </ClaySurface>
  );
}

/** Numero protagonista (es. «11 h 30 guidate»): cifra grande + unità, didascalia sotto. */
export function ClayHeroNumber({ value, unit, caption }: { value: string | number; unit?: string; caption?: string }) {
  return (
    <View>
      <Text style={s.hero}>
        {value}
        {unit ? <Text style={s.heroUnit}> {unit}</Text> : null}
      </Text>
      {caption ? <Text style={s.caption}>{caption}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  tile: { flex: 1, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 13 },
  value: { fontSize: 26, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.8, fontVariant: ['tabular-nums'] },
  unit: { fontSize: 15, fontWeight: '500', color: CLAY.ink3, letterSpacing: -0.2 },
  label: { fontSize: 13, color: CLAY.ink3, marginTop: 1 },
  hero: { fontSize: 46, fontWeight: '600', color: CLAY.ink, letterSpacing: -1.8, fontVariant: ['tabular-nums'] },
  heroUnit: { fontSize: 22, fontWeight: '500', color: CLAY.ink3, letterSpacing: -0.5 },
  caption: { fontSize: 14.5, color: CLAY.ink3, marginTop: 6 },
});

const n = StyleSheet.create({
  ink: { color: SHEET_NIGHT.ink },
  ink2: { color: SHEET_NIGHT.ink2 },
  ink3: { color: SHEET_NIGHT.ink3 },
  sep: { borderTopColor: SHEET_NIGHT.hair },
  pressed: { backgroundColor: SHEET_NIGHT.pressed },
});
