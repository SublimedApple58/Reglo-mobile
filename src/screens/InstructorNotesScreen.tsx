import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
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
    let list = students;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (s) =>
          s.firstName.toLowerCase().includes(q) ||
          s.lastName.toLowerCase().includes(q) ||
          `${s.firstName} ${s.lastName}`.toLowerCase().includes(q),
      );
    }
    // If autonomous, show assigned first
    if (autonomousMode && instructorId) {
      const mine = list.filter((s) => s.assignedInstructorId === instructorId);
      const others = list.filter((s) => s.assignedInstructorId !== instructorId);
      return [...mine, ...others];
    }
    return list;
  }, [students, search, autonomousMode, instructorId]);

  const renderItem = useCallback(
    ({ item: student }: { item: StudentEntry }) => {
      const guideCount = studentStats.get(student.id) ?? 0;
      const initials = `${student.firstName.charAt(0)}${student.lastName.charAt(0)}`.toUpperCase();
      const isAssigned = autonomousMode && student.assignedInstructorId === instructorId;
      return (
        <Pressable
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
            <View style={styles.studentNameRow}>
              <Text style={styles.studentName} numberOfLines={1}>
                {student.firstName} {student.lastName}
              </Text>
              {isAssigned ? (
                <View style={styles.assignedDot} />
              ) : null}
            </View>
            <Text style={styles.studentMeta} numberOfLines={1}>
              {guideCount} guid{guideCount === 1 ? 'a' : 'e'}
              {student.phone ? ` · ${student.phone}` : ''}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
        </Pressable>
      );
    },
    [studentStats, router, autonomousMode, instructorId],
  );

  return (
    <Screen>
      <StatusBar style="dark" />
      <ToastNotice message={toast?.text ?? null} tone={toast?.tone} onHide={() => setToast(null)} />
      <FlatList
        data={loading ? [] : filteredStudents}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        ListHeaderComponent={
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
        }
        ListEmptyComponent={
          loading ? (
            <View style={{ gap: 10 }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonCard key={`skel-${i}`} style={{ padding: 14, borderRadius: 20 }}>
                  <SkeletonBlock width="55%" height={16} radius={6} />
                  <SkeletonBlock width="35%" height={12} radius={6} />
                </SkeletonCard>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>Nessun allievo trovato.</Text>
          )
        }
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    paddingBottom: 120,
    gap: 14,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1E293B',
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
  studentNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  studentName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
    flexShrink: 1,
  },
  assignedDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#EC4899',
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
});
