import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Extrapolation,
  FadeInUp,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { GradientCTABackground, primaryCtaShadow } from '../components/GradientCTA';
import { useStudentPhase } from '../hooks/useStudentPhase';
import { useSession } from '../context/SessionContext';
import { useQuiz } from '../context/QuizContext';
import { regloApi } from '../services/regloApi';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import type { QuizChapterProgress, QuizStudentStats } from '../types/regloApi';

/* eslint-disable @typescript-eslint/no-var-requires */
const iconAccuracy = require('../../assets/icons/stat-accuracy.png');
const iconQuizzes = require('../../assets/icons/stat-quizzes.png');
const iconTopics = require('../../assets/icons/stat-topics.png');
const iconCountdown = require('../../assets/icons/stat-countdown.png');
const iconReview = require('../../assets/icons/review-retry.png');
const iconExam = require('../../assets/icons/cta-exam.png');
const iconPractice = require('../../assets/icons/cta-practice.png');
const iconTheory = require('../../assets/icons/tag-theory.png');
/* eslint-enable @typescript-eslint/no-var-requires */

const COMPACT_HEADER_H = 44;
const LARGE_TITLE_H = 88;
const SCROLL_RANGE = LARGE_TITLE_H;
const LAST_TOPIC_KEY = 'reglo_last_studied_topic';

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

type LastTopic = { id: string; chapterNumber: number; description: string };

// OTA-safe: the production binary doesn't bundle async-storage's native module,
// so "last topic" persists in-memory (per session) until the next native build.
let lastTopicMem: LastTopic | null = null;

const saveLastTopic = async (topic: LastTopic) => {
  lastTopicMem = topic;
};

const loadLastTopic = async (): Promise<LastTopic | null> => lastTopicMem;

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

  /* ── Data ── */

  const [stats, setStats] = useState<QuizStudentStats | null>(null);
  const [chapters, setChapters] = useState<QuizChapterProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [starting, setStarting] = useState<string | null>(null);
  const [lastTopic, setLastTopic] = useState<LastTopic | null>(null);

  const load = useCallback(async () => {
    try {
      const [c, st, lt] = await Promise.all([
        regloApi.getQuizChapters(),
        regloApi.getQuizStudentStats(),
        loadLastTopic(),
      ]);
      setChapters(c);
      setStats(st);
      setLastTopic(lt);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  /* ── Computed stats ── */

  const correctRate = useMemo(() => {
    if (!stats) return 0;
    const attempted = stats.chaptersProgress.reduce((sum, c) => sum + c.attemptedCount, 0);
    const correct = stats.chaptersProgress.reduce((sum, c) => sum + c.correctCount, 0);
    return attempted > 0 ? Math.round((correct / attempted) * 100) : 0;
  }, [stats]);

  const totalQuizzes = stats?.totalSessions ?? 0;

  const chaptersRemaining = useMemo(() => {
    if (!stats) return 0;
    return stats.chaptersProgress.filter((c) => c.attemptedCount === 0).length;
  }, [stats]);

  const hasErrors = stats && (stats.examsFailed > 0 || stats.weakChapters.length > 0);

  /* ── Actions ── */

  const handleStart = async (mode: 'EXAM' | 'PRACTICE' | 'REVIEW') => {
    if (starting) return;
    setStarting(mode);
    try {
      const r = await regloApi.startQuizSession({ mode });
      startSession({ sessionId: r.sessionId, questions: r.questions, mode, timeLimitSec: r.timeLimitSec });
      router.push('/(tabs)/home/quiz-session');
    } catch { /* silent */ } finally { setStarting(null); }
  };

  const handleGoToTopics = () => {
    router.push('/(tabs)/home/topic-list');
  };

  const handleContinueTopic = () => {
    if (!lastTopic) {
      handleGoToTopics();
      return;
    }
    router.push({ pathname: '/(tabs)/home/scheda-grid', params: { chapterId: lastTopic.id } } as never);
  };

  /* ── Scroll animation ── */

  const scrollY = useSharedValue(0);
  const headerTotalH = insets.top + COMPACT_HEADER_H;

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => { scrollY.value = e.contentOffset.y; },
  });

  const largeTitleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, SCROLL_RANGE * 0.6], [1, 0], Extrapolation.CLAMP),
    transform: [
      { translateY: interpolate(scrollY.value, [0, SCROLL_RANGE], [0, -12], Extrapolation.CLAMP) },
    ],
  }));

  const compactTitleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [SCROLL_RANGE * 0.5, SCROLL_RANGE], [0, 1], Extrapolation.CLAMP),
  }));

  const headerBorderStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 20], [0, 1], Extrapolation.CLAMP),
  }));

  /* ── Render ── */

  return (
    <View style={s.root}>
      {/* ── Sticky header ── */}
      <View style={[s.headerWrap, { height: headerTotalH, paddingTop: insets.top }]}>
        {Platform.OS === 'ios' ? (
          <BlurView intensity={80} tint="systemChromeMaterialLight" style={StyleSheet.absoluteFill} />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(253,253,253,0.95)' }]} />
        )}
        <Animated.View style={[StyleSheet.absoluteFill, s.headerBorder, headerBorderStyle]} />
        <Animated.View style={[s.compactHeader, compactTitleStyle]}>
          <Text style={s.compactTitle} numberOfLines={1}>Ciao, {firstName}</Text>
          <View style={s.compactTag}>
            <Text style={s.compactTagText}>Teoria</Text>
          </View>
        </Animated.View>
      </View>

      {/* ── Scroll ── */}
      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.scrollContent, { paddingTop: headerTotalH }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={colors.primary}
            progressViewOffset={headerTotalH}
          />
        }
      >
        {/* ── Large title ── */}
        <Animated.View style={[s.largeTitleWrap, largeTitleStyle]}>
          <Text style={s.largeTitle}>Ciao, {firstName}</Text>
          <View style={s.largeTitleTagRow}>
            <Image source={iconTheory} style={s.largeTitleTagIcon} />
            <Text style={s.largeTitleTagText}>Percorso teoria</Text>
          </View>
        </Animated.View>

        {/* ── Study CTA (adaptive) ── */}
        <Animated.View entering={FadeInUp.delay(0).duration(280).springify()}>
          {lastTopic ? (
            <>
              <Pressable
                onPress={handleContinueTopic}
                style={({ pressed }) => [s.continueCta, pressed && s.ctaPressed]}
              >
                <GradientCTABackground radius={26} />
                <View style={s.continueContent}>
                  <Text style={s.continueLabel}>Continua a studiare</Text>
                  <Text style={s.continueSub} numberOfLines={1}>
                    Cap. {lastTopic.chapterNumber} · {lastTopic.description}
                  </Text>
                </View>
                <View style={s.continueArrow}>
                  <Ionicons name="arrow-forward" size={18} color={colors.surface} />
                </View>
              </Pressable>
              <Pressable
                onPress={handleGoToTopics}
                style={({ pressed }) => [s.browseLink, pressed && { opacity: 0.5 }]}
              >
                <Text style={s.browseLinkText}>Tutti gli argomenti</Text>
                <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
              </Pressable>
            </>
          ) : (
            <Pressable
              onPress={handleGoToTopics}
              style={({ pressed }) => [s.continueCta, pressed && s.ctaPressed]}
            >
              <GradientCTABackground radius={26} />
              <Image source={require('../../assets/icons/study-books.png')} style={s.continueIcon} />
              <View style={s.continueContent}>
                <Text style={s.continueLabel}>Sfoglia gli argomenti</Text>
                <Text style={s.continueSub}>{chapters.length} capitoli da studiare</Text>
              </View>
              <View style={s.continueArrow}>
                <Ionicons name="arrow-forward" size={18} color={colors.surface} />
              </View>
            </Pressable>
          )}
        </Animated.View>

        {/* ── Esercitati (prominent CTA cards) ── */}
        <Animated.View entering={FadeInUp.delay(80).duration(280).springify()}>
          <Text style={s.sectionLabel}>Pronto per l'esame?</Text>
          <View style={s.ctaRow}>
            <Pressable
              onPress={() => router.push('/(tabs)/home/exam-schede')}
              style={({ pressed }) => [s.ctaCard, s.ctaCardDark, pressed && s.ctaCardPressed]}
            >
              <Image source={iconExam} style={s.ctaIcon} />
              <Text style={s.ctaTitleLight}>Simulazione</Text>
              <Text style={s.ctaSubLight}>Schede d'esame</Text>
            </Pressable>
            <Pressable
              onPress={() => handleStart('PRACTICE')}
              disabled={!!starting}
              style={({ pressed }) => [s.ctaCard, pressed && s.ctaCardPressed]}
            >
              <Image source={iconPractice} style={s.ctaIcon} />
              <Text style={s.ctaTitle}>Esercitazione</Text>
              <Text style={s.ctaSub}>30 domande</Text>
              {starting === 'PRACTICE' && (
                <View style={s.ctaLoading}>
                  <ActivityIndicator color={colors.primary} />
                </View>
              )}
            </Pressable>
          </View>
          {hasErrors && (
            <Pressable
              onPress={() => handleStart('REVIEW')}
              disabled={!!starting}
              style={({ pressed }) => [s.ctaReview, pressed && s.ctaCardPressed]}
            >
              <Image source={iconReview} style={s.ctaReviewIcon} />
              <View style={{ flex: 1 }}>
                <Text style={s.ctaReviewTitle}>Ripassa i tuoi errori</Text>
                <Text style={s.ctaReviewSub}>Rivedi le domande sbagliate</Text>
              </View>
              {starting === 'REVIEW'
                ? <ActivityIndicator color={colors.primary} />
                : <Ionicons name="arrow-forward" size={18} color={colors.textMuted} />}
            </Pressable>
          )}
        </Animated.View>

        {/* ── Stats (inset shadow — clearly informational) ── */}
        {stats && !loading && (
          <Animated.View entering={FadeInUp.delay(120).duration(280).springify()} style={[s.statsInset, { marginTop: 6 }]}>
            <View style={s.statsInner}>
              <View style={s.statItem}>
                <Image source={iconAccuracy} style={s.statIcon} />
                <Text style={s.statValue}>{correctRate}%</Text>
                <Text style={s.statLabel}>Accuratezza</Text>
              </View>
              <View style={s.statDivider} />
              <View style={s.statItem}>
                <Image source={iconQuizzes} style={s.statIcon} />
                <Text style={s.statValue}>{totalQuizzes}</Text>
                <Text style={s.statLabel}>Quiz fatti</Text>
              </View>
              <View style={s.statDivider} />
              <View style={s.statItem}>
                <Image source={iconTopics} style={s.statIcon} />
                <Text style={s.statValue}>{chapters.length - chaptersRemaining}/{chapters.length}</Text>
                <Text style={s.statLabel}>Argomenti</Text>
              </View>
            </View>
          </Animated.View>
        )}
        {loading && (
          <View style={[s.statsInset, { marginTop: 6 }]}>
            <View style={[s.statsInner, { justifyContent: 'center', paddingVertical: 32 }]}>
              <ActivityIndicator size="small" color={colors.textMuted} />
            </View>
          </View>
        )}

        {/* ── Exam countdown ── */}
        {hasExamDate && (
          <Animated.View entering={FadeInUp.delay(160).duration(280).springify()} style={s.countdownCard}>
            <Image source={iconCountdown} style={s.countdownIcon} />
            <View style={s.countdownText}>
              <Text style={s.countdownLabel}>Esame teoria</Text>
              {examDateLabel && <Text style={s.countdownDate}>{examDateLabel}</Text>}
            </View>
            <View style={s.countdownBadge}>
              <Text style={s.countdownBadgeNum}>{daysLeft}</Text>
              <Text style={s.countdownBadgeUnit}>{daysLeft === 1 ? 'giorno' : 'giorni'}</Text>
            </View>
          </Animated.View>
        )}

        {/* ── Weak chapters (actionable) ── */}
        {stats && stats.weakChapters.length > 0 && (
          <Animated.View entering={FadeInUp.delay(200).duration(280).springify()}>
            <Text style={s.sectionTitle}>Da migliorare</Text>
            <View style={s.weakCard}>
              {stats.weakChapters.map((wc) => {
                const ch = chapters.find((c) => c.chapterNumber === wc.chapterNumber);
                return (
                  <Pressable
                    key={wc.chapterNumber}
                    onPress={() => {
                      if (ch) router.push({ pathname: '/(tabs)/home/scheda-grid', params: { chapterId: ch.id } } as never);
                    }}
                    style={({ pressed }) => [s.weakRow, pressed && { opacity: 0.5 }]}
                  >
                    <View style={s.weakBadge}>
                      <Text style={s.weakBadgeText}>{wc.chapterNumber}</Text>
                    </View>
                    <Text style={s.weakName} numberOfLines={1}>{wc.description}</Text>
                    <View style={[s.weakRatePill, wc.correctRate < 40 && s.weakRateRed]}>
                      <Text style={[s.weakRateText, wc.correctRate < 40 && s.weakRateTextRed]}>
                        {wc.correctRate}%
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>
        )}

        <View style={{ height: 100 }} />
      </Animated.ScrollView>
    </View>
  );
};

/* ------------------------------------------------------------------ */
/*  Export saveLastTopic for use in SchedaGridScreen                    */
/* ------------------------------------------------------------------ */

export { saveLastTopic };

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },

  /* ── Sticky blur header ── */
  headerWrap: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
  },
  headerBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  compactHeader: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: spacing.md, gap: 8,
  },
  compactTitle: { fontSize: 17, fontWeight: '600', color: colors.textPrimary },
  compactTag: {
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8,
    backgroundColor: colors.primary,
  },
  compactTagText: { fontSize: 11, fontWeight: '700', color: colors.surface },

  /* ── Scroll content ── */
  scrollContent: { paddingHorizontal: spacing.md, gap: 14 },

  /* ── Large title ── */
  largeTitleWrap: { paddingTop: spacing.sm, paddingBottom: spacing.xs },
  largeTitle: { fontSize: 24, fontWeight: '600', letterSpacing: -0.3, color: '#1A1A2E' },
  largeTitleTagRow: {
    flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4,
  },
  largeTitleTagIcon: { width: 16, height: 16 },
  largeTitleTagText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },

  /* ── Continue CTA ── */
  continueCta: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 26, padding: 16, gap: 12,
    ...primaryCtaShadow,
  },
  ctaPressed: { opacity: 0.95, transform: [{ scale: 0.97 }] },
  continueContent: { flex: 1, gap: 2 },
  continueLabel: { fontSize: 16, fontWeight: '700', color: colors.surface },
  continueSub: { fontSize: 13, fontWeight: '500', color: 'rgba(255,255,255,0.75)' },
  continueIcon: { width: 36, height: 36 },
  continueArrow: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center',
  },

  /* ── Browse link (when lastTopic exists) ── */
  browseLink: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    paddingVertical: 10,
  },
  browseLinkText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },

  /* ── Quiz CTA cards (prominent, tappable) ── */
  ctaRow: { flexDirection: 'row', gap: 10 },
  ctaCard: {
    flex: 1, backgroundColor: colors.surface, borderRadius: 26,
    paddingTop: 16, paddingBottom: 14, paddingHorizontal: 16, gap: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.14, shadowRadius: 6, elevation: 5,
  },
  ctaCardDark: { backgroundColor: '#1A1A2E' },
  ctaCardPressed: { opacity: 0.9, transform: [{ scale: 0.96 }] },
  ctaLoading: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaIcon: { width: 44, height: 44, marginBottom: 4 },
  ctaTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  ctaTitleLight: { fontSize: 15, fontWeight: '700', color: colors.surface },
  ctaSub: { fontSize: 12, fontWeight: '500', color: colors.textMuted },
  ctaSubLight: { fontSize: 12, fontWeight: '500', color: 'rgba(255,255,255,0.6)' },
  ctaReview: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10,
    backgroundColor: '#FFFFFF', borderRadius: 26, padding: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.14, shadowRadius: 6, elevation: 5,
  },
  ctaReviewIcon: { width: 36, height: 36 },
  ctaReviewTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  ctaReviewSub: { fontSize: 12, fontWeight: '500', color: colors.textSecondary },

  /* ── Stats (inset shadow — clearly informational, not tappable) ── */
  statsInset: {
    backgroundColor: colors.background, borderRadius: 20,
    boxShadow: [
      { offsetX: 0, offsetY: 2, blurRadius: 6, spreadDistance: 0, color: 'rgba(0,0,0,0.12)', inset: true },
      { offsetX: 0, offsetY: 1, blurRadius: 2, spreadDistance: 0, color: 'rgba(0,0,0,0.06)', inset: true },
    ],
  },
  statsInner: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 18, paddingHorizontal: 8,
  },
  statItem: { flex: 1, alignItems: 'center', gap: 2 },
  statDivider: { width: StyleSheet.hairlineWidth, height: 40, backgroundColor: colors.border },
  statIcon: { width: 34, height: 34, marginBottom: 2 },
  statValue: { fontSize: 15, fontWeight: '800', color: '#1A1A2E' },
  statLabel: { fontSize: 10, fontWeight: '600', color: colors.textMuted },

  /* ── Countdown ── */
  countdownCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.surface, borderRadius: 22, padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 2,
  },
  countdownIcon: { width: 44, height: 44 },
  countdownText: { flex: 1 },
  countdownLabel: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  countdownDate: { fontSize: 16, color: colors.textPrimary, fontWeight: '700', marginTop: 2 },
  countdownBadge: {
    backgroundColor: colors.primary, borderRadius: 16,
    paddingHorizontal: spacing.sm, paddingVertical: 6, alignItems: 'center', minWidth: 64,
  },
  countdownBadgeNum: { color: colors.surface, fontSize: 22, fontWeight: '800', lineHeight: 24 },
  countdownBadgeUnit: { color: colors.surface, fontSize: 10, fontWeight: '600', opacity: 0.9 },

  /* ── Section titles ── */
  sectionLabel: {
    fontSize: 13, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.5,
    textTransform: 'uppercase', marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16, fontWeight: '700', color: colors.textPrimary,
    marginBottom: 2, marginTop: 4,
  },

  /* ── Weak chapters ── */
  weakCard: {
    backgroundColor: colors.surface, borderRadius: 20, padding: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 2,
  },
  weakRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  weakBadge: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center',
  },
  weakBadgeText: { fontSize: 13, fontWeight: '800', color: colors.textSecondary },
  weakName: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  weakRatePill: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
    backgroundColor: '#FEF3C7',
  },
  weakRateRed: { backgroundColor: '#FEE2E2' },
  weakRateText: { fontSize: 12, fontWeight: '800', color: '#CA8A04' },
  weakRateTextRed: { color: '#C13515' },
});

export default AllievoTheoryHomeScreen;
