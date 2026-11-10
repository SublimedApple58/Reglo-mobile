import React, { useEffect, useRef, useState } from 'react';
import { ActionSheetIOS, Alert, Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { examManageStore } from '../../../src/stores/examManageStore';
import { timePickerStore } from '../../../src/stores/timePickerStore';
import { examStudentsStore, type ExamStudentOption } from '../../../src/stores/examStudentsStore';
import { regloApi } from '../../../src/services/regloApi';
import { coInstructorPickerStore } from '../../../src/stores/coInstructorPickerStore';
import { examinersSheetStore } from '../../../src/stores/examinersSheetStore';
import { examNotesSheetStore } from '../../../src/stores/examNotesSheetStore';
import type { AutoscuolaAppointmentWithRelations } from '../../../src/types/regloApi';
import { asExamOutcome, askExamOutcome } from '../../../src/utils/examOutcome';
import { FormSheet } from '../../../src/components/SheetScaffold';
import { Avatar, ClayButton, ClayList, ClayListRow, ClaySection, Icon3D } from '../../../src/components/clay';
import { CLAY } from '../../../src/theme/clay';
import { MORALE_ART } from '../../../src/theme/moraleArt';
import { CLAY_EXAM } from '../../../src/theme/clay';
import { ROAD_EXAM_ART } from '../../../src/road/markerArt';
import { ExamCta } from '../../../src/components/road/ExamCta';
import { useRoadSelector } from '../../../src/road/roadStore';
import { enterRoadExam } from '../../../src/road/roadActions';

const WD = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];
const MO = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
const pad = (n: number) => String(n).padStart(2, '0');
const fmtDay = (iso: string) => { const d = new Date(iso); return `${WD[d.getDay()]} ${d.getDate()} ${MO[d.getMonth()]}`; };
const fmtTime = (iso: string) => { const d = new Date(iso); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
/** «a tutti e due», «a tutti e tre»…: in lettere fino a dieci. */
const COUNT_WORDS = ['', 'uno', 'due', 'tre', 'quattro', 'cinque', 'sei', 'sette', 'otto', 'nove', 'dieci'];
const countWord = (n: number) => COUNT_WORDS[n] ?? String(n);
// Studentless placeholder row for an exam created before its participants are
// known (backend keeps it so the empty slot survives). Never shown as a student.
const isExamPlaceholder = (a: AutoscuolaAppointmentWithRelations) =>
  (a.type ?? '').toLowerCase() === 'esame' && !a.studentId;
const studentName = (a: AutoscuolaAppointmentWithRelations) =>
  `${a.student?.firstName ?? ''} ${a.student?.lastName ?? ''}`.trim() || 'Allievo';

export default function ExamManageScreen() {
  const router = useRouter();
  const seed = useRef(examManageStore.get()).current;

  const [appts, setAppts] = useState<AutoscuolaAppointmentWithRelations[]>(seed?.appointments ?? []);
  const [startsAt, setStartsAt] = useState<string>(seed?.startsAt ?? '');
  const [endsAt, setEndsAt] = useState<string | null>(seed?.endsAt ?? null);
  const [busy, setBusy] = useState(false);
  // REG-585: gli accompagnatori in piu'. Stato locale perche' il foglio non
  // ricarica l'esame dal BE: dopo il salvataggio si aggiorna la riga qui.
  const [coInstructors, setCoInstructors] = useState<Array<{ id: string; name: string }>>(
    seed?.coInstructors ?? [],
  );

  // REG-640: note ed esaminatori, ora modificabili riaprendo l'esame. Stato
  // locale aggiornato a risposta del BE, come gli accompagnatori.
  const [notes, setNotes] = useState<string | null>(seed?.notes ?? null);
  const [examiners, setExaminers] = useState<string[]>(
    () => seed?.appointments.find((a) => a.examiners?.length)?.examiners ?? [],
  );

  useEffect(() => () => { examManageStore.clear(); }, []);

  if (!seed) return <View style={s.empty} />;

  const onChanged = seed.onChanged;
  const readOnly = seed.readOnly === true;
  const close = () => router.back();
  // Real participants (exclude the studentless empty-exam placeholder).
  const realAppts = appts.filter((a) => !isExamPlaceholder(a));
  // R4: Road Exam il giorno dell'esame, con Road acceso (il server controlla chi può).
  const roadEnabled = useRoadSelector((st) => st.roadEnabled);
  const roadExamToday =
    roadEnabled && !!startsAt && new Date(startsAt).toDateString() === new Date().toDateString() && appts.some((a) => !a.id.startsWith('pending-'));
  const [startingExam, setStartingExam] = useState(false);
  const startExamRoad = async () => {
    if (startingExam) return;
    setStartingExam(true);
    const ok = await enterRoadExam(appts.map((a) => a.id).filter((id) => !id.startsWith('pending-')));
    setStartingExam(false);
    if (ok) router.replace('/road');
  };
  const coNames = coInstructors.length ? coInstructors.map((c) => c.name).join(' + ') : null;

  /**
   * REG-585 — aggiungere o togliere un accompagnatore. Le righe di un esame
   * sono una per allievo, quindi si mandano tutte: il collegamento va scritto
   * su ognuna, se no il collega vedrebbe solo una parte dei candidati.
   */
  const openCoInstructorPicker = () => {
    const ids = realAppts.map((a) => a.id);
    if (!ids.length) return;
    coInstructorPickerStore.set({
      mainInstructorId: seed.instructorId ?? null,
      selectedIds: coInstructors.map((c) => c.id),
      subtitle: seed.instructorId
        ? 'Chi accompagna questo esame insieme al principale.'
        : 'Chi accompagna questo esame.',
      onToggle: async (nextIds) => {
        await regloApi.updateExamCoInstructors({ appointmentIds: ids, coInstructorIds: nextIds });
        const all = await regloApi.getInstructors().catch(() => []);
        setCoInstructors(
          nextIds.map((id) => ({ id, name: all.find((i) => i.id === id)?.name ?? 'Istruttore' })),
        );
        onChanged?.();
      },
    });
    router.push('/(tabs)/home/manage-co-instructors');
  };

  // Tutte le righe dell'esame, segnaposto compreso: note ed esaminatori
  // valgono per l'esame, anche quando non ha ancora allievi.
  const allIds = () => appts.map((a) => a.id).filter((id) => !id.startsWith('pending-'));

  const openExaminers = () => {
    examinersSheetStore.set({
      examiners,
      ctaTitle: 'Salva',
      onConfirm: async (names) => {
        await regloApi.updateExamDetails({ appointmentIds: allIds(), examiners: names });
        setExaminers(names);
        onChanged?.();
      },
    });
    router.push('/(tabs)/home/exam-examiners');
  };

  const openNotes = () => {
    examNotesSheetStore.set({
      notes: notes ?? '',
      onConfirm: async (next) => {
        await regloApi.updateExamDetails({ appointmentIds: allIds(), notes: next });
        setNotes(next);
        onChanged?.();
      },
    });
    router.push('/(tabs)/home/exam-notes');
  };

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

  /**
   * Esito esame dall'app (REG-513).
   *
   * L'istruttore accompagna l'esame e l'esito lo conosce per primo: qui segna
   * solo idoneo o respinto. Il **numero di patente** non si chiede — arriva
   * quasi sempre giorni dopo, e lo inserisce dal web chi ha la tastiera
   * davanti. Ometterlo non cancella quello eventualmente già registrato.
   *
   * Un idoneo porta l'allievo a PATENTATO lato server: da quel momento non
   * compare più nel picker "Seleziona allievo" della prenotazione, che mostra
   * solo la fase PRATICA (REG-499). È reversibile dal web.
   */
  const doOutcome = async (
    a: AutoscuolaAppointmentWithRelations,
    outcome: 'idoneo' | 'respinto' | null,
  ) => {
    if (a.id.startsWith('pending-')) return;
    setBusy(true);
    try {
      const res = await regloApi.setExamOutcome(a.id, outcome);
      setAppts((p) => p.map((x) => (x.id === a.id ? { ...x, examOutcome: outcome } : x)));
      onChanged();
      if (outcome === 'idoneo' && res?.data?.promoted) {
        Alert.alert('Esame superato', `${studentName(a)} è ora patentato.`);
      }
    } catch (err) {
      Alert.alert('Errore', err instanceof Error ? err.message : 'Impossibile registrare l’esito.');
    } finally {
      setBusy(false);
    }
  };

  const askOutcome = (a: AutoscuolaAppointmentWithRelations) =>
    askExamOutcome({
      title: studentName(a),
      current: asExamOutcome(a.examOutcome),
      onPick: (outcome) => void doOutcome(a, outcome),
    });

  const onStudentMenu = (a: AutoscuolaAppointmentWithRelations) => {
    // L'ultimo iscritto non si può rimuovere (si annulla l'esame), ma il menu
    // deve aprirsi lo stesso: un esame con un solo allievo è il caso normale,
    // ed è proprio lì che serve registrare l'esito.
    const canRemove = realAppts.length > 1;
    const confirmRemove = () =>
      Alert.alert('Rimuovi allievo', `Rimuovere ${studentName(a)} dall’esame?`, [
        { text: 'Annulla', style: 'cancel' },
        { text: 'Rimuovi', style: 'destructive', onPress: () => doRemove(a) },
      ]);
    const options = [
      'Registra esito',
      'Apri scheda allievo',
      ...(canRemove ? ['Rimuovi dall’esame'] : []),
      'Annulla',
    ];
    const pick = (i: number) => {
      if (i === 0) askOutcome(a);
      else if (i === 1) openStudent(a);
      else if (canRemove && i === 2) confirmRemove();
    };
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: studentName(a),
          options,
          destructiveButtonIndex: canRemove ? 2 : undefined,
          cancelButtonIndex: options.length - 1,
        },
        pick,
      );
    } else {
      Alert.alert(studentName(a), undefined, [
        { text: 'Registra esito', onPress: () => pick(0) },
        { text: 'Apri scheda allievo', onPress: () => pick(1) },
        ...(canRemove
          ? [{ text: 'Rimuovi dall’esame', style: 'destructive' as const, onPress: () => pick(2) }]
          : []),
        { text: 'Annulla', style: 'cancel' as const },
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
            return { value: st.id, label: `${st.firstName ?? ''} ${st.lastName ?? ''}`.trim(), subtitle, isMyCluster, license: st.licenseCategory ?? null, examReady: st.examReady ?? false };
          });
      } else {
        const res = await regloApi.getStudents();
        options = res
          .map((st: Record<string, unknown>) => ({ value: st.id as string, label: `${(st.firstName ?? st.name ?? '') as string} ${(st.lastName ?? '') as string}`.trim(), subtitle: null, isMyCluster: false, license: (st.licenseCategory as string | null | undefined) ?? null, examReady: (st.examReady as boolean | undefined) ?? false }))
          .filter((o) => !currentIds.has(o.value));
      }
      // Come nel picker di creazione: i "pronti" salgono in cima al picker.
      options.sort((a, b) => Number(Boolean(b.examReady)) - Number(Boolean(a.examReady)));
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
        notes: notes ?? undefined,
        examiners,
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
      // Drop the empty-exam placeholder locally: the backend just converted it
      // into the first added student, so the open sheet must not keep showing it.
      setAppts((p) => [...p.filter((a) => !isExamPlaceholder(a)), ...added]);
    } catch (err) {
      Alert.alert('Errore', err instanceof Error ? err.message : 'Impossibile aggiungere gli allievi.');
    }
  };

  const timeLabel = endsAt ? `${fmtTime(startsAt)} – ${fmtTime(endsAt)}` : 'Orario da definire';

  // REG-639 clay: il form sheet unico. Testata con l'icona 3D «esame» (l'unica
  // 3D del foglio), dettagli e allievi in liste clay su bianco, esito scritto
  // nel sottotitolo della riga (niente pillole colorate), «Annulla esame» come
  // CTA secondaria in fondo.
  return (
    <FormSheet
      title="Esame di guida"
      subtitle={startsAt ? `${fmtDay(startsAt)} · ${timeLabel}` : timeLabel}
      leading={<Icon3D source={MORALE_ART.esame} size={44} />}
      onClose={close}
      testID="exam-manage-sheet"
      cta={
        !readOnly ? (
          <ClayButton
            title="Annulla esame"
            variant="secondary"
            onPress={cancelExam}
            disabled={busy}
            testID="exam-manage-cancel"
          />
        ) : null
      }
    >
      {/* R4 Road Exam (anteprima approvata da Tiziano il 10/11/2026): il giorno
          dell'esame un piccolo hero viola chiaro con il diorama 3D e il saluto;
          un tocco registra il percorso (solo il tracciato). */}
      {roadExamToday ? (
        <View style={[s.hero, CLAY_EXAM.surface]} testID="exam-road-hero">
          <Image source={ROAD_EXAM_ART.hero} style={s.heroImg} resizeMode="contain" />
          <View style={s.heroText}>
            <Text style={s.heroTitle}>Registra il percorso dell'esame</Text>
            {realAppts.length > 0 ? (
              <Text style={s.heroSub}>
                {realAppts.length === 1 ? 'In bocca al lupo.' : `In bocca al lupo a tutti e ${countWord(realAppts.length)}.`}
              </Text>
            ) : null}
          </View>
          <ExamCta title="Avvia Road Exam" height={50} loading={startingExam} onPress={() => void startExamRoad()} style={s.heroCta} testID="exam-road-start" />
        </View>
      ) : null}

      {/* Orario e istruttori. La riga «Accompagnatore» c'e' SEMPRE: un esame
          puo' nascere senza principale e prima, in quel caso, spariva TUTTO il
          blocco — accompagnatori compresi (Tiziano, 2026-10-02). */}
      <ClayList>
        {readOnly ? (
          <ClayListRow title="Orario" subtitle={timeLabel} />
        ) : (
          <ClayListRow
            title={endsAt ? 'Modifica orario' : 'Imposta orario'}
            subtitle={timeLabel}
            onPress={() => { if (!busy) openTimePicker(); }}
            testID="exam-manage-time"
          />
        )}
        <ClayListRow title="Accompagnatore" subtitle={seed.instructorName ?? 'Non assegnato'} />
        {/* REG-585: gli accompagnatori in piu', gestibili anche dal telefono.
            In sola lettura (titolare) la riga compare solo se ce ne sono. */}
        {readOnly ? (
          coNames ? <ClayListRow title="Altri accompagnatori" subtitle={coNames} /> : null
        ) : (
          <ClayListRow
            title="Altri accompagnatori"
            subtitle={coNames ?? 'Nessuno — tocca per aggiungere un collega'}
            onPress={openCoInstructorPicker}
            testID="exam-manage-co-instructors"
          />
        )}
        {/* REG-640: esaminatori esterni, prima degli allievi. */}
        {readOnly ? (
          examiners.length ? <ClayListRow title="Esaminatori" subtitle={examiners.join(', ')} /> : null
        ) : (
          <ClayListRow
            title="Esaminatori"
            subtitle={examiners.length ? examiners.join(', ') : 'Nessuno — tocca per aggiungere'}
            onPress={() => { if (!busy) openExaminers(); }}
            testID="exam-manage-examiners"
          />
        )}
      </ClayList>

      {/* Allievi: tocco = scheda allievo, ••• = menu (esito, rimuovi). */}
      <ClaySection
        title={`Allievi · ${realAppts.length}`}
        // REG-639 «vita»: due parole gentili prima dell'esame.
        footnote={
          !readOnly && !roadExamToday && realAppts.length > 0
            ? realAppts.length === 1 ? 'In bocca al lupo.' : `In bocca al lupo a tutti e ${countWord(realAppts.length)}.`
            : undefined
        }
        action={
          !readOnly ? (
            <Pressable
              onPress={openAddStudents}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Aggiungi allievi"
              testID="exam-manage-add-students"
              style={({ pressed }) => pressed && { opacity: 0.55 }}
            >
              <Text style={s.action}>Aggiungi</Text>
            </Pressable>
          ) : undefined
        }
      >
        {realAppts.length === 0 ? (
          <Text style={s.emptyStudents}>
            {readOnly ? 'Nessun allievo iscritto.' : 'Nessun allievo. Tocca «Aggiungi» per iscriverli.'}
          </Text>
        ) : (
          <ClayList>
            {realAppts.map((a) => (
              <ClayListRow
                key={a.id}
                leading={<Avatar userId={a.student?.id ?? a.studentId} name={studentName(a)} size={42} />}
                title={studentName(a)}
                subtitle={a.examOutcome === 'idoneo' ? 'Idoneo' : a.examOutcome === 'respinto' ? 'Respinto' : undefined}
                onPress={() => openStudent(a)}
                chevron={readOnly}
                trailing={
                  readOnly ? undefined : (
                    <Pressable
                      onPress={() => onStudentMenu(a)}
                      hitSlop={10}
                      style={s.dots}
                      accessibilityRole="button"
                      accessibilityLabel={`Altre azioni per ${studentName(a)}`}
                    >
                      <Ionicons name="ellipsis-horizontal" size={20} color={CLAY.ink3} />
                    </Pressable>
                  )
                }
              />
            ))}
          </ClayList>
        )}
      </ClaySection>

      {/* REG-640: le note si modificano dal foglio dedicato (prima solo lettura). */}
      {readOnly ? (
        notes ? (
          <ClaySection title="Note">
            <Text style={s.noteTx}>{notes}</Text>
          </ClaySection>
        ) : null
      ) : (
        <ClaySection
          title="Note"
          action={
            <Pressable
              onPress={() => { if (!busy) openNotes(); }}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={notes ? 'Modifica note' : 'Aggiungi note'}
              testID="exam-manage-notes"
              style={({ pressed }) => pressed && { opacity: 0.55 }}
            >
              <Text style={s.action}>{notes ? 'Modifica' : 'Aggiungi'}</Text>
            </Pressable>
          }
        >
          <Text style={notes ? s.noteTx : s.emptyStudents}>{notes ?? 'Nessuna nota.'}</Text>
        </ClaySection>
      )}
    </FormSheet>
  );
}

const s = StyleSheet.create({
  empty: { backgroundColor: '#FFFFFF', height: 1 },
  action: { fontSize: 15, fontWeight: '600', color: CLAY.ink },
  emptyStudents: { fontSize: 15, lineHeight: 21, color: CLAY.ink3, paddingHorizontal: 2 },
  dots: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  noteTx: { fontSize: 15, lineHeight: 21, color: CLAY.ink2, paddingHorizontal: 2 },
  hero: { borderRadius: 24, padding: 16, marginBottom: 14, overflow: 'hidden' },
  heroImg: { position: 'absolute', right: 6, top: 2, width: 118, height: 118 },
  heroText: { paddingRight: 118, minHeight: 92 },
  heroTitle: { fontSize: 19, fontWeight: '600', letterSpacing: -0.45, lineHeight: 23, color: CLAY_EXAM.ink },
  heroSub: { fontSize: 14, lineHeight: 19, color: CLAY_EXAM.ink2, marginTop: 6 },
  heroCta: { marginTop: 14 },
});
