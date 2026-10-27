import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * REG-638 Reglo Road — segno delle segnalazioni: «fatto bene» (verde) o
 * «da migliorare» (rosso). Le segnalazioni nate prima del segno restano neutre.
 */
export const SENTIMENT_GOOD = '#16A34A';
export const SENTIMENT_BAD = '#DC2626';

export type Sentiment = 'good' | 'bad';

export const sentimentColor = (s: Sentiment) => (s === 'good' ? SENTIMENT_GOOD : SENTIMENT_BAD);

/** Pallino col pollice, da appoggiare sull'angolo del simbolo 3D. */
export function SentimentBadge({
  sentiment,
  size = 20,
  style,
}: {
  sentiment: Sentiment;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      accessibilityLabel={sentiment === 'good' ? 'Fatto bene' : 'Da migliorare'}
      style={[
        s.badge,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: sentimentColor(sentiment) },
        style,
      ]}
    >
      <Ionicons name={sentiment === 'good' ? 'thumbs-up' : 'thumbs-down'} size={Math.round(size * 0.5)} color="#FFFFFF" />
    </View>
  );
}

/** «1 positiva · 2 da migliorare»; niente se nessuna segnalazione ha il segno. */
export function SentimentCounts({
  good,
  bad,
  style,
}: {
  good: number;
  bad: number;
  style?: StyleProp<ViewStyle>;
}) {
  if (!good && !bad) return null;
  return (
    <View style={[s.counts, style]}>
      {good ? (
        <View style={s.count}>
          <View style={[s.dot, { backgroundColor: SENTIMENT_GOOD }]} />
          <Text style={s.countTx}>
            {good} {good === 1 ? 'positiva' : 'positive'}
          </Text>
        </View>
      ) : null}
      {bad ? (
        <View style={s.count}>
          <View style={[s.dot, { backgroundColor: SENTIMENT_BAD }]} />
          <Text style={s.countTx}>{bad} da migliorare</Text>
        </View>
      ) : null}
    </View>
  );
}

export function countSentiments(markers: Array<{ sentiment?: Sentiment | null }>) {
  let good = 0;
  let bad = 0;
  for (const m of markers) {
    if (m.sentiment === 'good') good += 1;
    else if (m.sentiment === 'bad') bad += 1;
  }
  return { good, bad };
}

const s = StyleSheet.create({
  badge: { alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFFFFF' },
  counts: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  count: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  countTx: { fontSize: 13.5, fontWeight: '400', color: '#3A3A3C', letterSpacing: -0.1 },
});
