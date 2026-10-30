import React, { useState, useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FormSheet } from '../../../src/components/SheetScaffold';
import { ClayStat } from '../../../src/components/clay';
import { CLAY, CLAY_SHADOW } from '../../../src/theme';
import { useRouter, useSegments } from 'expo-router';

import { RoadRouteMap } from '../../../src/components/road/RoadMiniMap';
import { RoadMarkerList } from '../../../src/components/road/RoadMarkerList';
import { countSentiments, SentimentCounts } from '../../../src/components/road/RoadSentiment';
import { roadRouteMapStore } from '../../../src/road/routeMapStore';
import { dayLabel, formatHm, formatKm, formatMinutes } from '../../../src/road/format';

/** Oltre, «+N altre»: il foglio abbraccia il contenuto e non deve superare lo schermo. */
const MAX_MARKERS = 5;

/**
 * REG-638 — «Percorso Road» di una guida nell'app istruttore (dettaglio guida e
 * storico allievo). Form sheet nativo alto quanto il contenuto (FORM_SHEET,
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
    <FormSheet
      title={`${dayLabel(detail.startedAt)} · ${formatHm(detail.startedAt)} – ${formatHm(detail.endedAt ?? lesson.endsAt)}`}
      subtitle={sub || undefined}
      testID="road-percorso"
    >

      <View>
        <Pressable
          onPress={() => router.push(`/(tabs)/${stack}/road-map`)}
          accessibilityRole="button"
          accessibilityLabel="Apri la mappa"
          testID="road-percorso-map"
          style={({ pressed }) => [s.miniWrap, CLAY_SHADOW.raise, pressed && { transform: [{ scale: 0.98 }] }]}
        >
          {/* La mappa si ritaglia nel figlio: l'ombra clay sta sul contenitore. */}
          <RoadRouteMap track={detail.track} markers={detail.markers} stops={detail.stops} style={s.mini} />
        </Pressable>

        <View style={s.sum}>
          <ClayStat value={formatKm(detail.distanceMeters)} unit="km" label="Percorsi" />
          <ClayStat value={formatMinutes(detail.durationSec)} unit="min" label="Di guida" />
          <ClayStat value={detail.markers.length} label="Segnalazioni" />
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
    </FormSheet>
  );
}

const s = StyleSheet.create({
  root: { backgroundColor: CLAY.bg },
  miniWrap: { borderRadius: 24, backgroundColor: CLAY.surface },
  mini: { height: 172, borderRadius: 24, overflow: 'hidden' },
  sum: { flexDirection: 'row', gap: 10, marginTop: 16 },
  more: { fontSize: 13, fontWeight: '400', color: CLAY.ink3, marginTop: 8 },
});
