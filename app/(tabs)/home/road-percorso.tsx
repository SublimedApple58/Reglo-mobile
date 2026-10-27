import React, { useState, useSyncExternalStore } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SHEET_BOTTOM } from '../../../src/utils/sheetPresentation';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useSegments } from 'expo-router';

import { GlassCloseButton } from '../../../src/components/GlassCloseButton';
import { RoadRouteMap } from '../../../src/components/road/RoadMiniMap';
import { RoadMarkerList } from '../../../src/components/road/RoadMarkerList';
import { countSentiments, SentimentCounts } from '../../../src/components/road/RoadSentiment';
import { roadRouteMapStore } from '../../../src/road/routeMapStore';
import { dayLabel, formatHm, formatKm, formatMinutes } from '../../../src/road/format';

/** Oltre, «+N altre»: il foglio abbraccia il contenuto e non deve superare lo schermo. */
const MAX_MARKERS = 5;

/**
 * REG-638 — «Percorso Road» di una guida nell'app istruttore (dettaglio guida e
 * storico allievo). Form sheet nativo alto quanto il contenuto (ROAD_SHEET,
 * §13.2.1): la radice è lo scroll del foglio. Titolo = giorno e orario (niente
 * eyebrow). Tocco sulla mappa = mappa a tutto schermo.
 */
export default function RoadPercorsoSheet() {
  const router = useRouter();
  const segments = useSegments() as string[];
  const stack = segments[1] === 'notes' ? 'notes' : segments[1] === 'drive' ? 'drive' : 'home';
  const live = useSyncExternalStore(roadRouteMapStore.subscribe, roadRouteMapStore.get);
  const [detail] = useState(() => live);

  if (!detail) return <View style={s.root} />;

  const lesson = detail.lesson;
  const sub = [lesson.instructor?.name ? `con ${lesson.instructor.name}` : null, lesson.vehicle?.name ?? null]
    .filter(Boolean)
    .join(' · ');
  const shown = detail.markers.slice(0, MAX_MARKERS);
  const more = detail.markers.length - shown.length;

  return (
    <ScrollView
      // Form sheet: niente safe area aggiunta da iOS sotto la CTA (§13.2.1).
      contentInsetAdjustmentBehavior="never"
      style={{ backgroundColor: '#FFFFFF' }}
      contentContainerStyle={s.root}
      showsVerticalScrollIndicator={false}
      alwaysBounceVertical={false}
      testID="road-percorso"
    >
      <View style={s.top}>
        <View style={{ flex: 1 }}>
          <Text style={s.title} numberOfLines={1}>
            {dayLabel(detail.startedAt)} · {formatHm(detail.startedAt)} – {formatHm(detail.endedAt ?? lesson.endsAt)}
          </Text>
          {sub ? <Text style={s.sub} numberOfLines={1}>{sub}</Text> : null}
        </View>
        <GlassCloseButton onPress={() => router.back()}>
          <Pressable onPress={() => router.back()} hitSlop={10} style={s.x}>
            <Ionicons name="close" size={20} color="#3A3A3C" />
          </Pressable>
        </GlassCloseButton>
      </View>

      <View>
        <Pressable
          onPress={() => router.push(`/(tabs)/${stack}/road-map`)}
          accessibilityRole="button"
          accessibilityLabel="Apri la mappa"
          testID="road-percorso-map"
        >
          <RoadRouteMap track={detail.track} markers={detail.markers} style={s.mini} />
        </Pressable>

        <View style={s.sum}>
          <View style={s.sumCol}>
            <Text style={s.sumNum}>
              {formatKm(detail.distanceMeters)} <Text style={s.sumUnit}>km</Text>
            </Text>
            <Text style={s.sumLabel}>Percorsi</Text>
          </View>
          <View style={[s.sumCol, s.sumSep]}>
            <Text style={s.sumNum}>
              {formatMinutes(detail.durationSec)} <Text style={s.sumUnit}>min</Text>
            </Text>
            <Text style={s.sumLabel}>Di guida</Text>
          </View>
          <View style={[s.sumCol, s.sumSep]}>
            <Text style={s.sumNum}>{detail.markers.length}</Text>
            <Text style={s.sumLabel}>Segnalazioni</Text>
          </View>
        </View>

        <SentimentCounts {...countSentiments(detail.markers)} style={{ marginTop: 14 }} />

        {shown.length ? (
          <View style={{ marginTop: 6 }}>
            <RoadMarkerList
              items={shown.map((m) => ({
                key: m.id,
                kind: m.kind,
                label: m.label,
                street: m.street,
                note: m.note,
                sentiment: m.sentiment ?? null,
                recordedAt: m.recordedAt,
              }))}
            />
            {more > 0 ? (
              <Text style={s.more}>
                + {more} {more === 1 ? 'altra segnalazione' : 'altre segnalazioni'} sulla mappa
              </Text>
            ) : null}
          </View>
        ) : (
          <Text style={s.more}>Nessuna segnalazione in questa guida.</Text>
        )}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  // form sheet: padding fisso, niente safe area (§13.2.1)
  // form sheet: respiro fisso, mai insets.bottom (§13.2.1)
  root: { backgroundColor: '#FFFFFF', paddingTop: 26, paddingHorizontal: 22, paddingBottom: SHEET_BOTTOM },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  title: { fontSize: 22, fontWeight: '600', color: '#111111', letterSpacing: -0.5 },
  sub: { fontSize: 14.5, fontWeight: '400', color: '#6A6A6A', marginTop: 3 },
  x: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(120,120,128,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mini: { height: 172, borderRadius: 24, marginTop: 16 },
  sum: { flexDirection: 'row', marginTop: 16 },
  sumCol: { flex: 1 },
  sumSep: { borderLeftWidth: 1, borderLeftColor: '#ECECEC', paddingLeft: 14 },
  sumNum: { fontSize: 24, fontWeight: '600', color: '#111111', letterSpacing: -0.7, fontVariant: ['tabular-nums'] },
  sumUnit: { fontSize: 13.5, fontWeight: '500', color: '#6A6A6A', letterSpacing: 0 },
  sumLabel: { fontSize: 12.5, fontWeight: '400', color: '#6A6A6A' },
  more: { fontSize: 13, fontWeight: '400', color: '#6A6A6A', marginTop: 8 },
});
