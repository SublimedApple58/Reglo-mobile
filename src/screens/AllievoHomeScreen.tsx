import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { StatusBar } from 'expo-status-bar';
import { Screen } from '../components/Screen';
import { GlassBadge } from '../components/GlassBadge';
import { GlassButton } from '../components/GlassButton';
import { GlassCard } from '../components/GlassCard';
import { GlassInput } from '../components/GlassInput';
import { SectionHeader } from '../components/SectionHeader';
import { regloApi } from '../services/regloApi';
import { sessionStorage } from '../services/sessionStorage';
import {
  AutoscuolaAppointmentWithRelations,
  AutoscuolaStudent,
  AutoscuolaSettings,
} from '../types/regloApi';
import { colors, spacing, typography } from '../theme';
import { formatDay, formatTime } from '../utils/date';

const dayLabels = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];

const toDateString = (value: Date) => value.toISOString().slice(0, 10);
const toTimeString = (value: Date) => value.toTimeString().slice(0, 5);

const buildTime = (hours: number, minutes: number) => {
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
};

const statusLabel = (status: string) => {
  if (status === 'completed') return { label: 'Completata', tone: 'success' as const };
  if (status === 'no_show') return { label: 'No-show', tone: 'danger' as const };
  if (status === 'cancelled') return { label: 'Annullata', tone: 'warning' as const };
  return { label: 'Programmato', tone: 'default' as const };
};

type PickerFieldProps = {
  label: string;
  value: Date;
  mode: 'date' | 'time';
  onChange: (date: Date) => void;
};

const PickerField = ({ label, value, mode, onChange }: PickerFieldProps) => {
  const [open, setOpen] = useState(false);

  return (
    <View>
      <Pressable onPress={() => setOpen(true)}>
        <GlassInput
          editable={false}
          placeholder={label}
          value={mode === 'date' ? formatDay(value.toISOString()) : toTimeString(value)}
        />
      </Pressable>
      {open ? (
        <DateTimePicker
          value={value}
          mode={mode}
          display="default"
          onChange={(_, selected) => {
            setOpen(false);
            if (selected) onChange(selected);
          }}
        />
      ) : null}
    </View>
  );
};

export const AllievoHomeScreen = () => {
  const [students, setStudents] = useState<AutoscuolaStudent[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [appointments, setAppointments] = useState<AutoscuolaAppointmentWithRelations[]>([]);
  const [settings, setSettings] = useState<AutoscuolaSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [availabilityDays, setAvailabilityDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [availabilityStart, setAvailabilityStart] = useState(buildTime(9, 0));
  const [availabilityEnd, setAvailabilityEnd] = useState(buildTime(18, 0));

  const [preferredDate, setPreferredDate] = useState(new Date());
  const [preferredStart, setPreferredStart] = useState(buildTime(9, 0));
  const [preferredEnd, setPreferredEnd] = useState(buildTime(18, 0));
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [suggestion, setSuggestion] = useState<{ startsAt: string; endsAt: string } | null>(null);

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
        const [appointmentsResponse, settingsResponse] = await Promise.all([
          regloApi.getAppointments(),
          regloApi.getAutoscuolaSettings(),
        ]);
        setAppointments(appointmentsResponse.filter((item) => item.studentId === studentId));
        setSettings(settingsResponse);
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
      .filter((item) => item.status !== 'cancelled' && new Date(item.startsAt) >= now)
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

  const toggleDay = (day: number) => {
    setAvailabilityDays((prev) =>
      prev.includes(day) ? prev.filter((item) => item !== day) : [...prev, day].sort()
    );
  };

  const handleCreateAvailability = async () => {
    if (!selectedStudentId) return;
    if (!availabilityDays.length) {
      setError('Seleziona almeno un giorno');
      return;
    }
    if (availabilityEnd <= availabilityStart) {
      setError('Orario non valido');
      return;
    }
    setError(null);
    setMessage(null);
    try {
      const anchor = new Date();
      anchor.setHours(0, 0, 0, 0);
      const start = new Date(anchor);
      start.setHours(availabilityStart.getHours(), availabilityStart.getMinutes(), 0, 0);
      const end = new Date(anchor);
      end.setHours(availabilityEnd.getHours(), availabilityEnd.getMinutes(), 0, 0);
      await regloApi.createAvailabilitySlots({
        ownerType: 'student',
        ownerId: selectedStudentId,
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
        daysOfWeek: availabilityDays,
        weeks: settings?.availabilityWeeks ?? 4,
      });
      setMessage('Disponibilita salvata');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore salvando disponibilita');
    }
  };

  const handleDeleteAvailability = async () => {
    if (!selectedStudentId) return;
    setError(null);
    setMessage(null);
    try {
      const anchor = new Date();
      anchor.setHours(0, 0, 0, 0);
      const start = new Date(anchor);
      start.setHours(availabilityStart.getHours(), availabilityStart.getMinutes(), 0, 0);
      const end = new Date(anchor);
      end.setHours(availabilityEnd.getHours(), availabilityEnd.getMinutes(), 0, 0);
      await regloApi.deleteAvailabilitySlots({
        ownerType: 'student',
        ownerId: selectedStudentId,
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
        daysOfWeek: availabilityDays,
        weeks: settings?.availabilityWeeks ?? 4,
      });
      setMessage('Disponibilita rimossa');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore rimuovendo disponibilita');
    }
  };

  const handleBookingRequest = async () => {
    if (!selectedStudentId) return;
    setMessage(null);
    setSuggestion(null);
    setError(null);
    if (preferredEnd <= preferredStart) {
      setError('Orario non valido');
      return;
    }
    try {
      const response = await regloApi.createBookingRequest({
        studentId: selectedStudentId,
        preferredDate: toDateString(preferredDate),
        durationMinutes,
        preferredStartTime: toTimeString(preferredStart),
        preferredEndTime: toTimeString(preferredEnd),
        maxDays: 4,
      });

      if (response.matched) {
        setMessage('Guida prenotata');
        await loadData(selectedStudentId);
        return;
      }

      setMessage('Nessuna disponibilita per il giorno scelto');
      setSuggestion(response.suggestion ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore nella richiesta');
    }
  };

  const handleAcceptSuggestion = async () => {
    if (!selectedStudentId || !suggestion) return;
    setMessage(null);
    try {
      const response = await regloApi.createBookingRequest({
        studentId: selectedStudentId,
        preferredDate: toDateString(preferredDate),
        durationMinutes,
        selectedStartsAt: suggestion.startsAt,
      });
      if (response.matched) {
        setMessage('Guida prenotata');
        setSuggestion(null);
        await loadData(selectedStudentId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore prenotando slot');
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

            <SectionHeader title="Disponibilita" action={`Ripeti ${settings?.availabilityWeeks ?? 4} sett.`} />
            <GlassCard>
              <View style={styles.dayRow}>
                {dayLabels.map((label, index) => (
                  <Pressable
                    key={label}
                    onPress={() => toggleDay(index)}
                    style={[
                      styles.dayChip,
                      availabilityDays.includes(index) && styles.dayChipActive,
                    ]}
                  >
                    <Text
                      style={availabilityDays.includes(index) ? styles.dayTextActive : styles.dayText}
                    >
                      {label}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.pickerRow}>
                <PickerField
                  label="Inizio"
                  value={availabilityStart}
                  mode="time"
                  onChange={setAvailabilityStart}
                />
                <PickerField
                  label="Fine"
                  value={availabilityEnd}
                  mode="time"
                  onChange={setAvailabilityEnd}
                />
              </View>
              <View style={styles.actionRow}>
                <GlassButton label="Salva" onPress={handleCreateAvailability} />
                <GlassButton label="Rimuovi" onPress={handleDeleteAvailability} />
              </View>
            </GlassCard>

            <SectionHeader title="Prenota una guida" action="Preferenze" />
            <GlassCard>
              <View style={styles.pickerRow}>
                <PickerField
                  label="Giorno"
                  value={preferredDate}
                  mode="date"
                  onChange={setPreferredDate}
                />
                <View style={styles.durationWrap}>
                  <Pressable
                    style={[styles.durationChip, durationMinutes === 30 && styles.durationChipActive]}
                    onPress={() => setDurationMinutes(30)}
                  >
                    <Text
                      style={durationMinutes === 30 ? styles.durationTextActive : styles.durationText}
                    >
                      30m
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.durationChip, durationMinutes === 60 && styles.durationChipActive]}
                    onPress={() => setDurationMinutes(60)}
                  >
                    <Text
                      style={durationMinutes === 60 ? styles.durationTextActive : styles.durationText}
                    >
                      60m
                    </Text>
                  </Pressable>
                </View>
              </View>
              <View style={styles.pickerRow}>
                <PickerField
                  label="Dalle"
                  value={preferredStart}
                  mode="time"
                  onChange={setPreferredStart}
                />
                <PickerField
                  label="Alle"
                  value={preferredEnd}
                  mode="time"
                  onChange={setPreferredEnd}
                />
              </View>
              <GlassButton label="Prenota" onPress={handleBookingRequest} />
              {suggestion ? (
                <View style={styles.suggestionBox}>
                  <Text style={styles.suggestionText}>
                    Slot alternativo: {formatDay(suggestion.startsAt)} · {formatTime(suggestion.startsAt)}
                  </Text>
                  <GlassButton label="Prenota questo" onPress={handleAcceptSuggestion} />
                </View>
              ) : null}
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
  historyList: {
    gap: spacing.md,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyTime: {
    ...typography.subtitle,
    color: colors.textPrimary,
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
  pickerRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  durationWrap: {
    flexDirection: 'row',
    gap: spacing.xs,
    alignItems: 'center',
  },
  durationChip: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glass,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  durationChipActive: {
    backgroundColor: colors.glassStrong,
  },
  durationText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  durationTextActive: {
    ...typography.body,
    color: colors.textPrimary,
  },
  dayRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  dayChip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glass,
  },
  dayChipActive: {
    backgroundColor: colors.glassStrong,
  },
  dayText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  dayTextActive: {
    ...typography.body,
    color: colors.textPrimary,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  suggestionBox: {
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  suggestionText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  empty: {
    ...typography.body,
    color: colors.textMuted,
  },
  error: {
    ...typography.body,
    color: colors.danger,
  },
  message: {
    ...typography.body,
    color: colors.success,
  },
});
