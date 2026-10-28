import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { CLAY } from '../../theme/clay';
import { CLAY_RADIUS } from '../../theme/spacing';
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
  return (
    <ClaySurface radius={CLAY_RADIUS.tile} padded={false} style={[s.tile, style]}>
      <Text style={s.value}>
        {value}
        {unit ? <Text style={s.unit}> {unit}</Text> : null}
      </Text>
      <Text style={s.label} numberOfLines={1}>
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
