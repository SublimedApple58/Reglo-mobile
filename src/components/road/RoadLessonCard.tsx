import React, { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Router } from 'expo-router';

import { regloApi } from '../../services/regloApi';
import type { RoadDetail, RoadStudentItem } from '../../types/regloApi';
import { ROAD_ASSETS } from '../../road/markerArt';
import { formatKm, formatMinutes } from '../../road/format';
import { openRoadPercorso } from '../../road/openRoadPercorso';
import { RoadRouteMap } from './RoadMiniMap';
import { countSentiments, SENTIMENT_BAD, SENTIMENT_GOOD, SentimentCounts } from './RoadSentiment';

/**
 * REG-638 — percorso Road della guida dentro il dettaglio guida dell'istruttore:
 * mini mappa, km e minuti, conteggi, «Apri percorso e segnalazioni». Si carica
 * solo se Road è acceso e la guida è già partita; senza sessione non compare.
 */
export function RoadLessonCard({
  router,
  appointmentId,
  startsAt,
  enabled,
}: {
  router: Router;
  appointmentId: string;
  startsAt: string;
  enabled: boolean;
}) {
  const [detail, setDetail] = useState<RoadDetail | null>(null);
  const started = new Date(startsAt).getTime() <= Date.now();

  useEffect(() => {
    if (!enabled || !started) return;
    let alive = true;
    regloApi
      .getRoadForAppointment(appointmentId)
      .then((d) => {
        if (alive) setDetail(d ?? null);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [appointmentId, enabled, started]);

  if (!detail || detail.status === 'active') return null;

  return (
    <View style={s.card} testID="road-lesson-card">
      <RoadRouteMap track={detail.track} markers={detail.markers} style={s.mini} />
      <View style={s.head}>
        <View style={s.headL}>
          <Image source={ROAD_ASSETS.road} style={s.headImg} resizeMode="contain" />
          <Text style={s.headTx}>Percorso Road</Text>
        </View>
        <Text style={s.headMeta}>
          {formatKm(detail.distanceMeters)} km · {formatMinutes(detail.durationSec)} min
        </Text>
      </View>
      <SentimentCounts {...countSentiments(detail.markers)} style={s.counts} />
      <Pressable
        onPress={() => void openRoadPercorso(router, 'home', appointmentId, detail)}
        style={({ pressed }) => [s.open, pressed && { opacity: 0.7 }]}
        accessibilityRole="button"
        testID="road-lesson-open"
      >
        <Text style={s.openTx}>Apri percorso e segnalazioni</Text>
      </Pressable>
    </View>
  );
}

/** Chip «Percorso Road» sulle guide dello storico allievo. */
export function RoadHistoryChip({
  item,
  onPress,
}: {
  item: RoadStudentItem;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [s.chip, pressed && { opacity: 0.6 }]}
      accessibilityRole="button"
      accessibilityLabel="Apri il percorso Road"
      testID="road-history-chip"
    >
      <Image source={ROAD_ASSETS.road} style={s.chipImg} resizeMode="contain" />
      <Text style={s.chipTx}>
        Percorso · {formatKm(item.distanceMeters)} km
      </Text>
      {item.markerGood ? (
        <View style={s.chipCount}>
          <View style={[s.chipDot, { backgroundColor: SENTIMENT_GOOD }]} />
          <Text style={s.chipTx}>{item.markerGood}</Text>
        </View>
      ) : null}
      {item.markerBad ? (
        <View style={s.chipCount}>
          <View style={[s.chipDot, { backgroundColor: SENTIMENT_BAD }]} />
          <Text style={s.chipTx}>{item.markerBad}</Text>
        </View>
      ) : null}
      <Ionicons name="chevron-forward" size={13} color="#8E8E93" />
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: 24, backgroundColor: '#F7F7F5', padding: 8, paddingBottom: 8 },
  mini: { height: 150, borderRadius: 18 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, paddingTop: 12 },
  headL: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headImg: { width: 22, height: 22 },
  headTx: { fontSize: 16, fontWeight: '600', color: '#111111', letterSpacing: -0.3 },
  headMeta: { fontSize: 13.5, fontWeight: '400', color: '#6A6A6A' },
  counts: { paddingHorizontal: 8, marginTop: 6 },
  open: {
    height: 46,
    borderRadius: 23,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  openTx: { fontSize: 15, fontWeight: '600', color: '#111111', letterSpacing: -0.2 },
  chip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 28,
    paddingLeft: 5,
    paddingRight: 9,
    borderRadius: 14,
    backgroundColor: '#F2F2F0',
    marginTop: 8,
  },
  chipImg: { width: 18, height: 18 },
  chipTx: { fontSize: 12.5, fontWeight: '500', color: '#3A3A3C' },
  chipCount: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  chipDot: { width: 7, height: 7, borderRadius: 3.5 },
});
