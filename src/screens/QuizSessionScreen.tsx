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
import { useRouter } from 'expo-router';
import RenderHtml from 'react-native-render-html';
import { useWindowDimensions } from 'react-native';
import { Screen } from '../components/Screen';
import { Button } from '../components/Button';
import { colors, pink, spacing, typography } from '../theme';
import { regloApi } from '../services/regloApi';
import { useQuiz } from '../context/QuizContext';
import type { SubmitQuizAnswerResult } from '../types/regloApi';

export const QuizSessionScreen = () => {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { session, clearSession } = useQuiz();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [answering, setAnswering] = useState(false);
  const [feedback, setFeedback] = useState<SubmitQuizAnswerResult | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Timer for EXAM mode
  useEffect(() => {
    if (!session?.timeLimitSec) return;
    const elapsed = Math.floor((Date.now() - session.startedAt) / 1000);
    const remaining = Math.max(0, session.timeLimitSec - elapsed);
    setTimeLeft(remaining);

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev === null || prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [session]);

  // Time's up: auto-complete
  useEffect(() => {
    if (timeLeft === 0 && session) {
      handleComplete();
    }
  }, [timeLeft]);

  const handleComplete = useCallback(async () => {
    if (!session) return;
    try {
      await regloApi.completeQuizSession(session.sessionId);
    } catch {
      // ignore
    }
    if (timerRef.current) clearInterval(timerRef.current);
    router.replace({ pathname: '/(tabs)/quiz/results', params: { sessionId: session.sessionId } });
  }, [session, router]);

  const handleAbandon = useCallback(() => {
    Alert.alert('Esci dal quiz?', 'Il progresso di questa sessione verrà perso.', [
      { text: 'Continua', style: 'cancel' },
      {
        text: 'Esci',
        style: 'destructive',
        onPress: async () => {
          if (session) {
            try {
              await regloApi.abandonQuizSession(session.sessionId);
            } catch {
              // ignore
            }
          }
          if (timerRef.current) clearInterval(timerRef.current);
          clearSession();
          router.back();
        },
      },
    ]);
  }, [session, clearSession, router]);

  const handleAnswer = async (answer: boolean) => {
    if (!session || answering) return;
    setAnswering(true);
    try {
      const result = await regloApi.submitQuizAnswer(session.sessionId, {
        questionId: session.questions[currentIndex].id,
        answer,
      });
      setFeedback(result);
      setCorrectCount(result.correctCount);
      setWrongCount(result.wrongCount);

      if (result.sessionStatus === 'auto_failed') {
        setTimeout(() => {
          if (timerRef.current) clearInterval(timerRef.current);
          router.replace({ pathname: '/(tabs)/quiz/results', params: { sessionId: session.sessionId } });
        }, 1500);
      }
    } catch {
      // ignore
    } finally {
      setAnswering(false);
    }
  };

  const handleNext = () => {
    setFeedback(null);
    if (currentIndex >= (session?.questions.length ?? 0) - 1) {
      handleComplete();
    } else {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  if (!session) {
    return (
      <Screen>
        <View style={styles.center}>
          <Text style={styles.errorText}>Sessione non trovata</Text>
          <Button label="Torna indietro" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  const question = session.questions[currentIndex];
  const isLast = currentIndex >= session.questions.length - 1;

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <Screen>
      {/* Top bar */}
      <View style={styles.topBar}>
        <Pressable onPress={handleAbandon} style={styles.exitButton}>
          <Text style={styles.exitButtonText}>Esci</Text>
        </Pressable>
        <Text style={styles.progress}>
          {currentIndex + 1}/{session.questions.length}
        </Text>
        {timeLeft !== null && (
          <Text style={[styles.timer, timeLeft <= 60 && styles.timerUrgent]}>
            {formatTime(timeLeft)}
          </Text>
        )}
        <View style={styles.counters}>
          <Text style={styles.correctCounter}>{correctCount}</Text>
          <Text style={styles.wrongCounter}>{wrongCount}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} bounces={false}>
        {/* Question card */}
        <View style={styles.questionCard}>
          {question.imageUrl && (
            <Image
              source={{ uri: question.imageUrl }}
              style={styles.questionImage}
              resizeMode="contain"
            />
          )}
          <Text style={styles.questionText}>{question.questionText}</Text>
        </View>

        {/* Answer buttons or feedback */}
        {!feedback ? (
          <View style={styles.answerButtons}>
            <Pressable
              style={({ pressed }) => [styles.answerButton, styles.trueButton, pressed && styles.answerButtonPressed]}
              onPress={() => handleAnswer(true)}
              disabled={answering}
            >
              <Text style={styles.trueButtonText}>VERO</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.answerButton, styles.falseButton, pressed && styles.answerButtonPressed]}
              onPress={() => handleAnswer(false)}
              disabled={answering}
            >
              <Text style={styles.falseButtonText}>FALSO</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.feedbackContainer}>
            <View style={[styles.feedbackBanner, feedback.isCorrect ? styles.feedbackCorrect : styles.feedbackWrong]}>
              <Text style={styles.feedbackText}>
                {feedback.isCorrect ? 'Corretto!' : `Sbagliato — la risposta era ${feedback.correctAnswer ? 'VERO' : 'FALSO'}`}
              </Text>
            </View>

            {feedback.hint && (
              <View style={styles.hintContainer}>
                <Text style={styles.hintTitle}>{feedback.hint.title}</Text>
                <RenderHtml
                  contentWidth={width - spacing.md * 4}
                  source={{ html: feedback.hint.descriptionHtml }}
                  baseStyle={styles.hintHtml as any}
                />
              </View>
            )}

            <Button
              label={feedback.sessionStatus === 'auto_failed' ? 'Troppi errori...' : isLast ? 'Completa' : 'Avanti'}
              tone="primary"
              fullWidth
              onPress={handleNext}
              disabled={feedback.sessionStatus === 'auto_failed'}
            />
          </View>
        )}
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  errorText: { ...typography.body, color: colors.textSecondary },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  exitButton: { padding: spacing.xs },
  exitButtonText: { ...typography.body, color: colors.primary, fontWeight: '600' },
  progress: { ...typography.subtitle, color: colors.textPrimary },
  timer: { ...typography.body, color: colors.textSecondary, fontWeight: '600', fontVariant: ['tabular-nums'] },
  timerUrgent: { color: colors.destructive },
  counters: { flexDirection: 'row', gap: spacing.sm },
  correctCounter: { fontSize: 16, fontWeight: '700', color: '#16A34A' },
  wrongCounter: { fontSize: 16, fontWeight: '700', color: colors.destructive },
  scrollContent: { padding: spacing.md, gap: spacing.md, paddingBottom: 100 },
  questionCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.md,
  },
  questionImage: { width: '100%', height: 200, borderRadius: 12 },
  questionText: { fontSize: 18, fontWeight: '600', color: colors.textPrimary, lineHeight: 26 },
  answerButtons: { flexDirection: 'row', gap: spacing.md },
  answerButton: {
    flex: 1,
    paddingVertical: 20,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  answerButtonPressed: { opacity: 0.7, transform: [{ scale: 0.97 }] },
  trueButton: { backgroundColor: '#F0FDF4', borderColor: '#16A34A' },
  falseButton: { backgroundColor: '#FEF2F2', borderColor: colors.destructive },
  trueButtonText: { fontSize: 18, fontWeight: '800', color: '#16A34A', letterSpacing: 1 },
  falseButtonText: { fontSize: 18, fontWeight: '800', color: colors.destructive, letterSpacing: 1 },
  feedbackContainer: { gap: spacing.md },
  feedbackBanner: { padding: spacing.md, borderRadius: 12 },
  feedbackCorrect: { backgroundColor: '#F0FDF4' },
  feedbackWrong: { backgroundColor: '#FEF2F2' },
  feedbackText: { ...typography.body, fontWeight: '700', textAlign: 'center' },
  hintContainer: {
    padding: spacing.md,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  hintTitle: { ...typography.subtitle, color: colors.textPrimary },
  hintHtml: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
});
