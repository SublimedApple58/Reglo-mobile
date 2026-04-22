import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
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
import { Screen } from '../components/Screen';
import { BottomSheet } from '../components/BottomSheet';
import { CalendarDrawer } from '../components/CalendarDrawer';
import { TimePickerDrawer } from '../components/TimePickerDrawer';
import { ToastNotice, ToastTone } from '../components/ToastNotice';
import { regloApi } from '../services/regloApi';
import { colors, spacing } from '../theme';

type StudentItem = {
  id: string;
  firstName: string;
  lastName: string;
  clusterLabel: string | null; // "Mio gruppo" | "<nome istruttore>" | null (non assegnato)
  isMyCluster: boolean;
};

// Avatar helpers — shared visual language with ClusterSettingsScreen
const getInitials = (firstName: string, lastName: string) => {
  const f = (firstName ?? '').trim();
  const l = (lastName ?? '').trim();
  if (f && l) return `${f[0]}${l[0]}`.toUpperCase();
  if (f) return f.slice(0, 2).toUpperCase();
  if (l) return l.slice(0, 2).toUpperCase();
  return '?';
};
const AVATAR_BG_PALETTE = ['#FCE7F3', '#FEF3C7', '#DBEAFE', '#DCFCE7', '#EDE9FE', '#FFEDD5', '#E0F2FE', '#FEE2E2'];
const AVATAR_FG_PALETTE = ['#BE185D', '#B45309', '#1D4ED8', '#15803D', '#6D28D9', '#C2410C', '#0369A1', '#B91C1C'];
const hashStr = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
};
const avatarColorsFor = (id: string) => {
  const i = hashStr(id) % AVATAR_BG_PALETTE.length;
  return { bg: AVATAR_BG_PALETTE[i], fg: AVATAR_FG_PALETTE[i] };
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
  const [dateDrawerOpen, setDateDrawerOpen] = useState(false);
  const [timeDrawerOpen, setTimeDrawerOpen] = useState(false);
  // Students picker sheet
  const [studentsSheetOpen, setStudentsSheetOpen] = useState(false);
  const [draftSelectedIds, setDraftSelectedIds] = useState<string[]>([]);
  const [studentSearch, setStudentSearch] = useState('');

  const loadStudents = useCallback(async () => {
    try {
      const settings = await regloApi.getInstructorSettings().catch(() => null);
      if (settings) {
        const myInstructorId = settings.instructorId ?? null;
        const instructorNameById = new Map(
          (settings.autonomousInstructors ?? []).map((i) => [i.id, i.name]),
        );
        const all = settings.students ?? [];
        setStudents(
          all.map((s) => {
            const isMyCluster = Boolean(myInstructorId) && s.assignedInstructorId === myInstructorId;
            let clusterLabel: string | null = null;
            if (isMyCluster) {
              clusterLabel = 'Mio gruppo';
            } else if (s.assignedInstructorId) {
              clusterLabel = instructorNameById.get(s.assignedInstructorId) ?? 'Altro gruppo';
            }
            return {
              id: s.id,
              firstName: s.firstName ?? '',
              lastName: s.lastName ?? '',
              clusterLabel,
              isMyCluster,
            };
          }),
        );
      } else {
        // Fallback — OWNER or missing instructor profile
        const res = await regloApi.getStudents();
        setStudents(
          res.map((s: Record<string, unknown>) => ({
            id: s.id as string,
            firstName: (s.firstName ?? s.name ?? '') as string,
            lastName: (s.lastName ?? '') as string,
            clusterLabel: null,
            isMyCluster: false,
          })),
        );
      }
    } catch {
      setToast({ text: 'Errore nel caricamento allievi', tone: 'danger' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  const openStudentsSheet = () => {
    setDraftSelectedIds(selectedStudentIds);
    setStudentSearch('');
    setStudentsSheetOpen(true);
  };
  const confirmStudentsSelection = () => {
    setSelectedStudentIds(draftSelectedIds);
    setStudentsSheetOpen(false);
  };

  const selectedStudents = useMemo(
    () => students.filter((s) => selectedStudentIds.includes(s.id)),
    [students, selectedStudentIds],
  );

  const filteredSheetStudents = useMemo(() => {
    const q = studentSearch.toLowerCase().trim();
    const filtered = q
      ? students.filter((s) => `${s.firstName} ${s.lastName}`.toLowerCase().includes(q))
      : students;
    return [...filtered].sort((a, b) => {
      // 1. Selected first
      const aSel = draftSelectedIds.includes(a.id) ? 0 : 1;
      const bSel = draftSelectedIds.includes(b.id) ? 0 : 1;
      if (aSel !== bSel) return aSel - bSel;
      // 2. My cluster before other clusters / unassigned
      const aMine = a.isMyCluster ? 0 : 1;
      const bMine = b.isMyCluster ? 0 : 1;
      if (aMine !== bMine) return aMine - bMine;
      // 3. Alphabetical
      return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
    });
  }, [students, studentSearch, draftSelectedIds]);

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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Errore nella creazione';
      setToast({ text: msg, tone: 'danger' });
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
            {/* Students — primary card */}
            <View style={styles.studentsCard}>
              <View style={styles.studentsHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.studentsTitle}>Allievi all&apos;esame</Text>
                  <Text style={styles.studentsSubtitle}>
                    {selectedStudents.length === 0
                      ? 'Scegli gli allievi che sostengono l\u2019esame.'
                      : `${selectedStudents.length} ${selectedStudents.length === 1 ? 'allievo selezionato' : 'allievi selezionati'}.`}
                  </Text>
                </View>
                <Pressable
                  onPress={openStudentsSheet}
                  style={({ pressed }) => [styles.manageBtn, pressed && { opacity: 0.85 }]}
                >
                  <Ionicons name="create-outline" size={15} color="#BE185D" />
                  <Text style={styles.manageBtnText}>Gestisci</Text>
                </Pressable>
              </View>

              {selectedStudents.length === 0 ? (
                <Pressable
                  onPress={openStudentsSheet}
                  style={({ pressed }) => [styles.emptyStateBtn, pressed && { opacity: 0.85 }]}
                >
                  <View style={styles.emptyStateIconCircle}>
                    <Ionicons name="person-add-outline" size={22} color="#BE185D" />
                  </View>
                  <Text style={styles.emptyStateText}>Aggiungi allievi</Text>
                </Pressable>
              ) : (
                <View style={styles.avatarStackWrapper}>
                  {selectedStudents.slice(0, 6).map((student, idx) => {
                    const { bg, fg } = avatarColorsFor(student.id);
                    return (
                      <View
                        key={student.id}
                        style={[
                          styles.avatarCircle,
                          { backgroundColor: bg, marginLeft: idx === 0 ? 0 : -10, zIndex: 10 - idx },
                        ]}
                      >
                        <Text style={[styles.avatarInitials, { color: fg }]}>
                          {getInitials(student.firstName, student.lastName)}
                        </Text>
                      </View>
                    );
                  })}
                  {selectedStudents.length > 6 ? (
                    <View style={[styles.avatarCircle, styles.avatarOverflow, { marginLeft: -10 }]}>
                      <Text style={styles.avatarOverflowText}>
                        +{selectedStudents.length - 6}
                      </Text>
                    </View>
                  ) : null}
                  <View style={{ flex: 1 }} />
                </View>
              )}
            </View>

            {/* Date & time */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Data e ora</Text>
              <Pressable style={styles.dateRow} onPress={() => setDateDrawerOpen(true)}>
                <Ionicons name="calendar-outline" size={20} color="#64748B" />
                <Text style={styles.dateText}>{formatDate(examDate)}</Text>
                <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
              </Pressable>
              <Pressable style={styles.dateRow} onPress={() => setTimeDrawerOpen(true)}>
                <Ionicons name="time-outline" size={20} color="#64748B" />
                <Text style={styles.dateText}>{formatTime(examDate)}</Text>
                <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
              </Pressable>
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

      {/* Students picker bottom sheet */}
      <BottomSheet
        visible={studentsSheetOpen}
        onClose={() => setStudentsSheetOpen(false)}
        title="Allievi all&#39;esame"
        showHandle
        titleRight={
          <View style={styles.sheetCounter}>
            <Text style={styles.sheetCounterText}>{draftSelectedIds.length}</Text>
          </View>
        }
        footer={
          <Pressable
            onPress={confirmStudentsSelection}
            style={({ pressed }) => [styles.sheetConfirmBtn, pressed && { opacity: 0.88 }]}
          >
            <Text style={styles.sheetConfirmText}>
              {draftSelectedIds.length === 0
                ? 'Conferma'
                : `Conferma selezione (${draftSelectedIds.length})`}
            </Text>
          </Pressable>
        }
      >
        <View style={styles.sheetSearchRow}>
          <Ionicons name="search" size={16} color="#94A3B8" />
          <TextInput
            style={styles.sheetSearchInput}
            placeholder="Cerca allievo..."
            placeholderTextColor="#94A3B8"
            value={studentSearch}
            onChangeText={setStudentSearch}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {studentSearch.length > 0 ? (
            <Pressable onPress={() => setStudentSearch('')} hitSlop={10}>
              <Ionicons name="close-circle" size={18} color="#CBD5E1" />
            </Pressable>
          ) : null}
        </View>

        {draftSelectedIds.length > 0 ? (
          <Pressable
            onPress={() => setDraftSelectedIds([])}
            style={({ pressed }) => [styles.clearAllRow, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.clearAllText}>Deseleziona tutti</Text>
          </Pressable>
        ) : null}

        {filteredSheetStudents.length === 0 ? (
          <View style={styles.sheetEmpty}>
            <Ionicons name="search-outline" size={28} color="#CBD5E1" />
            <Text style={styles.sheetEmptyText}>
              {studentSearch ? 'Nessun allievo trovato.' : 'Nessun allievo disponibile.'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredSheetStudents}
            keyExtractor={(item) => item.id}
            style={{ maxHeight: 420 }}
            contentContainerStyle={{ paddingBottom: 8 }}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item: student }) => {
              const isSelected = draftSelectedIds.includes(student.id);
              const { bg, fg } = avatarColorsFor(student.id);
              return (
                <Pressable
                  onPress={() => {
                    setDraftSelectedIds((prev) =>
                      prev.includes(student.id)
                        ? prev.filter((id) => id !== student.id)
                        : [...prev, student.id],
                    );
                  }}
                  style={({ pressed }) => [styles.sheetRow, pressed && { opacity: 0.6 }]}
                >
                  <View style={[styles.sheetAvatar, { backgroundColor: bg }]}>
                    <Text style={[styles.sheetAvatarText, { color: fg }]}>
                      {getInitials(student.firstName, student.lastName)}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sheetRowName} numberOfLines={1}>
                      {student.firstName} {student.lastName}
                    </Text>
                    {student.clusterLabel ? (
                      <View style={[styles.clusterBadge, student.isMyCluster && styles.clusterBadgeMine]}>
                        <Text style={[styles.clusterBadgeText, student.isMyCluster && styles.clusterBadgeTextMine]} numberOfLines={1}>
                          {student.clusterLabel}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <View
                    style={[styles.sheetCheckbox, isSelected && styles.sheetCheckboxChecked]}
                  >
                    {isSelected ? <Ionicons name="checkmark" size={16} color="#FFFFFF" /> : null}
                  </View>
                </Pressable>
              );
            }}
            ItemSeparatorComponent={() => <View style={styles.sheetSeparator} />}
          />
        )}
      </BottomSheet>

      <CalendarDrawer
        visible={dateDrawerOpen}
        onClose={() => setDateDrawerOpen(false)}
        selectedDate={examDate}
        onSelectDate={(d) => {
          const next = new Date(examDate);
          next.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
          setExamDate(next);
          const end = new Date(next);
          end.setHours(end.getHours() + 1);
          setExamEndDate(end);
        }}
      />

      <TimePickerDrawer
        visible={timeDrawerOpen}
        onClose={() => setTimeDrawerOpen(false)}
        selectedTime={examDate}
        onSelectTime={(d) => {
          const next = new Date(examDate);
          next.setHours(d.getHours(), d.getMinutes(), 0, 0);
          setExamDate(next);
          const end = new Date(next);
          end.setHours(end.getHours() + 1);
          setExamEndDate(end);
        }}
      />
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
  studentsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    gap: 12,
  },
  studentsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  studentsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  studentsSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  manageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#FCE7F3',
  },
  manageBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#BE185D',
  },
  emptyStateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#F9A8D4',
    backgroundColor: '#FDF2F8',
  },
  emptyStateIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FCE7F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#BE185D',
  },
  avatarStackWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  avatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  avatarInitials: {
    fontSize: 13,
    fontWeight: '700',
  },
  avatarOverflow: {
    backgroundColor: '#F1F5F9',
  },
  avatarOverflowText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dateText: {
    flex: 1,
    fontSize: 15,
    color: '#1E293B',
    fontWeight: '600',
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
  // BottomSheet
  sheetCounter: {
    minWidth: 28,
    height: 28,
    paddingHorizontal: 8,
    borderRadius: 14,
    backgroundColor: '#FCE7F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetCounterText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#BE185D',
  },
  sheetSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    marginBottom: 10,
  },
  sheetSearchInput: {
    flex: 1,
    fontSize: 15,
    color: '#1E293B',
    padding: 0,
  },
  clearAllRow: {
    alignSelf: 'flex-end',
    paddingVertical: 6,
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  clearAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    textDecorationLine: 'underline',
  },
  sheetEmpty: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  sheetEmptyText: {
    fontSize: 14,
    color: '#64748B',
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  sheetAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetAvatarText: {
    fontSize: 14,
    fontWeight: '700',
  },
  sheetRowName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
  },
  clusterBadge: {
    alignSelf: 'flex-start',
    marginTop: 3,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  clusterBadgeMine: {
    backgroundColor: '#FCE7F3',
  },
  clusterBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  clusterBadgeTextMine: {
    color: '#BE185D',
  },
  sheetCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetCheckboxChecked: {
    backgroundColor: '#EC4899',
    borderColor: '#EC4899',
  },
  sheetSeparator: {
    height: 1,
    backgroundColor: '#F1F5F9',
  },
  sheetConfirmBtn: {
    height: 52,
    borderRadius: 999,
    backgroundColor: '#EC4899',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetConfirmText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
