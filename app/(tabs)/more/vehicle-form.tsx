import React, { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { ActionSheetIOS, ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { FormSheet } from '../../../src/components/SheetScaffold';
import {
  ClayButton,
  ClayField,
  ClayList,
  ClayListRow,
  ClaySection,
  ClaySegmented,
  ClayToggle,
} from '../../../src/components/clay';
import { CLAY_DANGER } from '../../../src/components/ClayAccountParts';
import { CLAY, CLAY_SHADOW } from '../../../src/theme/clay';
import { SOFT_SWAP_IN } from '../../../src/utils/motion';
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

const dayLetters = ['D', 'L', 'M', 'M', 'G', 'V', 'S'];

const pad = (n: number) => String(n).padStart(2, '0');
const buildTime = (h: number, m: number) => { const d = new Date(); d.setHours(h, m, 0, 0); return d; };
const toTimeString = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const toDateString = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d: Date, n: number) => { const c = new Date(d); c.setDate(c.getDate() + n); return c; };

/**
 * Nuovo / modifica veicolo — REG-639 clay: il form sheet unico (FORM_SHEET +
 * FormSheet, scorre da sé; prima era un modal a tutta pagina con footer
 * pinnato). Campi clay, cambio e modalità di utilizzo come segmentati clay,
 * interruttori clay, scelte multiple (pool) come righe con la spunta,
 * disponibilità con i giorni in cerchi clay e gli orari come righe di lista.
 */
export default function VehicleFormScreen() {
  const router = useRouter();
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
  // Usage mode (owner): open = all instructors, pool = explicit list, exclusive
  // = reserved to one. Derived from the loaded vehicle.
  const [mode, setMode] = useState<'open' | 'pool' | 'exclusive'>(
    initial?.assignedInstructorId
      ? 'exclusive'
      : (initial?.poolInstructorIds?.length ?? 0) > 0
        ? 'pool'
        : 'open',
  );
  const [poolInstructorIds, setPoolInstructorIds] = useState<string[]>(
    initial?.poolInstructorIds ?? [],
  );
  // Temporary out-of-service: excluded from matching but keeps assignment/pool.
  const [maintenance, setMaintenance] = useState(initial?.status === 'maintenance');
  const [instructors, setInstructors] = useState<Array<{ id: string; name: string }>>([]);
  const isAssigned = mode === 'exclusive' && Boolean(assignedInstructorId);
  const [followsAvail, setFollowsAvail] = useState(
    initial?.followsInstructorAvailability ?? true,
  );
  // Exclusive vehicles can follow their instructor; pool/open vehicles use own hours.
  const showOwnAvailability = !(mode === 'exclusive' && followsAvail);

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
        poolInstructorIds?: string[];
        licenseCategory?: LicenseCategory;
        transmission?: Transmission;
      } = {
        name: name.trim(),
        plate: plate.trim() || null,
        licenseCategory,
        transmission,
      };
      if (active) patch.status = maintenance ? 'maintenance' : 'active';
      if (isOwnerActor) {
        // Owner drives the usage mode → exclusive owner + shared pool + own avail.
        patch.assignedInstructorId = mode === 'exclusive' ? assignedInstructorId || null : null;
        patch.poolInstructorIds = mode === 'pool' ? poolInstructorIds : [];
        patch.followsInstructorAvailability = mode === 'exclusive' ? followsAvail : false;
      } else if (canSelfAssign) {
        // Instructor can only assign/unassign the vehicle to themselves.
        patch.assignedInstructorId = assignedInstructorId || null;
        if (assignedInstructorId) patch.followsInstructorAvailability = followsAvail;
      }
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

  if (!data) return <View style={s.empty} />;

  const busy = saving || (isEdit && availabilityLoading);

  return (
    <FormSheet
      title={isEdit ? 'Modifica veicolo' : 'Nuovo veicolo'}
      subtitle={isEdit ? [initial?.name, initial?.plate].filter(Boolean).join(' · ') || undefined : 'Un mezzo dell\'autoscuola per le guide.'}
      testID="vehicle-form-sheet"
      cta={
        <ClayButton
          title={isEdit ? 'Salva' : 'Crea veicolo'}
          onPress={isEdit ? handleSaveEdit : handleCreate}
          loading={saving}
          disabled={busy}
          testID="vehicle-form-save"
        />
      }
    >
      <View style={s.fields}>
        <ClayField
          label="Nome del veicolo"
          value={name}
          onChangeText={setName}
          placeholder="Es. Fiat Panda"
          maxLength={60}
          returnKeyType="next"
          testID="vehicle-form-name"
        />
        <ClayField
          label="Targa"
          value={plate}
          onChangeText={setPlate}
          placeholder="Es. GA 472 KP"
          autoCapitalize="characters"
          maxLength={16}
          returnKeyType="done"
          testID="vehicle-form-plate"
        />
      </View>

      <ClayList style={s.block}>
        <ClayListRow
          title="Categoria patente"
          trailing={<Text style={s.value}>{licenseCategory}</Text>}
          onPress={openCategoryPicker}
          testID="vehicle-form-category"
        />
      </ClayList>

      <Text style={s.label}>Cambio</Text>
      <ClaySegmented
        options={TRANSMISSIONS.map((t) => ({ value: t, label: TRANSMISSION_LABELS[t] }))}
        value={transmission}
        onChange={setTransmission}
        testID="vehicle-form-transmission"
      />

      {isEdit ? (
        <>
          <View style={s.toggles}>
            <ToggleRow
              title="Veicolo attivo"
              subtitle="Se disattivato, non è prenotabile per le guide."
              value={active}
              onValueChange={setActive}
            />
            {isOwnerActor && active ? (
              <ToggleRow
                title="In manutenzione"
                subtitle="Escluso dalle nuove prenotazioni; gli appuntamenti già fissati restano."
                value={maintenance}
                onValueChange={setMaintenance}
              />
            ) : null}
            {!isOwnerActor && canSelfAssign ? (
              <ToggleRow
                title="Assegna a me questo veicolo"
                subtitle="Le tue guide useranno automaticamente questo veicolo."
                value={assignedInstructorId === sessionInstructorId}
                onValueChange={(v) => setAssignedInstructorId(v ? (sessionInstructorId ?? '') : '')}
              />
            ) : null}
            {!isOwnerActor && !canSelfAssign && assignedToOther ? (
              <View style={s.toggleRow}>
                <View style={s.toggleText}>
                  <Text style={s.toggleTitle}>Veicolo assegnato</Text>
                  <Text style={s.toggleSub}>Assegnato a un altro istruttore.</Text>
                </View>
              </View>
            ) : null}
          </View>

          {isOwnerActor ? (
            <ClaySection title="Modalità di utilizzo" style={s.sectionTight}>
              <ClaySegmented
                options={[
                  { value: 'open', label: 'Aperto' },
                  { value: 'pool', label: 'Pool' },
                  { value: 'exclusive', label: 'Esclusivo' },
                ]}
                value={mode}
                onChange={setMode}
                testID="vehicle-form-mode"
              />
              <Animated.View key={mode} entering={SOFT_SWAP_IN}>
                {mode === 'open' ? (
                  <Text style={s.help}>Tutti gli istruttori possono usare questo veicolo.</Text>
                ) : mode === 'pool' ? (
                  <>
                    <Text style={s.help}>Solo gli istruttori selezionati possono usarlo.</Text>
                    {instructors.length ? (
                      <ClayList style={s.block}>
                        {instructors.map((ins) => {
                          const on = poolInstructorIds.includes(ins.id);
                          return (
                            <ClayListRow
                              key={ins.id}
                              title={ins.name}
                              chevron={false}
                              trailing={on ? <Ionicons name="checkmark" size={20} color={CLAY.ink} /> : undefined}
                              onPress={() =>
                                setPoolInstructorIds((prev) =>
                                  on ? prev.filter((id) => id !== ins.id) : [...prev, ins.id],
                                )
                              }
                            />
                          );
                        })}
                      </ClayList>
                    ) : null}
                  </>
                ) : (
                  <>
                    <ClayList style={s.block}>
                      <ClayListRow
                        title="Istruttore"
                        trailing={
                          <Text style={s.value} numberOfLines={1}>
                            {assignedInstructorName ?? (assignedInstructorId ? 'Assegnato' : 'Scegli')}
                          </Text>
                        }
                        onPress={openInstructorPicker}
                        testID="vehicle-form-instructor"
                      />
                    </ClayList>
                    <Text style={s.help}>
                      Riservato a un istruttore, nascosto agli altri. Un istruttore può avere più mezzi esclusivi.
                    </Text>
                  </>
                )}
              </Animated.View>
            </ClaySection>
          ) : null}

          {isAssigned ? (
            <View style={s.toggles}>
              <ToggleRow
                title="Segue la disponibilità dell'istruttore"
                subtitle={
                  followsAvail
                    ? 'Disponibile quando lo è l\'istruttore assegnato.'
                    : 'Usa gli orari propri impostati qui sotto.'
                }
                value={followsAvail}
                onValueChange={setFollowsAvail}
              />
            </View>
          ) : null}

          {showOwnAvailability ? (
            <ClaySection title="Disponibilità" style={s.sectionTight}>
              {availabilityLoading ? (
                <ActivityIndicator size="small" color={CLAY.ink3} style={s.loader} />
              ) : (
                <Animated.View entering={SOFT_SWAP_IN}>
                  <View style={s.days}>
                    {dayLetters.map((letter, index) => {
                      const on = days.includes(index);
                      return (
                        <Pressable
                          key={`vd-${index}`}
                          onPress={() => toggleDay(index)}
                          style={[s.day, on ? s.dayOn : s.dayOff]}
                          accessibilityRole="button"
                          accessibilityState={{ selected: on }}
                        >
                          <Text style={[s.dayText, on && s.dayTextOn]}>{letter}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <ClayList style={s.block}>
                    <ClayListRow
                      title="Inizio"
                      trailing={<Text style={s.value}>{toTimeString(start)}</Text>}
                      onPress={() => openTimePicker(start, setStart)}
                      testID="vehicle-form-start"
                    />
                    <ClayListRow
                      title="Fine"
                      trailing={<Text style={s.value}>{toTimeString(end)}</Text>}
                      onPress={() => openTimePicker(end, setEnd)}
                      testID="vehicle-form-end"
                    />
                  </ClayList>
                </Animated.View>
              )}
            </ClaySection>
          ) : null}
        </>
      ) : null}

      {error ? <Text style={s.error}>{error}</Text> : null}
    </FormSheet>
  );
}

/** Interruttore con titolo e spiegazione su più righe (non tronca). */
function ToggleRow({
  title,
  subtitle,
  value,
  onValueChange,
}: {
  title: string;
  subtitle: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  return (
    <View style={s.toggleRow}>
      <View style={s.toggleText}>
        <Text style={s.toggleTitle}>{title}</Text>
        <Text style={s.toggleSub}>{subtitle}</Text>
      </View>
      <ClayToggle value={value} onValueChange={onValueChange} accessibilityLabel={title} />
    </View>
  );
}

const s = StyleSheet.create({
  empty: { backgroundColor: '#FFFFFF', height: 1 },
  fields: { gap: 18 },
  block: { marginTop: 14 },
  label: { fontSize: 15, fontWeight: '500', color: CLAY.ink, marginTop: 22, marginBottom: 8, paddingHorizontal: 2 },
  value: { fontSize: 15.5, color: CLAY.ink3, maxWidth: 180 },
  help: { fontSize: 13.5, lineHeight: 19, color: CLAY.ink3, marginTop: 12, paddingHorizontal: 4 },
  sectionTight: { marginTop: 22 },

  toggles: { marginTop: 10 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 14 },
  toggleText: { flex: 1, minWidth: 0 },
  toggleTitle: { fontSize: 16, fontWeight: '500', color: CLAY.ink },
  toggleSub: { fontSize: 13.5, lineHeight: 18, color: CLAY.ink3, marginTop: 2 },

  loader: { alignSelf: 'flex-start', marginTop: 4 },
  days: { flexDirection: 'row', justifyContent: 'space-between' },
  day: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  dayOn: { backgroundColor: CLAY.ink, ...CLAY_SHADOW.ink },
  dayOff: { backgroundColor: CLAY.surface, ...CLAY_SHADOW.raiseSm },
  dayText: { fontSize: 15, fontWeight: '500', color: CLAY.ink3 },
  dayTextOn: { color: '#FFFFFF', fontWeight: '600' },

  error: { fontSize: 14, color: CLAY_DANGER, marginTop: 16, paddingHorizontal: 4 },
});
