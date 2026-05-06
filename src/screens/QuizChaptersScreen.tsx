import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInRight,
  FadeOut,
  Layout,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '../components/Screen';
import { colors, pink, yellow, spacing } from '../theme';
import { regloApi } from '../services/regloApi';
import { useQuiz } from '../context/QuizContext';
import type { QuizChapterProgress } from '../types/regloApi';

type Filter = 'all' | 'in_progress' | 'completed';

export const QuizChaptersScreen = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { startSession } = useQuiz();
  const [chapters, setChapters] = useState<QuizChapterProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [starting, setStarting] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<TextInput>(null);
  const [filter, setFilter] = useState<Filter>('all');

  const load = useCallback(async () => {
    try {
      const data = await regloApi.getQuizChapters();
      setChapters(data);
    } catch {} finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleStart = async (chapterId: string) => {
    if (starting) return;
    setStarting(chapterId);
    try {
      const r = await regloApi.startQuizSession({ mode: 'CHAPTER', chapterId });
      startSession({ sessionId: r.sessionId, questions: r.questions, mode: 'CHAPTER', timeLimitSec: r.timeLimitSec });
      router.push('/(tabs)/quiz/session');
    } catch {} finally { setStarting(null); }
  };

  const filtered = chapters.filter((c) => {
    const pctRaw = c.totalQuestions > 0 ? c.attemptedCount / c.totalQuestions : 0;
    const pctDisplay = Math.round(pctRaw * 100);
    if (filter === 'completed' && pctDisplay < 100) return false;
    if (filter === 'in_progress' && (pctDisplay === 0 || pctDisplay >= 100)) return false;
    if (search.trim()) {
      return c.description.toLowerCase().includes(search.trim().toLowerCase());
    }
    return true;
  });

  if (loading) {
    return <Screen gradient><View style={st.center}><ActivityIndicator size="large" color={colors.primary} /></View></Screen>;
  }

  return (
    <Screen gradient>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={st.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
        ListHeaderComponent={
          <>
            {/* Back + Title */}
            <Animated.View entering={FadeInDown.duration(350)}>
              <Pressable onPress={() => router.back()} hitSlop={14} style={st.backBtn}>
                <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
              </Pressable>
              <Text style={st.pageTitle}>Libreria Argomenti</Text>
              <Text style={st.pageSubtitle}>
                Seleziona un modulo per continuare il tuo percorso di studio.
              </Text>
            </Animated.View>

            {/* Filters + Search icon */}
            <Animated.View entering={FadeIn.delay(100).duration(300)} style={st.filtersRow}>
              {([
                { key: 'all' as Filter, label: 'Tutti i moduli', icon: 'options-outline' as const },
                { key: 'in_progress' as Filter, label: 'In corso' },
                { key: 'completed' as Filter, label: 'Completati' },
              ]).map((f) => (
                <Animated.View key={f.key} layout={Layout.springify()}>
                  <Pressable
                    onPress={() => setFilter(f.key)}
                    style={({ pressed }) => [
                      st.filterChip,
                      filter === f.key && st.filterChipActive,
                      pressed && { transform: [{ scale: 0.95 }] },
                    ]}
                  >
                    {f.icon && <Ionicons name={f.icon} size={15} color={filter === f.key ? '#1A1A2E' : colors.textMuted} />}
                    <Text style={[st.filterChipText, filter === f.key && st.filterChipTextActive]}>
                      {f.label}
                    </Text>
                  </Pressable>
                </Animated.View>
              ))}

              {/* Search toggle (inline with filters when closed) */}
              {!searchOpen && (
                <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)}>
                  <Pressable
                    onPress={() => {
                      setSearchOpen(true);
                      setTimeout(() => searchInputRef.current?.focus(), 100);
                    }}
                    style={({ pressed }) => [st.searchIconBtn, pressed && { transform: [{ scale: 0.9 }] }]}
                  >
                    <Ionicons name="search-outline" size={18} color={colors.textMuted} />
                  </Pressable>
                </Animated.View>
              )}
            </Animated.View>

            {/* Expandable search bar */}
            {searchOpen && (
              <Animated.View entering={FadeInDown.duration(250).springify()} exiting={FadeOut.duration(150)} style={st.searchBar}>
                <Ionicons name="search-outline" size={18} color={colors.primary} />
                <TextInput
                  ref={searchInputRef}
                  style={st.searchInput}
                  placeholder="Cerca capitolo..."
                  placeholderTextColor={colors.textMuted}
                  value={search}
                  onChangeText={setSearch}
                  returnKeyType="search"
                  onBlur={() => {
                    if (!search.trim()) setSearchOpen(false);
                  }}
                />
                <Pressable
                  onPress={() => { setSearch(''); setSearchOpen(false); }}
                  hitSlop={10}
                >
                  <Ionicons name="close-circle" size={20} color={colors.textMuted} />
                </Pressable>
              </Animated.View>
            )}
          </>
        }
        renderItem={({ item, index }) => {
          const pct = item.totalQuestions > 0 ? Math.round((item.attemptedCount / item.totalQuestions) * 100) : 0;
          const done = pct === 100;
          const hasStarted = item.attemptedCount > 0;
          return (
            <Animated.View entering={FadeInRight.delay(50 * Math.min(index, 12)).duration(280)}>
              <View style={st.card}>
                <View style={st.cardTop}>
                  <View style={[st.cardIcon, done && st.cardIconDone]}>
                    <Ionicons
                      name={done ? 'checkmark' : 'book-outline'}
                      size={20}
                      color={done ? '#FFFFFF' : pink[500]}
                    />
                  </View>
                  <View style={st.cardInfo}>
                    <Text style={st.cardTitle}>{item.description}</Text>
                    <View style={st.cardProgressRow}>
                      <Text style={st.cardProgressLabel}>PROGRESSO MODULO</Text>
                      <Text style={[st.cardProgressPct, done && st.cardProgressPctDone]}>{pct}%</Text>
                    </View>
                    <View style={st.cardBarTrack}>
                      <View style={[st.cardBarFill, { width: `${pct}%` }, done && st.cardBarDone]} />
                    </View>
                  </View>
                </View>
                <Pressable
                  onPress={() => handleStart(item.id)}
                  disabled={!!starting}
                  style={({ pressed }) => [st.cardCta, pressed && { opacity: 0.75, transform: [{ scale: 0.98 }] }]}
                >
                  <Text style={st.cardCtaText}>
                    {starting === item.id ? 'Avvio...' : hasStarted ? 'CONTINUA' : 'START'}
                  </Text>
                </Pressable>
              </View>
            </Animated.View>
          );
        }}
        ListEmptyComponent={
          <View style={st.emptyState}>
            <Ionicons name="search-outline" size={36} color={colors.textMuted} />
            <Text style={st.emptyText}>Nessun capitolo trovato</Text>
          </View>
        }
      />
    </Screen>
  );
};

const st = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: spacing.md, gap: 18, paddingBottom: 120 },

  // Header
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  pageTitle: {
    fontSize: 28, fontWeight: '800', color: '#1A1A2E',
    letterSpacing: -0.5, lineHeight: 34,
  },
  pageSubtitle: {
    fontSize: 15, fontWeight: '400', color: colors.textSecondary,
    lineHeight: 22, marginTop: 8,
  },

  // Filters
  filtersRow: {
    flexDirection: 'row', gap: 10, marginTop: 22, marginBottom: 16, flexWrap: 'wrap',
  },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingVertical: 12, paddingHorizontal: 20, borderRadius: 24,
    backgroundColor: '#F0F0F5',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  filterChipActive: {
    backgroundColor: yellow[200],
    shadowColor: yellow[400], shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25, shadowRadius: 8, elevation: 4,
  },
  filterChipText: {
    fontSize: 14, fontWeight: '600', color: colors.textMuted,
  },
  filterChipTextActive: {
    color: '#1A1A2E', fontWeight: '700',
  },
  searchIconBtn: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: '#F0F0F5', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },

  // Search
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 14, paddingHorizontal: 18, borderRadius: 24,
    backgroundColor: '#F0F0F5', marginBottom: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  searchInput: {
    flex: 1, fontSize: 15, fontWeight: '500', color: colors.textPrimary,
    paddingVertical: 0,
  },

  // Chapter card
  card: {
    padding: 20, borderRadius: 28,
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: pink[100],
    gap: 14,
    shadowColor: pink[300], shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22, shadowRadius: 16, elevation: 6,
  },
  cardTop: { flexDirection: 'row', gap: 14 },
  cardIcon: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center',
    shadowColor: pink[200], shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 6, elevation: 2,
  },
  cardIconDone: { backgroundColor: '#16A34A' },
  cardInfo: { flex: 1, gap: 6 },
  cardTitle: {
    fontSize: 17, fontWeight: '700', color: '#1A1A2E', lineHeight: 22,
  },
  cardProgressRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  cardProgressLabel: {
    fontSize: 10, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.5,
  },
  cardProgressPct: { fontSize: 13, fontWeight: '800', color: pink[500] },
  cardProgressPctDone: { color: '#16A34A' },
  cardBarTrack: {
    height: 5, borderRadius: 2.5, backgroundColor: pink[100], overflow: 'hidden',
  },
  cardBarFill: {
    height: '100%', borderRadius: 2.5, backgroundColor: colors.primary,
  },
  cardBarDone: { backgroundColor: '#16A34A' },
  cardCta: {
    alignItems: 'center', paddingVertical: 15, borderRadius: 22,
    backgroundColor: colors.primary,
    shadowColor: pink[400], shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 5,
  },
  cardCtaText: {
    fontSize: 15, fontWeight: '700', color: '#FFFFFF', letterSpacing: 0.8,
  },

  // Empty
  emptyState: { alignItems: 'center', gap: 10, paddingVertical: 40 },
  emptyText: { fontSize: 14, fontWeight: '500', color: colors.textMuted },
});
