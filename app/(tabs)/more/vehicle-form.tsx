import React, { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ToggleSwitch } from '../../../src/components/ToggleSwitch';
import { vehicleFormStore } from '../../../src/stores/vehicleFormStore';
import { timePickerStore } from '../../../src/stores/timePickerStore';
import { regloApi } from '../../../src/services/regloApi';
import { useSession } from '../../../src/context/SessionContext';
import { isOwner } from '../../../src/utils/roles';
import {
  LICENSE_CATEGORIES,
  LICENSE_CATEGORY_LABELS,
  TRANSMISSIONS,
  TRANSMISSION_LABELS,
} from '../../../src/utils/license';
import type { LicenseCategory, Transmission } from '../../../src/types/regloApi';
import { colors } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';

const dayLetters = ['D', 'L', 'M', 'M', 'G', 'V', 'S'];

const pad = (n: number) => String(n).padStart(2, '0');
const buildTime = (h: number, m: number) => { const d = new Date(); d.setHours(h, m, 0, 0); return d; };
const toTimeString = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const toDateString = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d: Date, n: number) => { const c = new Date(d); c.setDate(c.getDate() + n); return c; };

export default function VehicleFormScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const data = useSyncExternalStore(vehicleFormStore.subscribe, vehicleFormStore.get);
  const initial = data?.initial ?? null;
  const isEdit = Boolean(initial);

  const { autoscuolaRole, instructorId: sessionInstructorId } = useSession();
  const isOwnerActor = isOwner(autoscuolaRole);
  // Owner manages assignment via a picker (any instructor); a plain instructor
  // can only assign/unassign the vehicle to/from themselves — and never steal a
  // vehicle already bound to a different instructor.
  const assignedToOther =
    Boolean(initial?.assignedInstructorId) &&
    initial?.assignedInstructorId !== sessionInstructorId;
  const canSelfAssign = !isOwnerActor && Boolean(sessionInstructorId) && !assignedToOther;
  const canEditAssignment = isOwnerActor || canSelfAssign;

  const [name, setName] = useState(initial?.name ?? '');
  const [plate, setPlate] = useState(initial?.plate ?? '');
  const [active, setActive] = useState(initial ? initial.status !== 'inactive' : true);
  // License category + transmission this vehicle serves (Vehicles module).
  const [licenseCategory, setLicenseCategory] = useState<LicenseCategory>(
    (initial?.licenseCategory as LicenseCategory) ?? 'B',
  );
  const [transmission, setTransmission] = useState<Transmission>(
    (initial?.transmission as Transmission) ?? 'manual',
  );
  // Fixed-vehicle assignment (owner-managed here; instructors self-assign from
  // their own settings). When set, the vehicle is auto-used for that instructor.
  const [assignedInstructorId, setAssignedInstructorId] = useState<string>(
    initial?.assignedInstructorId ?? '',
  );
  const [instructors, setInstructors] = useState<Array<{ id: string; name: string }>>([]);
  const isAssigned = Boolean(assignedInstructorId);
  const [followsAvail, setFollowsAvail] = useState(
    initial?.followsInstructorAvailability ?? true,
  );
  const showOwnAvailability = !isAssigned || !followsAvail;

  // Load instructors for the assignment picker (owner only, edit mode).
  useEffect(() => {
    if (!isEdit || !isOwnerActor) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await regloApi.getInstructors();
        if (cancelled) return;
        setInstructors(
          list
            .filter((i) => i.status !== 'inactive')
            .map((i) => ({ id: i.id, name: i.name })),
        );
      } catch {
        /* non-blocking: picker simply stays empty */
      }
    })();
    return () => { cancelled = true; };
  }, [isEdit, isOwnerActor]);

  const assignedInstructorName =
    instructors.find((i) => i.id === assignedInstructorId)?.name ?? null;

  const openInstructorPicker = useCallback(() => {
    if (!instructors.length) return;
    const labels = instructors.map((i) =>
      i.id === assignedInstructorId ? `✓ ${i.name}` : i.name,
    );
    if (Platform.OS === 'ios') {
      const options = [...labels, 'Nessuno', 'Annulla'];
      const cancelButtonIndex = options.length - 1;
      const noneIndex = options.length - 2;
      ActionSheetIOS.showActionSheetWithOptions(
        { title: 'Istruttore assegnato', options, cancelButtonIndex },
        (i) => {
          if (i === cancelButtonIndex) return;
          if (i === noneIndex) { setAssignedInstructorId(''); return; }
          const ins = instructors[i];
          if (ins) setAssignedInstructorId(ins.id);
        },
      );
    } else {
      Alert.alert('Istruttore assegnato', undefined, [
        ...instructors.map((ins, i) => ({ text: labels[i], onPress: () => setAssignedInstructorId(ins.id) })),
        { text: 'Nessuno', onPress: () => setAssignedInstructorId('') },
        { text: 'Annulla', style: 'cancel' as const },
      ]);
    }
  }, [instructors, assignedInstructorId]);

  const openCategoryPicker = useCallback(() => {
    const labels = LICENSE_CATEGORIES.map((c) =>
      c === licenseCategory ? `✓ ${LICENSE_CATEGORY_LABELS[c]}` : LICENSE_CATEGORY_LABELS[c],
    );
    if (Platform.OS === 'ios') {
      const options = [...labels, 'Annulla'];
      const cancelButtonIndex = options.length - 1;
      ActionSheetIOS.showActionSheetWithOptions(
        { title: 'Categoria patente', options, cancelButtonIndex },
        (i) => {
          if (i === cancelButtonIndex) return;
          const cat = LICENSE_CATEGORIES[i];
          if (cat) setLicenseCategory(cat);
        },
      );
    } else {
      Alert.alert('Categoria patente', undefined, [
        ...LICENSE_CATEGORIES.map((cat, i) => ({ text: labels[i], onPress: () => setLicenseCategory(cat) })),
        { text: 'Annulla', style: 'cancel' as const },
      ]);
    }
  }, [licenseCategory]);

  const openTransmissionPicker = useCallback(() => {
    const labels = TRANSMISSIONS.map((t) =>
      t === transmission ? `✓ ${TRANSMISSION_LABELS[t]}` : TRANSMISSION_LABELS[t],
    );
    if (Platform.OS === 'ios') {
      const options = [...labels, 'Annulla'];
      const cancelButtonIndex = options.length - 1;
      ActionSheetIOS.showActionSheetWithOptions(
        { title: 'Cambio', options, cancelButtonIndex },
        (i) => {
          if (i === cancelButtonIndex) return;
          const t = TRANSMISSIONS[i];
          if (t) setTransmission(t);
        },
      );
    } else {
      Alert.alert('Cambio', undefined, [
        ...TRANSMISSIONS.map((t, i) => ({ text: labels[i], onPress: () => setTransmission(t) })),
        { text: 'Annulla', style: 'cancel' as const },
      ]);
    }
  }, [transmission]);

  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [start, setStart] = useState(buildTime(9, 0));
  const [end, setEnd] = useState(buildTime(18, 0));
  const [availabilityLoading, setAvailabilityLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Load current availability (edit mode) ──
  useEffect(() => {
    if (!initial) return;
    let cancelled = false;
    (async () => {
      try {
        const anchor = new Date(); anchor.setHours(0, 0, 0, 0);
        const dates = Array.from({ length: 7 }, (_, i) => addDays(anchor, i));
        const responses = await Promise.all(
          dates.map((day) => regloApi.getAvailabilitySlots({ ownerType: 'vehicle', ownerId: initial.id, date: toDateString(day) })),
        );
        if (cancelled) return;
        const ranges: Array<{ dayIndex: number; startMin: number; endMin: number }> = [];
        responses.forEach((response, index) => {
          if (!response?.length) return;
          const usable = response
            .filter((slot) => slot.status !== 'cancelled')
            .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
          if (!usable.length) return;
          const first = new Date(usable[0].startsAt);
          const last = new Date(usable[usable.length - 1].endsAt);
          ranges.push({ dayIndex: dates[index].getDay(), startMin: first.getHours() * 60 + first.getMinutes(), endMin: last.getHours() * 60 + last.getMinutes() });
        });
        if (!ranges.length) { setDays([]); return; }
        setDays(Array.from(new Set(ranges.map((r) => r.dayIndex))).sort());
        const minStart = Math.min(...ranges.map((r) => r.startMin));
        const maxEnd = Math.max(...ranges.map((r) => r.endMin));
        setStart(buildTime(Math.floor(minStart / 60), minStart % 60));
        setEnd(buildTime(Math.floor(maxEnd / 60), maxEnd % 60));
      } catch {
        if (!cancelled) setError('Errore caricando la disponibilità del veicolo.');
      } finally {
        if (!cancelled) setAvailabilityLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [initial]);

  const toggleDay = (day: number) =>
    setDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()));

  const openTimePicker = useCallback((current: Date, onPick: (d: Date) => void) => {
    timePickerStore.set({ selectedTime: current, onConfirm: onPick });
    router.push('/(tabs)/more/time-picker');
  }, [router]);

  const handleCreate = async () => {
    if (!name.trim()) { setError('Il nome del veicolo è obbligatorio.'); return; }
    setSaving(true); setError(null);
    try {
      await regloApi.createVehicle({
        name: name.trim(),
        plate: plate.trim() || undefined,
        licenseCategory,
        transmission,
      });
      await data?.onChanged();
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore salvando il veicolo.');
      setSaving(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!initial) return;
    if (!name.trim()) { setError('Il nome del veicolo è obbligatorio.'); return; }
    if (days.length && end <= start) { setError('L\'orario di fine deve essere dopo l\'inizio.'); return; }
    setSaving(true); setError(null);
    try {
      // 1. Vehicle fields. Activation goes through PATCH; deactivation through
      //    DELETE (soft-delete = inactive), preserving the original semantics.
      const patch: {
        name: string;
        plate: string | null;
        status?: string;
        followsInstructorAvailability?: boolean;
        assignedInstructorId?: string | null;
        licenseCategory?: LicenseCategory;
        transmission?: Transmission;
      } = {
        name: name.trim(),
        plate: plate.trim() || null,
        licenseCategory,
        transmission,
      };
      if (active) patch.status = 'active';
      if (isAssigned) patch.followsInstructorAvailability = followsAvail;
      if (canEditAssignment) patch.assignedInstructorId = assignedInstructorId || null;
      await regloApi.updateVehicle(initial.id, patch);
      if (!active && initial.status !== 'inactive') {
        await regloApi.deleteVehicle(initial.id);
      }

      // 2. Availability — only when the vehicle uses its OWN hours. When it
      //    follows the instructor we preserve any stored availability untouched.
      if (showOwnAvailability) {
        const weeks = data?.availabilityWeeks ?? 4;
        const anchor = new Date(); anchor.setHours(0, 0, 0, 0);
        const resetStart = new Date(anchor); resetStart.setHours(0, 0, 0, 0);
        const resetEnd = new Date(anchor); resetEnd.setHours(23, 59, 0, 0);
        try {
          await regloApi.deleteAvailabilitySlots({
            ownerType: 'vehicle', ownerId: initial.id,
            startsAt: resetStart.toISOString(), endsAt: resetEnd.toISOString(),
            daysOfWeek: [0, 1, 2, 3, 4, 5, 6], weeks,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          if (!/nessuno slot/i.test(message)) throw err;
        }
        if (days.length) {
          const s = new Date(anchor); s.setHours(start.getHours(), start.getMinutes(), 0, 0);
          const e = new Date(anchor); e.setHours(end.getHours(), end.getMinutes(), 0, 0);
          await regloApi.createAvailabilitySlots({
            ownerType: 'vehicle', ownerId: initial.id,
            startsAt: s.toISOString(), endsAt: e.toISOString(),
            daysOfWeek: days, weeks,
          });
        }
      }

      await data?.onChanged();
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore salvando il veicolo.');
      setSaving(false);
    }
  };

  if (!data) return <View style={s.root} />;

  return (
    <View style={s.root}>
      <View style={s.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={s.closeBtn}>
          <Ionicons name="close" size={20} color="#1A1A2E" />
        </Pressable>
      </View>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
      <Text style={s.title}>{isEdit ? 'Modifica veicolo' : 'Nuovo veicolo'}</Text>

      <Text style={s.label}>Nome del veicolo</Text>
      <TextInput
        style={s.input}
        value={name}
        onChangeText={setName}
        placeholder="Es. Fiat Panda"
        placeholderTextColor="#9CA3AF"
        maxLength={60}
      />

      <Text style={s.label}>Targa</Text>
      <TextInput
        style={s.input}
        value={plate}
        onChangeText={setPlate}
        placeholder="Es. GA 472 KP"
        placeholderTextColor="#9CA3AF"
        autoCapitalize="characters"
        maxLength={16}
      />

      <View style={s.licenseRow}>
        <Pressable
          onPress={openCategoryPicker}
          style={({ pressed }) => [s.licenseCard, pressed && { opacity: 0.85 }]}
        >
          <Text style={s.timeLabel}>Categoria patente</Text>
          <View style={s.timeValRow}>
            <Ionicons name="card-outline" size={17} color="#1A1A2E" />
            <Text style={s.timeVal}>{licenseCategory}</Text>
          </View>
        </Pressable>
        <Pressable
          onPress={openTransmissionPicker}
          style={({ pressed }) => [s.licenseCard, pressed && { opacity: 0.85 }]}
        >
          <Text style={s.timeLabel}>Cambio</Text>
          <View style={s.timeValRow}>
            <Ionicons name="settings-outline" size={17} color="#1A1A2E" />
            <Text style={s.timeVal}>{TRANSMISSION_LABELS[transmission]}</Text>
          </View>
        </Pressable>
      </View>

      {isEdit ? (
        <>
          <View style={s.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.toggleTitle}>Veicolo attivo</Text>
              <Text style={s.toggleSub}>Se disattivato, non è prenotabile per le guide.</Text>
            </View>
            <ToggleSwitch value={active} onValueChange={setActive} />
          </View>

          {isOwnerActor ? (
            <Pressable
              onPress={openInstructorPicker}
              style={({ pressed }) => [s.pickerRow, pressed && { opacity: 0.85 }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={s.toggleTitle}>Istruttore assegnato</Text>
                <Text style={s.toggleSub}>
                  {assignedInstructorName ?? (assignedInstructorId ? 'Assegnato' : 'Nessuno')}
                  {' · le guide con lui useranno questo veicolo'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
            </Pressable>
          ) : canSelfAssign ? (
            <View style={s.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.toggleTitle}>Assegna a me questo veicolo</Text>
                <Text style={s.toggleSub}>
                  Le tue guide useranno automaticamente questo veicolo.
                </Text>
              </View>
              <ToggleSwitch
                value={assignedInstructorId === sessionInstructorId}
                onValueChange={(v) =>
                  setAssignedInstructorId(v ? (sessionInstructorId ?? '') : '')
                }
              />
            </View>
          ) : assignedToOther ? (
            <View style={s.pickerRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.toggleTitle}>Veicolo assegnato</Text>
                <Text style={s.toggleSub}>Assegnato a un altro istruttore.</Text>
              </View>
            </View>
          ) : null}

          {isAssigned ? (
            <View style={s.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.toggleTitle}>Segue la disponibilità dell&apos;istruttore</Text>
                <Text style={s.toggleSub}>
                  {followsAvail
                    ? 'Disponibile quando lo è l\'istruttore assegnato.'
                    : 'Usa gli orari propri impostati qui sotto.'}
                </Text>
              </View>
              <ToggleSwitch value={followsAvail} onValueChange={setFollowsAvail} />
            </View>
          ) : null}

          {showOwnAvailability ? (
          <View style={s.subSec}>
            <Text style={s.subLabel}>Disponibilità</Text>
            {availabilityLoading ? (
              <ActivityIndicator size="small" color={colors.primary} style={{ alignSelf: 'flex-start', marginTop: 4 }} />
            ) : (
              <>
                <View style={s.days}>
                  {dayLetters.map((letter, index) => {
                    const on = days.includes(index);
                    return (
                      <Pressable
                        key={`vd-${index}`}
                        onPress={() => toggleDay(index)}
                        style={[s.day, on ? s.dayOn : s.dayOff]}
                      >
                        <Text style={[s.dayText, on ? s.dayTextOn : s.dayTextOff]}>{letter}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <View style={s.times}>
                  <Pressable
                    onPress={() => openTimePicker(start, setStart)}
                    style={({ pressed }) => [s.timeCard, pressed && { opacity: 0.85 }]}
                  >
                    <Text style={s.timeLabel}>Inizio</Text>
                    <View style={s.timeValRow}>
                      <Ionicons name="time-outline" size={17} color="#1A1A2E" />
                      <Text style={s.timeVal}>{toTimeString(start)}</Text>
                    </View>
                  </Pressable>
                  <Pressable
                    onPress={() => openTimePicker(end, setEnd)}
                    style={({ pressed }) => [s.timeCard, pressed && { opacity: 0.85 }]}
                  >
                    <Text style={s.timeLabel}>Fine</Text>
                    <View style={s.timeValRow}>
                      <Ionicons name="time-outline" size={17} color="#1A1A2E" />
                      <Text style={s.timeVal}>{toTimeString(end)}</Text>
                    </View>
                  </Pressable>
                </View>
              </>
            )}
          </View>
          ) : null}
        </>
      ) : null}

      {error ? <Text style={s.error}>{error}</Text> : null}
      </ScrollView>

      <View style={[s.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable
          onPress={saving ? undefined : (isEdit ? handleSaveEdit : handleCreate)}
          disabled={saving || (isEdit && availabilityLoading)}
          style={({ pressed }) => [
            s.cta,
            (saving || (isEdit && availabilityLoading)) && { opacity: 0.5 },
            pressed && { opacity: 0.9 },
          ]}
        >
          {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={s.ctaText}>{isEdit ? 'Salva' : 'Crea veicolo'}</Text>}
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, paddingTop: 20, paddingHorizontal: spacing.lg },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 16 },
  footer: { paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#EEF0F4', backgroundColor: colors.background },
  topBar: { flexDirection: 'row', justifyContent: 'flex-end', marginRight: -4, marginBottom: -8 },
  closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '600', color: '#1A1A2E', letterSpacing: -0.4, marginBottom: 6 },

  label: { fontSize: 14, fontWeight: '600', color: '#1A1A2E', marginTop: 22, marginBottom: 10 },
  input: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 15, fontSize: 16, fontWeight: '400', color: '#1A1A2E',
    backgroundColor: '#FFFFFF',
  },

  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 4, marginTop: 26 },
  pickerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4, marginTop: 26 },
  toggleTitle: { fontSize: 16, fontWeight: '600', color: '#1A1A2E' },
  toggleSub: { fontSize: 13, fontWeight: '400', color: '#9CA3AF', marginTop: 3, lineHeight: 18 },

  subSec: { marginTop: 26, paddingTop: 22, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E5E7EB' },
  subLabel: { fontSize: 12, fontWeight: '600', color: '#9CA3AF', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 14 },

  days: { flexDirection: 'row', gap: 8 },
  day: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  dayOn: { backgroundColor: '#1A1A2E' },
  dayOff: { backgroundColor: '#F4F5F9' },
  dayText: { fontSize: 14, fontWeight: '600' },
  dayTextOn: { color: '#FFFFFF' },
  dayTextOff: { color: '#6E7596' },

  times: { flexDirection: 'row', gap: 12, marginTop: 16 },
  licenseRow: { flexDirection: 'row', gap: 12, marginTop: 22 },
  licenseCard: { flex: 1, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 14, paddingHorizontal: 15, paddingVertical: 13, backgroundColor: '#FFFFFF' },
  timeCard: { flex: 1, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 14, paddingHorizontal: 15, paddingVertical: 13, backgroundColor: '#FFFFFF' },
  timeLabel: { fontSize: 11, fontWeight: '600', color: '#9CA3AF', letterSpacing: 0.5, textTransform: 'uppercase' },
  timeValRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  timeVal: { fontSize: 16, fontWeight: '600', color: '#1A1A2E' },

  error: { fontSize: 13, fontWeight: '400', color: '#DC2626', marginTop: 16 },
  cta: {
    backgroundColor: colors.primary, height: 54, borderRadius: 27,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.24, shadowRadius: 14, elevation: 6,
  },
  ctaText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF', letterSpacing: -0.2 },
});
