import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Alert, Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView from 'react-native-maps';
import { useKeepAwake } from 'expo-keep-awake';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, Easing } from 'react-native-reanimated';
import * as Location from 'expo-location';

import * as Haptics from '../../src/utils/haptics';
import { lessonStudentName, roadStore, useRoadState } from '../../src/road/roadStore';
import { endRoad, undoRoadFree, undoRoadMarker } from '../../src/road/roadActions';
import { roadFreeStarted } from '../../src/road/freeStartStore';
import { ROAD_EXIT } from '../../src/road/motion';
import { openRoadPagellino } from '../../src/road/pagellino';
import { markerArt } from '../../src/road/markerArt';
import { formatHm, formatKm, formatMinutes, formatRange } from '../../src/road/format';
import { SentimentBadge } from '../../src/components/road/RoadSentiment';
import { Avatar, ClayButton, ClayMapControls } from '../../src/components/clay';
import { CLAY, CLAY_SHADOW } from '../../src/theme';
import { RoadCarMarker, RoadMarkerPin, RoadTrack } from '../../src/components/road/RoadMapParts';

/**
 * REG-638 Reglo Road — la guida in diretta, a tutto schermo.
 *
 * Mappa Apple (iOS) / Google (Android) che segue l'auto orientata nella
 * direzione di marcia; header vetro con allievo e pagellino; toast della
 * segnalazione con «Annulla»; velocità; pannello con km / minuti /
 * segnalazioni e i due bottoni. Lo schermo resta acceso finché si è qui.
 */

const PITCH = 40;
const ALTITUDE = 950; // iOS (metri)
const ZOOM = 16.2; // Android
// Spazio sopra/sotto in cui la mappa centra l'auto: la tiene un po' sotto la
// metà dello schermo, con più strada davanti (come l'anteprima). La scritta
// «Legal» di Apple sta fra il pannello e il cerchio della velocità.
const MAP_PADDING_TOP = 330;

function useNow(everyMs: number) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(t);
  }, [everyMs]);
  return now;
}

/**
 * Comparsa del toast: animazione esplicita (le `entering` di Reanimated non
 * partono se lo schermo è ancora coperto dal form sheet che si sta chiudendo).
 */
function RoadToastFrame({ children, style }: { children: React.ReactNode; style: object }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withTiming(1, { duration: 260, easing: Easing.out(Easing.cubic) });
  }, [p]);
  const anim = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [{ translateY: (1 - p.value) * -14 }],
  }));
  // In uscita si dissolve (niente sparizioni di botto, §8).
  return <Animated.View exiting={ROAD_EXIT} style={[style, anim]}>{children}</Animated.View>;
}

export default function RoadScreen() {
  useKeepAwake('reglo-road');
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const st = useRoadState();
  const mapRef = useRef<MapView>(null);
  const camHeading = useRef(0);
  const [following, setFollowing] = useState(true);
  const [panelH, setPanelH] = useState(170);
  const [ending, setEnding] = useState(false);
  const now = useNow(15_000);

  const session = st.session;
  const lesson = session?.lesson ?? null;
  const fix = st.fix;

  // La camera segue l'auto, orientata nella direzione di marcia.
  useEffect(() => {
    if (!following || !fix) return;
    const heading = fix.heading ?? camHeading.current;
    camHeading.current = heading;
    mapRef.current?.animateCamera(
      {
        center: { latitude: fix.lat, longitude: fix.lng },
        heading,
        pitch: PITCH,
        altitude: ALTITUDE,
        zoom: ZOOM,
      },
      { duration: 900 },
    );
  }, [fix, following]);

  // Prima del primo punto del tracking: centra sull'ultima posizione nota.
  useEffect(() => {
    if (fix) return;
    let alive = true;
    Location.getLastKnownPositionAsync()
      .then((p) => {
        if (!alive || !p) return;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Il toast «… segnato» resta 5 secondi.
  const toastId = st.toast?.clientId;
  useEffect(() => {
    if (!toastId) return;
    const t = setTimeout(() => roadStore.dismissToast(toastId), 5000);
    return () => clearTimeout(t);
  }, [toastId]);

  const markers = st.markers;
  const lastMarkerId = markers.length ? markers[markers.length - 1].clientId : null;
  const coords = st.track;

  const speedKmh = useMemo(() => {
    if (!fix || fix.speed == null || Date.now() - fix.t > 15_000) return 0;
    return Math.max(0, Math.round(fix.speed * 3.6));
  }, [fix]);

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
    // RoadController riporta alle tab appena la fase torna `idle`.
    if (!ok) setFreeOpen(false);
  };

  if (!session || !lesson) {
    return <View style={s.root} />;
  }

  const name = lessonStudentName(lesson);
  const elapsedSec = Math.max(0, (now - new Date(session.startedAt).getTime()) / 1000);
  const carRotation = fix?.heading != null ? fix.heading - camHeading.current : 0;
  const headerTop = insets.top + 2;
  // 12 pt sopra il pannello (stesso margine dei bordi), mai sopra logo/Legal.
  const ctlBottom = 8 + panelH + 12;

  const onRecenter = () => {
    Haptics.selectionAsync().catch(() => undefined);
    setFollowing(true);
    if (fix) {
      mapRef.current?.animateCamera(
        {
          center: { latitude: fix.lat, longitude: fix.lng },
          heading: fix.heading ?? camHeading.current,
          pitch: PITCH,
          altitude: ALTITUDE,
          zoom: ZOOM,
        },
        { duration: 600 },
      );
    }
  };

  const onSegnala = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    router.push('/road/segnala');
  };

  const onTermina = () => {
    if (ending) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
    Alert.alert(
      'Terminare la guida?',
      `La guida con ${name} viene segnata come completata e il GPS si spegne.`,
      [
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
      ],
    );
  };

  const onUndo = () => {
    if (!st.toast) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    void undoRoadMarker(st.toast.clientId);
  };

  const initialFix = session.last;

  return (
    <View style={s.root}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialCamera={{
          center: {
            latitude: fix?.lat ?? initialFix?.lat ?? 45.0703,
            longitude: fix?.lng ?? initialFix?.lng ?? 7.6869,
          },
          heading: fix?.heading ?? 0,
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
        rotateEnabled={false}
        pitchEnabled={false}
        userInterfaceStyle="light"
        onPanDrag={() => {
          if (following) setFollowing(false);
        }}
      >
        <RoadTrack coordinates={coords} />
        {markers.map((m) => (
          <RoadMarkerPin
            key={m.clientId}
            coordinate={{ latitude: m.lat, longitude: m.lng }}
            kind={m.kind}
            label={m.label}
            small={m.clientId !== lastMarkerId}
            sentiment={m.sentiment}
          />
        ))}
        {fix ? (
          <RoadCarMarker coordinate={{ latitude: fix.lat, longitude: fix.lng }} rotation={carRotation} color={lesson.carColor} />
        ) : null}
      </MapView>

      {/* Testata clay: allievo (volto vero), guida in corso, pagellino */}
      <View style={[s.header, CLAY_SHADOW.raise, { top: headerTop }]}>
        <Avatar userId={lesson.student?.id} name={name} size={42} />
        <View style={s.who}>
          <Text style={s.name} numberOfLines={1}>{name}</Text>
          <View style={s.liveRow}>
            <View style={s.liveDot} />
            <Text style={s.liveTx} numberOfLines={1}>
              In corso · {formatRange(lesson.startsAt, lesson.endsAt)}
            </Text>
          </View>
        </View>
        {st.evaluationEnabled ? (
          <Pressable
            onPress={() => openRoadPagellino(router, lesson, { showStayChip: true })}
            style={({ pressed }) => [s.pgBtn, CLAY_SHADOW.raiseSm, pressed && { transform: [{ scale: 0.95 }] }]}
            accessibilityRole="button"
            testID="road-pagellino"
          >
            <Text style={s.pgTx}>Pagellino</Text>
          </Pressable>
        ) : null}
      </View>

      {/* Toast della segnalazione appena fatta */}
      {st.toast ? (
        <RoadToastFrame key={st.toast.clientId} style={[s.toast, { top: headerTop + 70 + 10 }]}>
          <View style={s.toastIc}>
            <Image source={markerArt(st.toast.kind)} style={s.toastImg} resizeMode="contain" />
            {st.toast.sentiment ? (
              <SentimentBadge sentiment={st.toast.sentiment} size={18} style={s.toastSg} />
            ) : null}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.toastT1} numberOfLines={1}>{st.toast.label} segnato</Text>
            <Text style={s.toastT2} numberOfLines={1}>
              {[st.toast.street, formatHm(st.toast.at)].filter(Boolean).join(' · ')}
            </Text>
          </View>
          <Pressable onPress={onUndo} style={({ pressed }) => [s.undo, pressed && { opacity: 0.7 }]} testID="road-undo">
            <Text style={s.undoTx}>Annulla</Text>
          </Pressable>
        </RoadToastFrame>
      ) : null}

      {/* Guida appena avviata da Road: è in agenda, e per 10 secondi si annulla */}
      {freeOpen && freeStarted && !st.toast ? (
        <RoadToastFrame key={freeStarted.sessionId} style={[s.toast, s.freeBanner, { top: headerTop + 70 + 10 }]}>
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

      {/* Controlli mappa raggruppati, come in Apple Maps: velocità e «centra»
          in un'unica card bianca piena con ombra morbida, a destra sopra il
          pannello. A sinistra restano liberi logo Maps e «Legal». */}
      <ClayMapControls speedKmh={speedKmh} following={following} onRecenter={onRecenter} style={{ bottom: ctlBottom }} />

      {/* Pannello: numeri + azioni */}
      <View
        style={[s.panel, CLAY_SHADOW.raise, { paddingBottom: Math.max(14, insets.bottom - 20) }]}
        onLayout={(e) => setPanelH(e.nativeEvent.layout.height)}
      >
        <View style={s.stats}>
          <View style={s.stat}>
            <Text style={s.statNum}>
              {formatKm(st.distanceMeters)}
              <Text style={s.statUnit}> km</Text>
            </Text>
            <Text style={s.statLabel}>Percorsi</Text>
          </View>
          <View style={[s.stat, s.statSep]}>
            <Text style={s.statNum}>
              {formatMinutes(elapsedSec)}
              <Text style={s.statUnit}> min</Text>
            </Text>
            <Text style={s.statLabel}>Di guida</Text>
          </View>
          <View style={[s.stat, s.statSep]}>
            <Text style={s.statNum}>{markers.length}</Text>
            <Text style={s.statLabel}>Segnalazioni</Text>
          </View>
        </View>
        <View style={s.actions}>
          <ClayButton
            title="Segnala"
            leading={<Ionicons name="add" size={24} color="#FFFFFF" />}
            onPress={onSegnala}
            disabled={ending}
            style={[s.btn, { flex: 1.45 }]}
            testID="road-segnala"
          />
          <ClayButton
            variant="secondary"
            title="Termina guida"
            onPress={onTermina}
            loading={ending}
            style={[s.btn, { flex: 1 }]}
            testID="road-termina"
          />
        </View>
      </View>
    </View>
  );
}


const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: CLAY.bg },

  // Testata clay: superficie bianca in rilievo sopra la mappa (niente vetro).
  header: {
    position: 'absolute',
    left: 12,
    right: 12,
    height: 70,
    borderRadius: 28,
    backgroundColor: CLAY.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingLeft: 14,
    paddingRight: 12,
  },
  who: { flex: 1, minWidth: 0 },
  name: { fontSize: 16.5, fontWeight: '600', color: '#111111', letterSpacing: -0.3 },
  liveRow: { flexDirection: 'row', alignItems: 'center', marginTop: 1 },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#E5484D',
    marginRight: 6,
    borderWidth: 0,
    shadowColor: '#E5484D',
    shadowOpacity: 0.5,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 0 },
  },
  liveTx: { fontSize: 13, fontWeight: '500', color: '#6A6A6A' },
  pgBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: CLAY.surface,
  },
  pgTx: { fontSize: 14.5, fontWeight: '600', color: '#111111', letterSpacing: -0.2 },

  toast: {
    position: 'absolute',
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: 24,
    backgroundColor: CLAY.ink,
    ...CLAY_SHADOW.ink,
  },
  toastIc: {
    width: 46,
    height: 46,
    borderRadius: 23,
    // Bianco pieno: molte icone 3D sono scure e sul toast nero sparirebbero.
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toastImg: { width: 32, height: 32 },
  toastSg: { position: 'absolute', right: -4, bottom: -4 },
  toastT1: { fontSize: 15, fontWeight: '600', color: '#FFFFFF', letterSpacing: -0.2 },
  toastT2: { fontSize: 13, fontWeight: '400', color: 'rgba(255,255,255,0.65)', marginTop: 2 },
  undo: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  undoTx: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  freeBanner: { paddingVertical: 8, paddingLeft: 18 },

  panel: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 8,
    borderRadius: 46,
    backgroundColor: CLAY.surface,
    paddingTop: 20,
    paddingHorizontal: 14,
  },
  stats: { flexDirection: 'row', paddingHorizontal: 6 },
  stat: { flex: 1, paddingHorizontal: 12 },
  statSep: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: 'rgba(17,17,17,0.14)' },
  statNum: {
    fontSize: 27,
    fontWeight: '600',
    color: '#111111',
    letterSpacing: -0.8,
    fontVariant: ['tabular-nums'],
  },
  statUnit: { fontSize: 14, fontWeight: '500', color: '#6A6A6A', letterSpacing: 0 },
  statLabel: { fontSize: 12.5, fontWeight: '400', color: '#6A6A6A', marginTop: 4 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 18 },
  // CTA da guida: più alte (62) delle CTA normali, stessa capsula clay.
  btn: { height: 62, borderRadius: 31 },
});
