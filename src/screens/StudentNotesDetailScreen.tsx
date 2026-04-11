import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '../components/Screen';
import { StarRating } from '../components/StarRating';
import { ToastNotice, ToastTone } from '../components/ToastNotice';
import { SkeletonBlock, SkeletonCard } from '../components/Skeleton';
import { regloApi } from '../services/regloApi';
import { AutoscuolaAppointmentWithRelations } from '../types/regloApi';
import { colors, spacing } from '../theme';
import { formatDay, formatTime } from '../utils/date';

export const StudentNotesDetailScreen = () => {
  const router = useRouter();
  const { studentId, name } = useLocalSearchParams<{ studentId: string; name: string }>();
  const [appointments, setAppointments] = useState<AutoscuolaAppointmentWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<{ text: string; tone: ToastTone } | null>(null);

  const loadData = useCallback(async () => {
    if (!studentId) return;
    try {
      const appts = await regloApi.getAppointments({ studentId, limit: 500 });
      const filtered = appts
        .filter((a) => (a.status ?? '').trim().toLowerCase() !== 'cancelled')
        .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());
      setAppointments(filtered);
    } catch {
      setToast({ text: 'Errore nel caricamento', tone: 'danger' });
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const notesWithContent = useMemo(
    () => appointments.filter((a) => a.notes?.trim()),
    [appointments],
  );

  return (
    <Screen>
      <StatusBar style="dark" />
      <ToastNotice message={toast?.text ?? null} tone={toast?.tone} onHide={() => setToast(null)} />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} colors={[colors.primary]} />
        }
      >
        <Pressable style={styles.backRow} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#1E293B" />
          <Text style={styles.backTitle}>{name ?? 'Allievo'}</Text>
        </Pressable>

        {!loading && appointments.length > 0 && (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryText}>
              {appointments.length} guide totali {'\u2022'} {notesWithContent.length} con note
            </Text>
          </View>
        )}

        {loading ? (
          <View style={{ gap: 12 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonCard key={`skel-${i}`} style={{ padding: 14, borderRadius: 16 }}>
                <SkeletonBlock width="50%" height={16} radius={6} />
                <SkeletonBlock width="80%" height={12} radius={6} />
              </SkeletonCard>
            ))}
          </View>
        ) : (
          <View style={{ gap: 0 }}>
            {appointments.map((appt, idx) => {
              const isLast = idx === appointments.length - 1;
              const isExam = (appt.type ?? '').trim().toLowerCase() === 'esame';
              const allTypes = (appt.types?.length ? appt.types : (appt.type ? [appt.type] : [])).filter((t: string) => t !== 'guida');
              return (
                <View key={appt.id} style={styles.timelineRow}>
                  <View style={styles.timelineLeft}>
                    <Text style={styles.timelineDate}>{formatDay(appt.startsAt)}</Text>
                    {!isLast ? <View style={styles.timelineLine} /> : null}
                  </View>
                  <View style={[
                    styles.timelineCard,
                    !appt.notes?.trim() && !isExam && { opacity: 0.6 },
                    isExam && styles.examCard,
                  ]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      {isExam ? (
                        <>
                          <Ionicons name="school-outline" size={15} color="#7C3AED" />
                          <Text style={styles.examLabel}>ESAME</Text>
                        </>
                      ) : (
                        <Text style={styles.timelineTime}>
                          {formatTime(appt.startsAt)} – {appt.endsAt ? formatTime(appt.endsAt) : ''}
                        </Text>
                      )}
                      {!isExam && allTypes.map((t: string, i: number) => (
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
                    {isExam ? (
                      <Text style={styles.examTime}>
                        {formatTime(appt.startsAt)} – {appt.endsAt ? formatTime(appt.endsAt) : ''}
                      </Text>
                    ) : null}
                    <Text style={isExam ? styles.examMeta : styles.timelineMeta}>
                      {appt.instructor?.name ?? 'Istruttore'} · {appt.vehicle?.name ?? 'Veicolo n/d'}
                    </Text>
                    {!isExam ? (
                      <Text
                        style={[
                          styles.timelineNote,
                          !appt.notes?.trim() && { color: '#94A3B8' },
                        ]}
                      >
                        {appt.notes?.trim() || 'Nessuna nota'}
                      </Text>
                    ) : appt.notes?.trim() ? (
                      <Text style={styles.timelineNote}>{appt.notes.trim()}</Text>
                    ) : null}
                  </View>
                </View>
              );
            })}
            {!appointments.length ? (
              <Text style={styles.emptyText}>
                Nessuna guida registrata con questo allievo.
              </Text>
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
  examCard: {
    backgroundColor: '#F5F3FF',
    borderColor: '#A78BFA',
    borderWidth: 1.5,
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
    color: '#8B5CF6',
  },
  examMeta: {
    fontSize: 13,
    color: '#8B5CF6',
  },
  emptyText: {
    textAlign: 'center',
    color: '#94A3B8',
    marginTop: 20,
  },
});
