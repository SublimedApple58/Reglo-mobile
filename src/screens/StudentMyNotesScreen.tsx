import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { Screen } from '../components/Screen';
import { StarRating } from '../components/StarRating';
import { ToastNotice, ToastTone } from '../components/ToastNotice';
import { SkeletonBlock, SkeletonCard } from '../components/Skeleton';
import { useSession } from '../context/SessionContext';
import { regloApi } from '../services/regloApi';
import { AutoscuolaAppointmentWithRelations, AutoscuolaStudent } from '../types/regloApi';
import { colors, spacing } from '../theme';
import { formatDay, formatTime } from '../utils/date';

const normalize = (v: string | null | undefined) => (v ?? '').trim().toLowerCase();

const findLinkedStudent = (
  students: AutoscuolaStudent[],
  user: { name: string | null; email: string } | null
) => {
  if (!user) return null;
  const normalizedEmail = normalize(user.email);
  const normalizedName = normalize(user.name);

  const byEmail = students.find((s) => normalize(s.email) === normalizedEmail);
  if (byEmail) return byEmail;

  if (!normalizedName) return null;
  const byName = students.find(
    (s) => `${normalize(s.firstName)} ${normalize(s.lastName)}` === normalizedName
  );
  return byName ?? null;
};

export const StudentMyNotesScreen = () => {
  const { user } = useSession();
  const [appointments, setAppointments] = useState<AutoscuolaAppointmentWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<{ text: string; tone: ToastTone } | null>(null);

  const loadData = useCallback(async () => {
    try {
      const students = await regloApi.getStudents();
      const linked = findLinkedStudent(students, user);
      if (!linked) {
        setAppointments([]);
        return;
      }
      const appts = await regloApi.getAppointments({ studentId: linked.id, limit: 500 });
      const withNotes = appts
        .filter(
          (a) =>
            a.notes?.trim() &&
            (a.status ?? '').trim().toLowerCase() !== 'cancelled'
        )
        .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());
      setAppointments(withNotes);
    } catch {
      setToast({ text: 'Errore nel caricamento', tone: 'danger' });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

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
        <Text style={styles.title}>Le mie note</Text>
        <Text style={styles.subtitle}>Note rilasciate dai tuoi istruttori</Text>

        {loading ? (
          <View style={{ gap: 12 }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonCard key={`skel-${i}`} style={{ padding: 14, borderRadius: 16 }}>
                <SkeletonBlock width="50%" height={16} radius={6} />
                <SkeletonBlock width="80%" height={12} radius={6} />
                <SkeletonBlock width="65%" height={12} radius={6} />
              </SkeletonCard>
            ))}
          </View>
        ) : appointments.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={48} color="#CBD5E1" />
            <Text style={styles.emptyTitle}>Nessuna nota</Text>
            <Text style={styles.emptyText}>
              Le note rilasciate dagli istruttori dopo le guide appariranno qui.
            </Text>
          </View>
        ) : (
          <View style={{ gap: 0 }}>
            {appointments.map((appt, idx) => {
              const isLast = idx === appointments.length - 1;
              const isExam = (appt.type ?? '').trim().toLowerCase() === 'esame';
              const allTypes = (appt.types?.length ? appt.types : (appt.type ? [appt.type] : [])).filter((t: string) => t !== 'guida');
              const instructorName = appt.instructor?.name ?? 'Istruttore';
              return (
                <View key={appt.id} style={styles.timelineRow}>
                  <View style={styles.timelineLeft}>
                    <Text style={styles.timelineDate}>{formatDay(appt.startsAt)}</Text>
                    {!isLast ? <View style={styles.timelineLine} /> : null}
                  </View>
                  {isExam ? (
                    <View style={styles.examCard}>
                      <View style={styles.examAccent} />
                      <View style={styles.examContent}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <View style={styles.examIconCircle}>
                            <Ionicons name="school" size={14} color="#FFFFFF" />
                          </View>
                          <Text style={styles.examLabel}>ESAME</Text>
                          <Text style={styles.examTime}>
                            {formatTime(appt.startsAt)} – {appt.endsAt ? formatTime(appt.endsAt) : ''}
                          </Text>
                        </View>
                        <View style={styles.instructorRow}>
                          <Ionicons name="person-outline" size={13} color="#8B5CF6" />
                          <Text style={[styles.instructorName, { color: '#8B5CF6' }]}>{instructorName}</Text>
                        </View>
                        {appt.notes?.trim() ? (
                          <Text style={styles.timelineNote}>{appt.notes.trim()}</Text>
                        ) : null}
                      </View>
                    </View>
                  ) : (
                    <View style={styles.timelineCard}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <Text style={styles.timelineTime}>
                          {formatTime(appt.startsAt)} – {appt.endsAt ? formatTime(appt.endsAt) : ''}
                        </Text>
                        {allTypes.map((t: string, i: number) => (
                          <View key={i} style={styles.lessonBadge}>
                            <Text style={styles.lessonBadgeText}>
                              {t.charAt(0).toUpperCase() + t.slice(1)}
                            </Text>
                          </View>
                        ))}
                        {appt.rating != null ? (
                          <StarRating value={appt.rating} readOnly size={14} />
                        ) : null}
                      </View>
                      <View style={styles.instructorRow}>
                        <Ionicons name="person-outline" size={13} color="#64748B" />
                        <Text style={styles.instructorName}>{instructorName}</Text>
                        {appt.vehicle?.name ? (
                          <Text style={styles.vehicleName}> · {appt.vehicle.name}</Text>
                        ) : null}
                      </View>
                      {appt.notes?.trim() ? (
                        <Text style={styles.timelineNote}>{appt.notes.trim()}</Text>
                      ) : (
                        <Text style={[styles.timelineNote, { color: '#94A3B8' }]}>Nessuna nota</Text>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
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
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 4,
  },
  emptyText: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    maxWidth: 260,
    lineHeight: 20,
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
  instructorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  instructorName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  vehicleName: {
    fontSize: 13,
    color: '#94A3B8',
  },
  timelineNote: {
    fontSize: 14,
    color: '#475569',
    marginTop: 4,
    lineHeight: 20,
  },
  examCard: {
    flex: 1,
    flexDirection: 'row' as const,
    backgroundColor: '#F5F3FF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DDD6FE',
    marginBottom: 10,
    overflow: 'hidden' as const,
    shadowColor: '#7C3AED',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  examAccent: {
    width: 4,
    backgroundColor: '#8B5CF6',
  },
  examContent: {
    flex: 1,
    padding: 14,
    gap: 4,
  },
  examIconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#8B5CF6',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  examLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#7C3AED',
    letterSpacing: 0.8,
  },
  examTime: {
    fontSize: 13,
    fontWeight: '600',
    color: '#A78BFA',
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
});
