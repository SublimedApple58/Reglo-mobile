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
import { countSentiments, SENTIMENT_BAD, SENTIMENT_GOOD } from './RoadSentiment';
import { ClayButton, ClaySurface } from '../clay';
import { CLAY } from '../../theme/clay';

/** «1 positiva · 2 da migliorare», solo testo (REG-639: niente puntini colorati). */
const sentimentText = ({ good, bad }: { good: number; bad: number }) =>
  [good ? `${good} ${good === 1 ? 'positiva' : 'positive'}` : null, bad ? `${bad} da migliorare` : null]
    .filter(Boolean)
    .join(' · ');

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

  const sentiments = sentimentText(countSentiments(detail.markers));

  return (
    <ClaySurface padded={false} style={s.card} testID="road-lesson-card">
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
      {sentiments ? <Text style={s.counts}>{sentiments}</Text> : null}
      <ClayButton
        title="Apri percorso e segnalazioni"
        variant="secondary"
        compact
        onPress={() => void openRoadPercorso(router, 'home', appointmentId, detail)}
        style={s.open}
        testID="road-lesson-open"
      />
    </ClaySurface>
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
  card: { padding: 8, paddingBottom: 12 },
  mini: { height: 150, borderRadius: 20 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, paddingTop: 12 },
  headL: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headImg: { width: 22, height: 22 },
  headTx: { fontSize: 16, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.3 },
  headMeta: { fontSize: 13.5, fontWeight: '400', color: CLAY.ink3 },
  counts: { paddingHorizontal: 8, marginTop: 6, fontSize: 13.5, color: CLAY.ink3, letterSpacing: -0.1 },
  open: { marginTop: 14, marginHorizontal: 4 },
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
