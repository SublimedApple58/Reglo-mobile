import React, { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { groupLessonSheetStore } from '../stores/groupLessonSheetStore';
import { examStudentsStore, type ExamStudentOption } from '../stores/examStudentsStore';
import { optionsPickerPath, optionsPickerStore } from '../stores/optionsPickerStore';
import { dayPickerStore } from '../stores/dayPickerStore';
import { timePickerStore } from '../stores/timePickerStore';
import { regloApi } from '../services/regloApi';
import { Button } from '../components/Button';
import { ToggleSwitch } from '../components/ToggleSwitch';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { vehicleServesStudent as vehicleServesStudentShared, MOTO_LICENSE_CATEGORIES } from '../utils/license';
import { instructorCanUseVehicle } from '../utils/vehicles';
import type { AutoscuolaStudent, AutoscuolaVehicle } from '../types/regloApi';

const NAVY = '#1A1A2E';
const GREY = '#717171';
const MUTED = '#94A3B8';
const TEAL = '#0F766E';
const N50 = '#F4F5F9';
const N100 = '#E9EBF2';

const SEG_PAD = 5;

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
const initialsOf = (first: string, last: string) => {
  const f = (first ?? '').trim(); const l = (last ?? '').trim();
  if (f && l) return `${f[0]}${l[0]}`.toUpperCase();
  return (f || l || '?').slice(0, 2).toUpperCase();
};

// License eligibility with the moto hierarchy (shared helper), null vehicle = permissive.
const vehicleServesStudent = (
  v: { licenseCategory?: string | null; transmission?: string | null } | null,
  st: { licenseCategory?: string | null; transmission?: string | null },
) => (v ? vehicleServesStudentShared(v, st) : true);

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
  const [students, setStudents] = useState<AutoscuolaStudent[]>([]);

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

  // Airbnb segmented — sliding white pill (same logic as quick-book.tsx).
  const [segW, setSegW] = useState(0);
  const pillW = segW ? (segW - SEG_PAD * 2) / 2 : 0;
  const pillX = useSharedValue(0);
  useEffect(() => {
    if (!pillW) return;
    pillX.value = withTiming((isMoto ? 1 : 0) * pillW, { duration: 220 });
  }, [isMoto, pillW, pillX]);
  const pillStyle = useAnimatedStyle(() => ({ transform: [{ translateX: pillX.value }] }));

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
      options: accessibleVehicles.map((v) => ({ value: v.id, label: v.name, subtitle: [v.plate, v.licenseCategory].filter(Boolean).join(' · ') || null })),
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
  // L'auto al seguito è sempre facoltativa alla creazione: se le regole la
  // richiedono, il BE ne assegna una libera alla prima iscrizione.
  const canCreate = isMoto ? fleetIds.length > 0 : !!vehicleId;

  const handleCreate = async () => {
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
    <View style={[s.root, { flex: 1 }]}>
      <View style={s.header}>
        <Text style={s.title}>Guida di gruppo</Text>
        <Pressable onPress={() => !saving && router.back()} hitSlop={10} disabled={saving} style={({ pressed }) => [s.close, pressed && { opacity: 0.5 }]}>
          <Ionicons name="close" size={20} color={NAVY} />
        </Pressable>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 14 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
      <Text style={s.lede}>1 istruttore · {isMoto ? `${effectiveCapacity || '—'} moto + auto al seguito` : '1 veicolo'} · fino a {effectiveCapacity || '—'} allievi</Text>

      {loading ? (
        <View style={s.loadingBox}><ActivityIndicator color={colors.primary} /></View>
      ) : (
        <>
          {/* Tipo: standard (1 veicolo) vs moto (flotta + auto al seguito) — Airbnb sliding pill */}
          <View style={s.seg} onLayout={(e) => setSegW(e.nativeEvent.layout.width)}>
            {pillW > 0 && <Animated.View style={[s.segPill, { width: pillW }, pillStyle]} />}
            {(['standard', 'moto'] as const).map((k) => {
              const active = kind === k;
              return (
                <Pressable
                  key={k}
                  onPress={() => { setKind(k); setSelectedIds([]); }}
                  disabled={saving}
                  style={s.segItem}
                  hitSlop={6}
                >
                  <Ionicons name={k === 'moto' ? 'bicycle-outline' : 'car-sport-outline'} size={16} color={active ? '#1A1A2E' : '#717171'} />
                  <Text style={[s.segText, active && s.segTextActive]}>{k === 'moto' ? 'Moto' : 'Standard'}</Text>
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
            <View style={s.divider} />
            <Row icon="people-outline" label="Capienza" value={`${capacity} allievi`} onPress={openCapacityPicker} disabled={saving} />
            {!isMoto ? (
              <>
                <View style={s.divider} />
                <Row icon="car-outline" label="Veicolo" value={selectedVehicle ? `${selectedVehicle.name}${selectedVehicle.licenseCategory ? ` · ${selectedVehicle.licenseCategory}` : ''}` : null} placeholder="Seleziona veicolo" onPress={openVehiclePicker} disabled={saving} />
              </>
            ) : (
              <>
                <View style={s.divider} />
                <Row icon="bicycle-outline" label="Moto della guida" value={fleetValue} placeholder={motoVehicles.length ? 'Seleziona le moto' : 'Nessuna moto disponibile'} onPress={openFleetPicker} disabled={saving || motoVehicles.length === 0} />
                <View style={s.divider} />
                <Row icon="car-outline" label="Auto al seguito (facoltativa)" value={followVehicle ? followVehicle.name : null} placeholder={followCarRequired ? 'Automatica alla 1ª iscrizione' : 'Nessuna'} onPress={openFollowCarPicker} disabled={saving} />
              </>
            )}
          </View>

          {isMoto ? (
            <Text style={s.hint}>Chi si iscrive riceve automaticamente una moto libera della flotta compatibile col suo percorso; se gli allievi superano le moto, si va a rotazione.</Text>
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
      </ScrollView>

      {!loading ? (
        <View style={[s.footer, { paddingBottom: insets.bottom + 6 }]}>
          <View style={{ flex: 1, minWidth: 0, paddingRight: 14 }}>
            <Text style={s.sumKey}>Riepilogo</Text>
            <Text style={s.sumVal} numberOfLines={1}>{selectedStudents.length}/{effectiveCapacity} allievi · {durationLabel}</Text>
            <Text style={s.sumSub} numberOfLines={1}>{fmtDay(startAt)} · {fmtTime(startAt)}</Text>
          </View>
          <View style={{ flexShrink: 0 }}>
            <Button label="Crea" tone="primary" loading={saving} disabled={!canCreate} onPress={handleCreate} />
          </View>
        </View>
      ) : null}
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
  /* Airbnb segmented control (= quick-book.tsx): sliding white pill on grey track */
  seg: { flexDirection: 'row', backgroundColor: '#EBEBEB', borderRadius: 999, padding: SEG_PAD, position: 'relative', marginBottom: 14 },
  segPill: {
    position: 'absolute', top: SEG_PAD, bottom: SEG_PAD, left: SEG_PAD, borderRadius: 999, backgroundColor: '#FFFFFF',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.12, shadowRadius: 4, elevation: 2,
  },
  segItem: { flex: 1, flexDirection: 'row', gap: 7, paddingVertical: 11, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  segText: { fontSize: 15, fontWeight: '600', color: '#717171', letterSpacing: -0.2 },
  segTextActive: { color: '#1A1A2E', fontWeight: '700' },
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
