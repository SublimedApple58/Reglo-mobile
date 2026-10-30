import React, { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, InteractionManager, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import MapView, { Polyline, type Region } from 'react-native-maps';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import type { RoadHotspot } from '../types/regloApi';
import { ClayIconButton, ClaySegmented, Icon3D } from '../components/clay';
import { HeatHalo, HotspotPin } from '../components/road/RoadMapParts';
import { SkeletonBlock } from '../components/Skeleton';
import { markerArt } from '../road/markerArt';
import { ROAD_FADE_IN } from '../road/motion';
import {
  DEFAULT_HOTSPOT_PERIOD,
  HOTSPOT_PERIODS,
  hotspotMapStore,
  hotspotSheetStore,
  hotspotsStore,
  loadExamRoutes,
  loadHotspots,
  prefetchHotspotDetails,
  useHotspotsVersion,
  type HotspotPeriod,
} from '../road/hotspotsStore';
import { CLAY } from '../theme';

const SHEET_ROUTE = '/(tabs)/drive/punto-critico';
/** Posti fissi sulla mappa (react-native-maps crasha se i figli cambiano numero). */
const MAP_SLOTS = 12;
const ROW_H = 72;
/** Area toccabile di un segnaposto (il disco è 44). */
const HIT = 52;
const H_PAD = 20;
const FALLBACK: Region = { latitude: 45.0703, longitude: 7.6869, latitudeDelta: 0.06, longitudeDelta: 0.06 };
const SNAP = { duration: 260, easing: Easing.out(Easing.cubic) };

const shortStreet = (s: string | null) => (s ?? '').replace(/^Strada Statale (\d+).*$/i, 'SS$1');

/**
 * REG-666 Reglo Road — «Punti critici» a tutto schermo, stile Apple Maps:
 * mappa navigabile con tutti i punti e, sotto, il foglio con la lista
 * collegata (due altezze: a metà e alta; si cambia trascinando l'intestazione).
 * Punto ↔ riga: il punto scelto ha l'anello nero e l'etichetta, la riga è
 * evidenziata. Tocco sul punto = lo sceglie (di nuovo = dettaglio); tocco sulla
 * riga = la mappa ci va e si apre il dettaglio.
 * Fluidità (§15): una sola MapView, segnaposto in posti fissi, righe memo ad
 * altezza fissa, periodi e dettagli già scaldati dallo store.
 */
export default function RoadHotspotsMapScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  useHotspotsVersion();

  const [period, setPeriod] = useState<HotspotPeriod>(DEFAULT_HOTSPOT_PERIOD);
  const [shown, setShown] = useState<HotspotPeriod>(DEFAULT_HOTSPOT_PERIOD);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const shownRef = useRef(shown);
  shownRef.current = shown;

  const data = hotspotsStore.list(shown);
  const routes = hotspotsStore.routes();
  const hotspots = data?.hotspots ?? null;

  useFocusEffect(
    useCallback(() => {
      const task = InteractionManager.runAfterInteractions(() => {
        void loadExamRoutes();
        void loadHotspots(shown)
          .then(() => {
            setError(null);
            void prefetchHotspotDetails(shown);
          })
          .catch((err: unknown) => {
            if (!hotspotsStore.list(shown)) {
              setError(err instanceof Error && err.message ? err.message : 'Punti critici non disponibili. Riprova tra poco.');
            }
          });
        HOTSPOT_PERIODS.forEach((p) => {
          if (p.value !== shown) void loadHotspots(p.value).catch(() => undefined);
        });
      });
      return () => task.cancel();
    }, [shown]),
  );

  // ── foglio: due altezze ──
  const sheetMid = Math.round(height * 0.46);
  const sheetHigh = Math.round(height - insets.top - 64);
  const sheetH = useSharedValue(sheetMid);
  const [sheetVisible, setSheetVisible] = useState(sheetMid);
  const startH = useSharedValue(sheetMid);
  const snapTo = useCallback(
    (h: number) => {
      sheetH.value = withTiming(h, SNAP);
      setSheetVisible(h);
    },
    [sheetH],
  );
  const pan = useMemo(
    () =>
      Gesture.Pan()
        .onStart(() => {
          startH.value = sheetH.value;
        })
        .onUpdate((e) => {
          sheetH.value = Math.min(sheetHigh, Math.max(sheetMid - 40, startH.value - e.translationY));
        })
        .onEnd((e) => {
          const goHigh = e.velocityY < -400 || (e.velocityY < 400 && sheetH.value > (sheetMid + sheetHigh) / 2);
          runOnJS(snapTo)(goHigh ? sheetHigh : sheetMid);
        }),
    [sheetH, startH, sheetMid, sheetHigh, snapTo],
  );
  const sheetStyle = useAnimatedStyle(() => ({ height: sheetH.value }));

  // ── mappa ──
  const mapRef = useRef<MapView>(null);
  const regionRef = useRef<Region>(FALLBACK);
  const [ready, setReady] = useState(false);
  const fitAll = useCallback(
    (animated: boolean) => {
      const pts = (hotspots ?? []).slice(0, MAP_SLOTS).map((h) => ({ latitude: h.lat, longitude: h.lng }));
      if (!pts.length) return;
      mapRef.current?.fitToCoordinates(pts, {
        // Il foglio è già fuori dall'area utile (`mapPadding`): qui solo il respiro dei segnaposti.
        edgePadding: { top: 70, right: 56, bottom: 40, left: 56 },
        animated,
      });
    },
    [hotspots, insets.top, sheetMid],
  );
  /** Porta il punto al centro della parte di mappa libera sopra il foglio, stesso zoom. */
  const centerOn = useCallback(
    (h: RoadHotspot) => {
      const r = regionRef.current;
      const lift = (sheetVisible / height / 2) * r.latitudeDelta;
      mapRef.current?.animateToRegion(
        { latitude: h.lat - lift + (insets.top / height / 2) * r.latitudeDelta, longitude: h.lng, latitudeDelta: r.latitudeDelta, longitudeDelta: r.longitudeDelta },
        260,
      );
    },
    [sheetVisible, height, insets.top],
  );

  // Primo inquadro: tutti i punti, o quello chiesto da chi ha aperto la mappa.
  const framed = useRef(false);
  useEffect(() => {
    if (!ready || !hotspots?.length || framed.current) return;
    framed.current = true;
    fitAll(false);
    const want = hotspotMapStore.take();
    const h = want ? hotspots.find((x) => x.key === want) : null;
    if (h) {
      setSelected(h.key);
      setTimeout(() => centerOn(h), 50);
    }
  }, [ready, hotspots, fitAll, centerOn]);
  // Cambio periodo: la camera scivola sui punti nuovi.
  const lastShown = useRef(shown);
  useEffect(() => {
    if (!ready || lastShown.current === shown || !hotspots) return;
    lastShown.current = shown;
    setSelected(null);
    fitAll(true);
  }, [ready, shown, hotspots, fitAll]);

  // ── lista ──
  const listRef = useRef<FlatList<RoadHotspot>>(null);
  const select = useCallback(
    (h: RoadHotspot, scroll: boolean) => {
      setSelected(h.key);
      const i = hotspots?.findIndex((x) => x.key === h.key) ?? -1;
      if (scroll && i >= 0) listRef.current?.scrollToIndex({ index: i, viewPosition: 0.2, animated: true });
    },
    [hotspots],
  );
  const openDetail = useCallback(
    (h: RoadHotspot) => {
      hotspotSheetStore.set({ key: h.key, period: shown });
      router.push(SHEET_ROUTE as never);
    },
    [router, shown],
  );
  const onPin = useCallback(
    (h: RoadHotspot) => {
      Haptics.selectionAsync().catch(() => undefined);
      if (selected === h.key) return openDetail(h);
      select(h, true);
    },
    [selected, select, openDetail],
  );
  // Tocchi sui punti: aree React trasparenti sopra i segnaposto, rimesse al
  // loro posto a ogni fine movimento della mappa. I tocchi sui `Marker` di
  // react-native-maps (iOS, New Architecture) non arrivavano in modo affidabile;
  // così il tocco non dipende dalla mappa e funziona anche sul punto già scelto.
  const [hits, setHits] = useState<Array<{ h: RoadHotspot; x: number; y: number }>>([]);
  const placeHits = useCallback(async () => {
    const list = (hotspotsStore.list(shownRef.current)?.hotspots ?? []).slice(0, MAP_SLOTS);
    const pts = await Promise.all(
      list.map((h) => mapRef.current?.pointForCoordinate({ latitude: h.lat, longitude: h.lng }).catch(() => null) ?? null),
    );
    // Il primo della lista (più errori) sta sopra: va per ultimo.
    setHits(
      list
        .map((h, i) => (pts[i] ? { h, x: pts[i]!.x, y: pts[i]!.y } : null))
        .filter((v): v is { h: RoadHotspot; x: number; y: number } => !!v)
        .reverse(),
    );
  }, []);
  const onRow = useCallback(
    (h: RoadHotspot) => {
      Haptics.selectionAsync().catch(() => undefined);
      setSelected(h.key);
      centerOn(h);
      openDetail(h);
    },
    [centerOn, openDetail],
  );

  // Il dettaglio aperto sopra chiede di tornare su un punto (miniatura del foglio).
  useEffect(
    () =>
      hotspotMapStore.subscribe((key) => {
        hotspotMapStore.take();
        const h = hotspotsStore.list(shown)?.hotspots.find((x) => x.key === key);
        if (!h) return;
        select(h, true);
        centerOn(h);
      }),
    [shown, select, centerOn],
  );

  const changePeriod = useCallback((p: HotspotPeriod) => {
    setPeriod(p);
    startTransition(() => setShown(p));
  }, []);

  const max = hotspots?.reduce((m, h) => Math.max(m, h.errors), 0) ?? 0;
  const routeLines = useMemo(
    () => (routes ?? []).map((r) => ({ id: r.id, coords: r.path.map(([latitude, longitude]) => ({ latitude, longitude })) })),
    [routes],
  );
  const center = regionRef.current;

  const periodLong = HOTSPOT_PERIODS.find((p) => p.value === shown)?.long ?? '';
  const title = hotspots
    ? hotspots.length
      ? `${hotspots.length === 1 ? '1 punto critico' : `${hotspots.length} punti critici`}`
      : 'Nessun punto critico'
    : 'Punti critici';

  const renderItem = useCallback(
    ({ item, index }: { item: RoadHotspot; index: number }) => (
      <HotspotMapRow hotspot={item} first={index === 0} selected={item.key === selected} onPress={onRow} />
    ),
    [selected, onRow],
  );

  return (
    <View style={s.root}>
      <StatusBar style="dark" />
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={FALLBACK}
        onMapReady={() => setReady(true)}
        // Un solo gestore per i tocchi sui punti: arriva da qualunque segnaposto
        // (disco o alone, che è più grande e spesso prende il tocco) con le sue
        // coordinate, e scatta anche sul punto già scelto (secondo tocco = dettaglio).
        onRegionChangeComplete={(r) => {
          regionRef.current = r;
          void placeHits();
        }}
        mapPadding={{ top: insets.top, right: 0, bottom: sheetVisible - 24, left: 10 }}
        mapType={Platform.OS === 'ios' ? 'mutedStandard' : 'standard'}
        showsPointsOfInterest={false}
        showsCompass={false}
        showsScale={false}
        showsTraffic={false}
        showsUserLocation={false}
        toolbarEnabled={false}
        pitchEnabled={false}
        rotateEnabled={false}
        userInterfaceStyle="light"
        testID="hotspots-fullmap"
      >
        {routeLines.map((r) => (
          <Polyline
            key={r.id}
            coordinates={r.coords}
            strokeColor="rgba(17,17,17,0.5)"
            strokeWidth={3}
            lineDashPattern={[6, 6]}
            lineCap="round"
            zIndex={1}
          />
        ))}
        {Array.from({ length: MAP_SLOTS }, (_, i) => {
          const h = hotspots?.[i];
          return (
            <HeatHalo
              key={`c${i}`}
              lat={h?.lat ?? center.latitude}
              lng={h?.lng ?? center.longitude}
              k={h && max ? h.errors / max : 0}
              hidden={!h}
            />
          );
        })}
        {Array.from({ length: MAP_SLOTS }, (_, i) => (
          <PinSlot key={`p${i}`} hotspot={hotspots?.[i] ?? null} fallback={center} selected={!!hotspots?.[i] && hotspots[i].key === selected} />
        ))}
      </MapView>

      <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
        {hits.map(({ h, x, y }) => (
          <Pressable
            key={h.key}
            onPress={() => onPin(h)}
            style={[s.hit, { left: x - HIT / 2, top: y - HIT / 2 }]}
            accessibilityRole="button"
            accessibilityLabel={`${h.label}, ${h.errors} errori`}
            testID={`hotspot-pin-${h.key}`}
          />
        ))}
      </View>

      <View style={[s.topRight, { top: insets.top + 8 }]}>
        <ClayIconButton icon="close" onPress={() => router.back()} accessibilityLabel="Chiudi" testID="hotspots-map-close" />
        <ClayIconButton
          icon={<Ionicons name="scan-outline" size={19} color={CLAY.ink} />}
          onPress={() => {
            setSelected(null);
            fitAll(true);
          }}
          accessibilityLabel="Mostra tutti i punti"
          style={s.btnGap}
          testID="hotspots-map-fit"
        />
      </View>

      <Animated.View style={[s.sheet, sheetStyle]} testID="hotspots-map-sheet">
        <GestureDetector gesture={pan}>
          <View style={s.sheetHead}>
            <Text style={s.title}>{title}</Text>
            <Text style={s.sub}>{`${periodLong.charAt(0).toUpperCase()}${periodLong.slice(1)} · di tutta l'autoscuola`}</Text>
            <ClaySegmented
              options={HOTSPOT_PERIODS.map((p) => ({ value: p.value, label: p.label, testID: `hotspots-period-${p.value}` }))}
              value={period}
              onChange={changePeriod}
              style={s.segmented}
              testID="hotspots-period"
            />
          </View>
        </GestureDetector>
        {error && !hotspots ? (
          <Text style={s.muted}>{error}</Text>
        ) : !hotspots ? (
          <View style={s.skWrap} testID="hotspots-skeleton">
            {[0, 1, 2].map((i) => (
              <View key={i} style={s.skRow}>
                <SkeletonBlock width={46} height={46} radius={14} />
                <View style={{ flex: 1, gap: 7 }}>
                  <SkeletonBlock width="46%" height={15} radius={6} />
                  <SkeletonBlock width="30%" height={12} radius={6} />
                </View>
              </View>
            ))}
          </View>
        ) : hotspots.length === 0 ? (
          <Animated.Text entering={ROAD_FADE_IN} style={s.muted}>
            {data?.totalErrors
              ? `${data.totalErrors === 1 ? '1 segnalazione' : `${data.totalErrors} segnalazioni`} «da migliorare», ma ancora sparse: un punto compare dove 2 allievi sbagliano nello stesso posto.`
              : 'Quando in guida segni «da migliorare», gli errori che si ripetono nello stesso posto compaiono qui.'}
          </Animated.Text>
        ) : (
          <FlatList
            ref={listRef}
            data={hotspots}
            keyExtractor={keyOf}
            renderItem={renderItem}
            extraData={selected}
            getItemLayout={itemLayout}
            onScrollToIndexFailed={() => undefined}
            contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
            showsVerticalScrollIndicator={false}
            initialNumToRender={10}
            windowSize={7}
            ListFooterComponent={
              <Text style={s.footnote}>
                Un punto compare dove almeno 2 allievi sbagliano 3 volte. Nel dettaglio vedi le tue guide.
                {routes?.length ? ` La linea tratteggiata è ${routes.length === 1 ? `il percorso d'esame «${routes[0].name}»` : `uno dei ${routes.length} percorsi d'esame`}.` : ''}
              </Text>
            }
            testID="hotspots-map-list"
          />
        )}
      </Animated.View>
    </View>
  );
}

const keyOf = (h: RoadHotspot) => h.key;
const itemLayout = (_: unknown, index: number) => ({ length: ROW_H, offset: ROW_H * index, index });

const PinSlot = React.memo(function PinSlot({
  hotspot,
  fallback,
  selected,
}: {
  hotspot: RoadHotspot | null;
  fallback: { latitude: number; longitude: number };
  selected: boolean;
}) {
  const lat = hotspot?.lat ?? fallback.latitude;
  const lng = hotspot?.lng ?? fallback.longitude;
  const coordinate = useMemo(() => ({ latitude: lat, longitude: lng }), [lat, lng]);
  return (
    <HotspotPin
      coordinate={coordinate}
      kind={hotspot?.kind ?? 'altro'}
      name={hotspot?.label ?? ''}
      errors={hotspot?.errors ?? 0}
      selected={selected}
      hidden={!hotspot}
    />
  );
});

/** Riga ad altezza fissa (lo scroll al punto scelto la trova senza misurare). */
const HotspotMapRow = React.memo(function HotspotMapRow({
  hotspot,
  first,
  selected,
  onPress,
}: {
  hotspot: RoadHotspot;
  first: boolean;
  selected: boolean;
  onPress: (h: RoadHotspot) => void;
}) {
  const where = [shortStreet(hotspot.street), hotspot.examRoutes.length ? "sul percorso d'esame" : null].filter(Boolean).join(' · ');
  return (
    <Pressable
      onPress={() => onPress(hotspot)}
      style={({ pressed }) => [s.row, selected && s.rowSel, pressed && s.rowPressed]}
      testID="hotspot-map-row"
    >
      {!first && !selected ? <View style={s.rowLine} /> : null}
      <View style={s.ico}>
        <Icon3D source={markerArt(hotspot.kind)} size={34} />
      </View>
      <View style={s.rowText}>
        <Text style={s.rowTitle} numberOfLines={1}>{hotspot.label}</Text>
        <Text style={s.rowSub} numberOfLines={1}>{where || `${hotspot.students} allievi`}</Text>
      </View>
      <Text style={s.rowNum}>{hotspot.errors}</Text>
      <Ionicons name="chevron-forward" size={17} color="#B9B9B9" />
    </Pressable>
  );
});

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F2F1EE' },
  topRight: { position: 'absolute', right: 16, alignItems: 'center' },
  hit: { position: 'absolute', width: HIT, height: HIT, borderRadius: HIT / 2 },
  btnGap: { marginTop: 12 },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    boxShadow: [{ offsetX: 0, offsetY: -10, blurRadius: 28, spreadDistance: -14, color: 'rgba(17,17,17,0.22)' }],
    overflow: 'hidden',
  },
  sheetHead: { paddingTop: 22, paddingHorizontal: H_PAD + 4, paddingBottom: 10, backgroundColor: '#FFFFFF' },
  title: { fontSize: 22, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.5 },
  sub: { fontSize: 14, color: CLAY.ink3, marginTop: 2 },
  segmented: { marginTop: 14 },
  muted: { fontSize: 15, lineHeight: 21, color: CLAY.ink3, paddingHorizontal: H_PAD + 4, marginTop: 8 },
  skWrap: { paddingHorizontal: H_PAD, paddingTop: 6 },
  skRow: { flexDirection: 'row', alignItems: 'center', gap: 14, height: ROW_H },
  row: { height: ROW_H, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: H_PAD + 4, paddingRight: H_PAD },
  rowSel: { backgroundColor: '#F4F4F2' },
  rowPressed: { backgroundColor: '#F7F7F5' },
  rowLine: { position: 'absolute', top: 0, left: H_PAD + 4 + 46 + 14, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(17,17,17,0.10)' },
  ico: { width: 46, height: 46, borderRadius: 14, backgroundColor: '#F5F5F3', alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 16.5, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.2 },
  rowSub: { fontSize: 14, color: CLAY.ink3, marginTop: 2 },
  rowNum: { fontSize: 17, fontWeight: '600', color: CLAY.ink, fontVariant: ['tabular-nums'] },
  footnote: { fontSize: 13, lineHeight: 18, color: CLAY.ink3, paddingHorizontal: H_PAD + 4, marginTop: 14 },
});
