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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '../components/Screen';
import { useQuiz } from '../context/QuizContext';
import { colors, pink } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { regloApi } from '../services/regloApi';
import type { QuizChapterSchedeResponse, QuizSchedaSummary } from '../types/regloApi';

const { width: SCREEN_W } = Dimensions.get('window');
const GRID_COLS = 4;
const GRID_GAP = 10;
const TILE_SIZE = (SCREEN_W - spacing.md * 2 - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS;

const STATUS_COLORS = {
  not_started: { bg: '#F0F0F5', text: '#9CA3AF', border: '#E5E7EB' },
  in_progress: { bg: '#FEF3C7', text: '#CA8A04', border: '#FDE68A' },
  passed: { bg: '#DCFCE7', text: '#16A34A', border: '#BBF7D0' },
  failed: { bg: '#FEE2E2', text: '#EF4444', border: '#FECACA' },
} as const;

export const SchedaGridScreen: React.FC = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { chapterId } = useLocalSearchParams<{ chapterId: string }>();
  const { startSession } = useQuiz();
  const [data, setData] = useState<QuizChapterSchedeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [starting, setStarting] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!chapterId) return;
    try {
      const res = await regloApi.getChapterSchede(chapterId);
      setData(res);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [chapterId]);

  useEffect(() => { load(); }, [load]);

  const handleTap = async (scheda: QuizSchedaSummary) => {
    if (starting) return;

    // Completed schede → show results
    if (scheda.status === 'passed' || scheda.status === 'failed') {
      if (scheda.sessionId) {
        router.push({
          pathname: '/(tabs)/home/quiz-results',
          params: { sessionId: scheda.sessionId },
        } as never);
      }
      return;
    }

    // Start or resume
    setStarting(scheda.id);
    try {
      const res = await regloApi.startSchedaSession(scheda.id);
      startSession({
        sessionId: res.sessionId,
        questions: res.questions,
        mode: 'SCHEDA',
        timeLimitSec: null,
        schedaNumber: res.schedaNumber,
        schedaId: scheda.id,
        chapterId: chapterId!,
        chapterDescription: res.chapterDescription,
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
      <Screen gradient>
        <View style={st.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </Screen>
    );
  }

  if (!data) {
    return (
      <Screen gradient>
        <View style={st.center}>
          <Text style={st.emptyText}>Capitolo non trovato</Text>
          <Pressable style={st.emptyBtn} onPress={() => router.back()}>
            <Text style={st.emptyBtnText}>Indietro</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  const { chapter, schede, summary } = data;

  return (
    <Screen gradient>
      <View style={[st.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={14} style={st.backBtn}>
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        </Pressable>
        <View style={st.headerTextWrap}>
          <Text style={st.headerTitle} numberOfLines={1}>
            {chapter.chapterNumber}. {chapter.description}
          </Text>
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
            const sc = STATUS_COLORS[scheda.status];
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
                    { backgroundColor: sc.bg, borderColor: sc.border },
                    pressed && st.tilePressed,
                  ]}
                >
                  {isStarting ? (
                    <ActivityIndicator size="small" color={sc.text} />
                  ) : (
                    <>
                      <Text style={[st.tileNum, { color: sc.text }]}>{scheda.schedaNumber}</Text>
                      {scheda.status === 'passed' && (
                        <Ionicons name="checkmark-circle" size={14} color="#16A34A" />
                      )}
                      {scheda.status === 'failed' && (
                        <Text style={st.tileErrors}>{scheda.errorCount} err</Text>
                      )}
                      {scheda.status === 'in_progress' && (
                        <Ionicons name="play-circle" size={14} color="#CA8A04" />
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
  emptyBtn: { paddingVertical: 10, paddingHorizontal: 24, borderRadius: 12, backgroundColor: pink[50] },
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
  headerTitle: { fontSize: 17, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.3 },
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
    width: TILE_SIZE, height: TILE_SIZE,
    borderRadius: 16, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center', gap: 2,
  },
  tilePressed: { opacity: 0.8, transform: [{ scale: 0.95 }] },
  tileNum: { fontSize: 18, fontWeight: '800' },
  tileErrors: { fontSize: 9, fontWeight: '700', color: '#EF4444' },
});

export default SchedaGridScreen;
