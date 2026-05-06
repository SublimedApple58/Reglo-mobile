import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Screen } from '../components/Screen';
import { colors, pink, yellow, spacing, typography } from '../theme';
import { regloApi } from '../services/regloApi';
import { useQuiz } from '../context/QuizContext';
import type { QuizChapterProgress, QuizStudentStats } from '../types/regloApi';

export const QuizHomeScreen = () => {
  const router = useRouter();
  const { startSession } = useQuiz();
  const [chapters, setChapters] = useState<QuizChapterProgress[]>([]);
  const [stats, setStats] = useState<QuizStudentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [starting, setStarting] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [c, s] = await Promise.all([regloApi.getQuizChapters(), regloApi.getQuizStudentStats()]);
      setChapters(c); setStats(s);
    } catch {} finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleStart = async (mode: 'EXAM' | 'CHAPTER' | 'REVIEW', chapterId?: string) => {
    if (starting) return;
    setStarting(mode + (chapterId ?? ''));
    try {
      const r = await regloApi.startQuizSession({ mode, chapterId });
      startSession({ sessionId: r.sessionId, questions: r.questions, mode, timeLimitSec: r.timeLimitSec });
      router.push('/(tabs)/quiz/session');
    } catch {} finally { setStarting(null); }
  };

  if (loading) {
    return <Screen gradient><View style={st.center}><ActivityIndicator size="large" color={colors.primary} /></View></Screen>;
  }

  const hasErrors = stats && (stats.examsFailed > 0 || stats.weakChapters.length > 0);

  return (
    <Screen gradient>
      <ScrollView
        contentContainerStyle={st.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
      >
        {/* ── Hero: Play Button ── */}
        <Animated.View entering={FadeInDown.duration(450).springify()} style={st.heroSection}>
          <Pressable
            onPress={() => handleStart('EXAM')}
            disabled={!!starting}
            style={({ pressed }) => [st.playButton, pressed && { opacity: 0.85, transform: [{ scale: 0.95 }] }]}
          >
            <LinearGradient
              colors={[pink[400], pink[600]]}
              style={st.playButtonGradient}
            >
              <Ionicons name="play" size={44} color="#FFFFFF" style={{ marginLeft: 4 }} />
            </LinearGradient>
          </Pressable>
          <Text style={st.heroTitle}>
            {starting === 'EXAM' ? 'Avvio...' : 'AVVIA ESAME'}
          </Text>
          <Text style={st.heroSubtitle}>30 domande, 20 minuti</Text>
        </Animated.View>

        {/* ── Stats Row ── */}
        <Animated.View entering={FadeInUp.delay(100).duration(400)} style={st.statsRow}>
          <View style={st.statCard}>
            <View style={st.statIconCircle}>
              <Ionicons name="document-text-outline" size={18} color={pink[500]} />
            </View>
            <Text style={st.statLabel}>Quiz totali</Text>
            <Text style={st.statValue}>{stats?.totalSessions ?? 0}</Text>
          </View>
          <View style={st.statCard}>
            <View style={st.statIconCircle}>
              <Ionicons name="checkmark-done-outline" size={18} color="#16A34A" />
            </View>
            <Text style={st.statLabel}>Tasso successo</Text>
            <Text style={st.statValue}>{stats?.examPassRate ?? 0}%</Text>
          </View>
        </Animated.View>

        {/* ── Readiness ── */}
        {stats && (
          <Animated.View entering={FadeIn.delay(180).duration(350)} style={st.readinessCard}>
            <View style={st.readinessLeft}>
              <View style={st.readinessIconCircle}>
                <Ionicons name="trending-up" size={18} color={pink[500]} />
              </View>
              <View>
                <Text style={st.readinessLabel}>Prontezza esame</Text>
                <Text style={st.readinessValue}>{stats.readinessScore}%</Text>
              </View>
            </View>
            {stats.readinessScore >= 70 && (
              <View style={st.hotBadge}>
                <Text style={st.hotBadgeText}>PRONTO</Text>
              </View>
            )}
          </Animated.View>
        )}

        {/* ── Review CTA ── */}
        {hasErrors && (
          <Animated.View entering={FadeIn.delay(220).duration(300)}>
            <Pressable
              onPress={() => handleStart('REVIEW')}
              disabled={!!starting}
              style={({ pressed }) => [st.reviewCta, pressed && { opacity: 0.7 }]}
            >
              <Ionicons name="refresh" size={17} color={colors.primary} />
              <Text style={st.reviewCtaText}>Rivedi errori</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </Pressable>
          </Animated.View>
        )}

        {/* ── Libreria Argomenti CTA ── */}
        <Animated.View entering={FadeIn.delay(260).duration(300)}>
          <Pressable
            onPress={() => router.push('/(tabs)/quiz/chapters')}
            style={({ pressed }) => [st.libraryCta, pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] }]}
          >
            <View style={st.libraryCtaLeft}>
              <View style={st.libraryCtaIcon}>
                <Ionicons name="library-outline" size={20} color={pink[500]} />
              </View>
              <View>
                <Text style={st.libraryCtaTitle}>Libreria Argomenti</Text>
                <Text style={st.libraryCtaSub}>{chapters.length} capitoli disponibili</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </Pressable>
        </Animated.View>

        {/* ── Recent Sessions ── */}
        {stats && stats.recentSessions.length > 0 && (
          <Animated.View entering={FadeIn.delay(340).duration(350)} style={st.recentSection}>
            <Text style={st.sectionTitle}>Sessioni recenti</Text>
            {stats.recentSessions.slice(0, 5).map((ses) => (
              <Pressable
                key={ses.id}
                onPress={() => router.push({ pathname: '/(tabs)/quiz/results', params: { sessionId: ses.id } })}
                style={({ pressed }) => [st.recentRow, pressed && { opacity: 0.5 }]}
              >
                <View style={[st.recentDot, ses.passed === true ? st.dotG : ses.passed === false ? st.dotR : st.dotN]} />
                <Text style={st.recentMode}>
                  {ses.mode === 'EXAM' ? 'Esame' : ses.mode === 'CHAPTER' ? 'Capitolo' : 'Ripasso'}
                </Text>
                <View style={{ flex: 1 }} />
                <Text style={st.recentScore}>{ses.correctCount}/{ses.totalQuestions}</Text>
                {ses.completedAt && (
                  <Text style={st.recentDate}>
                    {new Date(ses.completedAt).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}
                  </Text>
                )}
              </Pressable>
            ))}
          </Animated.View>
        )}
      </ScrollView>
    </Screen>
  );
};

const st = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: spacing.md, paddingTop: 8, paddingBottom: 120, gap: 18 },

  // Hero
  heroSection: { alignItems: 'center', paddingVertical: 24, gap: 10, marginBottom: 12 },
  playButton: { marginBottom: 4 },
  playButtonGradient: {
    width: 100, height: 100, borderRadius: 50,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: pink[500], shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 16, elevation: 8,
  },
  heroTitle: { fontSize: 16, fontWeight: '800', color: '#1A1A2E', letterSpacing: 2 },
  heroSubtitle: { fontSize: 13, fontWeight: '500', color: colors.textMuted },

  // Stats
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  statCard: {
    flex: 1, padding: 16, borderRadius: 22,
    backgroundColor: pink[50], alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: pink[100],
    shadowColor: pink[300], shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 12, elevation: 4,
  },
  statIconCircle: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center',
  },
  statLabel: { fontSize: 11, fontWeight: '600', color: colors.textMuted },
  statValue: { fontSize: 22, fontWeight: '800', color: '#1A1A2E' },

  // Readiness
  readinessCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, borderRadius: 22, marginBottom: 12,
    backgroundColor: pink[50], borderWidth: 1, borderColor: pink[100],
    shadowColor: pink[300], shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12, shadowRadius: 10, elevation: 3,
  },
  readinessLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  readinessIconCircle: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center',
  },
  readinessLabel: { fontSize: 11, fontWeight: '600', color: colors.textMuted },
  readinessValue: { fontSize: 18, fontWeight: '800', color: '#1A1A2E' },
  hotBadge: {
    paddingVertical: 4, paddingHorizontal: 10, borderRadius: 10,
    backgroundColor: '#16A34A',
  },
  hotBadgeText: { fontSize: 10, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.5 },

  // Review CTA
  reviewCta: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 14, paddingHorizontal: 16, borderRadius: 22, marginBottom: 12,
    backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: pink[100],
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  reviewCtaText: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.textPrimary },

  // Library CTA
  libraryCta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 18, borderRadius: 24,
    backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: pink[100],
    shadowColor: pink[200], shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14, shadowRadius: 12, elevation: 4,
  },
  libraryCtaLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  libraryCtaIcon: {
    width: 42, height: 42, borderRadius: 14,
    backgroundColor: pink[50], alignItems: 'center', justifyContent: 'center',
  },
  libraryCtaTitle: { fontSize: 16, fontWeight: '700', color: '#1A1A2E' },
  libraryCtaSub: { fontSize: 12, fontWeight: '500', color: colors.textMuted, marginTop: 1 },

  // Section
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A2E', letterSpacing: -0.3 },

  // Recent
  recentSection: { gap: 8, marginTop: 4 },
  recentRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  recentDot: { width: 7, height: 7, borderRadius: 3.5 },
  dotG: { backgroundColor: '#16A34A' },
  dotR: { backgroundColor: colors.destructive },
  dotN: { backgroundColor: colors.textMuted },
  recentMode: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  recentScore: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  recentDate: { fontSize: 11, fontWeight: '500', color: colors.textMuted, width: 48, textAlign: 'right' },
});
