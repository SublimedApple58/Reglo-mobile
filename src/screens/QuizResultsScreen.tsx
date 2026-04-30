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
import { useLocalSearchParams, useRouter } from 'expo-router';
import RenderHtml from 'react-native-render-html';
import { useWindowDimensions } from 'react-native';
import { Screen } from '../components/Screen';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { useQuiz } from '../context/QuizContext';
import { colors, spacing, typography } from '../theme';
import { regloApi } from '../services/regloApi';
import type { QuizSessionResult } from '../types/regloApi';

export const QuizResultsScreen = () => {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const { clearSession } = useQuiz();
  const [result, setResult] = useState<QuizSessionResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedWrong, setExpandedWrong] = useState<Set<string>>(new Set());
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    (async () => {
      try {
        const data = await regloApi.getQuizSessionResult(sessionId);
        setResult(data);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
    clearSession();
  }, [sessionId]);

  const handleNewExam = async () => {
    setStarting(true);
    try {
      const data = await regloApi.startQuizSession({ mode: 'EXAM' });
      const { startSession } = require('../context/QuizContext');
      // Navigate directly — session will be set from QuizHomeScreen or context
      router.replace('/(tabs)/quiz');
    } catch {
      // ignore
    } finally {
      setStarting(false);
    }
  };

  const toggleWrongAnswer = (id: string) => {
    setExpandedWrong((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (loading) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </Screen>
    );
  }

  if (!result) {
    return (
      <Screen>
        <View style={styles.center}>
          <Text style={styles.errorText}>Risultato non trovato</Text>
          <Button label="Torna alla home" onPress={() => router.replace('/(tabs)/quiz')} />
        </View>
      </Screen>
    );
  }

  const isExam = result.mode === 'EXAM';
  const passed = result.passed;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll} bounces={false}>
        {/* Hero */}
        <View style={[styles.hero, passed === true ? styles.heroPass : passed === false ? styles.heroFail : styles.heroNeutral]}>
          <Text style={styles.heroIcon}>{passed === true ? '✓' : passed === false ? '✗' : '—'}</Text>
          <Text style={styles.heroTitle}>
            {passed === true ? 'Promosso!' : passed === false ? 'Non superato' : 'Completato'}
          </Text>
          <Text style={styles.heroScore}>
            {result.correctCount}/{result.totalQuestions} corrette
          </Text>
          {result.timeLimitSec && result.startedAt && result.completedAt && (
            <Text style={styles.heroTime}>
              Tempo: {Math.round((new Date(result.completedAt).getTime() - new Date(result.startedAt).getTime()) / 1000 / 60)} min
            </Text>
          )}
        </View>

        {/* Chapters breakdown */}
        {result.chaptersBreakdown.length > 0 && (
          <Card title="Risultati per capitolo">
            {result.chaptersBreakdown.map((ch) => {
              const pct = ch.total > 0 ? Math.round((ch.correct / ch.total) * 100) : 0;
              return (
                <View key={ch.chapterNumber} style={styles.breakdownRow}>
                  <View style={styles.breakdownInfo}>
                    <Text style={styles.breakdownChapter}>Cap. {ch.chapterNumber}</Text>
                    <Text style={styles.breakdownDesc} numberOfLines={1}>{ch.description}</Text>
                  </View>
                  <View style={styles.breakdownBarBg}>
                    <View
                      style={[
                        styles.breakdownBarFill,
                        { width: `${pct}%` },
                        pct >= 70 ? styles.barGreen : pct >= 40 ? styles.barYellow : styles.barRed,
                      ]}
                    />
                  </View>
                  <Text style={styles.breakdownScore}>{ch.correct}/{ch.total}</Text>
                </View>
              );
            })}
          </Card>
        )}

        {/* Wrong answers */}
        {result.wrongAnswers.length > 0 && (
          <Card title={`Risposte sbagliate (${result.wrongAnswers.length})`}>
            {result.wrongAnswers.map((q) => {
              const isExpanded = expandedWrong.has(q.id);
              return (
                <Pressable
                  key={q.id}
                  style={styles.wrongItem}
                  onPress={() => toggleWrongAnswer(q.id)}
                >
                  {q.imageUrl && (
                    <Image source={{ uri: q.imageUrl }} style={styles.wrongImage} resizeMode="contain" />
                  )}
                  <Text style={styles.wrongQuestion}>{q.questionText}</Text>
                  <Text style={styles.wrongCorrectAnswer}>
                    Risposta corretta: {q.correctAnswer ? 'VERO' : 'FALSO'}
                  </Text>
                  {isExpanded && q.hint && (
                    <View style={styles.wrongHint}>
                      <Text style={styles.wrongHintTitle}>{q.hint.title}</Text>
                      <RenderHtml
                        contentWidth={width - spacing.md * 6}
                        source={{ html: q.hint.descriptionHtml }}
                        baseStyle={styles.wrongHintHtml as any}
                      />
                    </View>
                  )}
                </Pressable>
              );
            })}
          </Card>
        )}

        {/* Action buttons */}
        <View style={styles.actions}>
          {isExam && (
            <Button
              label="Nuova simulazione"
              tone="primary"
              fullWidth
              onPress={handleNewExam}
              disabled={starting}
            />
          )}
          {result.wrongAnswers.length > 0 && (
            <Button
              label="Ripeti errori"
              tone="secondary"
              fullWidth
              onPress={async () => {
                setStarting(true);
                try {
                  const data = await regloApi.startQuizSession({ mode: 'REVIEW' });
                  const { useQuiz } = require('../context/QuizContext');
                  // Navigate to home and let user restart
                  router.replace('/(tabs)/quiz');
                } catch {
                  // ignore
                } finally {
                  setStarting(false);
                }
              }}
              disabled={starting}
            />
          )}
          <Button label="Torna alla home" fullWidth onPress={() => router.replace('/(tabs)/quiz')} />
        </View>
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  errorText: { ...typography.body, color: colors.textSecondary },
  scroll: { padding: spacing.md, gap: spacing.md, paddingBottom: 100 },
  hero: {
    borderRadius: 20,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.xs,
  },
  heroPass: { backgroundColor: '#F0FDF4' },
  heroFail: { backgroundColor: '#FEF2F2' },
  heroNeutral: { backgroundColor: '#F9FAFB' },
  heroIcon: { fontSize: 48, fontWeight: '800' },
  heroTitle: { ...typography.title, color: colors.textPrimary },
  heroScore: { fontSize: 20, fontWeight: '700', color: colors.textSecondary },
  heroTime: { ...typography.caption, color: colors.textMuted, textTransform: 'none' },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  breakdownInfo: { width: 120 },
  breakdownChapter: { fontSize: 12, fontWeight: '700', color: colors.textPrimary },
  breakdownDesc: { fontSize: 10, color: colors.textMuted },
  breakdownBarBg: { flex: 1, height: 6, borderRadius: 3, backgroundColor: '#F3F4F6', overflow: 'hidden' },
  breakdownBarFill: { height: '100%', borderRadius: 3 },
  barGreen: { backgroundColor: '#16A34A' },
  barYellow: { backgroundColor: '#EAB308' },
  barRed: { backgroundColor: colors.destructive },
  breakdownScore: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, width: 30, textAlign: 'right' },
  wrongItem: {
    padding: spacing.sm,
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  wrongImage: { width: '100%', height: 120, borderRadius: 8 },
  wrongQuestion: { ...typography.body, color: colors.textPrimary },
  wrongCorrectAnswer: { fontSize: 13, fontWeight: '700', color: '#16A34A' },
  wrongHint: {
    padding: spacing.sm,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  wrongHintTitle: { ...typography.body, fontWeight: '700', color: colors.textPrimary },
  wrongHintHtml: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  actions: { gap: spacing.sm, marginTop: spacing.sm },
});
