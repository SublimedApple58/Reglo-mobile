import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView from 'react-native-maps';
import * as Location from 'expo-location';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { regloApi } from '../../../src/services/regloApi';
import type { RoadFreeOptions } from '../../../src/types/regloApi';
import { RoadCarMarker } from '../../../src/components/road/RoadMapParts';
import { beginRoadEntry, ROAD_ROUTE } from '../../../src/road/entryFlow';
import { ROAD_FREE_SHEET_ROUTE, roadFreeStore } from '../../../src/road/freeStartStore';
import { lessonStudentName, useRoadState } from '../../../src/road/roadStore';
import { formatHm } from '../../../src/road/format';

const ROAD_ICON = require('../../../assets/road/fluent-road.png');

const PITCH = 40;
const ALTITUDE = 900; // iOS (metri)
const ZOOM = 16.4; // Android
const FALLBACK = { latitude: 45.0703, longitude: 7.6869 };

/**
 * REG-638 Road libero — tab «Road» (anteprima A2-1): la mappa con dove sei,
 * il pannello «Pronto a partire?» e «Avvia guida». Se adesso c'è già una tua
 * guida, il bottone diventa «Entra in Road» su quella; se Road è in corso,
 * «Torna in Road».
 */
export default function RoadTab() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const road = useRoadState();
  const mapRef = useRef<MapView>(null);
  const [pos, setPos] = useState<{ latitude: number; longitude: number } | null>(null);
  const [options, setOptions] = useState<RoadFreeOptions | null>(() => roadFreeStore.get());
  const [error, setError] = useState<string | null>(null);
  const [panelH, setPanelH] = useState(260);

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
        const p = { latitude: last.coords.latitude, longitude: last.coords.longitude };
        setPos(p);
        mapRef.current?.setCamera({ center: p, heading: 0, pitch: PITCH, altitude: ALTITUDE, zoom: ZOOM });
      } catch {
        // la mappa resta sulla città di default
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const inRoad = road.phase !== 'idle' && !!road.session;
  const current = options?.currentLesson ?? null;
  const defaultVehicle = options?.vehicles.find((v) => v.id === options.defaultVehicleId) ?? null;
  const freeVehicles = options?.vehicles.filter((v) => !v.busy).length ?? 0;

  const subtitle = inRoad
    ? `Stai guidando con ${lessonStudentName(road.session?.lesson)}`
    : current
      ? `Hai una guida adesso con ${lessonStudentName(current)}`
      : options?.nextLessonAt
        ? `Nessuna guida fino alle ${formatHm(options.nextLessonAt)}`
        : 'Nessun\'altra guida oggi: parti quando vuoi';

  const onPrimary = () => {
    if (inRoad) {
      router.push(ROAD_ROUTE);
      return;
    }
    if (current) {
      void beginRoadEntry(router, current);
      return;
    }
    router.push(ROAD_FREE_SHEET_ROUTE);
  };

  const primaryLabel = inRoad ? 'Torna in Road' : current ? 'Entra in Road' : 'Avvia guida';

  return (
    <View style={s.root}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialCamera={{ center: pos ?? FALLBACK, heading: 0, pitch: PITCH, altitude: ALTITUDE, zoom: ZOOM }}
        mapPadding={{ top: insets.top + 60, right: 0, bottom: panelH + 12, left: 0 }}
        legalLabelInsets={{ top: 0, right: 0, bottom: panelH + 26, left: 18 }}
        mapType={Platform.OS === 'ios' ? 'mutedStandard' : 'standard'}
        showsPointsOfInterest={false}
        showsCompass={false}
        showsScale={false}
        showsTraffic={false}
        showsUserLocation={false}
        toolbarEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        userInterfaceStyle="light"
      >
        {pos ? <RoadCarMarker coordinate={pos} rotation={0} color={defaultVehicle?.carColor ?? null} /> : null}
      </MapView>

      <View style={[s.brand, { top: insets.top + 10 }]} pointerEvents="none">
        <Image source={ROAD_ICON} style={s.brandImg} resizeMode="contain" />
        <Text style={s.brandTx}>Road</Text>
      </View>

      <View style={s.panelWrap} onLayout={(e) => setPanelH(e.nativeEvent.layout.height)}>
        <View style={s.panel} testID="road-tab-panel">
          <Text style={s.title}>{inRoad ? 'Guida in corso' : 'Pronto a partire?'}</Text>
          <Text style={s.sub} numberOfLines={2}>
            {error && !options ? error : subtitle}
          </Text>

          <View style={s.tiles}>
            <View style={s.tile}>
              <Text style={s.tileNum}>{options ? options.todayCount : '–'}</Text>
              <Text style={s.tileLabel}>{options?.todayCount === 1 ? 'guida oggi' : 'guide oggi'}</Text>
            </View>
            <View style={s.tile}>
              <Text style={s.tileNum}>{options?.nextLessonAt ? formatHm(options.nextLessonAt) : '–'}</Text>
              <Text style={s.tileLabel}>prossima</Text>
            </View>
            <View style={s.tile}>
              <Text style={s.tileNum}>{options ? freeVehicles : '–'}</Text>
              <Text style={s.tileLabel}>{freeVehicles === 1 ? 'auto libera' : 'auto libere'}</Text>
            </View>
          </View>

          <Pressable
            onPress={onPrimary}
            disabled={!options && !inRoad}
            style={({ pressed }) => [s.cta, pressed && { opacity: 0.88 }]}
            accessibilityRole="button"
            testID="road-tab-start"
          >
            {!options && !inRoad && !error ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={s.ctaTx}>{primaryLabel}</Text>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F2F0EB' },
  brand: {
    position: 'absolute',
    left: 20,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 10,
    paddingRight: 16,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.94)',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  brandImg: { width: 26, height: 26 },
  brandTx: { fontSize: 16.5, fontWeight: '600', color: '#111111', letterSpacing: -0.3 },
  panelWrap: { position: 'absolute', left: 10, right: 10, bottom: 10 },
  panel: {
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
    paddingTop: 22,
    paddingHorizontal: 20,
    paddingBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  title: { fontSize: 23, fontWeight: '600', color: '#111111', letterSpacing: -0.6 },
  sub: { fontSize: 14.5, fontWeight: '400', color: '#6A6A6A', marginTop: 4, letterSpacing: -0.1 },
  tiles: { flexDirection: 'row', gap: 8, marginTop: 16 },
  tile: { flex: 1, borderRadius: 16, backgroundColor: '#F4F4F2', paddingVertical: 11, paddingHorizontal: 12 },
  tileNum: { fontSize: 16.5, fontWeight: '600', color: '#111111', letterSpacing: -0.3, fontVariant: ['tabular-nums'] },
  tileLabel: { fontSize: 12.5, fontWeight: '400', color: '#6A6A6A', marginTop: 1 },
  cta: {
    height: 54,
    borderRadius: 27,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  ctaTx: { fontSize: 17, fontWeight: '600', color: '#FFFFFF', letterSpacing: -0.3 },
});
