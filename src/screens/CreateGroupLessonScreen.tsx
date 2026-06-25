import React, { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SheetScaffold } from '../components/SheetScaffold';

import { groupLessonSheetStore } from '../stores/groupLessonSheetStore';
import { examStudentsStore, type ExamStudentOption } from '../stores/examStudentsStore';
import { optionsPickerStore } from '../stores/optionsPickerStore';
import { dayPickerStore } from '../stores/dayPickerStore';
import { timePickerStore } from '../stores/timePickerStore';
import { regloApi } from '../services/regloApi';
import { Button } from '../components/Button';
import { ToggleSwitch } from '../components/ToggleSwitch';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import type { AutoscuolaStudent, AutoscuolaVehicle, AutoscuolaInstructor } from '../types/regloApi';

const NAVY = '#1A1A2E';
const GREY = '#717171';
const MUTED = '#94A3B8';
const TEAL = '#0F766E';
const N50 = '#F4F5F9';
const N100 = '#E9EBF2';

const CAPACITY_OPTIONS = [
  { value: '3', label: '3 allievi' },
  { value: '4', label: '4 allievi' },
];
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
const initialsOf = (first: string, last: string) => {
  const f = (first ?? '').trim(); const l = (last ?? '').trim();
  if (f && l) return `${f[0]}${l[0]}`.toUpperCase();
  return (f || l || '?').slice(0, 2).toUpperCase();
};

// Exact license match, null-permissive on either side (mirrors backend vehicleServesLicense).
const vehicleServesStudent = (
  v: { licenseCategory?: string | null; transmission?: string | null } | null,
  st: { licenseCategory?: string | null; transmission?: string | null },
) => {
  if (!v || !v.licenseCategory || !v.transmission) return true;
  if (!st.licenseCategory || !st.transmission) return true;
  return v.licenseCategory === st.licenseCategory && v.transmission === st.transmission;
};

const Row = ({ icon, label, value, placeholder, onPress, disabled }: {
  icon: keyof typeof Ionicons.glyphMap; label: string;
  value?: string | null; placeholder?: string; onPress: () => void; disabled?: boolean;
}) => (
  <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [s.row, pressed && { opacity: 0.55 }]}>
    <View style={s.rowIcon}><Ionicons name={icon} size={22} color={NAVY} /></View>
    <View style={s.rowBody}>
      <Text style={s.rowLabel}>{label}</Text>
      {value ? <Text style={s.rowValue} numberOfLines={1}>{value}</Text> : <Text style={s.rowPlaceholder} numberOfLines={1}>{placeholder}</Text>}
    </View>
    <Ionicons name="chevron-forward" size={18} color="#C7CBD1" />
  </Pressable>
);

export const CreateGroupLessonScreen = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const data = useSyncExternalStore(groupLessonSheetStore.subscribe, groupLessonSheetStore.get);

  const [loading, setLoading] = useState(true);
  const [vehicles, setVehicles] = useState<AutoscuolaVehicle[]>([]);
  const [instructors, setInstructors] = useState<AutoscuolaInstructor[]>([]);
  const [students, setStudents] = useState<AutoscuolaStudent[]>([]);
  const [selfInstructorId, setSelfInstructorId] = useState<string | null>(null);

  const [startAt, setStartAt] = useState<Date>(() => (data ? new Date(data.initialDate) : new Date()));
  const [durationMin, setDurationMin] = useState<number>(180);
  const [capacity, setCapacity] = useState<number>(3);
  const [kind, setKind] = useState<'standard' | 'moto'>('standard');
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
        setSelfInstructorId(settings.instructorId ?? null);
        setInstructorId(settings.instructorId ?? null);
        setStudents((settings.students ?? []) as unknown as AutoscuolaStudent[]);
        setFollowCarRules(
          (settings as { followCarRules?: Record<string, { enabled: boolean }> }).followCarRules ?? {},
        );
      }
      const [allStudents, instr] = await Promise.all([
        regloApi.getStudents().catch(() => [] as AutoscuolaStudent[]),
        regloApi.getInstructors().catch(() => [] as AutoscuolaInstructor[]),
      ]);
      if (allStudents.length) setStudents(allStudents);
      setInstructors(instr);
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
  const MOTO_CATS = useMemo(() => new Set(['AM', 'A1', 'A2', 'A']), []);
  const motoVehicles = useMemo(() => vehicles.filter((v) => v.licenseCategory && MOTO_CATS.has(v.licenseCategory)), [vehicles, MOTO_CATS]);
  const carVehicles = useMemo(() => vehicles.filter((v) => v.licenseCategory === 'B'), [vehicles]);
  const fleet = useMemo(() => vehicles.filter((v) => fleetIds.includes(v.id)), [vehicles, fleetIds]);
  const followVehicle = useMemo(() => vehicles.find((v) => v.id === followVehicleId) ?? null, [vehicles, followVehicleId]);
  const followCarRequired = useMemo(
    () => isMoto && fleet.some((v) => followCarRules[v.licenseCategory ?? '']?.enabled === true),
    [isMoto, fleet, followCarRules],
  );
  // Moto: real cap = fleet size; standard: the chosen value.
  const effectiveCapacity = isMoto ? fleetIds.length : capacity;

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

  if (!data) return <View style={s.root} />;

  const openDatePicker = () => {
    dayPickerStore.set({
      selectedDate: toYMD(startAt), markedDates: new Set(), monthsBack: 0, monthsCount: 4,
      allowPast: false, title: 'Giorno della guida',
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
    router.push('/(tabs)/home/select-options');
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
    router.push('/(tabs)/home/select-options');
  };
  const openVehiclePicker = () => {
    optionsPickerStore.set({
      title: 'Veicolo', multi: false, selected: vehicleId ? [vehicleId] : [],
      options: vehicles.map((v) => ({ value: v.id, label: v.name, subtitle: [v.plate, v.licenseCategory].filter(Boolean).join(' · ') || null })),
      onConfirm: (vals) => { setVehicleId(vals[0] ?? null); setSelectedIds([]); },
    });
    router.push('/(tabs)/home/select-options');
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
    router.push('/(tabs)/home/select-options');
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
    router.push('/(tabs)/home/select-options');
  };
  const openInstructorPicker = () => {
    optionsPickerStore.set({
      title: 'Istruttore', multi: false, selected: instructorId ? [instructorId] : [],
      options: instructors.map((i) => ({ value: i.id, label: i.name, subtitle: i.id === selfInstructorId ? 'Tu' : null })),
      onConfirm: (vals) => setInstructorId(vals[0] ?? null),
    });
    router.push('/(tabs)/home/select-options');
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
  const instructorName = instructors.find((i) => i.id === instructorId)?.name ?? (instructorId === selfInstructorId ? 'Tu' : null);
  const studentsValue = selectedStudents.length === 0
    ? null
    : selectedStudents.length === 1
      ? `${selectedStudents[0].firstName} ${selectedStudents[0].lastName}`.trim()
      : `${selectedStudents.length}/${effectiveCapacity} allievi`;

  const fleetValue = fleet.length === 0 ? null : `${fleet.length} ${fleet.length === 1 ? 'moto' : 'moto'} · ${fleet.length} posti`;
  const canCreate = isMoto ? fleetIds.length > 0 && (!followCarRequired || !!followVehicleId) : !!vehicleId;

  const handleCreate = async () => {
    if (isMoto) {
      if (fleetIds.length === 0) { Alert.alert('Moto', 'Seleziona almeno una moto per la guida di gruppo.'); return; }
      if (followCarRequired && !followVehicleId) { Alert.alert('Auto al seguito', "Per queste moto è richiesta un'auto al seguito."); return; }
    } else if (!vehicleId) {
      Alert.alert('Veicolo', 'Seleziona il veicolo della guida di gruppo.'); return;
    }
    setSaving(true);
    try {
      const endsAt = new Date(startAt.getTime() + durationMin * 60 * 1000);
      const res = await regloApi.createGroupLesson({
        startsAt: startAt.toISOString(),
        endsAt: endsAt.toISOString(),
        instructorId: instructorId ?? undefined,
        ...(isMoto
          ? { kind: 'moto' as const, vehicleIds: fleetIds, followVehicleId: followVehicleId ?? undefined, capacity: effectiveCapacity }
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

  return (
    <View style={[s.root, { paddingBottom: insets.bottom + 14 }, Platform.OS === 'android' && { flex: 1 }]}>
      <View style={s.header}>
        <Text style={s.title}>Guida di gruppo</Text>
        <Pressable onPress={() => !saving && router.back()} hitSlop={10} disabled={saving} style={({ pressed }) => [s.close, pressed && { opacity: 0.5 }]}>
          <Ionicons name="close" size={20} color={NAVY} />
        </Pressable>
      </View>

      <SheetScaffold
        footer={loading ? null : (
          <View style={s.footer}>
            <View style={{ flex: 1, minWidth: 0, paddingRight: 14 }}>
              <Text style={s.sumKey}>Riepilogo</Text>
              <Text style={s.sumVal} numberOfLines={1}>{selectedStudents.length}/{effectiveCapacity} allievi · {durationLabel}</Text>
              <Text style={s.sumSub} numberOfLines={1}>{fmtDay(startAt)} · {fmtTime(startAt)}</Text>
            </View>
            <View style={{ flexShrink: 0 }}>
              <Button label="Crea" tone="primary" loading={saving} disabled={!canCreate} onPress={handleCreate} />
            </View>
          </View>
        )}
      >
      <Text style={s.lede}>1 istruttore · {isMoto ? `${effectiveCapacity || '—'} moto + auto al seguito` : '1 veicolo'} · fino a {effectiveCapacity || '—'} allievi</Text>

      {loading ? (
        <View style={s.loadingBox}><ActivityIndicator color={colors.primary} /></View>
      ) : (
        <>
          {/* Tipo: standard (1 veicolo) vs moto (flotta + auto al seguito) */}
          <View style={s.segment}>
            {(['standard', 'moto'] as const).map((k) => {
              const active = kind === k;
              return (
                <Pressable
                  key={k}
                  onPress={() => { setKind(k); setSelectedIds([]); }}
                  disabled={saving}
                  style={[s.segmentBtn, active && s.segmentBtnActive]}
                >
                  <Ionicons name={k === 'moto' ? 'bicycle-outline' : 'car-sport-outline'} size={16} color={active ? '#FFFFFF' : NAVY} />
                  <Text style={[s.segmentTxt, active && s.segmentTxtActive]}>{k === 'moto' ? 'Moto' : 'Standard'}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={s.group}>
            <Row icon="calendar-outline" label="Giorno" value={fmtDay(startAt)} onPress={openDatePicker} disabled={saving} />
            <View style={s.divider} />
            <Row icon="time-outline" label="Ora inizio" value={fmtTime(startAt)} onPress={openTimePicker} disabled={saving} />
            <View style={s.divider} />
            <Row icon="hourglass-outline" label="Durata" value={durationLabel} onPress={openDurationPicker} disabled={saving} />
            {!isMoto ? (
              <>
                <View style={s.divider} />
                <Row icon="people-outline" label="Capienza" value={`${capacity} allievi`} onPress={openCapacityPicker} disabled={saving} />
                <View style={s.divider} />
                <Row icon="car-outline" label="Veicolo" value={selectedVehicle ? `${selectedVehicle.name}${selectedVehicle.licenseCategory ? ` · ${selectedVehicle.licenseCategory}` : ''}` : null} placeholder="Seleziona veicolo" onPress={openVehiclePicker} disabled={saving} />
              </>
            ) : (
              <>
                <View style={s.divider} />
                <Row icon="bicycle-outline" label="Moto della guida" value={fleetValue} placeholder={motoVehicles.length ? 'Seleziona le moto' : 'Nessuna moto disponibile'} onPress={openFleetPicker} disabled={saving || motoVehicles.length === 0} />
                <View style={s.divider} />
                <Row icon="car-outline" label={`Auto al seguito${followCarRequired ? ' (richiesta)' : ''}`} value={followVehicle ? followVehicle.name : null} placeholder="Nessuna" onPress={openFollowCarPicker} disabled={saving} />
              </>
            )}
            <View style={s.divider} />
            <Row icon="person-outline" label="Istruttore" value={instructorName} placeholder="Seleziona istruttore" onPress={openInstructorPicker} disabled={saving} />
          </View>

          {isMoto ? (
            <Text style={s.hint}>Ogni allievo idoneo riceve automaticamente una moto della flotta. La capienza è pari al numero di moto scelte.</Text>
          ) : null}

          {/* Students pre-add */}
          <Pressable onPress={openStudentsPicker} disabled={saving || (isMoto ? fleetIds.length === 0 : !vehicleId)} style={({ pressed }) => [s.group, s.studentsRow, pressed && { opacity: 0.55 }, (isMoto ? fleetIds.length === 0 : !vehicleId) && { opacity: 0.5 }]}>
            <View style={s.rowIcon}><Ionicons name="people-outline" size={22} color={NAVY} /></View>
            <View style={s.rowBody}>
              <Text style={s.rowLabel}>Allievi (pre-inserisci)</Text>
              {studentsValue ? <Text style={s.rowValue} numberOfLines={1}>{studentsValue}</Text> : <Text style={s.rowPlaceholder} numberOfLines={1}>{(isMoto ? fleetIds.length > 0 : !!vehicleId) ? 'Seleziona allievi idonei' : isMoto ? 'Scegli prima le moto' : 'Scegli prima il veicolo'}</Text>}
            </View>
            {selectedStudents.length > 0 ? (
              <View style={s.avatarStack}>
                {selectedStudents.slice(0, 3).map((st, idx) => (
                  <View key={st.id} style={[s.stackAvatar, { marginLeft: idx === 0 ? 0 : -10, zIndex: 5 - idx }]}>
                    <Text style={s.stackAvatarTxt}>{initialsOf(st.firstName, st.lastName)}</Text>
                  </View>
                ))}
              </View>
            ) : null}
            <Ionicons name="chevron-forward" size={18} color="#C7CBD1" />
          </Pressable>

          {/* Open the remaining seats to invites */}
          <View style={s.optBanner}>
            <View style={s.optIcon}><Ionicons name="megaphone-outline" size={18} color={TEAL} /></View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.optTitle}>Apri i posti agli inviti</Text>
              <Text style={s.optSub}>Gli allievi idonei riceveranno una notifica</Text>
            </View>
            <ToggleSwitch value={openInvites} onValueChange={setOpenInvites} disabled={saving} />
          </View>
        </>
      )}
      </SheetScaffold>
    </View>
  );
};

const ELEV = { shadowColor: '#1A1A2E', shadowOpacity: 0.07, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 4 } as const;

const s = StyleSheet.create({
  root: { backgroundColor: colors.background, paddingHorizontal: spacing.lg, paddingTop: 8 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, paddingBottom: 4, gap: 12 },
  title: { flex: 1, fontSize: 24, fontWeight: '600', color: NAVY, letterSpacing: -0.5 },
  lede: { fontSize: 13, fontWeight: '500', color: MUTED, marginBottom: 14 },
  close: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#EFF0F3', alignItems: 'center', justifyContent: 'center' },
  loadingBox: { paddingVertical: 48, alignItems: 'center', justifyContent: 'center' },
  segment: { flexDirection: 'row', backgroundColor: N50, borderRadius: 14, padding: 4, gap: 4, marginBottom: 14 },
  segmentBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: 11 },
  segmentBtnActive: { backgroundColor: NAVY },
  segmentTxt: { fontSize: 14, fontWeight: '600', color: NAVY },
  segmentTxtActive: { color: '#FFFFFF' },
  hint: { fontSize: 12.5, color: MUTED, marginTop: -4, marginBottom: 14, paddingHorizontal: 4, lineHeight: 17 },
  group: { backgroundColor: '#FFFFFF', borderRadius: 20, paddingHorizontal: 16, marginBottom: 14, ...ELEV },
  studentsRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 15, minHeight: 64 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 15, minHeight: 64 },
  rowIcon: { width: 26, alignItems: 'center' },
  rowBody: { flex: 1, minWidth: 0, gap: 1 },
  rowLabel: { fontSize: 15, fontWeight: '600', color: NAVY },
  rowValue: { fontSize: 14, color: GREY },
  rowPlaceholder: { fontSize: 14, color: MUTED },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#EFF0F3' },
  avatarStack: { flexDirection: 'row', alignItems: 'center' },
  stackAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: N100, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFFFFF' },
  stackAvatarTxt: { fontSize: 11, fontWeight: '600', color: NAVY },
  optBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#ECFDF5', borderRadius: 16, paddingVertical: 11, paddingHorizontal: 14, marginBottom: 14 },
  optIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  optTitle: { fontSize: 14, fontWeight: '600', color: NAVY },
  optSub: { fontSize: 12.5, color: MUTED, marginTop: 1 },
  footer: { flexDirection: 'row', alignItems: 'center', marginTop: 4, marginHorizontal: -spacing.lg, paddingHorizontal: spacing.lg, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  sumKey: { fontSize: 12, color: MUTED, fontWeight: '500' },
  sumVal: { fontSize: 15, fontWeight: '600', color: NAVY, marginTop: 2 },
  sumSub: { fontSize: 13, fontWeight: '500', color: GREY, marginTop: 1 },
});
