import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Marker, Polyline } from 'react-native-maps';

import type { RoadPlanStop, RoadStudentHotspot } from '../../types/regloApi';
import { GUIDE_HOTSPOT_SLOTS, type LatLngTuple } from '../../road/roadGuide';
import { CLAY, CLAY_SHADOW } from '../../theme';
import { RoadMarkerPin } from './RoadMapParts';

/**
 * REG-652 — la guida del giro sulla mappa di Road: linea suggerita (grigio
 * scuro sottile, mai blu; la parte già fatta si attenua), punti critici
 * dell'allievo col fumetto di REG-646, tappe numerate, sede.
 *
 * TUTTO a posti fissi, sempre montato e messo PRIMA degli altri figli della
 * MapView: aggiungere/togliere figli fa crashare react-native-maps 1.20 con la
 * New Architecture (`AIRMap insertReactSubview`, REG-649). I posti vuoti stanno
 * sul centro con opacità 0.
 */

const STOP_SLOTS = 3;
const LINE_AHEAD = 'rgba(17,17,17,0.5)';
const LINE_PASSED = 'rgba(17,17,17,0.16)';
const FADE_MS = 240;

type Pt = { latitude: number; longitude: number };

/** Dissolvenza della linea in 240 ms (le Polyline non hanno animazioni proprie). */
function useFade(on: boolean) {
  const [k, setK] = useState(on ? 1 : 0);
  useEffect(() => {
    const from = k;
    const to = on ? 1 : 0;
    if (from === to) return;
    const t0 = Date.now();
    const id = setInterval(() => {
      const p = Math.min(1, (Date.now() - t0) / FADE_MS);
      setK(from + (to - from) * p);
      if (p >= 1) clearInterval(id);
    }, 40);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on]);
  return k;
}

const withAlpha = (rgba: string, k: number) =>
  rgba.replace(/[\d.]+\)$/, (a) => `${(parseFloat(a) * k).toFixed(3)})`);

export const RoadGuideOverlay = React.memo(function RoadGuideOverlay({
  line,
  passed,
  stops,
  reached,
  end,
  hotspots,
  center,
}: {
  line: LatLngTuple[] | null;
  passed: number;
  stops: RoadPlanStop[];
  reached: string[];
  end: { lat: number; lng: number } | null;
  hotspots: RoadStudentHotspot[];
  center: { lat: number; lng: number };
}) {
  const pts = useMemo<Pt[] | null>(
    () => (line && line.length >= 2 ? line.map(([la, ln]) => ({ latitude: la, longitude: ln })) : null),
    [line],
  );
  // Posto vuoto: due punti uguali sul centro, trasparenti.
  const still = useMemo<Pt[]>(
    () => [
      { latitude: center.lat, longitude: center.lng },
      { latitude: center.lat, longitude: center.lng },
    ],
    // Il centro serve solo per il primo montaggio.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const cut = pts ? Math.min(Math.max(0, passed), pts.length - 1) : 0;
  const ahead = useMemo(() => (pts ? pts.slice(cut) : still), [pts, cut, still]);
  const done = useMemo(() => (pts && cut > 0 ? pts.slice(0, cut + 1) : still), [pts, cut, still]);
  const k = useFade(!!pts);

  return (
    <>
      <Polyline coordinates={done} strokeColor={withAlpha(LINE_PASSED, cut > 0 ? k : 0)} strokeWidth={4} lineCap="round" lineJoin="round" zIndex={0} />
      <Polyline coordinates={ahead.length >= 2 ? ahead : still} strokeColor={withAlpha(LINE_AHEAD, ahead.length >= 2 ? k : 0)} strokeWidth={4} lineCap="round" lineJoin="round" zIndex={0} />
      {Array.from({ length: GUIDE_HOTSPOT_SLOTS }, (_, i) => (
        <HotspotSlot key={`h${i}`} hotspot={hotspots[i] ?? null} center={still[0]} />
      ))}
      {Array.from({ length: STOP_SLOTS }, (_, i) => {
        const st = stops[i];
        return (
          <GuideStopMarker
            key={`s${i}`}
            lat={st?.lat ?? center.lat}
            lng={st?.lng ?? center.lng}
            n={i + 1}
            opacity={!st ? 0 : reached.includes(st.key) ? 0.45 : 1}
          />
        );
      })}
      <GuideHqMarker lat={end?.lat ?? center.lat} lng={end?.lng ?? center.lng} visible={!!end} />
    </>
  );
});

const HotspotSlot = React.memo(function HotspotSlot({ hotspot, center }: { hotspot: RoadStudentHotspot | null; center: Pt }) {
  const coordinate = useMemo(
    () => (hotspot ? { latitude: hotspot.lat, longitude: hotspot.lng } : center),
    [hotspot, center],
  );
  return (
    <RoadMarkerPin
      coordinate={coordinate}
      kind={hotspot?.kind ?? 'altro'}
      label={hotspot?.label ?? ''}
      small
      sentiment="bad"
      dot={false}
      hidden={!hotspot}
      zIndex={2}
    />
  );
});

const GuideStopMarker = React.memo(function GuideStopMarker({ lat, lng, n, opacity }: { lat: number; lng: number; n: number; opacity: number }) {
  const [ready, setReady] = useState(false);
  const coordinate = useMemo(() => ({ latitude: lat, longitude: lng }), [lat, lng]);
  return (
    <Marker coordinate={coordinate} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={!ready} opacity={opacity} zIndex={4}>
      <View style={[s.stop, CLAY_SHADOW.raiseSm]} onLayout={() => setReady(true)}>
        <Text style={s.stopTx}>{n}</Text>
      </View>
    </Marker>
  );
});

const GuideHqMarker = React.memo(function GuideHqMarker({ lat, lng, visible }: { lat: number; lng: number; visible: boolean }) {
  const [ready, setReady] = useState(false);
  const coordinate = useMemo(() => ({ latitude: lat, longitude: lng }), [lat, lng]);
  return (
    <Marker coordinate={coordinate} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={!ready} opacity={visible ? 1 : 0} zIndex={3}>
      <View style={s.hq} onLayout={() => setReady(true)}>
        <View style={[s.hqIc, CLAY_SHADOW.raiseSm]}>
          <View style={s.hqDot} />
        </View>
        <Text style={s.hqTx}>Sede</Text>
      </View>
    </Marker>
  );
});

const s = StyleSheet.create({
  // Come le tappe della tab Road (REG-649): cerchio nero, numero bianco.
  stop: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: CLAY.ink,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopTx: { color: '#FFFFFF', fontSize: 12.5, fontWeight: '600', fontVariant: ['tabular-nums'] },
  hq: { alignItems: 'center', gap: 4 },
  hqIc: { width: 26, height: 26, borderRadius: 13, backgroundColor: CLAY.surface, alignItems: 'center', justifyContent: 'center' },
  hqDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: CLAY.ink },
  hqTx: {
    fontSize: 12.5,
    fontWeight: '600',
    color: CLAY.ink,
    textShadowColor: 'rgba(255,255,255,0.95)',
    textShadowRadius: 3,
    textShadowOffset: { width: 0, height: 0 },
  },
});
