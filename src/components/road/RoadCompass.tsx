import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { CLAY } from '../../theme';
import { NIGHT } from '../../road/night';

/**
 * REG-723 — la bussola della mappa, come quella di Apple Mappe: ago rosso
 * (nord) e scuro (sud) sul perno al centro, la «N» sopra la punta rossa. Tutto
 * gira con la mappa in 220 ms per la via più corta; la lettera resta dritta
 * (gira solo la sua posizione), così si legge sempre.
 */
const NORTH_RED = '#E5484D';

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
  const dialStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rot.value}deg` }] }));
  const letterStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${-rot.value}deg` }] }));
  const ink = night ? NIGHT.ink : CLAY.ink;
  const south = night ? 'rgba(242,242,242,0.55)' : 'rgba(17,17,17,0.85)';
  return (
    <Animated.View style={[c.dial, dialStyle]} pointerEvents="none">
      <View style={[c.ring, { borderColor: night ? 'rgba(255,255,255,0.18)' : 'rgba(17,17,17,0.12)' }]} />
      <View style={c.letterSlot}>
        <Animated.View style={letterStyle}>
          <Text style={[c.n, { color: ink }]}>N</Text>
        </Animated.View>
      </View>
      <View style={[c.up, { borderBottomColor: NORTH_RED }]} />
      <View style={[c.down, { borderTopColor: south }]} />
      <View style={[c.pin, { backgroundColor: night ? '#1C1C1E' : '#FFFFFF' }]} />
    </Animated.View>
  );
});

const DIAL = 44;
const NEEDLE = 10;
const NEEDLE_W = 5;
const c = StyleSheet.create({
  dial: { width: DIAL, height: DIAL },
  ring: { position: 'absolute', left: 0, top: 0, width: DIAL, height: DIAL, borderRadius: DIAL / 2, borderWidth: 1.5 },
  letterSlot: { position: 'absolute', top: 1, left: 0, right: 0, height: 13, alignItems: 'center', justifyContent: 'center' },
  n: { fontSize: 11.5, lineHeight: 13, fontWeight: '600', letterSpacing: 0 },
  up: {
    position: 'absolute',
    top: DIAL / 2 - NEEDLE,
    left: DIAL / 2 - NEEDLE_W,
    width: 0,
    height: 0,
    borderLeftWidth: NEEDLE_W,
    borderRightWidth: NEEDLE_W,
    borderBottomWidth: NEEDLE,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  down: {
    position: 'absolute',
    top: DIAL / 2,
    left: DIAL / 2 - NEEDLE_W,
    width: 0,
    height: 0,
    borderLeftWidth: NEEDLE_W,
    borderRightWidth: NEEDLE_W,
    borderTopWidth: NEEDLE,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  pin: { position: 'absolute', top: DIAL / 2 - 1.5, left: DIAL / 2 - 1.5, width: 3, height: 3, borderRadius: 1.5 },
});
