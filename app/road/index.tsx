import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
} from 'react-native';
import MapView, { Polyline, type Camera } from 'react-native-maps';
import { useKeepAwake } from 'expo-keep-awake';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, Easing, ReduceMotion } from 'react-native-reanimated';
import * as Location from 'expo-location';

import * as Haptics from '../../src/utils/haptics';
import { lessonStudentName, roadStore, useRoadSelector } from '../../src/road/roadStore';
import { endRoad, recordHotspotCheck, swapRoadMarkerPlace, undoHotspotCheck, undoRoadFree, undoRoadMarker } from '../../src/road/roadActions';
import { roadFreeStarted } from '../../src/road/freeStartStore';
import { ROAD_EXIT, ROAD_TEXT_IN } from '../../src/road/motion';
import { PLAN_ALERT_MS, PLAN_REACHED_MS } from '../../src/road/planAlerts';
import { openRoadPagellino } from '../../src/road/pagellino';
import { openRoadNotes, prefetchRoadNotes } from '../../src/road/roadNotes';
import { markerArt } from '../../src/road/markerArt';
import { formatHm, formatKm, formatMinutes, formatRange } from '../../src/road/format';
import { createLiveMotion, headingDelta, type MotionFix, type MotionSample } from '../../src/road/liveMotion';
import {
  AUTO_RETURN_MS,
  RETURN_MS,
  blendPose,
  cameraTarget,
  createLiveCamera,
  easeInOut,
  zoomForAltitude,
  type CamPose,
} from '../../src/road/liveCamera';
import {
  HOTSPOT_DECIDE_MS,
  createLineSnap,
  measureLine,
  navState,
  placeSteps,
  placeStops,
  type NavState,
} from '../../src/road/navGuide';
import { SentimentBadge } from '../../src/components/road/RoadSentiment';
import { Avatar, ClayButton } from '../../src/components/clay';
import { CLAY, CLAY_SHADOW } from '../../src/theme';
import { RoadMarkerPin } from '../../src/components/road/RoadMapParts';
import { RoadGuideOverlay } from '../../src/components/road/RoadGuideOverlay';
import { CAR_DISC, RoadLiveCar, RoadLiveCarMarker } from '../../src/components/road/RoadLiveCar';
import { RoadNavCard } from '../../src/components/road/RoadNavCard';
import { RoadHotspotCard } from '../../src/components/road/RoadHotspotCard';
import { fetchReroute, loadRoadGuide } from '../../src/road/roadGuide';
import { REROUTE_OFF_MS } from '../../src/road/reroute';
import { liveStatus, liveStatusLine, useLiveStatus } from '../../src/road/liveStatus';
import { fixHistory } from '../../src/road/fixHistory';
import type { RoadHotspotOutcome } from '../../src/types/regloApi';

/**
 * REG-638 Reglo Road — la guida in diretta, a tutto schermo.
 * REG-678…681 (redesign della guida live, Tiziano 30/10/2026):
 * - l'auto si muove fluida: la camera la segue fotogramma per fotogramma con
 *   la posizione stimata fra un punto GPS e l'altro (`liveMotion.ts`); l'auto è
 *   una vista ferma sullo schermo animata sul thread UI (`RoadLiveCar`);
 * - la mappa non si ridisegna a ogni punto GPS: ogni pezzo (linea, traccia,
 *   card, pannello) legge solo la sua parte dello stato Road;
 * - pan, zoom e rotazione nativi: un gesto sgancia la camera, «Ricentra» la
 *   riaggancia, la bussola rimette il nord;
 * - in alto la prossima svolta e la prossima tappa; i punti critici
 *   dell'allievo avvisano 180 m prima e sul punto si segna «Meglio» / «Ancora no».
 * REG-683 (piano 008 fase 1, 31/10/2026): il tocco sgancia la camera subito
 * (ref letto dal loop, niente più «mappa inchiodata»), dopo 10 s senza tocchi
 * torna da sola sull'auto con una fusione morbida, GPS da una sola fonte con
 * l'ora del fix, camera a ogni fotogramma con zoom e inclinazione automatici
 * (`liveCamera.ts`), auto agganciata alla linea del giro, traccia a pezzi.
 * Lo schermo resta acceso finché si è qui.
 */

// Spazio sopra/sotto in cui la mappa centra l'auto: la tiene sotto la metà
// dello schermo, con più strada davanti.
const MAP_PADDING_TOP = 330;
/** Il «Segnato» del ripasso resta 5 s (come il toast delle segnalazioni), poi la card si chiude. */
const CHECK_DONE_MS = 5_000;

/** Il primo fix GPS della guida (o null dopo 60 s): la linea parte da lì. */
function waitFirstFix(): Promise<{ lat: number; lng: number } | null> {
  const now = roadStore.get().fix;
  if (now) return Promise.resolve({ lat: now.lat, lng: now.lng });
  return new Promise((resolve) => {
    const done = (v: { lat: number; lng: number } | null) => {
      clearTimeout(t);
      off();
      resolve(v);
    };
    const off = roadStore.subscribe(() => {
      const f = roadStore.get().fix;
      if (f) done({ lat: f.lat, lng: f.lng });
    });
    const t = setTimeout(() => done(null), 60_000);
  });
}

const EMPTY_STOPS: never[] = [];
const EMPTY_HOTSPOTS: never[] = [];

function useNow(everyMs: number) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(t);
  }, [everyMs]);
  return now;
}

/**
 * Comparsa delle card: animazione esplicita (le `entering` di Reanimated non
 * partono se lo schermo è ancora coperto dal form sheet che si sta chiudendo).
 */
function RoadToastFrame({ children, style }: { children: React.ReactNode; style: object }) {
  const p = useSharedValue(0);
  useEffect(() => {
    // «Riduci movimento» non spegne niente (regola fissa).
    p.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.Never });
  }, [p]);
  const anim = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [{ translateY: (1 - p.value) * -12 }],
  }));
  // In uscita si dissolve (niente sparizioni di botto, §8).
  return <Animated.View exiting={ROAD_EXIT} style={[style, anim]}>{children}</Animated.View>;
}

// ─── Pezzi della mappa: ognuno legge solo la sua parte di stato ──────────────

const STILL = (c: { lat: number; lng: number }) => [
  { latitude: c.lat, longitude: c.lng },
  { latitude: c.lat, longitude: c.lng },
];

/**
 * La traccia fatta: grigia e sottile. REG-687: a pezzi. I pezzi chiusi non
 * cambiano più (stesso array → la mappa non li ridisegna) e a ogni punto GPS
 * si rimanda solo la coda; prima a ogni punto ripartiva verso la mappa TUTTA la
 * traccia, migliaia di punti a fine guida. Posti fissi, sempre montati (crash
 * AIRMap aggiungendo figli, vedi RoadGuideOverlay): TRACK_SLOTS pezzi + la coda.
 * Se i pezzi non bastano raddoppiano di lunghezza (si ricalcolano una volta).
 */
const TRACK_SLOTS = 10;
const TRACK_CHUNK = 300;
type TrackPt = { latitude: number; longitude: number };

function useTrackChunks(track: TrackPt[]) {
  const cache = useRef<{ first: TrackPt | null; size: number; chunks: TrackPt[][] }>({ first: null, size: TRACK_CHUNK, chunks: [] });
  const c = cache.current;
  let size = c.size;
  while (Math.floor(Math.max(0, track.length - 1) / size) > TRACK_SLOTS) size *= 2;
  // Traccia ricominciata o ricaricata dal server (punti aggiunti in testa): da capo.
  if (c.first !== (track[0] ?? null) || size !== c.size || c.chunks.length * c.size >= track.length) {
    cache.current = { first: track[0] ?? null, size, chunks: [] };
  }
  const cc = cache.current;
  // Ogni pezzo chiuso ripete l'ultimo punto del precedente: la linea resta continua.
  while ((cc.chunks.length + 1) * size < track.length) {
    const i = cc.chunks.length;
    cc.chunks.push(track.slice(i * size, (i + 1) * size + 1));
  }
  const tail = track.slice(cc.chunks.length * size);
  return { chunks: cc.chunks, tail };
}

const TRACK_INK = 'rgba(17,17,17,0.30)';
const TrackPiece = React.memo(function TrackPiece({ pts, still }: { pts: TrackPt[] | null; still: TrackPt[] }) {
  const on = !!pts && pts.length >= 2;
  return (
    <Polyline
      coordinates={on ? pts : still}
      strokeColor={on ? TRACK_INK : 'rgba(17,17,17,0)'}
      strokeWidth={5}
      lineCap="round"
      lineJoin="round"
      zIndex={1}
    />
  );
});

const LiveTrack = React.memo(function LiveTrack({ center }: { center: { lat: number; lng: number } }) {
  const track = useRoadSelector((s) => s.track);
  const still = useMemo(() => STILL(center), [center]);
  const { chunks, tail } = useTrackChunks(track);
  return (
    <>
      {Array.from({ length: TRACK_SLOTS }, (_, i) => (
        <TrackPiece key={i} pts={chunks[i] ?? null} still={still} />
      ))}
      <TrackPiece pts={tail} still={still} />
    </>
  );
});

const LiveGuide = React.memo(function LiveGuide({ center }: { center: { lat: number; lng: number } }) {
  const guide = useRoadSelector((s) => s.guide);
  const passed = useRoadSelector((s) => s.guidePassed);
  const reached = useRoadSelector((s) => s.planProgress.reached);
  const skipped = useRoadSelector((s) => s.reroute.skipped);
  return (
    <RoadGuideOverlay
      line={guide?.line ?? null}
      passed={passed}
      stops={guide?.stops ?? EMPTY_STOPS}
      reached={reached}
      skipped={skipped}
      end={guide?.end ?? null}
      hotspots={guide?.hotspots ?? EMPTY_HOTSPOTS}
      center={center}
    />
  );
});

const LivePins = React.memo(function LivePins() {
  const markers = useRoadSelector((s) => s.markers);
  const lastId = markers.length ? markers[markers.length - 1].clientId : null;
  return (
    <>
      {markers.map((m) => (
        <RoadMarkerPin
          key={m.clientId}
          coordinate={{ latitude: m.lat, longitude: m.lng }}
          kind={m.kind}
          label={m.label}
          small={m.clientId !== lastId}
          sentiment={m.sentiment}
        />
      ))}
    </>
  );
});

/**
 * L'auto come marker, visibile solo con la mappa libera (ultimo figlio della
 * mappa). REG-689: prende la posizione stimata 10 volte al secondo, così non
 * salta più da un punto GPS all'altro.
 */
const FREE_CAR_MS = 50;
const LiveCarMarker = React.memo(function LiveCarMarker({
  following,
  color,
  epoch,
  liveRef,
  mapHeadRef,
}: {
  following: boolean;
  color?: string | null;
  epoch: number;
  liveRef: React.MutableRefObject<MotionSample | null>;
  /** La direzione della mappa adesso (il marker ruota rispetto allo schermo). */
  mapHeadRef: React.MutableRefObject<number>;
}) {
  const read = () => {
    const f = liveRef.current ?? roadStore.get().fix;
    return f ? { lat: f.lat, lng: f.lng, rot: (f.heading ?? 0) - mapHeadRef.current } : null;
  };
  const [shown, setShown] = useState(read);
  useEffect(() => {
    if (following) return;
    setShown(read());
    const t = setInterval(() => setShown(read()), FREE_CAR_MS);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [following]);
  const fix = shown ?? read();
  if (!fix) return null;
  return (
    <RoadLiveCarMarker
      key={`car-${epoch}`}
      coordinate={{ latitude: fix.lat, longitude: fix.lng }}
      rotation={fix.rot}
      color={color}
      opacity={following ? 0 : 1}
    />
  );
});

/**
 * REG-687: la mappa in un pezzo a sé, con props stabili. Si ridisegna solo
 * quando cambia davvero qualcosa (sgancio/ritorno, bussola, pannello), non a
 * ogni render della schermata.
 */
const LiveMap = React.memo(function LiveMap({
  mapRef,
  center,
  panelH,
  following,
  carColor,
  carEpoch,
  liveRef,
  mapHeadRef,
  onPanDrag,
  onRegionDone,
}: {
  mapRef: React.RefObject<MapView | null>;
  center: { lat: number; lng: number; heading: number };
  panelH: number;
  following: boolean;
  carColor?: string | null;
  carEpoch: number;
  liveRef: React.MutableRefObject<MotionSample | null>;
  mapHeadRef: React.MutableRefObject<number>;
  onPanDrag: () => void;
  onRegionDone: () => void;
}) {
  const where = useMemo(() => ({ lat: center.lat, lng: center.lng }), [center]);
  const initialCamera = useMemo(() => {
    const t = cameraTarget(0, null);
    return {
      center: { latitude: center.lat, longitude: center.lng },
      heading: center.heading,
      pitch: t.pitch,
      altitude: t.altitude,
      zoom: zoomForAltitude(t.altitude),
    };
  }, [center]);
  const padding = useMemo(() => ({ top: MAP_PADDING_TOP, right: 0, bottom: 8 + panelH, left: 0 }), [panelH]);
  const legal = useMemo(() => ({ top: 0, right: 0, bottom: 8 + panelH + 14, left: 18 }), [panelH]);
  return (
    <MapView
      ref={mapRef}
      style={StyleSheet.absoluteFill}
      initialCamera={initialCamera}
      mapPadding={padding}
      legalLabelInsets={legal}
      mapType={Platform.OS === 'ios' ? 'mutedStandard' : 'standard'}
      showsPointsOfInterest={false}
      // Niente edifici 3D: su Apple Maps coprono il percorso, che è il dato di Road.
      showsBuildings={false}
      showsCompass={false}
      showsScale={false}
      showsTraffic={false}
      showsUserLocation={false}
      toolbarEnabled={false}
      // REG-679: pan, zoom e rotazione nativi (prima rotazione e inclinazione erano spente).
      rotateEnabled
      pitchEnabled
      zoomEnabled
      scrollEnabled
      userInterfaceStyle="light"
      onPanDrag={onPanDrag}
      onRegionChangeComplete={onRegionDone}
    >
      {/* REG-652: posti fissi, PRIMA degli altri figli (crash AIRMap, vedi RoadGuideOverlay) */}
      <LiveGuide center={where} />
      <LiveTrack center={where} />
      <LivePins />
      <LiveCarMarker following={following} color={carColor} epoch={carEpoch} liveRef={liveRef} mapHeadRef={mapHeadRef} />
    </MapView>
  );
});

// ─── Navigazione: prossima svolta e tappa ───────────────────────────────────

function useNav(): NavState {
  const guide = useRoadSelector((s) => s.guide);
  const fix = useRoadSelector((s) => s.fix);
  const reached = useRoadSelector((s) => s.planProgress.reached);
  const skipped = useRoadSelector((s) => s.reroute.skipped);
  const offSince = useRoadSelector((s) => s.reroute.offSince);
  const measured = useMemo(() => (guide?.line && guide.line.length >= 2 ? measureLine(guide.line) : null), [guide?.line]);
  const steps = useMemo(() => (measured && guide?.steps?.length ? placeSteps(measured, guide.steps) : []), [measured, guide?.steps]);
  const stops = guide?.stops ?? EMPTY_STOPS;
  const stopAlong = useMemo(() => (measured ? placeStops(measured, stops) : []), [measured, stops]);
  const along = useRef(0);
  const lineRef = useRef(measured);
  if (lineRef.current !== measured) {
    lineRef.current = measured;
    along.current = 0;
  }
  const done = useMemo(() => [...reached, ...skipped], [reached, skipped]);
  return useMemo(() => {
    if (!fix) return { step: null, then: null, stop: null, left: null, offLine: false };
    const offConfirmed = offSince != null && fix.t - offSince >= REROUTE_OFF_MS;
    const r = navState({ m: measured, steps, stops, stopAlong, done, p: fix, prevAlong: along.current, offConfirmed });
    along.current = r.along;
    return r;
  }, [fix, measured, steps, stops, stopAlong, done, offSince]);
}

// ─── Schermata ──────────────────────────────────────────────────────────────

type CamMode = 'follow' | 'free' | 'returning';
/** Un trascinamento oltre questi punti sgancia la camera (prima 8: più reattivo). */
const DRAG_RELEASE_PT = 4;
/** Il GPS dell'ascolto è fermo da tanto: i punti del tracking tornano buoni. */
const WATCH_STALE_MS = 3000;
/** Un fix più vecchio di così rispetto a ora: l'orologio non torna, vale l'arrivo. */
const FIX_MAX_AGE_MS = 3000;
/** Il loop non chiede la camera più spesso di così (schermi a 120 Hz). */
const MIN_FRAME_MS = 15;

const altitudeForZoom = (zoom: number) => 900 * Math.pow(2, 16.4 - zoom);

export default function RoadScreen() {
  useKeepAwake('reglo-road');
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const session = useRoadSelector((s) => s.session);
  const lesson = session?.lesson ?? null;
  const mapRef = useRef<MapView>(null);
  const [following, setFollowing] = useState(true);
  const [panelH, setPanelH] = useState(220);
  const [topH, setTopH] = useState(0);
  const [mapHeading, setMapHeading] = useState(0);
  const [ending, setEnding] = useState(false);
  // REG-673: al ritorno dal background il marker si rimonta da zero.
  const [carEpoch, setCarEpoch] = useState(0);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);

  // ── Movimento fluido (REG-678) ──
  const motion = useRef(createLiveMotion(null)).current;
  const liveCam = useRef(createLiveCamera()).current;
  const carRot = useSharedValue(0);
  const carHalo = useSharedValue(CAR_DISC);
  const carVisible = useSharedValue(1);
  /** L'ultimo campione del movimento: lo legge il marker a mappa libera. */
  const liveRef = useRef<MotionSample | null>(null);
  /** Metri alla prossima svolta (dalla card in alto): lo zoom automatico scende lì (REG-688). */
  const turnRef = useRef<number | null>(null);

  // ── Chi comanda la camera (REG-684/685) ──
  // Un ref e non uno stato: il loop lo legge a ogni fotogramma, quindi lo
  // sgancio vale dal tocco stesso. Prima era uno stato React: il loop si
  // fermava solo dopo il ridisegno di tutta la schermata e nel frattempo
  // rimetteva la camera sull'auto, mangiando i primi 100–300 ms di ogni
  // trascinamento («la mappa resta inchiodata»).
  const mode = useRef<CamMode>('follow');
  const lastTouch = useRef(0);
  const back = useRef<{ from: CamPose; t0: number } | null>(null);
  /** La direzione della camera adesso (marker a mappa libera, bussola). */
  const mapHeadRef = useRef(0);

  const release = useCallback(() => {
    lastTouch.current = Date.now();
    if (mode.current === 'free') return;
    mode.current = 'free';
    back.current = null;
    setFollowing(false);
    setMapHeading(mapHeadRef.current);
  }, []);

  // Ritorno morbido sull'auto: il loop stesso mescola la camera lasciata
  // dall'utente con quella che segue (niente animateCamera con frenata, niente
  // scatto quando riparte il fotogramma per fotogramma).
  const startReturn = useCallback(() => {
    if (mode.current !== 'free' || !liveRef.current) return;
    mode.current = 'returning';
    const begin = (c: Camera | null) => {
      if (mode.current !== 'returning') return; // un tocco nel frattempo
      motion.alignCamera();
      const smp = liveRef.current;
      if (!smp) return;
      const altitude = c?.altitude ?? (c?.zoom != null ? altitudeForZoom(c.zoom) : 900);
      back.current = {
        from: c
          ? {
              lat: c.center.latitude,
              lng: c.center.longitude,
              heading: c.heading ?? 0,
              pitch: c.pitch ?? 45,
              altitude,
              zoom: c.zoom ?? zoomForAltitude(altitude),
            }
          : { lat: smp.lat, lng: smp.lng, heading: smp.heading, pitch: 45, altitude, zoom: zoomForAltitude(altitude) },
        t0: Date.now(),
      };
    };
    const map = mapRef.current;
    if (!map) return begin(null);
    map.getCamera().then(begin, () => begin(null));
  }, [motion]);

  // ── GPS: una sola fonte, con l'ora del fix (REG-686) ──
  // Prima il movimento prendeva i punti sia dal tracking (in ritardo, a
  // gruppi) sia dall'ascolto da 1 s, timbrati con l'ora d'arrivo: un punto
  // vecchio arrivato dopo uno nuovo tirava l'auto indietro.
  const lastFixTs = useRef(0);
  const lastWatchAt = useRef(0);
  const feed = useCallback(
    (f: MotionFix, ts: number) => {
      if (ts <= lastFixTs.current) return;
      lastFixTs.current = ts;
      const now = Date.now();
      const age = now - ts;
      motion.push(f, age >= 0 && age < FIX_MAX_AGE_MS ? ts : now);
    },
    [motion],
  );

  // I punti del tracking servono solo finché l'ascolto non parte (o se tace).
  useEffect(() => {
    let last = roadStore.get().fix;
    if (last) feed(last, last.t);
    return roadStore.subscribe(() => {
      const f = roadStore.get().fix;
      if (!f || f === last) return;
      last = f;
      if (Date.now() - lastWatchAt.current > WATCH_STALE_MS) {
        feed(f, f.t);
        // REG-693: anche lo stato del segnale e la velocità seguono il tracking se l'ascolto tace.
        liveStatus.reportFix({ accuracy: f.accuracy, speed: f.speed });
      }
    });
  }, [feed]);

  // REG-693: stato del segnale e watchdog del tracking finché si è in guida.
  useEffect(() => {
    liveStatus.start();
    return () => liveStatus.stop();
  }, []);

  // L'ascolto della schermata: un punto al secondo, la fonte del movimento.
  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;
    let alive = true;
    Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 0, timeInterval: 1000 },
      (l) => {
        const c = l.coords;
        // REG-693: anche i fix scartati dicono qualcosa (GPS debole).
        liveStatus.reportFix({ accuracy: c.accuracy ?? null, speed: c.speed != null && c.speed >= 0 ? c.speed : null });
        if (c.accuracy != null && c.accuracy > 50) return;
        lastWatchAt.current = Date.now();
        fixHistory.push(c.latitude, c.longitude, l.timestamp);
        feed(
          {
            lat: c.latitude,
            lng: c.longitude,
            speed: c.speed != null && c.speed >= 0 ? c.speed : null,
            heading: c.heading != null && c.heading >= 0 ? c.heading : null,
            accuracy: c.accuracy ?? null,
          },
          l.timestamp,
        );
      },
    )
      .then((s) => {
        if (alive) sub = s;
        else s.remove();
      })
      .catch(() => undefined);
    return () => {
      alive = false;
      sub?.remove();
    };
  }, [feed]);

  // REG-689: l'auto si aggancia alla linea del giro (anche dopo un riaggancio).
  useEffect(() => {
    let line: unknown = undefined;
    const apply = () => {
      const g = roadStore.get().guide?.line ?? null;
      if (g === line) return;
      line = g;
      motion.setSnap(g && g.length >= 2 ? createLineSnap(measureLine(g)) : null);
    };
    apply();
    const off = roadStore.subscribe(apply);
    return () => {
      off();
      motion.setSnap(null);
    };
  }, [motion]);

  // La camera segue l'auto a ogni fotogramma (REG-686: prima 30 al secondo,
  // con l'auto a 60: la strada «tremava» sotto l'auto).
  useEffect(() => {
    let raf = 0;
    let lastCam = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const now = Date.now();
      const smp = motion.sample(now);
      if (!smp) return;
      liveRef.current = smp;
      const frame = liveCam.step(now, smp.speed, turnRef.current);
      if (mode.current === 'free') {
        // REG-685: 10 s senza toccare la mappa → si torna da soli sull'auto.
        if (now - lastTouch.current >= AUTO_RETURN_MS) startReturn();
        return;
      }
      carRot.value = headingDelta(smp.camHeading, smp.heading);
      const acc = smp.accuracy ?? 10;
      carHalo.value = Math.max(CAR_DISC, Math.min(120, acc * 3.2));
      if (now - lastCam < MIN_FRAME_MS) return;
      const to: CamPose = {
        lat: smp.lat,
        lng: smp.lng,
        heading: smp.camHeading,
        pitch: frame.pitch,
        altitude: frame.altitude,
        zoom: frame.zoom,
      };
      let pose = to;
      if (mode.current === 'returning') {
        const r = back.current;
        if (!r) return; // si aspetta la camera di partenza
        const k = Math.min(1, (now - r.t0) / RETURN_MS);
        pose = blendPose(r.from, to, easeInOut(k));
        if (k >= 1) {
          mode.current = 'follow';
          back.current = null;
          setFollowing(true);
          setMapHeading(0);
        }
      }
      lastCam = now;
      mapHeadRef.current = pose.heading;
      mapRef.current?.setCamera({
        center: { latitude: pose.lat, longitude: pose.lng },
        heading: pose.heading,
        pitch: pose.pitch,
        altitude: pose.altitude,
        zoom: pose.zoom,
      });
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [motion, liveCam, carRot, carHalo, startReturn]);

  // L'auto ferma sullo schermo c'è solo mentre si segue; a mappa libera e
  // durante il ritorno c'è il marker (sta sul punto vero della mappa).
  useEffect(() => {
    carVisible.value = withTiming(following ? 1 : 0, { duration: 150, reduceMotion: ReduceMotion.Never });
  }, [following, carVisible]);

  // REG-652: linea suggerita, tappe e punti dell'allievo, una volta per sessione.
  const sessionId = session?.id;
  useEffect(() => {
    const cur = roadStore.get().session;
    if (!cur || cur.id !== sessionId || !cur.lesson) return;
    void loadRoadGuide(cur, waitFirstFix, (g) => roadStore.setGuide(g));
  }, [sessionId]);

  // REG-654: fuori percorso, lo store chiede il riaggancio (al massimo uno ogni 45 s).
  useEffect(() => {
    roadStore.setRerouteHandler((req) => {
      void fetchReroute(req.start, req.stops).then((route) => roadStore.applyReroute(req.sessionId, route));
    });
    return () => roadStore.setRerouteHandler(null);
  }, []);

  // La nota della guida si carica subito: il foglio «Note» si apre senza attese.
  useEffect(() => {
    prefetchRoadNotes(lesson);
  }, [lesson]);

  // Ritorno dal background: marker rimontato (REG-673).
  useEffect(() => {
    let prev = AppState.currentState;
    const sub = AppState.addEventListener('change', (next) => {
      const back = next === 'active' && prev !== 'active';
      prev = next;
      if (back) setCarEpoch((n) => n + 1);
    });
    return () => sub.remove();
  }, []);

  // Prima del primo punto del tracking: centra sull'ultima posizione nota.
  useEffect(() => {
    if (roadStore.get().fix) return;
    let alive = true;
    Location.getLastKnownPositionAsync()
      .then((p) => {
        if (!alive || !p || motion.ready) return;
        const t = cameraTarget(0, null);
        mapRef.current?.setCamera({
          center: { latitude: p.coords.latitude, longitude: p.coords.longitude },
          heading: 0,
          pitch: t.pitch,
          altitude: t.altitude,
          zoom: zoomForAltitude(t.altitude),
        });
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [motion]);

  // Un gesto sulla mappa (trascinare, pizzicare, ruotare) sgancia la camera
  // SUBITO (ref, vedi sopra). Su iOS react-native-maps non dice se il
  // movimento nasce da un gesto: si guardano i tocchi sul contenitore (un
  // tocco fermo non sgancia) e il pan nativo (`onPanDrag`).
  const touch = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = useCallback(
    (e: GestureResponderEvent) => {
      const t = e.nativeEvent;
      touch.current = { x: t.pageX, y: t.pageY };
      if ((t.touches?.length ?? 1) > 1) release();
    },
    [release],
  );
  const onTouchMove = useCallback(
    (e: GestureResponderEvent) => {
      lastTouch.current = Date.now();
      if (mode.current === 'free' || !touch.current) return;
      const t = e.nativeEvent;
      if ((t.touches?.length ?? 1) > 1 || Math.hypot(t.pageX - touch.current.x, t.pageY - touch.current.y) > DRAG_RELEASE_PT) {
        release();
      }
    },
    [release],
  );
  const onTouchEnd = useCallback(() => {
    touch.current = null;
  }, []);
  // Ogni tocco sulla schermata (mappa, card, bottoni) fa ripartire i 10 s.
  const onAnyTouch = useCallback(() => {
    lastTouch.current = Date.now();
  }, []);

  // Con la mappa libera: la direzione della mappa (bussola, auto marker).
  const onRegionDone = useCallback(() => {
    if (mode.current !== 'free') return;
    mapRef.current
      ?.getCamera()
      .then((c) => {
        mapHeadRef.current = c?.heading ?? 0;
        setMapHeading(mapHeadRef.current);
      })
      .catch(() => undefined);
  }, []);

  const onRecenter = useCallback(() => {
    Haptics.selectionAsync().catch(() => undefined);
    startReturn();
  }, [startReturn]);

  const onNorth = useCallback(() => {
    Haptics.selectionAsync().catch(() => undefined);
    mapRef.current?.animateCamera({ heading: 0 }, { duration: 350 });
    mapHeadRef.current = 0;
    setMapHeading(0);
  }, []);

  const onTurn = useCallback((m: number | null) => {
    turnRef.current = m;
  }, []);

  // Il centro iniziale della mappa si fissa una volta (la mappa è memo).
  const centerRef = useRef<{ lat: number; lng: number; heading: number } | null>(null);
  if (!session || !lesson) {
    return <View style={s.root} />;
  }
  if (!centerRef.current) {
    const f = session.last ?? roadStore.get().fix;
    centerRef.current = f ? { lat: f.lat, lng: f.lng, heading: f.heading ?? 0 } : { lat: 45.0703, lng: 7.6869, heading: 0 };
  }
  const center = centerRef.current;

  const topStart = insets.top + 4;
  const ctlBottom = 8 + panelH + 12;
  // REG-687: dove sta l'auto mentre si segue = il centro dell'area della mappa
  // senza il padding (lì cade il centro della camera). Calcolato, non misurato:
  // prima la camera si fermava 260 ms per chiederlo alla mappa.
  const carPt = box ? { x: box.w / 2, y: MAP_PADDING_TOP + (box.h - MAP_PADDING_TOP - (8 + panelH)) / 2 } : null;

  return (
    <View style={s.root} onTouchStart={onAnyTouch}>
      <View
        style={StyleSheet.absoluteFill}
        onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
      >
        <LiveMap
          mapRef={mapRef}
          center={center}
          panelH={panelH}
          following={following}
          carColor={lesson.carColor}
          carEpoch={carEpoch}
          liveRef={liveRef}
          mapHeadRef={mapHeadRef}
          onPanDrag={release}
          onRegionDone={onRegionDone}
        />
      </View>

      {carPt ? (
        <RoadLiveCar x={carPt.x} y={carPt.y} rotation={carRot} halo={carHalo} visible={carVisible} color={lesson.carColor} />
      ) : null}

      <LiveTop top={topStart} onLayoutTop={setTopH} topH={topH} onTurn={onTurn} />

      <LiveControls
        bottom={ctlBottom}
        following={following}
        mapHeading={mapHeading}
        onRecenter={onRecenter}
        onNorth={onNorth}
      />

      <LivePanel
        lessonName={lessonStudentName(lesson)}
        onLayoutH={setPanelH}
        ending={ending}
        onSegnala={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
          router.push('/road/segnala');
        }}
        onTermina={() => {
          if (ending) return;
          const name = lessonStudentName(lesson);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
          Alert.alert('Terminare la guida?', `La guida con ${name} viene segnata come completata e il GPS si spegne.`, [
            { text: 'Annulla', style: 'cancel' },
            {
              text: 'Termina',
              onPress: async () => {
                setEnding(true);
                const ok = await endRoad();
                setEnding(false);
                if (ok) router.push('/road/riepilogo');
              },
            },
          ]);
        }}
        onNotes={() => void openRoadNotes(router, lesson)}
        onPagellino={() => openRoadPagellino(router, lesson, { showStayChip: true })}
        insetsBottom={insets.bottom}
      />
    </View>
  );
}

// ─── In alto: svolta, punto critico, tappa, toast ───────────────────────────

function LiveTop({
  top,
  topH,
  onLayoutTop,
  onTurn,
}: {
  top: number;
  topH: number;
  onLayoutTop: (h: number) => void;
  /** Metri alla prossima svolta, per lo zoom automatico (REG-688). */
  onTurn: (meters: number | null) => void;
}) {
  const nav = useNav();
  const turnM = nav.step?.meters ?? null;
  useEffect(() => {
    onTurn(turnM);
  }, [turnM, onTurn]);
  const watch = useRoadSelector((s) => s.hotspotWatch);
  const planAlert = useRoadSelector((s) => s.planAlert);
  const toast = useRoadSelector((s) => s.toast);
  const session = useRoadSelector((s) => s.session);
  const alert = watch.alert;
  const hasNav = !!(nav.step || nav.stop || nav.offLine);
  const below = hasNav ? top + topH + 10 : top;

  // ── Punto critico (REG-681) ──
  const [decision, setDecision] = useState<{ key: string; clientId: string; outcome: RoadHotspotOutcome } | null>(null);
  const alertKey = alert?.hotspot.key ?? null;
  const phase = alert?.phase ?? null;
  // Comparsa: un colpo leggero; sul punto: un tocco più netto (si guarda la card).
  useEffect(() => {
    if (!alertKey) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
  }, [alertKey]);
  useEffect(() => {
    if (phase === 'at') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => undefined);
  }, [phase, alertKey]);
  // Nuova card: la decisione di prima non vale più.
  useEffect(() => {
    setDecision((d) => (d && d.key !== alertKey ? null : d));
  }, [alertKey]);
  // Dopo il punto la card resta 20 s per decidere, anche da fermi (senza fix).
  const leftAt = alert?.leftAt ?? null;
  const decided = alert?.decided === true;
  useEffect(() => {
    if (!alertKey || leftAt == null || decision || decided) return;
    const t = setTimeout(() => roadStore.closeHotspotAlert(alertKey), Math.max(400, HOTSPOT_DECIDE_MS - (Date.now() - leftAt)));
    return () => clearTimeout(t);
  }, [alertKey, leftAt, decision, decided]);
  // «Segnato»: resta 5 s con «Annulla» (come le segnalazioni), poi la card si chiude.
  useEffect(() => {
    if (!decision) return;
    const t = setTimeout(() => roadStore.closeHotspotAlert(decision.key), CHECK_DONE_MS);
    return () => clearTimeout(t);
  }, [decision]);

  const onDecide = async (outcome: RoadHotspotOutcome) => {
    if (!alert || decision) return;
    if (outcome === 'better') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid).catch(() => undefined);
    const key = alert.hotspot.key;
    roadStore.markHotspotDecided(key, true);
    const clientId = await recordHotspotCheck(alert.hotspot, outcome);
    if (clientId) setDecision({ key, clientId, outcome });
    else roadStore.markHotspotDecided(key, false);
  };
  const onUndoCheck = () => {
    if (!decision) return;
    Haptics.selectionAsync().catch(() => undefined);
    void undoHotspotCheck(decision.clientId);
    roadStore.markHotspotDecided(decision.key, false);
    setDecision(null);
  };

  // ── Tappa del giro (REG-650): si chiude da sola anche da fermi ──
  const planAlertId = planAlert ? `${planAlert.key}:${planAlert.reached ? 'ok' : 'near'}` : null;
  useEffect(() => {
    if (!planAlert) return;
    const left = (planAlert.reached ? PLAN_REACHED_MS : PLAN_ALERT_MS) - (Date.now() - planAlert.at);
    const t = setTimeout(() => roadStore.dismissPlanAlert(planAlert.key), Math.max(400, left));
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planAlertId]);
  useEffect(() => {
    if (!planAlertId) return;
    if (planAlertId.endsWith(':ok')) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    // L'avvicinamento alla tappa lo dice già la card in alto: niente colpo se c'è.
    else if (!hasNav) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planAlertId]);
  // Con la card in alto l'avviso «tra 300 m» è un doppione: resta solo «raggiunta».
  const showPlan = planAlert && (planAlert.reached || !hasNav) && !alert;

  // Il toast «… segnato» resta 5 secondi.
  const toastId = toast?.clientId;
  // REG-696: ogni «Qui / N s fa» lascia altri 5 s per ripensarci.
  const toastRev = toast?.rev ?? 0;
  useEffect(() => {
    if (!toastId) return;
    const t = setTimeout(() => roadStore.dismissToast(toastId), 5000);
    return () => clearTimeout(t);
  }, [toastId, toastRev]);
  const onPlace = (want: 'retro' | 'here') => {
    if (!toast || toast.placed === want) return;
    Haptics.selectionAsync().catch(() => undefined);
    void swapRoadMarkerPlace(toast.clientId);
  };
  const onUndo = () => {
    if (!toast) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    void undoRoadMarker(toast.clientId);
  };

  // Guida appena avviata da Road libero: «Annulla» per 10 secondi.
  const freeStarted = useSyncExternalStore(roadFreeStarted.subscribe, roadFreeStarted.get);
  const [undoing, setUndoing] = useState(false);
  const freeUntil = freeStarted && freeStarted.sessionId === session?.id ? freeStarted.until : 0;
  const [freeOpen, setFreeOpen] = useState(() => freeUntil > Date.now());
  useEffect(() => {
    const left = freeUntil - Date.now();
    setFreeOpen(left > 0);
    if (left <= 0) return;
    const t = setTimeout(() => setFreeOpen(false), left);
    return () => clearTimeout(t);
  }, [freeUntil]);
  const onUndoFree = async () => {
    if (undoing) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    setUndoing(true);
    const ok = await undoRoadFree();
    setUndoing(false);
    if (!ok) setFreeOpen(false);
  };

  return (
    <>
      {hasNav ? (
        <View style={[s.navWrap, { top }]} onLayout={(e) => onLayoutTop(e.nativeEvent.layout.height)} pointerEvents="box-none">
          <RoadNavCard nav={nav} style={s.navCard} />
        </View>
      ) : null}

      {alert ? (
        <RoadToastFrame key={alert.hotspot.key} style={[s.stack, { top: below }]}>
          <RoadHotspotCard
            alert={alert}
            decided={decision?.key === alert.hotspot.key ? decision.outcome : null}
            onDecide={(o) => void onDecide(o)}
            onUndo={onUndoCheck}
            onClose={() => roadStore.closeHotspotAlert(alert.hotspot.key)}
            style={s.inStack}
          />
        </RoadToastFrame>
      ) : showPlan && planAlert ? (
        <RoadToastFrame key={planAlertId ?? planAlert.key} style={[s.stack, s.card, CLAY_SHADOW.raise, { top: below }]}>
          <Pressable
            onPress={() => roadStore.dismissPlanAlert(planAlert.key)}
            style={s.planRow}
            accessibilityRole="button"
            accessibilityLabel={
              planAlert.reached
                ? `Tappa ${planAlert.n} raggiunta: ${planAlert.title}`
                : `Tra ${planAlert.meters} metri, tappa ${planAlert.n}: ${planAlert.title}. ${planAlert.reason}`
            }
            testID="road-plan-alert"
          >
            <View style={s.planNum}>
              {planAlert.reached ? (
                <Animated.View key="ok" entering={ROAD_TEXT_IN}>
                  <Ionicons name="checkmark" size={24} color="#FFFFFF" />
                </Animated.View>
              ) : (
                <Text style={s.planNumTx}>{planAlert.n}</Text>
              )}
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.cardT1} numberOfLines={1}>
                {planAlert.reached ? `Tappa ${planAlert.n} raggiunta` : `Tra ${planAlert.meters} m · tappa ${planAlert.n}`}
              </Text>
              <Text style={s.cardT2} numberOfLines={1}>{planAlert.title}</Text>
              <Text style={s.cardT3} numberOfLines={1}>{planAlert.reason}</Text>
            </View>
          </Pressable>
        </RoadToastFrame>
      ) : null}

      {/* Toast della segnalazione appena fatta: in basso sopra il pannello non
          coprirebbe niente, ma lì c'è il pollice; resta sotto le card in alto. */}
      {toast && !alert ? (
        <RoadToastFrame key={toast.clientId} style={[s.stack, s.toast, { top: below + (showPlan ? 104 : 0) }]}>
          <View style={s.toastIc}>
            <Image source={markerArt(toast.kind)} style={s.toastImg} resizeMode="contain" />
            {toast.sentiment ? <SentimentBadge sentiment={toast.sentiment} size={18} style={s.toastSg} /> : null}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.toastT1} numberOfLines={1}>{toast.label} segnato</Text>
            {toast.retroSec != null ? (
              // REG-696: la segnalazione va dov'era l'auto poco prima; «Qui» la rimette dove si è ora.
              <View style={s.placeRow} accessibilityRole="radiogroup">
                <Pressable
                  onPress={() => onPlace('retro')}
                  hitSlop={{ top: 12, bottom: 12, left: 6, right: 6 }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: toast.placed === 'retro' }}
                  accessibilityLabel={`Dov'eri ${toast.retroSec} secondi fa`}
                  testID="road-place-retro"
                >
                  <Text style={[s.placeTx, toast.placed === 'retro' && s.placeOn]}>{toast.retroSec} s fa</Text>
                </Pressable>
                <Text style={s.placeSep}>·</Text>
                <Pressable
                  onPress={() => onPlace('here')}
                  hitSlop={{ top: 12, bottom: 12, left: 6, right: 6 }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: toast.placed === 'here' }}
                  accessibilityLabel="Dove sei adesso"
                  testID="road-place-here"
                >
                  <Text style={[s.placeTx, toast.placed === 'here' && s.placeOn]}>Qui</Text>
                </Pressable>
              </View>
            ) : (
              <Text style={s.toastT2} numberOfLines={1}>
                {[toast.street, formatHm(toast.at)].filter(Boolean).join(' · ')}
              </Text>
            )}
          </View>
          <Pressable onPress={onUndo} style={({ pressed }) => [s.undo, pressed && { opacity: 0.7 }]} testID="road-undo">
            <Text style={s.undoTx}>Annulla</Text>
          </Pressable>
        </RoadToastFrame>
      ) : null}

      {freeOpen && freeStarted && !toast && !alert ? (
        <RoadToastFrame key={freeStarted.sessionId} style={[s.stack, s.toast, s.freeBanner, { top: below + (showPlan ? 104 : 0) }]}>
          <Text style={[s.toastT1, { flex: 1 }]} numberOfLines={1}>
            In agenda: {freeStarted.label}
          </Text>
          <Pressable
            onPress={() => void onUndoFree()}
            disabled={undoing}
            style={({ pressed }) => [s.undo, pressed && { opacity: 0.7 }]}
            testID="road-free-undo"
          >
            {undoing ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={s.undoTx}>Annulla</Text>}
          </Pressable>
        </RoadToastFrame>
      ) : null}
    </>
  );
}

// ─── Controlli: velocità a sinistra, Ricentra e bussola a destra ────────────

const LiveControls = React.memo(function LiveControls({
  bottom,
  following,
  mapHeading,
  onRecenter,
  onNorth,
}: {
  bottom: number;
  following: boolean;
  mapHeading: number;
  onRecenter: () => void;
  onNorth: () => void;
}) {
  // REG-693: velocità dall'ascolto a 1 Hz, a 0 dopo 3 s senza fix (prima restava ferma sull'ultimo valore).
  const { speedKmh } = useLiveStatus();
  const showNorth = !following && Math.abs(headingDelta(0, mapHeading)) > 3;
  return (
    <>
      <View style={[s.speed, CLAY_SHADOW.raise, { bottom }]} accessibilityLabel={`${speedKmh} chilometri orari`}>
        <Text style={s.speedNum}>{speedKmh}</Text>
        <Text style={s.speedUnit}>km/h</Text>
      </View>
      <View style={[s.ctl, { bottom }]} pointerEvents="box-none">
        {showNorth ? (
          <Animated.View entering={ROAD_TEXT_IN} exiting={ROAD_EXIT}>
            <Pressable
              onPress={onNorth}
              style={({ pressed }) => [s.round, CLAY_SHADOW.raise, pressed && { transform: [{ scale: 0.95 }] }]}
              accessibilityRole="button"
              accessibilityLabel="Rimetti il nord in alto"
              testID="road-north"
            >
              <View style={{ transform: [{ rotate: `${-mapHeading}deg` }] }}>
                <MaterialIcons name="navigation" size={22} color={CLAY.ink} />
              </View>
            </Pressable>
          </Animated.View>
        ) : null}
        {!following ? (
          <Animated.View entering={ROAD_TEXT_IN} exiting={ROAD_EXIT}>
            <Pressable
              onPress={onRecenter}
              style={({ pressed }) => [s.recenter, CLAY_SHADOW.raise, pressed && { transform: [{ scale: 0.97 }] }]}
              accessibilityRole="button"
              accessibilityLabel="Ricentra sull'auto"
              testID="road-recenter"
            >
              <MaterialIcons name="near-me" size={20} color={CLAY.ink} />
              <Text style={s.recenterTx}>Ricentra</Text>
            </Pressable>
          </Animated.View>
        ) : null}
      </View>
    </>
  );
});

// ─── REG-693: «sto registrando?» sotto il nome ──────────────────────────────

/**
 * Tutto a posto: pallino rosso «in diretta» + orario e minuti. Qualcosa non va
 * (GPS debole o perso, offline, tracking riacceso): anello vuoto e la frase.
 * Stessa altezza in tutti gli stati (il pannello non cambia misura).
 */
const LiveStatusRow = React.memo(function LiveStatusRow({ range, minutes }: { range: string; minutes: string }) {
  const st = useLiveStatus();
  const line = liveStatusLine(st);
  const text = line ?? `${range} · ${minutes} min`;
  return (
    <View style={s.liveRow} testID="road-live-status" accessibilityLiveRegion="polite">
      <View style={line ? s.liveRing : s.liveDot} />
      <Animated.Text
        key={line ?? 'ok'}
        entering={ROAD_TEXT_IN}
        style={[s.liveTx, line ? s.liveWarn : null]}
        numberOfLines={1}
        accessibilityLabel={line ?? `In corso, ${range}`}
      >
        {text}
      </Animated.Text>
    </View>
  );
});

// ─── Pannello in basso ──────────────────────────────────────────────────────

const LivePanel = React.memo(function LivePanel({
  lessonName,
  onLayoutH,
  ending,
  onSegnala,
  onTermina,
  onNotes,
  onPagellino,
  insetsBottom,
}: {
  lessonName: string;
  onLayoutH: (h: number) => void;
  ending: boolean;
  onSegnala: () => void;
  onTermina: () => void;
  onNotes: () => void;
  onPagellino: () => void;
  insetsBottom: number;
}) {
  const session = useRoadSelector((s) => s.session);
  const distance = useRoadSelector((s) => s.distanceMeters);
  const markersN = useRoadSelector((s) => s.markers.length);
  const evaluationEnabled = useRoadSelector((s) => s.evaluationEnabled);
  const nav = useNav();
  const now = useNow(15_000);
  const lesson = session?.lesson;
  if (!session || !lesson) return null;
  const elapsedSec = Math.max(0, (now - new Date(session.startedAt).getTime()) / 1000);
  const left = nav.left;

  return (
    <View
      style={[s.panel, CLAY_SHADOW.raise, { paddingBottom: Math.max(14, insetsBottom - 20) }]}
      onLayout={(e) => onLayoutH(e.nativeEvent.layout.height)}
    >
      <View style={s.who}>
        <Avatar userId={lesson.student?.id} name={lessonName} size={42} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.name} numberOfLines={1}>{lessonName}</Text>
          <LiveStatusRow range={formatRange(lesson.startsAt, lesson.endsAt)} minutes={formatMinutes(elapsedSec)} />
        </View>
        {/* Giro Road (Tiziano 28/10): le note si prendono anche durante la guida. */}
        <Pressable
          onPress={onNotes}
          style={({ pressed }) => [s.iconBtn, CLAY_SHADOW.raiseSm, pressed && { transform: [{ scale: 0.95 }] }]}
          accessibilityRole="button"
          accessibilityLabel="Note sulla guida"
          hitSlop={4}
          testID="road-note"
        >
          <Ionicons name="create-outline" size={20} color={CLAY.ink} />
        </Pressable>
        {evaluationEnabled ? (
          <Pressable
            onPress={onPagellino}
            style={({ pressed }) => [s.iconBtn, CLAY_SHADOW.raiseSm, pressed && { transform: [{ scale: 0.95 }] }]}
            accessibilityRole="button"
            accessibilityLabel="Pagellino"
            hitSlop={4}
            testID="road-pagellino"
          >
            <Ionicons name="star-outline" size={20} color={CLAY.ink} />
          </Pressable>
        ) : null}
      </View>

      <View style={s.stats}>
        <View style={s.stat}>
          <Text style={s.statNum}>
            {formatKm(distance)}
            <Text style={s.statUnit}> km</Text>
          </Text>
          <Text style={s.statLabel}>Percorsi</Text>
        </View>
        <View style={s.stat}>
          <Text style={s.statNum}>{markersN}</Text>
          <Text style={s.statLabel}>Segnalazioni</Text>
        </View>
        <View style={s.stat}>
          {left != null ? (
            <>
              <Text style={s.statNum}>
                {formatKm(left)}
                <Text style={s.statUnit}> km</Text>
              </Text>
              <Text style={s.statLabel}>Restano</Text>
            </>
          ) : (
            <>
              <Text style={s.statNum}>
                {formatMinutes(elapsedSec)}
                <Text style={s.statUnit}> min</Text>
              </Text>
              <Text style={s.statLabel}>Di guida</Text>
            </>
          )}
        </View>
      </View>

      <View style={s.actions}>
        <ClayButton
          title="Segnala"
          leading={<Ionicons name="add" size={24} color="#FFFFFF" />}
          onPress={onSegnala}
          disabled={ending}
          style={[s.btn, { flex: 1 }]}
          testID="road-segnala"
        />
        <ClayButton variant="secondary" title="Termina guida" onPress={onTermina} loading={ending} style={[s.btn, { flex: 1 }]} testID="road-termina" />
      </View>
    </View>
  );
});

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: CLAY.bg },

  navWrap: { position: 'absolute', left: 0, right: 0 },
  navCard: { position: 'relative', left: undefined, right: undefined, marginHorizontal: 12 },

  stack: { position: 'absolute', left: 12, right: 12 },
  inStack: { position: 'relative', left: undefined, right: undefined },
  card: { borderRadius: 28, backgroundColor: CLAY.surface, paddingHorizontal: 16, paddingVertical: 14 },
  cardT1: { fontSize: 13.5, fontWeight: '500', color: CLAY.ink3 },
  cardT2: { fontSize: 18, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.3, marginTop: 1 },
  cardT3: { fontSize: 15, color: CLAY.ink2, marginTop: 2 },
  planRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  planNum: { width: 48, height: 48, borderRadius: 24, backgroundColor: CLAY.ink, alignItems: 'center', justifyContent: 'center' },
  planNumTx: { fontSize: 19, fontWeight: '600', color: '#FFFFFF', fontVariant: ['tabular-nums'] },

  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: 24,
    backgroundColor: CLAY.ink,
    ...CLAY_SHADOW.ink,
  },
  toastIc: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  toastImg: { width: 32, height: 32 },
  toastSg: { position: 'absolute', right: -4, bottom: -4 },
  toastT1: { fontSize: 15, fontWeight: '600', color: '#FFFFFF', letterSpacing: -0.2 },
  toastT2: { fontSize: 13, fontWeight: '400', color: 'rgba(255,255,255,0.65)', marginTop: 2 },
  undo: { height: 44, paddingHorizontal: 16, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  undoTx: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  placeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 },
  placeTx: { fontSize: 14, fontWeight: '500', color: 'rgba(255,255,255,0.5)' },
  placeOn: { color: '#FFFFFF', fontWeight: '600', textDecorationLine: 'underline' },
  placeSep: { fontSize: 14, color: 'rgba(255,255,255,0.35)' },
  freeBanner: { paddingVertical: 8, paddingLeft: 18 },

  speed: {
    position: 'absolute',
    left: 14,
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: CLAY.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  speedNum: { fontSize: 22, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.6, lineHeight: 24, fontVariant: ['tabular-nums'] },
  speedUnit: { fontSize: 10.5, fontWeight: '500', color: CLAY.ink3, marginTop: 1 },
  ctl: { position: 'absolute', right: 14, alignItems: 'flex-end', gap: 10 },
  round: { width: 50, height: 50, borderRadius: 25, backgroundColor: CLAY.surface, alignItems: 'center', justifyContent: 'center' },
  recenter: {
    height: 50,
    borderRadius: 25,
    paddingLeft: 14,
    paddingRight: 18,
    backgroundColor: CLAY.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recenterTx: { fontSize: 16, fontWeight: '600', color: CLAY.ink },

  panel: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 8,
    borderRadius: 40,
    backgroundColor: CLAY.surface,
    paddingTop: 16,
    paddingHorizontal: 14,
  },
  who: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 4 },
  name: { fontSize: 17, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.3 },
  liveRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  liveDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#E5484D', marginRight: 6 },
  liveTx: { fontSize: 13.5, fontWeight: '500', color: CLAY.ink3, flexShrink: 1 },
  liveRing: { width: 7, height: 7, borderRadius: 3.5, borderWidth: 1.5, borderColor: CLAY.ink, marginRight: 6 },
  liveWarn: { color: CLAY.ink },
  iconBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: CLAY.surface },
  stats: { flexDirection: 'row', marginTop: 14, paddingHorizontal: 4 },
  stat: { flex: 1 },
  statNum: { fontSize: 23, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.6, fontVariant: ['tabular-nums'] },
  statUnit: { fontSize: 14, fontWeight: '500', color: CLAY.ink3, letterSpacing: 0 },
  statLabel: { fontSize: 12.5, fontWeight: '400', color: CLAY.ink3, marginTop: 2 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 14 },
  // CTA da guida: più alte (60) delle CTA normali, stessa capsula clay.
  btn: { height: 60, borderRadius: 30 },
});
