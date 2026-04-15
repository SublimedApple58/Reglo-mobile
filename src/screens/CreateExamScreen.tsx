import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Screen } from '../components/Screen';
import { SelectableChip } from '../components/SelectableChip';
import { ToastNotice, ToastTone } from '../components/ToastNotice';
import { regloApi } from '../services/regloApi';
import { colors, spacing } from '../theme';

type StudentItem = {
  id: string;
  firstName: string;
  lastName: string;
};

export const CreateExamScreen = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ text: string; tone: ToastTone } | null>(null);
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [examDate, setExamDate] = useState(new Date());
  const [examEndDate, setExamEndDate] = useState(new Date(Date.now() + 60 * 60 * 1000));
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const loadStudents = useCallback(async () => {
    try {
      const res = await regloApi.getStudents();
      setStudents(
        res.map((s: Record<string, unknown>) => ({
          id: s.id as string,
          firstName: (s.firstName ?? s.name ?? '') as string,
          lastName: (s.lastName ?? '') as string,
        })),
      );
    } catch {
      setToast({ text: 'Errore nel caricamento allievi', tone: 'danger' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  const toggleStudent = (id: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleCreate = async () => {
    if (!selectedStudentIds.length) {
      setToast({ text: 'Seleziona almeno un allievo', tone: 'danger' });
      return;
    }
    setSaving(true);
    try {
      await regloApi.createExam({
        studentIds: selectedStudentIds,
        startsAt: examDate.toISOString(),
        endsAt: examEndDate.toISOString(),
        notes: notes || undefined,
      });
      setToast({ text: 'Esame creato', tone: 'success' });
      setTimeout(() => router.back(), 1200);
    } catch {
      setToast({ text: 'Errore nella creazione', tone: 'danger' });
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (d: Date) =>
    d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const formatTime = (d: Date) =>
    d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

  return (
    <Screen>
      <StatusBar style="dark" />
      <ToastNotice message={toast?.text ?? null} tone={toast?.tone} onHide={() => setToast(null)} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable style={styles.backRow} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#1E293B" />
          <Text style={styles.backTitle}>Crea esame</Text>
        </Pressable>

        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* Date & time */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Data e ora</Text>
              <Pressable style={styles.dateRow} onPress={() => setShowDatePicker(true)}>
                <Ionicons name="calendar-outline" size={20} color="#64748B" />
                <Text style={styles.dateText}>{formatDate(examDate)}</Text>
              </Pressable>
              {showDatePicker && (
                <DateTimePicker
                  value={examDate}
                  mode="date"
                  onChange={(_, date) => {
                    setShowDatePicker(false);
                    if (date) {
                      setExamDate(date);
                      const end = new Date(date);
                      end.setHours(end.getHours() + 1);
                      setExamEndDate(end);
                    }
                  }}
                />
              )}
              <Pressable style={styles.dateRow} onPress={() => setShowTimePicker(true)}>
                <Ionicons name="time-outline" size={20} color="#64748B" />
                <Text style={styles.dateText}>{formatTime(examDate)}</Text>
              </Pressable>
              {showTimePicker && (
                <DateTimePicker
                  value={examDate}
                  mode="time"
                  onChange={(_, date) => {
                    setShowTimePicker(false);
                    if (date) {
                      setExamDate(date);
                      const end = new Date(date);
                      end.setHours(end.getHours() + 1);
                      setExamEndDate(end);
                    }
                  }}
                />
              )}
            </View>

            {/* Students */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Allievi ({selectedStudentIds.length})</Text>
              <View style={styles.chipsRow}>
                {students.map((s) => (
                  <SelectableChip
                    key={s.id}
                    label={`${s.firstName} ${s.lastName}`.trim()}
                    active={selectedStudentIds.includes(s.id)}
                    onPress={() => toggleStudent(s.id)}
                  />
                ))}
              </View>
            </View>

            {/* Notes */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Note</Text>
              <TextInput
                style={styles.notesInput}
                value={notes}
                onChangeText={setNotes}
                placeholder="Note opzionali..."
                placeholderTextColor="#94A3B8"
                multiline
              />
            </View>

            {/* Save */}
            <Pressable
              onPress={saving ? undefined : handleCreate}
              disabled={saving}
              style={({ pressed }) => [
                styles.saveBtn,
                pressed && { opacity: 0.85 },
                saving && { opacity: 0.6 },
              ]}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.saveBtnText}>Crea esame</Text>
              )}
            </Pressable>
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
    gap: 20,
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
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dateText: {
    fontSize: 15,
    color: '#1E293B',
    fontWeight: '500',
  },
  notesInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    fontSize: 14,
    color: '#1E293B',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  saveBtn: {
    height: 52,
    borderRadius: 999,
    backgroundColor: '#EC4899',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
