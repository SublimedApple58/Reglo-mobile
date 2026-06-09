import React, { useCallback, useRef, useSyncExternalStore } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { dayPickerStore } from '../../../src/stores/dayPickerStore';
import {
  ScrollableMonthsCalendar,
  CALENDAR_WEEKDAYS,
} from '../../../src/components/ScrollableMonthsCalendar';
import { colors } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';

const pad = (n: number) => String(n).padStart(2, '0');
const todayString = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export default function SelectDateScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const data = useSyncExternalStore(dayPickerStore.subscribe, dayPickerStore.get);

  // Auto-scroll so the selected day sits centered vertically when the sheet opens.
  const scrollRef = useRef<ScrollView>(null);
  const viewportH = useRef(0);
  const targetCenterY = useRef<number | null>(null);
  const didScroll = useRef(false);

  const maybeScroll = useCallback(() => {
    if (didScroll.current) return;
    if (viewportH.current <= 0 || targetCenterY.current == null) return;
    didScroll.current = true;
    const y = Math.max(0, targetCenterY.current - viewportH.current / 2);
    scrollRef.current?.scrollTo({ y, animated: false });
  }, []);

  const onMeasureSelected = useCallback((centerY: number) => {
    targetCenterY.current = centerY;
    maybeScroll();
  }, [maybeScroll]);

  if (!data) return <View style={s.root} />;

  const pick = (date: string) => {
    data.onSelect(date);
    router.back();
  };

  return (
    <View style={s.root}>
      <View style={s.topBar}>
        <Pressable onPress={() => pick(todayString())} hitSlop={8} style={s.todayBtn}>
          <Text style={s.todayText}>Oggi</Text>
        </Pressable>
        <Text style={s.title}>{data.title ?? 'Seleziona data'}</Text>
        <Pressable onPress={() => router.back()} hitSlop={8} style={s.closeBtn}>
          <Ionicons name="close" size={20} color="#1A1A2E" />
        </Pressable>
      </View>

      <View style={s.weekRow}>
        {CALENDAR_WEEKDAYS.map((w, i) => (
          <Text key={`wd-${i}`} style={s.weekLabel}>{w}</Text>
        ))}
      </View>

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        onLayout={(e) => { viewportH.current = e.nativeEvent.layout.height; maybeScroll(); }}
      >
        <ScrollableMonthsCalendar
          selectedDate={data.selectedDate}
          onSelectDate={pick}
          markedDates={data.markedDates}
          monthsBack={data.monthsBack}
          monthsCount={data.monthsCount}
          allowPast={data.allowPast}
          hideWeekHeader
          onMeasureSelected={onMeasureSelected}
        />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, paddingTop: 14, paddingHorizontal: spacing.lg },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  title: { fontSize: 17, fontWeight: '700', color: '#1A1A2E', letterSpacing: -0.3 },
  todayBtn: { minWidth: 52, paddingVertical: 6 },
  todayText: { fontSize: 15, fontWeight: '600', color: '#1A1A2E' },
  closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
  weekRow: { flexDirection: 'row', paddingBottom: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#EBEDF0' },
  weekLabel: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '600', color: '#9AA1AC' },
});
