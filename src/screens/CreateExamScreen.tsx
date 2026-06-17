import React, { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SheetScaffold } from '../components/SheetScaffold';

import { examSheetStore } from '../stores/examSheetStore';
import { examStudentsStore, type ExamStudentOption } from '../stores/examStudentsStore';
import { dayPickerStore } from '../stores/dayPickerStore';
import { timePickerStore } from '../stores/timePickerStore';
import { optionsPickerStore } from '../stores/optionsPickerStore';
import { regloApi } from '../services/regloApi';
import { Button } from '../components/Button';
import { ToggleSwitch } from '../components/ToggleSwitch';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';

const NAVY = '#1A1A2E';
const GREY = '#717171';
const MUTED = '#94A3B8';
const N50 = '#F4F5F9';
const N100 = '#E9EBF2';

const pad2 = (n: number) => String(n).padStart(2, '0');
const toYMD = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const fromYMD = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const fmtDay = (d: Date) => d.toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
const fmtTime = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

// Exams can run longer than a normal guida — up to 3h (parity with web).
const EXAM_DURATIONS = [30, 45, 60, 90, 120, 150, 180, 210, 240, 270, 300];
const durLabel = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}min` : ''}` : `${m} min`);

const initialsOf = (first: string, last: string) => {
  const f = (first ?? '').trim();
  const l = (last ?? '').trim();
  if (f && l) return `${f[0]}${l[0]}`.toUpperCase();
  if (f) return f.slice(0, 2).toUpperCase();
  if (l) return l.slice(0, 2).toUpperCase();
  return '?';
};

type StudentItem = {
  id: string;
  firstName: string;
  lastName: string;
  clusterLabel: string | null; // "Mio gruppo" | "<istruttore>" | null
  isMyCluster: boolean;
};

/* ── Flat row inside the elevated card (icon · label · value · chevron) ── */
const Row = ({ icon, label, value, placeholder, onPress, disabled }: {
  icon: keyof typeof Ionicons.glyphMap; label: string;
  value?: string | null; placeholder?: string; onPress: () => void; disabled?: boolean;
}) => (
  <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [s.row, pressed && { opacity: 0.55 }]}>
    <View style={s.rowIcon}><Ionicons name={icon} size={22} color={NAVY} /></View>
    <View style={s.rowBody}>
      <Text style={s.rowLabel}>{label}</Text>
      {value ? (
        <Text style={s.rowValue} numberOfLines={1}>{value}</Text>
      ) : (
        <Text style={s.rowPlaceholder} numberOfLines={1}>{placeholder}</Text>
      )}
    </View>
    <Ionicons name="chevron-forward" size={18} color="#C7CBD1" />
  </Pressable>
);

export const CreateExamScreen = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const data = useSyncExternalStore(examSheetStore.subscribe, examSheetStore.get);

  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [examDate, setExamDate] = useState<Date>(() => (data ? new Date(data.initialDate) : new Date()));
  const [timeSet, setTimeSet] = useState(true);
  const [duration, setDuration] = useState(60);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const loadStudents = useCallback(async () => {
    try {
      const settings = await regloApi.getInstructorSettings().catch(() => null);
      if (settings) {
        const myInstructorId = settings.instructorId ?? null;
        const instructorNameById = new Map((settings.autonomousInstructors ?? []).map((i) => [i.id, i.name]));
        setStudents(
          (settings.students ?? []).map((st) => {
            const isMyCluster = Boolean(myInstructorId) && st.assignedInstructorId === myInstructorId;
            let clusterLabel: string | null = null;
            if (isMyCluster) clusterLabel = 'Mio gruppo';
            else if (st.assignedInstructorId) clusterLabel = instructorNameById.get(st.assignedInstructorId) ?? 'Altro gruppo';
            return { id: st.id, firstName: st.firstName ?? '', lastName: st.lastName ?? '', clusterLabel, isMyCluster };
          }),
        );
      } else {
        const res = await regloApi.getStudents();
        setStudents(
          res.map((st: Record<string, unknown>) => ({
            id: st.id as string,
            firstName: (st.firstName ?? st.name ?? '') as string,
            lastName: (st.lastName ?? '') as string,
            clusterLabel: null,
            isMyCluster: false,
          })),
        );
      }
    } catch {
      Alert.alert('Errore', 'Errore nel caricamento allievi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadStudents(); }, [loadStudents]);

  // Re-seed the default day whenever the sheet is (re)opened.
  useEffect(() => {
    if (!data) return;
    setExamDate(new Date(data.initialDate));
    setSelectedIds([]);
    setTimeSet(true);
    setDuration(60);
    setNotes('');
    setSaving(false);
  }, [data]);

  const selectedStudents = useMemo(
    () => students.filter((st) => selectedIds.includes(st.id)),
    [students, selectedIds],
  );

  if (!data) return <View style={s.root} />;

  const openStudentsPicker = () => {
    const options: ExamStudentOption[] = students.map((st) => ({
      value: st.id,
      label: `${st.firstName} ${st.lastName}`.trim(),
      subtitle: st.clusterLabel,
      isMyCluster: st.isMyCluster,
    }));
    examStudentsStore.set({ selectedIds, options, onConfirm: setSelectedIds });
    router.push('/(tabs)/home/select-exam-students');
  };

  const openDatePicker = () => {
    dayPickerStore.set({
      selectedDate: toYMD(examDate), markedDates: new Set(), monthsBack: 0, monthsCount: 4,
      allowPast: false, title: "Data dell'esame",
      onSelect: (ymd) => {
        const picked = fromYMD(ymd);
        setExamDate((prev) => {
          const next = new Date(prev);
          next.setFullYear(picked.getFullYear(), picked.getMonth(), picked.getDate());
          return next;
        });
      },
    });
    router.push('/(tabs)/home/select-date');
  };

  const openTimePicker = () => {
    timePickerStore.set({
      selectedTime: examDate,
      onConfirm: (d) => setExamDate((prev) => {
        const next = new Date(prev);
        next.setHours(d.getHours(), d.getMinutes(), 0, 0);
        return next;
      }),
    });
    router.push('/(tabs)/home/time-picker');
  };

  const openDurationPicker = () => {
    optionsPickerStore.set({
      title: 'Durata esame',
      multi: false,
      selected: [String(duration)],
      options: EXAM_DURATIONS.map((m) => ({ value: String(m), label: durLabel(m) })),
      onConfirm: (v) => setDuration(Number(v[0]) || 60),
    });
    router.push('/(tabs)/home/select-options');
  };

  const studentsValue = selectedStudents.length === 0
    ? null
    : selectedStudents.length === 1
      ? `${selectedStudents[0].firstName} ${selectedStudents[0].lastName}`.trim()
      : `${selectedStudents.length} allievi`;

  const summary = selectedStudents.length === 0
    ? 'Nessun allievo'
    : `${selectedStudents.length} ${selectedStudents.length === 1 ? 'allievo' : 'allievi'}`;

  const handleCreate = async () => {
    if (selectedIds.length === 0) {
      Alert.alert('Seleziona allievi', "Aggiungi almeno un allievo all'esame.");
      return;
    }
    setSaving(true);
    try {
      if (timeSet) {
        const endsAt = new Date(examDate); endsAt.setMinutes(endsAt.getMinutes() + duration);
        await regloApi.createExam({
          studentIds: selectedIds,
          startsAt: examDate.toISOString(),
          endsAt: endsAt.toISOString(),
          notes: notes.trim() || undefined,
        });
      } else {
        const dateOnly = new Date(examDate); dateOnly.setHours(0, 0, 0, 0);
        await regloApi.createExam({
          studentIds: selectedIds,
          startsAt: dateOnly.toISOString(),
          notes: notes.trim() || undefined,
        });
      }
      data.onDone('Esame creato.');
      router.back();
    } catch (err) {
      Alert.alert('Errore', err instanceof Error ? err.message : 'Errore nella creazione.');
      setSaving(false);
    }
  };

  return (
    <View style={[s.root, { paddingBottom: insets.bottom + 14 }, Platform.OS === 'android' && { flex: 1 }]}>
      <View style={s.header}>
        <Text style={s.title}>Crea esame</Text>
        <Pressable onPress={() => !saving && router.back()} hitSlop={10} disabled={saving} style={({ pressed }) => [s.close, pressed && { opacity: 0.5 }]}>
          <Ionicons name="close" size={20} color={NAVY} />
        </Pressable>
      </View>

      <SheetScaffold
        keyboardAware
        footer={loading ? null : (
          <View style={s.footer}>
            <View style={{ flex: 1, minWidth: 0, paddingRight: 14 }}>
              <Text style={s.sumKey}>Riepilogo</Text>
              <Text style={s.sumVal} numberOfLines={1}>{summary}</Text>
              <Text style={s.sumSub} numberOfLines={1}>{fmtDay(examDate)}{timeSet ? ` · ${fmtTime(examDate)} · ${durLabel(duration)}` : ' · orario da definire'}</Text>
            </View>
            <View style={{ flexShrink: 0 }}>
              <Button label="Crea esame" tone="primary" loading={saving} disabled={selectedIds.length === 0} onPress={handleCreate} />
            </View>
          </View>
        )}
      >
      {loading ? (
        <View style={s.loadingBox}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <>
          {/* Card 3D primaria: allievi + giorno + ora */}
          <View style={s.group}>
            {/* Allievi — riga con stack avatar */}
            <Pressable onPress={openStudentsPicker} disabled={saving} style={({ pressed }) => [s.row, pressed && { opacity: 0.55 }]}>
              <View style={s.rowIcon}><Ionicons name="people-outline" size={22} color={NAVY} /></View>
              <View style={s.rowBody}>
                <Text style={s.rowLabel}>Allievi</Text>
                {studentsValue ? (
                  <Text style={s.rowValue} numberOfLines={1}>{studentsValue}</Text>
                ) : (
                  <Text style={s.rowPlaceholder} numberOfLines={1}>Seleziona allievi</Text>
                )}
              </View>
              {selectedStudents.length > 0 ? (
                <View style={s.avatarStack}>
                  {selectedStudents.slice(0, 3).map((st, idx) => (
                    <View key={st.id} style={[s.stackAvatar, { marginLeft: idx === 0 ? 0 : -10, zIndex: 5 - idx }]}>
                      <Text style={s.stackAvatarTxt}>{initialsOf(st.firstName, st.lastName)}</Text>
                    </View>
                  ))}
                  {selectedStudents.length > 3 ? (
                    <View style={[s.stackAvatar, s.stackMore, { marginLeft: -10 }]}>
                      <Text style={s.stackMoreTxt}>+{selectedStudents.length - 3}</Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
              <Ionicons name="chevron-forward" size={18} color="#C7CBD1" />
            </Pressable>

            <View style={s.divider} />
            <Row icon="calendar-outline" label="Giorno" value={fmtDay(examDate)} onPress={openDatePicker} disabled={saving} />
            {timeSet ? (
              <>
                <View style={s.divider} />
                <Row icon="time-outline" label="Ora" value={fmtTime(examDate)} onPress={openTimePicker} disabled={saving} />
                <View style={s.divider} />
                <Row icon="hourglass-outline" label="Durata" value={durLabel(duration)} onPress={openDurationPicker} disabled={saving} />
              </>
            ) : null}
          </View>

          {/* Orario da definire — banner optional */}
          <View style={s.optBanner}>
            <View style={s.optIcon}><Ionicons name="help-circle-outline" size={18} color={NAVY} /></View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.optTitle}>Orario da definire</Text>
              <Text style={s.optSub}>Crea l'esame senza un orario fisso</Text>
            </View>
            <ToggleSwitch value={!timeSet} onValueChange={(v) => setTimeSet(!v)} disabled={saving} />
          </View>

          {/* Note — opzionale */}
          <Text style={s.fieldLabel}>Note <Text style={s.fieldOptional}>· facoltativo</Text></Text>
          <TextInput
            style={s.textArea}
            value={notes}
            onChangeText={setNotes}
            placeholder="Es. sede, documenti necessari…"
            placeholderTextColor={MUTED}
            editable={!saving}
            multiline
            textAlignVertical="top"
          />
        </>
      )}
      </SheetScaffold>
    </View>
  );
};

const ELEV = {
  shadowColor: '#1A1A2E', shadowOpacity: 0.07, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 4,
} as const;

const s = StyleSheet.create({
  root: { backgroundColor: colors.background, paddingHorizontal: spacing.lg, paddingTop: 8 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, paddingBottom: 14, gap: 12 },
  title: { flex: 1, fontSize: 24, fontWeight: '600', color: NAVY, letterSpacing: -0.5 },
  close: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#EFF0F3', alignItems: 'center', justifyContent: 'center' },

  loadingBox: { paddingVertical: 48, alignItems: 'center', justifyContent: 'center' },

  group: { backgroundColor: '#FFFFFF', borderRadius: 20, paddingHorizontal: 16, marginBottom: 14, ...ELEV },

  /* row */
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 15, minHeight: 64 },
  rowIcon: { width: 26, alignItems: 'center' },
  rowBody: { flex: 1, minWidth: 0, gap: 1 },
  rowLabel: { fontSize: 15, fontWeight: '600', color: NAVY },
  rowValue: { fontSize: 14, color: GREY },
  rowPlaceholder: { fontSize: 14, color: MUTED },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#EFF0F3' },

  /* avatar stack on the allievi row */
  avatarStack: { flexDirection: 'row', alignItems: 'center' },
  stackAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: N100, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFFFFF' },
  stackAvatarTxt: { fontSize: 11, fontWeight: '600', color: NAVY },
  stackMore: { backgroundColor: '#E2E5EE' },
  stackMoreTxt: { fontSize: 10, fontWeight: '600', color: NAVY },

  /* note text area */
  fieldLabel: { fontSize: 13, fontWeight: '600', color: NAVY, marginBottom: 8, marginLeft: 2 },
  fieldOptional: { fontSize: 13, fontWeight: '500', color: MUTED },
  textArea: { backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#E4E7EE', borderRadius: 14, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 12, minHeight: 84, fontSize: 14, color: NAVY, marginBottom: 14 },

  /* optional banner */
  optBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: N50, borderRadius: 16, paddingVertical: 11, paddingHorizontal: 14, marginBottom: 14 },
  optIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  optTitle: { fontSize: 14, fontWeight: '600', color: NAVY },
  optSub: { fontSize: 12.5, color: MUTED, marginTop: 1 },

  /* footer */
  footer: { flexDirection: 'row', alignItems: 'center', marginTop: 4, marginHorizontal: -spacing.lg, paddingHorizontal: spacing.lg, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  sumKey: { fontSize: 12, color: MUTED, fontWeight: '500' },
  sumVal: { fontSize: 15, fontWeight: '600', color: NAVY, marginTop: 2 },
  sumSub: { fontSize: 13, fontWeight: '500', color: GREY, marginTop: 1 },
});
