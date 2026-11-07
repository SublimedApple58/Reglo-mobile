import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { markerArt } from '../../road/markerArt';
import { formatHm } from '../../road/format';
import { SHEET_NIGHT, useSheetNight } from '../../theme/night';
import type { RoadHotspotCheck } from '../../types/regloApi';

/**
 * REG-681 — i ripassi sui punti critici di una guida («Meglio» / «Ancora no»
 * segnati passando sul punto). Stesse righe di `RoadMarkerList`: simbolo,
 * etichetta, esito in parole, ora. Niente pillole.
 */
export function RoadCheckList({ checks }: { checks: RoadHotspotCheck[] }) {
  const night = useSheetNight();
  if (!checks.length) return null;
  const better = checks.filter((c) => c.outcome === 'better').length;
  return (
    <View>
      <Text style={[s.head, night && n.ink]} testID="road-summary-checks">
        Punti critici ripassati: {better} meglio su {checks.length}
      </Text>
      {checks.map((c, i) => (
        <View key={c.clientId} style={[s.row, i > 0 && s.sep, i > 0 && night && n.sep]}>
          <View style={s.sy}>
            <Image source={markerArt(c.kind)} style={s.img} resizeMode="contain" />
          </View>
          <View style={s.tx}>
            <Text style={[s.title, night && n.ink]} numberOfLines={1}>{c.label}</Text>
            <Text style={[s.sub, night && n.ink3]} numberOfLines={1}>{c.outcome === 'better' ? 'Questa volta meglio' : 'Ancora da migliorare'}</Text>
          </View>
          <Text style={[s.time, night && n.ink3]}>{formatHm(c.recordedAt)}</Text>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  head: { fontSize: 15, fontWeight: '500', color: '#111111', letterSpacing: -0.2, marginTop: 14, marginBottom: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 58 },
  sep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(60,60,67,0.18)' },
  sy: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  img: { width: 34, height: 34 },
  tx: { flex: 1, minWidth: 0 },
  title: { fontSize: 15, fontWeight: '500', color: '#111111', letterSpacing: -0.2 },
  sub: { fontSize: 13, fontWeight: '400', color: '#6A6A6A', marginTop: 1 },
  time: { fontSize: 14, fontWeight: '400', color: '#6A6A6A', fontVariant: ['tabular-nums'] },
});

const n = StyleSheet.create({
  ink: { color: SHEET_NIGHT.ink },
  ink2: { color: SHEET_NIGHT.ink2 },
  ink3: { color: SHEET_NIGHT.ink3 },
  sep: { borderTopColor: SHEET_NIGHT.hair },
  pressed: { backgroundColor: SHEET_NIGHT.pressed },
});
