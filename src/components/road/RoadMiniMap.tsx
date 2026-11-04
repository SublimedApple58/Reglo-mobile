import React, { useEffect, useMemo, useRef } from 'react';
import { Platform, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import MapView from 'react-native-maps';
import type { RoadMarker, RoadStop } from '../../types/regloApi';
import { RoadEndpointDot, RoadMarkerPin, RoadStopMarker, RoadTrack } from './RoadMapParts';

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
 * Chiave di una segnalazione sulla mappa e negli elenchi (REG-715): il
 * `clientId`, nato sul telefono e unico anche sul server, resta uguale quando
 * il riepilogo provvisorio (REG-714, id = clientId) diventa quello del server.
 */
export const roadMarkerKey = (m: { id: string; clientId?: string }) => m.clientId || m.id;

/** Zoom su una segnalazione scelta: ~400 m di altezza. */
const FOCUS_DELTA = 0.0042;
/** Il segnaposto sta sopra il suo punto: per centrarlo si sale di mezza altezza. */
const PIN_HALF = 26;

/**
 * Mappa del percorso di una guida finita: inquadra tutto il percorso, con le
 * segnalazioni piccole. `interactive=false` = minimappa (nessun gesto).
 * REG-715: con `selectedId` la segnalazione scelta è grande e la camera ci va
 * sopra (300 ms); tornando a `null` reinquadra tutto. `onPressMarker` /
 * `tappable` = segnaposti toccabili senza i gesti della mappa (dentro un foglio).
 * `insets`: parti della mappa coperte (barra in alto, card in basso).
 */
export function RoadRouteMap({
  track,
  markers,
  stops,
  interactive = false,
  labeled = false,
  style,
  edgePadding = 26,
  selectedId = null,
  onPressMarker,
  onPressMap,
  tappable = false,
  insets,
}: {
  track: Array<[number, number, number]>;
  markers: RoadMarker[];
  /** REG-665: soste ≥ 5 min (capsula «Sosta X min» se `labeled`). */
  stops?: RoadStop[];
  interactive?: boolean;
  /** Segnalazioni con etichetta (mappa a tutto schermo). */
  labeled?: boolean;
  style?: StyleProp<ViewStyle>;
  edgePadding?: number;
  selectedId?: string | null;
  onPressMarker?: (key: string) => void;
  /** Tocco sulla mappa fuori dai segnaposti. */
  onPressMap?: () => void;
  tappable?: boolean;
  insets?: { top?: number; bottom?: number };
}) {
  const ref = useRef<MapView>(null);
  const size = useRef({ w: 0, h: 0 });
  const insetTop = insets?.top ?? 0;
  const insetBottom = insets?.bottom ?? 0;
  const coords = useMemo(() => track.map(([lat, lng]) => ({ latitude: lat, longitude: lng })), [track]);
  const all = useMemo(
    () => [...coords, ...markers.map((m) => ({ latitude: m.lat, longitude: m.lng }))],
    [coords, markers],
  );
  const initialRegion = useMemo(() => regionFor(all), [all]);

  const selected = selectedId ? markers.find((m) => roadMarkerKey(m) === selectedId) ?? null : null;
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  const fit = (animated = false) => {
    if (all.length < 2) return;
    ref.current?.fitToCoordinates(all, {
      edgePadding: {
        top: edgePadding + 26 + insetTop,
        right: edgePadding,
        bottom: edgePadding + insetBottom,
        left: edgePadding,
      },
      animated,
    });
  };

  // Camera sulla segnalazione scelta, al centro della parte libera della mappa.
  const focus = (m: { lat: number; lng: number }, duration = 300) => {
    const { w, h } = size.current;
    if (!w || !h) return;
    const d = FOCUS_DELTA;
    const offsetPx = (insetBottom - insetTop) / 2 - PIN_HALF;
    ref.current?.animateToRegion(
      {
        latitude: m.lat - (d * offsetPx) / h,
        longitude: m.lng,
        latitudeDelta: d,
        longitudeDelta: (d * (w / h)) / Math.cos((m.lat * Math.PI) / 180),
      },
      duration,
    );
  };

  // Senza scelta: tutto il percorso. Con: la segnalazione.
  const place = (animated: boolean) => {
    const sel = selectedRef.current;
    if (sel) focus(sel, animated ? 300 : 0);
    else fit(animated);
  };

  const selLat = selected?.lat;
  const selLng = selected?.lng;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    place(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, selLat, selLng]);

  // Callback stabili per segnaposto (RoadMarkerPin è memo).
  const pressHandlers = useMemo(() => {
    const out = new Map<string, () => void>();
    if (!onPressMarker) return out;
    for (const m of markers) {
      const k = roadMarkerKey(m);
      out.set(k, () => onPressMarker(k));
    }
    return out;
  }, [markers, onPressMarker]);

  const touchable = interactive || tappable || !!onPressMarker || !!onPressMap;

  return (
    <View
      style={[styles.wrap, style]}
      pointerEvents={touchable ? 'auto' : 'none'}
      // La mappa può essere pronta prima di avere le misure definitive del
      // contenitore: si reinquadra anche dopo il layout.
      onLayout={(e) => {
        size.current = { w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height };
        setTimeout(() => place(false), 60);
      }}
    >
      <MapView
        ref={ref}
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
        onMapReady={() => place(false)}
        // Logo e «Legale» di Apple Maps sempre visibili, sopra la card che copre la mappa.
        legalLabelInsets={insetBottom ? { top: 0, right: 0, bottom: insetBottom + 8, left: 18 } : undefined}
        onPress={
          onPressMap
            ? (e) => {
                // Il tocco su un segnaposto arriva anche alla mappa: va ignorato.
                if ((e.nativeEvent as { action?: string }).action === 'marker-press') return;
                onPressMap();
              }
            : undefined
        }
        mapType={Platform.OS === 'ios' ? 'mutedStandard' : 'standard'}
        showsPointsOfInterest={false}
        // Niente edifici 3D: su Apple Maps coprono il percorso, che è il dato di Road.
        showsBuildings={false}
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
        {(stops ?? []).map((st) => (
          <RoadStopMarker
            key={`stop-${st.startMs}`}
            coordinate={{ latitude: st.lat, longitude: st.lng }}
            minutes={st.minutes}
            labeled={labeled}
          />
        ))}
        {markers.map((m) => {
          const k = roadMarkerKey(m);
          const on = k === selectedId;
          return (
            <RoadMarkerPin
              key={k}
              coordinate={{ latitude: m.lat, longitude: m.lng }}
              kind={m.kind}
              label={m.label}
              small={!labeled && !on}
              zIndex={on ? 9 : undefined}
              sentiment={m.sentiment ?? null}
              onPress={pressHandlers.get(k)}
            />
          );
        })}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden', backgroundColor: '#FFFFFF' },
});
