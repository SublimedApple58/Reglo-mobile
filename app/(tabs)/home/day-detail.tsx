import React, { useSyncExternalStore } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { dayDetailStore } from '../../../src/stores/dayDetailStore';
import { DayItinerary } from '../../../src/components/DayItinerary';
import { ScrubBubble } from '../../../src/components/BookableBand';
import { daySummary } from '../../../src/utils/weeklyAgenda';
import { colors } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';

const WEEKDAYS_FULL = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'] as const;
const MONTHS_FULL = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'] as const;

export default function DayDetailScreen() {
  const router = useRouter();
  const data = useSyncExternalStore(dayDetailStore.subscribe, dayDetailStore.get);

  if (!data) return <View style={s.root} />;

  const { date, plan } = data;
  const title = `${WEEKDAYS_FULL[date.getDay()]} ${date.getDate()} ${MONTHS_FULL[date.getMonth()]}`;

  // Actions dismiss this sheet first, then run — so we never stack a stale day
  // sheet under the quick-book / lesson routes.
  const closeThen = (fn: () => void) => { router.back(); setTimeout(fn, 280); };

  // GestureHandlerRootView is required for the BookableBand hold-to-scrub gesture
  // to work: a native modal route is presented outside the app's root handler.
  return (
    <GestureHandlerRootView style={s.root}>
      <View style={s.topBar}>
        <View style={{ flex: 1 }}>
          <Text style={s.title} numberOfLines={1}>{title}</Text>
          <Text style={s.subtitle} numberOfLines={1}>{daySummary(plan)}</Text>
        </View>
        <Pressable onPress={() => router.back()} hitSlop={8} style={s.closeBtn}>
          <Ionicons name="close" size={20} color="#1A1A2E" />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        <DayItinerary
          plan={plan}
          onQuickBook={(min, ws, we) => closeThen(() => data.onQuickBook(date, min, ws, we))}
          onOpenLesson={(a) => closeThen(() => data.onOpenLesson(a))}
          onOpenExam={(appts) => closeThen(() => data.onOpenExam(appts))}
          onOpenBlock={(b) => closeThen(() => data.onOpenBlock(b))}
        />
      </ScrollView>

      {/* Scrub bubble follows the finger during hold-to-book, above the sheet. */}
      <ScrubBubble />
    </GestureHandlerRootView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: spacing.lg, paddingTop: 18, paddingBottom: 12 },
  title: { fontSize: 20, fontWeight: '700', color: '#1A1A2E', letterSpacing: -0.4 },
  subtitle: { fontSize: 13, fontWeight: '500', color: '#9CA3AF', marginTop: 2 },
  closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: 40 },
});
