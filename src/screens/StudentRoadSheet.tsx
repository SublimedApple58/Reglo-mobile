import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, InteractionManager, Platform, StyleSheet, Text, View } from 'react-native';
import MapView from 'react-native-maps';
import { useLocalSearchParams, useRouter, useSegments } from 'expo-router';
import Animated from 'react-native-reanimated';

import { FormSheet } from '../components/SheetScaffold';
import { ClayButton, ClayEmpty, ClayList, ClayListRow, ClayStat, ClaySurface } from '../components/clay';
import { BriefingRows, RouteThumb } from '../components/road/RoadTabParts';
import { HeatHalo, RoadMarkerPin } from '../components/road/RoadMapParts';
import { SkeletonBlock } from '../components/Skeleton';
import { ROAD_FADE_IN } from '../road/motion';
import { openRoadPercorso } from '../road/openRoadPercorso';
import { formatKm } from '../road/format';
import { markerArt } from '../road/markerArt';
import { retryRoadStudent, useRoadStudentState } from '../road/avvioFlow';
import type { RoadStudentHotspot, RoadStudentItem } from '../types/regloApi';
import { CLAY, CLAY_SHADOW } from '../theme';
import { MORALE_ART } from '../theme/moraleArt';

/** Guide mostrate prima di «Tutte le guide». */
const FIRST_GUIDES = 5;
const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

function longDay(iso: string) {
  const t = new Date(iso).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
  return t ? t[0].toUpperCase() + t.slice(1) : t;
}
function hoursOf(sec: number) {
  const h = sec / 3600;
  return h < 1 ? `${Math.round(sec / 60)}` : (Math.round(h * 2) / 2).toLocaleString('it-IT');
}
function guideLine(it: RoadStudentItem) {
  const ev = it.evaluation;
  const pg = ev ? (ev.done >= ev.total ? 'pagellino fatto' : ev.done === 0 ? 'pagellino da fare' : `pagellino ${ev.done} su ${ev.total}`) : null;
  return [`${formatKm(it.distanceMeters)} km`, `${Math.max(1, Math.round(it.durationSec / 60))} min`, pg].filter(Boolean).join(' · ');
}

type Row = { kind: 'guide'; item: RoadStudentItem } | { kind: 'more'; count: number };

/**
 * REG-663 (piano 005) — «Road di <allievo>»: tutto Road di un allievo, dal
 * suo dettaglio (riga «Road»). Numeri, una mappa coi suoi errori ripetuti
 * (montata dopo l'animazione del foglio), «Da migliorare» (briefing delle
 * ultime guide) e le sue guide (→ «Percorso Road»). Dati dalla cache del
 * dettaglio allievo (`useRoadStudent`): al tocco non parte nessuna chiamata.
 * Form sheet che abbraccia il contenuto e scorre da sé (lista del foglio).
 */
export function StudentRoadSheet() {
  const router = useRouter();
  const segments = useSegments() as string[];
  const stack = segments[1] === 'notes' ? 'notes' : 'home';
  const { studentId, name } = useLocalSearchParams<{ studentId: string; name?: string }>();
  const sid = studentId ? String(studentId) : null;
  const { data, failed } = useRoadStudentState(sid);
  const first = firstName(String(name ?? 'Allievo'));
  const [all, setAll] = useState(false);

  const items = useMemo(() => data?.items ?? [], [data]);
  const totals = useMemo(
    () => ({
      meters: items.reduce((n, it) => n + it.distanceMeters, 0),
      sec: items.reduce((n, it) => n + it.durationSec, 0),
      markers: items.reduce((n, it) => n + it.markerCount, 0),
    }),
    [items],
  );
  const oldest = items.length ? items[items.length - 1].startedAt : null;
  const since = oldest
    ? new Date(oldest).toLocaleDateString('it-IT', { month: 'long' })
    : null;
  const subtitle =
    data === undefined ? (failed ? 'Guide non caricate' : ' ') : items.length ? `${items.length === 1 ? '1 guida' : `${items.length} guide`}${since ? ` da ${since}` : ''}` : 'Ancora nessuna guida';

  const rows: Row[] = useMemo(() => {
    const shown = all ? items : items.slice(0, FIRST_GUIDES);
    const out: Row[] = shown.map((item) => ({ kind: 'guide', item }));
    if (!all && items.length > FIRST_GUIDES) out.push({ kind: 'more', count: items.length });
    return out;
  }, [items, all]);

  const open = useCallback((id: string) => openRoadPercorso(router, stack, id), [router, stack]);

  const header =
    data === undefined && failed && sid ? (
      // REG-694: errore ≠ «Ancora nessuna guida».
      <Animated.View entering={ROAD_FADE_IN} testID="student-road-error">
        <Text style={s.errTitle}>Non riesco a caricare le guide in Road</Text>
        <Text style={s.errTx}>Controlla la connessione e riprova.</Text>
        <ClayButton title="Riprova" variant="secondary" onPress={() => retryRoadStudent(sid)} style={s.errBtn} testID="student-road-retry" />
      </Animated.View>
    ) : data === undefined ? (
      <View testID="student-road-skeleton">
        <View style={s.stats}>
          {[0, 1, 2].map((i) => (
            <SkeletonBlock key={i} height={74} radius={22} style={{ flex: 1 }} />
          ))}
        </View>
        <SkeletonBlock height={150} radius={24} style={{ marginTop: 14 }} />
      </View>
    ) : !items.length ? (
      <ClayEmpty
        icon={MORALE_ART.piantina}
        title={`Ancora nessuna guida in Road con ${first}`}
        text="Le guide registrate con Road compaiono qui, con il percorso e le segnalazioni."
        testID="student-road-empty"
      />
    ) : (
      <Animated.View entering={ROAD_FADE_IN}>
        <View style={s.stats}>
          <ClayStat value={formatKm(totals.meters)} unit="km" label="Percorsi" style={{ flex: 1 }} />
          <ClayStat value={hoursOf(totals.sec)} unit={totals.sec < 3600 ? 'min' : 'h'} label="Di guida" style={{ flex: 1 }} />
          <ClayStat value={totals.markers} label="Segnalazioni" style={{ flex: 1 }} />
        </View>
        {data?.hotspots?.length ? <HotspotsMap hotspots={data.hotspots} /> : null}
        {data?.hotspots?.length ? <HotspotsList hotspots={data.hotspots} /> : null}
        {data?.briefing?.lines.length ? (
          <>
            <Text style={s.section}>Da migliorare</Text>
            <ClaySurface style={s.brief}>
              <Text style={s.briefTitle}>{data.briefing.title}</Text>
              <BriefingRows lines={data.briefing.lines} />
            </ClaySurface>
          </>
        ) : null}
        <Text style={s.section}>Le sue guide</Text>
      </Animated.View>
    );

  return (
    <FormSheet
      title={`Road di ${first}`}
      subtitle={subtitle}
      testID="student-road-sheet"
      list={{
        data: data && items.length ? [{ key: 'list' }] : [],
        keyExtractor: (r: { key: string }) => r.key,
        renderItem: () => <GuidesList rows={rows} onOpen={open} onMore={() => setAll(true)} />,
        initialNumToRender: 1,
      }}
    >
      {header}
    </FormSheet>
  );
}

/** Le guide in una superficie clay; righe statiche in memo. */
const GuidesList = React.memo(function GuidesList({
  rows,
  onOpen,
  onMore,
}: {
  rows: Row[];
  onOpen: (appointmentId: string) => void;
  onMore: () => void;
}) {
  return (
    <ClayList>
      {rows.map((r) =>
        r.kind === 'guide' ? (
          <ClayListRow
            key={r.item.id}
            leading={<RouteThumb thumb={r.item.thumb} size={52} carColor={null} />}
            title={r.item.startedAt ? longDay(r.item.startedAt) : 'Guida'}
            subtitle={guideLine(r.item)}
            onPress={() => onOpen(r.item.appointmentId)}
            testID="student-road-guide"
          />
        ) : (
          <ClayListRow key="more" title="Tutte le guide" subtitle={`${r.count} guide`} onPress={onMore} testID="student-road-more" />
        ),
      )}
    </ClayList>
  );
});

/**
 * REG-681: i suoi punti critici uno per uno, con l'andamento dei ripassi in
 * guida («Meglio» / «Ancora no»): in miglioramento, superato, o da lavorare.
 */
function hotspotSubtitle(h: RoadStudentHotspot): string {
  const errors = `${h.errors} ${h.errors === 1 ? 'errore' : 'errori'}`;
  const better = h.checks?.better ?? 0;
  const total = better + (h.checks?.worse ?? 0);
  const ripassi = total ? `, meglio ${better} su ${total}` : ` in ${h.sessions} ${h.sessions === 1 ? 'guida' : 'guide'}`;
  if (h.status === 'overcome') return `Superato · ${errors}${ripassi}`;
  if (h.status === 'improving') return `In miglioramento · ${errors}${ripassi}`;
  return `${errors}${ripassi}`;
}

const HotspotsList = React.memo(function HotspotsList({ hotspots }: { hotspots: RoadStudentHotspot[] }) {
  return (
    <>
      <Text style={s.section}>Punti critici</Text>
      <ClayList>
        {hotspots.slice(0, 8).map((h) => (
          <ClayListRow
            key={h.key}
            leading={<Image source={markerArt(h.kind)} style={s.hsImg} resizeMode="contain" />}
            title={h.street ? `${h.label} · ${h.street}` : h.label}
            subtitle={hotspotSubtitle(h)}
            dimmed={h.status === 'overcome'}
            testID="student-road-hotspot"
          />
        ))}
      </ClayList>
    </>
  );
});

/** Regione che contiene i punti, con un minimo. */
function regionFor(pts: Array<{ lat: number; lng: number }>) {
  const lats = pts.map((p) => p.lat);
  const lngs = pts.map((p) => p.lng);
  const [minLat, maxLat, minLng, maxLng] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * 2.4, 0.012),
    longitudeDelta: Math.max((maxLng - minLng) * 2.4, 0.012),
  };
}

/**
 * Una mappa sola coi suoi errori ripetuti (aloni + simbolo). Si monta dopo
 * la presentazione del foglio su un segnaposto della stessa misura e compare
 * in dissolvenza; i punti ci sono già al montaggio (niente figli che cambiano).
 */
const HotspotsMap = React.memo(function HotspotsMap({ hotspots }: { hotspots: RoadStudentHotspot[] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | null = null;
    const task = InteractionManager.runAfterInteractions(() => {
      t = setTimeout(() => setMounted(true), 120);
    });
    return () => {
      task.cancel();
      if (t) clearTimeout(t);
    };
  }, []);
  const shown = hotspots.slice(0, 8);
  const max = shown.reduce((m, h) => Math.max(m, h.errors), 0);
  const [region] = useState(() => regionFor(shown));
  return (
    <View style={[s.mapWrap, CLAY_SHADOW.raise]}>
      <View style={s.mapClip}>
        {mounted ? (
          <Animated.View entering={ROAD_FADE_IN} style={StyleSheet.absoluteFill}>
            <MapView
              style={StyleSheet.absoluteFill}
              initialRegion={region}
              mapType={Platform.OS === 'ios' ? 'mutedStandard' : 'standard'}
              showsPointsOfInterest={false}
              showsCompass={false}
              showsScale={false}
              showsTraffic={false}
              toolbarEnabled={false}
              scrollEnabled={false}
              zoomEnabled={false}
              rotateEnabled={false}
              pitchEnabled={false}
              userInterfaceStyle="light"
            >
              {shown.map((h) => (
                <HeatHalo key={`h-${h.key}`} lat={h.lat} lng={h.lng} k={max ? h.errors / max : 1} />
              ))}
              {shown.map((h) => (
                <RoadMarkerPin
                  key={`p-${h.key}`}
                  coordinate={{ latitude: h.lat, longitude: h.lng }}
                  kind={h.kind}
                  label={h.label}
                  small
                  sentiment="bad"
                  dot={false}
                />
              ))}
            </MapView>
          </Animated.View>
        ) : null}
      </View>
    </View>
  );
});

const s = StyleSheet.create({
  errTitle: { fontSize: 16, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.2 },
  errTx: { fontSize: 15, lineHeight: 21, color: CLAY.ink3, marginTop: 2 },
  errBtn: { marginTop: 16 },
  stats: { flexDirection: 'row', gap: 10 },
  hsImg: { width: 36, height: 36 },
  mapWrap: { marginTop: 14, borderRadius: 24, backgroundColor: CLAY.surface },
  mapClip: { height: 156, borderRadius: 24, overflow: 'hidden' },
  section: { fontSize: 15, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.2, paddingHorizontal: 4, marginTop: 24, marginBottom: 10 },
  brief: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6, borderRadius: 26 },
  briefTitle: { fontSize: 13.5, color: CLAY.ink3, marginBottom: 2 },
});
