import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Screen } from '../components/Screen';
import { GlassBadge } from '../components/GlassBadge';
import { GlassCard } from '../components/GlassCard';
import { ToastNotice, ToastTone } from '../components/ToastNotice';
import { regloApi } from '../services/regloApi';
import { AutoscuolaAppointmentWithRelations } from '../types/regloApi';
import { colors, spacing, typography } from '../theme';
import { formatDay, formatTime } from '../utils/date';
import { useSession } from '../context/SessionContext';

const isSameDay = (date: Date, iso: string) => {
  const target = new Date(iso);
  return (
    date.getFullYear() === target.getFullYear() &&
    date.getMonth() === target.getMonth() &&
    date.getDate() === target.getDate()
  );
};

const durationLabel = (lesson: AutoscuolaAppointmentWithRelations) => {
  const start = new Date(lesson.startsAt).getTime();
  const end = lesson.endsAt ? new Date(lesson.endsAt).getTime() : start + 30 * 60 * 1000;
  const minutes = Math.round((end - start) / 60000);
  return `${minutes} min`;
};

export const IstruttoreHomeScreen = () => {
  const { instructorId } = useSession();
  const [appointments, setAppointments] = useState<AutoscuolaAppointmentWithRelations[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; tone: ToastTone } | null>(null);

  const loadData = useCallback(async () => {
    if (!instructorId) return;
    setLoading(true);
    setError(null);
    try {
      const appointmentsResponse = await regloApi.getAppointments();
      setAppointments(appointmentsResponse.filter((item) => item.instructorId === instructorId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore nel caricamento');
    } finally {
      setLoading(false);
    }
  }, [instructorId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const upcoming = useMemo(() => {
    const now = new Date();
    return [...appointments]
      .filter((item) => item.status !== 'cancelled' && new Date(item.startsAt) >= now)
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  }, [appointments]);

  const today = useMemo(() => {
    const now = new Date();
    return appointments.filter((item) => isSameDay(now, item.startsAt));
  }, [appointments]);

  const nextLesson = upcoming[0] ?? null;

  const handleStatusUpdate = async (appointmentId: string, status: string) => {
    setToast(null);
    try {
      await regloApi.updateAppointmentStatus(appointmentId, { status });
      setToast({ text: 'Stato aggiornato', tone: 'success' });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore aggiornando stato');
    }
  };

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  if (!instructorId) {
    return (
      <Screen>
        <StatusBar style="dark" />
        <View style={styles.emptyState}>
          <GlassCard title="Profilo istruttore mancante">
            <Text style={styles.emptyText}>
              Il tuo account non e ancora collegato a un profilo istruttore.
            </Text>
          </GlassCard>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <StatusBar style="dark" />
      <ToastNotice
        message={toast?.text ?? null}
        tone={toast?.tone}
        onHide={() => setToast(null)}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.navy}
            colors={[colors.navy]}
          />
        }
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Ciao, Istruttore</Text>
            <Text style={styles.subtitle}>Prossima guida e presenza studenti</Text>
          </View>
          <GlassBadge label="Istruttore" />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <GlassCard title="Prossima guida" subtitle={loading ? 'Aggiornamento...' : 'In programma'}>
          {nextLesson ? (
            <View style={styles.lessonRow}>
              <View>
                <Text style={styles.lessonTime}>
                  {formatDay(nextLesson.startsAt)} · {formatTime(nextLesson.startsAt)}
                </Text>
                <Text style={styles.lessonMeta}>
                  Allievo: {nextLesson.student?.firstName} {nextLesson.student?.lastName}
                </Text>
                <Text style={styles.lessonMeta}>Durata: {durationLabel(nextLesson)}</Text>
              </View>
              <View style={styles.actions}>
                <ActionPill
                  label="Check-in"
                  tone="success"
                  onPress={() => handleStatusUpdate(nextLesson.id, 'checked_in')}
                />
                <ActionPill
                  label="No-show"
                  tone="danger"
                  onPress={() => handleStatusUpdate(nextLesson.id, 'no_show')}
                />
              </View>
            </View>
          ) : (
            <Text style={styles.emptyText}>Nessuna guida prevista.</Text>
          )}
        </GlassCard>

        <GlassCard title="Agenda di oggi" subtitle="Lezioni in programma">
          <View style={styles.agendaList}>
            {today.map((lesson) => (
              <View key={lesson.id} style={styles.agendaRow}>
                <View>
                  <Text style={styles.lessonTime}>
                    {formatTime(lesson.startsAt)} · {lesson.student?.firstName} {lesson.student?.lastName}
                  </Text>
                  <Text style={styles.lessonMeta}>Durata: {durationLabel(lesson)}</Text>
                </View>
                <View style={styles.actions}>
                  <ActionPill
                    label="Check-in"
                    tone="success"
                    onPress={() => handleStatusUpdate(lesson.id, 'checked_in')}
                  />
                  <ActionPill
                    label="No-show"
                    tone="danger"
                    onPress={() => handleStatusUpdate(lesson.id, 'no_show')}
                  />
                </View>
              </View>
            ))}
            {!today.length ? <Text style={styles.emptyText}>Nessuna guida oggi.</Text> : null}
          </View>
        </GlassCard>
      </ScrollView>
    </Screen>
  );
};

type ActionPillProps = {
  label: string;
  tone: 'default' | 'success' | 'danger';
  onPress: () => void;
};

const ActionPill = ({ label, tone, onPress }: ActionPillProps) => {
  const toneStyle = {
    default: styles.pill_default,
    success: styles.pill_success,
    danger: styles.pill_danger,
  }[tone];

  return (
    <Pressable style={[styles.actionPill, toneStyle]} onPress={onPress}>
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.xxl * 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    ...typography.title,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  lessonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  lessonTime: {
    ...typography.subtitle,
    color: colors.textPrimary,
  },
  lessonMeta: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  agendaList: {
    gap: spacing.md,
  },
  agendaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  actions: {
    gap: spacing.xs,
  },
  actionPill: {
    borderRadius: 14,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  pill_default: {
    backgroundColor: colors.glass,
  },
  pill_success: {
    backgroundColor: 'rgba(59, 190, 147, 0.2)',
  },
  pill_danger: {
    backgroundColor: 'rgba(226, 109, 109, 0.2)',
  },
  actionText: {
    ...typography.body,
    color: colors.textPrimary,
  },
  emptyState: {
    flex: 1,
    padding: spacing.lg,
    justifyContent: 'center',
  },
  emptyText: {
    ...typography.body,
    color: colors.textMuted,
  },
  error: {
    ...typography.body,
    color: colors.danger,
  },
});
