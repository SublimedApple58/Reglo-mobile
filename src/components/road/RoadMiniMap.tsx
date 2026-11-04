import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import MapView from 'react-native-maps';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import type { RoadMarker, RoadStop } from '../../types/regloApi';
import { RoadEndpointDot, RoadMarkerPin, RoadPinBody, RoadStopMarker, RoadTrack, ROAD_PIN_POINT_Y } from './RoadMapParts';
import { SOFT } from '../../utils/motion';

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
/** Durata del volo della camera sulla segnalazione scelta. */
const FLY_MS = 300;

/**
 * Firma dei dati disegnati: cambia solo se cambia davvero qualcosa sulla mappa
 * (punti del percorso, segnalazioni e loro segno, soste).
 */
function dataSignature(track: Array<[number, number, number]>, markers: RoadMarker[], stops?: RoadStop[]) {
  const first = track[0];
  const last = track[track.length - 1];
  return [
    track.length,
    first ? `${first[0]},${first[1]}` : '',
    last ? `${last[0]},${last[1]}` : '',
    markers.map((m) => `${roadMarkerKey(m)}:${m.kind}:${m.label}:${m.sentiment ?? ''}:${m.lat},${m.lng}`).join('|'),
    (stops ?? []).map((s) => `${s.startMs}:${s.minutes}`).join('|'),
  ].join('#');
}

/**
 * Mappa del percorso di una guida finita: inquadra tutto il percorso, con le
 * segnalazioni piccole. `interactive=false` = minimappa (nessun gesto).
 *
 * REG-715 — regola: DENTRO la MapView niente cambia dopo il montaggio. Su iOS
 * (react-native-maps 1.20 via l'interop della New Architecture) un figlio che
 * cambia props fa reinserire i figli in `AIRMap insertReactSubview:atIndex:`,
 * che va fuori indice: segnaposti spariti (il problema aperto di REG-714) o
 * app chiusa. Quindi:
 * - dati nuovi (correzione, punti tardivi, provvisorio → server) = MapView
 *   rimontata (`key` = firma dei dati); i figli sono derivati solo dalla firma;
 * - segnalazione scelta (`selectedId`) = camera che ci vola sopra (300 ms) e il
 *   segnaposto grande disegnato SOPRA la mappa (`RoadPinBody`), nel punto
 *   proiettato, in dissolvenza; mentre la mappa si muove non si vede.
 * `onPressMarker` / `onPressMap` = segnaposti e mappa toccabili; `insets` =
 * parti coperte (barra in alto, card in basso: `mapPadding` fisso).
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
  insets?: { top?: number; bottom?: number };
}) {
  const ref = useRef<MapView>(null);
  const size = useRef({ w: 0, h: 0 });
  const insetTop = insets?.top ?? 0;
  const insetBottom = insets?.bottom ?? 0;

  // Dati congelati sulla firma: stessi oggetti finché la mappa non va rimontata.
  const sig = dataSignature(track, markers, stops);
  const frozen = useMemo(() => {
    const coords = track.map(([lat, lng]) => ({ latitude: lat, longitude: lng }));
    const all = [...coords, ...markers.map((m) => ({ latitude: m.lat, longitude: m.lng }))];
    return { coords, all, markers, stops: stops ?? [], initialRegion: regionFor(all) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  const selected = selectedId ? frozen.markers.find((m) => roadMarkerKey(m) === selectedId) ?? null : null;
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  // `mapPadding` stabile: le parti coperte sono fuori dall'area utile (anche logo e «Legale»).
  const mapPadding = useMemo(
    () => (insetTop || insetBottom ? { top: insetTop, right: 0, bottom: insetBottom, left: 0 } : undefined),
    [insetTop, insetBottom],
  );

  const fit = (animated = false) => {
    if (frozen.all.length < 2) return;
    ref.current?.fitToCoordinates(frozen.all, {
      // `fitToCoordinates` rispetta `mapPadding`: qui solo il respiro.
      edgePadding: { top: edgePadding + 26, right: edgePadding, bottom: edgePadding, left: edgePadding },
      animated,
    });
  };

  // Camera sulla segnalazione, al centro della parte libera: su iOS
  // `animateToRegion` centra già nell'area di `mapPadding` (verificato sul
  // simulatore); qui solo mezzo segnaposto, perché il fumetto sta sopra il punto.
  const focus = (m: { lat: number; lng: number }, duration: number) => {
    const { w } = size.current;
    const h = size.current.h - insetTop - insetBottom;
    if (!w || !(h > 0)) return;
    const d = FOCUS_DELTA;
    const offsetPx = -PIN_HALF;
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

  // ─── Segnaposto scelto, disegnato sopra la mappa ──────────────────────────
  const [overlay, setOverlay] = useState<{ x: number; y: number; m: RoadMarker } | null>(null);
  const shown = useSharedValue(0);
  const overlayStyle = useAnimatedStyle(() => ({ opacity: shown.value }));
  const hideOverlay = useCallback(() => {
    shown.value = withTiming(0, { duration: 100, easing: SOFT });
  }, [shown]);
  const placeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const settleOverlay = useCallback(async () => {
    const sel = selectedRef.current;
    if (!sel) return;
    const p = await ref.current?.pointForCoordinate({ latitude: sel.lat, longitude: sel.lng });
    if (!p || selectedRef.current !== sel) return;
    setOverlay({ x: p.x, y: p.y, m: sel });
    shown.value = withTiming(1, { duration: 180, easing: SOFT });
  }, [shown]);

  // Senza scelta: tutto il percorso. Con: la segnalazione, poi il segnaposto grande.
  const place = (animated: boolean) => {
    clearTimeout(placeTimer.current);
    const sel = selectedRef.current;
    if (sel) {
      focus(sel, animated ? FLY_MS : 0);
      // Il segnaposto grande arriva a camera ferma (`onRegionChangeComplete`); il
      // timer è solo una rete di sicurezza se la camera non si muove.
      placeTimer.current = setTimeout(() => void settleOverlay(), (animated ? FLY_MS : 0) + 500);
    } else {
      fit(animated);
    }
  };

  const selLat = selected?.lat;
  const selLng = selected?.lng;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    hideOverlay();
    place(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, selLat, selLng]);
  useEffect(() => () => clearTimeout(placeTimer.current), []);

  // Callback stabili per segnaposto (una per chiave, per sempre): i props dei
  // Marker non cambiano mai.
  const onPressRef = useRef(onPressMarker);
  onPressRef.current = onPressMarker;
  const handlers = useRef(new Map<string, () => void>());
  const handlerFor = (k: string) => {
    let fn = handlers.current.get(k);
    if (!fn) {
      fn = () => onPressRef.current?.(k);
      handlers.current.set(k, fn);
    }
    return fn;
  };
  const hasPress = !!onPressMarker;
  const onPressMapRef = useRef(onPressMap);
  onPressMapRef.current = onPressMap;

  const touchable = interactive || hasPress || !!onPressMap;

  // Anche i props della MapView restano gli stessi fra un render e l'altro.
  const placeRef = useRef(place);
  placeRef.current = place;
  const onMapReady = useCallback(() => placeRef.current(false), []);
  const onMapPress = useCallback((e: { nativeEvent: unknown }) => {
    // Il tocco su un segnaposto arriva anche alla mappa: va ignorato.
    if ((e.nativeEvent as { action?: string }).action === 'marker-press') return;
    onPressMapRef.current?.();
  }, []);
  const onRegionDone = useCallback(() => {
    clearTimeout(placeTimer.current);
    void settleOverlay();
  }, [settleOverlay]);

  return (
    <View
      style={[styles.wrap, style]}
      pointerEvents={touchable ? 'auto' : 'none'}
      // La mappa può essere pronta prima di avere le misure definitive del
      // contenitore: si reinquadra anche dopo il layout.
      onLayout={(e) => {
        size.current = { w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height };
        setTimeout(() => placeRef.current(false), 60);
      }}
    >
      <MapView
        key={sig}
        ref={ref}
        style={StyleSheet.absoluteFill}
        initialRegion={frozen.initialRegion}
        onMapReady={onMapReady}
        mapPadding={mapPadding}
        onPress={onMapPress}
        // Mappa in movimento (camera o dito): il segnaposto grande sparisce e
        // torna, nel punto giusto, a mappa ferma.
        onRegionChange={hideOverlay}
        onRegionChangeComplete={onRegionDone}
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
        liteMode={Platform.OS === 'android' && !touchable}
        userInterfaceStyle="light"
      >
        <RoadTrack coordinates={frozen.coords} width={interactive ? 6 : 5} />
        {frozen.coords.length > 1 ? <RoadEndpointDot coordinate={frozen.coords[0]} /> : null}
        {frozen.coords.length > 1 ? <RoadEndpointDot coordinate={frozen.coords[frozen.coords.length - 1]} /> : null}
        {frozen.stops.map((st) => (
          <RoadStopMarker
            key={`stop-${st.startMs}`}
            coordinate={{ latitude: st.lat, longitude: st.lng }}
            minutes={st.minutes}
            labeled={labeled}
          />
        ))}
        {frozen.markers.map((m) => {
          const k = roadMarkerKey(m);
          return (
            <RoadMarkerPin
              key={k}
              coordinate={{ latitude: m.lat, longitude: m.lng }}
              kind={m.kind}
              label={m.label}
              small={!labeled}
              sentiment={m.sentiment ?? null}
              onPress={hasPress ? handlerFor(k) : undefined}
            />
          );
        })}
      </MapView>

      {overlay && selected ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.overlay, { left: overlay.x - OVERLAY_W / 2, top: overlay.y - ROAD_PIN_POINT_Y }, overlayStyle]}
        >
          <RoadPinBody kind={overlay.m.kind} label={overlay.m.label} sentiment={overlay.m.sentiment ?? null} />
        </Animated.View>
      ) : null}
    </View>
  );
}

/** Larghezza della scatola del segnaposto grande (centrato sul punto). */
const OVERLAY_W = 260;

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden', backgroundColor: '#FFFFFF' },
  overlay: { position: 'absolute', width: OVERLAY_W, alignItems: 'center' },
});
