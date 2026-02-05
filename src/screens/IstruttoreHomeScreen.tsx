import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Screen } from '../components/Screen';
import { GlassBadge } from '../components/GlassBadge';
import { GlassCard } from '../components/GlassCard';
import { SectionHeader } from '../components/SectionHeader';
import { regloApi } from '../services/regloApi';
import { sessionStorage } from '../services/sessionStorage';
import {
  AutoscuolaAppointmentWithRelations,
  AutoscuolaAvailabilitySlot,
  AutoscuolaInstructor,
} from '../types/regloApi';
import { colors, spacing, typography } from '../theme';
import { formatDay, formatTime } from '../utils/date';

const getTodayString = () => new Date().toISOString().slice(0, 10);

const isSameDay = (date: Date, iso: string) => {
  const target = new Date(iso);
  return (
    date.getFullYear() === target.getFullYear() &&
    date.getMonth() === target.getMonth() &&
    date.getDate() === target.getDate()
  );
};

export const IstruttoreHomeScreen = () => {
  const [instructors, setInstructors] = useState<AutoscuolaInstructor[]>([]);
  const [selectedInstructorId, setSelectedInstructorId] = useState<string | null>(null);
  const [appointments, setAppointments] = useState<AutoscuolaAppointmentWithRelations[]>([]);
  const [slots, setSlots] = useState<AutoscuolaAvailabilitySlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const selectedInstructor = useMemo(
    () => instructors.find((item) => item.id === selectedInstructorId) ?? null,
    [instructors, selectedInstructorId]
  );

  const loadInstructors = useCallback(async () => {
    const list = await regloApi.getInstructors();
    setInstructors(list);
  }, []);

  const loadData = useCallback(
    async (instructorId: string) => {
      setLoading(true);
      setError(null);
      try {
        const [appointmentsResponse, slotsResponse] = await Promise.all([
          regloApi.getAppointments(),
          regloApi.getAvailabilitySlots({
            ownerType: 'instructor',
            ownerId: instructorId,
            date: getTodayString(),
          }),
        ]);
        setAppointments(appointmentsResponse.filter((item) => item.instructorId === instructorId));
        setSlots(slotsResponse);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Errore nel caricamento');
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    const init = async () => {
      const storedInstructor = await sessionStorage.getSelectedInstructorId();
      setSelectedInstructorId(storedInstructor);
      try {
        await loadInstructors();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Errore nel caricamento istruttori');
      }
    };
    init();
  }, [loadInstructors]);

  useEffect(() => {
    if (!selectedInstructorId) return;
    loadData(selectedInstructorId);
  }, [loadData, selectedInstructorId]);

  const today = useMemo(() => {
    const now = new Date();
    return appointments.filter((item) => isSameDay(now, item.startsAt));
  }, [appointments]);

  const handleInstructorSelect = async (instructorId: string) => {
    await sessionStorage.setSelectedInstructorId(instructorId);
    setSelectedInstructorId(instructorId);
  };

  const handleStatusUpdate = async (appointmentId: string, status: string) => {
    setMessage(null);
    try {
      await regloApi.updateAppointmentStatus(appointmentId, { status });
      setMessage('Stato aggiornato');
      if (selectedInstructorId) {
        await loadData(selectedInstructorId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore aggiornando stato');
    }
  };

  return (
    <Screen>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Ciao, {selectedInstructor?.name ?? 'Istruttore'}</Text>
            <Text style={styles.subtitle}>Agenda e presenza studenti</Text>
          </View>
          <GlassBadge label="Istruttore" />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {message ? <Text style={styles.message}>{message}</Text> : null}

        {!selectedInstructor ? (
          <GlassCard title="Seleziona un istruttore" subtitle="Necessario per continuare">
            <View style={styles.selectList}>
              {instructors.map((instructor) => (
                <Pressable
                  key={instructor.id}
                  style={styles.selectRow}
                  onPress={() => handleInstructorSelect(instructor.id)}
                >
                  <View>
                    <Text style={styles.selectName}>{instructor.name}</Text>
                    <Text style={styles.selectMeta}>{instructor.phone ?? '—'}</Text>
                  </View>
                  <GlassBadge label="Scegli" />
                </Pressable>
              ))}
              {!instructors.length ? (
                <Text style={styles.empty}>Nessun istruttore disponibile.</Text>
              ) : null}
            </View>
          </GlassCard>
        ) : (
          <>
            <GlassCard title="Agenda di oggi" subtitle={loading ? 'Aggiornamento...' : 'Check-in e stato guida'}>
              <View style={styles.agendaList}>
                {today.map((lesson) => (
                  <View key={lesson.id} style={styles.agendaRow}>
                    <View>
                      <Text style={styles.lessonTime}>
                        {formatTime(lesson.startsAt)} · {lesson.student?.firstName} {lesson.student?.lastName}
                      </Text>
                      <Text style={styles.lessonMeta}>
                        Veicolo: {lesson.vehicle?.name ?? 'Da assegnare'}
                      </Text>
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
                      <ActionPill
                        label="Completa"
                        tone="default"
                        onPress={() => handleStatusUpdate(lesson.id, 'completed')}
                      />
                    </View>
                  </View>
                ))}
                {!today.length ? <Text style={styles.empty}>Nessuna guida prevista oggi.</Text> : null}
              </View>
            </GlassCard>

            <SectionHeader title="Disponibilita" action={formatDay(new Date().toISOString())} />
            <GlassCard>
              <View style={styles.slotList}>
                {slots.map((slot) => (
                  <View key={slot.id} style={styles.slotRow}>
                    <View>
                      <Text style={styles.slotTime}>
                        {formatTime(slot.startsAt)} - {formatTime(slot.endsAt)}
                      </Text>
                      <Text style={styles.slotMeta}>Slot {slot.status}</Text>
                    </View>
                    <GlassBadge
                      label={slot.status === 'open' ? 'Disponibile' : 'Occupato'}
                      tone={slot.status === 'open' ? 'success' : 'warning'}
                    />
                  </View>
                ))}
                {!slots.length ? (
                  <Text style={styles.empty}>Nessuna disponibilita inserita.</Text>
                ) : null}
              </View>
            </GlassCard>
          </>
        )}
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
  agendaList: {
    gap: spacing.md,
  },
  agendaRow: {
    gap: spacing.sm,
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
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  actionPill: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  actionText: {
    ...typography.caption,
    color: colors.navy,
  },
  pill_default: {
    backgroundColor: colors.glassStrong,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  pill_success: {
    backgroundColor: 'rgba(59, 190, 147, 0.2)',
    borderWidth: 1,
    borderColor: colors.success,
  },
  pill_danger: {
    backgroundColor: 'rgba(226, 109, 109, 0.2)',
    borderWidth: 1,
    borderColor: colors.danger,
  },
  empty: {
    ...typography.body,
    color: colors.textMuted,
  },
  slotList: {
    gap: spacing.md,
  },
  slotRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  slotTime: {
    ...typography.subtitle,
    color: colors.textPrimary,
  },
  slotMeta: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  error: {
    ...typography.body,
    color: colors.danger,
  },
  message: {
    ...typography.body,
    color: colors.success,
  },
  selectList: {
    gap: spacing.sm,
  },
  selectRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
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
});
