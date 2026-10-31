import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { markerArt } from '../../road/markerArt';
import { formatHm } from '../../road/format';
import { SentimentBadge, type Sentiment } from './RoadSentiment';
import { ExpandableText } from './ExpandableText';

type Item = {
  key: string;
  kind: string;
  label: string;
  street: string | null;
  note?: string | null;
  sentiment?: Sentiment | null;
  recordedAt: string;
};

/**
 * Elenco segnalazioni: simbolo, etichetta, via (o nota), ora. Con
 * `onPressItem` (REG-696) ogni riga si tocca per correggerla.
 */
export function RoadMarkerList({ items, onPressItem }: { items: Item[]; onPressItem?: (key: string) => void }) {
  if (!items.length) return null;
  return (
    <View>
      {items.map((m, i) => (
        <Pressable
          key={m.key}
          disabled={!onPressItem}
          onPress={onPressItem ? () => onPressItem(m.key) : undefined}
          style={({ pressed }) => [s.row, i > 0 && s.sep, pressed && s.pressed]}
          accessibilityRole={onPressItem ? 'button' : undefined}
          accessibilityHint={onPressItem ? 'Correggi o elimina la segnalazione' : undefined}
          testID={onPressItem ? `road-marker-row-${i}` : undefined}
        >
          <View style={s.sy}>
            <Image source={markerArt(m.kind)} style={s.img} resizeMode="contain" />
            {m.sentiment ? <SentimentBadge sentiment={m.sentiment} size={19} style={s.sg} /> : null}
          </View>
          <View style={s.tx}>
            <Text style={s.title} numberOfLines={1}>{m.label}</Text>
            {m.street || m.note ? (
              onPressItem ? (
                // Riga che si tocca per correggere: la nota intera è nel menu.
                <Text style={s.sub} numberOfLines={1}>
                  {[m.street, m.note].filter(Boolean).join(' · ')}
                </Text>
              ) : (
                <ExpandableText text={[m.street, m.note].filter(Boolean).join(' · ')} numberOfLines={1} style={s.sub} />
              )
            ) : null}
          </View>
          <Text style={s.time}>{formatHm(m.recordedAt)}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 58 },
  pressed: { opacity: 0.6 },
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
