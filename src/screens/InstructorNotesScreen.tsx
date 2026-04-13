import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Keyboard,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Switch,
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
import { BottomSheet } from '../components/BottomSheet';
import { SelectableChip } from '../components/SelectableChip';
import { ToastNotice, ToastTone } from '../components/ToastNotice';
import { SkeletonBlock, SkeletonCard } from '../components/Skeleton';
import { useSession } from '../context/SessionContext';
import { regloApi } from '../services/regloApi';
import { AutoscuolaAppointmentWithRelations } from '../types/regloApi';
import { colors, spacing } from '../theme';

const DURATION_OPTIONS = [30, 60, 90, 120] as const;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SEARCH_BAR_MARGIN = 22; // spacing.lg
const SEARCH_BAR_FULL_WIDTH = SCREEN_WIDTH - SEARCH_BAR_MARGIN * 2;

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

  // Booking settings (autonomous mode)
  const [settingsSheetOpen, setSettingsSheetOpen] = useState(false);
  const [bookingSlotDurations, setBookingSlotDurations] = useState<number[]>([30, 60]);
  const [roundedHoursOnly, setRoundedHoursOnly] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);

  const toggleDuration = (dur: number) => {
    setBookingSlotDurations((prev) =>
      prev.includes(dur) ? prev.filter((d) => d !== dur) : [...prev, dur].sort((a, b) => a - b),
    );
  };

  const handleSaveBookingSettings = async () => {
    if (!bookingSlotDurations.length) {
      setToast({ text: 'Seleziona almeno una durata', tone: 'danger' });
      return;
    }
    setSettingsSaving(true);
    try {
      await regloApi.updateInstructorSettings({ bookingSlotDurations, roundedHoursOnly });
      setToast({ text: 'Impostazioni salvate', tone: 'success' });
      setSettingsSheetOpen(false);
    } catch {
      setToast({ text: 'Errore nel salvataggio', tone: 'danger' });
    } finally {
      setSettingsSaving(false);
    }
  };

  // Search — single morphing element
  const [searchVisible, setSearchVisible] = useState(false); // true = overlay mounted
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<TextInput>(null);
  const p = useSharedValue(0); // 0 = pill, 1 = expanded
  const openTiming = { duration: 300, easing: Easing.bezier(0.25, 1, 0.5, 1) };
  const closeTiming = { duration: 200, easing: Easing.out(Easing.quad) };

  // The pill morphs: right→left, 48→full width, circle→rounded rect, drops down
  const PILL_TOP = 83;
  const BAR_TOP = 110;
  const morphStyle = useAnimatedStyle(() => ({
    top: PILL_TOP + p.value * (BAR_TOP - PILL_TOP),
    right: SEARCH_BAR_MARGIN,
    width: 48 + p.value * (SEARCH_BAR_FULL_WIDTH - 48),
    height: 48 + p.value * 6,
    borderRadius: 24 - p.value * 4,
  }));

  const backdropOpacity = useAnimatedStyle(() => ({
    opacity: p.value * 0.45,
  }));

  const inputOpacity = useAnimatedStyle(() => ({
    opacity: p.value,
  }));

  // Icon color interpolation: gray → pink
  const searchOpen = p.value === 1;

  const openSearch = () => {
    setSearchVisible(true);
    setSearchQuery('');
    p.value = withTiming(1, openTiming);
    setTimeout(() => searchInputRef.current?.focus(), 180);
  };

  const closeSearch = () => {
    Keyboard.dismiss();
    p.value = withTiming(0, closeTiming);
    setTimeout(() => {
      setSearchVisible(false);
      setSearchQuery('');
    }, 200);
  };

  const loadData = useCallback(async () => {
    if (!instructorId) return;
    try {
      const [bootstrap, appts, instrSettings] = await Promise.all([
        regloApi.getAgendaBootstrap({
          instructorId,
          from: new Date(0).toISOString(),
          to: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          limit: 1,
        }),
        regloApi.getAppointments({ limit: 500 }),
        regloApi.getInstructorSettings().catch(() => null),
      ]);
      setStudents(bootstrap.students);
      setAllAppointments(
        appts.filter((a) => (a.status ?? '').trim().toLowerCase() !== 'cancelled'),
      );
      if (instrSettings) {
        setAutonomousMode(instrSettings.autonomousMode);
        if (instrSettings.autonomousMode) {
          setBookingSlotDurations(
            instrSettings.settings.bookingSlotDurations ?? instrSettings.companyDefaults.bookingSlotDurations,
          );
          setRoundedHoursOnly(
            instrSettings.settings.roundedHoursOnly ?? instrSettings.companyDefaults.roundedHoursOnly,
          );
        }
      }
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
      {autonomousMode ? (
        <Pressable onPress={() => setSettingsSheetOpen(true)} style={styles.gearPill} hitSlop={4}>
          <Ionicons name="settings-outline" size={20} color="#64748B" />
        </Pressable>
      ) : null}
      <Text style={[styles.title, { flex: 1 }]}>Allievi</Text>
      {/* Spacer matching search pill size */}
      <View style={{ width: 48, height: 48 }} />
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

      {/* Morphing search pill/bar — always absolute, IS the pill */}
      <Animated.View style={[styles.morphPill, morphStyle]} pointerEvents="box-none">
        <Pressable
          onPress={searchVisible ? undefined : openSearch}
          style={styles.morphPillInner}
          pointerEvents="auto"
        >
          <Ionicons name="search" size={20} color={searchVisible ? '#EC4899' : '#64748B'} />
          {searchVisible ? (
            <Animated.View style={[styles.morphInputRow, inputOpacity]}>
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
            </Animated.View>
          ) : null}
        </Pressable>
      </Animated.View>

      {/* Backdrop + results overlay */}
      {searchVisible ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <Animated.View style={[styles.searchBackdrop, backdropOpacity]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={closeSearch} />
          </Animated.View>

          {/* Results card */}
          {searchQuery.trim().length > 0 ? (
            <Animated.View entering={FadeIn.duration(120)} style={styles.searchResultsContainer}>
              <View style={styles.searchResults}>
                {searchResults.length > 0 ? (
                  searchResults.slice(0, 8).map((student, idx) => {
                    const initials = `${student.firstName.charAt(0)}${student.lastName.charAt(0)}`.toUpperCase();
                    const guideCount = studentStats.get(student.id) ?? 0;
                    return (
                      <Animated.View
                        key={student.id}
                        entering={FadeInDown.duration(25).delay(idx * 2).springify().damping(24).stiffness(600)}
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
              </View>
            </Animated.View>
          ) : null}
        </View>
      ) : null}

      {/* Booking settings BottomSheet */}
      <BottomSheet
        visible={settingsSheetOpen}
        title="Impostazioni prenotazione"
        onClose={() => setSettingsSheetOpen(false)}
        showHandle
        footer={
          <Pressable
            onPress={settingsSaving ? undefined : handleSaveBookingSettings}
            disabled={settingsSaving}
            style={({ pressed }) => [
              styles.saveBtn,
              pressed && { opacity: 0.85 },
              settingsSaving && { opacity: 0.6 },
            ]}
          >
            {settingsSaving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.saveBtnText}>Salva impostazioni</Text>
            )}
          </Pressable>
        }
      >
        <View style={styles.sheetContent}>
          <Text style={styles.sheetDesc}>
            Configura come i tuoi allievi possono prenotare le guide.
          </Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Durata guide</Text>
            <View style={styles.chipsRow}>
              {DURATION_OPTIONS.map((dur) => (
                <SelectableChip
                  key={dur}
                  label={`${dur} min`}
                  active={bookingSlotDurations.includes(dur)}
                  onPress={() => toggleDuration(dur)}
                />
              ))}
            </View>
          </View>

          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleLabel}>Solo orari tondi</Text>
              <Text style={styles.toggleDesc}>
                Prenotazioni solo a inizio ora (es. 9:00, 10:00)
              </Text>
            </View>
            <Switch
              value={roundedHoursOnly}
              onValueChange={setRoundedHoursOnly}
              trackColor={{ false: '#E2E8F0', true: '#FACC15' }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>
      </BottomSheet>
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
  gearPill: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },

  /* Settings BottomSheet */
  sheetContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    gap: 20,
  },
  sheetDesc: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
  },
  fieldGroup: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  toggleLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
  },
  toggleDesc: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 2,
  },
  saveBtn: {
    height: 50,
    borderRadius: 999,
    backgroundColor: '#EC4899',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  /* Morphing pill/bar */
  morphPill: {
    position: 'absolute',
    // top is animated via morphStyle
    zIndex: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  morphPillInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 10,
  },
  morphInputRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchBarInput: {
    flex: 1,
    fontSize: 16,
    color: '#1E293B',
    fontWeight: '500',
  },

  /* Backdrop + results */
  searchBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 1)',
  },
  searchResultsContainer: {
    marginTop: 175,
    marginHorizontal: SEARCH_BAR_MARGIN,
  },
  searchResults: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 6,
    overflow: 'hidden',
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
