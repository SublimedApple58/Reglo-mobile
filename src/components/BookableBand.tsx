import React, { useSyncExternalStore } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { scrubActive, scrubLabel, scrubX, scrubY } from '../stores/scrubOverlay';

const BAND_H = 112;
const PX_PER_STEP = 10; // px of vertical drag per 15-min step (sensitive)
const STEP = 15;

const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

type Props = {
  /** Bookable free window, minutes from midnight. */
  windowStart: number;
  windowEnd: number;
  label?: string;
  /** Release / tap → open the booking sheet preset to this start (minutes). */
  onPick: (startMinutes: number) => void;
};

/**
 * Airbnb-style "bookable" card: hold to scrub a start time (vertical drag,
 * 15-min steps, haptic per step), release to book; a plain tap books at the
 * window start. While holding, a lesson-card-shaped bubble (drawn by the
 * screen-level <ScrubBubble>) follows the finger anywhere on screen.
 */
export const BookableBand = ({ windowStart, windowEnd, label = 'Tieni premuto per prenotare', onPick }: Props) => {
  const active = useSharedValue(0);
  const base = useSharedValue(windowStart);
  const cur = useSharedValue(windowStart);

  const spanSteps = Math.max(1, Math.round((windowEnd - STEP - windowStart) / STEP));
  const clampStart = (m: number) => {
    'worklet';
    const lo = windowStart;
    const hi = windowEnd - STEP;
    const snapped = Math.round(m / STEP) * STEP;
    return Math.max(lo, Math.min(hi, snapped));
  };

  const startHaptic = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  const stepHaptic = () => Haptics.selectionAsync();
  const setLabelFromMin = (m: number) => scrubLabel.set(fmt(m)); // JS-thread formatting

  const pan = Gesture.Pan()
    .activateAfterLongPress(220)
    .onStart((e) => {
      active.value = withTiming(1, { duration: 140 });
      const frac = Math.max(0, Math.min(1, e.y / BAND_H));
      const startMin = clampStart(windowStart + Math.round(frac * spanSteps) * STEP);
      base.value = startMin;
      cur.value = startMin;
      scrubX.value = e.absoluteX;
      scrubY.value = e.absoluteY;
      scrubActive.value = withTiming(1, { duration: 140 });
      runOnJS(setLabelFromMin)(startMin);
      runOnJS(startHaptic)();
    })
    .onUpdate((e) => {
      scrubX.value = e.absoluteX;
      scrubY.value = e.absoluteY;
      const steps = Math.round(e.translationY / PX_PER_STEP);
      const m = clampStart(base.value + steps * STEP);
      if (m !== cur.value) {
        cur.value = m;
        runOnJS(setLabelFromMin)(m);
        runOnJS(stepHaptic)();
      }
    })
    .onEnd(() => {
      active.value = withTiming(0, { duration: 180 });
      scrubActive.value = withTiming(0, { duration: 180 });
      runOnJS(onPick)(cur.value);
    })
    .onFinalize((_e, success) => {
      active.value = withTiming(0, { duration: 180 });
      if (!success) scrubActive.value = withTiming(0, { duration: 180 });
    });

  const tap = Gesture.Tap()
    .maxDuration(250)
    .onEnd(() => {
      runOnJS(onPick)(clampStart(windowStart));
    });

  const gesture = Gesture.Exclusive(pan, tap);

  // While holding, the card "lifts away" (dims + shrinks) — the floating
  // lesson-card bubble takes over at the finger.
  const cardStyle = useAnimatedStyle(() => ({
    opacity: 1 - active.value * 0.55,
    transform: [{ scale: 1 - active.value * 0.03 }],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[s.card, cardStyle]}>
        <View style={s.iconCircle}>
          <MaterialCommunityIcons name="gesture-tap-hold" size={22} color="#1A1A2E" />
        </View>
        <Text style={s.label}>{label}</Text>
      </Animated.View>
    </GestureDetector>
  );
};

/** Single screen-level scrub bubble shaped like a lesson card. Mount once near the screen root. */
export const ScrubBubble = () => {
  const label = useSyncExternalStore(scrubLabel.subscribe, scrubLabel.get);
  const style = useAnimatedStyle(() => ({
    opacity: scrubActive.value,
    transform: [
      { translateX: scrubX.value - 96 },
      { translateY: scrubY.value - 116 },
      { scale: 0.8 + scrubActive.value * 0.2 },
    ],
  }));
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View style={[s.bubble, style]}>
        <View style={s.bubbleIcon}>
          <MaterialCommunityIcons name="car" size={20} color="#FFFFFF" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.bubbleTime}>{label}</Text>
          <Text style={s.bubbleSub}>Nuova guida · rilascia per prenotare</Text>
        </View>
      </Animated.View>
    </View>
  );
};

const s = StyleSheet.create({
  card: {
    height: BAND_H,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 14,
    shadowColor: '#1A1A2E',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  iconCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F1F3F7', alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 13.5, fontWeight: '600', color: '#8A93A2', letterSpacing: -0.1 },

  bubble: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 232,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 20,
    shadowColor: '#1A1A2E',
    shadowOpacity: 0.22,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 14,
  },
  bubbleIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#1A1A2E', alignItems: 'center', justifyContent: 'center' },
  bubbleTime: { fontSize: 22, fontWeight: '800', color: '#1A1A2E', letterSpacing: -0.4, fontVariant: ['tabular-nums'] },
  bubbleSub: { fontSize: 12, fontWeight: '500', color: '#9AA1AC', marginTop: 1 },
});
