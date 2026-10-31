import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Marker, Polyline } from 'react-native-maps';

import type { RoadPlanStop, RoadStudentHotspot } from '../../types/regloApi';
import { GUIDE_HOTSPOT_SLOTS, type LatLngTuple } from '../../road/roadGuide';
import { CLAY, CLAY_SHADOW } from '../../theme';
import { RoadMarkerPin } from './RoadMapParts';

/**
 * REG-652 — la guida del giro sulla mappa di Road: linea suggerita (nera con
 * bordo bianco da REG-679, mai blu; la parte già fatta sparisce), punti critici
 * dell'allievo col fumetto di REG-646, tappe numerate, sede.
 *
 * Riaggancio (REG-654): la linea nuova arriva al posto della vecchia, che sfuma
 * nei due posti `prev` (4 Polyline fisse in tutto).
 *
 * TUTTO a posti fissi, sempre montato e messo PRIMA degli altri figli della
 * MapView: aggiungere/togliere figli fa crashare react-native-maps 1.20 con la
 * New Architecture (`AIRMap insertReactSubview`, REG-649). I posti vuoti stanno
 * sul centro con opacità 0.
 */

const STOP_SLOTS = 3;
const LINE_AHEAD = 'rgba(17,17,17,0.92)';
const LINE_CASE = 'rgba(255,255,255,1)';
// REG-697: di notte la linea si inverte (chiara col bordo scuro) sulla mappa scura.
const LINE_AHEAD_NIGHT = 'rgba(242,242,242,0.95)';
const LINE_CASE_NIGHT = 'rgba(10,10,10,1)';
const LINE_W = 10; // REG-690: più spessa (prima 8/14)
const CASE_W = 16;
const FADE_MS = 240;

type Pt = { latitude: number; longitude: number };

type Shown = { ahead: Pt[]; done: Pt[]; cut: number } | null;

/**
 * Dissolvenza della linea in 240 ms, senza rimbalzo (le Polyline non hanno
 * animazioni proprie). Al riaggancio (REG-654) la linea vecchia sfuma nei suoi
 * due posti mentre la nuova compare: `p` va da 0 a 1, la nuova vale `p`, la
 * vecchia `1 - p`. Non dipende da «Riduci movimento».
 */
/** Passi della dissolvenza (uno ogni ~60 ms su 240 ms). */
const FADE_STEPS = 4;

function useLineFade(pts: Pt[] | null, shown: Shown) {
  const [p, setP] = useState(1);
  const [prev, setPrev] = useState<Shown>(null);
  const last = useRef<Shown>(null);
  const first = useRef(true);
  useEffect(() => {
    // Al primo montaggio senza linea non c'è niente da sfumare.
    if (first.current) {
      first.current = false;
      if (!pts) return;
    }
    setPrev(last.current);
    setP(0);
    // REG-698: niente setInterval a 40 ms (6 render delle 4 linee). Pochi passi
    // agganciati ai fotogrammi: si ridisegna solo quando cambia il passo.
    const t0 = Date.now();
    let step = 0;
    let raf = 0;
    const frame = () => {
      const x = Math.min(1, (Date.now() - t0) / FADE_MS);
      const next = Math.ceil(x * FADE_STEPS);
      if (next !== step) {
        step = next;
        const k = step / FADE_STEPS;
        setP(1 - (1 - k) * (1 - k));
      }
      if (x >= 1) {
        setPrev(null);
        return;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [pts]);
  // Dopo l'effetto qui sopra: per il prossimo cambio, la linea che si vede adesso.
  useEffect(() => {
    last.current = shown;
  });
  return { k: pts ? p : 0, prev, kPrev: prev ? 1 - p : 0 };
}

const withAlpha = (rgba: string, k: number) =>
  rgba.replace(/[\d.]+\)$/, (a) => `${(parseFloat(a) * k).toFixed(3)})`);

export const RoadGuideOverlay = React.memo(function RoadGuideOverlay({
  line,
  passed,
  stops,
  reached,
  skipped,
  end,
  hotspots,
  center,
  night = false,
}: {
  /** REG-697: mappa notte. */
  night?: boolean;
  line: LatLngTuple[] | null;
  passed: number;
  stops: RoadPlanStop[];
  reached: string[];
  /** REG-654: tappe lasciate perdere (attenuate come le raggiunte). */
  skipped: string[];
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
  // `done` resta per la dissolvenza del riaggancio (forma di `Shown`), non si disegna più.
  const { k, prev, kPrev } = useLineFade(pts, pts ? { ahead, done, cut } : null);
  const LA = night ? LINE_AHEAD_NIGHT : LINE_AHEAD;
  const LC = night ? LINE_CASE_NIGHT : LINE_CASE;

  return (
    <>
      {/* REG-679: il giro da fare è nero con un bordo bianco (si stacca dalla
          traccia grigia e dalle strade); il tratto già fatto sparisce, lì resta
          la traccia vera. Stessi 4 posti fissi di prima: bordo + linea per la
          linea vecchia che sfuma al riaggancio, bordo + linea per la nuova. */}
      <Polyline coordinates={prev && prev.ahead.length >= 2 ? prev.ahead : still} strokeColor={withAlpha(LC, prev && prev.ahead.length >= 2 ? kPrev : 0)} strokeWidth={CASE_W} lineCap="round" lineJoin="round" zIndex={0} />
      <Polyline coordinates={prev && prev.ahead.length >= 2 ? prev.ahead : still} strokeColor={withAlpha(LA, prev && prev.ahead.length >= 2 ? kPrev : 0)} strokeWidth={LINE_W} lineCap="round" lineJoin="round" zIndex={0} />
      <Polyline coordinates={ahead.length >= 2 ? ahead : still} strokeColor={withAlpha(LC, ahead.length >= 2 ? k : 0)} strokeWidth={CASE_W} lineCap="round" lineJoin="round" zIndex={0} />
      <Polyline coordinates={ahead.length >= 2 ? ahead : still} strokeColor={withAlpha(LA, ahead.length >= 2 ? k : 0)} strokeWidth={LINE_W} lineCap="round" lineJoin="round" zIndex={0} />
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
            opacity={!st ? 0 : reached.includes(st.key) || skipped.includes(st.key) ? 0.45 : 1}
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
