import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, InteractionManager, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';

import type { RoadHotspot, RoadHotspotDetail } from '../types/regloApi';
import { FormSheet } from '../components/SheetScaffold';
import { Avatar, ClayList, ClayListRow, ClayStat, Icon3D } from '../components/clay';
import { SkeletonBlock } from '../components/Skeleton';
import { markerArt } from '../road/markerArt';
import { ROAD_FADE_IN } from '../road/motion';
import { dayLabel, formatHm } from '../road/format';
import { roadRouteMapStore } from '../road/routeMapStore';
import {
  HOTSPOT_PERIODS,
  hotspotSheetStore,
  hotspotsStore,
  loadHotspotDetail,
  loadHotspotSession,
  prefetchHotspotSessions,
  useHotspotsVersion,
} from '../road/hotspotsStore';
import { CLAY } from '../theme';

/** Il foglio abbraccia il contenuto: oltre, «e altri N». */
const MAX_STUDENTS = 5;
const MAX_SESSIONS = 5;

const errorsLabel = (n: number) => (n === 1 ? '1 errore' : `${n} errori`);

/**
 * REG-646 — dettaglio di un punto critico (form sheet nativo, `FormSheet`).
 * I numeri in alto sono dell'autoscuola; allievi e guide sono SOLO quelli
 * dell'istruttore (il server toglie gli altri e dice quanti sono).
 * I dati arrivano dallo store (scaldati dalla schermata): il foglio si apre
 * pieno; se il punto non era ancora pronto, skeleton e poi dissolvenza.
 * Una guida apre «Percorso Road» con il dettaglio già scaricato.
 */
export default function RoadHotspotSheet() {
  const router = useRouter();
  useHotspotsVersion();
  const [sel] = useState(() => hotspotSheetStore.get());
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);

  const detail = sel ? hotspotsStore.detail(sel.key, sel.period) : null;
  const fromList = sel ? hotspotsStore.list(sel.period)?.hotspots.find((h) => h.key === sel.key) ?? null : null;
  const hotspot: RoadHotspot | null = detail?.hotspot ?? fromList;

  useEffect(() => {
    if (!sel) return;
    const task = InteractionManager.runAfterInteractions(() => {
      void loadHotspotDetail(sel.key, sel.period)
        .then((d) => prefetchHotspotSessions(d))
        .catch((err: unknown) => {
          if (!hotspotsStore.detail(sel.key, sel.period)) {
            setError(err instanceof Error && err.message ? err.message : 'Punto non disponibile.');
          }
        });
    });
    return () => task.cancel();
  }, [sel]);

  const openSession = useCallback(
    async (id: string) => {
      if (opening) return;
      Haptics.selectionAsync().catch(() => undefined);
      setOpening(id);
      const d = await loadHotspotSession(id);
      setOpening(null);
      if (!d) return;
      roadRouteMapStore.set(d);
      router.push('/(tabs)/drive/road-percorso' as never);
    },
    [opening, router],
  );

  if (!sel || !hotspot) {
    return (
      <FormSheet title="Punto critico" testID="hotspot-sheet">
        <Text style={s.muted}>{error ?? 'Punto non disponibile.'}</Text>
      </FormSheet>
    );
  }

  const where = [hotspot.street, HOTSPOT_PERIODS.find((p) => p.value === sel.period)?.long].filter(Boolean).join(' · ');

  return (
    <FormSheet
      title={hotspot.label}
      subtitle={where}
      leading={<Icon3D source={markerArt(hotspot.kind)} size={44} />}
      testID="hotspot-sheet"
    >
      {/* Senza CTA il foglio flottante di iOS aggiunge già il suo spazio sotto: si stringe sul contenuto. */}
      <View style={s.trim}>
      <View style={s.stats}>
        <ClayStat value={hotspot.errors} label="Errori" />
        <ClayStat value={hotspot.students} label="Allievi" />
        <ClayStat value={hotspot.sessions} label="Guide" />
      </View>
      <Text style={s.caption}>Di tutta l&apos;autoscuola, solo segnalazioni «da migliorare».</Text>

      {hotspot.examRoutes.length ? (
        <Text style={s.exam}>
          Sul percorso d&apos;esame {hotspot.examRoutes.map((r) => `«${r.name}»`).join(', ')}
        </Text>
      ) : null}

      {detail ? (
        <Animated.View entering={ROAD_FADE_IN} testID="hotspot-sheet-detail">
          <DetailBody detail={detail} opening={opening} onOpenSession={openSession} />
        </Animated.View>
      ) : error ? (
        <Text style={[s.muted, { marginTop: 22 }]}>{error}</Text>
      ) : (
        <View style={s.skWrap} testID="hotspot-sheet-skeleton">
          <SkeletonBlock width="52%" height={17} radius={6} />
          <SkeletonBlock height={64} radius={22} style={{ marginTop: 12 }} />
          <SkeletonBlock width="40%" height={17} radius={6} style={{ marginTop: 22 }} />
          <SkeletonBlock height={64} radius={22} style={{ marginTop: 12 }} />
        </View>
      )}
      </View>
    </FormSheet>
  );
}

const DetailBody = React.memo(function DetailBody({
  detail,
  opening,
  onOpenSession,
}: {
  detail: RoadHotspotDetail;
  opening: string | null;
  onOpenSession: (id: string) => void;
}) {
  const students = detail.students.slice(0, MAX_STUDENTS);
  const moreStudents = detail.students.length - students.length;
  const sessions = detail.sessions.slice(0, MAX_SESSIONS);
  const moreSessions = detail.sessions.length - sessions.length;

  if (!detail.sessions.length) {
    return (
      <Text style={[s.muted, { marginTop: 22 }]}>
        {detail.hiddenSessions
          ? 'Qui sbagliano allievi di altri istruttori: nessuna delle tue guide ha questo errore in questo punto.'
          : 'Nessuna delle tue guide ha questo errore in questo punto.'}
      </Text>
    );
  }

  return (
    <View>
      <Text style={s.section}>I tuoi allievi che ci sbagliano</Text>
      <ClayList style={s.list}>
        {students.map((st) => (
          <ClayListRow
            key={st.id}
            leading={<Avatar userId={st.id} name={st.name ?? 'Allievo'} size={40} />}
            title={st.name ?? 'Allievo'}
            trailing={<Text style={s.trail}>{errorsLabel(st.errors)}</Text>}
            testID="hotspot-sheet-student"
          />
        ))}
      </ClayList>
      {moreStudents > 0 ? <Text style={s.more}>e altri {moreStudents}</Text> : null}

      <Text style={s.section}>Le tue guide</Text>
      <ClayList style={s.list}>
        {sessions.map((g) => (
          <ClayListRow
            key={g.id}
            title={g.student?.name ?? 'Allievo'}
            subtitle={`${dayLabel(g.startedAt)} · ${formatHm(g.startedAt)} · ${errorsLabel(g.errors)} qui`}
            trailing={opening === g.id ? <ActivityIndicator size="small" color={CLAY.ink} /> : undefined}
            onPress={() => onOpenSession(g.id)}
            testID="hotspot-sheet-session"
          />
        ))}
      </ClayList>
      {moreSessions > 0 ? <Text style={s.more}>e altre {moreSessions} guide</Text> : null}

      {detail.hiddenSessions ? (
        <Text style={s.footnote}>
          {detail.hiddenSessions === 1
            ? "Un'altra guida passa da qui con lo stesso errore: è di un collega."
            : `Altre ${detail.hiddenSessions} guide passano da qui con lo stesso errore: sono di colleghi.`}
        </Text>
      ) : null}
    </View>
  );
});

const s = StyleSheet.create({
  trim: { marginBottom: -14 },
  stats: { flexDirection: 'row', gap: 10, marginTop: 4 },
  caption: { fontSize: 13, color: CLAY.ink3, marginTop: 10 },
  exam: { fontSize: 15, fontWeight: '500', color: CLAY.ink, marginTop: 14 },
  section: { fontSize: 17, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.3, marginTop: 24 },
  list: { marginTop: 10 },
  trail: { fontSize: 14, color: CLAY.ink3 },
  more: { fontSize: 13.5, color: CLAY.ink3, marginTop: 8, marginLeft: 4 },
  footnote: { fontSize: 13.5, lineHeight: 19, color: CLAY.ink3, marginTop: 16 },
  muted: { fontSize: 15, lineHeight: 21, color: CLAY.ink3 },
  skWrap: { marginTop: 24 },
});
