import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import RenderHtml from 'react-native-render-html';
import { useWindowDimensions } from 'react-native';
import { Screen } from '../components/Screen';
import { useQuiz } from '../context/QuizContext';
import { colors, pink, yellow, spacing } from '../theme';
import { regloApi } from '../services/regloApi';
import type { QuizSessionResult } from '../types/regloApi';

export const QuizResultsScreen = () => {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const { clearSession, startSession } = useQuiz();
  const [result, setResult] = useState<QuizSessionResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [starting, setStarting] = useState(false);

  const heroScale = useSharedValue(0.85);
  const heroOpacity = useSharedValue(0);

  useEffect(() => {
    if (!sessionId) return;
    (async () => {
      try {
        const d = await regloApi.getQuizSessionResult(sessionId);
        setResult(d);
        heroScale.value = withDelay(80, withSpring(1, { damping: 14 }));
        heroOpacity.value = withDelay(80, withTiming(1, { duration: 350 }));
      } catch {} finally { setLoading(false); }
    })();
    clearSession();
  }, [sessionId]);

  const heroStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heroScale.value }], opacity: heroOpacity.value,
  }));

  const handleStart = async (mode: 'EXAM' | 'REVIEW') => {
    if (starting) return;
    setStarting(true);
    try {
      const d = await regloApi.startQuizSession({ mode });
      startSession({ sessionId: d.sessionId, questions: d.questions, mode, timeLimitSec: d.timeLimitSec });
      router.replace('/(tabs)/quiz/session');
    } catch {} finally { setStarting(false); }
  };

  const toggle = (id: string) => {
    setExpanded((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };

  if (loading) return <Screen><View style={st.center}><ActivityIndicator size="large" color={colors.primary} /></View></Screen>;

  if (!result) return (
    <Screen><View style={st.center}>
      <Ionicons name="alert-circle-outline" size={44} color={colors.textMuted} />
      <Text style={st.emptyText}>Risultato non trovato</Text>
      <Pressable style={st.emptyBtn} onPress={() => router.replace('/(tabs)/quiz')}>
        <Text style={st.emptyBtnText}>Torna ai quiz</Text>
      </Pressable>
    </View></Screen>
  );

  const passed = result.passed;
  const scorePct = result.totalQuestions > 0
    ? Math.round((result.correctCount / result.totalQuestions) * 100) : 0;
  const timeSec = result.startedAt && result.completedAt
    ? Math.round((new Date(result.completedAt).getTime() - new Date(result.startedAt).getTime()) / 1000) : null;

  return (
    <Screen>
      <ScrollView contentContainerStyle={st.scroll} bounces={false} showsVerticalScrollIndicator={false}>

        {/* ── Hero ── */}
        <Animated.View style={heroStyle}>
          <View style={st.heroCard}>
            {/* Big circle icon */}
            <View style={[st.heroCircle, passed === true ? st.heroCirclePass : passed === false ? st.heroCircleFail : st.heroCircleNeutral]}>
              <Ionicons
                name={passed === true ? 'checkmark' : passed === false ? 'close' : 'remove'}
                size={40} color="#FFFFFF"
              />
            </View>

            <Text style={st.heroTitle}>
              {passed === true ? 'Promosso!' : passed === false ? 'Non superato' : 'Completato'}
            </Text>

            {/* Score */}
            <View style={st.scoreRow}>
              <Text style={st.scoreBig}>{result.correctCount}</Text>
              <Text style={st.scoreSep}>/</Text>
              <Text style={st.scoreTotal}>{result.totalQuestions}</Text>
            </View>

            {/* Meta pills */}
            <View style={st.metaRow}>
              <View style={st.metaPill}>
                <Ionicons name="checkmark-circle" size={13} color="#16A34A" />
                <Text style={st.metaPillText}>{result.correctCount} corrette</Text>
              </View>
              <View style={st.metaPill}>
                <Ionicons name="close-circle" size={13} color={colors.destructive} />
                <Text style={st.metaPillText}>{result.wrongCount} errori</Text>
              </View>
              {timeSec !== null && (
                <View style={st.metaPill}>
                  <Ionicons name="time-outline" size={13} color={colors.textMuted} />
                  <Text style={st.metaPillText}>
                    {Math.floor(timeSec / 60)}:{String(timeSec % 60).padStart(2, '0')}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </Animated.View>

        {/* ── Chapter Breakdown ── */}
        {result.chaptersBreakdown.length > 0 && (
          <Animated.View entering={FadeInDown.delay(200).duration(350)} style={st.section}>
            <Text style={st.secTitle}>Risultati per capitolo</Text>
            {result.chaptersBreakdown.map((ch, i) => {
              const pct = ch.total > 0 ? Math.round((ch.correct / ch.total) * 100) : 0;
              return (
                <Animated.View key={ch.chapterNumber} entering={FadeInDown.delay(230 + i * 25).duration(220)} style={st.bRow}>
                  <View style={st.bBadge}>
                    <Text style={st.bBadgeText}>{ch.chapterNumber}</Text>
                  </View>
                  <View style={st.bBarWrap}>
                    <View style={st.bTrack}>
                      <View style={[st.bFill, { width: `${pct}%` }, pct >= 70 ? st.fG : pct >= 40 ? st.fY : st.fR]} />
                    </View>
                  </View>
                  <Text style={[st.bPct, pct >= 70 ? st.pG : pct >= 40 ? st.pY : st.pR]}>{pct}%</Text>
                </Animated.View>
              );
            })}
          </Animated.View>
        )}

        {/* ── Wrong Answers ── */}
        {result.wrongAnswers.length > 0 && (
          <Animated.View entering={FadeIn.delay(400).duration(300)} style={st.section}>
            <Text style={st.secTitle}>
              {result.wrongAnswers.length} rispost{result.wrongAnswers.length === 1 ? 'a errata' : 'e errate'}
            </Text>
            {result.wrongAnswers.map((q) => {
              const open = expanded.has(q.id);
              return (
                <Pressable key={q.id} onPress={() => toggle(q.id)} style={({ pressed }) => [st.wrongCard, pressed && { opacity: 0.85 }]}>
                  <View style={st.wrongTop}>
                    <Text style={st.wrongQ} numberOfLines={open ? undefined : 2}>{q.questionText}</Text>
                    <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
                  </View>
                  <View style={st.wrongCorrectRow}>
                    <Ionicons name="checkmark-circle" size={14} color="#16A34A" />
                    <Text style={st.wrongCorrectText}>{q.correctAnswer ? 'VERO' : 'FALSO'}</Text>
                  </View>
                  {open && (
                    <>
                      {q.imageUrl && (
                        <View style={st.wrongImageWrap}>
                          <Image source={{ uri: q.imageUrl }} style={st.wrongImg} resizeMode="contain" />
                        </View>
                      )}
                      {q.hint && (
                        <View style={st.wrongHint}>
                          <View style={st.wrongHintHeader}>
                            <Ionicons name="bulb-outline" size={14} color={pink[600]} />
                            <Text style={st.wrongHintTitle}>{q.hint.title}</Text>
                          </View>
                          <RenderHtml contentWidth={width - spacing.md * 6} source={{ html: q.hint.descriptionHtml }} baseStyle={st.wrongHintHtml as any} />
                        </View>
                      )}
                    </>
                  )}
                </Pressable>
              );
            })}
          </Animated.View>
        )}

        {/* ── Actions ── */}
        <Animated.View entering={FadeInUp.delay(500).duration(300)} style={st.actions}>
          {result.mode === 'EXAM' && (
            <Pressable onPress={() => handleStart('EXAM')} disabled={starting} style={({ pressed }) => [pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] }]}>
              <LinearGradient colors={[pink[400], pink[600]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={st.actPrimary}>
                <Ionicons name="play" size={18} color="#FFFFFF" />
                <Text style={st.actPrimaryText}>{starting ? 'Avvio...' : 'Nuova simulazione'}</Text>
              </LinearGradient>
            </Pressable>
          )}
          {result.wrongAnswers.length > 0 && (
            <Pressable onPress={() => handleStart('REVIEW')} disabled={starting} style={({ pressed }) => [st.actSecondary, pressed && { opacity: 0.7 }]}>
              <Ionicons name="refresh" size={15} color={colors.primary} />
              <Text style={st.actSecondaryText}>Ripeti errori</Text>
            </Pressable>
          )}
          <Pressable onPress={() => router.replace('/(tabs)/quiz')} style={({ pressed }) => [st.actGhost, pressed && { opacity: 0.4 }]}>
            <Text style={st.actGhostText}>Torna alla home</Text>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </Screen>
  );
};

const st = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  emptyText: { fontSize: 15, fontWeight: '500', color: colors.textSecondary },
  emptyBtn: { paddingVertical: 10, paddingHorizontal: 24, borderRadius: 12, backgroundColor: pink[50] },
  emptyBtnText: { fontSize: 14, fontWeight: '600', color: colors.primary },
  scroll: { padding: spacing.md, gap: 20, paddingBottom: 120 },

  // Hero
  heroCard: {
    borderRadius: 28, padding: 28, alignItems: 'center', gap: 10,
    backgroundColor: pink[50], borderWidth: 1, borderColor: pink[100],
    shadowColor: pink[300], shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15, shadowRadius: 16, elevation: 5,
  },
  heroCircle: {
    width: 72, height: 72, borderRadius: 36,
    alignItems: 'center', justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 6,
  },
  heroCirclePass: { backgroundColor: '#16A34A', shadowColor: '#16A34A' },
  heroCircleFail: { backgroundColor: colors.destructive, shadowColor: colors.destructive },
  heroCircleNeutral: { backgroundColor: colors.textMuted, shadowColor: colors.textMuted },
  heroTitle: { fontSize: 22, fontWeight: '800', color: '#1A1A2E', letterSpacing: -0.3, marginTop: 4 },
  scoreRow: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  scoreBig: { fontSize: 48, fontWeight: '800', color: '#1A1A2E', letterSpacing: -3 },
  scoreSep: { fontSize: 28, fontWeight: '300', color: colors.textMuted },
  scoreTotal: { fontSize: 28, fontWeight: '600', color: colors.textMuted },
  metaRow: { flexDirection: 'row', gap: 8, marginTop: 4, flexWrap: 'wrap', justifyContent: 'center' },
  metaPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingVertical: 4, paddingHorizontal: 10, borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  metaPillText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },

  // Section
  section: { gap: 10 },
  secTitle: { fontSize: 16, fontWeight: '700', color: '#1A1A2E', letterSpacing: -0.2 },

  // Breakdown
  bRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 2 },
  bBadge: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: pink[50], alignItems: 'center', justifyContent: 'center',
  },
  bBadgeText: { fontSize: 11, fontWeight: '800', color: pink[500] },
  bBarWrap: { flex: 1 },
  bTrack: { height: 5, borderRadius: 2.5, backgroundColor: pink[50], overflow: 'hidden' },
  bFill: { height: '100%', borderRadius: 2.5 },
  fG: { backgroundColor: '#16A34A' }, fY: { backgroundColor: '#EAB308' }, fR: { backgroundColor: colors.destructive },
  bPct: { fontSize: 12, fontWeight: '800', width: 34, textAlign: 'right' },
  pG: { color: '#16A34A' }, pY: { color: '#CA8A04' }, pR: { color: colors.destructive },

  // Wrong answers
  wrongCard: {
    padding: 16, borderRadius: 22, backgroundColor: '#FFFFFF',
    borderWidth: 1, borderColor: '#FECACA', gap: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  wrongTop: { flexDirection: 'row', gap: 8 },
  wrongQ: { flex: 1, fontSize: 14, fontWeight: '600', color: '#1A1A2E', lineHeight: 20 },
  wrongCorrectRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  wrongCorrectText: { fontSize: 12, fontWeight: '700', color: '#16A34A' },
  wrongImageWrap: { backgroundColor: '#1A1A2E', borderRadius: 12, padding: 12, alignItems: 'center' },
  wrongImg: { width: '80%', height: 100 },
  wrongHint: {
    padding: 14, borderRadius: 20,
    backgroundColor: pink[50], gap: 6,
    borderWidth: 1, borderColor: pink[100],
    shadowColor: pink[200], shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 6, elevation: 2,
  },
  wrongHintHeader: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  wrongHintTitle: { fontSize: 13, fontWeight: '700', color: pink[700] },
  wrongHintHtml: { fontSize: 12, color: '#4A4458', lineHeight: 17 },

  // Actions
  actions: { gap: 10, marginTop: 4 },
  actPrimary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 16, borderRadius: 22,
    shadowColor: pink[400], shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 10, elevation: 5,
  },
  actPrimaryText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  actSecondary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 13, borderRadius: 22,
    borderWidth: 1.5, borderColor: pink[100], backgroundColor: pink[50],
    shadowColor: pink[200], shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 6, elevation: 2,
  },
  actSecondaryText: { fontSize: 14, fontWeight: '600', color: colors.primary },
  actGhost: { alignItems: 'center', paddingVertical: 10 },
  actGhostText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
});
