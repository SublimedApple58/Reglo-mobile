import React, { useMemo, useRef } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';

import type { RoadPlanStop } from '../../types/regloApi';
import { regionFor } from './RoadMiniMap';

type Pt = { lat: number; lng: number };

/**
 * REG-667 — il giro sulla mappa: la linea suggerita (strade vere, chiusa in
 * sede), la sede e le tappe numerate (lo stesso numero della lista). Senza
 * linea (rete o Google giù) restano sede e tappe.
 * `interactive=false` = miniatura ferma (Android: liteMode).
 * Una sola per schermata (fluidità §15): mai in una lista.
 */
export const RoadPlanMap = React.memo(function RoadPlanMap({
  line,
  stops,
  start,
  interactive = false,
  small = false,
  edgePadding = 24,
}: {
  line: Array<[number, number]> | null | undefined;
  stops: RoadPlanStop[];
  start: Pt | null;
  interactive?: boolean;
  /** Numeri e linea più piccoli (miniatura). */
  small?: boolean;
  edgePadding?: number;
}) {
  const ref = useRef<MapView>(null);
  const coords = useMemo(() => (line ?? []).map(([latitude, longitude]) => ({ latitude, longitude })), [line]);
  const all = useMemo(() => {
    const pts = [...coords, ...stops.map((x) => ({ latitude: x.lat, longitude: x.lng }))];
    if (start) pts.push({ latitude: start.lat, longitude: start.lng });
    return pts;
  }, [coords, stops, start]);
  const region = useMemo(() => {
    const r = regionFor(all);
    // Quadrato con un po' di margine: la miniatura è quadrata.
    const d = Math.max(r.latitudeDelta, r.longitudeDelta) * (small ? 1.05 : 1);
    return small ? { ...r, latitudeDelta: d, longitudeDelta: d } : r;
  }, [all, small]);
  const fit = () => {
    if (small || all.length < 2) return;
    ref.current?.fitToCoordinates(all, {
      edgePadding: { top: edgePadding, right: edgePadding, bottom: edgePadding, left: edgePadding },
      animated: false,
    });
  };
  return (
    <MapView
      ref={ref}
      style={StyleSheet.absoluteFill}
      initialRegion={region}
      region={small ? region : undefined}
      onMapReady={fit}
      mapType={Platform.OS === 'ios' ? 'mutedStandard' : 'standard'}
      showsPointsOfInterest={false}
      showsBuildings={false}
      showsCompass={false}
      showsScale={false}
      toolbarEnabled={false}
      scrollEnabled={interactive}
      zoomEnabled={interactive}
      rotateEnabled={false}
      pitchEnabled={false}
      liteMode={Platform.OS === 'android' && !interactive}
      userInterfaceStyle="light"
    >
      {coords.length >= 2 ? (
        <Polyline coordinates={coords} strokeColor="#111111" strokeWidth={small ? 3 : 5} lineCap="round" lineJoin="round" zIndex={1} />
      ) : null}
      {start ? <StartMarker lat={start.lat} lng={start.lng} small={small} /> : null}
      {stops.map((x, i) => (
        <NumMarker key={x.key} lat={x.lat} lng={x.lng} n={i + 1} small={small} />
      ))}
    </MapView>
  );
});

const NumMarker = React.memo(function NumMarker({ lat, lng, n, small }: { lat: number; lng: number; n: number; small: boolean }) {
  const coordinate = useMemo(() => ({ latitude: lat, longitude: lng }), [lat, lng]);
  return (
    <Marker coordinate={coordinate} anchor={{ x: 0.5, y: 0.5 }} zIndex={3}>
      <View style={[s.num, small && s.numSmall]} pointerEvents="none">
        <Text style={[s.numTx, small && s.numTxSmall]}>{n}</Text>
      </View>
    </Marker>
  );
});

const StartMarker = React.memo(function StartMarker({ lat, lng, small }: { lat: number; lng: number; small: boolean }) {
  const coordinate = useMemo(() => ({ latitude: lat, longitude: lng }), [lat, lng]);
  return (
    <Marker coordinate={coordinate} anchor={{ x: 0.5, y: 0.5 }} zIndex={2}>
      <View style={[s.start, small && s.startSmall]} pointerEvents="none" />
    </Marker>
  );
});

const s = StyleSheet.create({
  num: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    boxShadow: '0px 2px 6px rgba(0,0,0,0.3)',
  },
  numSmall: { width: 20, height: 20, borderRadius: 10, borderWidth: 2 },
  numTx: { color: '#FFFFFF', fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
  numTxSmall: { fontSize: 10.5 },
  start: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#FFFFFF', borderWidth: 4, borderColor: '#111111' },
  startSmall: { width: 11, height: 11, borderRadius: 5.5, borderWidth: 3 },
});
