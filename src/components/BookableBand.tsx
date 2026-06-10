import React, { useSyncExternalStore } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from '../utils/haptics';

import { scrubActive, scrubLabel, scrubX, scrubY } from '../stores/scrubOverlay';

const BAND_H = 56;
const PX_PER_STEP = 10; // px of vertical drag per 15-min step (sensitive)
const STEP = 15;

const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const durFmt = (m: number) =>
  m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ' ' + (m % 60) + 'min' : ''}` : `${m} min`;

type Props = {
  /** Bookable free window, minutes from midnight. */
  windowStart: number;
  windowEnd: number;
  /**
   * ALL bookable start minutes across the whole day (ascending, 15-min grid,
   * union of every free window). The scrub walks this shared list so holding on
   * one band can reach times in any other band — gaps/pauses and booked lessons
   * are simply absent from the list, so the finger "jumps" past them.
   */
  bookableStarts?: number[];
  /** Show the one-time "hold to pick a time" caption (first free slot only). */
  showHint?: boolean;
  /** Release / tap → open the booking sheet preset to this start (minutes). */
  onPick: (startMinutes: number) => void;
};

/**
 * Recessive "bookable" ghost band: a quiet dashed slot showing the free
 * window's duration + a "+" affordance, so booked lessons dominate the
 * timeline instead of competing with N identical CTAs. The hold-to-scrub
 * gesture is unchanged — hold to scrub a start time (vertical drag, 15-min
 * steps, haptic per step), release to book; a plain tap books at the window
 * start. While holding, a lesson-card-shaped bubble (drawn by the screen-level
 * <ScrubBubble>) follows the finger anywhere on screen.
 */
export const BookableBand = ({ windowStart, windowEnd, bookableStarts, showHint = false, onPick }: Props) => {
  const active = useSharedValue(0);
  const baseIdx = useSharedValue(0);
  const curIdx = useSharedValue(0);

  // The day-wide bookable grid the scrub walks. Falls back to this band's own
  // 15-min grid if the caller didn't pass the shared list.
  const starts = (() => {
    if (bookableStarts && bookableStarts.length) return bookableStarts;
    const own: number[] = [];
    for (let m = windowStart; m <= windowEnd - STEP; m += STEP) own.push(m);
    return own.length ? own : [windowStart];
  })();

  // Nearest index in `starts` to a given minute (worklet — runs on UI thread).
  const idxNearest = (m: number) => {
    'worklet';
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < starts.length; i++) {
      const d = starts[i] - m;
      const ad = d < 0 ? -d : d;
      if (ad < bestD) { bestD = ad; best = i; }
    }
    return best;
  };
  const clampIdx = (i: number) => {
    'worklet';
    return Math.max(0, Math.min(starts.length - 1, i));
  };

  const startHaptic = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  const stepHaptic = () => Haptics.selectionAsync();
  const setLabelFromMin = (m: number) => scrubLabel.set(fmt(m)); // JS-thread formatting

  const pan = Gesture.Pan()
    .activateAfterLongPress(220)
    .onStart((e) => {
      active.value = withTiming(1, { duration: 140 });
      // Seed within THIS band based on where the finger pressed, then snap to the
      // nearest entry in the shared day-wide grid.
      const frac = Math.max(0, Math.min(1, e.y / BAND_H));
      const localMin = windowStart + Math.round((frac * (windowEnd - windowStart)) / STEP) * STEP;
      const idx = idxNearest(localMin);
      baseIdx.value = idx;
      curIdx.value = idx;
      scrubX.value = e.absoluteX;
      scrubY.value = e.absoluteY;
      scrubActive.value = withTiming(1, { duration: 140 });
      runOnJS(setLabelFromMin)(starts[idx]);
      runOnJS(startHaptic)();
    })
    .onUpdate((e) => {
      scrubX.value = e.absoluteX;
      scrubY.value = e.absoluteY;
      const steps = Math.round(e.translationY / PX_PER_STEP);
      const idx = clampIdx(baseIdx.value + steps);
      if (idx !== curIdx.value) {
        curIdx.value = idx;
        runOnJS(setLabelFromMin)(starts[idx]);
        runOnJS(stepHaptic)();
      }
    })
    .onEnd(() => {
      active.value = withTiming(0, { duration: 180 });
      scrubActive.value = withTiming(0, { duration: 180 });
      runOnJS(onPick)(starts[curIdx.value]);
    })
    .onFinalize((_e, success) => {
      active.value = withTiming(0, { duration: 180 });
      if (!success) scrubActive.value = withTiming(0, { duration: 180 });
    });

  const tap = Gesture.Tap()
    .maxDuration(250)
    .onEnd(() => {
      // Tap books at this band's start (its nearest grid entry).
      runOnJS(onPick)(starts[idxNearest(windowStart)]);
    });

  const gesture = Gesture.Exclusive(pan, tap);

  // While holding, the band "lifts away" (dims + shrinks) — the floating
  // lesson-card bubble takes over at the finger.
  const cardStyle = useAnimatedStyle(() => ({
    opacity: 1 - active.value * 0.5,
    transform: [{ scale: 1 - active.value * 0.02 }],
  }));

  return (
    <View style={s.wrap}>
      <GestureDetector gesture={gesture}>
        <Animated.View style={[s.band, cardStyle]}>
          <Text style={s.lab}>Libero</Text>
          <Text style={s.dur}>· {durFmt(windowEnd - windowStart)}</Text>
          <View style={s.plus}>
            <MaterialCommunityIcons name="plus" size={20} color="#FFFFFF" />
          </View>
        </Animated.View>
      </GestureDetector>
      {showHint ? <Text style={s.hint}>Tieni premuto su uno slot per scegliere l’ora</Text> : null}
    </View>
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
  wrap: { marginBottom: 14 },
  band: {
    height: BAND_H,
    borderRadius: 14,
    backgroundColor: '#F8F9FC',
    borderWidth: 1.5,
    borderColor: '#D6D9E6',
    borderStyle: 'dashed',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  lab: { fontSize: 13.5, fontWeight: '600', color: '#6E7596', letterSpacing: -0.1 },
  dur: { fontSize: 12.5, fontWeight: '500', color: '#AEB4CC', marginLeft: 5 },
  plus: { marginLeft: 'auto', width: 30, height: 30, borderRadius: 15, backgroundColor: '#1A1A2E', alignItems: 'center', justifyContent: 'center' },
  hint: { fontSize: 11.5, fontWeight: '500', color: '#AEB4CC', marginTop: 6, marginLeft: 2 },

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
