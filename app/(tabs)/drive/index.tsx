import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { regloApi } from '../../../src/services/regloApi';
import type { RoadFreeOptions, RoadSuggestion } from '../../../src/types/regloApi';
import { RoadCarMarker } from '../../../src/components/road/RoadMapParts';
import { BriefingLines, RoadAvatar, RouteThumb, SessionNumbers } from '../../../src/components/road/RoadTabParts';
import { pagellinoPrompt } from '../../../src/road/pagellinoPrompt';
import { beginRoadEntry, ROAD_ROUTE } from '../../../src/road/entryFlow';
import { ROAD_FREE_SHEET_ROUTE, roadFreePreselect, roadFreeStore } from '../../../src/road/freeStartStore';
import { lessonStudentName, useRoadSelector } from '../../../src/road/roadStore';
import { dayLabel, formatHm } from '../../../src/road/format';
import { openRoadPagellino } from '../../../src/road/pagellino';
import { openRoadPercorso } from '../../../src/road/openRoadPercorso';
import { InboxBellButton } from '../../../src/components/InboxBellButton';
import { CLAY, CLAY_SHADOW } from '../../../src/theme';
import { ClayButton, ClayList, ClayListRow, ClaySurface, PlayGlyph } from '../../../src/components/clay';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { RoadPressable } from '../../../src/components/road/RoadPressable';
import {
  ROAD_EXIT,
  ROAD_LAYOUT,
  ROAD_LAYOUT_AFTER_EXIT,
  ROAD_TEXT_IN,
  ROAD_TEXT_OUT,
  roadEnter,
  roadStagger,
} from '../../../src/road/motion';

const PITCH = 0;
const ALTITUDE = 1100; // iOS (metri)
const ZOOM = 15.6; // Android
const FALLBACK = { latitude: 45.0703, longitude: 7.6869 };
/** Altezza della barra compatta sotto la status bar. */
const NAV_H = 44;

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

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
 */
export default function RoadTab() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  // Solo fase e sessione: la tab non si ridisegna a ogni fix GPS.
  const roadPhase = useRoadSelector((s) => s.phase);
  const roadSession = useRoadSelector((s) => s.session);
  const mapRef = useRef<MapView>(null);
  const [pos, setPos] = useState<{ latitude: number; longitude: number } | null>(null);
  const [options, setOptions] = useState<RoadFreeOptions | null>(() => roadFreeStore.get());
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [otherMode, setOtherMode] = useState(false);

  const load = useCallback(async () => {
    try {
      const next = await regloApi.getRoadFreeOptions();
      roadFreeStore.set(next);
      setOptions(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'Road non risponde. Riprova tra poco.');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
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
  const center = pos ?? (hq ? { latitude: hq.lat, longitude: hq.lng } : FALLBACK);
  useEffect(() => {
    mapRef.current?.setCamera({ center, heading: 0, pitch: PITCH, altitude: ALTITUDE, zoom: ZOOM });
  }, [center.latitude, center.longitude]); // eslint-disable-line react-hooks/exhaustive-deps

  const inRoad = roadPhase !== 'idle' && !!roadSession;
  const current = options?.currentLesson ?? null;
  const showAgenda = !inRoad && !!current && !otherMode;

  // Volti: nella modalità «altro allievo» si toglie quello della guida in agenda.
  const faces: RoadSuggestion[] = useMemo(() => {
    const list = options?.suggestions ?? [];
    const filtered = current?.student ? list.filter((s) => s.id !== current.student!.id) : list;
    return filtered.slice(0, 3);
  }, [options, current]);
  const selected = faces.find((f) => f.id === selectedId) ?? faces[0] ?? null;

  const recent = options?.recentSessions ?? [];
  // Guida finita col pagellino da compilare: niente CTA nella tab (resta una
  // sola primaria, «Parti con»). Si apre da sola il foglio «Appena finita»,
  // una volta per avvio dell'app; poi resta la riga in «Ultime guide».
  const toClose = options?.toClose ?? null;
  const toCloseSession = toClose ? recent.find((r) => r.id === toClose.sessionId) ?? null : null;
  const toCloseId = toCloseSession?.id ?? null;
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

  const openStart = (studentId: string | null) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    roadFreePreselect.set(studentId);
    router.push(ROAD_FREE_SHEET_ROUTE);
  };

  const mapH = Math.round(height * 0.36);

  // Barra in alto: il fondo (blur) entra mentre il bordo del pannello arriva
  // sotto la status bar, il titolo subito dopo. Tutto legato allo scroll,
  // quindi segue il dito senza scatti né rimbalzi.
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  const panelTopAt = mapH - 26 - (insets.top + NAV_H); // offset a cui il pannello tocca la barra
  const navBgStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [panelTopAt - 40, panelTopAt], [0, 1], Extrapolation.CLAMP),
  }));
  const navTitleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [panelTopAt, panelTopAt + 30], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(scrollY.value, [panelTopAt, panelTopAt + 30], [6, 0], Extrapolation.CLAMP) }],
  }));
  const briefingOf = (id: string | null | undefined) => (id ? options?.briefings?.[id] ?? null : null);

  return (
    <View style={s.root}>
      <Animated.ScrollView
        style={{ flex: 1 }}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: 28 }}
        showsVerticalScrollIndicator={false}
        testID="road-tab"
      >
        <View style={{ height: mapH }}>
          <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFill}
            initialCamera={{ center, heading: 0, pitch: PITCH, altitude: ALTITUDE, zoom: ZOOM }}
            mapPadding={{ top: insets.top, right: 0, bottom: 28, left: 0 }}
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
            {pos ? <RoadCarMarker coordinate={pos} rotation={0} color={defaultVehicle?.carColor ?? null} /> : null}
            {hq ? (
              <HqMarker coordinate={{ latitude: hq.lat, longitude: hq.lng }} />
            ) : null}
          </MapView>
          <InboxBellButton style={[s.bell, { top: insets.top + 10 }]} />
        </View>

        <Animated.View style={s.panel} layout={ROAD_LAYOUT} testID="road-tab-panel">
          {!options && !inRoad ? (
            error ? (
              <Animated.Text key="err" entering={ROAD_TEXT_IN} exiting={ROAD_TEXT_OUT} style={s.sub}>{error}</Animated.Text>
            ) : (
              <Animated.View key="load" entering={ROAD_TEXT_IN} exiting={ROAD_TEXT_OUT}>
                <ActivityIndicator color="#111111" style={{ marginVertical: 30 }} />
              </Animated.View>
            )
          ) : inRoad ? (
            // ── Road in corso ────────────────────────────────────────────
            <Animated.View key="inroad" entering={roadEnter()} exiting={ROAD_EXIT} layout={ROAD_LAYOUT}>
              <Text style={s.kicker}>Guida in corso</Text>
              <Text style={s.name}>{lessonStudentName(roadSession?.lesson)}</Text>
              <ClayButton title="Torna in Road" onPress={() => router.push(ROAD_ROUTE)} style={s.cta} />
            </Animated.View>
          ) : showAgenda && current ? (
            // ── Guida in agenda tra poco ─────────────────────────────────
            <Animated.View key="agenda" entering={roadEnter()} exiting={ROAD_EXIT} layout={ROAD_LAYOUT} testID="road-tab-agenda">
              <Text style={s.kicker}>
                {['In agenda', formatHm(current.startsAt), current.vehicle ? [current.vehicle.name, current.vehicle.plate].filter(Boolean).join(' ') : null]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
              <Text style={s.name}>{lessonStudentName(current)}</Text>
              {briefingOf(current.student?.id)?.lines.length ? (
                <ClaySurface style={s.brief}>
                  <Text style={s.briefTitle}>{briefingOf(current.student?.id)!.title}</Text>
                  <BriefingLines lines={briefingOf(current.student?.id)!.lines} />
                </ClaySurface>
              ) : (
                <Text style={[s.sub, { marginTop: 6 }]}>Prima guida in Road con questo allievo.</Text>
              )}
              <ClayButton
                title="Entra in Road"
                leading={<PlayGlyph />}
                onPress={() => void beginRoadEntry(router, current)}
                style={s.cta}
                testID="road-tab-enter"
              />
              <RoadPressable kind="small" onPress={() => setOtherMode(true)} hitSlop={8} style={s.secondary}>
                <Text style={s.secondaryTx}>Parti con un altro allievo</Text>
              </RoadPressable>
            </Animated.View>
          ) : (
            <Animated.View key="free" entering={roadEnter()} exiting={ROAD_EXIT} layout={ROAD_LAYOUT}>
              {/* ── Libero: con chi guidi? ─────────────────────────────── */}
              <Animated.View layout={ROAD_LAYOUT} testID="road-tab-free">
                <Text style={s.title}>Con chi guidi?</Text>
                {freeLine ? (
                  <Animated.Text key={freeLine} entering={ROAD_TEXT_IN} style={s.sub}>
                    {freeLine}
                  </Animated.Text>
                ) : null}

                <View style={s.faces}>
                  {faces.map((f, i) => (
                    <Animated.View key={f.id} entering={roadStagger(i)}>
                    <RoadPressable
                      kind="small"
                      onPress={() => {
                        Haptics.selectionAsync().catch(() => undefined);
                        setSelectedId(f.id);
                      }}
                      style={s.face}
                      accessibilityRole="button"
                      accessibilityLabel={`${f.name}, ${f.reason}`}
                      testID="road-tab-face"
                    >
                      <RoadAvatar userId={f.id} name={f.name} size={64} selected={selected?.id === f.id} />
                      <Text style={[s.faceName, selected?.id === f.id && s.faceNameOn]} numberOfLines={1}>
                        {firstName(f.name)}
                      </Text>
                    </RoadPressable>
                    </Animated.View>
                  ))}
                  <Animated.View entering={roadStagger(faces.length)}>
                    <RoadPressable kind="small" onPress={() => openStart(null)} style={s.face} accessibilityRole="button" testID="road-tab-all">
                      <View style={[s.allCircle, CLAY_SHADOW.raiseSm]}>
                        <Ionicons name="search" size={21} color={CLAY.ink} />
                      </View>
                      <Text style={s.faceName}>Tutti</Text>
                    </RoadPressable>
                  </Animated.View>
                </View>

                {selected ? (
                  <Animated.View layout={ROAD_LAYOUT}>
                    {/* Il briefing cambia col volto: dissolvenza incrociata, l'altezza scivola. */}
                    <Animated.View layout={ROAD_LAYOUT}>
                      <ClaySurface style={s.brief}>
                        <Animated.View key={selected.id} entering={ROAD_TEXT_IN} exiting={ROAD_TEXT_OUT} layout={ROAD_LAYOUT}>
                          <Text style={s.briefHead} numberOfLines={1}>
                            {firstName(selected.name)} · {selected.reason}
                          </Text>
                          {briefingOf(selected.id)?.lines.length ? (
                            <>
                              <Text style={s.briefTitle}>{briefingOf(selected.id)!.title}</Text>
                              <BriefingLines lines={briefingOf(selected.id)!.lines} />
                            </>
                          ) : (
                            <Text style={[s.briefTitle, { marginBottom: 0 }]}>Nessuna segnalazione Road finora.</Text>
                          )}
                        </Animated.View>
                      </ClaySurface>
                    </Animated.View>
                    <Animated.View layout={ROAD_LAYOUT}>
                      <ClayButton leading={<PlayGlyph />} onPress={() => openStart(selected.id)} style={s.cta} testID="road-tab-start">
                        <Animated.Text key={selected.id} entering={ROAD_TEXT_IN} style={s.ctaTx} numberOfLines={1}>
                          Parti con {firstName(selected.name)} · {options?.defaultDuration ?? 60} min
                        </Animated.Text>
                      </ClayButton>
                    </Animated.View>
                  </Animated.View>
                ) : (
                  <ClayButton title="Scegli l'allievo" onPress={() => openStart(null)} style={s.cta} testID="road-tab-start" />
                )}
                {otherMode && current ? (
                  <Animated.View entering={roadEnter()} exiting={ROAD_EXIT}>
                    <RoadPressable kind="small" onPress={() => setOtherMode(false)} hitSlop={8} style={s.secondary}>
                      <Text style={s.secondaryTx}>Torna alla guida delle {formatHm(current.startsAt)}</Text>
                    </RoadPressable>
                  </Animated.View>
                ) : null}
              </Animated.View>
            </Animated.View>
          )}
        </Animated.View>

        {recent.length && !inRoad ? (
          <Animated.View style={s.recent} entering={roadEnter(120)} exiting={ROAD_EXIT} layout={ROAD_LAYOUT_AFTER_EXIT}>
            <Text style={s.section}>Ultime guide</Text>
            {/* Una superficie con le righe: l'ombra sta sulla lista, non sulle righe. */}
            <ClayList style={s.recentList}>
              {recent.map((r) => (
                <ClayListRow
                  key={r.id}
                  leading={<RouteThumb thumb={r.thumb} size={52} fallback={hq} />}
                  title={lessonStudentName(r.lesson)}
                  subtitle={
                    r.id === toCloseId
                      ? `${dayLabel(r.startedAt)} ${formatHm(r.lesson.startsAt)} · Pagellino da compilare`
                      : <SessionNumbers session={r} withDay />
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
          </Animated.View>
        ) : null}
      </Animated.ScrollView>

      {/* Barra iOS che compare scorrendo: il pannello non passa mai «nudo»
          sotto orario e isola dinamica (blur + fondo bianco, titolo compatto). */}
      <View style={[s.navWrap, { height: insets.top + NAV_H, paddingTop: insets.top }]} pointerEvents="box-none">
        <Animated.View style={[StyleSheet.absoluteFill, navBgStyle]} pointerEvents="none">
          {Platform.OS === 'ios' ? (
            <BlurView intensity={80} tint="systemChromeMaterialLight" style={StyleSheet.absoluteFill} />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.97)' }]} />
          )}
          <View style={s.navBorder} />
        </Animated.View>
        <View style={s.navRow} pointerEvents="none">
          <Animated.Text style={[s.navTitle, navTitleStyle]}>Road</Animated.Text>
        </View>
      </View>
    </View>
  );
}

/**
 * Sede sulla mappa: punto nero in un cerchio bianco in rilievo + «Sede»
 * (niente icona, design-system §0.4). `tracksViewChanges` resta acceso fino
 * al primo layout, altrimenti iOS fotografa il marker vuoto.
 */
function HqMarker({ coordinate }: { coordinate: { latitude: number; longitude: number } }) {
  const [ready, setReady] = useState(false);
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
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: CLAY.bg },
  bell: { position: 'absolute', right: 20 },
  navWrap: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  navBorder: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(60,60,67,0.2)',
  },
  navRow: { height: NAV_H, alignItems: 'center', justifyContent: 'center' },
  navTitle: { fontSize: 17, fontWeight: '600', color: '#111111', letterSpacing: -0.3 },
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
  cta: { marginTop: 18 },
  ctaTx: { fontSize: 17, fontWeight: '600', color: '#FFFFFF', letterSpacing: -0.3 },
  secondary: { alignItems: 'center', paddingVertical: 14 },
  secondaryTx: { fontSize: 15.5, fontWeight: '500', color: CLAY.ink2 },
  recent: { marginTop: 22 },
  section: { fontSize: 20, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.4, paddingHorizontal: 24, marginBottom: 12 },
  recentList: { marginHorizontal: 20 },
});
