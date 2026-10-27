import React, { useMemo, useRef } from 'react';
import { Platform, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import MapView from 'react-native-maps';
import type { RoadMarker } from '../../types/regloApi';
import { RoadEndpointDot, RoadMarkerPin, RoadTrack } from './RoadMapParts';

type LatLng = { latitude: number; longitude: number };

/** Regione che contiene tutti i punti (prima del fit nativo, niente salti). */
export function regionFor(points: LatLng[]) {
  if (!points.length) {
    // Torino centro: fallback se una guida non ha punti.
    return { latitude: 45.0703, longitude: 7.6869, latitudeDelta: 0.03, longitudeDelta: 0.03 };
  }
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  for (const p of points) {
    minLat = Math.min(minLat, p.latitude);
    maxLat = Math.max(maxLat, p.latitude);
    minLng = Math.min(minLng, p.longitude);
    maxLng = Math.max(maxLng, p.longitude);
  }
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max(0.004, (maxLat - minLat) * 1.5),
    longitudeDelta: Math.max(0.004, (maxLng - minLng) * 1.5),
  };
}

/**
 * Mappa del percorso di una guida finita: inquadra tutto il percorso, con le
 * segnalazioni piccole. `interactive=false` = minimappa (nessun gesto).
 */
export function RoadRouteMap({
  track,
  markers,
  interactive = false,
  labeled = false,
  style,
  edgePadding = 26,
}: {
  track: Array<[number, number, number]>;
  markers: RoadMarker[];
  interactive?: boolean;
  /** Segnalazioni con etichetta (mappa a tutto schermo). */
  labeled?: boolean;
  style?: StyleProp<ViewStyle>;
  edgePadding?: number;
}) {
  const ref = useRef<MapView>(null);
  const coords = useMemo(() => track.map(([lat, lng]) => ({ latitude: lat, longitude: lng })), [track]);
  const all = useMemo(
    () => [...coords, ...markers.map((m) => ({ latitude: m.lat, longitude: m.lng }))],
    [coords, markers],
  );
  const initialRegion = useMemo(() => regionFor(all), [all]);

  const fit = () => {
    if (all.length < 2) return;
    ref.current?.fitToCoordinates(all, {
      edgePadding: { top: edgePadding + 26, right: edgePadding, bottom: edgePadding, left: edgePadding },
      animated: false,
    });
  };

  return (
    <View style={[styles.wrap, style]} pointerEvents={interactive ? 'auto' : 'none'}>
      <MapView
        ref={ref}
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
        onMapReady={fit}
        mapType={Platform.OS === 'ios' ? 'mutedStandard' : 'standard'}
        showsPointsOfInterest={false}
        showsBuildings
        showsCompass={false}
        showsScale={false}
        toolbarEnabled={false}
        scrollEnabled={interactive}
        zoomEnabled={interactive}
        rotateEnabled={interactive}
        pitchEnabled={false}
        liteMode={Platform.OS === 'android' && !interactive}
        userInterfaceStyle="light"
      >
        <RoadTrack coordinates={coords} width={interactive ? 6 : 5} />
        {coords.length > 1 ? <RoadEndpointDot coordinate={coords[0]} /> : null}
        {coords.length > 1 ? <RoadEndpointDot coordinate={coords[coords.length - 1]} /> : null}
        {markers.map((m) => (
          <RoadMarkerPin
            key={m.id || m.clientId}
            coordinate={{ latitude: m.lat, longitude: m.lng }}
            kind={m.kind}
            label={m.label}
            small={!labeled}
          />
        ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden', backgroundColor: '#F4F1EA' },
});
