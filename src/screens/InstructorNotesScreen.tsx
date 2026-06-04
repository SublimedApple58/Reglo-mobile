import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Keyboard,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  withTiming,
  interpolate,
  Extrapolation,
  FadeIn,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { ToastNotice, ToastTone } from '../components/ToastNotice';
import { SkeletonBlock } from '../components/Skeleton';
import { useSession } from '../context/SessionContext';
import { regloApi } from '../services/regloApi';
import { AutoscuolaAppointmentWithRelations, AutoscuolaCase } from '../types/regloApi';
import { colors } from '../theme';

const REQUIRED_LESSONS = 6;
const monthsShort = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
const H_PAD = 22;

const COMPACT_H = 54; // top button row
const LARGE_TITLE_H = 56;
const PILLS_H = 60;

const AVATAR_BG = ['#FCE7F3', '#DBEAFE', '#DCFCE7', '#EDE9FE', '#FFEDD5', '#E0F2FE', '#FEE2E2', '#F1F5F9'];
const AVATAR_FG = ['#BE185D', '#1D4ED8', '#15803D', '#6D28D9', '#C2410C', '#0369A1', '#B91C1C', '#475569'];
const hashStr = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };
const avatarColors = (id: string) => { const i = hashStr(id) % AVATAR_BG.length; return { bg: AVATAR_BG[i], fg: AVATAR_FG[i] }; };

type StudentEntry = {
  id: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  assignedInstructorId?: string | null;
};

export const InstructorNotesScreen = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { instructorId } = useSession();
  const [students, setStudents] = useState<StudentEntry[]>([]);
  const [allAppointments, setAllAppointments] = useState<AutoscuolaAppointmentWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<{ text: string; tone: ToastTone } | null>(null);
  const [autonomousMode, setAutonomousMode] = useState(false);
  const [cases, setCases] = useState<AutoscuolaCase[]>([]);
  const [segment, setSegment] = useState<'mine' | 'all'>('mine');

  const [searchActive, setSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<TextInput>(null);
  const searchProgress = useSharedValue(0);

  const openSearch = () => {
    setSearchActive(true);
    searchProgress.value = withTiming(1, { duration: 280 });
    setTimeout(() => searchInputRef.current?.focus(), 220);
  };
  const closeSearch = () => {
    Keyboard.dismiss();
    setSearchActive(false);
    setSearchQuery('');
    searchProgress.value = withTiming(0, { duration: 240 });
  };

  const loadData = useCallback(async () => {
    try {
      const [bootstrap, appts, instrSettings, allCases] = await Promise.all([
        regloApi.getAgendaBootstrap({
          ...(instructorId ? { instructorId } : {}),
          from: new Date(0).toISOString(),
          to: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          limit: 1,
        }),
        regloApi.getAppointments({ limit: 500 }),
        instructorId ? regloApi.getInstructorSettings().catch(() => null) : Promise.resolve(null),
        regloApi.getCases().catch(() => [] as AutoscuolaCase[]),
      ]);
      setStudents(bootstrap.students);
      setAllAppointments(appts.filter((a) => (a.status ?? '').trim().toLowerCase() !== 'cancelled'));
      setCases(allCases);
      if (instrSettings) setAutonomousMode(instrSettings.autonomousMode);
    } catch {
      setToast({ text: 'Errore nel caricamento', tone: 'danger' });
    } finally {
      setLoading(false);
    }
  }, [instructorId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const studentInfo = useMemo(() => {
    const map = new Map<string, { total: number; completed: number }>();
    for (const appt of allAppointments) {
      const cur = map.get(appt.studentId) ?? { total: 0, completed: 0 };
      cur.total += 1;
      const st = (appt.status ?? '').trim().toLowerCase();
      if (st === 'completed' || st === 'checked_in') cur.completed += 1;
      map.set(appt.studentId, cur);
    }
    return map;
  }, [allAppointments]);

  const studentExam = useMemo(() => {
    const map = new Map<string, string>();
    const now = Date.now();
    for (const c of cases) {
      const d = c.drivingExamAt ?? c.theoryExamAt;
      if (d && new Date(d).getTime() > now && !map.has(c.studentId)) map.set(c.studentId, d);
    }
    return map;
  }, [cases]);

  const useClusters = autonomousMode && !!instructorId;
  const mineCount = useMemo(
    () => students.filter((s) => s.assignedInstructorId === instructorId).length,
    [students, instructorId],
  );
  const visibleStudents = useMemo(() => {
    if (!useClusters || segment === 'all') return students;
    return students.filter((s) => s.assignedInstructorId === instructorId);
  }, [useClusters, segment, students, instructorId]);

  const searchData = useMemo(() => {
    if (!searchActive) return visibleStudents;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return visibleStudents;
    return students.filter((s) => `${s.firstName} ${s.lastName}`.toLowerCase().includes(q));
  }, [searchActive, searchQuery, visibleStudents, students]);

  const navigateToStudent = (student: StudentEntry) => {
    closeSearch();
    router.push({
      pathname: '/(tabs)/notes/[studentId]',
      params: { studentId: student.id, name: `${student.firstName} ${student.lastName}` },
    } as never);
  };

  /* ── Collapsible header animation ── */
  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({ onScroll: (e) => { scrollY.value = e.contentOffset.y; } });
  const largeTitleStyle = useAnimatedStyle(() => {
    // On overscroll (scrollY < 0) the list bounces down — cancel that movement
    // so the large title stays pinned like the rest of the header.
    const ty = scrollY.value < 0
      ? scrollY.value
      : interpolate(scrollY.value, [0, LARGE_TITLE_H], [0, -12], Extrapolation.CLAMP);
    return {
      opacity: interpolate(scrollY.value, [0, LARGE_TITLE_H * 0.7], [1, 0], Extrapolation.CLAMP) * (1 - searchProgress.value),
      transform: [{ translateY: ty }],
    };
  });
  const compactStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [LARGE_TITLE_H * 0.5, LARGE_TITLE_H * 0.95], [0, 1], Extrapolation.CLAMP) * (1 - searchProgress.value),
  }));
  // Search crossfade in the top row: title+buttons fade out, input row fades in.
  const titleRowStyle = useAnimatedStyle(() => ({ opacity: 1 - searchProgress.value }));
  const searchRowStyle = useAnimatedStyle(() => ({ opacity: searchProgress.value }));
  const headerBgStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 24], [0, 1], Extrapolation.CLAMP),
  }));
  // When search is active, collapse the large-title's height in the list header so the
  // rows physically rise up under the pinned pills (works even when the list is too short to scroll).
  const largeTitleWrapStyle = useAnimatedStyle(() => ({
    height: interpolate(searchProgress.value, [0, 1], [LARGE_TITLE_H, 0], Extrapolation.CLAMP),
  }));
  const pillsWrapStyle = useAnimatedStyle(() => {
    // collapse: 0 = expanded (pills sit below the large title), 1 = pinned right under the top row.
    // Driven by scroll OR by search being active (whichever is greater) so the pills snap up reliably.
    const collapse = Math.max(
      searchProgress.value,
      interpolate(scrollY.value, [0, LARGE_TITLE_H], [0, 1], Extrapolation.CLAMP),
    );
    return { transform: [{ translateY: interpolate(collapse, [0, 1], [LARGE_TITLE_H, 0]) }] };
  });

  const headerH = insets.top + COMPACT_H + (useClusters ? PILLS_H : 0);

  const renderPills = (
    <View style={styles.filterRow}>
      <Pressable onPress={() => setSegment('mine')} style={[styles.pill, segment === 'mine' && styles.pillActive]}>
        <Text style={[styles.pillText, segment === 'mine' && styles.pillTextActive]}>I miei</Text>
      </Pressable>
      <Pressable onPress={() => setSegment('all')} style={[styles.pill, segment === 'all' && styles.pillActive]}>
        <Text style={[styles.pillText, segment === 'all' && styles.pillTextActive]}>Tutti</Text>
      </Pressable>
    </View>
  );

  const renderRow = useCallback(
    (student: StudentEntry) => {
      const info = studentInfo.get(student.id) ?? { total: 0, completed: 0 };
      const completed = Math.min(info.completed, REQUIRED_LESSONS);
      const examISO = studentExam.get(student.id);
      const examLabel = examISO
        ? `${new Date(examISO).getDate()} ${monthsShort[new Date(examISO).getMonth()]}`
        : null;
      const initials = `${student.firstName.charAt(0)}${student.lastName.charAt(0)}`.toUpperCase();
      const { bg, fg } = avatarColors(student.id);
      return (
        <Pressable
          key={student.id}
          style={({ pressed }) => [styles.row, pressed && { opacity: 0.55 }]}
          onPress={() => navigateToStudent(student)}
        >
          <View style={[styles.avatar, { backgroundColor: bg }]}>
            <Text style={[styles.avatarText, { color: fg }]}>{initials}</Text>
          </View>
          <View style={styles.rowBody}>
            <Text style={styles.rowName} numberOfLines={1}>{student.firstName} {student.lastName}</Text>
            <Text style={styles.rowSub} numberOfLines={1}>
              {info.total} guid{info.total === 1 ? 'a' : 'e'} · obbligo {completed}/{REQUIRED_LESSONS}
            </Text>
            {examLabel ? (
              <View style={styles.statusRow}>
                <View style={[styles.statusDot, { backgroundColor: '#8B5CF6' }]} />
                <Text style={styles.statusText} numberOfLines={1}>Esame · {examLabel}</Text>
              </View>
            ) : null}
          </View>
        </Pressable>
      );
    },
    [studentInfo, studentExam],
  );

  const skeletonContent = (
    <View>
      {Array.from({ length: 7 }).map((_, i) => (
        <View key={`skel-${i}`} style={styles.row}>
          <SkeletonBlock width={54} height={54} radius={27} />
          <View style={{ flex: 1, gap: 7 }}>
            <SkeletonBlock width="50%" height={15} radius={6} />
            <SkeletonBlock width="70%" height={12} radius={6} />
            <SkeletonBlock width="40%" height={12} radius={6} />
          </View>
        </View>
      ))}
    </View>
  );

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <ToastNotice message={toast?.text ?? null} tone={toast?.tone} onHide={() => setToast(null)} />

      {/* ── Sticky collapsible header ── */}
      <View style={[styles.headerWrap, { height: headerH, paddingTop: insets.top }]} pointerEvents="box-none">
        {/* Blur bg + border (fade in on scroll) */}
        <Animated.View style={[StyleSheet.absoluteFill, headerBgStyle]} pointerEvents="none">
          {Platform.OS === 'ios' ? (
            <BlurView intensity={80} tint="systemChromeMaterialLight" style={StyleSheet.absoluteFill} />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(253,253,253,0.96)' }]} />
          )}
          <View style={styles.headerBorder} />
        </Animated.View>

        {/* Top row: crossfades between [compact title + buttons] and [search input + Annulla] */}
        <View style={styles.compactRow}>
          <Animated.View style={[styles.topOverlay, titleRowStyle]} pointerEvents={searchActive ? 'none' : 'auto'}>
            <Animated.Text style={[styles.compactTitle, compactStyle]} numberOfLines={1}>Allievi</Animated.Text>
            <View style={styles.headerBtns}>
              <Pressable onPress={openSearch} hitSlop={6} style={styles.circleBtn}>
                <Ionicons name="search" size={19} color="#1A1A2E" />
              </Pressable>
              {autonomousMode ? (
                <Pressable onPress={() => router.push('/(tabs)/notes/cluster-settings' as never)} hitSlop={6} style={styles.circleBtn}>
                  <Ionicons name="settings-outline" size={19} color="#1A1A2E" />
                </Pressable>
              ) : null}
            </View>
          </Animated.View>

          <Animated.View style={[styles.topOverlay, styles.searchOverlayRow, searchRowStyle]} pointerEvents={searchActive ? 'auto' : 'none'}>
            <View style={styles.searchInputBox}>
              <Ionicons name="search" size={20} color="#1A1A2E" />
              <TextInput
                ref={searchInputRef}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Cerca allievo..."
                placeholderTextColor="#94A3B8"
                style={styles.searchInput}
                autoCorrect={false}
                returnKeyType="search"
              />
              {searchQuery.length > 0 ? (
                <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color="#CBD5E1" />
                </Pressable>
              ) : null}
            </View>
            <Pressable onPress={closeSearch} hitSlop={8}>
              <Text style={styles.cancelText}>Annulla</Text>
            </Pressable>
          </Animated.View>
        </View>

        {/* Pills (pinned: slide up under the buttons on scroll) */}
        {useClusters ? (
          <Animated.View style={[styles.pillsWrap, pillsWrapStyle]} pointerEvents="box-none">
            {renderPills}
          </Animated.View>
        ) : null}
      </View>

      {/* ── List ── */}
      <Animated.FlatList
        data={loading ? [] : searchData}
        renderItem={({ item }) => (
          <Animated.View entering={FadeIn.duration(340)}>
            {renderRow(item)}
          </Animated.View>
        )}
        keyExtractor={(item) => `${segment}-${item.id}`}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressViewOffset={headerH}
          />
        }
        contentContainerStyle={[styles.content, { paddingTop: insets.top + COMPACT_H }]}
        ListHeaderComponent={
          <View>
            <Animated.View style={[{ justifyContent: 'flex-end' }, largeTitleWrapStyle]}>
              <Animated.Text style={[styles.largeTitle, largeTitleStyle]}>Allievi</Animated.Text>
            </Animated.View>
            {/* Spacer for the pinned pills (+ gap before the first row) */}
            {useClusters ? <View style={{ height: PILLS_H + 10 }} /> : <View style={{ height: 8 }} />}
          </View>
        }
        ListEmptyComponent={
          loading ? skeletonContent : (
            <Text style={styles.emptyText}>
              {searchActive && searchQuery.trim() ? 'Nessun risultato' : 'Nessun allievo trovato.'}
            </Text>
          )
        }
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: H_PAD, paddingBottom: 120 },

  /* Header */
  headerWrap: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, overflow: 'visible' },
  headerBorder: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    height: StyleSheet.hairlineWidth, backgroundColor: colors.border,
  },
  compactRow: { height: COMPACT_H, justifyContent: 'center' },
  topOverlay: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: H_PAD,
  },
  searchOverlayRow: { gap: 14 },
  searchInputBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9,
    height: 46, borderRadius: 999, paddingHorizontal: 16,
    backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#1A1A2E',
  },
  compactTitle: { fontSize: 20, fontWeight: '700', color: '#1A1A2E', letterSpacing: -0.3, marginLeft: 2 },
  headerBtns: { flexDirection: 'row', gap: 10 },
  circleBtn: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: '#F1F5F9',
    alignItems: 'center', justifyContent: 'center',
  },
  pillsWrap: { height: PILLS_H, justifyContent: 'center', paddingHorizontal: H_PAD },

  largeTitle: { fontSize: 32, fontWeight: '700', color: '#1A1A2E', letterSpacing: -0.5 },

  /* Filter pills */
  filterRow: { flexDirection: 'row', gap: 8 },
  pill: { paddingHorizontal: 20, paddingVertical: 11, borderRadius: 999, backgroundColor: '#EEF0F3' },
  pillActive: { backgroundColor: '#1A1A2E' },
  pillText: { fontSize: 14, fontWeight: '500', color: '#475569' },
  pillTextActive: { color: '#FFFFFF', fontWeight: '600' },

  /* Flat row */
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10 },
  avatar: {
    width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  avatarText: { fontSize: 17, fontWeight: '700' },
  rowBody: { flex: 1, minWidth: 0, gap: 3 },
  rowName: { fontSize: 16, fontWeight: '600', color: '#1A1A2E', letterSpacing: -0.2 },
  rowSub: { fontSize: 14, color: '#94A3B8' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 14, fontWeight: '500', color: '#475569', flexShrink: 1 },

  emptyText: { textAlign: 'center', color: '#94A3B8', marginTop: 24, fontSize: 15 },

  /* Inline search input */
  searchInput: { flex: 1, fontSize: 16, color: '#1A1A2E', padding: 0 },
  cancelText: { fontSize: 16, fontWeight: '700', color: '#1A1A2E', letterSpacing: -0.2 },
});
