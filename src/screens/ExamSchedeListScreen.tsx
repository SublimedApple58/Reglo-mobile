import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Screen } from '../components/Screen';
import { useQuiz } from '../context/QuizContext';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { regloApi } from '../services/regloApi';
import type { ExamSchedeProgressResponse, QuizSchedaSummary } from '../types/regloApi';

const { width: SCREEN_W } = Dimensions.get('window');
const GRID_COLS = 4;
const GRID_GAP = 10;
const TILE_W = (SCREEN_W - spacing.md * 2 - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS;
const TILE_H = TILE_W * 1.3;

const STATUS_THEME = {
  not_started: { bg: '#F3F4F6', accent: '#9CA3AF', border: '#E5E7EB', lines: '#D1D5DB' },
  in_progress: { bg: '#FEF9C3', accent: '#CA8A04', border: '#FDE68A', lines: '#FCD34D' },
  passed: { bg: '#DCFCE7', accent: '#16A34A', border: '#BBF7D0', lines: '#86EFAC' },
  failed: { bg: '#FEE2E2', accent: '#EF4444', border: '#FECACA', lines: '#FCA5A5' },
} as const;

export const ExamSchedeListScreen: React.FC = () => {
  const router = useRouter();
  const { startSession } = useQuiz();
  const [data, setData] = useState<ExamSchedeProgressResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [starting, setStarting] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await regloApi.getExamSchedeProgress();
      setData(res);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleTap = async (scheda: QuizSchedaSummary) => {
    if (starting) return;

    // Passed schede → show results (immutable)
    if (scheda.status === 'passed') {
      if (scheda.sessionId) {
        router.push({
          pathname: '/(tabs)/home/quiz-results',
          params: { sessionId: scheda.sessionId },
        } as never);
      }
      return;
    }
    // Failed schede → retry (start new session)

    setStarting(scheda.id);
    try {
      const res = await regloApi.startExamSchedaSession(scheda.id);
      startSession({
        sessionId: res.sessionId,
        questions: res.questions,
        mode: 'SCHEDA_ESAME',
        timeLimitSec: res.timeLimitSec,
        schedaNumber: res.schedaNumber,
        schedaId: scheda.id,
      });
      router.push('/(tabs)/home/quiz-session' as never);
    } catch {
      /* silent */
    } finally {
      setStarting(null);
    }
  };

  if (loading) {
    return (
      <Screen>
        <View style={st.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </Screen>
    );
  }

  if (!data) {
    return (
      <Screen>
        <View style={st.center}>
          <Text style={st.emptyText}>Nessuna scheda trovata</Text>
          <Pressable style={st.emptyBtn} onPress={() => router.back()}>
            <Text style={st.emptyBtnText}>Indietro</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  const { schede, summary } = data;

  return (
    <Screen>
      <View style={[st.header, { paddingTop: 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={14} style={st.backBtn}>
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        </Pressable>
        <View style={st.headerTextWrap}>
          <Text style={st.headerTitle}>Schede d'Esame</Text>
          <Text style={st.headerSub}>Simula l'esame di teoria</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={st.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={colors.primary}
          />
        }
      >
        {/* Summary row */}
        <Animated.View entering={FadeIn.duration(250)} style={st.summaryRow}>
          <View style={st.summaryPill}>
            <Text style={st.summaryVal}>{summary.completedCount}/{summary.totalSchede}</Text>
            <Text style={st.summaryLabel}>completate</Text>
          </View>
          <View style={st.summaryPill}>
            <Text style={[st.summaryVal, { color: '#16A34A' }]}>{summary.passedCount}</Text>
            <Text style={st.summaryLabel}>superate</Text>
          </View>
          <View style={st.summaryPill}>
            <Text style={[st.summaryVal, { color: '#EF4444' }]}>{summary.failedCount}</Text>
            <Text style={st.summaryLabel}>fallite</Text>
          </View>
          {summary.correctRate > 0 && (
            <View style={st.summaryPill}>
              <Text style={[st.summaryVal, { color: colors.primary }]}>{summary.correctRate}%</Text>
              <Text style={st.summaryLabel}>correttezza</Text>
            </View>
          )}
        </Animated.View>

        {/* Grid */}
        <View style={st.grid}>
          {schede.map((scheda, i) => {
            const th = STATUS_THEME[scheda.status];
            const isStarting = starting === scheda.id;
            return (
              <Animated.View
                key={scheda.id}
                entering={FadeInDown.delay(i * 15).duration(200)}
              >
                <Pressable
                  onPress={() => handleTap(scheda)}
                  disabled={isStarting}
                  style={({ pressed }) => [
                    st.tile,
                    { backgroundColor: th.bg, borderColor: th.border },
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
      </ScrollView>
    </Screen>
  );
};

const st = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { fontSize: 15, fontWeight: '500', color: colors.textSecondary },
  emptyBtn: { paddingVertical: 10, paddingHorizontal: 24, borderRadius: 12, backgroundColor: '#F3F4F6' },
  emptyBtnText: { fontSize: 14, fontWeight: '600', color: colors.primary },
  header: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center',
  },
  headerTextWrap: { flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.3 },
  headerSub: { fontSize: 13, fontWeight: '500', color: colors.textSecondary, marginTop: 2 },
  scroll: { padding: spacing.md, paddingBottom: 120, gap: spacing.md },
  summaryRow: { flexDirection: 'row', gap: 8 },
  summaryPill: {
    flex: 1, backgroundColor: colors.surface, borderRadius: 16,
    paddingVertical: 10, alignItems: 'center', gap: 2,
    borderWidth: 1, borderColor: colors.border,
  },
  summaryVal: { fontSize: 16, fontWeight: '800', color: colors.textPrimary },
  summaryLabel: { fontSize: 10, fontWeight: '600', color: colors.textMuted },
  grid: {
    flexDirection: 'row', flexWrap: 'wrap',
    gap: GRID_GAP,
  },
  tile: {
    width: TILE_W, height: TILE_H,
    borderRadius: 14, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center', gap: 2,
    position: 'relative',
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
