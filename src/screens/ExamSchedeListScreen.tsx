import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
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
import { useQuiz } from '../context/QuizContext';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { regloApi } from '../services/regloApi';
import type { ExamSchedeProgressResponse, QuizSchedaSummary } from '../types/regloApi';

/* eslint-disable @typescript-eslint/no-var-requires */
const iconAccuracy = require('../../assets/icons/stat-accuracy.png');
const iconQuizzes = require('../../assets/icons/stat-quizzes.png');
const iconTopics = require('../../assets/icons/stat-topics.png');
/* eslint-enable @typescript-eslint/no-var-requires */

const { width: SCREEN_W } = Dimensions.get('window');
const GRID_COLS = 4;
const GRID_GAP = 10;
const TILE_W = (SCREEN_W - spacing.md * 2 - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS;
const TILE_H = TILE_W * 1.3;
const COMPACT_H = 44;
const SCROLL_RANGE = 70;

const STATUS_THEME = {
  not_started: { bg: '#F3F4F6', accent: '#9CA3AF', border: '#E5E7EB', lines: '#D1D5DB' },
  in_progress: { bg: '#FEF9C3', accent: '#CA8A04', border: '#FDE68A', lines: '#FCD34D' },
  passed: { bg: '#DCFCE7', accent: '#16A34A', border: '#BBF7D0', lines: '#86EFAC' },
  failed: { bg: '#FEE2E2', accent: '#EF4444', border: '#FECACA', lines: '#FCA5A5' },
} as const;

export const ExamSchedeListScreen: React.FC = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { startSession } = useQuiz();
  const [data, setData] = useState<ExamSchedeProgressResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [starting, setStarting] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await regloApi.getExamSchedeProgress();
      setData(res);
    } catch { /* silent */ } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleTap = async (scheda: QuizSchedaSummary) => {
    if (starting) return;
    if (scheda.status === 'passed') {
      if (scheda.sessionId) {
        router.push({ pathname: '/(tabs)/home/quiz-results', params: { sessionId: scheda.sessionId } } as never);
      }
      return;
    }
    setStarting(scheda.id);
    try {
      const res = await regloApi.startExamSchedaSession(scheda.id);
      startSession({
        sessionId: res.sessionId, questions: res.questions, mode: 'SCHEDA_ESAME',
        timeLimitSec: res.timeLimitSec, schedaNumber: res.schedaNumber, schedaId: scheda.id,
      });
      router.push('/(tabs)/home/quiz-session' as never);
    } catch { /* silent */ } finally { setStarting(null); }
  };

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

  if (loading) {
    return <View style={[st.root, { paddingTop: headerH }]}><View style={st.center}><ActivityIndicator size="large" color={colors.primary} /></View></View>;
  }

  if (!data) {
    return (
      <View style={[st.root, { paddingTop: headerH }]}>
        <View style={st.center}>
          <Text style={st.emptyText}>Nessuna scheda trovata</Text>
          <Pressable style={st.emptyBtn} onPress={() => router.back()}>
            <Text style={st.emptyBtnText}>Indietro</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const { schede, summary } = data;

  return (
    <View style={st.root}>
      {/* ── Sticky blur header ── */}
      <View style={[st.headerWrap, { height: headerH, paddingTop: insets.top }]}>
        {Platform.OS === 'ios' ? (
          <BlurView intensity={80} tint="systemChromeMaterialLight" style={StyleSheet.absoluteFill} />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(248,247,244,0.95)' }]} />
        )}
        <Animated.View style={[StyleSheet.absoluteFill, st.headerBorder, borderStyle]} />
        <View style={st.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={14} style={st.backBtn}>
            <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
          </Pressable>
          <Animated.Text style={[st.compactTitle, compactStyle]} numberOfLines={1}>
            Schede d'Esame
          </Animated.Text>
          <View style={{ width: 36 }} />
        </View>
      </View>

      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[st.scroll, { paddingTop: headerH }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} progressViewOffset={headerH} />
        }
      >
        {/* ── Large title ── */}
        <Animated.View style={largeTitleStyle}>
          <Text style={st.largeTitle}>Schede d'Esame</Text>
          <Text style={st.largeSub}>Simula l'esame di teoria</Text>
        </Animated.View>

        {/* ── Stats inset card ── */}
        <Animated.View entering={FadeIn.duration(250)} style={st.statsInset}>
          <View style={st.statsInner}>
            <View style={st.statItem}>
              <Image source={iconQuizzes} style={st.statIcon} />
              <Text style={st.statValue}>{summary.completedCount}/{summary.totalSchede}</Text>
              <Text style={st.statLabel}>Schede</Text>
            </View>
            <View style={st.statDivider} />
            <View style={st.statItem}>
              <Image source={iconTopics} style={st.statIcon} />
              <Text style={st.statValue}>{summary.passedCount}</Text>
              <Text style={st.statLabel}>Superate</Text>
            </View>
            {summary.correctRate > 0 && (
              <>
                <View style={st.statDivider} />
                <View style={st.statItem}>
                  <Image source={iconAccuracy} style={st.statIcon} />
                  <Text style={st.statValue}>{summary.correctRate}%</Text>
                  <Text style={st.statLabel}>Correttezza</Text>
                </View>
              </>
            )}
          </View>
        </Animated.View>

        {/* ── Schede grid ── */}
        <Text style={st.sectionTitle}>Schede</Text>
        <View style={st.grid}>
          {schede.map((scheda, i) => {
            const th = STATUS_THEME[scheda.status];
            const isStarting = starting === scheda.id;
            return (
              <Animated.View key={scheda.id} entering={FadeInDown.delay(i * 15).duration(200)}>
                <Pressable
                  onPress={() => handleTap(scheda)}
                  disabled={isStarting}
                  style={({ pressed }) => [
                    st.tile, { backgroundColor: th.bg, borderColor: th.border },
                    pressed && st.tilePressed,
                  ]}
                >
                  {isStarting ? (
                    <ActivityIndicator size="small" color={th.accent} />
                  ) : (
                    <>
                      <Text style={[st.tileLabel, { color: th.accent }]}>Scheda</Text>
                      <Text style={[st.tileNum, { color: th.accent }]}>{scheda.schedaNumber}</Text>
                      <View style={st.tileLines}>
                        {[0, 1, 2].map((j) => (
                          <View key={j} style={[st.tileLine, { backgroundColor: th.lines }]} />
                        ))}
                      </View>
                      {scheda.status === 'passed' && (
                        <View style={[st.tileBadge, { backgroundColor: '#16A34A' }]}>
                          <Ionicons name="checkmark" size={10} color="#FFFFFF" />
                        </View>
                      )}
                      {scheda.status === 'failed' && (
                        <View style={[st.tileBadge, { backgroundColor: '#EF4444' }]}>
                          <Text style={st.tileBadgeText}>{scheda.errorCount}</Text>
                        </View>
                      )}
                      {scheda.status === 'in_progress' && (
                        <View style={[st.tileBadge, { backgroundColor: '#CA8A04' }]}>
                          <Ionicons name="play" size={8} color="#FFFFFF" />
                        </View>
                      )}
                    </>
                  )}
                </Pressable>
              </Animated.View>
            );
          })}
        </View>

        <View style={{ height: 100 }} />
      </Animated.ScrollView>
    </View>
  );
};

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { fontSize: 15, fontWeight: '500', color: colors.textSecondary },
  emptyBtn: { paddingVertical: 10, paddingHorizontal: 24, borderRadius: 12, backgroundColor: '#F3F4F6' },
  emptyBtnText: { fontSize: 14, fontWeight: '600', color: colors.primary },

  /* Header */
  headerWrap: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  headerBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  headerRow: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  compactTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600', color: colors.textPrimary },

  /* Large title */
  largeTitle: { fontSize: 24, fontWeight: '800', color: '#1A1A2E', letterSpacing: -0.3 },
  largeSub: { fontSize: 13, fontWeight: '500', color: colors.textSecondary, marginTop: 4, marginBottom: 16 },

  /* Scroll */
  scroll: { paddingHorizontal: spacing.md, gap: spacing.md, paddingBottom: 20 },

  /* Stats inset card */
  statsInset: {
    backgroundColor: '#EEEDEB', borderRadius: 20,
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

  /* Section */
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginTop: 4 },

  /* Grid */
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
  tile: {
    width: TILE_W, height: TILE_H,
    borderRadius: 18, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center', gap: 2,
    position: 'relative',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1, shadowRadius: 5, elevation: 3,
  },
  tilePressed: { opacity: 0.8, transform: [{ scale: 0.95 }] },
  tileLabel: { fontSize: 8, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', opacity: 0.7 },
  tileNum: { fontSize: 22, fontWeight: '800', marginTop: -2 },
  tileLines: { gap: 4, marginTop: 4, alignItems: 'center' },
  tileLine: { width: TILE_W * 0.5, height: 2, borderRadius: 1 },
  tileBadge: {
    position: 'absolute', top: 4, right: 4,
    width: 18, height: 18, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
  },
  tileBadgeText: { fontSize: 9, fontWeight: '800', color: '#FFFFFF' },
});

export default ExamSchedeListScreen;
