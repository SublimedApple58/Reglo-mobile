import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
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
import type { RoadFreeOptions, RoadRecentSession, RoadSuggestion } from '../../../src/types/regloApi';
import { RoadCarMarker } from '../../../src/components/road/RoadMapParts';
import { BriefingLines, RoadAvatar, RouteThumb } from '../../../src/components/road/RoadTabParts';
import { SENTIMENT_BAD, SENTIMENT_GOOD } from '../../../src/components/road/RoadSentiment';
import { beginRoadEntry, ROAD_ROUTE } from '../../../src/road/entryFlow';
import { ROAD_FREE_SHEET_ROUTE, roadFreePreselect, roadFreeStore } from '../../../src/road/freeStartStore';
import { lessonStudentName, useRoadState } from '../../../src/road/roadStore';
import { dayLabel, formatHm, formatKm, formatMinutes, formatRange } from '../../../src/road/format';
import { openRoadPagellino } from '../../../src/road/pagellino';
import { openRoadPercorso } from '../../../src/road/openRoadPercorso';
import { InboxBellButton } from '../../../src/components/InboxBellButton';
import { CTA_HEIGHT, CTA_RADIUS } from '../../../src/theme';
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
  ROAD_CARD_EXIT,
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
  const road = useRoadState();
  const mapRef = useRef<MapView>(null);
  const [pos, setPos] = useState<{ latitude: number; longitude: number } | null>(null);
  const [options, setOptions] = useState<RoadFreeOptions | null>(() => roadFreeStore.get());
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [otherMode, setOtherMode] = useState(false);
  const [laterIds, setLaterIds] = useState<string[]>([]);

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

  const inRoad = road.phase !== 'idle' && !!road.session;
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
  const toClose = options?.toClose && !laterIds.includes(options.toClose.sessionId) ? options.toClose : null;
  const toCloseSession = toClose ? recent.find((r) => r.id === toClose.sessionId) ?? null : null;

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
              <Marker coordinate={{ latitude: hq.lat, longitude: hq.lng }} anchor={{ x: 0.2, y: 0.5 }} tracksViewChanges={false}>
                <View style={s.hq}>
                  <View style={s.hqIc}>
                    <Ionicons name="home" size={13} color="#FFFFFF" />
                  </View>
                  <Text style={s.hqTx}>Sede</Text>
                </View>
              </Marker>
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
              <Text style={s.name}>{lessonStudentName(road.session?.lesson)}</Text>
              <RoadPressable kind="cta" onPress={() => router.push(ROAD_ROUTE)} style={s.cta}>
                <Text style={s.ctaTx}>Torna in Road</Text>
              </RoadPressable>
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
                <BriefingLines lines={briefingOf(current.student?.id)!.lines} style={{ marginTop: 14 }} />
              ) : (
                <Text style={[s.sub, { marginTop: 6 }]}>Prima guida in Road con questo allievo.</Text>
              )}
              <RoadPressable
                kind="cta"
                onPress={() => void beginRoadEntry(router, current)}
                style={s.cta}
                testID="road-tab-enter"
              >
                <Ionicons name="play" size={17} color="#FFFFFF" />
                <Text style={s.ctaTx}>Entra in Road</Text>
              </RoadPressable>
              <RoadPressable kind="small" onPress={() => setOtherMode(true)} hitSlop={8} style={s.secondary}>
                <Text style={s.secondaryTx}>Parti con un altro allievo</Text>
              </RoadPressable>
            </Animated.View>
          ) : (
            <Animated.View key="free" entering={roadEnter()} exiting={ROAD_EXIT} layout={ROAD_LAYOUT}>
              {toClose && toCloseSession ? (
                // ── Guida appena finita, pagellino da compilare ──────────
                <Animated.View
                  key={`close-${toClose.sessionId}`}
                  entering={roadEnter()}
                  exiting={ROAD_CARD_EXIT}
                  layout={ROAD_LAYOUT}
                  style={s.closeBlock}
                  testID="road-tab-toclose"
                >
                  <Text style={s.kicker}>
                    Appena finita · {formatRange(toCloseSession.lesson.startsAt, toCloseSession.endedAt ?? toCloseSession.lesson.endsAt)}
                  </Text>
                  <Text style={s.name}>{lessonStudentName(toCloseSession.lesson)}</Text>
                  <SessionNumbers session={toCloseSession} style={{ marginTop: 3 }} />
                  <RoadPressable
                    kind="cta"
                    onPress={() =>
                      openRoadPagellino(
                        router,
                        toCloseSession.lesson,
                        { showStayChip: false, onSaved: () => void load() },
                        '/(tabs)/drive/pagellino',
                      )
                    }
                    style={s.cta}
                    testID="road-tab-pagellino"
                  >
                    <Ionicons name="star" size={16} color="#FACC15" />
                    <Text style={s.ctaTx}>Compila il pagellino</Text>
                  </RoadPressable>
                  <RoadPressable
                    kind="small"
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => undefined);
                      setLaterIds((l) => [...l, toClose.sessionId]);
                    }}
                    hitSlop={8}
                    style={s.secondary}
                  >
                    <Text style={s.secondaryTx}>Più tardi</Text>
                  </RoadPressable>
                </Animated.View>
              ) : null}

              {/* ── Libero: con chi guidi? ─────────────────────────────── */}
              <Animated.View
                // Sale solo dopo che la card «appena finita» è sparita.
                layout={ROAD_LAYOUT_AFTER_EXIT}
                style={toClose && toCloseSession ? s.afterClose : null}
                testID="road-tab-free"
              >
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
                      <View style={s.allCircle}>
                        <Ionicons name="search" size={21} color="#111111" />
                      </View>
                      <Text style={s.faceName}>Tutti</Text>
                    </RoadPressable>
                  </Animated.View>
                </View>

                {selected ? (
                  <Animated.View style={s.brief} layout={ROAD_LAYOUT}>
                    {/* Il briefing cambia col volto: dissolvenza incrociata, l'altezza scivola. */}
                    <Animated.View key={selected.id} entering={ROAD_TEXT_IN} exiting={ROAD_TEXT_OUT} layout={ROAD_LAYOUT}>
                    <Text style={s.briefHead}>
                      {firstName(selected.name)} · {selected.reason}
                    </Text>
                    {briefingOf(selected.id)?.lines.length ? (
                      <>
                        <Text style={s.briefTitle}>
                          {briefingOf(selected.id)!.title}
                        </Text>
                        <BriefingLines lines={briefingOf(selected.id)!.lines} />
                      </>
                    ) : (
                      <Text style={s.briefTitle}>Nessuna segnalazione Road finora.</Text>
                    )}
                    </Animated.View>
                    <Animated.View layout={ROAD_LAYOUT}>
                      <RoadPressable
                        kind="cta"
                        onPress={() => openStart(selected.id)}
                        style={s.cta}
                        testID="road-tab-start"
                      >
                        <Ionicons name="play" size={17} color="#FFFFFF" />
                        <Animated.Text key={selected.id} entering={ROAD_TEXT_IN} style={s.ctaTx}>
                          Parti con {firstName(selected.name)} · {options?.defaultDuration ?? 60} min
                        </Animated.Text>
                      </RoadPressable>
                    </Animated.View>
                  </Animated.View>
                ) : (
                  <RoadPressable kind="cta" onPress={() => openStart(null)} style={s.cta} testID="road-tab-start">
                    <Text style={s.ctaTx}>Scegli l'allievo</Text>
                  </RoadPressable>
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
            {recent.map((r, i) => (
              <Animated.View key={r.id} entering={roadStagger(i + 2)} exiting={ROAD_EXIT} layout={ROAD_LAYOUT}>
              <RoadPressable
                kind="card"
                onPress={() => void openRoadPercorso(router, 'drive', r.appointmentId)}
                style={s.recentRow}
                testID="road-tab-recent"
              >
                <RouteThumb thumb={r.thumb} />
                <View style={[s.recentBody, i < recent.length - 1 && s.recentSep]}>
                  <Text style={s.recentName} numberOfLines={1}>{lessonStudentName(r.lesson)}</Text>
                  <SessionNumbers session={r} withDay />
                </View>
                <Ionicons name="chevron-forward" size={17} color="#C7C7CC" style={{ marginRight: 20 }} />
              </RoadPressable>
              </Animated.View>
            ))}
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

/** «Oggi 11:00 · 5,9 km · ✓ 3 ↑ 2» (glifi, niente pillole). */
function SessionNumbers({ session, withDay, style }: { session: RoadRecentSession; withDay?: boolean; style?: object }) {
  const head = withDay
    ? `${dayLabel(session.startedAt)} ${formatHm(session.lesson.startsAt)} · ${formatKm(session.distanceMeters)} km`
    : `${formatKm(session.distanceMeters)} km · ${formatMinutes(session.durationSec)} min`;
  return (
    <View style={[s.nums, style]}>
      <Text style={s.numsTx}>{head}</Text>
      {session.markerGood ? (
        <>
          <Text style={s.numsTx}> · </Text>
          <Ionicons name="checkmark" size={14} color={SENTIMENT_GOOD} />
          <Text style={s.numsTx}> {session.markerGood}</Text>
        </>
      ) : null}
      {session.markerBad ? (
        <>
          <Text style={s.numsTx}>{session.markerGood ? '   ' : ' · '}</Text>
          <Ionicons name="arrow-up" size={14} color={SENTIMENT_BAD} />
          <Text style={s.numsTx}> {session.markerBad}</Text>
        </>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },
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
  hq: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  hqIc: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  hqTx: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111111',
    textShadowColor: 'rgba(255,255,255,0.95)',
    textShadowRadius: 3,
    textShadowOffset: { width: 0, height: 0 },
  },
  panel: {
    marginTop: -26,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: '#FFFFFF',
    paddingTop: 26,
    paddingHorizontal: 22,
    paddingBottom: 8,
  },
  title: { fontSize: 26, fontWeight: '600', color: '#111111', letterSpacing: -0.7 },
  kicker: { fontSize: 14, fontWeight: '400', color: '#6A6A6A' },
  name: { fontSize: 26, fontWeight: '600', color: '#111111', letterSpacing: -0.7, marginTop: 3 },
  sub: { fontSize: 15, fontWeight: '400', color: '#6A6A6A', marginTop: 4, lineHeight: 20 },
  faces: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
  face: { alignItems: 'center', width: 72, gap: 7 },
  faceName: { fontSize: 14, fontWeight: '400', color: '#6A6A6A' },
  faceNameOn: { color: '#111111', fontWeight: '600' },
  allCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D1D1D6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brief: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(60,60,67,0.18)',
  },
  briefHead: { fontSize: 15, fontWeight: '500', color: '#111111', letterSpacing: -0.2 },
  briefTitle: { fontSize: 14, fontWeight: '400', color: '#6A6A6A', marginTop: 2, marginBottom: 10 },
  cta: {
    height: CTA_HEIGHT,
    borderRadius: CTA_RADIUS,
    backgroundColor: '#111111',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    marginTop: 20,
  },
  pressed: { opacity: 0.88 },
  ctaTx: { fontSize: 17, fontWeight: '600', color: '#FFFFFF', letterSpacing: -0.3 },
  secondary: { alignItems: 'center', paddingVertical: 14 },
  secondaryTx: { fontSize: 15.5, fontWeight: '500', color: '#3A3A3C' },
  closeBlock: { paddingBottom: 6 },
  afterClose: {
    marginTop: 8,
    paddingTop: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(60,60,67,0.18)',
  },
  nums: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  numsTx: { fontSize: 14, fontWeight: '400', color: '#6A6A6A', fontVariant: ['tabular-nums'] },
  recent: { marginTop: 18 },
  section: { fontSize: 15, fontWeight: '600', color: '#111111', letterSpacing: -0.2, paddingHorizontal: 22, marginBottom: 6 },
  recentRow: { flexDirection: 'row', alignItems: 'center', paddingLeft: 22, gap: 14 },
  recentBody: { flex: 1, paddingVertical: 14 },
  recentSep: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(60,60,67,0.18)' },
  recentName: { fontSize: 16.5, fontWeight: '500', color: '#111111', letterSpacing: -0.2 },
});
