import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FormSheet } from '../../../src/components/SheetScaffold';
import { ClayButton, ClayStat } from '../../../src/components/clay';
import { SkeletonBlock } from '../../../src/components/Skeleton';
import { CLAY, CLAY_SHADOW } from '../../../src/theme';
import { useRouter, useSegments } from 'expo-router';

import { RoadRouteMap } from '../../../src/components/road/RoadMiniMap';
import { RoadMarkerList } from '../../../src/components/road/RoadMarkerList';
import { countSentiments, SentimentCounts } from '../../../src/components/road/RoadSentiment';
import { roadRouteMapStore } from '../../../src/road/routeMapStore';
import { retryRoadPercorso } from '../../../src/road/openRoadPercorso';
import { dayLabel, formatHm, formatKm, formatMinutes } from '../../../src/road/format';

/** Oltre, «+N altre»: il foglio abbraccia il contenuto e non deve superare lo schermo. */
const MAX_MARKERS = 5;

/**
 * REG-638 — «Percorso Road» di una guida nell'app istruttore (dettaglio guida e
 * storico allievo). Form sheet nativo alto quanto il contenuto (FORM_SHEET,
 * §13.2.1): la radice è lo scroll del foglio. Titolo = giorno e orario (niente
 * eyebrow). Tocco sulla mappa = mappa a tutto schermo.
 * REG-694: si apre al tocco, prima dei dati (scheletro della stessa forma);
 * errore ≠ vuoto: l'errore ha «Riprova», il vuoto lo dice.
 */
export default function RoadPercorsoSheet() {
  const router = useRouter();
  const segments = useSegments() as string[];
  const stack = segments[1] === 'notes' ? 'notes' : segments[1] === 'drive' ? 'drive' : 'home';
  const live = useSyncExternalStore(roadRouteMapStore.subscribe, roadRouteMapStore.get);
  const pending = useSyncExternalStore(roadRouteMapStore.subscribe, roadRouteMapStore.pending);
  // Arrivati, i dati restano fermi finché il foglio è aperto (la mappa grande
  // può riscrivere lo store sotto).
  const [detail, setDetail] = useState(() => (pending ? null : live));
  useEffect(() => {
    if (!detail && !pending && live) setDetail(live);
  }, [detail, pending, live]);

  if (!detail) {
    const hint = pending?.hint ?? null;
    const status = pending?.status ?? 'loading';
    return (
      <FormSheet
        title={hint ? timeTitle(hint.startedAt, hint.endedAt ?? null) : 'Percorso'}
        subtitle={status === 'loading' ? <SkeletonBlock width={150} height={13} radius={6} style={s.skSub} /> : undefined}
        contentKey={status}
        testID="road-percorso"
      >
        {status === 'loading' ? (
          // Stessa forma del contenuto: il foglio non cambia altezza all'arrivo.
          <View testID="road-percorso-skeleton">
            <SkeletonBlock height={172} radius={24} />
            <View style={s.sum}>
              {[0, 1, 2].map((i) => (
                <SkeletonBlock key={i} height={74} radius={20} style={s.skStat} />
              ))}
            </View>
            {[0, 1].map((i) => (
              <View key={i} style={s.skRow}>
                <SkeletonBlock width={36} height={36} radius={10} />
                <SkeletonBlock width="55%" height={14} radius={6} />
              </View>
            ))}
          </View>
        ) : status === 'empty' ? (
          <Text style={s.state} testID="road-percorso-empty">
            Questa guida non ha un percorso registrato.
          </Text>
        ) : (
          <View testID="road-percorso-error">
            <Text style={s.stateTitle}>Percorso non caricato</Text>
            <Text style={s.state}>Controlla la connessione e riprova.</Text>
            <ClayButton title="Riprova" variant="secondary" onPress={retryRoadPercorso} style={s.retry} testID="road-percorso-retry" />
          </View>
        )}
      </FormSheet>
    );
  }

  const lesson = detail.lesson;
  const sub = [lesson.instructor?.name ? `con ${lesson.instructor.name}` : null, lesson.vehicle?.name ?? null]
    .filter(Boolean)
    .join(' · ');
  const shown = detail.markers.slice(0, MAX_MARKERS);
  const more = detail.markers.length - shown.length;

  return (
    <FormSheet
      title={timeTitle(detail.startedAt, detail.endedAt ?? lesson.endsAt)}
      subtitle={sub || undefined}
      contentKey="ready"
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

function timeTitle(startedAt: string, endedAt: string | null) {
  return `${dayLabel(startedAt)} · ${formatHm(startedAt)}${endedAt ? ` – ${formatHm(endedAt)}` : ''}`;
}

const s = StyleSheet.create({
  miniWrap: { borderRadius: 24, backgroundColor: CLAY.surface },
  mini: { height: 172, borderRadius: 24, overflow: 'hidden' },
  sum: { flexDirection: 'row', gap: 10, marginTop: 16 },
  more: { fontSize: 13, fontWeight: '400', color: CLAY.ink3, marginTop: 8 },
  skSub: { marginTop: 6 },
  skStat: { flex: 1 },
  skRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  stateTitle: { fontSize: 16, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.2 },
  state: { fontSize: 15, lineHeight: 21, color: CLAY.ink3, marginTop: 2 },
  retry: { marginTop: 16 },
});
