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
  SlideInRight,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from '../utils/haptics';
import { usePathname, useRouter } from 'expo-router';
import { quizHintStore } from '../stores/quizHintStore';
import RenderHtml from 'react-native-render-html';
import { useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../theme';
import { regloApi } from '../services/regloApi';
import { useQuiz } from '../context/QuizContext';
import { SwipeQuizCard, SwipeQuizCardRef } from '../components/SwipeQuizCard';
import { GradientCTABackground } from '../components/GradientCTA';

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
  const swipeCardRef = useRef<SwipeQuizCardRef>(null);

  // SCHEDA-specific state
  const [elapsedSec, setElapsedSec] = useState(0);
  const [schedaCooldown, setSchedaCooldown] = useState(false);
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const trueScale = useSharedValue(1);
  const falseScale = useSharedValue(1);

  // Card feedback animations (learning modes only)
  const cardShakeX = useSharedValue(0);
  const cardBorderColor = useSharedValue(0); // 0=neutral, 1=green, -1=red
  const cardScale = useSharedValue(1);
  const [streak, setStreak] = useState(0);
  const [cardKey, setCardKey] = useState(0); // forces remount for slide animation

  const isLearningMode = session?.mode === 'PRACTICE' || session?.mode === 'CHAPTER' || session?.mode === 'REVIEW' || session?.mode === 'SCHEDA';

  const cardFeedbackStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: cardShakeX.value },
      { scale: cardScale.value },
    ],
    borderColor: cardBorderColor.value > 0.5 ? '#16A34A'
      : cardBorderColor.value < -0.5 ? '#EF4444'
      : '#F0F0F5',
    borderWidth: Math.abs(cardBorderColor.value) > 0.1 ? 2 : 1,
  }));

  const isScheda = session?.mode === 'SCHEDA';
  const isSchedaEsame = session?.mode === 'SCHEDA_ESAME';
  const total = session?.questions.length ?? 0;

  // Initialize dots + restore SCHEDA/SCHEDA_ESAME resume state
  useEffect(() => {
    if (!session) return;
    if (isScheda || isSchedaEsame) {
      // Restore dots from answered questions (resume support)
      const newDots: DotState[] = new Array(session.questions.length).fill(null);
      let resumeCorrect = 0;
      let resumeWrong = 0;
      let firstUnanswered = 0;
      session.questions.forEach((q: any, i: number) => {
        if (q.answered) {
          newDots[i] = isSchedaEsame ? true : q.answered.isCorrect; // SCHEDA_ESAME: neutral dots
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
    // SCHEDA/SCHEDA_ESAME: don't allow answering already-answered questions
    if ((isScheda || isSchedaEsame) && dots[index] !== null) return;

    const q = session.questions[index];
    const isCorrect = chosen === q.correctAnswer;
    const newCorrect = correct + (isCorrect ? 1 : 0);
    const newWrong = wrong + (isCorrect ? 0 : 1);
    setCorrect(newCorrect);
    setWrong(newWrong);

    // Haptic on tap (all modes)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    // Subtle button feedback (no bounce)
    const scaleTarget = chosen ? trueScale : falseScale;
    scaleTarget.value = withSequence(
      withTiming(0.95, { duration: 80 }),
      withTiming(1, { duration: 150 }),
    );

    // Card feedback animation (learning modes)
    if (isLearningMode) {
      if (isCorrect) {
        // Success: pulse green border + slight scale
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        cardBorderColor.value = withSequence(
          withTiming(1, { duration: 100 }),
          withTiming(0, { duration: 600 }),
        );
        cardScale.value = withSequence(
          withSpring(1.015, { damping: 8, stiffness: 400 }),
          withSpring(1, { damping: 14 }),
        );
        setStreak((s) => s + 1);
      } else {
        // Error: shake + red border flash
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        cardBorderColor.value = withSequence(
          withTiming(-1, { duration: 80 }),
          withTiming(0, { duration: 500 }),
        );
        cardShakeX.value = withSequence(
          withTiming(-8, { duration: 50 }),
          withTiming(8, { duration: 50 }),
          withTiming(-6, { duration: 50 }),
          withTiming(6, { duration: 50 }),
          withTiming(0, { duration: 50 }),
        );
        setStreak(0);
      }
    }

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
    } else if (isSchedaEsame) {
      // SCHEDA_ESAME: like EXAM (sequential, no feedback, neutral dots) but NO auto-fail
      setDots((prev) => { const n = [...prev]; n[index] = true; return n; });

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
    // Reset card feedback values
    cardBorderColor.value = 0;
    cardShakeX.value = 0;
    cardScale.value = 1;
    if (isLearningMode) setCardKey((k) => k + 1);
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

  // Swipe-based answer handler (learning modes)
  const handleSwipeAnswer = useCallback((answer: boolean) => {
    if (!session || result || examAutoFailed) return;
    const q = session.questions[index];
    const isCorrect = answer === q.correctAnswer;
    const newCorrect = correct + (isCorrect ? 1 : 0);
    const newWrong = wrong + (isCorrect ? 0 : 1);
    setCorrect(newCorrect);
    setWrong(newWrong);

    if (isCorrect) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setStreak((s) => s + 1);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setStreak(0);
    }

    setDots((prev) => { const n = [...prev]; n[index] = isCorrect; return n; });
    regloApi.submitQuizAnswer(session.sessionId, { questionId: q.id, answer }).catch(() => {});

    // SCHEDA auto-fail at 4th error (same logic as classic mode)
    if (isScheda && newWrong > SCHEDA_MAX_ERRORS) {
      setExamAutoFailed(true);
      setResult({ isCorrect, correctAnswer: q.correctAnswer, hint: q.hint, autoFailed: true });
      setTimeout(() => {
        if (elapsedRef.current) clearInterval(elapsedRef.current);
        router.replace({ pathname: resultsRoute as never, params: { sessionId: session.sessionId } });
      }, 1800);
      return;
    }

    setResult({ isCorrect, correctAnswer: q.correctAnswer, hint: q.hint, autoFailed: false });
  }, [session, index, correct, wrong, result, isScheda, examAutoFailed]);

  const handleSwipeNext = useCallback(() => {
    setResult(null);
    if (index >= total - 1) {
      completeSession();
    } else {
      setIndex((i) => i + 1);
    }
  }, [index, total, completeSession]);

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

        {/* Countdown timer (EXAM) — centered */}
        {timeLeft !== null && (
          <View style={st.timerPill}>
            <View style={[st.timerInner, urgent && st.timerPillUrgent]}>
              <Ionicons name="time-outline" size={14} color={urgent ? '#FFF' : colors.textSecondary} />
              <Text style={[st.timerText, urgent && st.timerTextUrgent]}>
                {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
              </Text>
            </View>
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
          (session.mode === 'EXAM' || isSchedaEsame) && st.headerBadgeExam,
          session.mode === 'PRACTICE' && st.headerBadgePractice,
          isScheda && st.headerBadgeScheda,
        ]}>
          <Text style={[
            st.headerBadgeText,
            (session.mode === 'EXAM' || isSchedaEsame) && st.headerBadgeTextExam,
            session.mode === 'PRACTICE' && st.headerBadgeTextPractice,
            isScheda && st.headerBadgeTextScheda,
          ]}>
            {session.mode === 'EXAM' ? 'Simulazione'
              : isSchedaEsame ? `Scheda Esame ${session.schedaNumber ?? ''}`
              : session.mode === 'PRACTICE' ? 'Esercitazione'
              : isScheda ? `Scheda ${session.schedaNumber ?? ''}`
              : 'In corso'}
          </Text>
        </View>
      </View>

      {/* ═══ SWIPE MODE (PRACTICE / CHAPTER / REVIEW) ═══ */}
      {isLearningMode && (
        <>
          {/* Progress row */}
          <View style={st.swipeHeader}>
            <Text style={st.swipeCounter}>{index + 1} / {total}</Text>
            <View style={st.questionLabelRight}>
              {streak >= 3 && (
                <Animated.View entering={FadeIn.duration(200)} style={st.streakBadge}>
                  <Text style={st.streakText}>{streak}</Text>
                  <Ionicons name="flame" size={13} color="#F59E0B" />
                </Animated.View>
              )}
              <View style={st.scoreChip}>
                <Text style={st.scoreChipText}>
                  {total > 0 ? Math.round((correct / Math.max(correct + wrong, 1)) * 100) : 0}%
                </Text>
              </View>
            </View>
          </View>

          {/* Progress bar */}
          <View style={st.swipeProgressTrack}>
            <View style={[st.swipeProgressFill, { width: `${Math.round(((index + (result ? 1 : 0)) / total) * 100)}%` }]} />
          </View>

          {examAutoFailed ? (
            /* ── Auto-fail overlay (SCHEDA swipe mode) ── */
            <View style={st.swipeArea}>
              <Animated.View entering={FadeIn.duration(300)} style={st.swipeAutoFail}>
                <Ionicons name="alert-circle" size={48} color={colors.destructive} />
                <Text style={st.swipeAutoFailTitle}>NON IDONEO</Text>
                <Text style={st.swipeAutoFailSub}>Hai superato il limite di errori consentiti.</Text>
              </Animated.View>
            </View>
          ) : !result ? (
            /* ── Swipe card ── */
            <View style={st.swipeArea}>
              <SwipeQuizCard
                ref={swipeCardRef}
                key={index}
                question={q}
                nextQuestion={index < total - 1 ? session.questions[index + 1] : null}
                onAnswer={handleSwipeAnswer}
              />
              {/* Fallback buttons — tap triggers card flyout animation */}
              <View style={[st.swipeBtnRow, { marginBottom: insets.bottom + 60 }]}>
                <Pressable
                  onPress={() => swipeCardRef.current?.flyOut(false)}
                  style={({ pressed }) => [st.swipeBtn, st.swipeBtnFalse, pressed && { opacity: 0.7, transform: [{ scale: 0.92 }] }]}
                >
                  <Ionicons name="close" size={24} color={colors.destructive} />
                </Pressable>
                <Pressable
                  onPress={() => swipeCardRef.current?.flyOut(true)}
                  style={({ pressed }) => [st.swipeBtn, st.swipeBtnTrue, pressed && { opacity: 0.7, transform: [{ scale: 0.92 }] }]}
                >
                  <Ionicons name="checkmark" size={24} color="#16A34A" />
                </Pressable>
              </View>
            </View>
          ) : (
            /* ── Feedback: tap anywhere to advance ── */
            <Pressable style={st.swipeArea} onPress={() => handleSwipeNext()}>
              <Animated.View entering={FadeIn.duration(200)} style={[
                st.feedbackCard,
                result.isCorrect ? st.feedbackCardCorrect : st.feedbackCardWrong,
              ]}>
                <View style={st.feedbackTop}>
                  <View style={[st.feedbackIcon, result.isCorrect ? { backgroundColor: '#DCFCE7' } : { backgroundColor: '#FEE2E2' }]}>
                    <Ionicons
                      name={result.isCorrect ? 'checkmark' : 'close'}
                      size={28}
                      color={result.isCorrect ? '#16A34A' : colors.destructive}
                    />
                  </View>
                  <Text style={[st.feedbackTitle, result.isCorrect ? { color: '#16A34A' } : { color: colors.destructive }]}>
                    {result.isCorrect ? 'Corretto!' : 'Sbagliato'}
                  </Text>
                  {!result.isCorrect && (
                    <Text style={st.feedbackAnswer}>
                      La risposta era {result.correctAnswer ? 'VERO' : 'FALSO'}
                    </Text>
                  )}
                </View>

                {/* Hint preview — truncated, with "read more" */}
                {result.hint && (
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation;
                      if (result?.hint) {
                        quizHintStore.set({ title: result.hint.title, descriptionHtml: result.hint.descriptionHtml });
                        router.push('/(tabs)/home/quiz-hint');
                      }
                    }}
                    style={st.feedbackHintPreview}
                  >
                    <Ionicons name="bulb-outline" size={16} color={colors.textSecondary} />
                    <Text style={st.feedbackHintPreviewTitle} numberOfLines={1}>{result.hint.title}</Text>
                    <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                  </Pressable>
                )}

                <Text style={st.feedbackTapHint}>Tocca per continuare</Text>
              </Animated.View>
            </Pressable>
          )}

          {/* Hint — now an Expo Router formSheet at /(tabs)/home/quiz-hint */}
        </>
      )}

      {/* ═══ CLASSIC MODE (EXAM / SCHEDA_ESAME / SCHEDA) ═══ */}
      {!isLearningMode && (
      <>

      {/* ── SCHEDA: chapter subtitle ── */}
      {isScheda && !isSchedaEsame && session.chapterDescription && (
        <Text style={st.schedaSubtitle} numberOfLines={1}>{session.chapterDescription}</Text>
      )}

      {/* ── SCHEDA: Tappable question grid ── */}
      {isScheda && !isSchedaEsame && (
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
        <View style={st.questionLabelRight}>
          {isLearningMode && streak >= 3 && (
            <Animated.View entering={FadeIn.duration(200)} style={st.streakBadge}>
              <Text style={st.streakText}>{streak}</Text>
              <Ionicons name="flame" size={13} color="#F59E0B" />
            </Animated.View>
          )}
          {session.mode !== 'EXAM' && !isSchedaEsame && (
            <View style={st.scoreChip}>
              <Text style={st.scoreChipText}>
                {total > 0 ? Math.round((correct / Math.max(correct + wrong, 1)) * 100) : 0}%
              </Text>
            </View>
          )}
        </View>
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
        <Animated.View
          key={isLearningMode ? cardKey : index}
          entering={isLearningMode && cardKey > 0 ? SlideInRight.duration(250).springify() : FadeIn.duration(200)}
          style={[st.questionCard, isLearningMode ? cardFeedbackStyle : undefined]}
        >
          {q.imageUrl && (
            <View style={st.imageWrap}>
              <Image source={{ uri: q.imageUrl }} style={st.questionImage} resizeMode="contain" />
            </View>
          )}
          <Text style={st.questionText}>{q.questionText}</Text>
          {(session.mode === 'REVIEW' || session.mode === 'PRACTICE') && q.wrongCount != null && q.wrongCount > 0 && (
            <View style={[
              st.errorFreqPill,
              q.correctRate != null && q.correctRate < 40 ? st.errorFreqRed
                : q.correctRate != null && q.correctRate < 70 ? st.errorFreqOrange
                : st.errorFreqGray,
            ]}>
              <Ionicons name="warning" size={12} color={
                q.correctRate != null && q.correctRate < 40 ? colors.destructive
                  : q.correctRate != null && q.correctRate < 70 ? '#F59E0B'
                  : colors.textMuted
              } />
              <Text style={[
                st.errorFreqText,
                q.correctRate != null && q.correctRate < 40 ? { color: colors.destructive }
                  : q.correctRate != null && q.correctRate < 70 ? { color: '#F59E0B' }
                  : { color: colors.textMuted },
              ]}>
                Sbagliato {q.wrongCount}/{q.timesAnswered ?? 0} volt{q.wrongCount === 1 ? 'a' : 'e'}
              </Text>
            </View>
          )}
        </Animated.View>

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

        {/* SCHEDA: read-only view for already-answered questions (not SCHEDA_ESAME) */}
        {isScheda && !isSchedaEsame && isCurrentAnswered && !result && !examAutoFailed && (
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
                  <Ionicons name="bulb-outline" size={16} color={colors.textSecondary} />
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
        {!result && !examAutoFailed && !((isScheda || isSchedaEsame) && isCurrentAnswered) ? (
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
                  <Ionicons name="bulb-outline" size={16} color={colors.textSecondary} />
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
              <GradientCTABackground radius={26} />
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
        {isScheda && !isSchedaEsame && !result && !examAutoFailed && (
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
                <GradientCTABackground radius={16} />
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
                const isExam = session.mode === 'EXAM' || isSchedaEsame;
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

        {/* SCHEDA: error counter (not for SCHEDA_ESAME) */}
        {isScheda && !isSchedaEsame && !examAutoFailed && (
          <View style={st.schedaErrorRow}>
            <Text style={st.schedaErrorLabel}>Errori: </Text>
            <Text style={[st.schedaErrorCount, wrong > SCHEDA_MAX_ERRORS && { color: colors.destructive }]}>
              {wrong}/{SCHEDA_MAX_ERRORS + 1}
            </Text>
          </View>
        )}
      </ScrollView>
      </>
      )}
    </View>
  );
};

const DOT_SIZE = 36;
const SCHEDA_DOT_SIZE = 32;

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },
  emptyCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { fontSize: 15, fontWeight: '500', color: colors.textSecondary },
  emptyBtn: { paddingVertical: 10, paddingHorizontal: 24, borderRadius: 12, backgroundColor: '#F3F4F6' },
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
    position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    pointerEvents: 'none',
  },
  timerInner: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingVertical: 5, paddingHorizontal: 12, borderRadius: 24,
    backgroundColor: '#F3F4F6',
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
  headerBadgeScheda: { backgroundColor: '#F3F4F6' },
  headerBadgeText: { fontSize: 12, fontWeight: '700', color: '#16A34A' },
  headerBadgeTextExam: { color: colors.destructive },
  headerBadgeTextPractice: { color: '#16A34A' },
  headerBadgeTextScheda: { color: colors.textSecondary },

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
  schedaDotCurrent: { backgroundColor: '#F3F4F6', borderColor: '#1A1A2E' },
  schedaDotCorrect: { backgroundColor: '#DCFCE7', borderColor: '#16A34A' },
  schedaDotWrong: { backgroundColor: '#FEE2E2', borderColor: colors.destructive },
  schedaDotText: { fontSize: 11, fontWeight: '700', color: colors.textMuted },
  schedaDotTextActive: { color: '#1A1A2E' },

  // Swipe mode
  swipeHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: 4,
  },
  swipeCounter: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  swipeProgressTrack: {
    height: 3, backgroundColor: '#F0F0F5', marginHorizontal: spacing.md, borderRadius: 1.5,
    overflow: 'hidden', marginBottom: 4,
  },
  swipeProgressFill: {
    height: '100%', backgroundColor: '#1A1A2E', borderRadius: 1.5,
  },
  swipeArea: { flex: 1 },
  swipeBtnRow: {
    flexDirection: 'row', justifyContent: 'center', gap: 48,
    paddingTop: 12, paddingBottom: 24,
  },
  swipeBtn: {
    width: 60, height: 60, borderRadius: 30,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, backgroundColor: '#FFFFFF',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08, shadowRadius: 10, elevation: 4,
  },
  swipeBtnTrue: { borderColor: '#BBF7D0' },
  swipeBtnFalse: { borderColor: '#FECACA' },

  // Auto-fail overlay (swipe mode)
  swipeAutoFail: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12,
    marginHorizontal: spacing.md,
    borderRadius: 24, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA',
  },
  swipeAutoFailTitle: { fontSize: 22, fontWeight: '800', color: '#1A1A2E' },
  swipeAutoFailSub: { fontSize: 14, fontWeight: '500', color: colors.textSecondary, textAlign: 'center', paddingHorizontal: 24 },

  // Feedback card (tap-anywhere)
  feedbackCard: {
    flex: 1, marginHorizontal: spacing.md, borderRadius: 24,
    padding: 24, gap: 16, justifyContent: 'center', alignItems: 'center',
  },
  feedbackCardCorrect: { backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#BBF7D0' },
  feedbackCardWrong: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA' },
  feedbackTop: { alignItems: 'center', gap: 8 },
  feedbackIcon: {
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
  },
  feedbackTitle: { fontSize: 24, fontWeight: '800', letterSpacing: -0.3 },
  feedbackAnswer: { fontSize: 15, fontWeight: '600', color: colors.textSecondary },
  feedbackHintPreview: {
    flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'stretch',
    backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  feedbackHintPreviewTitle: {
    flex: 1, fontSize: 14, fontWeight: '600', color: colors.textPrimary,
  },
  feedbackTapHint: {
    textAlign: 'center', fontSize: 13, fontWeight: '500',
    color: colors.textMuted, marginTop: 4,
  },


  // Question label
  questionLabel: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: 6,
  },
  questionLabelText: {
    fontSize: 12, fontWeight: '700', color: colors.textMuted,
    letterSpacing: 1, textTransform: 'uppercase',
  },
  questionLabelRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  streakBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingVertical: 2, paddingHorizontal: 8, borderRadius: 10,
    backgroundColor: '#FEF3C7',
  },
  streakText: { fontSize: 13, fontWeight: '800', color: '#CA8A04' },
  scoreChip: {
    paddingVertical: 2, paddingHorizontal: 8, borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  scoreChipText: { fontSize: 14, fontWeight: '800', color: colors.textPrimary },

  // Scroll
  scrollArea: { flex: 1 },
  scrollContent: { padding: spacing.md, gap: 16, paddingBottom: 40 },

  // Question card
  questionCard: {
    borderRadius: 24, overflow: 'hidden',
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#F0F0F5',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 14, elevation: 5,
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
  errorFreqPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    marginHorizontal: 20, marginTop: -12, marginBottom: 16,
    paddingVertical: 4, paddingHorizontal: 10, borderRadius: 10,
    alignSelf: 'flex-start',
  },
  errorFreqRed: { backgroundColor: '#FEF2F2' },
  errorFreqOrange: { backgroundColor: '#FFFBEB' },
  errorFreqGray: { backgroundColor: '#F3F4F6' },
  errorFreqText: { fontSize: 12, fontWeight: '700' },

  // Answer buttons
  answerRow: { flexDirection: 'row', gap: 14 },
  answerBtnWrap: { flex: 1 },
  answerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 16, borderRadius: 16, borderWidth: 1.5,
    backgroundColor: '#FFFFFF',
  },
  answerBtnTrue: { borderColor: '#D1FAE5' },
  answerBtnFalse: { borderColor: '#FEE2E2' },
  answerBtnPressed: { opacity: 0.7 },
  answerBtnTrueText: { fontSize: 15, fontWeight: '700', color: '#16A34A' },
  answerBtnFalseText: { fontSize: 15, fontWeight: '700', color: colors.destructive },

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
    backgroundColor: colors.background, gap: 8, marginBottom: 12,
    borderWidth: 1, borderColor: '#E5E7EB',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  explanationHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  explanationTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  explanationHtml: { fontSize: 13, color: '#4A4458', lineHeight: 19 },

  // Next button
  nextBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 16, borderRadius: 26,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 12, elevation: 5,
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
  schedaNavBtnText: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  schedaCompleteBtn: {
    paddingVertical: 8, paddingHorizontal: 16, borderRadius: 16,
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
  dotCurrent: { backgroundColor: '#F3F4F6', borderColor: '#1A1A2E' },
  dotCorrect: { backgroundColor: '#DCFCE7', borderColor: '#16A34A' },
  dotWrong: { backgroundColor: '#FEE2E2', borderColor: colors.destructive },
  dotExamAnswered: { backgroundColor: '#F3F4F6', borderColor: '#D1D5DB' },
  dotText: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  dotTextCurrent: { color: '#1A1A2E' },
  dotTextDone: { color: '#1A1A2E' },
});
