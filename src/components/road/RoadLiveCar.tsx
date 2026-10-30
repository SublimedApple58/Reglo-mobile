import React, { useEffect } from 'react';
import { Image, Platform, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { Marker } from 'react-native-maps';

import { carTopArt } from '../../road/markerArt';
import { CLAY_SHADOW } from '../../theme';

/**
 * REG-678 Reglo Road — l'auto della guida dal vivo.
 *
 * Mentre la mappa segue l'auto, l'auto NON è un marker: è una vista ferma sullo
 * schermo (dove cade il centro della camera) e si muove la mappa sotto, come in
 * Apple Maps. Tutto quello che si muove (rotazione, alone dell'accuratezza,
 * pulsazione) sono valori condivisi di Reanimated, animati sul thread UI: un
 * punto GPS nuovo non ridisegna né la mappa né la schermata.
 *
 * Disegno: disco bianco clay con ombra morbida, auto vista dall'alto nel colore
 * del veicolo, alone dell'accuratezza grigio chiarissimo e due anelli che
 * pulsano piano (2,4 s, senza rimbalzo). «Riduci movimento» non spegne niente.
 */

export const CAR_DISC = 54;
const PULSE_MS = 2400;

function PulseRing({ delay }: { delay: number }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: PULSE_MS, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.Never }), -1, false, undefined, ReduceMotion.Never),
    );
  }, [p, delay]);
  const st = useAnimatedStyle(() => ({
    opacity: 0.55 * (1 - p.value),
    transform: [{ scale: 0.75 + p.value * 1.25 }],
  }));
  return <Animated.View pointerEvents="none" style={[s.ring, st]} />;
}

export function RoadLiveCar({
  x,
  y,
  rotation,
  halo,
  visible,
  color,
}: {
  /** Punto dello schermo del centro della camera. */
  x: number;
  y: number;
  /** Gradi, relativi alla camera (auto − camera). */
  rotation: SharedValue<number>;
  /** Diametro dell'alone dell'accuratezza (pt). */
  halo: SharedValue<number>;
  /** 1 mentre la mappa segue l'auto, 0 quando è libera (c'è il marker). */
  visible: SharedValue<number>;
  color?: string | null;
}) {
  const wrap = useAnimatedStyle(() => ({ opacity: visible.value }));
  const car = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));
  const acc = useAnimatedStyle(() => ({
    width: halo.value,
    height: halo.value,
    borderRadius: halo.value / 2,
    marginLeft: -halo.value / 2,
    marginTop: -halo.value / 2,
  }));
  return (
    <Animated.View pointerEvents="none" style={[s.root, { left: x, top: y }, wrap]}>
      <Animated.View style={[s.acc, acc]} />
      <PulseRing delay={0} />
      <PulseRing delay={PULSE_MS / 2} />
      <View style={[s.disc, CLAY_SHADOW.raiseSm]} />
      <Animated.View style={[s.carBox, car]}>
        <Image source={carTopArt(color)} style={s.car} resizeMode="contain" />
      </Animated.View>
    </Animated.View>
  );
}

/**
 * La stessa auto come marker della mappa, per quando la mappa è libera (pan,
 * zoom, rotazione): resta sul punto vero e si aggiorna a ogni punto GPS.
 * Niente pulsazione qui (i marker animati costano a ogni fotogramma).
 */
export function RoadLiveCarMarker({
  coordinate,
  rotation,
  color,
  opacity,
}: {
  coordinate: { latitude: number; longitude: number };
  rotation: number;
  color?: string | null;
  opacity: number;
}) {
  return (
    <Marker coordinate={coordinate} anchor={{ x: 0.5, y: 0.5 }} opacity={opacity} zIndex={10} tracksViewChanges={Platform.OS === 'android'}>
      <View style={s.markerBox} pointerEvents="none">
        <View style={[s.disc, s.discStatic, CLAY_SHADOW.raiseSm]} />
        <Image source={carTopArt(color)} style={[s.car, { transform: [{ rotate: `${rotation}deg` }] }]} resizeMode="contain" />
      </View>
    </Marker>
  );
}

const s = StyleSheet.create({
  // Il punto (left, top) è il centro: i figli sono centrati lì con i margini negativi.
  root: { position: 'absolute', width: 0, height: 0, alignItems: 'center', justifyContent: 'center' },
  acc: { position: 'absolute', left: 0, top: 0, backgroundColor: 'rgba(17,17,17,0.06)' },
  ring: {
    position: 'absolute',
    left: -CAR_DISC / 2,
    top: -CAR_DISC / 2,
    width: CAR_DISC,
    height: CAR_DISC,
    borderRadius: CAR_DISC / 2,
    borderWidth: 1.5,
    borderColor: 'rgba(17,17,17,0.22)',
  },
  disc: {
    position: 'absolute',
    left: -CAR_DISC / 2,
    top: -CAR_DISC / 2,
    width: CAR_DISC,
    height: CAR_DISC,
    borderRadius: CAR_DISC / 2,
    backgroundColor: '#FFFFFF',
  },
  carBox: { position: 'absolute', left: -15, top: -23, width: 30, height: 46 },
  car: { width: 30, height: 46 },
  markerBox: { width: CAR_DISC + 16, height: CAR_DISC + 16, alignItems: 'center', justifyContent: 'center' },
  discStatic: { left: 8, top: 8 },
});
