import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Linking,
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
import { Screen } from '../components/Screen';
import { ToastNotice, ToastTone } from '../components/ToastNotice';
import { SkeletonBlock, SkeletonCard } from '../components/Skeleton';
import { useSession } from '../context/SessionContext';
import { regloApi } from '../services/regloApi';
import {
  AutoscuolaAppointmentWithRelations,
} from '../types/regloApi';
import { colors, spacing } from '../theme';
import { formatDay, formatTime } from '../utils/date';

export const InstructorNotesScreen = () => {
  const { instructorId } = useSession();
  const [students, setStudents] = useState<Array<{ id: string; firstName: string; lastName: string }>>([]);
  const [allAppointments, setAllAppointments] = useState<AutoscuolaAppointmentWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<{ text: string; tone: ToastTone } | null>(null);
  const [search, setSearch] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [selectedStudentName, setSelectedStudentName] = useState('');
  const [studentAppointments, setStudentAppointments] = useState<AutoscuolaAppointmentWithRelations[]>([]);
  const [studentLoading, setStudentLoading] = useState(false);

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
          instructorId,
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

  const handleOpenStudent = useCallback(
    (studentId: string, name: string) => {
      setSelectedStudentId(studentId);
      setSelectedStudentName(name);
      const appts = allAppointments
        .filter((a) => a.studentId === studentId)
        .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());
      setStudentAppointments(appts);
    },
    [allAppointments],
  );

  const notesWithContent = useMemo(
    () => studentAppointments.filter((a) => a.notes?.trim()),
    [studentAppointments],
  );

  if (selectedStudentId) {
    const student = students.find((s) => s.id === selectedStudentId);
    return (
      <Screen>
        <StatusBar style="dark" />
        <ToastNotice message={toast?.text ?? null} tone={toast?.tone} onHide={() => setToast(null)} />
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Pressable
            style={styles.backRow}
            onPress={() => {
              setSelectedStudentId(null);
              setStudentAppointments([]);
            }}
          >
            <Ionicons name="arrow-back" size={22} color="#1E293B" />
            <Text style={styles.backTitle}>{selectedStudentName}</Text>
          </Pressable>

          {student?.id && (
            <View style={styles.summaryCard}>
              <Text style={styles.summaryText}>
                {studentAppointments.length} guide totali {'\u2022'} {notesWithContent.length} con note
              </Text>
            </View>
          )}

          <View style={{ gap: 0 }}>
            {studentAppointments.map((appt, idx) => {
              const isLast = idx === studentAppointments.length - 1;
              const lessonType = appt.type && appt.type !== 'guida' ? appt.type : null;
              return (
                <View key={appt.id} style={styles.timelineRow}>
                  <View style={styles.timelineLeft}>
                    <Text style={styles.timelineDate}>{formatDay(appt.startsAt)}</Text>
                    {!isLast ? <View style={styles.timelineLine} /> : null}
                  </View>
                  <View style={[styles.timelineCard, !appt.notes?.trim() && { opacity: 0.6 }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={styles.timelineTime}>
                        {formatTime(appt.startsAt)} – {appt.endsAt ? formatTime(appt.endsAt) : ''}
                      </Text>
                      {lessonType ? (
                        <View style={styles.lessonBadge}>
                          <Text style={styles.lessonBadgeText}>
                            {lessonType.charAt(0).toUpperCase() + lessonType.slice(1)}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.timelineMeta}>
                      {appt.vehicle?.name ?? 'Veicolo n/d'}
                    </Text>
                    <Text
                      style={[
                        styles.timelineNote,
                        !appt.notes?.trim() && { color: '#94A3B8' },
                      ]}
                    >
                      {appt.notes?.trim() || 'Nessuna nota'}
                    </Text>
                  </View>
                </View>
              );
            })}
            {!studentAppointments.length ? (
              <Text style={styles.emptyText}>
                Nessuna guida registrata con questo allievo.
              </Text>
            ) : null}
          </View>
        </ScrollView>
      </Screen>
    );
  }

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
                    handleOpenStudent(student.id, `${student.firstName} ${student.lastName}`)
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
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
  },
  summaryCard: {
    backgroundColor: '#FEF9C3',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: 16,
  },
  summaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#92400E',
  },
  timelineRow: {
    flexDirection: 'row',
    minHeight: 90,
  },
  timelineLeft: {
    width: 70,
    alignItems: 'center',
    paddingTop: 14,
  },
  timelineDate: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
    textAlign: 'center',
  },
  timelineLine: {
    width: 1.5,
    flex: 1,
    backgroundColor: '#E2E8F0',
    marginTop: 8,
    minHeight: 20,
  },
  timelineCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    padding: 14,
    marginBottom: 10,
    gap: 2,
  },
  timelineTime: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
  },
  timelineMeta: {
    fontSize: 13,
    color: '#64748B',
  },
  timelineNote: {
    fontSize: 14,
    color: '#475569',
    marginTop: 4,
    lineHeight: 20,
  },
  lessonBadge: {
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  lessonBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#3B82F6',
  },
  emptyText: {
    textAlign: 'center',
    color: '#94A3B8',
    marginTop: 20,
  },
});
