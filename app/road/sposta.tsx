import React, { useMemo, useRef, useState } from 'react';
import { Image, Platform, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming, ReduceMotion } from 'react-native-reanimated';

import { ClayButton, ClayIconButton } from '../../src/components/clay';
import { CLAY, CLAY_SHADOW } from '../../src/theme';
import { markerArt } from '../../src/road/markerArt';
import { haversineMeters } from '../../src/road/format';
import { ANDROID_DAY_STYLE } from '../../src/road/night';
import { SheetNightContext } from '../../src/theme/night';
import { applyMarkerEdit, useEditedMarker, useMarkerEditTarget } from '../../src/road/markerEdit';

/** Quanto «si solleva» la segnalazione mentre la mappa si muove sotto il mirino. */
const LIFT = 8;
const LIFT_MS = 200;
const EASE = Easing.out(Easing.cubic);

/**
 * Road novembre R3 — «Sposta sulla mappa» col mirino (Tiziano 10/11: niente
 * drag nativo, che su New Arch fa sparire i pin di AIRMap). Il mirino resta
 * fermo al centro, si muove la mappa; la segnalazione sta sollevata sopra il
 * mirino e il posto di prima resta tratteggiato. «Metti qui» manda lat/lng;
 * la via la ricalcola il server. Sempre di giorno: è una schermata breve di
 * precisione e le mappe chiare si leggono meglio.
 */
export default function SpostaScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const target = useMarkerEditTarget();
  const marker = useEditedMarker();
  // La posizione di partenza resta quella all'apertura (la MapView non cambia figli).
  const [start] = useState(() => (marker ? { lat: marker.lat, lng: marker.lng } : null));
  const center = useRef(start);
  const [moved, setMoved] = useState(0);
  const [saving, setSaving] = useState(false);
  const lift = useSharedValue(0);
  const liftStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -lift.value }] }));

  const initialRegion = useMemo<Region | undefined>(
    () => (start ? { latitude: start.lat, longitude: start.lng, latitudeDelta: 0.0035, longitudeDelta: 0.0035 } : undefined),
    [start],
  );

  if (!target || !marker || !start || !initialRegion) return <View style={s.root} />;

  const onChange = () => {
    lift.value = withTiming(LIFT, { duration: LIFT_MS, easing: EASE, reduceMotion: ReduceMotion.Never });
  };
  const onDone = (r: Region) => {
    lift.value = withTiming(0, { duration: LIFT_MS, easing: EASE, reduceMotion: ReduceMotion.Never });
    center.current = { lat: r.latitude, lng: r.longitude };
    setMoved(Math.round(haversineMeters(start.lat, start.lng, r.latitude, r.longitude)));
  };

  const place = async () => {
    const c = center.current;
    if (!c || saving) return;
    setSaving(true);
    const ok = await applyMarkerEdit(target, { patch: { lat: c.lat, lng: c.lng } });
    setSaving(false);
    if (ok) router.back();
  };

  const where = moved < 3 ? 'Nel punto di prima' : `A ${moved} m dal punto di prima`;

  return (
    // Sempre di giorno anche dentro la Road di notte: i bottoni clay non si invertono.
    <SheetNightContext.Provider value={false}>
      <View style={s.root}>
        <MapView
          style={StyleSheet.absoluteFill}
          initialRegion={initialRegion}
          onRegionChange={onChange}
          onRegionChangeComplete={onDone}
          mapType={Platform.OS === 'ios' ? 'mutedStandard' : 'standard'}
          customMapStyle={ANDROID_DAY_STYLE}
          showsPointsOfInterest={false}
          showsBuildings={false}
          showsCompass={false}
          showsScale={false}
          toolbarEnabled={false}
          pitchEnabled={false}
          rotateEnabled={false}
          userInterfaceStyle="light"
        >
          {/* Il posto di prima, tratteggiato: unico figlio, non cambia mai. */}
          <Marker coordinate={{ latitude: start.lat, longitude: start.lng }} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
            <View style={s.ghost}>
              <Image source={markerArt(marker.kind)} style={s.ghostImg} resizeMode="contain" />
            </View>
          </Marker>
        </MapView>

        {/* Mirino fisso al centro, con la segnalazione sollevata sopra. */}
        <View pointerEvents="none" style={s.crossWrap}>
          <Animated.View style={[s.lifted, liftStyle]}>
            <View style={[s.disc, marker.sentiment === 'good' ? s.good : marker.sentiment === 'bad' ? s.bad : null]}>
              <Image source={markerArt(marker.kind)} style={s.discImg} resizeMode="contain" />
            </View>
            <View style={s.stem} />
          </Animated.View>
          <View style={s.ring} />
          <View style={s.h} />
          <View style={s.v} />
          <View style={s.dot} />
        </View>

        <View style={[s.top, CLAY_SHADOW.raise, { top: insets.top + 8 }]}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.title} numberOfLines={1}>Sposta «{marker.label}»</Text>
            <Text style={s.sub}>Muovi la mappa sotto il mirino</Text>
          </View>
          <ClayIconButton icon="close" onPress={() => router.back()} accessibilityLabel="Chiudi" testID="road-move-close" />
        </View>

        <View style={[s.bottom, CLAY_SHADOW.raise, { bottom: insets.bottom + 12 }]}>
          <Text style={s.label}>Nuovo punto</Text>
          <Text style={s.where}>{where}</Text>
          <ClayButton title="Metti qui" onPress={() => void place()} loading={saving} disabled={moved < 3} testID="road-move-place" />
        </View>
      </View>
    </SheetNightContext.Provider>
  );
}

const DISC = 48;
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: CLAY.bg },
  crossWrap: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: CLAY.ink, backgroundColor: 'rgba(255,255,255,0.25)' },
  h: { position: 'absolute', width: 64, height: 2, backgroundColor: CLAY.ink },
  v: { position: 'absolute', width: 2, height: 64, backgroundColor: CLAY.ink },
  dot: { position: 'absolute', width: 6, height: 6, borderRadius: 3, backgroundColor: CLAY.ink },
  // Sopra il centro: disco + gambo che arriva al bordo dell'anello.
  lifted: { position: 'absolute', bottom: '50%', marginBottom: 22, alignItems: 'center' },
  disc: {
    width: DISC,
    height: DISC,
    borderRadius: DISC / 2,
    backgroundColor: '#FFFFFF',
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0px 10px 18px -4px rgba(0,0,0,0.35)',
  },
  good: { borderColor: '#16A34A' },
  bad: { borderColor: '#DC2626' },
  discImg: { width: 32, height: 32 },
  stem: { width: 2, height: 14, backgroundColor: CLAY.ink },
  ghost: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(17,17,17,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostImg: { width: 20, height: 20, opacity: 0.55 },
  top: {
    position: 'absolute',
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingLeft: 18,
    paddingRight: 12,
    borderRadius: 24,
    backgroundColor: CLAY.surface,
  },
  title: { fontSize: 17, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.3 },
  sub: { fontSize: 13.5, color: CLAY.ink3, marginTop: 1 },
  bottom: { position: 'absolute', left: 12, right: 12, padding: 18, borderRadius: 30, backgroundColor: CLAY.surface },
  label: { fontSize: 13, color: CLAY.ink3 },
  where: { fontSize: 19, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.4, marginTop: 2, marginBottom: 14 },
});
