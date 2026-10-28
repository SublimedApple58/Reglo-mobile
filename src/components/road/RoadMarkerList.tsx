import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { markerArt } from '../../road/markerArt';
import { formatHm } from '../../road/format';
import { SentimentBadge, type Sentiment } from './RoadSentiment';

type Item = {
  key: string;
  kind: string;
  label: string;
  street: string | null;
  note?: string | null;
  sentiment?: Sentiment | null;
  recordedAt: string;
};

/** Elenco segnalazioni: simbolo, etichetta, via (o nota), ora. */
export function RoadMarkerList({ items }: { items: Item[] }) {
  if (!items.length) return null;
  return (
    <View>
      {items.map((m, i) => (
        <View key={m.key} style={[s.row, i > 0 && s.sep]}>
          <View style={s.sy}>
            <Image source={markerArt(m.kind)} style={s.img} resizeMode="contain" />
            {m.sentiment ? <SentimentBadge sentiment={m.sentiment} size={19} style={s.sg} /> : null}
          </View>
          <View style={s.tx}>
            <Text style={s.title} numberOfLines={1}>{m.label}</Text>
            {m.street || m.note ? (
              <Text style={s.sub} numberOfLines={1}>
                {[m.street, m.note].filter(Boolean).join(' · ')}
              </Text>
            ) : null}
          </View>
          <Text style={s.time}>{formatHm(m.recordedAt)}</Text>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 58 },
  sep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(60,60,67,0.18)' },
  // Clay v2: l'icona 3D sta sul bianco, niente riquadro grigio.
  sy: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  img: { width: 34, height: 34 },
  sg: { position: 'absolute', right: -5, bottom: -5 },
  tx: { flex: 1, minWidth: 0 },
  title: { fontSize: 15, fontWeight: '500', color: '#111111', letterSpacing: -0.2 },
  sub: { fontSize: 13, fontWeight: '400', color: '#6A6A6A', marginTop: 1 },
  time: { fontSize: 14, fontWeight: '400', color: '#6A6A6A', fontVariant: ['tabular-nums'] },
});
