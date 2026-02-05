import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Screen } from '../components/Screen';
import { GlassBadge } from '../components/GlassBadge';
import { GlassCard } from '../components/GlassCard';
import { regloApi } from '../services/regloApi';
import {
  AutoscuolaAppointmentWithRelations,
  AutoscuolaInstructor,
} from '../types/regloApi';
import { colors, spacing, typography } from '../theme';
import { formatDay, formatTime } from '../utils/date';

const durationLabel = (lesson: AutoscuolaAppointmentWithRelations) => {
  const start = new Date(lesson.startsAt).getTime();
  const end = lesson.endsAt ? new Date(lesson.endsAt).getTime() : start + 30 * 60 * 1000;
  const minutes = Math.round((end - start) / 60000);
  return `${minutes} min`;
};

export const OwnerInstructorScreen = () => {
  const [instructors, setInstructors] = useState<AutoscuolaInstructor[]>([]);
  const [selectedInstructorId, setSelectedInstructorId] = useState<string | null>(null);
  const [appointments, setAppointments] = useState<AutoscuolaAppointmentWithRelations[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setError(null);
    try {
      const [instructorsResponse, appointmentsResponse] = await Promise.all([
        regloApi.getInstructors(),
        regloApi.getAppointments(),
      ]);
      setInstructors(instructorsResponse);
      setAppointments(appointmentsResponse);
      if (!selectedInstructorId && instructorsResponse.length) {
        setSelectedInstructorId(instructorsResponse[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore nel caricamento');
    }
  }, [selectedInstructorId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const selectedInstructor = useMemo(
    () => instructors.find((item) => item.id === selectedInstructorId) ?? null,
    [instructors, selectedInstructorId]
  );

  const upcoming = useMemo(() => {
    if (!selectedInstructorId) return [];
    const now = new Date();
    return appointments
      .filter(
        (item) =>
          item.instructorId === selectedInstructorId &&
          item.status !== 'cancelled' &&
          new Date(item.startsAt) >= now
      )
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  }, [appointments, selectedInstructorId]);

  const nextLesson = upcoming[0] ?? null;

  return (
    <Screen>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Istruttori</Text>
            <Text style={styles.subtitle}>Seleziona e controlla la prossima guida</Text>
          </View>
          <GlassBadge label="Owner" />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <GlassCard title="Seleziona istruttore">
          <View style={styles.selectList}>
            {instructors.map((instructor) => (
              <Pressable
                key={instructor.id}
                style={styles.selectRow}
                onPress={() => setSelectedInstructorId(instructor.id)}
              >
                <View>
                  <Text style={styles.selectName}>{instructor.name}</Text>
                  <Text style={styles.selectMeta}>{instructor.phone ?? '—'}</Text>
                </View>
                {selectedInstructorId === instructor.id ? (
                  <GlassBadge label="Attivo" tone="success" />
                ) : (
                  <GlassBadge label="Scegli" />
                )}
              </Pressable>
            ))}
            {!instructors.length ? (
              <Text style={styles.empty}>Nessun istruttore disponibile.</Text>
            ) : null}
          </View>
        </GlassCard>

        <GlassCard title="Prossima guida">
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
            </View>
          ) : (
            <Text style={styles.empty}>Nessuna guida in programma.</Text>
          )}
        </GlassCard>

        <GlassCard title="Agenda prossime guide" subtitle={selectedInstructor?.name ?? 'Istruttore'}>
          <View style={styles.agendaList}>
            {upcoming.slice(0, 5).map((lesson) => (
              <View key={lesson.id} style={styles.agendaRow}>
                <View>
                  <Text style={styles.lessonTime}>
                    {formatDay(lesson.startsAt)} · {formatTime(lesson.startsAt)}
                  </Text>
                  <Text style={styles.lessonMeta}>
                    {lesson.student?.firstName} {lesson.student?.lastName} · {durationLabel(lesson)}
                  </Text>
                </View>
              </View>
            ))}
            {!upcoming.length ? <Text style={styles.empty}>Nessuna guida futura.</Text> : null}
          </View>
        </GlassCard>
      </ScrollView>
    </Screen>
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
  selectList: {
    gap: spacing.sm,
  },
  selectRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  selectName: {
    ...typography.subtitle,
    color: colors.textPrimary,
  },
  selectMeta: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  lessonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  },
  empty: {
    ...typography.body,
    color: colors.textMuted,
  },
  error: {
    ...typography.body,
    color: colors.danger,
  },
});
