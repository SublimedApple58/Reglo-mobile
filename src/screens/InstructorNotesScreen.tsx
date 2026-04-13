import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Keyboard,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { Screen } from '../components/Screen';
import { ToastNotice, ToastTone } from '../components/ToastNotice';
import { SkeletonBlock, SkeletonCard } from '../components/Skeleton';
import { useSession } from '../context/SessionContext';
import { regloApi } from '../services/regloApi';
import { AutoscuolaAppointmentWithRelations } from '../types/regloApi';
import { colors, spacing } from '../theme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

type StudentEntry = {
  id: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  assignedInstructorId?: string | null;
};

export const InstructorNotesScreen = () => {
  const router = useRouter();
  const { instructorId } = useSession();
  const [students, setStudents] = useState<StudentEntry[]>([]);
  const [allAppointments, setAllAppointments] = useState<AutoscuolaAppointmentWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<{ text: string; tone: ToastTone } | null>(null);
  const [autonomousMode, setAutonomousMode] = useState(false);

  // Search overlay
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<TextInput>(null);
  const searchProgress = useSharedValue(0); // 0 = closed, 1 = open
  const timing = { duration: 250, easing: Easing.bezier(0.25, 0.1, 0.25, 1) };

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: searchProgress.value * 0.45,
  }));

  const searchBarStyle = useAnimatedStyle(() => ({
    opacity: searchProgress.value,
    transform: [
      { translateY: (1 - searchProgress.value) * -40 },
      { scale: 0.92 + searchProgress.value * 0.08 },
    ],
  }));

  const openSearch = () => {
    setSearchOpen(true);
    setSearchQuery('');
    searchProgress.value = withTiming(1, { duration: 350, easing: Easing.bezier(0.22, 1.6, 0.36, 1) });
    setTimeout(() => searchInputRef.current?.focus(), 150);
  };

  const closeSearch = () => {
    Keyboard.dismiss();
    searchProgress.value = withTiming(0, timing);
    setTimeout(() => {
      setSearchOpen(false);
      setSearchQuery('');
    }, 250);
  };

  const loadData = useCallback(async () => {
    if (!instructorId) return;
    try {
      const [bootstrap, appts, instructorSettingsResponse] = await Promise.all([
        regloApi.getAgendaBootstrap({
          instructorId,
          from: new Date(0).toISOString(),
          to: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          limit: 1,
        }),
        regloApi.getAppointments({ limit: 500 }),
        regloApi.getInstructorSettings(),
      ]);
      setStudents(bootstrap.students);
      setAllAppointments(
        appts.filter((a) => (a.status ?? '').trim().toLowerCase() !== 'cancelled'),
      );
      setAutonomousMode(instructorSettingsResponse.autonomousMode);
    } catch {
      setToast({ text: 'Errore nel caricamento', tone: 'danger' });
    } finally {
      setLoading(false);
    }
  }, [instructorId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const studentStats = useMemo(() => {
    const map = new Map<string, number>();
    for (const appt of allAppointments) {
      map.set(appt.studentId, (map.get(appt.studentId) ?? 0) + 1);
    }
    return map;
  }, [allAppointments]);

  const useClusters = autonomousMode && !!instructorId;

  // Main list (no search filter — search is in overlay)
  const sections = useMemo(() => {
    if (!useClusters) return [];
    const mine: StudentEntry[] = [];
    const others: StudentEntry[] = [];
    for (const s of students) {
      if (s.assignedInstructorId === instructorId) {
        mine.push(s);
      } else {
        others.push(s);
      }
    }
    return [
      ...(mine.length ? [{ key: 'mine', title: 'I miei allievi', count: mine.length, data: mine }] : []),
      ...(others.length ? [{ key: 'others', title: 'Altri allievi', count: others.length, data: others }] : []),
    ];
  }, [useClusters, students, instructorId]);

  // Search results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.trim().toLowerCase();
    return students.filter(
      (s) =>
        s.firstName.toLowerCase().includes(q) ||
        s.lastName.toLowerCase().includes(q) ||
        `${s.firstName} ${s.lastName}`.toLowerCase().includes(q),
    );
  }, [students, searchQuery]);

  const navigateToStudent = (student: StudentEntry) => {
    closeSearch();
    router.push({
      pathname: '/(tabs)/notes/[studentId]',
      params: { studentId: student.id, name: `${student.firstName} ${student.lastName}` },
    } as never);
  };

  const renderStudentCard = useCallback(
    (student: StudentEntry) => {
      const guideCount = studentStats.get(student.id) ?? 0;
      const initials = `${student.firstName.charAt(0)}${student.lastName.charAt(0)}`.toUpperCase();
      return (
        <Pressable
          key={student.id}
          style={({ pressed }) => [styles.studentCard, pressed && { backgroundColor: '#F8FAFC' }]}
          onPress={() => navigateToStudent(student)}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.studentInfo}>
            <Text style={styles.studentName} numberOfLines={1}>
              {student.firstName} {student.lastName}
            </Text>
            <Text style={styles.studentMeta} numberOfLines={1}>
              {guideCount} guid{guideCount === 1 ? 'a' : 'e'}
              {student.phone ? ` · ${student.phone}` : ''}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
        </Pressable>
      );
    },
    [studentStats, router],
  );

  const refreshControl = (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={handleRefresh}
      tintColor={colors.primary}
      colors={[colors.primary]}
    />
  );

  const headerContent = (
    <View style={styles.titleRow}>
      <Text style={styles.title}>Allievi</Text>
      <Pressable onPress={openSearch} style={styles.searchPill} hitSlop={4}>
        <Ionicons name="search" size={20} color="#64748B" />
      </Pressable>
    </View>
  );

  const skeletonContent = (
    <View style={{ gap: 10 }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <SkeletonCard key={`skel-${i}`} style={{ padding: 14, borderRadius: 20 }}>
          <SkeletonBlock width="55%" height={16} radius={6} />
          <SkeletonBlock width="35%" height={12} radius={6} />
        </SkeletonCard>
      ))}
    </View>
  );

  const emptyComponent = loading ? skeletonContent : (
    <Text style={styles.emptyText}>Nessun allievo trovato.</Text>
  );

  return (
    <Screen>
      <StatusBar style={searchOpen ? 'light' : 'dark'} />
      <ToastNotice message={toast?.text ?? null} tone={toast?.tone} onHide={() => setToast(null)} />

      {/* Main list */}
      {useClusters && !loading ? (
        <SectionList
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={refreshControl}
          sections={sections}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={headerContent}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeaderText}>{section.title}</Text>
              <View style={styles.sectionBadge}>
                <Text style={styles.sectionBadgeText}>{(section as typeof sections[number]).count}</Text>
              </View>
            </View>
          )}
          renderItem={({ item }) => renderStudentCard(item)}
          ListEmptyComponent={emptyComponent}
          stickySectionHeadersEnabled={false}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          SectionSeparatorComponent={() => <View style={{ height: 4 }} />}
        />
      ) : (
        <FlatList
          data={loading ? [] : students}
          renderItem={({ item }) => renderStudentCard(item)}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={refreshControl}
          ListHeaderComponent={headerContent}
          ListEmptyComponent={emptyComponent}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        />
      )}

      {/* Search overlay */}
      {searchOpen ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          {/* Backdrop */}
          <Animated.View style={[styles.searchBackdrop, backdropStyle]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={closeSearch} />
          </Animated.View>

          {/* Search bar + results */}
          <Animated.View style={[styles.searchOverlay, searchBarStyle]}>
            <View style={styles.searchBar}>
              <Ionicons name="search" size={20} color="#EC4899" />
              <TextInput
                ref={searchInputRef}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Cerca allievo..."
                placeholderTextColor="#94A3B8"
                style={styles.searchBarInput}
                autoCorrect={false}
                returnKeyType="search"
              />
              <Pressable onPress={closeSearch} hitSlop={8}>
                <Ionicons name="close-circle" size={22} color="#CBD5E1" />
              </Pressable>
            </View>

            {/* Results */}
            {searchQuery.trim().length > 0 ? (
              <Animated.View entering={FadeIn.duration(150)} style={styles.searchResults}>
                {searchResults.length > 0 ? (
                  searchResults.slice(0, 8).map((student, idx) => {
                    const initials = `${student.firstName.charAt(0)}${student.lastName.charAt(0)}`.toUpperCase();
                    const guideCount = studentStats.get(student.id) ?? 0;
                    return (
                      <Animated.View
                        key={student.id}
                        entering={FadeIn.duration(60).delay(idx * 8)}
                      >
                        <Pressable
                          style={({ pressed }) => [styles.searchResultRow, pressed && { backgroundColor: '#F8FAFC' }]}
                          onPress={() => navigateToStudent(student)}
                        >
                          <View style={styles.searchResultAvatar}>
                            <Text style={styles.searchResultAvatarText}>{initials}</Text>
                          </View>
                          <View style={{ flex: 1, gap: 1 }}>
                            <Text style={styles.searchResultName}>
                              {student.firstName} {student.lastName}
                            </Text>
                            <Text style={styles.searchResultMeta}>
                              {guideCount} guid{guideCount === 1 ? 'a' : 'e'}
                            </Text>
                          </View>
                        </Pressable>
                      </Animated.View>
                    );
                  })
                ) : (
                  <Text style={styles.searchNoResults}>Nessun risultato</Text>
                )}
              </Animated.View>
            ) : null}
          </Animated.View>
        </View>
      ) : null}
    </Screen>
  );
};

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    paddingBottom: 120,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1E293B',
  },
  searchPill: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Search overlay */
  searchBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
  },
  searchOverlay: {
    marginTop: 60,
    marginHorizontal: spacing.lg,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 16,
    height: 54,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  searchBarInput: {
    flex: 1,
    fontSize: 16,
    color: '#1E293B',
    fontWeight: '500',
  },
  searchResults: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginTop: 8,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    maxHeight: SCREEN_HEIGHT * 0.5,
  },
  searchResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 12,
  },
  searchResultAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FCE7F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchResultAvatarText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#EC4899',
  },
  searchResultName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
  },
  searchResultMeta: {
    fontSize: 12,
    color: '#94A3B8',
  },
  searchNoResults: {
    textAlign: 'center',
    color: '#94A3B8',
    paddingVertical: 20,
    fontSize: 14,
  },

  /* Student cards */
  studentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    padding: 14,
    gap: 12,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FCE7F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#EC4899',
  },
  studentInfo: {
    flex: 1,
    gap: 2,
  },
  studentName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
  },
  studentMeta: {
    fontSize: 13,
    color: '#94A3B8',
  },
  emptyText: {
    textAlign: 'center',
    color: '#94A3B8',
    marginTop: 24,
    fontSize: 15,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 14,
    paddingBottom: 8,
  },
  sectionHeaderText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  sectionBadge: {
    backgroundColor: '#FCE7F3',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#EC4899',
  },
});
