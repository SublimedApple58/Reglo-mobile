import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { BookingForm } from '../../../src/components/booking/BookingForm';
import { BlockForm } from '../../../src/components/booking/BlockForm';
import { colors } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';

type Mode = 'lesson' | 'block';

const SEG_PAD = 5;

/* ───────── Quick-book sheet ─────────
 * Opened by releasing the hold-to-scrub gesture (or tapping a free slot) on the
 * instructor home. Hosts the SAME complete forms as the dedicated routes —
 * <BookingForm> / <BlockForm>, embedded — under an Airbnb segmented control
 * (mirrors `availability-exception.tsx`). The parent (IstruttoreHomeScreen)
 * seeds bookingSheetStore + blockSheetStore with the preset start time. */
export default function QuickBookScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('lesson');

  // Airbnb segmented — sliding white pill (same logic as availability-exception).
  const [tabsW, setTabsW] = useState(0);
  const pillW = tabsW ? (tabsW - SEG_PAD * 2) / 2 : 0;
  const pillX = useSharedValue(0);
  const tabIdx = mode === 'lesson' ? 0 : 1;
  useEffect(() => {
    if (!pillW) return;
    pillX.value = withTiming(tabIdx * pillW, { duration: 220 });
  }, [tabIdx, pillW, pillX]);
  const pillStyle = useAnimatedStyle(() => ({ transform: [{ translateX: pillX.value }] }));

  return (
    <View style={s.root}>
      <View style={s.topbar}>
        <View style={s.seg} onLayout={(e) => setTabsW(e.nativeEvent.layout.width)}>
          {pillW > 0 && <Animated.View style={[s.segPill, { width: pillW }, pillStyle]} />}
          <Pressable onPress={() => setMode('lesson')} style={s.segItem} hitSlop={6}>
            <Text style={[s.segText, mode === 'lesson' && s.segTextActive]}>Prenota guida</Text>
          </Pressable>
          <Pressable onPress={() => setMode('block')} style={s.segItem} hitSlop={6}>
            <Text style={[s.segText, mode === 'block' && s.segTextActive]}>Blocca slot</Text>
          </Pressable>
        </View>
        <Pressable onPress={() => router.back()} hitSlop={10} style={({ pressed }) => [s.x, pressed && { opacity: 0.5 }]}>
          <Ionicons name="close" size={20} color="#1A1A2E" />
        </Pressable>
      </View>

      {mode === 'lesson' ? <BookingForm embedded /> : <BlockForm embedded />}
    </View>
  );
}

const s = StyleSheet.create({
  // No flex:1 — the formSheet uses fitToContents, so the root must hug its content.
  root: { backgroundColor: colors.background, paddingTop: 14 },
  topbar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: spacing.lg, paddingBottom: 12 },

  /* Airbnb segmented control (= availability-exception.tsx) */
  seg: { flex: 1, flexDirection: 'row', backgroundColor: '#EBEBEB', borderRadius: 999, padding: SEG_PAD, position: 'relative' },
  segPill: {
    position: 'absolute', top: SEG_PAD, bottom: SEG_PAD, left: SEG_PAD, borderRadius: 999, backgroundColor: '#FFFFFF',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.12, shadowRadius: 4, elevation: 2,
  },
  segItem: { flex: 1, paddingVertical: 11, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  segText: { fontSize: 15, fontWeight: '600', color: '#717171', letterSpacing: -0.2 },
  segTextActive: { color: '#1A1A2E', fontWeight: '700' },

  x: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#F1F2F4', alignItems: 'center', justifyContent: 'center' },
});
