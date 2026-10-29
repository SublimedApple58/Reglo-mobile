import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  InteractionManager,
  Platform,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { regloApi } from '../../../src/services/regloApi';
import type { RoadBriefing, RoadFreeOptions, RoadLesson, RoadRecentSession, RoadSuggestion } from '../../../src/types/regloApi';
import { RoadCarMarker } from '../../../src/components/road/RoadMapParts';
import { BriefingLines, RoadAvatar, RouteThumb, SessionNumbers } from '../../../src/components/road/RoadTabParts';
import { pagellinoPrompt } from '../../../src/road/pagellinoPrompt';
import { beginRoadEntry, ROAD_ROUTE } from '../../../src/road/entryFlow';
import { prefetchRoadFaces, ROAD_FREE_SHEET_ROUTE, roadFreePreselect, roadFreeStore } from '../../../src/road/freeStartStore';
import { lessonStudentName, useRoadSelector } from '../../../src/road/roadStore';
import { dayLabel, formatHm } from '../../../src/road/format';
import { openRoadPagellino } from '../../../src/road/pagellino';
import { openRoadPercorso } from '../../../src/road/openRoadPercorso';
import { DEFAULT_HOTSPOT_PERIOD, hotspotsStore, useHotspotsVersion, warmRoadHotspots } from '../../../src/road/hotspotsStore';
import { markerArt, ROAD_ASSETS } from '../../../src/road/markerArt';
import { InboxBellButton } from '../../../src/components/InboxBellButton';
import { CLAY, CLAY_SHADOW } from '../../../src/theme';
import { ClayButton, ClayList, ClayListRow, ClaySurface, Icon3D, PlayGlyph } from '../../../src/components/clay';
import Animated, { useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { ClayNavBar, NAV_BAR_H } from '../../../src/components/ClayLargeTitle';
import { RoadPressable } from '../../../src/components/road/RoadPressable';
import { CROSSFADE_TIMING, ROAD_FADE_IN, ROAD_FADE_OUT } from '../../../src/road/motion';
import { SkeletonBlock } from '../../../src/components/Skeleton';
import { useTabBarOverlap } from '../../../src/components/tabBarSpace';

/** Dopo quanto, a app ferma, si monta la schermata (mappa) in sottofondo. */
const ROAD_WARM_DELAY_MS = 1500;
const PITCH = 0;
const ALTITUDE = 1100; // iOS (metri)
const ZOOM = 15.6; // Android
const FALLBACK = { latitude: 45.0703, longitude: 7.6869 };

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

/** Stesse opzioni = niente ridisegno (la risposta arriva identica quasi sempre). */
const sameOptions = (a: RoadFreeOptions | null, b: RoadFreeOptions | null) =>
  a === b || (!!a && !!b && JSON.stringify(a) === JSON.stringify(b));

/**
 * REG-638 Road «mappa corta» (variante 2 scelta da Tiziano, 27/10).
 *
 * Mappa bassa in alto (dove sei, la sede) e sotto il pannello, che cambia
 * col momento:
 * - guida in agenda tra poco → briefing di quell'allievo e «Entra in Road»;
 * - guida appena finita col pagellino da compilare → «Compila il pagellino»;
 * - libero → «Con chi guidi?», tre volti suggeriti col motivo (ordine dal
 *   server) + «Tutti», briefing del volto scelto e «Parti con …».
 * In fondo le ultime guide registrate. Niente pillole né badge: i motivi sono
 * righe secondarie, il segno delle segnalazioni è un glifo.
 *
 * Leggera (fluidità 29/10, Tiziano): la schermata è divisa in sezioni in
 * `memo` (mappa, volti, briefing, bottone, ultime guide), così il tocco su un
 * volto ridisegna solo volti, briefing e bottone. Niente entrate dal basso né
 * transizioni di layout: solo dissolvenze brevi. Il cambio allievo è una
 * dissolvenza incrociata di contenuti GIÀ montati (i briefing dei tre volti
 * arrivano con le opzioni), ad altezza fissa: la pagina non si muove e al
 * tocco non parte nessuna chiamata.
 */
export default function RoadTab() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const barOverlap = useTabBarOverlap();
  const { height } = useWindowDimensions();
  // Solo fase e sessione: la tab non si ridisegna a ogni fix GPS.
  const roadPhase = useRoadSelector((st) => st.phase);
  const roadSession = useRoadSelector((st) => st.session);
  const mapRef = useRef<MapView>(null);
  // Montata in anticipo (tab `lazy: false`): finché non la si apre, la
  // schermata vera (mappa compresa) aspetta che l'app sia a riposo dopo
  // l'avvio, così non ruba fotogrammi all'Agenda.
  const focused = useIsFocused();
  const [armed, setArmed] = useState(focused);
  useEffect(() => {
    if (armed) return;
    if (focused) {
      setArmed(true);
      return;
    }
    let t: ReturnType<typeof setTimeout> | null = null;
    const task = InteractionManager.runAfterInteractions(() => {
      t = setTimeout(() => setArmed(true), ROAD_WARM_DELAY_MS);
    });
    return () => {
      task.cancel();
      if (t) clearTimeout(t);
    };
  }, [armed, focused]);
  const [pos, setPos] = useState<{ latitude: number; longitude: number } | null>(null);
  const [options, setOptionsRaw] = useState<RoadFreeOptions | null>(() => roadFreeStore.get());
  const setOptions = useCallback((next: RoadFreeOptions | null) => {
    setOptionsRaw((prev) => (sameOptions(prev, next) ? prev : next));
  }, []);
  // Opzioni arrivate dal prefetch d'avvio (`warmRoadFree`) mentre la tab era già montata.
  useEffect(
    () =>
      roadFreeStore.subscribe(() => {
        const next = roadFreeStore.get();
        if (next) setOptionsRaw((prev) => prev ?? next);
      }),
    [],
  );
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [otherMode, setOtherMode] = useState(false);

  const pickFace = useCallback((id: string) => {
    Haptics.selectionAsync().catch(() => undefined);
    setSelectedId(id);
  }, []);

  // Riconferma delle opzioni a ogni ritorno sulla tab, ma DOPO il cambio di
  // tab e senza ridisegnare se la risposta è la stessa.
  const load = useCallback(async () => {
    try {
      const next = await regloApi.getRoadFreeOptions();
      if (!sameOptions(roadFreeStore.get(), next)) {
        roadFreeStore.set(next);
        prefetchRoadFaces(next);
      }
      setOptions(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'Road non risponde. Riprova tra poco.');
    }
  }, [setOptions]);

  useFocusEffect(
    useCallback(() => {
      const task = InteractionManager.runAfterInteractions(() => {
        void load();
        // Punti critici pronti prima del tocco (§15.8): una volta per avvio.
        warmRoadHotspots();
      });
      return () => task.cancel();
    }, [load]),
  );

  // Dove sei: solo se il permesso c'è già (lo chiede «Parti», non la tab).
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const perm = await Location.getForegroundPermissionsAsync();
        if (!perm.granted) return;
        const last = await Location.getLastKnownPositionAsync({ maxAge: 10 * 60_000 });
        if (!alive || !last) return;
        setPos({ latitude: last.coords.latitude, longitude: last.coords.longitude });
      } catch {
        // la mappa resta sulla sede o sulla città di default
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const hq = options?.headquarters ?? null;
  const centerLat = pos?.latitude ?? hq?.lat ?? FALLBACK.latitude;
  const centerLng = pos?.longitude ?? hq?.lng ?? FALLBACK.longitude;
  useEffect(() => {
    mapRef.current?.setCamera({ center: { latitude: centerLat, longitude: centerLng }, heading: 0, pitch: PITCH, altitude: ALTITUDE, zoom: ZOOM });
  }, [centerLat, centerLng]);

  const inRoad = roadPhase !== 'idle' && !!roadSession;
  const current = options?.currentLesson ?? null;
  const showAgenda = !inRoad && !!current && !otherMode;

  // Volti: nella modalità «altro allievo» si toglie quello della guida in agenda.
  const faces: RoadSuggestion[] = useMemo(() => {
    const list = options?.suggestions ?? [];
    const filtered = current?.student ? list.filter((f) => f.id !== current.student!.id) : list;
    return filtered.slice(0, 3);
  }, [options, current]);
  const selId = (faces.find((f) => f.id === selectedId) ?? faces[0] ?? null)?.id ?? null;

  const recent = options?.recentSessions ?? null;
  // Guida finita col pagellino da compilare: niente CTA nella tab (resta una
  // sola primaria, «Parti con»). Si apre da sola il foglio «Appena finita»,
  // una volta per avvio dell'app; poi resta la riga in «Ultime guide».
  const toClose = options?.toClose ?? null;
  const toCloseId = toClose ? recent?.find((r) => r.id === toClose.sessionId)?.id ?? null : null;
  useFocusEffect(
    useCallback(() => {
      if (!toCloseId || inRoad || !pagellinoPrompt.shouldShow(toCloseId)) return;
      // Dopo il cambio di tab: il foglio non si sovrappone alla transizione.
      const t = setTimeout(() => {
        pagellinoPrompt.markShown(toCloseId);
        router.push('/(tabs)/drive/appena-finita');
      }, 450);
      return () => clearTimeout(t);
    }, [toCloseId, inRoad, router]),
  );

  const defaultVehicle = options?.vehicles.find((v) => v.id === options.defaultVehicleId) ?? null;
  const freeLine = [
    options?.nextLesson
      ? `Libero fino alle ${formatHm(options.nextLesson.startsAt)}`
      : options
        ? 'Libero per il resto della giornata'
        : null,
    defaultVehicle ? `${defaultVehicle.name} libera` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const openStart = useCallback(
    (studentId: string | null) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
      roadFreePreselect.set(studentId);
      router.push(ROAD_FREE_SHEET_ROUTE);
    },
    [router],
  );
  const toOther = useCallback(() => setOtherMode(true), []);
  const toAgenda = useCallback(() => setOtherMode(false), []);

  const mapH = Math.round(height * 0.36);

  // Barra in alto: il fondo entra mentre il bordo del pannello arriva sotto
  // la status bar, il titolo subito dopo. Tutto legato allo scroll.
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  const panelTopAt = mapH - 26 - (insets.top + NAV_BAR_H); // offset a cui il pannello tocca la barra
  const bell = useMemo(() => <InboxBellButton />, []);

  if (!armed) return <View style={s.root} />;

  const panelKey = !options && !inRoad ? (error ? 'err' : 'load') : inRoad ? 'inroad' : showAgenda && current ? 'agenda' : 'free';

  return (
    <View style={s.root}>
      <Animated.ScrollView
        style={{ flex: 1 }}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: 28 + barOverlap }}
        showsVerticalScrollIndicator={false}
        testID="road-tab"
      >
        <RoadMap
          mapRef={mapRef}
          height={mapH}
          topInset={insets.top}
          lat={centerLat}
          lng={centerLng}
          pos={pos}
          hq={hq}
          carColor={defaultVehicle?.carColor ?? null}
        />

        <View style={s.panel} testID="road-tab-panel">
          {panelKey === 'err' ? (
            <Animated.Text key="err" entering={ROAD_FADE_IN} exiting={ROAD_FADE_OUT} style={s.sub}>
              {error}
            </Animated.Text>
          ) : panelKey === 'load' ? (
            // Skeleton con la stessa forma di «Con chi guidi?»: il pannello non cambia altezza all'arrivo.
            <Animated.View key="load" exiting={ROAD_FADE_OUT} testID="road-tab-skeleton">
              <SkeletonBlock width="58%" height={28} radius={8} />
              <SkeletonBlock width="80%" height={15} radius={6} style={{ marginTop: 10 }} />
              <View style={s.faces}>
                {[0, 1, 2, 3].map((i) => (
                  <View key={i} style={s.face}>
                    <SkeletonBlock width={64} height={64} radius={32} />
                    <SkeletonBlock width={44} height={12} radius={5} style={{ marginTop: 3 }} />
                  </View>
                ))}
              </View>
              <SkeletonBlock height={54} radius={27} style={s.cta} />
            </Animated.View>
          ) : panelKey === 'inroad' ? (
            // ── Road in corso ────────────────────────────────────────────
            <Animated.View key="inroad" entering={ROAD_FADE_IN} exiting={ROAD_FADE_OUT}>
              <Text style={s.kicker}>Guida in corso</Text>
              <Text style={s.name}>{lessonStudentName(roadSession?.lesson)}</Text>
              <ClayButton title="Torna in Road" onPress={() => router.push(ROAD_ROUTE)} style={s.cta} />
            </Animated.View>
          ) : panelKey === 'agenda' && current ? (
            <Animated.View key="agenda" entering={ROAD_FADE_IN} exiting={ROAD_FADE_OUT} testID="road-tab-agenda">
              <AgendaPanel lesson={current} briefing={options?.briefings?.[current.student?.id ?? ''] ?? null} onOther={toOther} />
            </Animated.View>
          ) : (
            <Animated.View key="free" entering={ROAD_FADE_IN} exiting={ROAD_FADE_OUT} testID="road-tab-free">
              <Text style={s.title}>Con chi guidi?</Text>
              {freeLine ? <Text style={s.sub}>{freeLine}</Text> : null}
              <FaceRow faces={faces} selId={selId} onPick={pickFace} onAll={openStart} />
              {faces.length ? (
                <>
                  <BriefStack faces={faces} selId={selId} briefings={options?.briefings} />
                  <StartButton faces={faces} selId={selId} duration={options?.defaultDuration ?? 60} onStart={openStart} />
                </>
              ) : (
                <ClayButton title="Scegli l'allievo" onPress={() => openStart(null)} style={s.cta} testID="road-tab-start" />
              )}
              {otherMode && current ? (
                <RoadPressable kind="small" onPress={toAgenda} hitSlop={8} style={s.secondary}>
                  <Text style={s.secondaryTx}>Torna alla guida delle {formatHm(current.startsAt)}</Text>
                </RoadPressable>
              ) : null}
            </Animated.View>
          )}
        </View>

        {!inRoad && options ? <HotspotsEntry /> : null}

        {recent?.length && !inRoad ? (
          <Animated.View entering={ROAD_FADE_IN} exiting={ROAD_FADE_OUT}>
            <RecentSection recent={recent} hq={hq} toCloseId={toCloseId} />
          </Animated.View>
        ) : null}
      </Animated.ScrollView>

      {/* Barra a titolo grande (REG-639, componente unico): trasparente sulla
          mappa, bianca opaca col titolo quando il pannello ci arriva sotto. La
          campanella sta nella barra, così resta sempre a portata. */}
      <ClayNavBar title="Road" scrollY={scrollY} overlay={panelTopAt + 30} actions={bell} />
    </View>
  );
}

/** Mappa in alto: si ridisegna solo se cambiano centro, posizione o sede. */
const RoadMap = React.memo(function RoadMap({
  mapRef,
  height,
  topInset,
  lat,
  lng,
  pos,
  hq,
  carColor,
}: {
  mapRef: React.RefObject<MapView | null>;
  height: number;
  topInset: number;
  lat: number;
  lng: number;
  pos: { latitude: number; longitude: number } | null;
  hq: { lat: number; lng: number } | null;
  carColor: string | null;
}) {
  // Camera iniziale fissata al primo render: dopo si sposta con `setCamera`.
  const [initialCamera] = useState(() => ({ center: { latitude: lat, longitude: lng }, heading: 0, pitch: PITCH, altitude: ALTITUDE, zoom: ZOOM }));
  return (
    <View style={{ height }}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialCamera={initialCamera}
        mapPadding={{ top: topInset, right: 0, bottom: 28, left: 0 }}
        // Niente legalLabelInsets: con mapPadding Apple mette logo e «Legal»
        // affiancati sopra il pannello; spostarne uno solo li sovrapponeva.
        mapType={Platform.OS === 'ios' ? 'mutedStandard' : 'standard'}
        showsPointsOfInterest={false}
        showsCompass={false}
        showsScale={false}
        showsTraffic={false}
        showsUserLocation={false}
        toolbarEnabled={false}
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        userInterfaceStyle="light"
      >
        {pos ? <RoadCarMarker coordinate={pos} rotation={0} color={carColor} /> : null}
        {hq ? <HqMarker lat={hq.lat} lng={hq.lng} /> : null}
      </MapView>
    </View>
  );
});

/** Guida in agenda tra poco: briefing di quell'allievo e «Entra in Road». */
const AgendaPanel = React.memo(function AgendaPanel({
  lesson,
  briefing,
  onOther,
}: {
  lesson: RoadLesson;
  briefing: RoadBriefing | null;
  onOther: () => void;
}) {
  const router = useRouter();
  return (
    <>
      <Text style={s.kicker}>
        {['In agenda', formatHm(lesson.startsAt), lesson.vehicle ? [lesson.vehicle.name, lesson.vehicle.plate].filter(Boolean).join(' ') : null]
          .filter(Boolean)
          .join(' · ')}
      </Text>
      <Text style={s.name}>{lessonStudentName(lesson)}</Text>
      {briefing?.lines.length ? (
        <ClaySurface style={s.brief}>
          <Text style={s.briefTitle}>{briefing.title}</Text>
          <BriefingLines lines={briefing.lines} />
        </ClaySurface>
      ) : (
        <Text style={[s.sub, { marginTop: 6 }]}>Prima guida in Road con questo allievo.</Text>
      )}
      <ClayButton title="Entra in Road" leading={<PlayGlyph />} onPress={() => void beginRoadEntry(router, lesson)} style={s.cta} testID="road-tab-enter" />
      <RoadPressable kind="small" onPress={onOther} hitSlop={8} style={s.secondary}>
        <Text style={s.secondaryTx}>Parti con un altro allievo</Text>
      </RoadPressable>
    </>
  );
});

/** I tre volti suggeriti + «Tutti». Al tocco cambia solo l'anello (thread UI). */
const FaceRow = React.memo(function FaceRow({
  faces,
  selId,
  onPick,
  onAll,
}: {
  faces: RoadSuggestion[];
  selId: string | null;
  onPick: (id: string) => void;
  onAll: (id: string | null) => void;
}) {
  return (
    <View style={s.faces}>
      {faces.map((f) => (
        <FaceButton key={f.id} face={f} selected={selId === f.id} onPick={onPick} />
      ))}
      <RoadPressable kind="small" onPress={() => onAll(null)} style={s.face} accessibilityRole="button" testID="road-tab-all">
        <View style={[s.allCircle, CLAY_SHADOW.raiseSm]}>
          <Ionicons name="search" size={21} color={CLAY.ink} />
        </View>
        <Text style={s.faceName}>Tutti</Text>
      </RoadPressable>
    </View>
  );
});

const FaceButton = React.memo(function FaceButton({
  face,
  selected,
  onPick,
}: {
  face: RoadSuggestion;
  selected: boolean;
  onPick: (id: string) => void;
}) {
  return (
    <RoadPressable
      kind="small"
      onPress={() => onPick(face.id)}
      style={s.face}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${face.name}, ${face.reason}`}
      testID="road-tab-face"
    >
      <RoadAvatar userId={face.id} name={face.name} size={64} selected={selected} />
      <Text style={[s.faceName, selected && s.faceNameOn]} numberOfLines={1}>
        {firstName(face.name)}
      </Text>
    </RoadPressable>
  );
});

/**
 * Strato di una dissolvenza incrociata: tutti gli strati sono montati e
 * sovrapposti; quello attivo va a opacità 1 in 180 ms sul thread UI.
 */
function CrossfadeLayer({ active, style, children }: { active: boolean; style?: object; children: React.ReactNode }) {
  const fade = useAnimatedStyle(() => ({ opacity: withTiming(active ? 1 : 0, CROSSFADE_TIMING) }), [active]);
  return (
    <Animated.View
      style={[style, fade]}
      pointerEvents={active ? 'auto' : 'none'}
      accessibilityElementsHidden={!active}
      importantForAccessibility={active ? 'auto' : 'no-hide-descendants'}
    >
      {children}
    </Animated.View>
  );
}

/**
 * Briefing dei tre volti, già pronti e sovrapposti nella stessa card: la card
 * è alta quanto il più alto (riga con `marginLeft: -100%`), quindi al cambio
 * allievo non cambia altezza e sotto non si muove niente.
 */
const BriefStack = React.memo(function BriefStack({
  faces,
  selId,
  briefings,
}: {
  faces: RoadSuggestion[];
  selId: string | null;
  briefings: Record<string, RoadBriefing> | undefined;
}) {
  return (
    <ClaySurface style={s.brief}>
      <View style={s.stack}>
        {faces.map((f, i) => {
          const b = briefings?.[f.id] ?? null;
          return (
            <CrossfadeLayer key={f.id} active={f.id === selId} style={[s.layer, i > 0 && s.layerOver]}>
              <Text style={s.briefHead} numberOfLines={1}>
                {firstName(f.name)} · {f.reason}
              </Text>
              {b?.lines.length ? (
                <>
                  <Text style={s.briefTitle}>{b.title}</Text>
                  <BriefingLines lines={b.lines} />
                </>
              ) : (
                <Text style={[s.briefTitle, { marginBottom: 0 }]}>Nessuna segnalazione Road finora.</Text>
              )}
            </CrossfadeLayer>
          );
        })}
      </View>
    </ClaySurface>
  );
});

/** «Parti con …»: le tre scritte sovrapposte, larghe quanto la più lunga. */
const StartButton = React.memo(function StartButton({
  faces,
  selId,
  duration,
  onStart,
}: {
  faces: RoadSuggestion[];
  selId: string | null;
  duration: number;
  onStart: (id: string | null) => void;
}) {
  const labels = faces.map((f) => `Parti con ${firstName(f.name)} · ${duration} min`);
  const longest = labels.reduce((a, b) => (b.length > a.length ? b : a), '');
  return (
    <ClayButton leading={<PlayGlyph />} onPress={() => onStart(selId)} style={s.cta} testID="road-tab-start">
      <View>
        <Text style={[s.ctaTx, s.ghost]} numberOfLines={1} importantForAccessibility="no">
          {longest}
        </Text>
        {faces.map((f, i) => (
          <CrossfadeLayer key={f.id} active={f.id === selId} style={s.ctaLayer}>
            <Text style={s.ctaTx} numberOfLines={1}>
              {labels[i]}
            </Text>
          </CrossfadeLayer>
        ))}
      </View>
    </ClayButton>
  );
});

/** Ultime guide: non dipendono dal volto scelto, non si ridisegnano al tocco. */
const RecentSection = React.memo(function RecentSection({
  recent,
  hq,
  toCloseId,
}: {
  recent: RoadRecentSession[];
  hq: { lat: number; lng: number } | null;
  toCloseId: string | null;
}) {
  const router = useRouter();
  return (
    <View style={s.recent}>
      <Text style={s.section}>Ultime guide</Text>
      {/* Una superficie con le righe: l'ombra sta sulla lista, non sulle righe. */}
      <ClayList style={s.recentList}>
        {recent.map((r) => (
          <ClayListRow
            key={r.id}
            leading={<RouteThumb thumb={r.thumb} size={52} fallback={hq} carColor={r.lesson.carColor ?? null} />}
            title={lessonStudentName(r.lesson)}
            subtitle={
              r.id === toCloseId ? `${dayLabel(r.startedAt)} ${formatHm(r.lesson.startsAt)} · Pagellino da compilare` : <SessionNumbers session={r} withDay />
            }
            onPress={() =>
              r.id === toCloseId
                ? openRoadPagellino(router, r.lesson, { showStayChip: false }, '/(tabs)/drive/pagellino')
                : void openRoadPercorso(router, 'drive', r.appointmentId)
            }
            testID="road-tab-recent"
          />
        ))}
      </ClayList>
    </View>
  );
});

/**
 * REG-646 — accesso ai «Punti critici»: una riga col simbolo dell'errore più
 * frequente e dove capita. Legge lo store scaldato dalla tab (nessun fetch al tocco).
 */
const HotspotsEntry = React.memo(function HotspotsEntry() {
  const router = useRouter();
  useHotspotsVersion();
  const data = hotspotsStore.list(DEFAULT_HOTSPOT_PERIOD);
  const top = data?.hotspots[0] ?? null;
  const count = data?.hotspots.length ?? 0;
  const subtitle = top
    ? [`${top.label}${top.street ? ` in ${top.street}` : ''}`, count === 2 ? 'e un altro' : count > 2 ? `e altri ${count - 1}` : null].filter(Boolean).join(' · ')
    : data
      ? 'Ancora nessuno: si riempie con le segnalazioni'
      : 'Dove gli allievi sbagliano più spesso';
  return (
    <View style={s.recent}>
      <ClayList style={s.recentList}>
        <ClayListRow
          leading={<Icon3D source={top ? markerArt(top.kind) : ROAD_ASSETS.road} size={40} />}
          title="Punti critici"
          subtitle={subtitle}
          onPress={() => {
            Haptics.selectionAsync().catch(() => undefined);
            router.push('/(tabs)/drive/punti-critici' as never);
          }}
          testID="road-tab-hotspots"
        />
      </ClayList>
    </View>
  );
});

/**
 * Sede sulla mappa: punto nero in un cerchio bianco in rilievo + «Sede»
 * (niente icona, design-system §0.4). `tracksViewChanges` resta acceso fino
 * al primo layout, altrimenti iOS fotografa il marker vuoto.
 */
const HqMarker = React.memo(function HqMarker({ lat, lng }: { lat: number; lng: number }) {
  const [ready, setReady] = useState(false);
  const coordinate = useMemo(() => ({ latitude: lat, longitude: lng }), [lat, lng]);
  return (
    <Marker coordinate={coordinate} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={!ready}>
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
  root: { flex: 1, backgroundColor: CLAY.bg },
  hq: { alignItems: 'center', gap: 4 },
  hqIc: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: CLAY.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hqDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: CLAY.ink },
  hqTx: {
    fontSize: 12.5,
    fontWeight: '600',
    color: CLAY.ink,
    textShadowColor: 'rgba(255,255,255,0.95)',
    textShadowRadius: 3,
    textShadowOffset: { width: 0, height: 0 },
  },
  // Clay v2: pannello bianco che sale sulla mappa con un'ombra morbida in alto.
  panel: {
    marginTop: -28,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    backgroundColor: CLAY.bg,
    paddingTop: 26,
    paddingHorizontal: 20,
    paddingBottom: 8,
    boxShadow: [
      { offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1, color: 'rgba(17,17,17,0.04)' },
      { offsetX: 0, offsetY: -10, blurRadius: 28, spreadDistance: -14, color: 'rgba(17,17,17,0.22)' },
    ],
  },
  title: { fontSize: 28, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.7 },
  kicker: { fontSize: 14, fontWeight: '400', color: CLAY.ink3 },
  name: { fontSize: 26, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.7, marginTop: 3 },
  sub: { fontSize: 15, fontWeight: '400', color: CLAY.ink3, marginTop: 4, lineHeight: 20 },
  faces: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 22 },
  face: { alignItems: 'center', width: 72, gap: 9 },
  faceName: { fontSize: 13.5, fontWeight: '500', color: CLAY.ink3 },
  faceNameOn: { color: CLAY.ink, fontWeight: '600' },
  allCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: CLAY.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brief: { marginTop: 18, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 6, borderRadius: 26 },
  briefHead: { fontSize: 15.5, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.2 },
  briefTitle: { fontSize: 13.5, fontWeight: '400', color: CLAY.ink3, marginTop: 2, marginBottom: 4 },
  // Strati sovrapposti nella stessa riga: la riga prende l'altezza del più
  // alto, gli altri ci stanno sopra (`marginLeft: -100%`).
  stack: { flexDirection: 'row', alignItems: 'flex-start' },
  layer: { width: '100%' },
  layerOver: { marginLeft: '-100%' },
  cta: { marginTop: 18 },
  ghost: { opacity: 0 },
  ctaLayer: { position: 'absolute', left: 0, right: 0, top: 0, alignItems: 'center' },
  ctaTx: { fontSize: 17, fontWeight: '600', color: '#FFFFFF', letterSpacing: -0.3 },
  secondary: { alignItems: 'center', paddingVertical: 14 },
  secondaryTx: { fontSize: 15.5, fontWeight: '500', color: CLAY.ink2 },
  recent: { marginTop: 22 },
  section: { fontSize: 20, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.4, paddingHorizontal: 24, marginBottom: 12 },
  recentList: { marginHorizontal: 20 },
});
