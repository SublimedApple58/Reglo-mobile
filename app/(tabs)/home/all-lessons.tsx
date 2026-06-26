import React, { useEffect, useSyncExternalStore } from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SheetScaffold } from '../../../src/components/SheetScaffold';
import { allLessonsStore } from '../../../src/stores/allLessonsStore';
import { formatDay, formatTime } from '../../../src/utils/date';
import { lessonArtSource } from '../../../src/utils/lessonArt';
import { colors } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';

const CARD_COLORS = [
  { bg: '#F4F5F9', accent: '#1A1A2E' },
  { bg: '#EFF6FF', accent: '#3B82F6' },
  { bg: '#F0FDF4', accent: '#22C55E' },
  { bg: '#FFFBEB', accent: '#F59E0B' },
  { bg: '#F5F3FF', accent: '#8B5CF6' },
] as const;

export default function AllLessonsScreen() {
  const router = useRouter();
  const data = useSyncExternalStore(allLessonsStore.subscribe, allLessonsStore.get);

  useEffect(() => {
    return () => { allLessonsStore.clear(); };
  }, []);

  if (!data) return <View style={s.root} />;

  const { lessons, onOpenDetail } = data;

  return (
    <View style={[s.root, Platform.OS === 'android' && { flex: 1 }]}>
      <View style={s.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={s.closeBtn}>
          <Ionicons name="close" size={20} color="#1A1A2E" />
        </Pressable>
      </View>
      <View style={s.header}>
        <Text style={s.title}>Le tue guide</Text>
        <Text style={s.subtitle}>{lessons.length} {lessons.length === 1 ? 'guida' : 'guide'} in programma</Text>
      </View>

      <SheetScaffold>
      <View style={s.list}>
        {lessons.map((lesson, idx) => {
          const bg = CARD_COLORS[idx % CARD_COLORS.length];
          return (
            <Pressable
              key={lesson.id}
              onPress={() => { router.back(); setTimeout(() => onOpenDetail(lesson), 350); }}
              style={({ pressed }) => [s.card, { backgroundColor: bg.bg }, pressed && { opacity: 0.9, transform: [{ scale: 0.97 }] }]}
            >
              <Image
                source={lessonArtSource(lesson.vehicle?.licenseCategory)}
                style={s.cardIcon}
              />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.cardTime} numberOfLines={1}>
                  {formatTime(lesson.startsAt)}{lesson.endsAt ? ` \u2013 ${formatTime(lesson.endsAt)}` : ''}
                </Text>
                <Text style={s.cardDate} numberOfLines={1}>
                  {formatDay(lesson.startsAt)}
                </Text>
                <Text style={s.cardInstructor} numberOfLines={1}>
                  {lesson.instructor?.name ?? 'Da assegnare'}
                </Text>
              </View>
              <View style={[s.cardArrow, { backgroundColor: bg.accent }]}>
                <Ionicons name="chevron-forward" size={14} color="#FFF" />
              </View>
            </Pressable>
          );
        })}
      </View>
      </SheetScaffold>
    </View>
  );
}

const s = StyleSheet.create({
  root: { backgroundColor: colors.background, paddingTop: 20 },
  topBar: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: spacing.md, marginBottom: -8 },
  closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: spacing.md, marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '600', color: '#1A1A2E', letterSpacing: -0.3 },
  subtitle: { fontSize: 13, fontWeight: '500', color: colors.textMuted, marginTop: 4 },
  list: { paddingHorizontal: spacing.md, paddingBottom: 40, gap: 10 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: 22, padding: 14, paddingRight: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.10, shadowRadius: 6, elevation: 4,
  },
  cardIcon: { width: 38, height: 38 },
  cardTime: { fontSize: 17, fontWeight: '800', color: '#1A1A2E', letterSpacing: -0.3 },
  cardDate: { fontSize: 12, fontWeight: '500', color: colors.textMuted, marginTop: 1 },
  cardInstructor: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginTop: 2 },
  cardArrow: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
});
