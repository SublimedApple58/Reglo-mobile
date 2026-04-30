import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../components/Screen';
import { Card } from '../components/Card';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { colors, pink, spacing, typography } from '../theme';
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
  const [starting, setStarting] = useState(false);

  const load = useCallback(async () => {
    try {
      const [chaptersData, statsData] = await Promise.all([
        regloApi.getQuizChapters(),
        regloApi.getQuizStudentStats(),
      ]);
      setChapters(chaptersData);
      setStats(statsData);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleStartSession = async (mode: 'EXAM' | 'CHAPTER' | 'REVIEW', chapterId?: string) => {
    if (starting) return;
    setStarting(true);
    try {
      const result = await regloApi.startQuizSession({ mode, chapterId });
      startSession({
        sessionId: result.sessionId,
        questions: result.questions,
        mode,
        timeLimitSec: result.timeLimitSec,
      });
      router.push('/(tabs)/quiz/session');
    } catch {
      // silently fail
    } finally {
      setStarting(false);
    }
  };

  const hasErrors = stats && (stats.examsFailed > 0 || stats.weakChapters.length > 0);

  if (loading) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <FlatList
        data={chapters}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />
        }
        ListHeaderComponent={
          <>
            <Text style={styles.title}>Quiz Patente</Text>

            {stats && (
              <Card style={styles.statsCard}>
                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{stats.readinessScore}%</Text>
                    <Text style={styles.statLabel}>Prontezza</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{stats.examPassRate}%</Text>
                    <Text style={styles.statLabel}>Superati</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{stats.examsPassed + stats.examsFailed}</Text>
                    <Text style={styles.statLabel}>Esami</Text>
                  </View>
                </View>
              </Card>
            )}

            <Button
              label={starting ? 'Avvio...' : 'Simulazione Esame'}
              tone="primary"
              fullWidth
              disabled={starting}
              onPress={() => handleStartSession('EXAM')}
            />

            {hasErrors && (
              <Button
                label="Rivedi Errori"
                tone="secondary"
                fullWidth
                onPress={() => handleStartSession('REVIEW')}
                disabled={starting}
              />
            )}

            <Text style={styles.sectionTitle}>Capitoli</Text>
          </>
        }
        renderItem={({ item }) => {
          const progress = item.totalQuestions > 0 ? item.attemptedCount / item.totalQuestions : 0;
          return (
            <Pressable
              style={({ pressed }) => [styles.chapterRow, pressed && styles.chapterRowPressed]}
              onPress={() => handleStartSession('CHAPTER', item.id)}
              disabled={starting}
            >
              <View style={styles.chapterInfo}>
                <View style={styles.chapterNumberBadge}>
                  <Text style={styles.chapterNumberText}>{item.chapterNumber}</Text>
                </View>
                <View style={styles.chapterTextContainer}>
                  <Text style={styles.chapterDescription} numberOfLines={2}>
                    {item.description}
                  </Text>
                  <Text style={styles.chapterProgress}>
                    {item.attemptedCount}/{item.totalQuestions} tentate
                  </Text>
                </View>
              </View>
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${Math.round(progress * 100)}%` }]} />
              </View>
            </Pressable>
          );
        }}
        ListFooterComponent={
          stats && stats.recentSessions.length > 0 ? (
            <View style={styles.recentSection}>
              <Text style={styles.sectionTitle}>Sessioni recenti</Text>
              {stats.recentSessions.slice(0, 5).map((s) => (
                <Pressable
                  key={s.id}
                  style={styles.recentRow}
                  onPress={() => {
                    router.push({ pathname: '/(tabs)/quiz/results', params: { sessionId: s.id } });
                  }}
                >
                  <View style={styles.recentRowLeft}>
                    <Badge
                      label={s.mode === 'EXAM' ? 'Esame' : s.mode === 'CHAPTER' ? 'Capitolo' : 'Ripasso'}
                      tone={s.passed === true ? 'success' : s.passed === false ? 'danger' : 'default'}
                    />
                    <Text style={styles.recentScore}>
                      {s.correctCount}/{s.totalQuestions}
                    </Text>
                  </View>
                  {s.completedAt && (
                    <Text style={styles.recentDate}>
                      {new Date(s.completedAt).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}
                    </Text>
                  )}
                </Pressable>
              ))}
            </View>
          ) : null
        }
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: spacing.md, gap: spacing.md, paddingBottom: 100 },
  title: { ...typography.title, color: colors.textPrimary, marginBottom: spacing.xs },
  sectionTitle: { ...typography.subtitle, color: colors.textPrimary, marginTop: spacing.sm },
  statsCard: { marginVertical: spacing.xs },
  statsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  statItem: { alignItems: 'center', gap: 2 },
  statValue: { fontSize: 24, fontWeight: '700', color: colors.textPrimary },
  statLabel: { ...typography.caption, color: colors.textSecondary, textTransform: 'none' },
  statDivider: { width: 1, height: 32, backgroundColor: colors.border },
  chapterRow: {
    flexDirection: 'column',
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chapterRowPressed: { opacity: 0.7 },
  chapterInfo: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  chapterNumberBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: pink[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  chapterNumberText: { fontSize: 14, fontWeight: '700', color: colors.primary },
  chapterTextContainer: { flex: 1 },
  chapterDescription: { ...typography.body, color: colors.textPrimary },
  chapterProgress: { ...typography.caption, color: colors.textMuted, textTransform: 'none', marginTop: 2 },
  progressBarBg: { height: 4, borderRadius: 2, backgroundColor: '#F3F4F6', overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 2, backgroundColor: colors.primary },
  recentSection: { gap: spacing.sm, marginTop: spacing.xs },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.sm,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  recentRowLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  recentScore: { ...typography.body, fontWeight: '600', color: colors.textPrimary },
  recentDate: { ...typography.caption, color: colors.textMuted, textTransform: 'none' },
});
