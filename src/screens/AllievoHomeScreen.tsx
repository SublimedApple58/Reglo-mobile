import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Screen } from '../components/Screen';
import { GlassBadge } from '../components/GlassBadge';
import { GlassButton } from '../components/GlassButton';
import { GlassCard } from '../components/GlassCard';
import { SectionHeader } from '../components/SectionHeader';
import { regloApi } from '../services/regloApi';
import { sessionStorage } from '../services/sessionStorage';
import {
  AutoscuolaAppointmentWithRelations,
  AutoscuolaAvailabilitySlot,
  AutoscuolaStudent,
} from '../types/regloApi';
import { colors, spacing, typography } from '../theme';
import { formatDay, formatTime } from '../utils/date';

const getTodayString = () => new Date().toISOString().slice(0, 10);

const statusLabel = (status: string) => {
  if (status === 'completed') return { label: 'Completata', tone: 'success' as const };
  if (status === 'no_show') return { label: 'No-show', tone: 'danger' as const };
  if (status === 'cancelled') return { label: 'Annullata', tone: 'warning' as const };
  return { label: 'Programmato', tone: 'default' as const };
};

export const AllievoHomeScreen = () => {
  const [students, setStudents] = useState<AutoscuolaStudent[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [appointments, setAppointments] = useState<AutoscuolaAppointmentWithRelations[]>([]);
  const [slots, setSlots] = useState<AutoscuolaAvailabilitySlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const selectedStudent = useMemo(
    () => students.find((student) => student.id === selectedStudentId) ?? null,
    [students, selectedStudentId]
  );

  const loadStudents = useCallback(async () => {
    const list = await regloApi.getStudents();
    setStudents(list);
  }, []);

  const loadData = useCallback(
    async (studentId: string) => {
      setLoading(true);
      setError(null);
      try {
        const [appointmentsResponse, slotsResponse] = await Promise.all([
          regloApi.getAppointments(),
          regloApi.getAvailabilitySlots({
            ownerType: 'student',
            ownerId: studentId,
            date: getTodayString(),
          }),
        ]);
        setAppointments(appointmentsResponse.filter((item) => item.studentId === studentId));
        setSlots(slotsResponse.filter((slot) => slot.status === 'open'));
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
      const storedStudent = await sessionStorage.getSelectedStudentId();
      setSelectedStudentId(storedStudent);
      try {
        await loadStudents();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Errore nel caricamento studenti');
      }
    };
    init();
  }, [loadStudents]);

  useEffect(() => {
    if (!selectedStudentId) return;
    loadData(selectedStudentId);
  }, [loadData, selectedStudentId]);

  const upcoming = useMemo(() => {
    const now = new Date();
    return [...appointments]
      .filter((item) => new Date(item.startsAt) >= now)
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  }, [appointments]);

  const history = useMemo(() => {
    const now = new Date();
    return [...appointments]
      .filter((item) => new Date(item.startsAt) < now)
      .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());
  }, [appointments]);

  const nextLesson = upcoming[0];

  const handleStudentSelect = async (studentId: string) => {
    await sessionStorage.setSelectedStudentId(studentId);
    setSelectedStudentId(studentId);
  };

  const handleBookingRequest = async (slot: AutoscuolaAvailabilitySlot) => {
    if (!selectedStudentId) return;
    setMessage(null);
    try {
      await regloApi.createBookingRequest({
        studentId: selectedStudentId,
        desiredDate: slot.startsAt,
      });
      setMessage('Richiesta inviata con successo');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore nella richiesta');
    }
  };

  const handleCancel = async (appointmentId: string) => {
    setMessage(null);
    try {
      await regloApi.cancelAppointment(appointmentId);
      setMessage('Guida annullata');
      if (selectedStudentId) {
        await loadData(selectedStudentId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore durante annullamento');
    }
  };

  return (
    <Screen>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Ciao, {selectedStudent?.firstName ?? 'Allievo'}</Text>
            <Text style={styles.subtitle}>
              {selectedStudent ? 'Gestisci le tue guide' : 'Seleziona il profilo'}
            </Text>
          </View>
          <GlassBadge label="Allievo" />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {message ? <Text style={styles.message}>{message}</Text> : null}

        {!selectedStudent ? (
          <GlassCard title="Seleziona un allievo" subtitle="Necessario per continuare">
            <View style={styles.selectList}>
              {students.map((student) => (
                <Pressable
                  key={student.id}
                  style={styles.selectRow}
                  onPress={() => handleStudentSelect(student.id)}
                >
                  <View>
                    <Text style={styles.selectName}>
                      {student.firstName} {student.lastName}
                    </Text>
                    <Text style={styles.selectMeta}>{student.email ?? student.phone ?? '—'}</Text>
                  </View>
                  <GlassBadge label="Scegli" />
                </Pressable>
              ))}
              {!students.length ? (
                <Text style={styles.empty}>Nessun allievo disponibile.</Text>
              ) : null}
            </View>
          </GlassCard>
        ) : (
          <>
            <GlassCard title="Prossima guida" subtitle={loading ? 'Aggiornamento...' : 'Prenotazione confermata'}>
              {nextLesson ? (
                <View style={styles.lessonRow}>
                  <View>
                    <Text style={styles.lessonTime}>
                      {formatDay(nextLesson.startsAt)} · {formatTime(nextLesson.startsAt)}
                    </Text>
                    <Text style={styles.lessonMeta}>
                      Istruttore: {nextLesson.instructor?.name ?? 'Da assegnare'}
                    </Text>
                    <Text style={styles.lessonMeta}>
                      Veicolo: {nextLesson.vehicle?.name ?? 'Da assegnare'}
                    </Text>
                  </View>
                  <GlassButton label="Annulla" onPress={() => handleCancel(nextLesson.id)} />
                </View>
              ) : (
                <Text style={styles.empty}>Nessuna guida programmata.</Text>
              )}
            </GlassCard>

            <SectionHeader title="Richiedi una guida" action="Slot liberi" />
            <GlassCard>
              <View style={styles.slotList}>
                {slots.map((slot) => (
                  <View key={slot.id} style={styles.slotRow}>
                    <View>
                      <Text style={styles.slotTime}>
                        {formatDay(slot.startsAt)} · {formatTime(slot.startsAt)}
                      </Text>
                      <Text style={styles.slotMeta}>Slot da 30 min</Text>
                    </View>
                    <GlassButton label="Richiedi" onPress={() => handleBookingRequest(slot)} />
                  </View>
                ))}
                {!slots.length ? (
                  <Text style={styles.empty}>Nessuno slot disponibile al momento.</Text>
                ) : null}
              </View>
            </GlassCard>

            <SectionHeader title="Storico" action="Ultime guide" />
            <GlassCard>
              <View style={styles.historyList}>
                {history.map((lesson) => {
                  const status = statusLabel(lesson.status);
                  return (
                    <View key={lesson.id} style={styles.historyRow}>
                      <View>
                        <Text style={styles.historyTime}>
                          {formatDay(lesson.startsAt)} · {formatTime(lesson.startsAt)}
                        </Text>
                        <Text style={styles.lessonMeta}>{lesson.instructor?.name ?? 'Istruttore'}</Text>
                      </View>
                      <GlassBadge label={status.label} tone={status.tone} />
                    </View>
                  );
                })}
                {!history.length ? <Text style={styles.empty}>Nessuna guida passata.</Text> : null}
              </View>
            </GlassCard>
          </>
        )}
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
  error: {
    ...typography.body,
    color: colors.danger,
  },
  message: {
    ...typography.body,
    color: colors.success,
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
    gap: spacing.md,
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
  historyList: {
    gap: spacing.md,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyTime: {
    ...typography.body,
    color: colors.textPrimary,
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
