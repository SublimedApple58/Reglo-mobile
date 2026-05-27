import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '../components/Screen';
import { colors, pink } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { regloApi } from '../services/regloApi';
import type { QuizChapterSchedeProgress } from '../types/regloApi';

export const TopicListScreen: React.FC = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [chapters, setChapters] = useState<QuizChapterSchedeProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await regloApi.getChaptersWithSchedeProgress();
      setChapters(data);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const totalSchede = chapters.reduce((s, c) => s + c.totalSchede, 0);
  const totalCompleted = chapters.reduce((s, c) => s + c.completedSchede, 0);

  const renderItem = ({ item, index }: { item: QuizChapterSchedeProgress; index: number }) => {
    const pct = item.totalSchede > 0
      ? Math.round((item.completedSchede / item.totalSchede) * 100) : 0;

    return (
      <Animated.View entering={FadeInDown.delay(index * 30).duration(250)}>
        <Pressable
          onPress={() =>
            router.push({
              pathname: '/(tabs)/home/scheda-grid',
              params: { chapterId: item.id },
            } as never)
          }
          style={({ pressed }) => [st.card, pressed && st.cardPressed]}
        >
          <View style={st.cardRow}>
            <View style={st.badge}>
              <Text style={st.badgeText}>{item.chapterNumber}</Text>
            </View>
            <View style={st.cardContent}>
              <Text style={st.cardTitle} numberOfLines={2}>{item.description}</Text>
              <Text style={st.cardSub}>
                {item.completedSchede} / {item.totalSchede} schede completate
              </Text>
              {/* Progress bar */}
              <View style={st.barTrack}>
                <View style={[st.barFill, { width: `${pct}%` }]} />
              </View>
            </View>
            {item.correctRate > 0 && (
              <Text style={[st.rateBadge, item.correctRate >= 70 ? st.rateGood : st.rateLow]}>
                {item.correctRate}%
              </Text>
            )}
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </View>
        </Pressable>
      </Animated.View>
    );
  };

  if (loading) {
    return (
      <Screen gradient>
        <View style={st.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen gradient>
      <View style={[st.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={14} style={st.backBtn}>
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        </Pressable>
        <View style={st.headerTextWrap}>
          <Text style={st.headerTitle}>Studio per Argomento</Text>
          <Text style={st.headerSub}>
            {totalCompleted}/{totalSchede} schede completate
          </Text>
        </View>
      </View>

      <FlatList
        data={chapters}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={st.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={colors.primary}
          />
        }
      />
    </Screen>
  );
};

const st = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center',
  },
  headerTextWrap: { flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.3 },
  headerSub: { fontSize: 13, fontWeight: '500', color: colors.textSecondary, marginTop: 2 },
  list: { padding: spacing.md, gap: 10, paddingBottom: 120 },
  card: {
    backgroundColor: colors.surface, borderRadius: 20, padding: spacing.md,
    shadowColor: 'rgba(0,0,0,0.08)', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1, shadowRadius: 10, elevation: 3,
  },
  cardPressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  badge: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: pink[50], alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { fontSize: 14, fontWeight: '800', color: pink[500] },
  cardContent: { flex: 1, gap: 4 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, lineHeight: 18 },
  cardSub: { fontSize: 12, fontWeight: '500', color: colors.textSecondary },
  barTrack: {
    height: 4, borderRadius: 2, backgroundColor: '#F0F0F5', overflow: 'hidden', marginTop: 2,
  },
  barFill: { height: '100%', borderRadius: 2, backgroundColor: colors.primary },
  rateBadge: {
    fontSize: 13, fontWeight: '800', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8,
  },
  rateGood: { backgroundColor: '#DCFCE7', color: '#16A34A' },
  rateLow: { backgroundColor: '#FEF3C7', color: '#CA8A04' },
});

export default TopicListScreen;
