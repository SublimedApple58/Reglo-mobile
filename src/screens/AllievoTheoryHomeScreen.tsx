import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Dimensions, Image, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Extrapolation,
  FadeInUp,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useStudentPhase } from '../hooks/useStudentPhase';
import { useSession } from '../context/SessionContext';
import { useQuiz } from '../context/QuizContext';
import { regloApi } from '../services/regloApi';
import { colors, pink } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import type { QuizChapterProgress, QuizStudentStats } from '../types/regloApi';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const duckTheory = require('../../assets/ducks/duck-step-theory.png');

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const HERO_HEIGHT = Math.min(SCREEN_HEIGHT * 0.50, 450);
const HEADER_BAR_HEIGHT = 56;
const FADE_HEIGHT = 100;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const formatExamDate = (iso: string | null): string | null => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
};

const computeDaysLeft = (iso: string | null): number | null => {
  if (!iso) return null;
  const exam = new Date(iso).getTime();
  if (Number.isNaN(exam)) return null;
  return Math.max(0, Math.ceil((exam - Date.now()) / (1000 * 60 * 60 * 24)));
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export const AllievoTheoryHomeScreen: React.FC = () => {
  const router = useRouter();
  const { user } = useSession();
  const { theoryExamAt } = useStudentPhase();
  const { startSession } = useQuiz();
  const insets = useSafeAreaInsets();

  const firstName = user?.name?.split(' ')[0] ?? 'Ciao';
  const daysLeft = useMemo(() => computeDaysLeft(theoryExamAt), [theoryExamAt]);
  const examDateLabel = useMemo(() => formatExamDate(theoryExamAt), [theoryExamAt]);
  const hasExamDate = daysLeft !== null;

  /* ── Quiz data ─────────────────────────────────────────────────── */

  const [stats, setStats] = useState<QuizStudentStats | null>(null);
  const [chapters, setChapters] = useState<QuizChapterProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [starting, setStarting] = useState<string | null>(null);
  const [modePickerVisible, setModePickerVisible] = useState(false);

  const load = useCallback(async () => {
    try {
      const [c, s] = await Promise.all([regloApi.getQuizChapters(), regloApi.getQuizStudentStats()]);
      setChapters(c);
      setStats(s);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleStart = async (mode: 'EXAM' | 'PRACTICE' | 'REVIEW') => {
    if (starting) return;
    setStarting(mode);
    setModePickerVisible(false);
    try {
      const r = await regloApi.startQuizSession({ mode });
      startSession({ sessionId: r.sessionId, questions: r.questions, mode, timeLimitSec: r.timeLimitSec });
      router.push('/(tabs)/home/quiz-session');
    } catch {
      /* silent */
    } finally {
      setStarting(null);
    }
  };

  const hasErrors = stats && (stats.examsFailed > 0 || stats.weakChapters.length > 0);

  /* ── Scroll-driven animation ─────────────────────────────────── */

  const scrollY = useSharedValue(0);
  const collapsedHeight = insets.top + HEADER_BAR_HEIGHT;
  const scrollRange = HERO_HEIGHT - collapsedHeight;

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => { scrollY.value = e.contentOffset.y; },
  });

  const heroStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(scrollY.value, [0, scrollRange], [0, -scrollRange * 0.5], Extrapolation.CLAMP) },
      { scale: interpolate(scrollY.value, [-100, 0], [1.15, 1], Extrapolation.CLAMP) },
    ],
    opacity: interpolate(scrollY.value, [0, scrollRange * 0.7], [1, 0], Extrapolation.CLAMP),
  }));

  const stickyStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [scrollRange * 0.5, scrollRange * 0.85], [0, 1], Extrapolation.CLAMP),
    transform: [
      { translateY: interpolate(scrollY.value, [scrollRange * 0.5, scrollRange * 0.85], [8, 0], Extrapolation.CLAMP) },
    ],
  }));

  /* ── Render ──────────────────────────────────────────────────── */

  const delay = (base: number) => base; // stagger helper

  return (
    <View style={s.root}>
      <View style={s.rootTopBg} />

      {/* ── Hero ── */}
      <Animated.View style={[s.hero, { height: HERO_HEIGHT, paddingTop: insets.top }, heroStyle]}>
        <LinearGradient colors={['#FAE0EF', '#FAE0EF']} style={StyleSheet.absoluteFill} />
        <Text style={s.heroGreeting}>Ciao, {firstName}</Text>
        <View style={s.heroLabel}>
          <Ionicons name="book-outline" size={12} color={colors.surface} />
          <Text style={s.heroLabelText}>Teoria</Text>
        </View>
        <Image source={duckTheory} style={s.heroImage} resizeMode="contain" accessibilityLabel="Paperotto che studia" />
      </Animated.View>

      {/* ── Scrollable content ── */}
      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.scrollContent, { paddingTop: HERO_HEIGHT - FADE_HEIGHT * 0.3 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />
        }
      >
        {/* ── Sheet ── */}
        <View style={s.sheet}>

          {/* Primary CTA */}
          <Animated.View entering={FadeInUp.delay(delay(0)).duration(280)}>
            <Pressable
              onPress={() => setModePickerVisible(!modePickerVisible)}
              style={({ pressed }) => [s.cta, pressed && s.ctaPressed]}
              accessibilityRole="button"
              accessibilityLabel="Avvia quiz"
            >
              {starting ? (
                <ActivityIndicator size="small" color={colors.surface} />
              ) : (
                <>
                  <Ionicons name="play" size={16} color={colors.surface} />
                  <Text style={s.ctaText}>Avvia quiz</Text>
                </>
              )}
            </Pressable>
          </Animated.View>

          {/* Mode picker (inline, not bottom sheet for simplicity) */}
          {modePickerVisible && !starting && (
            <Animated.View entering={FadeInUp.duration(200)} style={s.modeRow}>
              <Pressable
                onPress={() => handleStart('EXAM')}
                style={({ pressed }) => [s.modeCard, pressed && s.modeCardPressed]}
              >
                <View style={s.modeIconWrap}>
                  <Ionicons name="document-text" size={20} color={colors.surface} />
                </View>
                <Text style={s.modeTitle}>Simulazione</Text>
                <Text style={s.modeSub}>30 domande · 20 min</Text>
              </Pressable>
              <Pressable
                onPress={() => handleStart('PRACTICE')}
                style={({ pressed }) => [s.modeCard, s.modeCardOutline, pressed && s.modeCardPressed]}
              >
                <View style={[s.modeIconWrap, s.modeIconOutline]}>
                  <Ionicons name="school-outline" size={20} color={colors.primary} />
                </View>
                <Text style={[s.modeTitle, { color: colors.textPrimary }]}>Esercitazione</Text>
                <Text style={s.modeSub}>30 domande · no timer</Text>
              </Pressable>
            </Animated.View>
          )}

          {/* Stats row */}
          {stats && !loading && (
            <Animated.View entering={FadeInUp.delay(delay(60)).duration(280)} style={s.statsRow}>
              <View style={s.statPill}>
                <Text style={s.statValue}>{stats.readinessScore}%</Text>
                <Text style={s.statLabel}>Prontezza</Text>
              </View>
              <View style={s.statPill}>
                <Text style={s.statValue}>{stats.totalSessions}</Text>
                <Text style={s.statLabel}>Quiz fatti</Text>
              </View>
              <View style={s.statPill}>
                <Text style={s.statValue}>{stats.examPassRate}%</Text>
                <Text style={s.statLabel}>Successo</Text>
              </View>
            </Animated.View>
          )}

          {/* Loading placeholder for stats */}
          {loading && (
            <View style={s.statsRow}>
              {[0, 1, 2].map((i) => (
                <View key={i} style={[s.statPill, { backgroundColor: '#F1F5F9' }]}>
                  <ActivityIndicator size="small" color={colors.textMuted} />
                </View>
              ))}
            </View>
          )}

          {/* Countdown */}
          {hasExamDate && (
            <Animated.View entering={FadeInUp.delay(delay(120)).duration(280)} style={s.card}>
              <View style={s.countdownRow}>
                <View style={s.countdownIcon}>
                  <Ionicons name="calendar" size={20} color={colors.primary} />
                </View>
                <View style={s.countdownText}>
                  <Text style={s.countdownLabel}>Esame teoria</Text>
                  {examDateLabel && <Text style={s.countdownDate}>{examDateLabel}</Text>}
                </View>
                <View style={s.countdownBadge}>
                  <Text style={s.countdownBadgeNum}>{daysLeft}</Text>
                  <Text style={s.countdownBadgeUnit}>{daysLeft === 1 ? 'giorno' : 'giorni'}</Text>
                </View>
              </View>
            </Animated.View>
          )}

          {/* Section: Studia */}
          <Animated.View entering={FadeInUp.delay(delay(180)).duration(280)}>
            <Text style={s.sectionTitle}>Studia</Text>
            <View style={s.studyRow}>
              {hasErrors && (
                <Pressable
                  onPress={() => handleStart('REVIEW')}
                  disabled={!!starting}
                  style={({ pressed }) => [s.studyCard, pressed && s.studyCardPressed]}
                >
                  <Ionicons name="refresh" size={20} color={colors.primary} />
                  <Text style={s.studyCardTitle}>Rivedi errori</Text>
                  <Text style={s.studyCardSub}>Ripassa le domande sbagliate</Text>
                </Pressable>
              )}
              <Pressable
                onPress={() => router.push('/(tabs)/home/topic-list')}
                style={({ pressed }) => [s.studyCard, pressed && s.studyCardPressed]}
              >
                <Ionicons name="albums" size={20} color={colors.primary} />
                <Text style={s.studyCardTitle}>Studio per Argomento</Text>
                <Text style={s.studyCardSub}>{chapters.length} argomenti</Text>
              </Pressable>
            </View>
          </Animated.View>

          {/* Section: Sessioni recenti */}
          {stats && stats.recentSessions.length > 0 && (
            <Animated.View entering={FadeInUp.delay(delay(240)).duration(280)}>
              <Text style={s.sectionTitle}>Sessioni recenti</Text>
              <View style={s.recentCard}>
                {stats.recentSessions.slice(0, 3).map((ses) => (
                  <Pressable
                    key={ses.id}
                    onPress={() => router.push({ pathname: '/(tabs)/home/quiz-results', params: { sessionId: ses.id } })}
                    style={({ pressed }) => [s.recentRow, pressed && { opacity: 0.5 }]}
                  >
                    <View style={[
                      s.recentDot,
                      ses.passed === true && s.dotGreen,
                      ses.passed === false && s.dotRed,
                      ses.passed == null && s.dotNeutral,
                    ]} />
                    <Text style={s.recentMode}>
                      {ses.mode === 'EXAM' ? 'Simulazione' : ses.mode === 'PRACTICE' ? 'Esercitazione' : ses.mode === 'CHAPTER' ? 'Capitolo' : ses.mode === 'SCHEDA' ? 'Scheda' : 'Ripasso'}
                    </Text>
                    <View style={{ flex: 1 }} />
                    <Text style={s.recentScore}>{ses.correctCount}/{ses.totalQuestions}</Text>
                    {ses.completedAt && (
                      <Text style={s.recentDate}>
                        {new Date(ses.completedAt).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}
                      </Text>
                    )}
                  </Pressable>
                ))}
              </View>
            </Animated.View>
          )}
        </View>

        <View style={s.sheetExtension} />
      </Animated.ScrollView>

      {/* ── Sticky header ── */}
      <Animated.View
        style={[s.stickyHeader, { height: collapsedHeight, paddingTop: insets.top }, stickyStyle]}
        pointerEvents="none"
      >
        <LinearGradient
          colors={[colors.primary, '#DB2777']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={s.stickyContent}>
          <Text style={s.stickyTitle}>Ciao, {firstName}</Text>
          <Text style={s.stickySub}>Teoria</Text>
        </View>
      </Animated.View>
    </View>
  );
};

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  rootTopBg: {
    position: 'absolute', top: 0, left: 0, right: 0,
    height: '75%', backgroundColor: '#FAE0EF',
  },

  /* Hero */
  hero: { position: 'absolute', top: 0, left: 0, right: 0 },
  heroGreeting: {
    fontSize: 27, fontWeight: '800', letterSpacing: -0.3, color: '#FFFFFF',
    paddingHorizontal: spacing.lg + spacing.xs, marginTop: spacing.xs,
    textShadowColor: 'rgba(150, 20, 70, 0.45)',
    textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 12,
  },
  heroLabel: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
    gap: 5, backgroundColor: colors.primary,
    marginLeft: spacing.lg + spacing.xs, marginTop: 6,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
    shadowColor: 'rgba(190, 24, 93, 0.4)',
    shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 8, elevation: 3,
  },
  heroLabelText: { fontSize: 12, fontWeight: '700', color: colors.surface },
  heroImage: { flex: 1, width: '100%', marginTop: -spacing.xxl * 2 },

  /* Scroll */
  scrollContent: { paddingBottom: spacing.md, gap: spacing.md },

  /* Sheet */
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 36, borderTopRightRadius: 36,
    paddingTop: spacing.lg, paddingHorizontal: spacing.md,
    paddingBottom: spacing.xxl * 3, gap: spacing.md,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -16 }, shadowOpacity: 0.9, shadowRadius: 30, elevation: 8,
  },
  sheetExtension: { height: 100, backgroundColor: colors.surface, marginTop: -80 },

  /* CTA */
  cta: {
    height: 52, borderRadius: 26, backgroundColor: colors.primary,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    shadowColor: 'rgba(236, 72, 153, 0.45)',
    shadowOffset: { width: 0, height: 8 }, shadowOpacity: 1, shadowRadius: 18, elevation: 5,
  },
  ctaPressed: { opacity: 0.95, transform: [{ scale: 0.97 }] },
  ctaText: { color: colors.surface, fontSize: 15, fontWeight: '700' },

  /* Mode picker */
  modeRow: { flexDirection: 'row', gap: spacing.sm },
  modeCard: {
    flex: 1, backgroundColor: colors.primary, borderRadius: 24,
    padding: spacing.md, gap: 6, alignItems: 'center',
    shadowColor: 'rgba(236, 72, 153, 0.3)',
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 12, elevation: 3,
  },
  modeCardOutline: {
    backgroundColor: colors.surface, borderWidth: 1.5, borderColor: pink[100],
    shadowColor: 'rgba(0, 0, 0, 0.08)',
  },
  modeCardPressed: { opacity: 0.9, transform: [{ scale: 0.97 }] },
  modeIconWrap: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center',
  },
  modeIconOutline: { backgroundColor: pink[50] },
  modeTitle: { fontSize: 14, fontWeight: '700', color: colors.surface, marginTop: 2 },
  modeSub: { fontSize: 11, color: 'rgba(255,255,255,0.8)' },

  /* Stats */
  statsRow: { flexDirection: 'row', gap: spacing.sm },
  statPill: {
    flex: 1, backgroundColor: '#F8FAFC', borderRadius: 20,
    paddingVertical: 14, alignItems: 'center', gap: 2,
    borderWidth: 1, borderColor: colors.border,
  },
  statValue: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  statLabel: { fontSize: 11, fontWeight: '600', color: colors.textMuted },

  /* Countdown */
  card: {
    backgroundColor: colors.surface, borderRadius: 24, padding: spacing.lg,
    shadowColor: 'rgba(0, 0, 0, 0.16)',
    shadowOffset: { width: 0, height: 6 }, shadowOpacity: 1, shadowRadius: 18, elevation: 4,
    gap: 8,
  },
  countdownRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  countdownIcon: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: pink[50],
    alignItems: 'center', justifyContent: 'center',
  },
  countdownText: { flex: 1 },
  countdownLabel: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  countdownDate: { fontSize: 16, color: colors.textPrimary, fontWeight: '700', marginTop: 2 },
  countdownBadge: {
    backgroundColor: colors.primary, borderRadius: 16,
    paddingHorizontal: spacing.sm, paddingVertical: 6, alignItems: 'center', minWidth: 64,
  },
  countdownBadgeNum: { color: colors.surface, fontSize: 22, fontWeight: '800', lineHeight: 24 },
  countdownBadgeUnit: { color: colors.surface, fontSize: 10, fontWeight: '600', opacity: 0.9 },

  /* Section titles */
  sectionTitle: {
    fontSize: 16, fontWeight: '700', color: colors.textPrimary,
    marginBottom: spacing.xs, marginTop: spacing.xs,
  },

  /* Study row */
  studyRow: { flexDirection: 'row', gap: spacing.sm },
  studyCard: {
    flex: 1, backgroundColor: colors.surface, borderRadius: 24,
    padding: spacing.lg, gap: 6,
    shadowColor: 'rgba(0, 0, 0, 0.14)',
    shadowOffset: { width: 0, height: 5 }, shadowOpacity: 1, shadowRadius: 14, elevation: 3,
  },
  studyCardPressed: { opacity: 0.95, transform: [{ scale: 0.97 }] },
  studyCardTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginTop: 4 },
  studyCardSub: { fontSize: 12, color: colors.textSecondary },

  /* Recent sessions */
  recentCard: {
    backgroundColor: colors.surface, borderRadius: 24, padding: spacing.md,
    shadowColor: 'rgba(0, 0, 0, 0.10)',
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 12, elevation: 2,
    gap: 0,
  },
  recentRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  recentDot: { width: 8, height: 8, borderRadius: 4 },
  dotGreen: { backgroundColor: '#22C55E' },
  dotRed: { backgroundColor: '#EF4444' },
  dotNeutral: { backgroundColor: colors.textMuted },
  recentMode: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  recentScore: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  recentDate: { fontSize: 12, color: colors.textMuted, marginLeft: 6, minWidth: 50, textAlign: 'right' },

  /* Sticky header */
  stickyHeader: { position: 'absolute', top: 0, left: 0, right: 0, overflow: 'hidden', zIndex: 10 },
  stickyContent: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.md },
  stickyTitle: { color: colors.surface, fontSize: 18, fontWeight: '700' },
  stickySub: { color: 'rgba(255, 255, 255, 0.8)', fontSize: 13, fontWeight: '500' },
});

export default AllievoTheoryHomeScreen;
