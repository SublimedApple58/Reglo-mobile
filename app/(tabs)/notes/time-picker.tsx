import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { timePickerStore } from '../../../src/stores/timePickerStore';
import { colors } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 15, 30, 45];
const ITEM_HEIGHT = 46;
const COLUMN_HEIGHT = 218;

const padTwo = (n: number) => String(n).padStart(2, '0');
const closestMinute = (m: number) =>
  MINUTES.reduce((prev, curr) => (Math.abs(curr - m) < Math.abs(prev - m) ? curr : prev));

export default function NotesTimePickerScreen() {
  const router = useRouter();
  const data = useSyncExternalStore(timePickerStore.subscribe, timePickerStore.get);

  const [hour, setHour] = useState(() => data?.selectedTime.getHours() ?? 9);
  const [minute, setMinute] = useState(() => closestMinute(data?.selectedTime.getMinutes() ?? 0));

  const hourScrollRef = useRef<ScrollView | null>(null);
  const minuteScrollRef = useRef<ScrollView | null>(null);

  useEffect(() => {
    return () => { timePickerStore.clear(); };
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      hourScrollRef.current?.scrollTo({
        y: Math.max(0, HOURS.indexOf(hour) * ITEM_HEIGHT - COLUMN_HEIGHT / 2 + ITEM_HEIGHT / 2),
        animated: false,
      });
      minuteScrollRef.current?.scrollTo({
        y: Math.max(0, MINUTES.indexOf(minute) * ITEM_HEIGHT - COLUMN_HEIGHT / 2 + ITEM_HEIGHT / 2),
        animated: false,
      });
    }, 60);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!data) return <View style={s.root} />;

  const confirm = () => {
    const result = new Date(data.selectedTime);
    result.setHours(hour, minute, 0, 0);
    const onConfirm = data.onConfirm;
    router.back();
    setTimeout(() => onConfirm(result), 250);
  };

  return (
    <View style={s.root}>
      <Text style={s.title}>Seleziona orario</Text>

      <View style={s.columnsRow}>
        <View style={s.column}>
          <Text style={s.columnLabel}>Ore</Text>
          <View style={s.scrollContainer}>
            <ScrollView ref={hourScrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent}>
              {HOURS.map((h) => {
                const selected = h === hour;
                return (
                  <Pressable key={h} onPress={() => setHour(h)} style={[s.item, selected && s.itemSelected]}>
                    <Text style={[s.itemText, selected && s.itemTextSelected]}>{padTwo(h)}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>

        <View style={s.column}>
          <Text style={s.columnLabel}>Minuti</Text>
          <View style={s.scrollContainer}>
            <ScrollView ref={minuteScrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent}>
              {MINUTES.map((m) => {
                const selected = m === minute;
                return (
                  <Pressable key={m} onPress={() => setMinute(m)} style={[s.item, selected && s.itemSelected]}>
                    <Text style={[s.itemText, selected && s.itemTextSelected]}>{padTwo(m)}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </View>

      <Pressable
        onPress={confirm}
        style={({ pressed }) => [s.cta, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
      >
        <Text style={s.ctaText}>Conferma {padTwo(hour)}:{padTwo(minute)}</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  root: { backgroundColor: colors.background, paddingTop: 20, paddingHorizontal: spacing.lg, paddingBottom: 28, gap: 18 },
  title: { fontSize: 20, fontWeight: '700', color: '#1A1A2E', letterSpacing: -0.3 },

  columnsRow: { flexDirection: 'row', gap: spacing.md, justifyContent: 'center' },
  column: { flex: 1, alignItems: 'center', gap: 8 },
  columnLabel: { fontSize: 12, fontWeight: '700', color: '#94A3B8', letterSpacing: 0.5, textTransform: 'uppercase' },
  scrollContainer: { height: COLUMN_HEIGHT, width: '100%', borderRadius: 18, backgroundColor: '#F8FAFC', overflow: 'hidden' },
  scrollContent: { paddingVertical: 8, alignItems: 'center' },
  item: { height: ITEM_HEIGHT, width: '82%', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  itemSelected: { backgroundColor: '#E9EBF2' },
  itemText: { fontSize: 18, fontWeight: '500', color: '#64748B' },
  itemTextSelected: { fontWeight: '700', color: '#14141F' },

  cta: {
    height: 54, borderRadius: 27, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3, shadowRadius: 14, elevation: 6,
  },
  ctaText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.2 },
});
