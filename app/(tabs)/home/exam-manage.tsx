import React, { useEffect, useRef, useState } from 'react';
import { ActionSheetIOS, Alert, Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { examManageStore } from '../../../src/stores/examManageStore';
import { timePickerStore } from '../../../src/stores/timePickerStore';
import { examStudentsStore, type ExamStudentOption } from '../../../src/stores/examStudentsStore';
import { regloApi } from '../../../src/services/regloApi';
import { colors } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';
import type { AutoscuolaAppointmentWithRelations } from '../../../src/types/regloApi';

const FLUENT_GRADUATE = require('../../../assets/icons/fluent-graduate.png');

const WD = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];
const MO = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
const pad = (n: number) => String(n).padStart(2, '0');
const fmtDay = (iso: string) => { const d = new Date(iso); return `${WD[d.getDay()]} ${d.getDate()} ${MO[d.getMonth()]}`; };
const fmtTime = (iso: string) => { const d = new Date(iso); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const studentName = (a: AutoscuolaAppointmentWithRelations) =>
  `${a.student?.firstName ?? ''} ${a.student?.lastName ?? ''}`.trim() || 'Allievo';
const initials = (a: AutoscuolaAppointmentWithRelations) =>
  `${a.student?.firstName?.[0] ?? ''}${a.student?.lastName?.[0] ?? ''}`.toUpperCase() || '·';

export default function ExamManageScreen() {
  const router = useRouter();
  const seed = useRef(examManageStore.get()).current;

  const [appts, setAppts] = useState<AutoscuolaAppointmentWithRelations[]>(seed?.appointments ?? []);
  const [startsAt, setStartsAt] = useState<string>(seed?.startsAt ?? '');
  const [endsAt, setEndsAt] = useState<string | null>(seed?.endsAt ?? null);
  const [busy, setBusy] = useState(false);

  useEffect(() => () => { examManageStore.clear(); }, []);

  if (!seed) return <View style={s.root} />;

  const onChanged = seed.onChanged;
  const readOnly = seed.readOnly === true;
  const close = () => router.back();

  // ── Modifica / Imposta orario → native time picker route ──
  const openTimePicker = () => {
    const base = endsAt ? new Date(startsAt) : (() => { const d = new Date(startsAt || Date.now()); d.setHours(9, 0, 0, 0); return d; })();
    timePickerStore.set({
      selectedTime: base,
      onConfirm: async (d) => {
        const newStart = new Date(startsAt || Date.now());
        newStart.setHours(d.getHours(), d.getMinutes(), 0, 0);
        const newEnd = new Date(newStart.getTime() + 60 * 60 * 1000);
        try {
          await regloApi.updateExamTime({
            appointmentIds: appts.map((a) => a.id).filter((id) => !id.startsWith('pending-')),
            startsAt: newStart.toISOString(),
            endsAt: newEnd.toISOString(),
          });
          setStartsAt(newStart.toISOString());
          setEndsAt(newEnd.toISOString());
          onChanged();
        } catch {
          Alert.alert('Errore', 'Impossibile aggiornare l’orario.');
        }
      },
    });
    router.push('/(tabs)/home/time-picker');
  };

  // ── Open the student's detail as a modal stacked over this sheet ──
  const openStudent = (a: AutoscuolaAppointmentWithRelations) => {
    if (!a.studentId) return;
    router.push({ pathname: '/(tabs)/home/student-detail', params: { studentId: a.studentId, name: studentName(a) } } as never);
  };

  // ── Remove a student (••• menu) ──
  const doRemove = async (a: AutoscuolaAppointmentWithRelations) => {
    if (a.id.startsWith('pending-')) { setAppts((p) => p.filter((x) => x.id !== a.id)); return; }
    setBusy(true);
    try {
      await regloApi.cancelAppointment(a.id);
      setAppts((p) => p.filter((x) => x.id !== a.id));
      onChanged();
    } catch (err) {
      Alert.alert('Errore', err instanceof Error ? err.message : 'Impossibile rimuovere l’allievo.');
    } finally {
      setBusy(false);
    }
  };

  const onStudentMenu = (a: AutoscuolaAppointmentWithRelations) => {
    if (appts.length <= 1) {
      Alert.alert('Ultimo allievo', 'È l’unico allievo dell’esame. Per rimuoverlo, usa "Annulla esame".');
      return;
    }
    const confirmRemove = () =>
      Alert.alert('Rimuovi allievo', `Rimuovere ${studentName(a)} dall’esame?`, [
        { text: 'Annulla', style: 'cancel' },
        { text: 'Rimuovi', style: 'destructive', onPress: () => doRemove(a) },
      ]);
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Apri scheda allievo', 'Rimuovi dall’esame', 'Annulla'], destructiveButtonIndex: 1, cancelButtonIndex: 2 },
        (i) => { if (i === 0) openStudent(a); else if (i === 1) confirmRemove(); },
      );
    } else {
      Alert.alert(studentName(a), undefined, [
        { text: 'Apri scheda allievo', onPress: () => openStudent(a) },
        { text: 'Rimuovi dall’esame', style: 'destructive', onPress: confirmRemove },
        { text: 'Annulla', style: 'cancel' },
      ]);
    }
  };

  // ── Cancel the whole exam ──
  const cancelExam = () =>
    Alert.alert('Annulla esame', 'Vuoi annullare l’esame per tutti gli allievi?', [
      { text: 'Chiudi', style: 'cancel' },
      {
        text: 'Annulla esame',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await Promise.all(appts.filter((a) => !a.id.startsWith('pending-')).map((a) => regloApi.cancelAppointment(a.id)));
            onChanged();
            close();
          } catch (err) {
            Alert.alert('Errore', err instanceof Error ? err.message : 'Errore.');
            setBusy(false);
          }
        },
      },
    ]);

  // ── Add students (+) → multi-select picker → createExam at the same slot ──
  const openAddStudents = async () => {
    try {
      const settings = await regloApi.getInstructorSettings().catch(() => null);
      const currentIds = new Set(appts.map((a) => a.studentId).filter(Boolean) as string[]);
      let options: ExamStudentOption[] = [];
      if (settings) {
        const myId = settings.instructorId ?? null;
        const nameById = new Map((settings.autonomousInstructors ?? []).map((i) => [i.id, i.name]));
        options = (settings.students ?? [])
          .filter((st) => !currentIds.has(st.id))
          .map((st) => {
            const isMyCluster = Boolean(myId) && st.assignedInstructorId === myId;
            const subtitle = isMyCluster ? 'Mio gruppo' : st.assignedInstructorId ? (nameById.get(st.assignedInstructorId) ?? 'Altro gruppo') : null;
            return { value: st.id, label: `${st.firstName ?? ''} ${st.lastName ?? ''}`.trim(), subtitle, isMyCluster };
          });
      } else {
        const res = await regloApi.getStudents();
        options = res
          .map((st: Record<string, unknown>) => ({ value: st.id as string, label: `${(st.firstName ?? st.name ?? '') as string} ${(st.lastName ?? '') as string}`.trim(), subtitle: null, isMyCluster: false }))
          .filter((o) => !currentIds.has(o.value));
      }
      examStudentsStore.set({ selectedIds: [], options, onConfirm: (ids) => addStudents(ids, options) });
      router.push('/(tabs)/home/select-exam-students');
    } catch {
      Alert.alert('Errore', 'Impossibile caricare gli allievi.');
    }
  };

  const addStudents = async (ids: string[], options: ExamStudentOption[]) => {
    if (!ids.length) return;
    try {
      await regloApi.createExam({
        studentIds: ids,
        startsAt,
        endsAt: endsAt ?? undefined,
        instructorId: seed.instructorId ?? undefined,
        notes: seed.notes ?? undefined,
      });
      onChanged();
      // Optimistic append so the open sheet reflects the additions immediately.
      const added = ids.map((id) => {
        const label = options.find((o) => o.value === id)?.label ?? '';
        const [firstName, ...rest] = label.split(' ');
        return {
          id: `pending-${id}`,
          studentId: id,
          startsAt,
          endsAt,
          type: 'esame',
          status: 'scheduled',
          student: { firstName: firstName ?? '', lastName: rest.join(' ') },
        } as unknown as AutoscuolaAppointmentWithRelations;
      });
      setAppts((p) => [...p, ...added]);
    } catch (err) {
      Alert.alert('Errore', err instanceof Error ? err.message : 'Impossibile aggiungere gli allievi.');
    }
  };

  const timeLabel = endsAt ? `${fmtTime(startsAt)} – ${fmtTime(endsAt)}` : 'Orario da definire';

  return (
    <View style={s.root}>
      <View style={[s.topBar, Platform.OS === 'android' && { justifyContent: 'flex-start' }]}>
        <Pressable onPress={close} hitSlop={8} style={s.closeBtn}>
          <Ionicons name={Platform.OS === 'android' ? 'arrow-back' : 'close'} size={20} color="#1A1A2E" />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {/* Header — Fluent 3D graduate icon */}
        <View style={s.header}>
          <Image source={FLUENT_GRADUATE} style={s.headerIcon} />
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Esame di guida</Text>
            <Text style={s.subtitle}>{startsAt ? `${fmtDay(startsAt)} · ${timeLabel}` : timeLabel}</Text>
          </View>
        </View>

        {/* Orario — card 3D modificabile; in read-only (titolare) riga statica. */}
        {readOnly ? (
          <View style={s.editCard}>
            <View style={s.editIc}><Ionicons name="time-outline" size={19} color="#1A1A2E" /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.editTitle}>Orario</Text>
              <Text style={s.editSub}>{timeLabel}</Text>
            </View>
          </View>
        ) : (
          <Pressable onPress={openTimePicker} disabled={busy} style={({ pressed }) => [s.editCard, pressed && s.pressed]}>
            <View style={s.editIc}><Ionicons name="time-outline" size={19} color="#1A1A2E" /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.editTitle}>{endsAt ? 'Modifica orario' : 'Imposta orario'}</Text>
              <Text style={s.editSub}>{timeLabel}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#AEB4CC" />
          </Pressable>
        )}

        {/* Accompagnatore — soft inset info card */}
        {seed.instructorName ? (
          <View style={s.accomp}>
            <Ionicons name="person-outline" size={18} color="#6E7596" />
            <Text style={s.accompKey}>Accompagnatore</Text>
            <Text style={s.accompVal}>{seed.instructorName}</Text>
          </View>
        ) : null}

        {/* Allievi — flat rows (no card), ••• menu, + to add */}
        <View style={s.secRow}>
          <Text style={s.sec}>ALLIEVI · {appts.length}</Text>
          {!readOnly && (
            <Pressable onPress={openAddStudents} hitSlop={8} style={({ pressed }) => [s.add, pressed && { opacity: 0.7 }]}>
              <Ionicons name="add" size={20} color="#1A1A2E" />
            </Pressable>
          )}
        </View>
        {appts.map((a, idx) => (
          <Pressable
            key={a.id}
            onPress={() => openStudent(a)}
            style={({ pressed }) => [s.studentRow, idx === appts.length - 1 && { borderBottomWidth: 0 }, pressed && { opacity: 0.6 }]}
          >
            <View style={s.studentAv}><Text style={s.studentAvTx}>{initials(a)}</Text></View>
            <Text style={s.studentNm} numberOfLines={1}>{studentName(a)}</Text>
            {readOnly ? (
              <Ionicons name="chevron-forward" size={18} color="#C7CBD1" />
            ) : (
              <Pressable onPress={() => onStudentMenu(a)} hitSlop={10} style={s.dots}>
                <Ionicons name="ellipsis-horizontal" size={20} color="#AEB4CC" />
              </Pressable>
            )}
          </Pressable>
        ))}

        {/* Note — soft inset card */}
        {seed.notes ? (
          <>
            <Text style={[s.sec, { marginTop: 22 }]}>NOTE</Text>
            <View style={s.note}><Text style={s.noteTx}>{seed.notes}</Text></View>
          </>
        ) : null}
      </ScrollView>

      {/* Annulla esame — pinned footer (nascosto in read-only) */}
      {!readOnly && (
        <View style={s.footer}>
          <Pressable onPress={cancelExam} disabled={busy} style={({ pressed }) => [s.cancel, pressed && { opacity: 0.7 }, busy && { opacity: 0.5 }]}>
            <Text style={s.cancelTx}>Annulla esame</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  topBar: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 18, paddingTop: 16 },
  closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: 24, paddingTop: 2 },

  header: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 22 },
  headerIcon: { width: 52, height: 52 },
  title: { fontSize: 22, fontWeight: '600', color: '#1A1A2E', letterSpacing: -0.4 },
  subtitle: { fontSize: 14, fontWeight: '400', color: '#9CA3AF', marginTop: 3 },

  editCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, backgroundColor: '#FFFFFF', marginBottom: 12, shadowColor: '#1A1A2E', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  editIc: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F4F5F9', alignItems: 'center', justifyContent: 'center' },
  editTitle: { fontSize: 15, fontWeight: '600', color: '#1A1A2E' },
  editSub: { fontSize: 12.5, fontWeight: '400', color: '#9CA3AF', marginTop: 1 },
  pressed: { opacity: 0.9, transform: [{ scale: 0.992 }] },

  accomp: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13, paddingHorizontal: 16, borderRadius: 16, backgroundColor: '#F4F5F9', marginBottom: 26 },
  accompKey: { fontSize: 14, fontWeight: '400', color: '#6E7596' },
  accompVal: { fontSize: 14, fontWeight: '600', color: '#1A1A2E', marginLeft: 'auto' },

  secRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, paddingHorizontal: 2 },
  sec: { fontSize: 12, fontWeight: '600', color: '#6E7596', letterSpacing: 0.6 },
  add: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#F4F5F9', alignItems: 'center', justifyContent: 'center' },

  studentRow: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 14, paddingHorizontal: 2, borderBottomWidth: 1, borderBottomColor: '#EEF0F4' },
  studentAv: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#EEF0F4', alignItems: 'center', justifyContent: 'center' },
  studentAvTx: { fontSize: 14, fontWeight: '600', color: '#1A1A2E' },
  studentNm: { flex: 1, fontSize: 16, fontWeight: '500', color: '#1A1A2E' },
  dots: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },

  note: { padding: 14, borderRadius: 16, backgroundColor: '#F4F5F9', marginTop: 6 },
  noteTx: { fontSize: 14, fontWeight: '400', color: '#6E7596', lineHeight: 21 },

  footer: { paddingHorizontal: spacing.lg, paddingTop: 10, paddingBottom: 28, backgroundColor: colors.background },
  cancel: { paddingVertical: 15, borderRadius: 16, backgroundColor: '#FEF2F2', alignItems: 'center' },
  cancelTx: { fontSize: 15, fontWeight: '600', color: '#DC2626' },
});
