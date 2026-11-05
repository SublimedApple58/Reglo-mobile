import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { CLAY } from '../../theme';
import { NIGHT } from '../../road/night';

/**
 * REG-723 — la bussola della mappa: la «N» e l'ago girano con la mappa (come
 * su Apple Mappe), così non si confonde con «Ricentra». La rotazione segue la
 * direzione della mappa in 220 ms, sempre per la via più corta.
 */
export const RoadCompass = React.memo(function RoadCompass({ heading, night }: { heading: number; night: boolean }) {
  const rot = useSharedValue(-heading);
  const last = useRef(-heading);
  useEffect(() => {
    // Per la via più corta: da 350° a 10° si gira di 20°, non di 340°.
    const target = -heading;
    const delta = ((((target - last.current) % 360) + 540) % 360) - 180;
    last.current += delta;
    rot.value = withTiming(last.current, { duration: 220, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.Never });
  }, [heading, rot]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${rot.value}deg` }] }));
  const ink = night ? NIGHT.ink : CLAY.ink;
  const soft = night ? 'rgba(255,255,255,0.28)' : 'rgba(17,17,17,0.22)';
  return (
    <Animated.View style={[c.dial, style]} pointerEvents="none">
      <Text style={[c.n, { color: ink }]}>N</Text>
      <View style={[c.up, { borderBottomColor: ink }]} />
      <View style={[c.down, { borderTopColor: soft }]} />
    </Animated.View>
  );
});

// L'ago ha il perno al centro del quadrante (gira su sé stesso), la «N» sopra la punta.
const DIAL = 36;
const HALF = 8;
const c = StyleSheet.create({
  dial: { width: DIAL, height: DIAL },
  n: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 10.5,
    lineHeight: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  up: {
    position: 'absolute',
    top: DIAL / 2 - HALF,
    left: DIAL / 2 - 4,
    width: 0,
    height: 0,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderBottomWidth: HALF,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  down: {
    position: 'absolute',
    top: DIAL / 2,
    left: DIAL / 2 - 4,
    width: 0,
    height: 0,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderTopWidth: HALF,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
});
