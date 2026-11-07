import React, { useCallback, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';

import { FormSheet } from '../components/SheetScaffold';
import { RoadRouteMap, roadMarkerKey } from '../components/road/RoadMiniMap';
import { RoadMarkerRow, toMarkerItem, type RoadMarkerItem } from '../components/road/RoadMarkerList';
import { CLAY, CLAY_SHADOW } from '../theme';
import { SHEET_NIGHT, SHEET_NIGHT_SHADOW, useSheetNight } from '../theme/night';
import { lessonStudentName, useRoadSelector } from '../road/roadStore';
import { roadRouteMapStore } from '../road/routeMapStore';
import { openRoadMarkerMenu } from '../road/markerMenu';
import { refreshRoadSummary } from '../road/roadActions';
import { dayLabel } from '../road/format';
import type { RoadMarker, RoadStop } from '../types/regloApi';

const ROW_H = 58;

/**
 * REG-715 — «Tutte le segnalazioni» di una guida: UNA mappa fissa in alto e
 * l'elenco intero sotto (FlatList, righe memo). Tocco su una riga = la mappa
 * va sul segnaposto e lo ingrandisce; tocco su un segnaposto = l'elenco scorre
 * alla sua riga; tocco sulla mappa vuota = di nuovo tutto il percorso.
 * - `summary` (riepilogo a fine guida): dati vivi dello store Road, «⋯»
 *   corregge (cambia segno, elimina; anche senza rete, REG-714).
 * - `percorso` (storico, dettaglio guida): dati del foglio «Percorso», sola lettura.
 */
export function RoadMarkersSheet({ source }: { source: 'summary' | 'percorso' }) {
  // Ricca 7: aperto da Road di notte (fuori da Road sempre false).
  const night = useSheetNight();
  const summary = useRoadSelector((s) => s.summary);
  const live = useSyncExternalStore(roadRouteMapStore.subscribe, roadRouteMapStore.get);
  // Il percorso resta fermo finché il foglio è aperto (come il foglio «Percorso»).
  const [percorso] = useState(() => live);

  const data: {
    sessionId: string;
    title: string;
    markers: RoadMarker[];
    track: Array<[number, number, number]>;
    stops?: RoadStop[];
  } | null =
    source === 'summary'
      ? summary
        ? {
            sessionId: summary.id,
            title: `${lessonStudentName(summary.lesson)} · ${dayLabel(summary.lesson.startsAt).toLowerCase()}`,
            markers: summary.markers,
            track: summary.track,
            stops: summary.stops,
          }
        : null
      : percorso
        ? {
            sessionId: percorso.id,
            title: dayLabel(percorso.startedAt),
            markers: percorso.markers,
            track: percorso.track,
            stops: percorso.stops,
          }
        : null;

  const markers = data?.markers;
  const items = useMemo(() => (markers ?? []).map(toMarkerItem), [markers]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Scelta sparita (segnalazione eliminata): nessuna scelta.
  const selected = selectedId && items.some((i) => i.key === selectedId) ? selectedId : null;

  const listRef = useRef<FlatList<RoadMarkerItem>>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const onRow = useCallback((key: string) => {
    void Haptics.selectionAsync();
    setSelectedId((prev) => (prev === key ? null : key));
  }, []);

  const onPin = useCallback((key: string) => {
    void Haptics.selectionAsync();
    setSelectedId(key);
    const index = itemsRef.current.findIndex((i) => i.key === key);
    if (index >= 0) listRef.current?.scrollToIndex({ index, viewPosition: 0.5, animated: true });
  }, []);

  const onMap = useCallback(() => setSelectedId(null), []);

  const sessionId = data?.sessionId;
  const correctable = source === 'summary';
  const onMore = useCallback(
    (key: string) => {
      const m = (markers ?? []).find((x) => roadMarkerKey(x) === key);
      if (m && sessionId) openRoadMarkerMenu(sessionId, m, () => void refreshRoadSummary());
    },
    [markers, sessionId],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: RoadMarkerItem; index: number }) => (
      <RoadMarkerRow
        item={item}
        index={index}
        onPress={onRow}
        onMore={correctable ? onMore : undefined}
        selected={item.key === selected}
      />
    ),
    [onRow, onMore, correctable, selected],
  );

  if (!data) return <View style={[s.root, night && { backgroundColor: SHEET_NIGHT.bg }]} />;

  const n = data.markers.length;
  return (
    <FormSheet
      title={n === 1 ? '1 segnalazione' : `${n} segnalazioni`}
      subtitle={data.title}
      testID="road-markers-sheet"
      listRef={listRef}
      fixedTop={
        // La mappa si ritaglia nel figlio: l'ombra clay sta sul contenitore.
        <View style={[s.mapWrap, night ? [{ backgroundColor: SHEET_NIGHT.surface }, SHEET_NIGHT_SHADOW.raise] : CLAY_SHADOW.raise]}>
          <RoadRouteMap
            track={data.track}
            markers={data.markers}
            stops={data.stops}
            selectedId={selected}
            onPressMarker={onPin}
            onPressMap={onMap}
            style={s.map}
          />
        </View>
      }
      list={{
        data: items,
        renderItem,
        keyExtractor: (i: RoadMarkerItem) => i.key,
        extraData: selected,
        getItemLayout: (_: unknown, index: number) => ({ length: ROW_H, offset: ROW_H * index, index }),
        initialNumToRender: 12,
        windowSize: 7,
      }}
    />
  );
}

const s = StyleSheet.create({
  root: { backgroundColor: CLAY.bg },
  mapWrap: { borderRadius: 24, backgroundColor: CLAY.surface, marginTop: 2, marginBottom: 8 },
  map: { height: 236, borderRadius: 24, overflow: 'hidden' },
});
