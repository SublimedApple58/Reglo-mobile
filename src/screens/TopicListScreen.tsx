import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
} from 'react-native';
import Animated, {
  Extrapolation,
  FadeIn,
  FadeInDown,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { regloApi } from '../services/regloApi';
import type { QuizChapterSchedeProgress } from '../types/regloApi';

/* eslint-disable @typescript-eslint/no-var-requires */
const CHAPTER_ICONS: Record<number, ReturnType<typeof require>> = {
  1: require('../../assets/icons/chapters/chapter-01.png'),
  2: require('../../assets/icons/chapters/chapter-02.png'),
  3: require('../../assets/icons/chapters/chapter-03.png'),
  4: require('../../assets/icons/chapters/chapter-04.png'),
  5: require('../../assets/icons/chapters/chapter-05.png'),
  6: require('../../assets/icons/chapters/chapter-06.png'),
  7: require('../../assets/icons/chapters/chapter-07.png'),
  8: require('../../assets/icons/chapters/chapter-08.png'),
  9: require('../../assets/icons/chapters/chapter-09.png'),
  10: require('../../assets/icons/chapters/chapter-10.png'),
  11: require('../../assets/icons/chapters/chapter-11.png'),
  12: require('../../assets/icons/chapters/chapter-12.png'),
  13: require('../../assets/icons/chapters/chapter-13.png'),
  14: require('../../assets/icons/chapters/chapter-14.png'),
  15: require('../../assets/icons/chapters/chapter-15.png'),
  16: require('../../assets/icons/chapters/chapter-16.png'),
  17: require('../../assets/icons/chapters/chapter-17.png'),
  18: require('../../assets/icons/chapters/chapter-18.png'),
  19: require('../../assets/icons/chapters/chapter-19.png'),
  20: require('../../assets/icons/chapters/chapter-20.png'),
  21: require('../../assets/icons/chapters/chapter-21.png'),
  22: require('../../assets/icons/chapters/chapter-22.png'),
  23: require('../../assets/icons/chapters/chapter-23.png'),
  24: require('../../assets/icons/chapters/chapter-24.png'),
  25: require('../../assets/icons/chapters/chapter-25.png'),
};
const iconAccuracy = require('../../assets/icons/stat-accuracy.png');
const iconQuizzes = require('../../assets/icons/stat-quizzes.png');
const iconTopics = require('../../assets/icons/stat-topics.png');
/* eslint-enable @typescript-eslint/no-var-requires */

const COMPACT_H = 44;
const SCROLL_RANGE = 70;

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

  const totalSchede = chapters.reduce((sum, c) => sum + c.totalSchede, 0);
  const totalCompleted = chapters.reduce((sum, c) => sum + c.completedSchede, 0);
  const totalPassed = chapters.reduce((sum, c) => sum + c.passedSchede, 0);
  const globalCorrectRate = (() => {
    const withRate = chapters.filter((c) => c.correctRate > 0);
    if (withRate.length === 0) return 0;
    return Math.round(withRate.reduce((sum, c) => sum + c.correctRate, 0) / withRate.length);
  })();

  /* ── Scroll animation ── */
  const scrollY = useSharedValue(0);
  const headerH = insets.top + COMPACT_H;
  const scrollHandler = useAnimatedScrollHandler({ onScroll: (e) => { scrollY.value = e.contentOffset.y; } });

  const largeTitleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, SCROLL_RANGE * 0.6], [1, 0], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(scrollY.value, [0, SCROLL_RANGE], [0, -10], Extrapolation.CLAMP) }],
  }));
  const compactStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [SCROLL_RANGE * 0.5, SCROLL_RANGE], [0, 1], Extrapolation.CLAMP),
  }));
  const borderStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 20], [0, 1], Extrapolation.CLAMP),
  }));

  const renderItem = ({ item, index }: { item: QuizChapterSchedeProgress; index: number }) => {
    const pct = item.totalSchede > 0 ? Math.round((item.completedSchede / item.totalSchede) * 100) : 0;
    const done = pct === 100;

    return (
      <Animated.View entering={FadeInDown.delay(index * 25).duration(250).springify()}>
        <Pressable
          onPress={() => router.push({ pathname: '/(tabs)/home/scheda-grid', params: { chapterId: item.id } } as never)}
          style={({ pressed }) => [st.card, pressed && st.cardPressed]}
        >
          <View style={st.cardTop}>
            <View style={st.iconWrap}>
              {CHAPTER_ICONS[item.chapterNumber] ? (
                <Image source={CHAPTER_ICONS[item.chapterNumber]} style={st.icon3d} />
              ) : (
                <View style={st.badge}>
                  <Text style={st.badgeText}>{item.chapterNumber}</Text>
                </View>
              )}
              {done && (
                <View style={st.doneBadge}>
                  <Ionicons name="checkmark" size={10} color="#FFFFFF" />
                </View>
              )}
            </View>
            <View style={st.cardContent}>
              <Text style={st.chapterNum}>Capitolo {item.chapterNumber}</Text>
              <Text style={st.cardTitle} numberOfLines={2}>{item.description}</Text>
              <View style={st.cardMeta}>
                <Text style={st.cardSub}>{item.completedSchede}/{item.totalSchede} schede</Text>
                {item.correctRate > 0 && (
                  <View style={[st.ratePill, item.correctRate >= 70 ? st.rateGood : st.rateLow]}>
                    <Text style={[st.rateText, item.correctRate >= 70 ? st.rateGoodText : st.rateLowText]}>
                      {item.correctRate}%
                    </Text>
                  </View>
                )}
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </View>
          {/* Progress bar */}
          <View style={st.barTrack}>
            <View style={[st.barFill, { width: `${pct}%` }, done && st.barDone]} />
          </View>
        </Pressable>
      </Animated.View>
    );
  };

  if (loading) {
    return <View style={[st.root, { paddingTop: headerH }]}><View style={st.center}><ActivityIndicator size="large" color={colors.primary} /></View></View>;
  }

  return (
    <View style={st.root}>
      {/* ── Sticky blur header ── */}
      <View style={[st.headerWrap, { height: headerH, paddingTop: insets.top }]}>
        {Platform.OS === 'ios' ? (
          <BlurView intensity={80} tint="systemChromeMaterialLight" style={StyleSheet.absoluteFill} />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(253,253,253,0.95)' }]} />
        )}
        <Animated.View style={[StyleSheet.absoluteFill, st.headerBorder, borderStyle]} />
        <View style={st.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={14} style={st.backBtn}>
            <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
          </Pressable>
          <Animated.Text style={[st.compactTitle, compactStyle]} numberOfLines={1}>
            Studio per Argomento
          </Animated.Text>
          <View style={{ width: 36 }} />
        </View>
      </View>

      <Animated.FlatList
        data={chapters}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[st.list, { paddingTop: headerH }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} progressViewOffset={headerH} />
        }
        ListHeaderComponent={
          <>
            {/* Large title */}
            <Animated.View style={largeTitleStyle}>
              <Text style={st.largeTitle}>Studio per Argomento</Text>
              <Text style={st.largeSub}>{totalCompleted}/{totalSchede} schede completate</Text>
            </Animated.View>

            {/* Stats inset card */}
            {totalCompleted > 0 && (
              <Animated.View entering={FadeIn.duration(250)} style={st.statsInset}>
                <View style={st.statsInner}>
                  <View style={st.statItem}>
                    <Image source={iconQuizzes as ImageSourcePropType} style={st.statIcon} />
                    <Text style={st.statValue}>{totalCompleted}/{totalSchede}</Text>
                    <Text style={st.statLabel}>Schede</Text>
                  </View>
                  <View style={st.statDivider} />
                  <View style={st.statItem}>
                    <Image source={iconTopics as ImageSourcePropType} style={st.statIcon} />
                    <Text style={st.statValue}>{totalPassed}</Text>
                    <Text style={st.statLabel}>Superate</Text>
                  </View>
                  {globalCorrectRate > 0 && (
                    <>
                      <View style={st.statDivider} />
                      <View style={st.statItem}>
                        <Image source={iconAccuracy as ImageSourcePropType} style={st.statIcon} />
                        <Text style={st.statValue}>{globalCorrectRate}%</Text>
                        <Text style={st.statLabel}>Correttezza</Text>
                      </View>
                    </>
                  )}
                </View>
              </Animated.View>
            )}
          </>
        }
      />
    </View>
  );
};

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  /* Header */
  headerWrap: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  headerBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  headerRow: {
    flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  compactTitle: {
    flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600', color: colors.textPrimary,
  },

  /* Large title */
  largeTitle: { fontSize: 24, fontWeight: '600', color: '#1A1A2E', letterSpacing: -0.3 },
  largeSub: { fontSize: 14, fontWeight: '500', color: colors.textSecondary, marginTop: 4, marginBottom: 16 },

  /* List */
  list: { paddingHorizontal: spacing.md, gap: 10, paddingBottom: 120 },

  /* Stats inset card */
  statsInset: {
    backgroundColor: colors.background, borderRadius: 20, marginBottom: 8,
    boxShadow: [
      { offsetX: 0, offsetY: 2, blurRadius: 6, spreadDistance: 0, color: 'rgba(0,0,0,0.12)', inset: true },
      { offsetX: 0, offsetY: 1, blurRadius: 2, spreadDistance: 0, color: 'rgba(0,0,0,0.06)', inset: true },
    ],
  },
  statsInner: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 16, paddingHorizontal: 8,
  },
  statItem: { flex: 1, alignItems: 'center', gap: 2 },
  statDivider: { width: StyleSheet.hairlineWidth, height: 36, backgroundColor: colors.border },
  statIcon: { width: 32, height: 32, marginBottom: 2 },
  statValue: { fontSize: 14, fontWeight: '800', color: '#1A1A2E' },
  statLabel: { fontSize: 10, fontWeight: '600', color: colors.textMuted },

  /* Chapter card */
  card: {
    backgroundColor: colors.surface, borderRadius: 26, padding: spacing.md, gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.14, shadowRadius: 6, elevation: 5,
  },
  cardPressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  iconWrap: { position: 'relative' },
  icon3d: { width: 52, height: 52 },
  badge: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#F2F2F2', alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { fontSize: 18, fontWeight: '800', color: colors.textSecondary },
  doneBadge: {
    position: 'absolute', bottom: -2, right: -2,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: '#16A34A', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#FFFFFF',
  },
  cardContent: { flex: 1, gap: 2 },
  chapterNum: { fontSize: 11, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.3 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, lineHeight: 20 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardSub: { fontSize: 12, fontWeight: '500', color: colors.textSecondary },
  ratePill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  rateGood: { backgroundColor: '#DCFCE7' },
  rateLow: { backgroundColor: '#FEF3C7' },
  rateText: { fontSize: 12, fontWeight: '800' },
  rateGoodText: { color: '#16A34A' },
  rateLowText: { color: '#CA8A04' },
  barTrack: { height: 4, borderRadius: 2, backgroundColor: '#F0F0F5', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 2, backgroundColor: colors.primary },
  barDone: { backgroundColor: '#16A34A' },
});

export default TopicListScreen;
