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

const c = StyleSheet.create({
  dial: { width: 36, height: 36, alignItems: 'center' },
  n: { fontSize: 11, lineHeight: 12, fontWeight: '600', letterSpacing: 0.2 },
  up: {
    width: 0,
    height: 0,
    marginTop: 1,
    borderLeftWidth: 4.5,
    borderRightWidth: 4.5,
    borderBottomWidth: 11,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  down: {
    width: 0,
    height: 0,
    borderLeftWidth: 4.5,
    borderRightWidth: 4.5,
    borderTopWidth: 11,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
});
