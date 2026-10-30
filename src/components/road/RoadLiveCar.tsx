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

/**
 * REG-678 Reglo Road — l'auto della guida dal vivo.
 *
 * Mentre la mappa segue l'auto, l'auto NON è un marker: è una vista ferma sullo
 * schermo (dove cade il centro della camera) e si muove la mappa sotto, come in
 * Apple Maps. Tutto quello che si muove (rotazione, alone dell'accuratezza,
 * pulsazione) sono valori condivisi di Reanimated, animati sul thread UI: un
 * punto GPS nuovo non ridisegna né la mappa né la schermata.
 *
 * Disegno (REG-682, «l'auto non è più in 3D?»): l'auto 3D vista dall'alto nel
 * colore del veicolo (`assets/road/cars/auto-su-*`, la stessa del web), da sola
 * sulla mappa, senza il disco bianco che la faceva sembrare un'icona piatta.
 * 30×46 pt = esattamente il PNG @3x (90×138 px): nitida, mai ingrandita.
 * Ombra morbida dalla sagoma del PNG su un contenitore che NON ruota: la luce
 * resta sempre dall'alto mentre l'auto gira. Sotto, l'alone dell'accuratezza
 * grigio chiarissimo e due anelli che pulsano piano (2,4 s, senza rimbalzo).
 * «Riduci movimento» non spegne niente.
 */

export const CAR_DISC = 54;
/** L'auto 3D: misura del PNG @1x (il @3x è 90×138 px). */
const CAR_W = 30;
const CAR_H = 46;
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
      <View style={s.shadowBox}>
        {Platform.OS === 'android' ? <Animated.View style={[s.androidShadow, car]} /> : null}
        <Animated.View style={[s.carRot, car]}>
          <Image source={carTopArt(color)} style={s.car} resizeMode="contain" />
        </Animated.View>
      </View>
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
        <View style={s.markerShadow}>
          {Platform.OS === 'android' ? <View style={[s.androidShadow, s.androidShadowStatic, { transform: [{ rotate: `${rotation}deg` }] }]} /> : null}
          <Image source={carTopArt(color)} style={[s.car, { transform: [{ rotate: `${rotation}deg` }] }]} resizeMode="contain" />
        </View>
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
  // Contenitore fermo (non ruota) con l'ombra: su iOS l'ombra segue la sagoma
  // trasparente del PNG; la luce resta in alto anche quando l'auto gira.
  shadowBox: {
    position: 'absolute',
    left: -CAR_W / 2,
    top: -CAR_H / 2,
    width: CAR_W,
    height: CAR_H,
    shadowColor: '#000000',
    shadowOpacity: 0.4,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 6 },
  },
  carRot: { width: CAR_W, height: CAR_H },
  car: { width: CAR_W, height: CAR_H },
  // Android non fa ombre dalla trasparenza: una sagoma arrotondata con boxShadow sotto l'auto.
  androidShadow: {
    position: 'absolute',
    left: 2,
    top: 3,
    width: CAR_W - 4,
    height: CAR_H - 6,
    borderRadius: 12,
    boxShadow: '0px 5px 10px rgba(0,0,0,0.30)',
  },
  androidShadowStatic: {},
  markerBox: { width: CAR_W + 24, height: CAR_H + 24, alignItems: 'center', justifyContent: 'center' },
  markerShadow: {
    width: CAR_W,
    height: CAR_H,
    shadowColor: '#000000',
    shadowOpacity: 0.4,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 6 },
  },
});
