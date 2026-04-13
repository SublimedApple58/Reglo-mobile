import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  FadeInDown,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '../components/Screen';
import { StarRating } from '../components/StarRating';
import { ToastNotice, ToastTone } from '../components/ToastNotice';
import { SkeletonBlock, SkeletonCard } from '../components/Skeleton';
import { regloApi } from '../services/regloApi';
import { AutoscuolaAppointmentWithRelations, AutoscuolaCase } from '../types/regloApi';
import { colors, spacing } from '../theme';
import { formatDay, formatTime } from '../utils/date';

const REQUIRED_LESSONS = 10;

export const StudentNotesDetailScreen = () => {
  const router = useRouter();
  const { studentId, name } = useLocalSearchParams<{ studentId: string; name: string }>();
  const [appointments, setAppointments] = useState<AutoscuolaAppointmentWithRelations[]>([]);
  const [cases, setCases] = useState<AutoscuolaCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<{ text: string; tone: ToastTone } | null>(null);
  const [showLessons, setShowLessons] = useState(false);

  const ctaScale = useSharedValue(1);
  const ctaChevron = useSharedValue(0); // 0 = down, 1 = up

  const ctaAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ctaScale.value }],
  }));

  const chevronAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${ctaChevron.value * 180}deg` }],
  }));

  const handleCtaPress = () => {
    setShowLessons((prev) => {
      const next = !prev;
      ctaChevron.value = withSpring(next ? 1 : 0, { damping: 15, stiffness: 200 });
      return next;
    });
  };

  const loadData = useCallback(async () => {
    if (!studentId) return;
    try {
      const [appts, allCases] = await Promise.all([
        regloApi.getAppointments({ studentId, limit: 500 }),
        regloApi.getCases().catch(() => [] as AutoscuolaCase[]),
      ]);
      const filtered = appts
        .filter((a) => (a.status ?? '').trim().toLowerCase() !== 'cancelled')
        .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());
      setAppointments(filtered);
      setCases(allCases.filter((c) => c.studentId === studentId));
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

  const phone = useMemo(() => {
    // Try to get phone from the first appointment's student relation
    for (const appt of appointments) {
      if (appt.student?.phone) return appt.student.phone;
    }
    return null;
  }, [appointments]);

  const completedCount = useMemo(
    () => appointments.filter((a) => {
      const s = (a.status ?? '').trim().toLowerCase();
      return s === 'completed' || s === 'checked_in';
    }).length,
    [appointments],
  );

  const progress = Math.min(completedCount / REQUIRED_LESSONS, 1);
  const isCompleted = completedCount >= REQUIRED_LESSONS;

  // Upcoming exam from cases
  const upcomingExam = useMemo(() => {
    const now = new Date();
    for (const c of cases) {
      if (c.drivingExamAt && new Date(c.drivingExamAt) > now) {
        return { type: 'guida', date: c.drivingExamAt };
      }
      if (c.theoryExamAt && new Date(c.theoryExamAt) > now) {
        return { type: 'teoria', date: c.theoryExamAt };
      }
    }
    // Also check appointments for exam type
    for (const appt of appointments) {
      if ((appt.type ?? '').toLowerCase() === 'esame' && new Date(appt.startsAt) > now) {
        return { type: 'guida', date: appt.startsAt };
      }
    }
    return null;
  }, [cases, appointments]);

  const formatExamDate = (iso: string) => {
    const d = new Date(iso);
    const day = d.getDate();
    const months = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
    return `${day} ${months[d.getMonth()]} ${d.getFullYear()}`;
  };

  const cleanPhone = phone?.replace(/\s+/g, '').replace(/^\+/, '');

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
        {/* Header */}
        <Pressable style={styles.backRow} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#1E293B" />
          <Text style={styles.backTitle} numberOfLines={1}>{name ?? 'Allievo'}</Text>
        </Pressable>

        {loading ? (
          <View style={{ gap: 12 }}>
            <SkeletonCard style={{ padding: 16, borderRadius: 20 }}>
              <SkeletonBlock width="60%" height={18} radius={6} />
              <SkeletonBlock width="100%" height={8} radius={4} />
              <SkeletonBlock width="40%" height={14} radius={6} />
            </SkeletonCard>
            <SkeletonCard style={{ padding: 16, borderRadius: 20 }}>
              <SkeletonBlock width="50%" height={16} radius={6} />
            </SkeletonCard>
          </View>
        ) : (
          <>
            {/* Contact */}
            {phone ? (
              <Animated.View entering={FadeInDown.duration(300).delay(50)} style={styles.contactRow}>
                <View style={styles.contactInfo}>
                  <Ionicons name="call-outline" size={16} color="#64748B" />
                  <Text style={styles.contactPhone}>{phone}</Text>
                </View>
                <View style={styles.contactActions}>
                  <Pressable
                    style={({ pressed }) => [styles.contactBtn, styles.contactBtnWhatsApp, pressed && { opacity: 0.7 }]}
                    onPress={() => Linking.openURL(`https://wa.me/${cleanPhone}`)}
                    hitSlop={6}
                  >
                    <Ionicons name="logo-whatsapp" size={18} color="#25D366" />
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [styles.contactBtn, styles.contactBtnCall, pressed && { opacity: 0.7 }]}
                    onPress={() => Linking.openURL(`tel:${phone}`)}
                    hitSlop={6}
                  >
                    <Ionicons name="call" size={18} color="#3B82F6" />
                  </Pressable>
                </View>
              </Animated.View>
            ) : null}

            {/* Lesson progress */}
            <Animated.View entering={FadeInDown.duration(300).delay(100)} style={styles.progressCard}>
              <Text style={styles.progressLabel}>OBBLIGO GUIDE</Text>
              <View style={styles.progressRow}>
                <View style={styles.progressNumbers}>
                  <Text style={styles.progressCount}>{completedCount}</Text>
                  <Text style={styles.progressTotal}>/{REQUIRED_LESSONS}</Text>
                </View>
                <View style={styles.progressBarOuter}>
                  <View style={[styles.progressBarInner, { width: `${Math.round(progress * 100)}%` }]} />
                </View>
              </View>
              <Text style={styles.progressStatus}>
                {isCompleted ? 'Obbligo completato' : `Mancano ${REQUIRED_LESSONS - completedCount} guide`}
              </Text>
            </Animated.View>

            {/* Upcoming exam */}
            {upcomingExam ? (
              <View style={styles.examCard}>
                <View style={styles.examIconCircle}>
                  <Ionicons name="school" size={16} color="#FFFFFF" />
                </View>
                <View style={styles.examInfo}>
                  <Text style={styles.examTitle}>
                    Esame {upcomingExam.type === 'teoria' ? 'di teoria' : 'di guida'}
                  </Text>
                  <Text style={styles.examDate}>{formatExamDate(upcomingExam.date)}</Text>
                </View>
              </View>
            ) : null}

            {/* Stats summary */}
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{appointments.length}</Text>
                <Text style={styles.statLabel}>Guide totali</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{completedCount}</Text>
                <Text style={styles.statLabel}>Completate</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{appointments.filter((a) => a.notes?.trim()).length}</Text>
                <Text style={styles.statLabel}>Con note</Text>
              </View>
            </View>

            {/* CTA to lessons */}
            <Pressable
              onPressIn={() => { ctaScale.value = withSpring(0.96, { damping: 15, stiffness: 400 }); }}
              onPressOut={() => { ctaScale.value = withSpring(1, { damping: 12, stiffness: 200 }); }}
              onPress={handleCtaPress}
            >
              <Animated.View style={[styles.lessonsCta, ctaAnimatedStyle]}>
                <Ionicons name="list" size={18} color="#EC4899" />
                <Text style={styles.lessonsCtaText}>
                  {showLessons ? 'Nascondi storico guide' : 'Vedi storico guide'}
                </Text>
                <Animated.View style={chevronAnimatedStyle}>
                  <Ionicons name="chevron-down" size={18} color="#EC4899" />
                </Animated.View>
              </Animated.View>
            </Pressable>

            {/* Lessons timeline */}
            {showLessons ? (
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
                      {isExam ? (
                        <View style={styles.examTimelineCard}>
                          <View style={styles.examAccent} />
                          <View style={styles.examTimelineContent}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                              <View style={styles.examSmallIcon}>
                                <Ionicons name="school" size={12} color="#FFFFFF" />
                              </View>
                              <Text style={styles.examTimelineLabel}>ESAME</Text>
                              <Text style={styles.examTimelineTime}>
                                {formatTime(appt.startsAt)} – {appt.endsAt ? formatTime(appt.endsAt) : ''}
                              </Text>
                            </View>
                            {appt.notes?.trim() ? (
                              <Text style={styles.timelineNote}>{appt.notes.trim()}</Text>
                            ) : null}
                          </View>
                        </View>
                      ) : (
                        <View style={[styles.timelineCard, !appt.notes?.trim() && { opacity: 0.6 }]}>
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
                          <Text style={styles.timelineMeta}>
                            {appt.instructor?.name ?? 'Istruttore'} · {appt.vehicle?.name ?? 'Veicolo n/d'}
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
                      )}
                    </View>
                  );
                })}
                {!appointments.length ? (
                  <Text style={styles.emptyText}>
                    Nessuna guida registrata con questo allievo.
                  </Text>
                ) : null}
              </View>
            ) : null}
          </>
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
    fontSize: 22,
    fontWeight: '800',
    color: '#1E293B',
    flex: 1,
  },

  /* Contact */
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  contactInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  contactPhone: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1E293B',
  },
  contactActions: {
    flexDirection: 'row',
    gap: 6,
  },
  contactBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactBtnWhatsApp: {
    backgroundColor: '#F0FDF4',
  },
  contactBtnCall: {
    backgroundColor: '#EFF6FF',
  },

  /* Progress */
  progressCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    gap: 8,
  },
  progressLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
    letterSpacing: 0.8,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  progressNumbers: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  progressCount: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1E293B',
  },
  progressTotal: {
    fontSize: 16,
    fontWeight: '600',
    color: '#94A3B8',
  },
  progressBarOuter: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F1F5F9',
    overflow: 'hidden',
  },
  progressBarInner: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EC4899',
  },
  progressStatus: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748B',
  },

  /* Exam */
  examCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F3FF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#DDD6FE',
    padding: 14,
    gap: 12,
  },
  examIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#8B5CF6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  examInfo: {
    flex: 1,
    gap: 2,
  },
  examTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7C3AED',
  },
  examDate: {
    fontSize: 13,
    fontWeight: '500',
    color: '#A78BFA',
  },

  /* Stats */
  statsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    gap: 2,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1E293B',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#94A3B8',
  },

  /* Lessons CTA */
  lessonsCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FDF2F8',
    borderRadius: 20,
    padding: 14,
    gap: 8,
  },
  lessonsCtaText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#EC4899',
  },

  /* Timeline */
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
  examTimelineCard: {
    flex: 1,
    flexDirection: 'row' as const,
    backgroundColor: '#F5F3FF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DDD6FE',
    marginBottom: 10,
    overflow: 'hidden' as const,
  },
  examAccent: {
    width: 4,
    backgroundColor: '#8B5CF6',
  },
  examTimelineContent: {
    flex: 1,
    padding: 14,
    gap: 4,
  },
  examSmallIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#8B5CF6',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  examTimelineLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#7C3AED',
    letterSpacing: 0.8,
  },
  examTimelineTime: {
    fontSize: 13,
    fontWeight: '600',
    color: '#A78BFA',
  },
  emptyText: {
    textAlign: 'center',
    color: '#94A3B8',
    marginTop: 20,
  },
});
