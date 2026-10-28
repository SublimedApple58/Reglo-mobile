import React, { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { groupLessonSheetStore } from '../stores/groupLessonSheetStore';
import { examStudentsStore, type ExamStudentOption } from '../stores/examStudentsStore';
import { optionsPickerPath, optionsPickerStore } from '../stores/optionsPickerStore';
import { dayPickerStore } from '../stores/dayPickerStore';
import { timePickerStore } from '../stores/timePickerStore';
import { regloApi } from '../services/regloApi';
import { FormSheet } from '../components/SheetScaffold';
import { ClayButton, ClayList, ClayListRow, ClaySegmented, ClayToggle } from '../components/clay';
import { CLAY } from '../theme/clay';
import { vehicleServesStudent as vehicleServesStudentShared, MOTO_LICENSE_CATEGORIES } from '../utils/license';
import { instructorCanUseVehicle } from '../utils/vehicles';
import { MOTO_LESSON_TYPES, MOTO_LESSON_TYPE_LABELS, MOTO_LESSON_TYPE_HINTS, type MotoLessonType } from '../utils/motoLessonType';
import type { AutoscuolaStudent, AutoscuolaVehicle } from '../types/regloApi';

// Capienza libera (1–12): la decidono titolare/istruttore. Per le guide moto i
// partecipanti possono superare le moto in flotta (si va a rotazione).
const CAPACITY_OPTIONS = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1),
  label: `${i + 1} ${i === 0 ? 'allievo' : 'allievi'}`,
}));
const DURATIONS = [
  { value: '60', label: '1 ora' },
  { value: '120', label: '2 ore' },
  { value: '180', label: '3 ore' },
  { value: '240', label: '4 ore' },
];

const pad2 = (n: number) => String(n).padStart(2, '0');
const toYMD = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const fromYMD = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const fmtDay = (d: Date) => d.toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
const fmtTime = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

// License eligibility with the moto hierarchy (shared helper), null vehicle = permissive.
const vehicleServesStudent = (
  v: { licenseCategory?: string | null; transmission?: string | null } | null,
  st: { licenseCategory?: string | null; transmission?: string | null },
) => (v ? vehicleServesStudentShared(v, st) : true);

export const CreateGroupLessonScreen = () => {
  const router = useRouter();
  const data = useSyncExternalStore(groupLessonSheetStore.subscribe, groupLessonSheetStore.get);

  const [loading, setLoading] = useState(true);
  const [vehicles, setVehicles] = useState<AutoscuolaVehicle[]>([]);
  const [students, setStudents] = useState<AutoscuolaStudent[]>([]);

  const [startAt, setStartAt] = useState<Date>(() => (data ? new Date(data.initialDate) : new Date()));
  const [durationMin, setDurationMin] = useState<number>(180);
  const [capacity, setCapacity] = useState<number>(3);
  const [kind, setKind] = useState<'standard' | 'moto'>('standard');
  // Tipo guida moto (birilli/strada), condiviso da tutta la guida — facoltativo.
  const [motoLessonType, setMotoLessonType] = useState<MotoLessonType | null>(null);
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  // Moto group: the chosen fleet of motos + one shared follow car.
  const [fleetIds, setFleetIds] = useState<string[]>([]);
  const [followVehicleId, setFollowVehicleId] = useState<string | null>(null);
  const [followCarRules, setFollowCarRules] = useState<Record<string, { enabled: boolean }>>({});
  const [instructorId, setInstructorId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [openInvites, setOpenInvites] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [veh, settings] = await Promise.all([
        regloApi.getVehicles().catch(() => [] as AutoscuolaVehicle[]),
        regloApi.getInstructorSettings().catch(() => null),
      ]);
      setVehicles(veh.filter((v) => v.status === 'active'));
      if (settings) {
        // This sheet is opened from the instructor home → the group lesson is
        // always for the creating instructor (no instructor picker).
        setInstructorId(settings.instructorId ?? null);
        setStudents((settings.students ?? []) as unknown as AutoscuolaStudent[]);
        setFollowCarRules(
          (settings as { followCarRules?: Record<string, { enabled: boolean }> }).followCarRules ?? {},
        );
      }
      const allStudents = await regloApi.getStudents().catch(() => [] as AutoscuolaStudent[]);
      if (allStudents.length) setStudents(allStudents);
    } catch {
      Alert.alert('Errore', 'Errore nel caricamento dati.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!data) return;
    setStartAt(new Date(data.initialDate));
    setSelectedIds([]); setOpenInvites(true); setSaving(false);
  }, [data]);

  const selectedVehicle = useMemo(() => vehicles.find((v) => v.id === vehicleId) ?? null, [vehicles, vehicleId]);

  const isMoto = kind === 'moto';
  const MOTO_CATS = useMemo(() => new Set<string>(MOTO_LICENSE_CATEGORIES), []);
  // Only the instructor's accessible vehicles are pickable (fleet, follow car,
  // and the standard vehicle). Vehicles exclusive to others are not shown.
  const accessibleVehicles = useMemo(
    () => (instructorId ? vehicles.filter((v) => instructorCanUseVehicle(v, instructorId)) : vehicles),
    [vehicles, instructorId],
  );
  const motoVehicles = useMemo(() => accessibleVehicles.filter((v) => v.licenseCategory && MOTO_CATS.has(v.licenseCategory)), [accessibleVehicles, MOTO_CATS]);
  // Standard group = one shared CAR: motos only belong to the moto flow.
  const standardVehicles = useMemo(() => accessibleVehicles.filter((v) => !v.licenseCategory || !MOTO_CATS.has(v.licenseCategory)), [accessibleVehicles, MOTO_CATS]);
  const carVehicles = useMemo(() => accessibleVehicles.filter((v) => v.licenseCategory === 'B'), [accessibleVehicles]);
  const fleet = useMemo(() => vehicles.filter((v) => fleetIds.includes(v.id)), [vehicles, fleetIds]);
  const followVehicle = useMemo(() => vehicles.find((v) => v.id === followVehicleId) ?? null, [vehicles, followVehicleId]);
  const followCarRequired = useMemo(
    () => isMoto && fleet.some((v) => followCarRules[v.licenseCategory ?? '']?.enabled === true),
    [isMoto, fleet, followCarRules],
  );
  // Capienza scelta liberamente per entrambi i tipi (moto: può superare la
  // flotta, i ragazzi si alternano sulle moto disponibili).
  const effectiveCapacity = capacity;

  // Eligible to PRE-ADD: opted-in + license-compatible. Standard = the single
  // vehicle; moto = any moto still in the chosen fleet.
  const eligibleStudents = useMemo(
    () =>
      students.filter((st) => {
        if (!(st.groupLessonsOptIn ?? false)) return false;
        if (isMoto) return fleet.length > 0 && fleet.some((v) => vehicleServesStudent(v, st));
        return vehicleServesStudent(selectedVehicle, st);
      }),
    [students, selectedVehicle, isMoto, fleet],
  );
  const selectedStudents = useMemo(
    () => eligibleStudents.filter((st) => selectedIds.includes(st.id)),
    [eligibleStudents, selectedIds],
  );

  if (!data) return <View style={s.empty} />;

  const openDatePicker = () => {
    dayPickerStore.set({
      selectedDate: toYMD(startAt), markedDates: new Set(), monthsBack: 3, monthsCount: 4,
      allowPast: true, title: 'Giorno della guida',
      onSelect: (ymd) => {
        const picked = fromYMD(ymd);
        setStartAt((prev) => { const n = new Date(prev); n.setFullYear(picked.getFullYear(), picked.getMonth(), picked.getDate()); return n; });
      },
    });
    router.push('/(tabs)/home/select-date');
  };
  const openTimePicker = () => {
    timePickerStore.set({
      selectedTime: startAt,
      onConfirm: (d) => setStartAt((prev) => { const n = new Date(prev); n.setHours(d.getHours(), d.getMinutes(), 0, 0); return n; }),
    });
    router.push('/(tabs)/home/time-picker');
  };
  const openDurationPicker = () => {
    optionsPickerStore.set({
      title: 'Durata', multi: false, selected: [String(durationMin)], options: DURATIONS,
      onConfirm: (vals) => { if (vals[0]) setDurationMin(Number(vals[0])); },
    });
    router.push(optionsPickerPath());
  };
  const openCapacityPicker = () => {
    optionsPickerStore.set({
      title: 'Capienza', multi: false, selected: [String(capacity)], options: CAPACITY_OPTIONS,
      onConfirm: (vals) => {
        if (!vals[0]) return;
        const cap = Number(vals[0]);
        setCapacity(cap);
        // Lowering 4 → 3 with 4 pre-selected students: trim the list.
        setSelectedIds((prev) => prev.slice(0, cap));
      },
    });
    router.push(optionsPickerPath());
  };
  const openVehiclePicker = () => {
    optionsPickerStore.set({
      title: 'Veicolo', multi: false, selected: vehicleId ? [vehicleId] : [],
      options: standardVehicles.map((v) => ({ value: v.id, label: v.name, subtitle: [v.plate, v.licenseCategory].filter(Boolean).join(' · ') || null })),
      onConfirm: (vals) => { setVehicleId(vals[0] ?? null); setSelectedIds([]); },
    });
    router.push(optionsPickerPath());
  };
  const openFleetPicker = () => {
    optionsPickerStore.set({
      title: 'Moto della guida', multi: true, selected: fleetIds,
      options: motoVehicles.map((v) => ({ value: v.id, label: v.name, subtitle: [v.plate, v.licenseCategory].filter(Boolean).join(' · ') || null })),
      onConfirm: (vals) => {
        setFleetIds(vals);
        // Trim pre-selected students beyond the new fleet size.
        setSelectedIds((prev) => prev.slice(0, vals.length));
      },
    });
    router.push(optionsPickerPath());
  };
  const openFollowCarPicker = () => {
    optionsPickerStore.set({
      title: 'Auto al seguito', multi: false, selected: followVehicleId ? [followVehicleId] : ['__none__'],
      options: [
        { value: '__none__', label: 'Nessuna', subtitle: null },
        ...carVehicles.map((v) => ({ value: v.id, label: v.name, subtitle: [v.plate, v.licenseCategory].filter(Boolean).join(' · ') || null })),
      ],
      onConfirm: (vals) => setFollowVehicleId(vals[0] && vals[0] !== '__none__' ? vals[0] : null),
    });
    router.push(optionsPickerPath());
  };
  const openMotoLessonType = () => {
    optionsPickerStore.set({
      title: 'Tipo guida moto', multi: false, selected: motoLessonType ? [motoLessonType] : [],
      options: [
        { value: '__none__', label: 'Non specificato', subtitle: null },
        ...MOTO_LESSON_TYPES.map((t) => ({ value: t, label: MOTO_LESSON_TYPE_LABELS[t], subtitle: MOTO_LESSON_TYPE_HINTS[t] })),
      ],
      onConfirm: (v) => {
        const picked = v[0];
        setMotoLessonType(picked === 'birilli' || picked === 'strada' ? picked : null);
      },
    });
    router.push(optionsPickerPath());
  };
  const openStudentsPicker = () => {
    const options: ExamStudentOption[] = eligibleStudents.map((st) => ({
      value: st.id, label: `${st.firstName} ${st.lastName}`.trim(),
      subtitle: [st.licenseCategory, st.transmission].filter(Boolean).join(' · ') || null,
      isMyCluster: false,
    }));
    examStudentsStore.set({
      selectedIds,
      options,
      onConfirm: (ids) => setSelectedIds(ids.slice(0, effectiveCapacity)),
    });
    router.push('/(tabs)/home/select-exam-students');
  };

  const durationLabel = DURATIONS.find((d) => d.value === String(durationMin))?.label ?? `${durationMin} min`;
  const studentsValue = selectedStudents.length === 0
    ? null
    : selectedStudents.length === 1
      ? `${selectedStudents[0].firstName} ${selectedStudents[0].lastName}`.trim()
      : `${selectedStudents.length}/${effectiveCapacity} allievi`;

  const fleetValue = fleet.length === 0 ? null : `${fleet.length} moto`;
  const motoLessonTypeValue = motoLessonType ? MOTO_LESSON_TYPE_LABELS[motoLessonType] : null;
  // L'auto al seguito è sempre facoltativa alla creazione: se le regole la
  // richiedono, il BE ne assegna una libera alla prima iscrizione.
  const canCreate = isMoto ? fleetIds.length > 0 : !!vehicleId;
  const guard = (fn: () => void) => () => { if (!saving) fn(); };

  const handleCreate = async (opts?: { confirmedPast?: boolean }) => {
    // Una guida di gruppo senza istruttore non deve esistere (regola BE).
    if (!instructorId) {
      Alert.alert('Istruttore', 'La guida di gruppo deve avere un istruttore assegnato.');
      return;
    }
    if (isMoto) {
      if (fleetIds.length === 0) { Alert.alert('Moto', 'Seleziona almeno una moto per la guida di gruppo.'); return; }
    } else if (!vehicleId) {
      Alert.alert('Veicolo', 'Seleziona il veicolo della guida di gruppo.'); return;
    }
    // Guida nel passato: consentita con conferma esplicita (il BE non blocca).
    if (!opts?.confirmedPast && startAt.getTime() < Date.now()) {
      Alert.alert(
        'Guida nel passato',
        `La guida del ${startAt.toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: 'short' })} alle ${fmtTime(startAt)} è già passata. Vuoi crearla comunque?`,
        [
          { text: 'Annulla', style: 'cancel' },
          { text: 'Crea comunque', onPress: () => { void handleCreate({ confirmedPast: true }); } },
        ],
      );
      return;
    }
    setSaving(true);
    try {
      const endsAt = new Date(startAt.getTime() + durationMin * 60 * 1000);
      const res = await regloApi.createGroupLesson({
        startsAt: startAt.toISOString(),
        endsAt: endsAt.toISOString(),
        instructorId: instructorId ?? undefined,
        ...(isMoto
          ? { kind: 'moto' as const, vehicleIds: fleetIds, followVehicleId: followVehicleId ?? undefined, motoLessonType, capacity: effectiveCapacity }
          : { vehicleId, capacity }),
        studentIds: selectedIds,
      });
      // Optionally broadcast an invite for the remaining seats.
      if (openInvites && res.participants < effectiveCapacity) {
        await regloApi.inviteToGroupLesson(res.groupLessonId).catch(() => null);
      }
      await data.onApplied();
      data.onDone('Guida di gruppo creata.');
      router.back();
    } catch (err) {
      Alert.alert('Errore', err instanceof Error ? err.message : 'Errore nella creazione.');
      setSaving(false);
    }
  };

  const studentsLocked = isMoto ? fleetIds.length === 0 : !vehicleId;

  // REG-639 clay: il form sheet unico. Tipo = segmentato clay, righe di solo
  // testo in liste clay (niente icone), inviti come interruttore, CTA nera in
  // fondo. La riga di contesto (istruttore · veicolo · posti) è il sottotitolo.
  return (
    <FormSheet
      title="Guida di gruppo"
      subtitle={`1 istruttore · ${isMoto ? `${effectiveCapacity || '—'} moto + auto al seguito` : '1 veicolo'} · fino a ${effectiveCapacity || '—'} allievi`}
      onClose={() => { if (!saving) router.back(); }}
      testID="create-group-lesson-sheet"
      cta={loading ? null : (
        <ClayButton
          title="Crea"
          loading={saving}
          disabled={!canCreate}
          onPress={() => handleCreate()}
          testID="create-group-lesson-submit"
        />
      )}
    >
      {loading ? (
        <View style={s.loadingBox}><ActivityIndicator color={CLAY.ink} /></View>
      ) : (
        <>
          {/* Tipo: standard (1 veicolo) vs moto (flotta + auto al seguito). */}
          <View pointerEvents={saving ? 'none' : 'auto'}>
            <ClaySegmented
              options={[
                { value: 'standard' as const, label: 'Standard' },
                { value: 'moto' as const, label: 'Moto' },
              ]}
              value={kind}
              onChange={(k) => { setKind(k); setSelectedIds([]); if (k !== 'moto') setMotoLessonType(null); }}
              testID="create-group-lesson-kind"
            />
          </View>

          <ClayList style={s.gap}>
            <ClayListRow title="Giorno" subtitle={fmtDay(startAt)} onPress={guard(openDatePicker)} />
            <ClayListRow title="Ora inizio" subtitle={fmtTime(startAt)} onPress={guard(openTimePicker)} />
            <ClayListRow title="Durata" subtitle={durationLabel} onPress={guard(openDurationPicker)} />
            <ClayListRow title="Capienza" subtitle={`${capacity} allievi`} onPress={guard(openCapacityPicker)} />
            {!isMoto ? (
              <ClayListRow
                title="Veicolo"
                subtitle={selectedVehicle ? `${selectedVehicle.name}${selectedVehicle.licenseCategory ? ` · ${selectedVehicle.licenseCategory}` : ''}` : 'Seleziona veicolo'}
                onPress={guard(openVehiclePicker)}
              />
            ) : null}
            {isMoto ? (
              <ClayListRow
                title="Moto della guida"
                subtitle={fleetValue ?? (motoVehicles.length ? 'Seleziona le moto' : 'Nessuna moto disponibile')}
                onPress={guard(openFleetPicker)}
                dimmed={motoVehicles.length === 0}
              />
            ) : null}
            {isMoto ? (
              <ClayListRow
                title="Auto al seguito (facoltativa)"
                subtitle={followVehicle ? followVehicle.name : followCarRequired ? 'Automatica alla 1ª iscrizione' : 'Nessuna'}
                onPress={guard(openFollowCarPicker)}
              />
            ) : null}
            {isMoto ? (
              <ClayListRow
                title="Tipo guida moto"
                subtitle={motoLessonTypeValue ?? 'Non specificato'}
                onPress={guard(openMotoLessonType)}
              />
            ) : null}
          </ClayList>

          {isMoto ? (
            <Text style={s.hint}>Chi si iscrive riceve automaticamente una moto libera della flotta compatibile col suo percorso; se gli allievi superano le moto, si va a rotazione.</Text>
          ) : null}

          {/* Allievi pre-inseriti + posti aperti agli inviti */}
          <ClayList style={s.gap}>
            <ClayListRow
              title="Allievi (pre-inserisci)"
              subtitle={studentsValue ?? (!studentsLocked ? 'Seleziona allievi idonei' : isMoto ? 'Scegli prima le moto' : 'Scegli prima il veicolo')}
              onPress={guard(openStudentsPicker)}
              dimmed={studentsLocked}
              testID="create-group-lesson-students"
            />
            <ClayListRow
              title="Apri i posti agli inviti"
              subtitle="Gli allievi idonei riceveranno una notifica"
              trailing={
                <ClayToggle
                  value={openInvites}
                  onValueChange={setOpenInvites}
                  disabled={saving}
                  accessibilityLabel="Apri i posti agli inviti"
                />
              }
            />
          </ClayList>
        </>
      )}
    </FormSheet>
  );
};

const s = StyleSheet.create({
  empty: { backgroundColor: '#FFFFFF', height: 1 },
  loadingBox: { paddingVertical: 48, alignItems: 'center', justifyContent: 'center' },
  gap: { marginTop: 14 },
  hint: { fontSize: 13, lineHeight: 18, color: CLAY.ink3, marginTop: 10, paddingHorizontal: 4 },
});
