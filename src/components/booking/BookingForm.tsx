import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';

import { bookingSheetStore } from '../../stores/bookingSheetStore';
import { timePickerStore } from '../../stores/timePickerStore';
import { dayPickerStore } from '../../stores/dayPickerStore';
import { studentPickerStore } from '../../stores/studentPickerStore';
import { locationPickerStore } from '../../stores/locationPickerStore';
import { locationFormStore } from '../../stores/locationFormStore';
import { optionsPickerPath, optionsPickerStore } from '../../stores/optionsPickerStore';
import { regloApi } from '../../services/regloApi';
import type { MobileBookingOptions } from '../../types/regloApi';
import { ToggleSwitch } from '../ToggleSwitch';
import { Button } from '../Button';
import { LESSON_TYPE_OPTIONS } from '../../utils/lessonTypes';
import { loadLastBookingSelection, saveLastBookingSelection, type LastBookingSelection } from '../../utils/lastBookingSelection';
import { isMotoLicenseCategory, vehicleServesStudent, licenseCategoryLabel, transmissionLabel } from '../../utils/license';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

type Entry = { id: string; date: Date; startTime: Date; duration: number };

const NAVY = '#1A1A2E';
const INK = '#222222';
const GREY = '#717171';
const MUTED = '#929292';
const N50 = '#F4F5F9';
const N100 = '#E9EBF2';

const pad2 = (n: number) => String(n).padStart(2, '0');

const normalizeToQuarter = (value: Date) => {
  const next = new Date(value);
  next.setSeconds(0, 0);
  const rounded = Math.ceil(next.getMinutes() / 15) * 15;
  if (rounded === 60) next.setHours(next.getHours() + 1, 0, 0, 0);
  else next.setMinutes(rounded, 0, 0);
  return next;
};

/** Build a Date on `isoDay` at `minutes` from midnight (for the gesture preset). */
const dateAtMinutes = (isoDay: string, minutes: number) => {
  const d = new Date(isoDay);
  d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return d;
};

const toYMD = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const fromYMD = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
/** bookedDateKeys arrive as `${y}-${monthIndex}-${day}` (0-based, unpadded). */
const bookedKeyToYMD = (k: string) => { const [y, m, d] = k.split('-'); return `${y}-${pad2(Number(m) + 1)}-${pad2(Number(d))}`; };

const initialsOf = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?';

const fmtDay = (d: Date) => d.toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: 'short' });
const fmtTime = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

/** Start (ms) of the ISO week (Mon-Sun, UTC) containing `d` — mirrors the BE. */
const isoWeekStartUTC = (d: Date) => {
  const x = new Date(d);
  const dow = x.getUTCDay();
  x.setUTCDate(x.getUTCDate() + (dow === 0 ? -6 : 1 - dow));
  x.setUTCHours(0, 0, 0, 0);
  return x.getTime();
};

/* ───────── Flat row inside an elevated card (icon · label · value · chevron) ───────── */
const Row = ({ icon, leading, label, value, valueSub, placeholder, onPress, disabled }: {
  icon?: keyof typeof Ionicons.glyphMap; leading?: React.ReactNode; label: string;
  value?: string | null; valueSub?: string | null; placeholder?: string;
  onPress: () => void; disabled?: boolean;
}) => (
  <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [s.row, pressed && { opacity: 0.55 }]}>
    {leading ?? <View style={s.rowIcon}><Ionicons name={icon ?? 'ellipse-outline'} size={22} color={NAVY} /></View>}
    <View style={s.rowBody}>
      <Text style={s.rowLabel}>{label}</Text>
      {value ? <Text style={s.rowValue} numberOfLines={1}>{value}</Text> : <Text style={s.rowPlaceholder} numberOfLines={1}>{placeholder}</Text>}
      {valueSub ? <Text style={s.rowValueSub} numberOfLines={1}>{valueSub}</Text> : null}
    </View>
    <Ionicons name="chevron-forward" size={18} color="#C7CBD1" />
  </Pressable>
);

/* ───────── Shared booking form (used by the new-booking route + quick-book) ─────────
 * `embedded` hides the route shell (topbar X + hero) so the parent — e.g. the
 * quick-book sheet — can render its own header (Airbnb segmented). When the store
 * carries `presetStartMinutes` (released-scrub position), the start time is seeded
 * to it instead of the current clock time. */
export function BookingForm({ embedded = false }: { embedded?: boolean }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const data = useSyncExternalStore(bookingSheetStore.subscribe, bookingSheetStore.get);

  const [studentId, setStudentId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [followVehicleId, setFollowVehicleId] = useState('');
  const [extraMotoVehicleIds, setExtraMotoVehicleIds] = useState<string[]>([]);
  const [lessonTypes, setLessonTypes] = useState<string[]>(['guida']);
  const [date, setDate] = useState<Date>(() => new Date());
  const [startTime, setStartTime] = useState<Date>(() => normalizeToQuarter(new Date()));
  const [duration, setDuration] = useState(60);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [locationName, setLocationName] = useState<string | null>(null);
  const [locationAddress, setLocationAddress] = useState<string | null>(null);
  const [multiMode, setMultiMode] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [pending, setPending] = useState(false);
  // Prefetched so we can warn about the weekly limit *before* dismissing the
  // sheet (no flash). Reflects the CURRENT week only — bookings in other weeks
  // fall back to the background WEEKLY_LIMIT_CONFIRM handling in runOptimistic.
  const [weeklyLimit, setWeeklyLimit] = useState<MobileBookingOptions['weeklyBookingLimit'] | null>(null);

  // Kind-split memory (last car / last moto+follow+extras) of the previous
  // booking flows — loaded per sheet-open, applied on STUDENT selection (the
  // vehicle section is hidden until then). Ref, not state: it's read inside
  // picker callbacks stored in external stores.
  const lastSelRef = useRef<LastBookingSelection | null>(null);

  useEffect(() => {
    if (!data) return;
    setStudentId('');
    // No vehicle preset at open: the Veicolo row appears (animated) once a
    // student is picked, preset from the kind-matching remembered selection.
    setVehicleId('');
    setFollowVehicleId('');
    setExtraMotoVehicleIds([]);
    setLessonTypes(['guida']);
    setDate(new Date(data.initialDate));
    setStartTime(
      data.presetStartMinutes != null
        ? dateAtMinutes(data.initialDate, data.presetStartMinutes)
        : normalizeToQuarter(new Date()),
    );
    // Booking (guida) snaps the seeded duration to the NEAREST allowed guide
    // duration — the grid ghost may be any length, but a guide must be a valid one.
    setDuration(
      data.durations.length
        ? data.durations.reduce(
            (best, d) => (Math.abs(d - data.defaultDuration) < Math.abs(best - data.defaultDuration) ? d : best),
            data.durations[0],
          )
        : (data.defaultDuration || 60),
    );
    setLocationId(data.defaultLocation?.id ?? null);
    setLocationName(data.defaultLocation?.name ?? null);
    setLocationAddress(data.defaultLocation?.address ?? null);
    setMultiMode(false);
    setEntries([]);
    setPending(false);

    lastSelRef.current = null;
    if (!data.vehiclesEnabled || !data.instructorId) return;
    let cancelled = false;
    void loadLastBookingSelection(data.instructorId).then((stored) => {
      if (!cancelled) lastSelRef.current = stored;
    });
    return () => { cancelled = true; };
  }, [data]);

  // Prefetch the student's weekly-limit status (current week) on selection.
  useEffect(() => {
    if (!studentId) { setWeeklyLimit(null); return; }
    let active = true;
    regloApi.getBookingOptions(studentId)
      .then((opts) => { if (active) setWeeklyLimit(opts?.weeklyBookingLimit ?? null); })
      .catch(() => { if (active) setWeeklyLimit(null); });
    return () => { active = false; };
  }, [studentId]);

  const markedDates = useMemo(
    () => new Set((data?.bookedDateKeys ?? []).map(bookedKeyToYMD)),
    [data?.bookedDateKeys],
  );
  const monthsCount = useMemo(
    () => Math.max(2, Math.ceil((data?.availabilityWeeks ?? 4) / 4) + 1),
    [data?.availabilityWeeks],
  );
  const selectedStudentLabel = useMemo(
    () => data?.studentOptions.find((o) => o.value === studentId)?.label ?? null,
    [data?.studentOptions, studentId],
  );
  const selectedStudentSubtitle = useMemo(
    () => data?.studentOptions.find((o) => o.value === studentId)?.subtitle ?? null,
    [data?.studentOptions, studentId],
  );

  if (!data) return <View style={s.root} />;
  const { vehiclesEnabled, vehicles, durations, studentOptions, defaultLocation, instructorId, followCarRules } = data;

  // Moto-vehicle awareness: the follow car (auto al seguito) and extra-moto
  // controls only apply when the primary vehicle is a moto.
  const selectedVehicle = vehicles.find((v) => v.id === vehicleId) ?? null;

  // License eligibility: the chosen vehicle must serve the chosen student's
  // pursued license (moto hierarchy AM<A1<A2<A: motos of equal-or-lower category
  // only). The vehicle picker only offers eligible vehicles; an effect clears a
  // now-incompatible vehicle when the student changes.
  const selectedStudent = studentOptions.find((o) => o.value === studentId) ?? null;
  const eligibleVehicles = selectedStudent
    ? vehicles.filter((v) => vehicleServesStudent(v, selectedStudent))
    : vehicles;
  const vehicleIneligible =
    !!selectedStudent && !!selectedVehicle && !vehicleServesStudent(selectedVehicle, selectedStudent);

  const primaryIsMoto =
    vehiclesEnabled && !!selectedVehicle && isMotoLicenseCategory(selectedVehicle.licenseCategory);
  const needFollowCar =
    primaryIsMoto &&
    (followCarRules?.[selectedVehicle?.licenseCategory ?? '']?.enabled === true);
  const followCarOptions = vehicles.filter(
    (v) => v.licenseCategory === 'B' && v.id !== vehicleId,
  );
  // Extra motos must ALSO serve the student's license (same moto hierarchy as the
  // primary — equal-or-lower category), not "any moto".
  const extraMotoOptions = eligibleVehicles.filter(
    (v) => isMotoLicenseCategory(v.licenseCategory) && v.id !== vehicleId,
  );
  // '__none__' = explicit "Nessuna auto al seguito": the global rule suggests
  // the follow car but doesn't force it — it resolves to no vehicle.
  const effectiveFollowVehicleId =
    needFollowCar && followVehicleId !== '__none__' ? followVehicleId : '';
  const effectiveExtraMotoVehicleIds = primaryIsMoto
    ? extraMotoVehicleIds.filter((id) => id !== vehicleId)
    : [];

  const typesPayload = lessonTypes.length && !(lessonTypes.length === 1 && lessonTypes[0] === 'guida')
    ? { lessonType: lessonTypes[0], types: lessonTypes }
    : {};

  const setMulti = (val: boolean) => {
    setMultiMode(val);
    if (val) setEntries([{ id: String(date.getTime()), date: new Date(date), startTime: new Date(startTime), duration }]);
    else setEntries([]);
  };

  /**
   * Preset the vehicle section for a just-picked student. A still-eligible
   * manual pick is kept; otherwise the kind-matching remembered selection
   * (student's pursued license: moto path → last moto + follow car + extra
   * motos, else last car) is applied when its vehicles are still available
   * and eligible. Fallback: the seeded default vehicle, if eligible.
   */
  const presetVehiclesForStudent = (st: { licenseCategory?: string | null; transmission?: string | null }) => {
    const current = vehicles.find((v) => v.id === vehicleId);
    if (current && vehicleServesStudent(current, st)) return;

    const motoPath = isMotoLicenseCategory(st.licenseCategory);
    const mem = motoPath ? lastSelRef.current?.moto : lastSelRef.current?.car;
    const candidate = mem ? vehicles.find((v) => v.id === mem.vehicleId) : undefined;
    if (
      candidate &&
      isMotoLicenseCategory(candidate.licenseCategory) === motoPath &&
      vehicleServesStudent(candidate, st)
    ) {
      setVehicleId(candidate.id);
      if (motoPath) {
        const moto = lastSelRef.current!.moto!;
        const followEnabled = followCarRules?.[candidate.licenseCategory ?? '']?.enabled === true;
        const followValid =
          moto.followVehicleId === '__none__' ||
          vehicles.some((v) => v.id === moto.followVehicleId && v.licenseCategory === 'B' && v.id !== candidate.id);
        setFollowVehicleId(followEnabled && moto.followVehicleId && followValid ? moto.followVehicleId : '');
        setExtraMotoVehicleIds(
          (moto.extraMotoVehicleIds ?? []).filter((id) => {
            const v = vehicles.find((x) => x.id === id);
            return !!v && id !== candidate.id && isMotoLicenseCategory(v.licenseCategory) && vehicleServesStudent(v, st);
          }),
        );
      } else {
        setFollowVehicleId('');
        setExtraMotoVehicleIds([]);
      }
      return;
    }

    const fallback = vehicles.find((v) => v.id === data.defaultVehicleId);
    setVehicleId(fallback && vehicleServesStudent(fallback, st) ? fallback.id : '');
    setFollowVehicleId('');
    setExtraMotoVehicleIds([]);
  };

  const openStudentPicker = () => {
    studentPickerStore.set({
      selectedId: studentId || null,
      options: studentOptions,
      onSelect: (v) => {
        setStudentId(v);
        const st = studentOptions.find((o) => o.value === v);
        if (st) presetVehiclesForStudent(st);
      },
    });
    router.push('/(tabs)/home/select-student');
  };

  const openTimePicker = (current: Date, onConfirm: (date: Date) => void) => {
    timePickerStore.set({ selectedTime: current, onConfirm });
    router.push('/(tabs)/home/time-picker');
  };

  const openDatePicker = (current: Date, onSelect: (date: Date) => void) => {
    dayPickerStore.set({
      selectedDate: toYMD(current), markedDates, monthsBack: 0, monthsCount,
      allowPast: false, title: 'Seleziona data', onSelect: (ymd) => onSelect(fromYMD(ymd)),
    });
    router.push('/(tabs)/home/select-date');
  };

  const openLocationPicker = () => {
    locationPickerStore.set({
      selectedLocationId: locationId ?? defaultLocation?.id ?? null,
      onSelect: (loc) => { setLocationId(loc.id); setLocationName(loc.name); setLocationAddress(loc.address ?? null); },
      onRequestCreate: () => {
        locationFormStore.set({ initial: null, onSubmit: async (values) => { await regloApi.createLocation(values); } });
        router.push('/(tabs)/home/manage-lesson-location-form');
      },
    });
    router.push('/(tabs)/home/manage-lesson-location');
  };

  const openDuration = () => {
    optionsPickerStore.set({
      title: 'Durata', multi: false, selected: [String(duration)],
      options: durations.map((d) => ({ value: String(d), label: `${d} min` })),
      onConfirm: (v) => { const n = Number(v[0]); if (!Number.isNaN(n)) setDuration(n); },
    });
    router.push(optionsPickerPath());
  };

  const openVehicle = () => {
    optionsPickerStore.set({
      title: 'Veicolo', multi: false, selected: vehicleId ? [vehicleId] : [],
      // Only vehicles eligible for the selected student (moto hierarchy).
      options: eligibleVehicles.map((v) => ({ value: v.id, label: v.name, subtitle: licenseCategoryLabel(v.licenseCategory) || null })),
      onConfirm: (v) => setVehicleId(v[0] ?? ''),
    });
    router.push(optionsPickerPath());
  };

  const openFollowCar = () => {
    optionsPickerStore.set({
      title: 'Auto al seguito', multi: false, selected: followVehicleId ? [followVehicleId] : [],
      options: [
        { value: '__none__', label: 'Nessuna auto al seguito', subtitle: null },
        ...followCarOptions.map((v) => ({ value: v.id, label: v.name, subtitle: transmissionLabel(v.transmission) || null })),
      ],
      onConfirm: (v) => setFollowVehicleId(v[0] ?? ''),
    });
    router.push(optionsPickerPath());
  };

  const openExtraMotos = () => {
    optionsPickerStore.set({
      title: 'Moto aggiuntive', multi: true, selected: extraMotoVehicleIds,
      options: extraMotoOptions.map((v) => ({ value: v.id, label: v.name, subtitle: licenseCategoryLabel(v.licenseCategory) || null })),
      onConfirm: (vs) => setExtraMotoVehicleIds(vs),
    });
    router.push(optionsPickerPath());
  };

  const openType = () => {
    optionsPickerStore.set({
      title: 'Tipo di guida', multi: true, selected: lessonTypes,
      options: LESSON_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
      onConfirm: (vs) => setLessonTypes(vs.length ? vs : ['guida']),
    });
    router.push(optionsPickerPath());
  };

  // Non-optimistic: keep the sheet open with a button spinner, run the create,
  // refresh the parent's agenda from the BE, then close. The UI only shows the
  // booking once the BE has confirmed it.
  const runBooking = (
    doBook: (skip?: boolean) => Promise<unknown>,
    successMessage: (result: unknown) => string,
    initialSkip = false,
  ) => {
    setPending(true);
    const settle = async (skip = false) => {
      try {
        const result = await doBook(skip);
        // Remember this booking's vehicle choices in the kind-matching slot so
        // the next same-kind booking opens preset to them. When the follow-car
        // rule is off, the previously remembered follow car is preserved.
        if (vehiclesEnabled && vehicleId) {
          saveLastBookingSelection(
            data.instructorId,
            primaryIsMoto
              ? {
                  moto: {
                    vehicleId,
                    followVehicleId:
                      (needFollowCar && followVehicleId) || lastSelRef.current?.moto?.followVehicleId,
                    extraMotoVehicleIds: effectiveExtraMotoVehicleIds,
                  },
                }
              : { car: { vehicleId } },
          );
        }
        await data.onApplied();
        data.onDone(successMessage(result));
        router.back();
      } catch (err: unknown) {
        const payload = (err as { payload?: Record<string, unknown> })?.payload;
        if (payload?.code === 'WEEKLY_LIMIT_CONFIRM') {
          const msg = typeof payload.message === 'string' ? payload.message : "L'allievo ha raggiunto il limite settimanale. Vuoi procedere comunque?";
          Alert.alert('Limite settimanale', msg, [
            { text: 'Annulla', style: 'cancel', onPress: () => setPending(false) },
            { text: 'Procedi', onPress: () => { void settle(true); } },
          ]);
          return;
        }
        setPending(false);
        Alert.alert('Errore', err instanceof Error ? err.message : 'Errore nella prenotazione');
      }
    };
    void settle(initialSkip);
  };

  /**
   * If the prefetched (current-week) status says these `adds` bookings in the
   * current week would hit the limit, ask for confirmation *before* dismissing.
   * Returns true if it showed the dialog (caller should stop). Bookings in other
   * weeks return false here and rely on runOptimistic's background fallback.
   */
  const confirmWeeklyLimitIfNeeded = (
    currentWeekAdds: number,
    proceed: () => void,
  ): boolean => {
    const w = weeklyLimit;
    if (!w?.enabled || w.examPriority?.active || currentWeekAdds <= 0) return false;
    if ((w.current ?? 0) + currentWeekAdds <= (w.limit ?? 0)) return false;
    Alert.alert(
      'Limite settimanale',
      `L'allievo ha già ${w.current ?? 0} guide questa settimana. Con queste ${currentWeekAdds === 1 ? 'una nuova' : `${currentWeekAdds} nuove`} si supera il limite di ${w.limit ?? 0}. Vuoi procedere comunque?`,
      [
        { text: 'Annulla', style: 'cancel' },
        { text: 'Procedi', onPress: proceed },
      ],
    );
    return true;
  };

  const confirmSingle = () => {
    if (!studentId) { Alert.alert('Allievo mancante', 'Seleziona un allievo.'); return; }
    if (vehiclesEnabled && !vehicleId) { Alert.alert('Veicolo mancante', 'Seleziona un veicolo.'); return; }
    if (vehicleIneligible) { Alert.alert('Veicolo non idoneo', "Il veicolo selezionato non è idoneo alla patente dell'allievo."); return; }
    if (needFollowCar && !followVehicleId) { Alert.alert('Auto al seguito', 'Scegli un’auto al seguito oppure "Nessuna".'); return; }
    const start = (() => { const d = new Date(date); const t = new Date(startTime); d.setHours(t.getHours(), t.getMinutes(), 0, 0); return normalizeToQuarter(d); })();
    const end = new Date(start.getTime() + duration * 60 * 1000);
    const book = (skip = false) => runBooking((s2) => regloApi.confirmInstructorBooking({
      studentId, startsAt: start.toISOString(), endsAt: end.toISOString(), instructorId,
      vehicleId: vehiclesEnabled ? vehicleId : null,
      followVehicleId: effectiveFollowVehicleId || null,
      extraMotoVehicleIds: effectiveExtraMotoVehicleIds,
      locationId, ...typesPayload,
      ...(s2 ? { skipWeeklyLimitCheck: true } : {}),
    }), () => 'Guida prenotata.', skip);
    const inCurrentWeek = isoWeekStartUTC(start) === isoWeekStartUTC(new Date()) ? 1 : 0;
    if (confirmWeeklyLimitIfNeeded(inCurrentWeek, () => book(true))) return;
    book();
  };

  const confirmMulti = () => {
    if (!studentId) { Alert.alert('Allievo mancante', 'Seleziona un allievo.'); return; }
    if (vehiclesEnabled && !vehicleId) { Alert.alert('Veicolo mancante', 'Seleziona un veicolo.'); return; }
    if (vehicleIneligible) { Alert.alert('Veicolo non idoneo', "Il veicolo selezionato non è idoneo alla patente dell'allievo."); return; }
    if (needFollowCar && !followVehicleId) { Alert.alert('Auto al seguito', 'Scegli un’auto al seguito oppure "Nessuna".'); return; }
    if (!entries.length) { Alert.alert('Nessuna guida', 'Aggiungi almeno una guida.'); return; }
    const payloadEntries = entries.map((entry) => {
      const start = new Date(entry.date);
      start.setHours(entry.startTime.getHours(), entry.startTime.getMinutes(), 0, 0);
      const end = new Date(start.getTime() + entry.duration * 60 * 1000);
      return { startsAt: start.toISOString(), endsAt: end.toISOString() };
    });
    const book = (skip = false) => runBooking((s2) => regloApi.confirmInstructorBookingBatch({
      studentId, instructorId, vehicleId: vehiclesEnabled ? vehicleId : null,
      followVehicleId: effectiveFollowVehicleId || null,
      extraMotoVehicleIds: effectiveExtraMotoVehicleIds,
      ...typesPayload,
      ...(s2 ? { skipWeeklyLimitCheck: true } : {}), entries: payloadEntries,
    }), (result) => `${(result as { created: number }).created} guide prenotate.`, skip);
    const nowWeek = isoWeekStartUTC(new Date());
    const currentWeekAdds = payloadEntries.filter((e) => isoWeekStartUTC(new Date(e.startsAt)) === nowWeek).length;
    if (confirmWeeklyLimitIfNeeded(currentWeekAdds, () => book(true))) return;
    book();
  };

  const canConfirm = !pending && !!studentId && (!vehiclesEnabled || !!vehicleId) && !vehicleIneligible && (!needFollowCar || !!followVehicleId) && (multiMode ? entries.length > 0 : true);

  const summaryMain = multiMode
    ? `${entries.length} guid${entries.length === 1 ? 'a' : 'e'}`
    : `${fmtDay(date)} · ${fmtTime(startTime)}`;
  const summarySub = multiMode ? null : `${duration} min`;
  const ctaLabel = multiMode
    ? `Prenota ${entries.length} guid${entries.length === 1 ? 'a' : 'e'}`
    : 'Prenota guida';

  const typeValue = lessonTypes
    .map((v) => LESSON_TYPE_OPTIONS.find((o) => o.value === v)?.label ?? null)
    .filter(Boolean)
    .join(', ') || 'Guida';
  const vehicleValue = vehicles.find((v) => v.id === vehicleId)?.name ?? null;
  const followCarValue =
    followVehicleId === '__none__'
      ? 'Nessuna'
      : vehicles.find((v) => v.id === effectiveFollowVehicleId)?.name ?? null;
  const extraMotosValue = effectiveExtraMotoVehicleIds
    .map((id) => vehicles.find((v) => v.id === id)?.name)
    .filter(Boolean)
    .join(', ') || null;

  // Both hosts (standalone new-booking route AND embedded in quick-book) are
  // full-height page sheets now: the body always scrolls, the footer is pinned.
  // (In moto mode the form grows taller than the screen, so a content-hugging
  // form sheet would clip it on iOS — hence PAGE_SHEET everywhere.)
  const Wrapper: React.ComponentType<any> = ScrollView;
  const wrapperProps = {
    style: { flex: 1 },
    contentContainerStyle: s.content,
    keyboardShouldPersistTaps: 'handled' as const,
    showsVerticalScrollIndicator: false,
  };

  return (
    <View style={embedded ? s.root : [s.root, { paddingTop: 14 }]}>
      {!embedded && (
        <View style={s.topbar}>
          <View style={{ flex: 1 }} />
          <Pressable onPress={() => !pending && router.back()} hitSlop={10} disabled={pending} style={({ pressed }) => [s.x, pressed && { opacity: 0.5 }]}>
            <Ionicons name="close" size={20} color={NAVY} />
          </Pressable>
        </View>
      )}

      <Wrapper {...wrapperProps}>
        {/* Hero */}
        {!embedded && (
          <View style={s.hero}>
            <Text style={s.heroTitle}>Nuova prenotazione</Text>
          </View>
        )}

        {/* Allievo — priorità massima, card singola e slegata */}
        <View style={s.group}>
          <Row
            label="Allievo"
            value={selectedStudentLabel}
            valueSub={selectedStudentLabel ? selectedStudentSubtitle : null}
            placeholder="Seleziona allievo"
            onPress={openStudentPicker}
            disabled={pending || !studentOptions.length}
            leading={
              selectedStudentLabel
                ? <View style={s.avatar}><Text style={s.avatarTxt}>{initialsOf(selectedStudentLabel)}</Text></View>
                : <View style={s.rowIcon}><Ionicons name="person-outline" size={22} color={NAVY} /></View>
            }
          />
        </View>

        {/* Prenotazione multipla — optional, banner leggero (non un input primario) */}
        <View style={s.optBanner}>
          <View style={s.optIcon}><Ionicons name="layers-outline" size={18} color={NAVY} /></View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.optTitle}>Prenotazione multipla</Text>
            <Text style={s.optSub}>Aggiungi più guide insieme</Text>
          </View>
          <ToggleSwitch value={multiMode} onValueChange={setMulti} disabled={pending} />
        </View>

        {/* Quando + Durata (single) — priorità alta */}
        {!multiMode && (
          <View style={s.group}>
            <Row icon="calendar-outline" label="Giorno" value={fmtDay(date)} onPress={() => openDatePicker(date, setDate)} disabled={pending} />
            <View style={s.divider} />
            <Row icon="time-outline" label="Ora" value={fmtTime(startTime)} onPress={() => openTimePicker(startTime, setStartTime)} disabled={pending} />
            <View style={s.divider} />
            <Row icon="hourglass-outline" label="Durata" value={`${duration} min`} onPress={openDuration} disabled={pending} />
          </View>
        )}

        {/* Guide (multi) */}
        {multiMode && (
          <>
            {entries.map((entry) => (
              <View key={entry.id} style={s.entryCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Pressable style={s.chip} onPress={() => openDatePicker(entry.date, (d) => setEntries((p) => p.map((e) => e.id === entry.id ? { ...e, date: d } : e)))} disabled={pending}>
                    <Ionicons name="calendar-outline" size={15} color={NAVY} />
                    <Text style={s.chipTxt}>{fmtDay(entry.date)}</Text>
                  </Pressable>
                  <Pressable style={[s.chip, { marginLeft: 8 }]} onPress={() => openTimePicker(entry.startTime, (d) => setEntries((p) => p.map((e) => e.id === entry.id ? { ...e, startTime: d } : e)))} disabled={pending}>
                    <Ionicons name="time-outline" size={15} color={NAVY} />
                    <Text style={s.chipTxt}>{fmtTime(entry.startTime)}</Text>
                  </Pressable>
                  <View style={{ flex: 1 }} />
                  {entries.length > 1 ? (
                    <Pressable hitSlop={8} onPress={() => setEntries((p) => p.filter((e) => e.id !== entry.id))} disabled={pending}>
                      <Ionicons name="trash-outline" size={18} color="#C13515" />
                    </Pressable>
                  ) : null}
                </View>
                <View style={s.durRow}>
                  {durations.map((dur) => { const active = entry.duration === dur; return (
                    <Pressable key={dur} onPress={() => setEntries((p) => p.map((e) => e.id === entry.id ? { ...e, duration: dur } : e))} style={[s.durPill, active && s.durPillOn]} disabled={pending}>
                      <Text style={[s.durPillTxt, active && s.durPillTxtOn]}>{dur} min</Text>
                    </Pressable>
                  ); })}
                </View>
              </View>
            ))}
            {entries.length < 20 ? (
              <Pressable onPress={() => {
                const last = entries[entries.length - 1];
                const lastDuration = last?.duration ?? duration;
                const newDate = last ? new Date(last.date) : new Date(date);
                const newTime = last ? new Date(last.startTime.getTime() + lastDuration * 60 * 1000) : normalizeToQuarter(new Date());
                setEntries((p) => [...p, { id: String(p.length) + '-' + newDate.getTime(), date: newDate, startTime: newTime, duration: lastDuration }]);
              }} style={({ pressed }) => [s.addGuide, pressed && { opacity: 0.7 }]} disabled={pending}>
                <Ionicons name="add-circle-outline" size={20} color={NAVY} />
                <Text style={s.addGuideTxt}>Aggiungi guida</Text>
              </Pressable>
            ) : null}
          </>
        )}

        {/* Secondari — stile lista piatta, priorità inferiore */}
        <Text style={s.listCaption}>Dettagli</Text>
        <View style={s.list}>
          <Row icon="location-outline" label="Luogo" value={locationName ?? "Sede dell'autoscuola"} valueSub={locationAddress} onPress={openLocationPicker} disabled={pending} />
          {vehiclesEnabled && studentId ? (
            <Animated.View entering={FadeInDown.duration(220)} exiting={FadeOut.duration(150)} layout={LinearTransition.duration(220)}>
              <View style={s.divider} />
              <Row icon="car-outline" label="Veicolo" value={vehicleValue} placeholder="Seleziona veicolo" onPress={openVehicle} disabled={pending || !eligibleVehicles.length} />
            </Animated.View>
          ) : null}
          {needFollowCar ? (
            <Animated.View entering={FadeInDown.duration(220)} exiting={FadeOut.duration(150)} layout={LinearTransition.duration(220)}>
              <View style={s.divider} />
              <Row icon="car-sport-outline" label="Auto al seguito" value={followCarValue} placeholder="Seleziona auto al seguito" onPress={openFollowCar} disabled={pending || !followCarOptions.length} />
            </Animated.View>
          ) : null}
          {primaryIsMoto && extraMotoOptions.length ? (
            <Animated.View entering={FadeInDown.duration(220)} exiting={FadeOut.duration(150)} layout={LinearTransition.duration(220)}>
              <View style={s.divider} />
              <Row icon="bicycle-outline" label="Moto aggiuntive" value={extraMotosValue} placeholder="Nessuna" onPress={openExtraMotos} disabled={pending} />
            </Animated.View>
          ) : null}
          <Animated.View layout={LinearTransition.duration(220)}>
            <View style={s.divider} />
            <Row icon="pricetag-outline" label="Tipo di guida" value={typeValue} onPress={openType} disabled={pending} />
          </Animated.View>
        </View>
      </Wrapper>

      <View style={[s.footer, { paddingBottom: insets.bottom + 12 }]}>
        <View style={{ flex: 1, minWidth: 0, paddingRight: 14 }}>
          <Text style={s.sumKey}>Riepilogo</Text>
          <Text style={s.sumVal} numberOfLines={1}>{summaryMain}</Text>
          {summarySub ? <Text style={s.sumSub} numberOfLines={1}>{summarySub}</Text> : null}
        </View>
        <View style={{ flexShrink: 0 }}>
          <Button label={ctaLabel} tone="primary" loading={pending} disabled={!canConfirm} onPress={multiMode ? confirmMulti : confirmSingle} />
        </View>
      </View>
    </View>
  );
}

const ELEV = {
  shadowColor: '#1A1A2E', shadowOpacity: 0.07, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 4,
} as const;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  topbar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingBottom: 2 },
  x: { width: 33, height: 33, borderRadius: 17, backgroundColor: '#F1F2F4', alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: spacing.lg, paddingTop: 2, paddingBottom: spacing.xl },

  hero: { marginBottom: 18 },
  heroTitle: { fontSize: 27, fontWeight: '600', color: NAVY, letterSpacing: -0.6 },

  /* elevated card group (priority items) */
  group: { backgroundColor: '#FFFFFF', borderRadius: 20, paddingHorizontal: 16, marginBottom: 14, ...ELEV },

  /* optional multi-booking banner — light tinted, clearly secondary */
  optBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: N50, borderRadius: 16, paddingVertical: 11, paddingHorizontal: 14, marginBottom: 14 },
  optIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  optTitle: { fontSize: 14, fontWeight: '600', color: NAVY },
  optSub: { fontSize: 12.5, color: MUTED, marginTop: 1 },

  /* secondary flat list */
  listCaption: { fontSize: 12, fontWeight: '600', color: MUTED, letterSpacing: 0.4, textTransform: 'uppercase', marginTop: 4, marginBottom: 2, marginLeft: 6 },
  list: { paddingHorizontal: 6, marginBottom: 4 },

  /* row */
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 15, minHeight: 64 },
  rowIcon: { width: 26, alignItems: 'center' },
  rowBody: { flex: 1, minWidth: 0, gap: 1 },
  rowLabel: { fontSize: 15, fontWeight: '600', color: NAVY },
  rowValue: { fontSize: 14, color: GREY },
  rowValueSub: { fontSize: 13, color: '#929292' },
  rowPlaceholder: { fontSize: 14, color: MUTED },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#EFF0F3' },

  /* avatar (allievo) */
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: N100, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { fontSize: 15, fontWeight: '600', color: NAVY },

  /* multi entries */
  entryCard: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, marginBottom: 12, ...ELEV },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, backgroundColor: N50 },
  chipTxt: { fontSize: 14, fontWeight: '500', color: INK },
  durRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  durPill: { paddingVertical: 7, paddingHorizontal: 14, borderRadius: 999, backgroundColor: '#F1F2F4' },
  durPillOn: { backgroundColor: NAVY },
  durPillTxt: { fontSize: 13, fontWeight: '600', color: '#6A6A6A' },
  durPillTxtOn: { color: '#FFFFFF' },
  addGuide: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#FFFFFF', borderRadius: 18, paddingVertical: 16, marginBottom: 14, ...ELEV },
  addGuideTxt: { color: NAVY, fontSize: 15, fontWeight: '600' },

  /* footer */
  footer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, backgroundColor: '#fff' },
  sumKey: { fontSize: 12, color: MUTED, fontWeight: '500' },
  sumVal: { fontSize: 15, fontWeight: '600', color: NAVY, marginTop: 2 },
  sumSub: { fontSize: 13, fontWeight: '500', color: GREY, marginTop: 1 },
});
