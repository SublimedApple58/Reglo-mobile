import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
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
  const [search, setSearch] = useState('');
  const [autonomousMode, setAutonomousMode] = useState(false);

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

  const filteredStudents = useMemo(() => {
    if (!search.trim()) return students;
    const q = search.trim().toLowerCase();
    return students.filter(
      (s) =>
        s.firstName.toLowerCase().includes(q) ||
        s.lastName.toLowerCase().includes(q) ||
        `${s.firstName} ${s.lastName}`.toLowerCase().includes(q),
    );
  }, [students, search]);

  const useClusters = autonomousMode && !!instructorId;

  const sections = useMemo(() => {
    if (!useClusters) return [];
    const mine: StudentEntry[] = [];
    const others: StudentEntry[] = [];
    for (const s of filteredStudents) {
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
  }, [useClusters, filteredStudents, instructorId]);

  const renderStudentCard = useCallback(
    (student: StudentEntry) => {
      const guideCount = studentStats.get(student.id) ?? 0;
      const initials = `${student.firstName.charAt(0)}${student.lastName.charAt(0)}`.toUpperCase();
      return (
        <Pressable
          key={student.id}
          style={({ pressed }) => [styles.studentCard, pressed && { backgroundColor: '#F8FAFC' }]}
          onPress={() =>
            router.push({
              pathname: '/(tabs)/notes/[studentId]',
              params: { studentId: student.id, name: `${student.firstName} ${student.lastName}` },
            } as never)
          }
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
    <>
      <Text style={styles.title}>Allievi</Text>
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color="#94A3B8" />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Cerca allievo..."
          placeholderTextColor="#94A3B8"
          style={styles.searchInput}
          autoCorrect={false}
        />
        {search.length > 0 ? (
          <Pressable onPress={() => setSearch('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color="#CBD5E1" />
          </Pressable>
        ) : null}
      </View>
    </>
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

  // Sections mode (autonomous instructor)
  if (useClusters && !loading) {
    return (
      <Screen>
        <StatusBar style="dark" />
        <ToastNotice message={toast?.text ?? null} tone={toast?.tone} onHide={() => setToast(null)} />
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
      </Screen>
    );
  }

  // Flat mode (non-autonomous or loading)
  return (
    <Screen>
      <StatusBar style="dark" />
      <ToastNotice message={toast?.text ?? null} tone={toast?.tone} onHide={() => setToast(null)} />
      <FlatList
        data={loading ? [] : filteredStudents}
        renderItem={({ item }) => renderStudentCard(item)}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={refreshControl}
        ListHeaderComponent={headerContent}
        ListEmptyComponent={emptyComponent}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    paddingBottom: 120,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    height: 48,
    gap: 10,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#1E293B',
  },
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
