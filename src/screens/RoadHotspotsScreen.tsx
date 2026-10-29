import React, { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { InteractionManager, Platform, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import Animated from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import type { RoadExamRoute, RoadHotspot } from '../types/regloApi';
import { ClayEmpty, ClayListRow, ClaySegmented, ClaySurface, Icon3D } from '../components/clay';
import { ClayLargeTitle, ClayNavBar, NAV_BAR_H, useLargeTitleScroll } from '../components/ClayLargeTitle';
import { RoadMarkerPin } from '../components/road/RoadMapParts';
import { SkeletonBlock } from '../components/Skeleton';
import { markerArt } from '../road/markerArt';
import { ROAD_FADE_IN, ROAD_FADE_OUT } from '../road/motion';
import {
  DEFAULT_HOTSPOT_PERIOD,
  HOTSPOT_PERIODS,
  hotspotSheetStore,
  hotspotsStore,
  loadExamRoutes,
  loadHotspots,
  prefetchHotspotDetails,
  useHotspotsVersion,
  type HotspotPeriod,
} from '../road/hotspotsStore';
import { CLAY } from '../theme';
import { MORALE_ART } from '../theme/moraleArt';
import { CLAY_RADIUS } from '../theme/spacing';

const H_PAD = 20;
/** Respiro sopra la prima riga e sotto l'ultima, come `ClayList`. */
const LIST_INSET = 4;
const SHEET_ROUTE = '/(tabs)/drive/punto-critico';
const FALLBACK = { latitude: 45.0703, longitude: 7.6869 };

const studentsLabel = (n: number) => (n === 1 ? '1 allievo' : `${n} allievi`);

/**
 * REG-646 Reglo Road — «Punti critici» nell'app istruttore: dove gli allievi
 * dell'autoscuola sbagliano più spesso (mappa aggregata dell'autoscuola,
 * soglia del server: 3 errori di almeno 2 allievi).
 *
 * Fluidità (§15): la mappa si monta una volta sola nell'intestazione e non è
 * interattiva (gli aloni seguono il periodo), la lista è una `FlatList` con
 * righe in `memo` sopra un'unica superficie clay, i tre periodi e i dettagli
 * dei primi punti arrivano in anticipo (`hotspotsStore`): al tocco di un
 * periodo o di un punto non parte nessuna chiamata che lo faccia aspettare.
 */
export default function RoadHotspotsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { scrollY, onScroll } = useLargeTitleScroll();
  useHotspotsVersion();

  const [period, setPeriod] = useState<HotspotPeriod>(DEFAULT_HOTSPOT_PERIOD);
  const [shown, setShown] = useState<HotspotPeriod>(DEFAULT_HOTSPOT_PERIOD);
  const [error, setError] = useState<string | null>(null);

  const data = hotspotsStore.list(shown);
  const routes = hotspotsStore.routes();

  // Il periodo mostrato e i due di riserva: tutti pronti prima del tocco.
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

  // Il cursore del segmentato parte subito; la lista cambia come aggiornamento non urgente.
  const changePeriod = useCallback((p: HotspotPeriod) => {
    setPeriod(p);
    startTransition(() => setShown(p));
  }, []);

  const open = useCallback(
    (h: RoadHotspot) => {
      Haptics.selectionAsync().catch(() => undefined);
      hotspotSheetStore.set({ key: h.key, period: shown });
      router.push(SHEET_ROUTE as never);
    },
    [router, shown],
  );

  const hotspots = data?.hotspots ?? null;
  const loading = !hotspots && !error;
  const mapH = Math.round(height * 0.38);

  const [rowBase, setRowBase] = useState(0);
  // La riga più alta (le icone arrivano dopo il primo layout): la superficie non resta mai più corta.
  const onRowBase = useCallback((h: number) => setRowBase((prev) => Math.max(prev, Math.round(h))), []);
  const backdropH = hotspots?.length && rowBase ? hotspots.length * rowBase + LIST_INSET * 2 : 0;

  const renderItem = useCallback(
    ({ item, index }: { item: RoadHotspot; index: number }) => (
      <HotspotRow
        hotspot={item}
        first={index === 0}
        last={index === (hotspots?.length ?? 0) - 1}
        onOpen={open}
        onBase={onRowBase}
      />
    ),
    [hotspots?.length, open, onRowBase],
  );

  const periodLong = HOTSPOT_PERIODS.find((p) => p.value === shown)?.long ?? '';
  const lead = hotspots
    ? hotspots.length
      ? `${hotspots.length === 1 ? '1 punto' : `${hotspots.length} punti`} ${periodLong}`
      : `Nessun punto ${periodLong}`
    : 'Dove gli allievi sbagliano più spesso';

  const header = (
    <View>
      <HotspotsMap height={mapH} topInset={insets.top} hotspots={hotspots} routes={routes} onOpen={open} />
      <View style={s.panel}>
        <ClayLargeTitle title="Punti critici" subtitle={lead} />
        <Text style={s.note}>
          Gli incroci dove almeno 2 allievi hanno sbagliato 3 volte o più. Vale per tutta l&apos;autoscuola; nel
          dettaglio vedi solo le tue guide.
        </Text>
        <ClaySegmented
          options={HOTSPOT_PERIODS.map((p) => ({ value: p.value, label: p.label, testID: `hotspots-period-${p.value}` }))}
          value={period}
          onChange={changePeriod}
          style={s.segmented}
          testID="hotspots-period"
        />
      </View>
      <View style={s.body}>
        {/* Spazio vero e non padding: la superficie sotto parte da `top: '100%'` del contenuto. */}
        <View style={s.gap} />
        {error && !hotspots ? (
          <Animated.Text entering={ROAD_FADE_IN} style={s.error}>
            {error}
          </Animated.Text>
        ) : loading ? (
          <Animated.View exiting={ROAD_FADE_OUT} testID="hotspots-skeleton">
            <ClaySurface padded={false} style={s.skList}>
              {[0, 1, 2, 3].map((i) => (
                <View key={i} style={s.skRow}>
                  <SkeletonBlock width={44} height={44} radius={14} />
                  <View style={{ flex: 1, gap: 7 }}>
                    <SkeletonBlock width="46%" height={15} radius={6} />
                    <SkeletonBlock width="70%" height={12} radius={6} />
                  </View>
                </View>
              ))}
            </ClaySurface>
          </Animated.View>
        ) : hotspots && hotspots.length === 0 ? (
          <Animated.View entering={ROAD_FADE_IN}>
            <ClayEmpty
              icon={MORALE_ART.piantina}
              title="Ancora nessun punto critico"
              text={
                data?.totalErrors
                  ? `${data.totalErrors === 1 ? '1 segnalazione' : `${data.totalErrors} segnalazioni`} «da migliorare» ${periodLong}, ma ancora sparse: un punto compare quando 2 allievi sbagliano nello stesso posto.`
                  : 'Quando in guida segni «da migliorare», gli errori che si ripetono nello stesso posto compaiono qui.'
              }
              testID="hotspots-empty"
            />
          </Animated.View>
        ) : null}
        {backdropH ? (
          <View pointerEvents="none" style={[s.backdrop, { height: backdropH }]}>
            <ClaySurface padded={false} style={s.backdropFill} />
          </View>
        ) : null}
      </View>
    </View>
  );

  const footer =
    hotspots?.length && routes?.length ? (
      <Text style={s.footnote}>
        La linea tratteggiata sulla mappa {routes.length === 1 ? `è il percorso d'esame «${routes[0].name}»` : `sono i ${routes.length} percorsi d'esame`} dell&apos;autoscuola.
      </Text>
    ) : null;

  return (
    <View style={s.root}>
      <StatusBar style="dark" />
      <Animated.FlatList
        data={hotspots ?? EMPTY}
        keyExtractor={keyOf}
        renderItem={renderItem}
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.content}
        initialNumToRender={10}
        windowSize={7}
        testID="road-hotspots"
      />
      <ClayNavBar title="Punti critici" scrollY={scrollY} onBack={() => router.back()} overlay={mapH - 26 - (insets.top + NAV_BAR_H) + 30} />
    </View>
  );
}

const EMPTY: RoadHotspot[] = [];
const keyOf = (h: RoadHotspot) => h.key;

/**
 * La mappa dei punti: montata una volta, non interattiva. Aloni rossi
 * (intensità = errori rispetto al punto peggiore), il simbolo dell'errore sul
 * punto, i percorsi d'esame tratteggiati sotto. Un tocco sul simbolo apre il
 * dettaglio come la riga della lista.
 */
const HotspotsMap = React.memo(function HotspotsMap({
  height,
  topInset,
  hotspots,
  routes,
  onOpen,
}: {
  height: number;
  topInset: number;
  hotspots: RoadHotspot[] | null;
  routes: RoadExamRoute[] | null;
  onOpen: (h: RoadHotspot) => void;
}) {
  const mapRef = useRef<MapView>(null);
  const [ready, setReady] = useState(false);
  const max = hotspots?.reduce((m, h) => Math.max(m, h.errors), 0) ?? 0;
  const routeLines = useMemo(
    () => (routes ?? []).map((r) => ({ id: r.id, coords: r.path.map(([latitude, longitude]) => ({ latitude, longitude })) })),
    [routes],
  );
  const target = useMemo(() => {
    const pts = hotspots?.length
      ? hotspots.map((h) => ({ latitude: h.lat, longitude: h.lng }))
      : routeLines.flatMap((r) => r.coords);
    return regionFor(pts);
  }, [hotspots, routeLines]);
  // Di solito i punti sono già pronti (store scaldato): la mappa nasce inquadrata.
  const [initialRegion] = useState(() => target ?? { ...FALLBACK, latitudeDelta: 0.04, longitudeDelta: 0.04 });
  const first = useRef(true);
  useEffect(() => {
    if (!ready || !target) return;
    // Al cambio periodo la camera scivola (260 ms, animazione di MapKit).
    mapRef.current?.animateToRegion(target, first.current ? 0 : 260);
    first.current = false;
  }, [ready, target]);

  return (
    <View style={{ height }} testID="hotspots-map">
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
        onMapReady={() => setReady(true)}
        mapPadding={{ top: topInset, right: 0, bottom: 28, left: 0 }}
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
        {routeLines.map((r) => (
          <Polyline
            key={r.id}
            coordinates={r.coords}
            strokeColor="rgba(17,17,17,0.55)"
            strokeWidth={3}
            lineDashPattern={[6, 6]}
            lineCap="round"
            zIndex={1}
          />
        ))}
        {(hotspots ?? []).map((h) => (
          <HeatHalo key={`c-${h.key}`} lat={h.lat} lng={h.lng} k={max ? h.errors / max : 1} />
        ))}
        {(hotspots ?? []).map((h) => (
          <PinTap key={`p-${h.key}`} hotspot={h} onOpen={onOpen} />
        ))}
      </MapView>
    </View>
  );
});

/** Quadro della mappa sui punti: centro e ampiezza con un minimo (un solo punto = zona dell'incrocio). */
function regionFor(pts: Array<{ latitude: number; longitude: number }>) {
  if (!pts.length) return null;
  const lats = pts.map((p) => p.latitude);
  const lngs = pts.map((p) => p.longitude);
  const [minLat, maxLat, minLng, maxLng] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
  return {
    // Un po' più in alto del centro: sotto la mappa sale il pannello.
    latitude: (minLat + maxLat) / 2 - Math.max(maxLat - minLat, 0.006) * 0.12,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * 2.4, 0.012),
    longitudeDelta: Math.max((maxLng - minLng) * 2.4, 0.012),
  };
}

/**
 * Alone rosso sotto il punto (più errori = più grande e più intenso).
 * Marker con una vista e non `Circle`: con questa versione di
 * react-native-maps sulla New Architecture il cerchio non si disegnava.
 */
const HeatHalo = React.memo(function HeatHalo({ lat, lng, k }: { lat: number; lng: number; k: number }) {
  const [laid, setLaid] = useState(false);
  const coordinate = useMemo(() => ({ latitude: lat, longitude: lng }), [lat, lng]);
  const size = Math.round(56 + 52 * k);
  return (
    <Marker coordinate={coordinate} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={!laid} zIndex={1}>
      <View
        pointerEvents="none"
        onLayout={() => setLaid(true)}
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: `rgba(220,38,38,${(0.12 + 0.14 * k).toFixed(2)})`, alignItems: 'center', justifyContent: 'center' }}
      >
        <View style={{ width: size * 0.56, height: size * 0.56, borderRadius: size * 0.28, backgroundColor: `rgba(220,38,38,${(0.1 + 0.12 * k).toFixed(2)})` }} />
      </View>
    </Marker>
  );
});

/** Simbolo dell'errore sul punto (pin di Road, bordo rosso «da migliorare»). */
const PinTap = React.memo(function PinTap({ hotspot, onOpen }: { hotspot: RoadHotspot; onOpen: (h: RoadHotspot) => void }) {
  const coordinate = useMemo(() => ({ latitude: hotspot.lat, longitude: hotspot.lng }), [hotspot.lat, hotspot.lng]);
  const press = useCallback(() => onOpen(hotspot), [onOpen, hotspot]);
  return (
    <RoadMarkerPin
      coordinate={coordinate}
      kind={hotspot.kind}
      label={hotspot.label}
      small
      sentiment="bad"
      onPress={press}
    />
  );
});

/** Riga di un punto: simbolo 3D, errore e via, quanti errori. Memo: il tocco non ridisegna le altre. */
const HotspotRow = React.memo(function HotspotRow({
  hotspot,
  first,
  last,
  onOpen,
  onBase,
}: {
  hotspot: RoadHotspot;
  first: boolean;
  last: boolean;
  onOpen: (h: RoadHotspot) => void;
  onBase: (h: number) => void;
}) {
  const where = [hotspot.street, hotspot.examRoutes.length ? "sul percorso d'esame" : null].filter(Boolean).join(' · ');
  return (
    <Animated.View
      entering={ROAD_FADE_IN}
      style={[s.rowWrap, first && s.rowFirst, last && s.rowLast]}
      onLayout={(e) => onBase(e.nativeEvent.layout.height - (first ? LIST_INSET : 0) - (last ? LIST_INSET : 0))}
    >
      <ClayListRow
        leading={<Icon3D source={markerArt(hotspot.kind)} size={40} />}
        title={hotspot.label}
        subtitle={where || studentsLabel(hotspot.students)}
        trailing={
          <View style={s.count}>
            <Text style={s.countNum}>{hotspot.errors}</Text>
            <Text style={s.countLabel}>{hotspot.errors === 1 ? 'errore' : 'errori'}</Text>
          </View>
        }
        onPress={() => onOpen(hotspot)}
        divider={!first}
        first={first}
        last={last}
        testID="hotspot-row"
      />
    </Animated.View>
  );
});

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: CLAY.bg },
  // Lo spazio della tab bar lo riserva il layout (FULL_PAGES).
  content: { paddingBottom: 40 },
  // Pannello bianco che sale sulla mappa, come nella tab Road.
  panel: {
    marginTop: -28,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    backgroundColor: CLAY.bg,
    paddingTop: 24,
    paddingHorizontal: H_PAD + 4,
    // Solo l'ombra verso l'alto: l'anello da 1 px disegnava una linea sotto il pannello.
    boxShadow: [{ offsetX: 0, offsetY: -10, blurRadius: 28, spreadDistance: -14, color: 'rgba(17,17,17,0.22)' }],
  },
  note: { fontSize: 14, lineHeight: 20, color: CLAY.ink3, marginTop: 10 },
  segmented: { marginTop: 18 },
  body: { paddingHorizontal: H_PAD },
  gap: { height: 18 },
  error: { fontSize: 15, lineHeight: 21, color: CLAY.ink3, paddingHorizontal: 4 },
  skList: { paddingVertical: 6 },
  skRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 18, paddingVertical: 12 },
  // Superficie clay dietro le righe: parte dove finisce l'intestazione (come Allievi).
  backdrop: { position: 'absolute', top: '100%', left: H_PAD, right: H_PAD },
  backdropFill: { flex: 1 },
  rowWrap: { marginHorizontal: H_PAD },
  rowFirst: { borderTopLeftRadius: CLAY_RADIUS.card, borderTopRightRadius: CLAY_RADIUS.card, overflow: 'hidden' },
  rowLast: { borderBottomLeftRadius: CLAY_RADIUS.card, borderBottomRightRadius: CLAY_RADIUS.card, overflow: 'hidden' },
  count: { alignItems: 'flex-end', marginRight: 2 },
  countNum: { fontSize: 19, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.4, fontVariant: ['tabular-nums'] },
  countLabel: { fontSize: 12, color: CLAY.ink3, marginTop: -1 },
  footnote: { fontSize: 13, lineHeight: 18, color: CLAY.ink3, paddingHorizontal: H_PAD + 4, marginTop: 14 },
});
