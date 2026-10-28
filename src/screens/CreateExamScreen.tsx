import React, { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { FormSheet } from '../components/SheetScaffold';
import { ClayButton, ClayField, ClayList, ClayListRow, ClayToggle } from '../components/clay';
import { useDoneAccessory } from '../components/KeyboardDoneAccessory';

import { examSheetStore } from '../stores/examSheetStore';
import { examStudentsStore, type ExamStudentOption } from '../stores/examStudentsStore';
import { dayPickerStore } from '../stores/dayPickerStore';
import { timePickerStore } from '../stores/timePickerStore';
import { optionsPickerPath, optionsPickerStore } from '../stores/optionsPickerStore';
import { regloApi } from '../services/regloApi';
import { CLAY } from '../theme/clay';

const pad2 = (n: number) => String(n).padStart(2, '0');
const toYMD = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const fromYMD = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const fmtDay = (d: Date) => d.toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
const fmtTime = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

// Exams can run longer than a normal guida — up to 3h (parity with web).
const EXAM_DURATIONS = [30, 45, 60, 90, 120, 150, 180, 210, 240, 270, 300];
const durLabel = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}min` : ''}` : `${m} min`);

type StudentItem = {
  id: string;
  firstName: string;
  lastName: string;
  clusterLabel: string | null; // "Mio gruppo" | "<istruttore>" | null
  isMyCluster: boolean;
  license: string | null; // categoria patente in preparazione (B, A2, …)
  examReady: boolean; // segnato "pronto per l'esame" (segnale interno)
};

/**
 * «Crea esame» (REG-639 clay): il form sheet unico. Righe di solo testo in una
 * lista clay (niente icone), «Orario da definire» come interruttore, note in
 * un campo clay, CTA nera in fondo. Il riepilogo è il sottotitolo.
 */
export const CreateExamScreen = () => {
  const router = useRouter();
  const data = useSyncExternalStore(examSheetStore.subscribe, examSheetStore.get);

  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [examDate, setExamDate] = useState<Date>(() => (data ? new Date(data.initialDate) : new Date()));
  const [timeSet, setTimeSet] = useState(true);
  const [duration, setDuration] = useState(60);
  const [notes, setNotes] = useState('');
  const { accessoryID, accessory } = useDoneAccessory();
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
            return { id: st.id, firstName: st.firstName ?? '', lastName: st.lastName ?? '', clusterLabel, isMyCluster, license: st.licenseCategory ?? null, examReady: st.examReady ?? false };
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
            license: (st.licenseCategory as string | null | undefined) ?? null,
            examReady: (st.examReady as boolean | undefined) ?? false,
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

  if (!data) return <View style={s.empty} />;

  const openStudentsPicker = () => {
    const options: ExamStudentOption[] = students
      // Chicca: gli allievi "pronti" salgono in cima al picker.
      .slice()
      .sort((a, b) => Number(b.examReady) - Number(a.examReady))
      .map((st) => ({
        value: st.id,
        label: `${st.firstName} ${st.lastName}`.trim(),
        subtitle: st.clusterLabel,
        isMyCluster: st.isMyCluster,
        license: st.license,
        examReady: st.examReady,
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
    router.push(optionsPickerPath());
  };

  const studentsValue = selectedStudents.length === 0
    ? null
    : selectedStudents.length === 1
      ? `${selectedStudents[0].firstName} ${selectedStudents[0].lastName}`.trim()
      : `${selectedStudents.length} allievi`;

  const summary = selectedStudents.length === 0
    ? 'Nessun allievo'
    : `${selectedStudents.length} ${selectedStudents.length === 1 ? 'allievo' : 'allievi'}`;
  // Il riepilogo che stava nel footer ora è il sottotitolo del foglio.
  const subtitle = `${summary} · ${fmtDay(examDate)}${timeSet ? ` · ${fmtTime(examDate)}` : ' · orario da definire'}`;
  const guard = (fn: () => void) => () => { if (!saving) fn(); };

  const handleCreate = async () => {
    // Zero students is allowed: the exam is created as an empty slot the
    // instructor fills in later (spesso non si sa subito chi farà l'esame).
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
    <FormSheet
      title="Crea esame"
      subtitle={loading ? undefined : subtitle}
      onClose={() => { if (!saving) router.back(); }}
      testID="create-exam-sheet"
      cta={loading ? null : (
        <ClayButton title="Crea esame" loading={saving} onPress={handleCreate} testID="create-exam-submit" />
      )}
    >
      {loading ? (
        <View style={s.loadingBox}>
          <ActivityIndicator color={CLAY.ink} />
        </View>
      ) : (
        <>
          <ClayList>
            <ClayListRow
              title="Allievi"
              subtitle={studentsValue ?? 'Seleziona allievi'}
              onPress={guard(openStudentsPicker)}
              testID="create-exam-students"
            />
            <ClayListRow title="Giorno" subtitle={fmtDay(examDate)} onPress={guard(openDatePicker)} />
            {timeSet ? <ClayListRow title="Ora" subtitle={fmtTime(examDate)} onPress={guard(openTimePicker)} /> : null}
            {timeSet ? <ClayListRow title="Durata" subtitle={durLabel(duration)} onPress={guard(openDurationPicker)} /> : null}
          </ClayList>

          <ClayList style={s.gap}>
            <ClayListRow
              title="Orario da definire"
              subtitle="Crea l'esame senza un orario fisso"
              trailing={
                <ClayToggle
                  value={!timeSet}
                  onValueChange={(v) => setTimeSet(!v)}
                  disabled={saving}
                  accessibilityLabel="Orario da definire"
                />
              }
            />
          </ClayList>

          <ClayField
            label="Note"
            hint="Facoltative"
            style={s.notes}
            value={notes}
            onChangeText={setNotes}
            placeholder="Es. sede, documenti necessari…"
            editable={!saving}
            multiline
            inputAccessoryViewID={accessoryID}
          />
          {accessory}
        </>
      )}
    </FormSheet>
  );
};

const s = StyleSheet.create({
  empty: { backgroundColor: '#FFFFFF', height: 1 },
  loadingBox: { paddingVertical: 48, alignItems: 'center', justifyContent: 'center' },
  gap: { marginTop: 14 },
  notes: { marginTop: 22 },
});
