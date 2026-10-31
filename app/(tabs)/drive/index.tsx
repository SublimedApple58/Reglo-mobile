import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { InteractionManager, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useNavigation, useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';

import { regloApi } from '../../../src/services/regloApi';
import type { RoadFreeOptions, RoadHotspot, RoadLesson, RoadRecentSession } from '../../../src/types/regloApi';
import { prefetchLessonPlan, prefetchPlan, setPlanOrigin } from '../../../src/road/planStore';
import { HeatHalo, HotspotPin, RoadCarMarker } from '../../../src/components/road/RoadMapParts';
import { RoadAvatar, RouteThumb, SessionNumbers } from '../../../src/components/road/RoadTabParts';
import { pagellinoPrompt } from '../../../src/road/pagellinoPrompt';
import { headquartersPrompt } from '../../../src/road/headquartersPrompt';
import { returnToRoad } from '../../../src/road/miniStore';
import { AVVIO_ALLIEVO_ROUTE, avvioStore } from '../../../src/road/avvioFlow';
import { prefetchRoadFaces, ROAD_FREE_SHEET_ROUTE, roadFreePreselect, roadFreeStore } from '../../../src/road/freeStartStore';
import { lessonStudentName, useRoadSelector } from '../../../src/road/roadStore';
import { dayLabel, formatHm, formatRange } from '../../../src/road/format';
import { openRoadPagellino } from '../../../src/road/pagellino';
import { openRoadPercorso } from '../../../src/road/openRoadPercorso';
import {
  DEFAULT_HOTSPOT_PERIOD,
  hotspotSheetStore,
  hotspotsStore,
  useHotspotsVersion,
  warmRoadHotspots,
} from '../../../src/road/hotspotsStore';
import { markerArt, ROAD_ASSETS } from '../../../src/road/markerArt';
import { InboxBellButton } from '../../../src/components/InboxBellButton';
import { CLAY, CLAY_SHADOW } from '../../../src/theme';
import { ClayButton, ClayIconButton, ClayList, ClayListRow, Icon3D, PlayGlyph } from '../../../src/components/clay';
import { Ionicons } from '@expo/vector-icons';
import { StretchyCover, StretchySpacer, stretchyPanel, useStretchyCover, COVER_OVERLAP } from '../../../src/components/clay/StretchyCover';
import { ClayNavBar, NAV_BAR_H } from '../../../src/components/ClayLargeTitle';
import { RoadPressable } from '../../../src/components/road/RoadPressable';
import { ROAD_FADE_IN, ROAD_FADE_OUT } from '../../../src/road/motion';
import { SkeletonBlock } from '../../../src/components/Skeleton';
import { useTabBarOverlap } from '../../../src/components/tabBarSpace';

/** Dopo quanto, a app ferma, si monta la schermata (mappa) in sottofondo. */
const ROAD_WARM_DELAY_MS = 1500;
const FALLBACK = { latitude: 45.0703, longitude: 7.6869 };
/** Punti critici sulla copertina: posti fissi (crash AIRMap se i figli cambiano). */
const COVER_HOTSPOTS = 5;
/** Righe dei punti critici nella home: i primi 3, poi «Vedi tutti». */
const HOME_HOTSPOTS = 3;
const HOTSPOT_SHEET_ROUTE = '/(tabs)/drive/punto-critico';
const HOTSPOTS_ROUTE = '/(tabs)/drive/punti-critici';

/** Stesse opzioni = niente ridisegno (la risposta arriva identica quasi sempre). */
const sameOptions = (a: RoadFreeOptions | null, b: RoadFreeOptions | null) =>
  a === b || (!!a && !!b && JSON.stringify(a) === JSON.stringify(b));

/** «Oggi 3 guide · la prossima alle 15:00»: lo stato del giorno in una riga. */
function dayLine(options: RoadFreeOptions | null, current: RoadLesson | null): string {
  if (!options) return ' ';
  const n = options.todayCount;
  const guide = n === 0 ? 'Nessuna guida in agenda oggi' : n === 1 ? 'Oggi 1 guida' : `Oggi ${n} guide`;
  if (current) return guide;
  const next = options.nextLesson?.startsAt ?? options.nextLessonAt;
  if (next) return `${guide} · la prossima alle ${formatHm(next)}`;
  return n === 0 ? guide : `${guide} · libero per il resto della giornata`;
}

/**
 * REG-661 (piano 005) — Home Road GENERICA: la Road dell'autoscuola.
 *
 * Copertina elastica in alto (mappa con sede, la tua posizione e gli aloni dei
 * punti critici dell'autoscuola) e sopra il foglio: «Road» con lo stato del
 * giorno, una sola CTA nera (Avvia guida / Entra in Road sulla guida di adesso
 * / Torna in Road), i primi punti critici e le tue ultime guide. Nessun
 * allievo selezionato: l'allievo si sceglie nel flusso di avvio.
 *
 * Fluidità (§15): sezioni in `memo`, copertina guidata da transform sul thread
 * UI, mappa montata una volta con posti fissi, dati scaldati prima del tocco.
 */
export default function RoadTab() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const barOverlap = useTabBarOverlap();
  const { height } = useWindowDimensions();
  const roadPhase = useRoadSelector((st) => st.phase);
  const roadSession = useRoadSelector((st) => st.session);
  // Montata in anticipo (tab `lazy: false`): finché non la si apre, la
  // schermata vera (mappa compresa) aspetta che l'app sia a riposo.
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
  useEffect(
    () =>
      roadFreeStore.subscribe(() => {
        const next = roadFreeStore.get();
        if (next) setOptionsRaw((prev) => prev ?? next);
      }),
    [],
  );
  // REG-694: errore = solo un flag. Il messaggio grezzo del server non va a
  // schermo: la riga dice cosa succede, «Riprova» e «Avvia guida» restano.
  const [error, setError] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const load = useCallback(async () => {
    try {
      const next = await regloApi.getRoadFreeOptions();
      if (!sameOptions(roadFreeStore.get(), next)) {
        roadFreeStore.set(next);
        prefetchRoadFaces(next);
      }
      setOptions(next);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setRetrying(false);
    }
  }, [setOptions]);
  const retry = useCallback(() => {
    Haptics.selectionAsync().catch(() => undefined);
    setRetrying(true);
    void load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      const task = InteractionManager.runAfterInteractions(() => {
        void load();
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
        setPlanOrigin({ lat: last.coords.latitude, lng: last.coords.longitude });
        setPos({ latitude: last.coords.latitude, longitude: last.coords.longitude });
      } catch {
        // la mappa resta sulla sede e sui punti critici
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const hq = options?.headquarters ?? null;
  const inRoad = roadPhase !== 'idle' && !!roadSession;
  const current = options?.currentLesson ?? null;

  // Giri pronti prima del tocco (fogli di avvio): guida di adesso e suggeriti.
  const defaultDuration = options?.defaultDuration ?? 60;
  const suggestedIds = (options?.suggestions ?? []).slice(0, 3).map((f) => f.id).join(',');
  useEffect(() => {
    if (!options || inRoad) return;
    const task = InteractionManager.runAfterInteractions(() => {
      if (current) prefetchLessonPlan(current);
      for (const id of suggestedIds ? suggestedIds.split(',') : []) prefetchPlan(id, defaultDuration);
    });
    return () => task.cancel();
  }, [options, inRoad, current, suggestedIds, defaultDuration]);

  const recent = options?.recentSessions ?? null;
  // Guida finita col pagellino da compilare: si apre da solo «Appena finita»,
  // una volta per avvio dell'app; poi resta la riga in «Le tue ultime guide».
  const toClose = options?.toClose ?? null;
  const toCloseId = toClose ? recent?.find((r) => r.id === toClose.sessionId)?.id ?? null : null;
  useFocusEffect(
    useCallback(() => {
      if (!toCloseId || inRoad || !pagellinoPrompt.shouldShow(toCloseId)) return;
      const t = setTimeout(() => {
        pagellinoPrompt.markShown(toCloseId);
        router.push('/(tabs)/drive/appena-finita');
      }, 450);
      return () => clearTimeout(t);
    }, [toCloseId, inRoad, router]),
  );

  // REG-658: sede senza indirizzo → avviso, una volta per avvio, mai sopra «Appena finita».
  const navigation = useNavigation();
  const hqMissing = options != null && options.headquarters === null;
  useFocusEffect(
    useCallback(() => {
      const pagellinoPending = !!toCloseId && pagellinoPrompt.shouldShow(toCloseId);
      if (!hqMissing || inRoad || pagellinoPending || !headquartersPrompt.shouldShow()) return;
      const t = setTimeout(() => {
        if (!navigation.isFocused() || pagellinoPrompt.shownRecently()) return;
        headquartersPrompt.markShown();
        router.push('/(tabs)/drive/sede-mancante');
      }, 600);
      return () => clearTimeout(t);
    }, [hqMissing, inRoad, toCloseId, router, navigation]),
  );

  const openStart = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    roadFreePreselect.set(null);
    router.push(ROAD_FREE_SHEET_ROUTE);
  }, [router]);

  // Punti critici dell'autoscuola (store scaldato): copertina e righe.
  useHotspotsVersion();
  const hotspotData = hotspotsStore.list(DEFAULT_HOTSPOT_PERIOD);
  const hotspots = hotspotData?.hotspots ?? null;

  // REG-666: la copertina si tocca (o «espandi») e apre la mappa dei punti critici.
  const openHotspotsMap = useCallback(() => {
    Haptics.selectionAsync().catch(() => undefined);
    router.push(HOTSPOTS_ROUTE as never);
  }, [router]);

  const coverBase = Math.round(height * 0.4);
  const stretch = useStretchyCover({ base: coverBase, viewportHeight: height, bottomInset: barOverlap });
  const bell = useMemo(() => <InboxBellButton />, []);

  if (!armed) return <View style={s.root} />;

  const panelKey = !options && !inRoad ? (error && !retrying ? 'err' : 'load') : inRoad ? 'inroad' : current ? 'agenda' : 'free';

  return (
    <View style={s.root}>
      <StretchyCover style={stretch.coverStyle} testID="road-cover">
        <RoadHomeMap topInset={insets.top} pos={pos} hq={hq} hotspots={hotspots} carColor={null} />
      </StretchyCover>

      <Animated.ScrollView
        style={StyleSheet.absoluteFill}
        onScroll={stretch.onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: barOverlap }}
        showsVerticalScrollIndicator={false}
        testID="road-tab"
      >
        <Pressable onPress={hotspots?.length ? openHotspotsMap : undefined} testID="road-cover-tap">
          <StretchySpacer style={stretch.spacerStyle} />
          {hotspots?.length ? (
            <ClayIconButton
              icon={<Ionicons name="expand-outline" size={18} color={CLAY.ink} />}
              onPress={openHotspotsMap}
              accessibilityLabel="Apri la mappa dei punti critici"
              style={s.expand}
              testID="road-cover-expand"
            />
          ) : null}
        </Pressable>
        <View style={[stretchyPanel, s.panel]} onLayout={stretch.onPanelLayout} testID="road-tab-panel">
          <Text style={s.title}>Road</Text>
          <Text style={s.sub} numberOfLines={1}>
            {inRoad ? 'Guida in corso' : panelKey === 'err' ? 'Guide di oggi non caricate' : dayLine(options, current)}
          </Text>

          {panelKey === 'load' ? (
            <Animated.View key="load" exiting={ROAD_FADE_OUT} testID="road-tab-skeleton">
              <SkeletonBlock height={54} radius={27} style={s.cta} />
            </Animated.View>
          ) : panelKey === 'err' ? (
            // Si parte lo stesso: il foglio «Avvia guida» carica da sé allievi e auto.
            <Animated.View key="err" entering={ROAD_FADE_IN} exiting={ROAD_FADE_OUT} testID="road-tab-error">
              <ClayButton title="Avvia guida" leading={<PlayGlyph />} onPress={openStart} style={s.cta} testID="road-tab-start" />
              <Pressable onPress={retry} hitSlop={10} style={s.secondary} accessibilityRole="button" testID="road-tab-retry">
                <Text style={s.secondaryTx}>Riprova</Text>
              </Pressable>
            </Animated.View>
          ) : panelKey === 'inroad' ? (
            <Animated.View key="inroad" entering={ROAD_FADE_IN} exiting={ROAD_FADE_OUT}>
              <ClayList style={s.lessonCard}>
                <ClayListRow
                  leading={<RoadAvatar userId={roadSession?.lesson.student?.id} name={lessonStudentName(roadSession?.lesson)} size={44} />}
                  title={lessonStudentName(roadSession?.lesson)}
                  subtitle="Guida in corso"
                />
              </ClayList>
              <ClayButton title="Torna in Road" onPress={returnToRoad} style={s.ctaGap} testID="road-tab-back" />
            </Animated.View>
          ) : panelKey === 'agenda' && current ? (
            <Animated.View key="agenda" entering={ROAD_FADE_IN} exiting={ROAD_FADE_OUT} testID="road-tab-agenda">
              <AgendaNow lesson={current} onOther={openStart} />
            </Animated.View>
          ) : (
            <Animated.View key="free" entering={ROAD_FADE_IN} exiting={ROAD_FADE_OUT} testID="road-tab-free">
              <ClayButton title="Avvia guida" leading={<PlayGlyph />} onPress={openStart} style={s.cta} testID="road-tab-start" />
            </Animated.View>
          )}

          {!inRoad && options ? <HotspotsSection hotspots={hotspots} loaded={!!hotspotData} /> : null}

          {recent?.length && !inRoad ? (
            <Animated.View entering={ROAD_FADE_IN} exiting={ROAD_FADE_OUT}>
              <RecentSection recent={recent} hq={hq} toCloseId={toCloseId} />
            </Animated.View>
          ) : null}
        </View>
      </Animated.ScrollView>

      {/* Barra a titolo grande: trasparente sulla copertina, bianca col titolo
          quando il foglio ci arriva sotto. La campanella resta sempre a portata. */}
      <ClayNavBar
        title="Road"
        scrollY={stretch.scrollY}
        overlay={stretch.coverHeight - COVER_OVERLAP - (insets.top + NAV_BAR_H) + 30}
        actions={bell}
      />
    </View>
  );
}

/** Guida in agenda adesso: chi, quando, «Entra in Road» e l'alternativa. */
const AgendaNow = React.memo(function AgendaNow({ lesson, onOther }: { lesson: RoadLesson; onOther: () => void }) {
  const router = useRouter();
  const vehicle = lesson.vehicle ? [lesson.vehicle.name, lesson.vehicle.plate].filter(Boolean).join(' · ') : null;
  return (
    <>
      <ClayList style={s.lessonCard}>
        <ClayListRow
          leading={<RoadAvatar userId={lesson.student?.id} name={lessonStudentName(lesson)} size={44} />}
          title={lessonStudentName(lesson)}
          subtitle={['In agenda adesso', formatRange(lesson.startsAt, lesson.endsAt), vehicle].filter(Boolean).join(' · ')}
        />
      </ClayList>
      <ClayButton
        title="Entra in Road"
        leading={<PlayGlyph />}
        onPress={() => {
          // REG-662: prima il foglio «<Nome> su Road» (briefing, giro), poi si entra.
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
          avvioStore.set({ studentId: lesson.student?.id ?? null, lesson });
          router.push(AVVIO_ALLIEVO_ROUTE as never);
        }}
        style={s.ctaGap}
        testID="road-tab-enter"
      />
      <RoadPressable kind="small" onPress={onOther} hitSlop={8} style={s.secondary}>
        <Text style={s.secondaryTx}>Avvia un&apos;altra guida</Text>
      </RoadPressable>
    </>
  );
});

/** I primi punti critici dell'autoscuola e «Vedi tutti». Nessun fetch al tocco. */
const HotspotsSection = React.memo(function HotspotsSection({
  hotspots,
  loaded,
}: {
  hotspots: RoadHotspot[] | null;
  loaded: boolean;
}) {
  const router = useRouter();
  const openAll = useCallback(() => {
    Haptics.selectionAsync().catch(() => undefined);
    router.push(HOTSPOTS_ROUTE as never);
  }, [router]);
  const openOne = useCallback(
    (h: RoadHotspot) => {
      Haptics.selectionAsync().catch(() => undefined);
      hotspotSheetStore.set({ key: h.key, period: DEFAULT_HOTSPOT_PERIOD });
      router.push(HOTSPOT_SHEET_ROUTE as never);
    },
    [router],
  );
  const top = hotspots?.slice(0, HOME_HOTSPOTS) ?? [];
  return (
    <View style={s.section} testID="road-tab-hotspots">
      <View style={s.sectionHead}>
        <Text style={s.sectionTitle}>Punti critici</Text>
        <RoadPressable kind="small" onPress={openAll} hitSlop={10} testID="road-tab-hotspots-all">
          <Text style={s.link}>Vedi tutti</Text>
        </RoadPressable>
      </View>
      <ClayList>
        {top.length ? (
          top.map((h, i) => (
            <ClayListRow
              key={h.key}
              leading={<Icon3D source={markerArt(h.kind)} size={40} />}
              title={h.label}
              subtitle={[h.street, h.examRoutes.length ? "sul percorso d'esame" : null].filter(Boolean).join(' · ') || `${h.students} allievi`}
              trailing={<Text style={s.count}>{h.errors}</Text>}
              onPress={() => openOne(h)}
              divider={i > 0}
              testID="road-tab-hotspot-row"
            />
          ))
        ) : (
          <ClayListRow
            leading={<Icon3D source={ROAD_ASSETS.road} size={40} />}
            title={loaded ? 'Ancora nessun punto critico' : 'Punti critici'}
            subtitle={loaded ? 'Compaiono dove gli allievi sbagliano più volte' : 'Dove gli allievi sbagliano più spesso'}
            onPress={openAll}
          />
        )}
      </ClayList>
    </View>
  );
});

/** Le tue ultime guide: generali, ogni riga dice con chi. */
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
    <View style={s.section}>
      <Text style={[s.sectionTitle, s.sectionTitleAlone]}>Le tue ultime guide</Text>
      <ClayList>
        {recent.map((r, i) => (
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
                : openRoadPercorso(router, 'drive', r.appointmentId, null, { startedAt: r.startedAt, endedAt: r.endedAt })
            }
            divider={i > 0}
            testID="road-tab-recent"
          />
        ))}
      </ClayList>
    </View>
  );
});

/** Distanza in km (equirettangolare: basta per dire «stessa zona»). */
/** Copertina: i punti entro questa distanza dal più segnalato (REG-666). */
const COVER_ZONE_KM = 4;
function kmBetween(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const x = (b.longitude - a.longitude) * Math.cos(((a.latitude + b.latitude) / 2) * (Math.PI / 180));
  const y = b.latitude - a.latitude;
  return Math.sqrt(x * x + y * y) * 111.32;
}

/** Regione che contiene i punti, con un minimo (un punto solo = la sua zona). */
function regionFor(pts: Array<{ latitude: number; longitude: number }>) {
  if (!pts.length) return null;
  const lats = pts.map((p) => p.latitude);
  const lngs = pts.map((p) => p.longitude);
  const [minLat, maxLat, minLng, maxLng] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
  return {
    latitude: (minLat + maxLat) / 2 - Math.max(maxLat - minLat, 0.006) * 0.12,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * 1.8, 0.012),
    longitudeDelta: Math.max((maxLng - minLng) * 1.8, 0.012),
  };
}

/**
 * Copertina: sede, la tua posizione e gli aloni dei punti critici
 * dell'autoscuola (senza punti: sede e posizione). Non interattiva. Gli
 * aloni e i simboli stanno in posti FISSI sempre montati (react-native-maps
 * 1.20 in New Architecture crasha se i figli della mappa cambiano numero).
 */
const RoadHomeMap = React.memo(function RoadHomeMap({
  topInset,
  pos,
  hq,
  hotspots,
  carColor,
}: {
  topInset: number;
  pos: { latitude: number; longitude: number } | null;
  hq: { lat: number; lng: number } | null;
  hotspots: RoadHotspot[] | null;
  carColor: string | null;
}) {
  const mapRef = useRef<MapView>(null);
  const [ready, setReady] = useState(false);
  const shown = useMemo(() => (hotspots ?? []).slice(0, COVER_HOTSPOTS), [hotspots]);
  const max = shown.reduce((m, h) => Math.max(m, h.errors), 0);
  const target = useMemo(() => {
    // REG-666 (QA 30/10: «copertina troppo lontana, pallini minuscoli»): si
    // inquadra la zona del punto più segnalato, cioè i punti entro 4 km da
    // lui; gli altri restano nella mappa grande. Senza punti: sede e posizione.
    const head = shown[0];
    const pts = head
      ? shown
          .map((h) => ({ latitude: h.lat, longitude: h.lng }))
          .filter((p) => kmBetween(p, { latitude: head.lat, longitude: head.lng }) <= COVER_ZONE_KM)
      : [];
    if (!pts.length && hq) pts.push({ latitude: hq.lat, longitude: hq.lng });
    if (!pts.length && pos) pts.push(pos);
    return regionFor(pts);
  }, [shown, hq, pos]);
  const [initialRegion] = useState(() => target ?? { ...FALLBACK, latitudeDelta: 0.04, longitudeDelta: 0.04 });
  const first = useRef(true);
  const targetKey = target ? `${target.latitude.toFixed(4)},${target.longitude.toFixed(4)},${target.latitudeDelta.toFixed(4)}` : '';
  useEffect(() => {
    if (!ready || !target) return;
    mapRef.current?.animateToRegion(target, first.current ? 0 : 260);
    first.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, targetKey]);
  const center = initialRegion;
  return (
    <MapView
      ref={mapRef}
      style={StyleSheet.absoluteFill}
      initialRegion={initialRegion}
      onMapReady={() => setReady(true)}
      // Logo «Maps» e «Legal» sopra il bordo arrotondato del foglio, mai sotto.
      mapPadding={{ top: topInset, right: 0, bottom: COVER_OVERLAP + 18, left: 10 }}
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
      {Array.from({ length: COVER_HOTSPOTS }, (_, i) => {
        const h = shown[i];
        return (
          <HeatHalo
            key={`h${i}`}
            lat={h?.lat ?? center.latitude}
            lng={h?.lng ?? center.longitude}
            k={h && max ? h.errors / max : 0}
            hidden={!h}
          />
        );
      })}
      {Array.from({ length: COVER_HOTSPOTS }, (_, i) => {
        const h = shown[i];
        return (
          <HotspotPin
            key={`p${i}`}
            coordinate={{ latitude: h?.lat ?? center.latitude, longitude: h?.lng ?? center.longitude }}
            kind={h?.kind ?? 'altro'}
            name={h?.label ?? ''}
            errors={h?.errors ?? 0}
            size={46}
            hidden={!h}
          />
        );
      })}
      {pos ? <RoadCarMarker coordinate={pos} rotation={0} color={carColor} /> : null}
      {hq ? <HqMarker lat={hq.lat} lng={hq.lng} /> : null}
    </MapView>
  );
});

/** Sede: punto nero in un cerchio bianco in rilievo + «Sede». */
const HqMarker = React.memo(function HqMarker({ lat, lng }: { lat: number; lng: number }) {
  const [ready, setReady] = useState(false);
  const coordinate = useMemo(() => ({ latitude: lat, longitude: lng }), [lat, lng]);
  return (
    <Marker coordinate={coordinate} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={!ready} zIndex={3}>
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
  panel: { paddingTop: 26, paddingHorizontal: 20, paddingBottom: 28 },
  title: { fontSize: 32, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.9 },
  sub: { fontSize: 15, lineHeight: 21, color: CLAY.ink3, marginTop: 2 },
  cta: { marginTop: 20 },
  ctaGap: { marginTop: 14 },
  lessonCard: { marginTop: 20 },
  secondary: { alignItems: 'center', paddingTop: 16, paddingBottom: 4 },
  secondaryTx: { fontSize: 15.5, fontWeight: '500', color: CLAY.ink, textDecorationLine: 'underline' },
  section: { marginTop: 30 },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12, paddingHorizontal: 2 },
  sectionTitle: { fontSize: 22, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.5 },
  sectionTitleAlone: { marginBottom: 12, paddingHorizontal: 2 },
  link: { fontSize: 15, fontWeight: '500', color: CLAY.ink, textDecorationLine: 'underline' },
  count: { fontSize: 16, fontWeight: '600', color: CLAY.ink, fontVariant: ['tabular-nums'] },
  // «Espandi» sulla copertina, in basso a destra sopra il bordo del foglio.
  expand: { position: 'absolute', right: 16, bottom: 14 },
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
