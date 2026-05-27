import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
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
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
} from 'react-native-reanimated';
import { usePathname, useRouter } from 'expo-router';
import RenderHtml from 'react-native-render-html';
import { useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, pink, spacing } from '../theme';
import { regloApi } from '../services/regloApi';
import { useQuiz } from '../context/QuizContext';

const EXAM_MAX_ERRORS = 3;
const SCHEDA_MAX_ERRORS = 3;
const SCHEDA_COOLDOWN_MS = 2000;

type AnswerResult = {
  isCorrect: boolean;
  correctAnswer: boolean;
  hint: { title: string; descriptionHtml: string } | null;
  autoFailed: boolean;
};

// Dot states: null = not answered, true = correct, false = wrong
type DotState = null | boolean;

export const QuizSessionScreen = () => {
  const router = useRouter();
  const pathname = usePathname();
  const isHomeStack = pathname.includes('/home/');
  const resultsRoute = isHomeStack ? '/(tabs)/home/quiz-results' : '/(tabs)/quiz/results';
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { session, clearSession } = useQuiz();
  const [index, setIndex] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [dots, setDots] = useState<DotState[]>([]);
  const [examAnswering, setExamAnswering] = useState(false);
  const [examAutoFailed, setExamAutoFailed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollRef = useRef<ScrollView | null>(null);

  // SCHEDA-specific state
  const [elapsedSec, setElapsedSec] = useState(0);
  const [schedaCooldown, setSchedaCooldown] = useState(false);
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const trueScale = useSharedValue(1);
  const falseScale = useSharedValue(1);

  const isScheda = session?.mode === 'SCHEDA';
  const total = session?.questions.length ?? 0;

  // Initialize dots + restore SCHEDA resume state
  useEffect(() => {
    if (!session) return;
    if (isScheda) {
      // Restore dots from answered questions (resume support)
      const newDots: DotState[] = new Array(session.questions.length).fill(null);
      let resumeCorrect = 0;
      let resumeWrong = 0;
      let firstUnanswered = 0;
      session.questions.forEach((q: any, i: number) => {
        if (q.answered) {
          newDots[i] = q.answered.isCorrect;
          if (q.answered.isCorrect) resumeCorrect++;
          else resumeWrong++;
        }
      });
      setDots(newDots);
      setCorrect(resumeCorrect);
      setWrong(resumeWrong);
      // Jump to first unanswered
      firstUnanswered = newDots.findIndex((d) => d === null);
      if (firstUnanswered === -1) firstUnanswered = 0;
      setIndex(firstUnanswered);
    } else {
      setDots(new Array(session.questions.length).fill(null));
    }
  }, [session]);

  // Countdown timer (EXAM mode)
  useEffect(() => {
    if (!session?.timeLimitSec) return;
    const elapsed = Math.floor((Date.now() - session.startedAt) / 1000);
    setTimeLeft(Math.max(0, session.timeLimitSec - elapsed));
    timerRef.current = setInterval(() => {
      setTimeLeft((p) => {
        if (p === null || p <= 1) { if (timerRef.current) clearInterval(timerRef.current); return 0; }
        return p - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [session]);

  // Count-up timer (SCHEDA mode)
  useEffect(() => {
    if (!isScheda || !session) return;
    elapsedRef.current = setInterval(() => {
      setElapsedSec((p) => p + 1);
    }, 1000);
    return () => { if (elapsedRef.current) clearInterval(elapsedRef.current); };
  }, [isScheda, session]);

  useEffect(() => {
    if (timeLeft === 0 && session) completeSession();
  }, [timeLeft]);

  const completeSession = useCallback(async () => {
    if (!session) return;
    try { await regloApi.completeQuizSession(session.sessionId); } catch {}
    if (timerRef.current) clearInterval(timerRef.current);
    if (elapsedRef.current) clearInterval(elapsedRef.current);
    router.replace({ pathname: resultsRoute as never, params: { sessionId: session.sessionId } });
  }, [session, router]);

  const handleAbandon = useCallback(() => {
    Alert.alert('Esci dal quiz?', 'Il progresso non verra salvato.', [
      { text: 'Continua', style: 'cancel' },
      { text: 'Esci', style: 'destructive', onPress: async () => {
        if (session) { try { await regloApi.abandonQuizSession(session.sessionId); } catch {} }
        if (timerRef.current) clearInterval(timerRef.current);
        if (elapsedRef.current) clearInterval(elapsedRef.current);
        clearSession(); router.back();
      }},
    ]);
  }, [session, clearSession, router]);

  // Navigate to a specific question (SCHEDA only)
  const navigateToQuestion = (targetIndex: number) => {
    if (!isScheda || schedaCooldown) return;
    setResult(null);
    setIndex(targetIndex);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };

  const handleTap = (chosen: boolean) => {
    if (!session || result || examAnswering || schedaCooldown) return;
    // SCHEDA: don't allow answering already-answered questions
    if (isScheda && dots[index] !== null) return;

    const q = session.questions[index];
    const isCorrect = chosen === q.correctAnswer;
    const newCorrect = correct + (isCorrect ? 1 : 0);
    const newWrong = wrong + (isCorrect ? 0 : 1);
    setCorrect(newCorrect);
    setWrong(newWrong);

    // Animate button
    const scaleTarget = chosen ? trueScale : falseScale;
    scaleTarget.value = withSequence(
      withSpring(0.88, { damping: 6, stiffness: 300 }),
      withSpring(1, { damping: 12 }),
    );

    // Fire-and-forget
    regloApi.submitQuizAnswer(session.sessionId, { questionId: q.id, answer: chosen }).catch(() => {});

    if (session.mode === 'EXAM') {
      // EXAM mode: no feedback, auto-advance
      setDots((prev) => { const n = [...prev]; n[index] = true; return n; });
      const autoFailed = newWrong > EXAM_MAX_ERRORS;

      if (autoFailed) {
        setExamAutoFailed(true);
        setTimeout(() => {
          if (timerRef.current) clearInterval(timerRef.current);
          router.replace({ pathname: resultsRoute as never, params: { sessionId: session.sessionId } });
        }, 1800);
        return;
      }

      setExamAnswering(true);
      setTimeout(() => {
        setExamAnswering(false);
        if (index >= total - 1) {
          completeSession();
        } else {
          setIndex((i) => i + 1);
          scrollRef.current?.scrollTo({ y: 0, animated: false });
        }
      }, 350);
    } else if (isScheda) {
      // SCHEDA mode: feedback + 2s cooldown + free nav
      setDots((prev) => { const n = [...prev]; n[index] = isCorrect; return n; });
      setResult({ isCorrect, correctAnswer: q.correctAnswer, hint: q.hint, autoFailed: false });
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 200);

      // Auto-fail at 4th error
      if (newWrong > SCHEDA_MAX_ERRORS) {
        setExamAutoFailed(true);
        setTimeout(() => {
          if (elapsedRef.current) clearInterval(elapsedRef.current);
          router.replace({ pathname: resultsRoute as never, params: { sessionId: session.sessionId } });
        }, 1800);
        return;
      }

      // Cooldown
      setSchedaCooldown(true);
      setTimeout(() => setSchedaCooldown(false), SCHEDA_COOLDOWN_MS);
    } else {
      // PRACTICE / CHAPTER / REVIEW: immediate feedback
      setDots((prev) => { const n = [...prev]; n[index] = isCorrect; return n; });
      setResult({ isCorrect, correctAnswer: q.correctAnswer, hint: q.hint, autoFailed: false });
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 200);
    }
  };

  const handleNext = () => {
    setResult(null);
    if (isScheda) {
      // SCHEDA: find next unanswered, or complete if all answered
      const updatedDots = [...dots];
      updatedDots[index] = dots[index]; // already set
      const nextUnanswered = updatedDots.findIndex((d, i) => i > index && d === null);
      const anyUnanswered = updatedDots.findIndex((d) => d === null);

      if (nextUnanswered !== -1) {
        setIndex(nextUnanswered);
      } else if (anyUnanswered !== -1) {
        setIndex(anyUnanswered);
      } else {
        // All answered
        completeSession();
        return;
      }
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    } else {
      if (index >= total - 1) {
        completeSession();
      } else {
        setIndex((i) => i + 1);
        scrollRef.current?.scrollTo({ y: 0, animated: false });
      }
    }
  };

  // SCHEDA: navigate prev/next
  const handleSchedaPrev = () => {
    if (index > 0) navigateToQuestion(index - 1);
  };
  const handleSchedaNext = () => {
    if (index < total - 1) navigateToQuestion(index + 1);
  };

  const trueAnimStyle = useAnimatedStyle(() => ({ transform: [{ scale: trueScale.value }] }));
  const falseAnimStyle = useAnimatedStyle(() => ({ transform: [{ scale: falseScale.value }] }));

  const formatElapsed = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}'${String(s).padStart(2, '0')}''`;
  };

  if (!session) {
    return (
      <View style={[st.root, { paddingTop: insets.top }]}>
        <View style={st.emptyCenter}>
          <Ionicons name="help-circle-outline" size={48} color={colors.textMuted} />
          <Text style={st.emptyText}>Sessione non trovata</Text>
          <Pressable style={st.emptyBtn} onPress={() => router.back()}>
            <Text style={st.emptyBtnText}>Indietro</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const q = session.questions[index];
  const isLast = index >= total - 1;
  const urgent = timeLeft !== null && timeLeft <= 60;
  const isCurrentAnswered = dots[index] !== null;
  const allAnswered = dots.every((d) => d !== null);

  return (
    <View style={[st.root, { paddingTop: insets.top, paddingBottom: insets.bottom || 12 }]}>
      {/* ── Header ── */}
      <View style={st.header}>
        <Pressable onPress={handleAbandon} hitSlop={14} style={st.headerBtn}>
          <Ionicons name="close" size={20} color={colors.textSecondary} />
        </Pressable>

        {/* Countdown timer (EXAM) */}
        {timeLeft !== null && (
          <View style={[st.timerPill, urgent && st.timerPillUrgent]}>
            <Ionicons name="time-outline" size={14} color={urgent ? '#FFF' : colors.textSecondary} />
            <Text style={[st.timerText, urgent && st.timerTextUrgent]}>
              {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
            </Text>
          </View>
        )}

        {/* Count-up timer (SCHEDA) */}
        {isScheda && (
          <View style={st.timerPill}>
            <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
            <Text style={st.timerText}>{formatElapsed(elapsedSec)}</Text>
          </View>
        )}

        <View style={[
          st.headerBadge,
          session.mode === 'EXAM' && st.headerBadgeExam,
          session.mode === 'PRACTICE' && st.headerBadgePractice,
          isScheda && st.headerBadgeScheda,
        ]}>
          <Text style={[
            st.headerBadgeText,
            session.mode === 'EXAM' && st.headerBadgeTextExam,
            session.mode === 'PRACTICE' && st.headerBadgeTextPractice,
            isScheda && st.headerBadgeTextScheda,
          ]}>
            {session.mode === 'EXAM' ? 'Simulazione'
              : session.mode === 'PRACTICE' ? 'Esercitazione'
              : isScheda ? `Scheda ${session.schedaNumber ?? ''}`
              : 'In corso'}
          </Text>
        </View>
      </View>

      {/* ── SCHEDA: chapter subtitle ── */}
      {isScheda && session.chapterDescription && (
        <Text style={st.schedaSubtitle} numberOfLines={1}>{session.chapterDescription}</Text>
      )}

      {/* ── SCHEDA: Tappable question grid ── */}
      {isScheda && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.schedaGridScroll} contentContainerStyle={st.schedaGridContent}>
          {dots.map((d, i) => {
            const isCurrent = i === index;
            return (
              <Pressable
                key={i}
                onPress={() => navigateToQuestion(i)}
                disabled={schedaCooldown && !isCurrent}
                style={[
                  st.schedaDot,
                  d === true && st.schedaDotCorrect,
                  d === false && st.schedaDotWrong,
                  d === null && !isCurrent && st.schedaDotPending,
                  isCurrent && st.schedaDotCurrent,
                ]}
              >
                <Text style={[
                  st.schedaDotText,
                  (d !== null || isCurrent) && st.schedaDotTextActive,
                ]}>
                  {i + 1}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {/* ── Question label ── */}
      <View style={st.questionLabel}>
        <Text style={st.questionLabelText}>DOMANDA {index + 1} DI {total}</Text>
        {session.mode !== 'EXAM' && (
          <View style={st.scoreChip}>
            <Text style={st.scoreChipText}>
              {total > 0 ? Math.round((correct / Math.max(correct + wrong, 1)) * 100) : 0}%
            </Text>
          </View>
        )}
      </View>

      {/* ── Scrollable content ── */}
      <ScrollView
        ref={scrollRef}
        style={st.scrollArea}
        contentContainerStyle={st.scrollContent}
        bounces={false}
        showsVerticalScrollIndicator={false}
      >
        {/* Question card */}
        <View style={st.questionCard}>
          {q.imageUrl && (
            <View style={st.imageWrap}>
              <Image source={{ uri: q.imageUrl }} style={st.questionImage} resizeMode="contain" />
            </View>
          )}
          <Text style={st.questionText}>{q.questionText}</Text>
        </View>

        {/* Auto-fail overlay (EXAM + SCHEDA) */}
        {examAutoFailed && (
          <Animated.View entering={FadeIn.duration(300)} style={st.examFailOverlay}>
            <Ionicons name="alert-circle" size={40} color={colors.destructive} />
            <Text style={st.examFailTitle}>
              {isScheda ? 'NON IDONEO' : 'Simulazione terminata'}
            </Text>
            <Text style={st.examFailSub}>Hai superato il limite di errori consentiti.</Text>
          </Animated.View>
        )}

        {/* SCHEDA: read-only view for already-answered questions */}
        {isScheda && isCurrentAnswered && !result && !examAutoFailed && (
          <Animated.View entering={FadeIn.duration(200)}>
            <View style={[st.resultBanner, dots[index] === true ? st.resultBannerCorrect : st.resultBannerWrong]}>
              <Ionicons
                name={dots[index] === true ? 'checkmark-circle' : 'close-circle'}
                size={22}
                color={dots[index] === true ? '#16A34A' : colors.destructive}
              />
              <Text style={[st.resultBannerText, dots[index] === true ? st.resultTextCorrect : st.resultTextWrong]}>
                {dots[index] === true ? 'Risposta corretta' : `Sbagliato \u2014 la risposta era ${q.correctAnswer ? 'VERO' : 'FALSO'}`}
              </Text>
            </View>
            {q.hint && (
              <View style={st.explanationCard}>
                <View style={st.explanationHeader}>
                  <Ionicons name="bulb-outline" size={16} color={pink[600]} />
                  <Text style={st.explanationTitle}>{q.hint.title}</Text>
                </View>
                <RenderHtml
                  contentWidth={width - spacing.md * 4 - 8}
                  source={{ html: q.hint.descriptionHtml }}
                  baseStyle={st.explanationHtml as any}
                />
              </View>
            )}
          </Animated.View>
        )}

        {/* Answer buttons (only if not answered yet and not auto-failed) */}
        {!result && !examAutoFailed && !(isScheda && isCurrentAnswered) ? (
          <View style={st.answerRow}>
            <Animated.View style={[st.answerBtnWrap, trueAnimStyle]}>
              <Pressable
                style={({ pressed }) => [st.answerBtn, st.answerBtnTrue, pressed && st.answerBtnPressed]}
                onPress={() => handleTap(true)}
                disabled={examAnswering || schedaCooldown}
              >
                <Ionicons name="checkmark-circle-outline" size={28} color="#16A34A" />
                <Text style={st.answerBtnTrueText}>VERO</Text>
              </Pressable>
            </Animated.View>
            <Animated.View style={[st.answerBtnWrap, falseAnimStyle]}>
              <Pressable
                style={({ pressed }) => [st.answerBtn, st.answerBtnFalse, pressed && st.answerBtnPressed]}
                onPress={() => handleTap(false)}
                disabled={examAnswering || schedaCooldown}
              >
                <Ionicons name="close-circle-outline" size={28} color={colors.destructive} />
                <Text style={st.answerBtnFalseText}>FALSO</Text>
              </Pressable>
            </Animated.View>
          </View>
        ) : !examAutoFailed && result ? (
          <Animated.View entering={FadeInDown.duration(280).springify()}>
            {/* Result banner */}
            <View style={[st.resultBanner, result.isCorrect ? st.resultBannerCorrect : st.resultBannerWrong]}>
              <Ionicons
                name={result.isCorrect ? 'checkmark-circle' : 'close-circle'}
                size={22}
                color={result.isCorrect ? '#16A34A' : colors.destructive}
              />
              <Text style={[st.resultBannerText, result.isCorrect ? st.resultTextCorrect : st.resultTextWrong]}>
                {result.isCorrect ? 'Corretto!' : `Sbagliato \u2014 la risposta era ${result.correctAnswer ? 'VERO' : 'FALSO'}`}
              </Text>
            </View>

            {/* Explanation */}
            {result.hint && (
              <Animated.View entering={FadeIn.delay(100).duration(250)} style={st.explanationCard}>
                <View style={st.explanationHeader}>
                  <Ionicons name="bulb-outline" size={16} color={pink[600]} />
                  <Text style={st.explanationTitle}>{result.hint.title}</Text>
                </View>
                <RenderHtml
                  contentWidth={width - spacing.md * 4 - 8}
                  source={{ html: result.hint.descriptionHtml }}
                  baseStyle={st.explanationHtml as any}
                />
              </Animated.View>
            )}

            {/* Next / Complete button */}
            <Pressable
              style={({ pressed }) => [
                st.nextBtn,
                schedaCooldown && st.nextBtnDisabled,
                pressed && !schedaCooldown && { opacity: 0.85, transform: [{ scale: 0.98 }] },
              ]}
              onPress={handleNext}
              disabled={schedaCooldown}
            >
              <Text style={st.nextBtnText}>
                {isScheda
                  ? (allAnswered ? 'Vedi risultati' : 'Avanti')
                  : (isLast ? 'Vedi risultati' : 'Avanti')}
              </Text>
              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
            </Pressable>
          </Animated.View>
        ) : null}

        {/* ── SCHEDA: prev/next nav + complete button ── */}
        {isScheda && !result && !examAutoFailed && (
          <View style={st.schedaNav}>
            <Pressable
              onPress={handleSchedaPrev}
              disabled={index === 0 || schedaCooldown}
              style={({ pressed }) => [st.schedaNavBtn, (index === 0 || schedaCooldown) && st.schedaNavBtnDisabled, pressed && { opacity: 0.7 }]}
            >
              <Ionicons name="chevron-back" size={18} color={index === 0 ? colors.textMuted : colors.primary} />
              <Text style={[st.schedaNavBtnText, index === 0 && { color: colors.textMuted }]}>Precedente</Text>
            </Pressable>
            {allAnswered && (
              <Pressable
                onPress={completeSession}
                style={({ pressed }) => [st.schedaCompleteBtn, pressed && { opacity: 0.85 }]}
              >
                <Text style={st.schedaCompleteBtnText}>Termina</Text>
              </Pressable>
            )}
            <Pressable
              onPress={handleSchedaNext}
              disabled={index >= total - 1 || schedaCooldown}
              style={({ pressed }) => [st.schedaNavBtn, (index >= total - 1 || schedaCooldown) && st.schedaNavBtnDisabled, pressed && { opacity: 0.7 }]}
            >
              <Text style={[st.schedaNavBtnText, index >= total - 1 && { color: colors.textMuted }]}>Successiva</Text>
              <Ionicons name="chevron-forward" size={18} color={index >= total - 1 ? colors.textMuted : colors.primary} />
            </Pressable>
          </View>
        )}

        {/* ── Progress Monitor (numbered dots) — non-SCHEDA only ── */}
        {!isScheda && (
          <View style={st.progressMonitor}>
            <Text style={st.progressMonitorTitle}>Progresso</Text>
            <View style={st.dotsGrid}>
              {dots.map((d, i) => {
                const isCurrent = i === index && !result && !examAnswering;
                const isExam = session.mode === 'EXAM';
                const answered = d !== null;
                return (
                  <View
                    key={i}
                    style={[
                      st.dot,
                      isExam
                        ? (answered ? st.dotExamAnswered : (isCurrent ? st.dotCurrent : st.dotPending))
                        : (d === true ? st.dotCorrect : d === false ? st.dotWrong : (isCurrent ? st.dotCurrent : st.dotPending)),
                    ]}
                  >
                    <Text style={[
                      st.dotText,
                      isExam
                        ? (answered ? st.dotTextDone : (isCurrent ? st.dotTextCurrent : undefined))
                        : (d !== null ? st.dotTextDone : (isCurrent ? st.dotTextCurrent : undefined)),
                    ]}>
                      {i + 1}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* SCHEDA: error counter */}
        {isScheda && !examAutoFailed && (
          <View style={st.schedaErrorRow}>
            <Text style={st.schedaErrorLabel}>Errori: </Text>
            <Text style={[st.schedaErrorCount, wrong > SCHEDA_MAX_ERRORS && { color: colors.destructive }]}>
              {wrong}/{SCHEDA_MAX_ERRORS + 1}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const DOT_SIZE = 36;
const SCHEDA_DOT_SIZE = 32;

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },
  emptyCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { fontSize: 15, fontWeight: '500', color: colors.textSecondary },
  emptyBtn: { paddingVertical: 10, paddingHorizontal: 24, borderRadius: 12, backgroundColor: pink[50] },
  emptyBtnText: { fontSize: 14, fontWeight: '600', color: colors.primary },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: 8,
  },
  headerBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center',
  },
  timerPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingVertical: 5, paddingHorizontal: 12, borderRadius: 24,
    backgroundColor: pink[50],
    shadowColor: pink[200], shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, shadowRadius: 6, elevation: 2,
  },
  timerPillUrgent: { backgroundColor: colors.destructive },
  timerText: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, fontVariant: ['tabular-nums'] },
  timerTextUrgent: { color: '#FFFFFF' },
  headerBadge: {
    paddingVertical: 4, paddingHorizontal: 12, borderRadius: 12,
    backgroundColor: '#DCFCE7',
  },
  headerBadgeExam: { backgroundColor: '#FEF2F2' },
  headerBadgePractice: { backgroundColor: '#F0FDF4' },
  headerBadgeScheda: { backgroundColor: pink[50] },
  headerBadgeText: { fontSize: 12, fontWeight: '700', color: '#16A34A' },
  headerBadgeTextExam: { color: colors.destructive },
  headerBadgeTextPractice: { color: '#16A34A' },
  headerBadgeTextScheda: { color: pink[600] },

  // SCHEDA subtitle
  schedaSubtitle: {
    fontSize: 12, fontWeight: '600', color: colors.textSecondary,
    paddingHorizontal: spacing.md, marginBottom: 4,
  },

  // SCHEDA question grid (horizontal scroll)
  schedaGridScroll: { maxHeight: SCHEDA_DOT_SIZE + 12, marginBottom: 4 },
  schedaGridContent: { paddingHorizontal: spacing.md, gap: 6, alignItems: 'center' },
  schedaDot: {
    width: SCHEDA_DOT_SIZE, height: SCHEDA_DOT_SIZE, borderRadius: SCHEDA_DOT_SIZE / 2,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1.5,
  },
  schedaDotPending: { backgroundColor: '#FFFFFF', borderColor: '#E5E7EB' },
  schedaDotCurrent: { backgroundColor: pink[50], borderColor: colors.primary },
  schedaDotCorrect: { backgroundColor: '#DCFCE7', borderColor: '#16A34A' },
  schedaDotWrong: { backgroundColor: '#FEE2E2', borderColor: colors.destructive },
  schedaDotText: { fontSize: 11, fontWeight: '700', color: colors.textMuted },
  schedaDotTextActive: { color: '#1A1A2E' },

  // Question label
  questionLabel: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: 6,
  },
  questionLabelText: {
    fontSize: 12, fontWeight: '700', color: colors.textMuted,
    letterSpacing: 1, textTransform: 'uppercase',
  },
  scoreChip: {
    paddingVertical: 2, paddingHorizontal: 8, borderRadius: 8,
    backgroundColor: pink[50],
  },
  scoreChipText: { fontSize: 14, fontWeight: '800', color: pink[600] },

  // Scroll
  scrollArea: { flex: 1 },
  scrollContent: { padding: spacing.md, gap: 16, paddingBottom: 40 },

  // Question card
  questionCard: {
    borderRadius: 24, overflow: 'hidden',
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#F0F0F5',
    shadowColor: pink[200], shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18, shadowRadius: 16, elevation: 5,
  },
  imageWrap: {
    backgroundColor: '#1A1A2E', paddingVertical: 20, alignItems: 'center',
  },
  questionImage: { width: '80%', height: 160 },
  questionText: {
    fontSize: 18, fontWeight: '700', color: '#1A1A2E',
    lineHeight: 26, letterSpacing: -0.2,
    padding: 20,
  },

  // Answer buttons
  answerRow: { flexDirection: 'row', gap: 14 },
  answerBtnWrap: { flex: 1 },
  answerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    paddingVertical: 20, borderRadius: 28, borderWidth: 2,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  answerBtnTrue: { borderColor: '#BBF7D0' },
  answerBtnFalse: { borderColor: '#FECACA' },
  answerBtnPressed: { opacity: 0.7, transform: [{ scale: 0.96 }] },
  answerBtnTrueText: { fontSize: 16, fontWeight: '800', color: '#16A34A', letterSpacing: 1 },
  answerBtnFalseText: { fontSize: 16, fontWeight: '800', color: colors.destructive, letterSpacing: 1 },

  // Result banner
  resultBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 14, paddingHorizontal: 16, borderRadius: 24,
    marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  resultBannerCorrect: { backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#BBF7D0' },
  resultBannerWrong: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA' },
  resultBannerText: { fontSize: 15, fontWeight: '700', flex: 1 },
  resultTextCorrect: { color: '#16A34A' },
  resultTextWrong: { color: colors.destructive },

  // Explanation
  explanationCard: {
    padding: 16, borderRadius: 24,
    backgroundColor: pink[50], gap: 8, marginBottom: 12,
    borderWidth: 1, borderColor: pink[100],
    shadowColor: pink[300], shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1, shadowRadius: 10, elevation: 3,
  },
  explanationHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  explanationTitle: { fontSize: 14, fontWeight: '700', color: pink[700] },
  explanationHtml: { fontSize: 13, color: '#4A4458', lineHeight: 19 },

  // Next button
  nextBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 16, borderRadius: 26, backgroundColor: colors.primary,
    shadowColor: 'rgba(236, 72, 153, 0.45)', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1, shadowRadius: 18, elevation: 5,
  },
  nextBtnDisabled: { opacity: 0.5 },
  nextBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },

  // Auto-fail overlay
  examFailOverlay: {
    alignItems: 'center', gap: 10, paddingVertical: 32, paddingHorizontal: 24,
    borderRadius: 24, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA',
  },
  examFailTitle: { fontSize: 18, fontWeight: '800', color: '#1A1A2E' },
  examFailSub: { fontSize: 14, fontWeight: '500', color: colors.textSecondary, textAlign: 'center' },

  // SCHEDA navigation
  schedaNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 8,
  },
  schedaNavBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingVertical: 8, paddingHorizontal: 12,
  },
  schedaNavBtnDisabled: { opacity: 0.4 },
  schedaNavBtnText: { fontSize: 14, fontWeight: '600', color: colors.primary },
  schedaCompleteBtn: {
    paddingVertical: 8, paddingHorizontal: 16, borderRadius: 16,
    backgroundColor: colors.primary,
  },
  schedaCompleteBtnText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },

  // SCHEDA error counter
  schedaErrorRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 8,
  },
  schedaErrorLabel: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  schedaErrorCount: { fontSize: 13, fontWeight: '800', color: colors.textPrimary },

  // Progress Monitor (non-SCHEDA)
  progressMonitor: { marginTop: 8, gap: 10 },
  progressMonitorTitle: {
    fontSize: 13, fontWeight: '700', color: colors.textMuted,
    letterSpacing: 0.5, textTransform: 'uppercase',
  },
  dotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dot: {
    width: DOT_SIZE, height: DOT_SIZE, borderRadius: DOT_SIZE / 2,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5,
  },
  dotPending: { backgroundColor: '#FFFFFF', borderColor: '#E5E7EB' },
  dotCurrent: { backgroundColor: pink[50], borderColor: colors.primary },
  dotCorrect: { backgroundColor: '#DCFCE7', borderColor: '#16A34A' },
  dotWrong: { backgroundColor: '#FEE2E2', borderColor: colors.destructive },
  dotExamAnswered: { backgroundColor: pink[50], borderColor: pink[200] },
  dotText: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  dotTextCurrent: { color: colors.primary },
  dotTextDone: { color: '#1A1A2E' },
});
