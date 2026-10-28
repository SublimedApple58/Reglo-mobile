import React, { useCallback, useRef, useSyncExternalStore } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { dayPickerStore } from '../../../src/stores/dayPickerStore';
import {
  ScrollableMonthsCalendar,
  CALENDAR_WEEKDAYS,
} from '../../../src/components/ScrollableMonthsCalendar';
import { FormSheet } from '../../../src/components/SheetScaffold';
import { CLAY } from '../../../src/theme/clay';

const pad = (n: number) => String(n).padStart(2, '0');
const todayString = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/**
 * Scelta di un giorno — REG-639 clay: il form sheet unico, che scorre da sé
 * (niente scroll interna). I mesi stanno uno sotto l'altro; all'apertura il
 * foglio scorre in modo che il giorno scelto stia al centro. Tocco = sceglie
 * e chiude.
 */
export default function SelectDateScreen() {
  const router = useRouter();
  const data = useSyncExternalStore(dayPickerStore.subscribe, dayPickerStore.get);

  // Auto-scroll: centro del giorno scelto (nel calendario) + posizione del
  // calendario nel foglio + altezza visibile del foglio → scrollTo una volta.
  const scrollRef = useRef<ScrollView>(null);
  const calRef = useRef<View>(null);
  const viewportH = useRef(0);
  const calendarTop = useRef<number | null>(null);
  const targetCenterY = useRef<number | null>(null);
  const didScroll = useRef(false);

  const maybeScroll = useCallback(() => {
    if (didScroll.current) return;
    if (viewportH.current <= 0 || targetCenterY.current == null || calendarTop.current == null) return;
    didScroll.current = true;
    const y = Math.max(0, calendarTop.current + targetCenterY.current - viewportH.current / 2);
    scrollRef.current?.scrollTo({ y, animated: false });
  }, []);

  const measureCalendar = useCallback(() => {
    // `getInnerViewRef` esiste in RN 0.81 ma manca nei tipi.
    const inner = (scrollRef.current as unknown as { getInnerViewRef?: () => View | null } | null)?.getInnerViewRef?.();
    if (!inner || !calRef.current) return;
    calRef.current.measureLayout(inner, (_x, y) => {
      calendarTop.current = y;
      maybeScroll();
    });
  }, [maybeScroll]);

  const onMeasureSelected = useCallback((centerY: number) => {
    targetCenterY.current = centerY;
    maybeScroll();
  }, [maybeScroll]);

  if (!data) return <View style={s.empty} />;

  const pick = (date: string) => {
    data.onSelect(date);
    router.back();
  };

  return (
    <FormSheet
      title={data.title ?? 'Seleziona data'}
      testID="select-date-sheet"
      scrollProps={{
        // Il ref arriva allo ScrollView radice del foglio (React 19: ref come prop).
        ...({ ref: scrollRef } as object),
        onLayout: (e) => { viewportH.current = e.nativeEvent.layout.height; maybeScroll(); },
      }}
    >
      <View style={s.todayRow}>
        <Pressable
          onPress={() => pick(todayString())}
          hitSlop={10}
          accessibilityRole="button"
          testID="select-date-today"
          style={({ pressed }) => pressed && { opacity: 0.55 }}
        >
          <Text style={s.todayText}>Oggi</Text>
        </Pressable>
      </View>

      <View style={s.weekRow}>
        {CALENDAR_WEEKDAYS.map((w, i) => (
          <Text key={`wd-${i}`} style={s.weekLabel}>{w}</Text>
        ))}
      </View>

      <View ref={calRef} onLayout={measureCalendar}>
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
      </View>
    </FormSheet>
  );
}

const s = StyleSheet.create({
  empty: { backgroundColor: '#FFFFFF', height: 1 },
  todayRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: -6, marginBottom: 10 },
  todayText: { fontSize: 15, fontWeight: '600', color: CLAY.ink },
  weekRow: { flexDirection: 'row', paddingBottom: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: CLAY.hairline },
  weekLabel: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '600', color: CLAY.ink3 },
});
