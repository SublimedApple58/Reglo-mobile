import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { markerArt } from '../../road/markerArt';
import { formatHm } from '../../road/format';
import { SentimentBadge, type Sentiment } from './RoadSentiment';
import { ExpandableText } from './ExpandableText';

export type RoadMarkerItem = {
  key: string;
  kind: string;
  label: string;
  street: string | null;
  note?: string | null;
  sentiment?: Sentiment | null;
  recordedAt: string;
};

/** Da segnalazione (riepilogo, percorso) a riga d'elenco. */
export function toMarkerItem(m: {
  id: string;
  clientId?: string;
  kind: string;
  label: string;
  street: string | null;
  note?: string | null;
  sentiment?: Sentiment | null;
  recordedAt: string;
}): RoadMarkerItem {
  return {
    key: m.clientId || m.id, // = roadMarkerKey
    kind: m.kind,
    label: m.label,
    street: m.street,
    note: m.note,
    sentiment: m.sentiment ?? null,
    recordedAt: m.recordedAt,
  };
}

/**
 * Elenco segnalazioni: simbolo, etichetta, via (o nota), ora. Con
 * `onPressItem` (REG-696) ogni riga si tocca per correggerla.
 */
export function RoadMarkerList({ items, onPressItem }: { items: RoadMarkerItem[]; onPressItem?: (key: string) => void }) {
  if (!items.length) return null;
  return (
    <View>
      {items.map((m, i) => (
        <RoadMarkerRow key={m.key} item={m} index={i} onPress={onPressItem} correctable={!!onPressItem} />
      ))}
    </View>
  );
}

/**
 * REG-715 — una riga di segnalazione, `memo` (FlatList del foglio «Tutte le
 * segnalazioni»). `onPress` = tocco sulla riga; `onMore` = «⋯» a destra per
 * correggerla (il tocco sulla riga resta libero, es. per la mappa).
 * `selected` = la riga della segnalazione scelta sulla mappa.
 */
export const RoadMarkerRow = React.memo(function RoadMarkerRow({
  item: m,
  index,
  onPress,
  onMore,
  selected = false,
  correctable = false,
}: {
  item: RoadMarkerItem;
  index: number;
  onPress?: (key: string) => void;
  onMore?: (key: string) => void;
  selected?: boolean;
  /** La riga intera apre la correzione (riepilogo, REG-696). */
  correctable?: boolean;
}) {
  const sub = [m.street, m.note].filter(Boolean).join(' · ');
  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress ? () => onPress(m.key) : undefined}
      style={({ pressed }) => [s.row, index > 0 && s.sep, selected && s.selected, pressed && s.pressed]}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityState={onMore ? { selected } : undefined}
      accessibilityHint={correctable ? 'Correggi o elimina la segnalazione' : onMore ? 'Mostra sulla mappa' : undefined}
      testID={onPress ? `road-marker-row-${index}` : undefined}
    >
      <View style={s.sy}>
        <Image source={markerArt(m.kind)} style={s.img} resizeMode="contain" />
        {m.sentiment ? <SentimentBadge sentiment={m.sentiment} size={19} style={s.sg} /> : null}
      </View>
      <View style={s.tx}>
        <Text style={s.title} numberOfLines={1}>{m.label}</Text>
        {sub ? (
          onPress ? (
            // Riga che si tocca: la nota intera è nel menu / nel ripasso.
            <Text style={s.sub} numberOfLines={1}>{sub}</Text>
          ) : (
            <ExpandableText text={sub} numberOfLines={1} style={s.sub} />
          )
        ) : null}
      </View>
      <Text style={s.time}>{formatHm(m.recordedAt)}</Text>
      {onMore ? (
        <Pressable
          onPress={() => onMore(m.key)}
          hitSlop={8}
          style={({ pressed }) => [s.more, pressed && s.pressed]}
          accessibilityRole="button"
          accessibilityLabel={`Correggi «${m.label}»`}
          testID={`road-marker-more-${index}`}
        >
          <Ionicons name="ellipsis-horizontal" size={20} color="#6A6A6A" />
        </Pressable>
      ) : null}
    </Pressable>
  );
});

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 58 },
  pressed: { opacity: 0.6 },
  sep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(60,60,67,0.18)' },
  // Riga scelta: un velo grigio che sborda di 10 pt ai lati (niente bordo, niente colore).
  selected: { backgroundColor: 'rgba(17,17,17,0.05)', marginHorizontal: -10, paddingHorizontal: 10, borderRadius: 14, borderTopColor: 'transparent' },
  // Clay v2: l'icona 3D sta sul bianco, niente riquadro grigio.
  sy: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  img: { width: 34, height: 34 },
  sg: { position: 'absolute', right: -5, bottom: -5 },
  tx: { flex: 1, minWidth: 0 },
  title: { fontSize: 15, fontWeight: '500', color: '#111111', letterSpacing: -0.2 },
  sub: { fontSize: 13, fontWeight: '400', color: '#6A6A6A', marginTop: 1 },
  time: { fontSize: 14, fontWeight: '400', color: '#6A6A6A', fontVariant: ['tabular-nums'] },
  more: { width: 32, height: 32, marginRight: -6, alignItems: 'center', justifyContent: 'center' },
});
