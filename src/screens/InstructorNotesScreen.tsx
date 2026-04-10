import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
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
import {
  AutoscuolaAppointmentWithRelations,
} from '../types/regloApi';
import { colors, spacing } from '../theme';

export const InstructorNotesScreen = () => {
  const router = useRouter();
  const { instructorId } = useSession();
  const [students, setStudents] = useState<Array<{ id: string; firstName: string; lastName: string }>>([]);
  const [allAppointments, setAllAppointments] = useState<AutoscuolaAppointmentWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<{ text: string; tone: ToastTone } | null>(null);
  const [search, setSearch] = useState('');

  const loadData = useCallback(async () => {
    if (!instructorId) return;
    try {
      const [bootstrap, appts] = await Promise.all([
        regloApi.getAgendaBootstrap({
          instructorId,
          from: new Date(0).toISOString(),
          to: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          limit: 1,
        }),
        regloApi.getAppointments({
          limit: 500,
        }),
      ]);
      setStudents(bootstrap.students);
      setAllAppointments(
        appts.filter((a) => (a.status ?? '').trim().toLowerCase() !== 'cancelled'),
      );
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
    const map = new Map<string, { total: number; withNotes: number }>();
    for (const appt of allAppointments) {
      const sid = appt.studentId;
      const entry = map.get(sid) ?? { total: 0, withNotes: 0 };
      entry.total++;
      if (appt.notes?.trim()) entry.withNotes++;
      map.set(sid, entry);
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

  return (
    <Screen>
      <StatusBar style="dark" />
      <ToastNotice message={toast?.text ?? null} tone={toast?.tone} onHide={() => setToast(null)} />
      <ScrollView
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
      >
        <Text style={styles.title}>Note allievi</Text>
        <Text style={styles.subtitle}>Guide e note per ogni allievo</Text>

        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color="#94A3B8" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Cerca allievo..."
            placeholderTextColor="#94A3B8"
            style={styles.searchInput}
          />
        </View>

        {loading ? (
          <View style={{ gap: 12 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={`skel-${i}`} style={{ padding: 14, borderRadius: 16 }}>
                <SkeletonBlock width="60%" height={16} radius={6} />
                <SkeletonBlock width="40%" height={12} radius={6} />
              </SkeletonCard>
            ))}
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {filteredStudents.map((student) => {
              const stats = studentStats.get(student.id);
              const initials = `${student.firstName.charAt(0)}${student.lastName.charAt(0)}`.toUpperCase();
              return (
                <Pressable
                  key={student.id}
                  style={styles.studentCard}
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
                  <View style={{ flex: 1 }}>
                    <Text style={styles.studentName}>
                      {student.firstName} {student.lastName}
                    </Text>
                    <Text style={styles.studentMeta}>
                      {stats?.total ?? 0} guide {'\u2022'} {stats?.withNotes ?? 0} con note
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
                </Pressable>
              );
            })}
            {!filteredStudents.length ? (
              <Text style={styles.emptyText}>Nessun allievo trovato.</Text>
            ) : null}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    paddingBottom: 120,
    gap: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1E293B',
  },
  subtitle: {
    fontSize: 15,
    color: '#64748B',
    marginTop: -8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
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
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    padding: 14,
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FCE7F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#EC4899',
  },
  studentName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
  },
  studentMeta: {
    fontSize: 13,
    color: '#64748B',
  },
  emptyText: {
    textAlign: 'center',
    color: '#94A3B8',
    marginTop: 20,
  },
});
