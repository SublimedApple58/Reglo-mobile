import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { markerArt } from '../../road/markerArt';
import { formatHm } from '../../road/format';
import type { RoadHotspotCheck } from '../../types/regloApi';

/**
 * REG-681 — i ripassi sui punti critici di una guida («Meglio» / «Ancora no»
 * segnati passando sul punto). Stesse righe di `RoadMarkerList`: simbolo,
 * etichetta, esito in parole, ora. Niente pillole.
 */
export function RoadCheckList({ checks }: { checks: RoadHotspotCheck[] }) {
  if (!checks.length) return null;
  const better = checks.filter((c) => c.outcome === 'better').length;
  return (
    <View>
      <Text style={s.head} testID="road-summary-checks">
        Punti critici ripassati: {better} meglio su {checks.length}
      </Text>
      {checks.map((c, i) => (
        <View key={c.clientId} style={[s.row, i > 0 && s.sep]}>
          <View style={s.sy}>
            <Image source={markerArt(c.kind)} style={s.img} resizeMode="contain" />
          </View>
          <View style={s.tx}>
            <Text style={s.title} numberOfLines={1}>{c.label}</Text>
            <Text style={s.sub} numberOfLines={1}>{c.outcome === 'better' ? 'Questa volta meglio' : 'Ancora da migliorare'}</Text>
          </View>
          <Text style={s.time}>{formatHm(c.recordedAt)}</Text>
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
