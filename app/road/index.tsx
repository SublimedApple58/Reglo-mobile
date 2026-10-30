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
import MapView, { Polyline } from 'react-native-maps';
import { useKeepAwake } from 'expo-keep-awake';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, Easing, ReduceMotion } from 'react-native-reanimated';
import * as Location from 'expo-location';

import * as Haptics from '../../src/utils/haptics';
import { lessonStudentName, roadStore, useRoadSelector } from '../../src/road/roadStore';
import { endRoad, recordHotspotCheck, undoHotspotCheck, undoRoadFree, undoRoadMarker } from '../../src/road/roadActions';
import { roadFreeStarted } from '../../src/road/freeStartStore';
import { ROAD_EXIT, ROAD_TEXT_IN } from '../../src/road/motion';
import { PLAN_ALERT_MS, PLAN_REACHED_MS } from '../../src/road/planAlerts';
import { openRoadPagellino } from '../../src/road/pagellino';
import { openRoadNotes, prefetchRoadNotes } from '../../src/road/roadNotes';
import { markerArt } from '../../src/road/markerArt';
import { formatHm, formatKm, formatMinutes, formatRange } from '../../src/road/format';
import { createLiveMotion, headingDelta } from '../../src/road/liveMotion';
import {
  HOTSPOT_DECIDE_MS,
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
 * Lo schermo resta acceso finché si è qui.
 */

const PITCH = 40;
const ALTITUDE = 900; // iOS (metri)
const ZOOM = 16.4; // Android
// Spazio sopra/sotto in cui la mappa centra l'auto: la tiene sotto la metà
// dello schermo, con più strada davanti.
const MAP_PADDING_TOP = 330;
/** Ogni quanto si muove la camera (ms): ~30 al secondo bastano e non intasano. */
const CAMERA_FRAME_MS = 33;
/** Quanto dura il riaggancio animato prima che riparta il fotogramma per fotogramma. */
const RECENTER_MS = 500;
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

/** La traccia fatta: grigia e sottile, sempre montata (posto fisso in MapView). */
const LiveTrack = React.memo(function LiveTrack({ center }: { center: { lat: number; lng: number } }) {
  const track = useRoadSelector((s) => s.track);
  const still = useMemo(() => STILL(center), [center]);
  return (
    <Polyline
      coordinates={track.length >= 2 ? track : still}
      strokeColor={track.length >= 2 ? 'rgba(17,17,17,0.30)' : 'rgba(17,17,17,0)'}
      strokeWidth={5}
      lineCap="round"
      lineJoin="round"
      zIndex={1}
    />
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

/** L'auto come marker, visibile solo con la mappa libera (ultimo figlio della mappa). */
const LiveCarMarker = React.memo(function LiveCarMarker({
  following,
  mapHeading,
  color,
  epoch,
}: {
  following: boolean;
  mapHeading: number;
  color?: string | null;
  epoch: number;
}) {
  const fix = useRoadSelector((s) => (following ? null : s.fix));
  const last = useRef<typeof fix>(null);
  if (fix) last.current = fix;
  const shown = fix ?? last.current ?? roadStore.get().fix;
  if (!shown) return null;
  return (
    <RoadLiveCarMarker
      key={`car-${epoch}`}
      coordinate={{ latitude: shown.lat, longitude: shown.lng }}
      rotation={(shown.heading ?? 0) - mapHeading}
      color={color}
      opacity={following ? 0 : 1}
    />
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
    if (!fix) return { step: null, stop: null, left: null, offLine: false };
    const offConfirmed = offSince != null && fix.t - offSince >= REROUTE_OFF_MS;
    const r = navState({ m: measured, steps, stops, stopAlong, done, p: fix, prevAlong: along.current, offConfirmed });
    along.current = r.along;
    return r;
  }, [fix, measured, steps, stops, stopAlong, done, offSince]);
}

// ─── Schermata ──────────────────────────────────────────────────────────────

export default function RoadScreen() {
  useKeepAwake('reglo-road');
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const session = useRoadSelector((s) => s.session);
  const lesson = session?.lesson ?? null;
  const mapRef = useRef<MapView>(null);
  const [following, setFollowing] = useState(true);
  const followingRef = useRef(true);
  followingRef.current = following;
  const [panelH, setPanelH] = useState(220);
  const [topH, setTopH] = useState(0);
  const [mapHeading, setMapHeading] = useState(0);
  const [ending, setEnding] = useState(false);
  // REG-673: al ritorno dal background il marker si rimonta da zero.
  const [carEpoch, setCarEpoch] = useState(0);

  // ── Movimento fluido (REG-678) ──
  const motion = useRef(createLiveMotion(null)).current;
  const carRot = useSharedValue(0);
  const carHalo = useSharedValue(CAR_DISC);
  const carVisible = useSharedValue(1);
  const [carPt, setCarPt] = useState<{ x: number; y: number } | null>(null);
  const resumeAt = useRef(0);
  const camOk = useRef(false);

  // I punti GPS (tracking) entrano nel motore del movimento, senza ridisegnare.
  useEffect(() => {
    let last = roadStore.get().fix;
    if (last) motion.push(last);
    return roadStore.subscribe(() => {
      const f = roadStore.get().fix;
      if (f && f !== last) {
        last = f;
        motion.push(f);
      }
    });
  }, [motion]);

  // Più punti solo per il disegno (1 al secondo) finché la schermata è aperta:
  // il tracking ne manda uno ogni 8 m e a passo d'uomo diventano radi.
  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;
    let alive = true;
    Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 0, timeInterval: 1000 },
      (l) => {
        const c = l.coords;
        if (c.accuracy != null && c.accuracy > 50) return;
        motion.push({
          lat: c.latitude,
          lng: c.longitude,
          speed: c.speed != null && c.speed >= 0 ? c.speed : null,
          heading: c.heading != null && c.heading >= 0 ? c.heading : null,
          accuracy: c.accuracy ?? null,
        });
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
  }, [motion]);

  // La camera segue l'auto fotogramma per fotogramma (niente animazioni da 900 ms
  // con accelerazione e frenata a ogni punto: erano gli «scattini»).
  useEffect(() => {
    if (!following) {
      carVisible.value = withTiming(0, { duration: 150, reduceMotion: ReduceMotion.Never });
      return;
    }
    let raf = 0;
    let lastCam = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const now = Date.now();
      const smp = motion.sample(now);
      if (!smp) return;
      carRot.value = headingDelta(smp.camHeading, smp.heading);
      const acc = smp.accuracy ?? 10;
      carHalo.value = Math.max(CAR_DISC, Math.min(120, acc * 3.2));
      if (now < resumeAt.current || now - lastCam < CAMERA_FRAME_MS) return;
      lastCam = now;
      mapRef.current?.setCamera({
        center: { latitude: smp.lat, longitude: smp.lng },
        heading: smp.camHeading,
        pitch: PITCH,
        altitude: ALTITUDE,
        zoom: ZOOM,
      });
      if (!camOk.current) {
        camOk.current = true;
        // Dove cade il centro della camera sullo schermo: lì sta l'auto. La
        // camera si ferma un attimo mentre si misura (se no la misura è vecchia).
        resumeAt.current = now + 260;
        const at = { latitude: smp.lat, longitude: smp.lng };
        setTimeout(() => {
          mapRef.current
            ?.pointForCoordinate(at)
            .then((p) => {
              if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) setCarPt({ x: p.x, y: p.y });
            })
            .catch(() => undefined);
        }, 120);
      }
    };
    raf = requestAnimationFrame(tick);
    carVisible.value = withTiming(1, { duration: 150, reduceMotion: ReduceMotion.Never });
    return () => cancelAnimationFrame(raf);
  }, [following, motion, carRot, carHalo, carVisible]);

  // Cambia lo spazio della mappa (pannello, card): si rimisura dove sta l'auto.
  useEffect(() => {
    camOk.current = false;
  }, [panelH]);

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

  // Ritorno dal background: marker rimontato (REG-673), camera rimisurata.
  useEffect(() => {
    let prev = AppState.currentState;
    const sub = AppState.addEventListener('change', (next) => {
      const back = next === 'active' && prev !== 'active';
      prev = next;
      if (!back) return;
      setCarEpoch((n) => n + 1);
      camOk.current = false;
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
        mapRef.current?.setCamera({
          center: { latitude: p.coords.latitude, longitude: p.coords.longitude },
          heading: 0,
          pitch: PITCH,
          altitude: ALTITUDE,
          zoom: ZOOM,
        });
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [motion]);

  // Un gesto sulla mappa (trascinare, pizzicare, ruotare) sgancia la camera.
  // Su iOS react-native-maps non dice se il movimento nasce da un gesto: si
  // guardano i tocchi sul contenitore (un tocco fermo non sgancia).
  const touch = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: GestureResponderEvent) => {
    const t = e.nativeEvent;
    touch.current = { x: t.pageX, y: t.pageY };
    if ((t.touches?.length ?? 1) > 1 && followingRef.current) setFollowing(false);
  };
  const onTouchMove = (e: GestureResponderEvent) => {
    if (!followingRef.current || !touch.current) return;
    const t = e.nativeEvent;
    if ((t.touches?.length ?? 1) > 1 || Math.hypot(t.pageX - touch.current.x, t.pageY - touch.current.y) > 8) {
      setFollowing(false);
    }
  };

  // Con la mappa libera: la direzione della mappa (bussola, auto marker).
  const onRegionDone = useCallback(() => {
    if (followingRef.current) return;
    mapRef.current
      ?.getCamera()
      .then((c) => setMapHeading(c?.heading ?? 0))
      .catch(() => undefined);
  }, []);

  const onRecenter = useCallback(() => {
    Haptics.selectionAsync().catch(() => undefined);
    const smp = motion.sample();
    motion.alignCamera();
    resumeAt.current = Date.now() + RECENTER_MS;
    setMapHeading(0);
    if (smp) {
      mapRef.current?.animateCamera(
        { center: { latitude: smp.lat, longitude: smp.lng }, heading: smp.heading, pitch: PITCH, altitude: ALTITUDE, zoom: ZOOM },
        { duration: RECENTER_MS },
      );
    }
    setFollowing(true);
  }, [motion]);

  const onNorth = useCallback(() => {
    Haptics.selectionAsync().catch(() => undefined);
    mapRef.current?.animateCamera({ heading: 0 }, { duration: 350 });
    setMapHeading(0);
  }, []);

  if (!session || !lesson) {
    return <View style={s.root} />;
  }

  const initialFix = session.last ?? roadStore.get().fix;
  const center = initialFix ? { lat: initialFix.lat, lng: initialFix.lng } : { lat: 45.0703, lng: 7.6869 };
  const topStart = insets.top + 4;
  const ctlBottom = 8 + panelH + 12;

  return (
    <View style={s.root}>
      <View style={StyleSheet.absoluteFill} onTouchStart={onTouchStart} onTouchMove={onTouchMove}>
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          initialCamera={{
            center: { latitude: center.lat, longitude: center.lng },
            heading: initialFix?.heading ?? 0,
            pitch: PITCH,
            altitude: ALTITUDE,
            zoom: ZOOM,
          }}
          mapPadding={{ top: MAP_PADDING_TOP, right: 0, bottom: 8 + panelH, left: 0 }}
          legalLabelInsets={{ top: 0, right: 0, bottom: 8 + panelH + 14, left: 18 }}
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
          onPanDrag={() => {
            if (followingRef.current) setFollowing(false);
          }}
          onRegionChangeComplete={onRegionDone}
        >
          {/* REG-652: posti fissi, PRIMA degli altri figli (crash AIRMap, vedi RoadGuideOverlay) */}
          <LiveGuide center={center} />
          <LiveTrack center={center} />
          <LivePins />
          <LiveCarMarker following={following && !!carPt} mapHeading={mapHeading} color={lesson.carColor} epoch={carEpoch} />
        </MapView>
      </View>

      {carPt ? (
        <RoadLiveCar x={carPt.x} y={carPt.y} rotation={carRot} halo={carHalo} visible={carVisible} color={lesson.carColor} />
      ) : null}

      <LiveTop top={topStart} onLayoutTop={setTopH} topH={topH} />

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

function LiveTop({ top, topH, onLayoutTop }: { top: number; topH: number; onLayoutTop: (h: number) => void }) {
  const nav = useNav();
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
  useEffect(() => {
    if (!toastId) return;
    const t = setTimeout(() => roadStore.dismissToast(toastId), 5000);
    return () => clearTimeout(t);
  }, [toastId]);
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
            <Text style={s.toastT2} numberOfLines={1}>
              {[toast.street, formatHm(toast.at)].filter(Boolean).join(' · ')}
            </Text>
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
  const fix = useRoadSelector((s) => s.fix);
  const speedKmh = !fix || fix.speed == null || Date.now() - fix.t > 15_000 ? 0 : Math.max(0, Math.round(fix.speed * 3.6));
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
          <View style={s.liveRow}>
            <View style={s.liveDot} />
            <Text style={s.liveTx} numberOfLines={1} accessibilityLabel={`In corso, ${formatRange(lesson.startsAt, lesson.endsAt)}`}>
              {formatRange(lesson.startsAt, lesson.endsAt)} · {formatMinutes(elapsedSec)} min
            </Text>
          </View>
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
  undo: { height: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  undoTx: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
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
  liveTx: { fontSize: 13.5, fontWeight: '500', color: CLAY.ink3 },
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
