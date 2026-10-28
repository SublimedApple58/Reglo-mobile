import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated from 'react-native-reanimated';

import { bookingSheetStore } from '../../stores/bookingSheetStore';
import { timePickerStore } from '../../stores/timePickerStore';
import { dayPickerStore } from '../../stores/dayPickerStore';
import { studentPickerStore } from '../../stores/studentPickerStore';
import { locationPickerStore } from '../../stores/locationPickerStore';
import { locationFormStore } from '../../stores/locationFormStore';
import { optionsPickerPath, optionsPickerStore } from '../../stores/optionsPickerStore';
import {
  followCarConflictPath,
  followCarConflictStore,
  type ConflictResolvedEntry,
} from '../../stores/followCarConflictStore';
import { regloApi } from '../../services/regloApi';
import { useLocations } from '../../hooks/queries/useLocations';
import type { CheckInstructorBookingBatchResult, MobileBookingOptions } from '../../types/regloApi';
import { FormSheet } from '../SheetScaffold';
import { Avatar, ClayButton, ClayList, ClayListRow, ClaySection, ClayToggle } from '../clay';
import { CLAY } from '../../theme/clay';
import { SOFT_EXIT, SOFT_LAYOUT, SOFT_SWAP_IN, SOFT_SWAP_OUT, softEnter } from '../../utils/motion';
import { LESSON_TYPE_OPTIONS } from '../../utils/lessonTypes';
import { loadLastBookingSelection, saveLastBookingSelection, type LastBookingSelection } from '../../utils/lastBookingSelection';
import { isMotoLicenseCategory, vehicleServesStudent, licenseCategoryLabel, transmissionLabel } from '../../utils/license';
import { MOTO_LESSON_TYPES, MOTO_LESSON_TYPE_LABELS, MOTO_LESSON_TYPE_HINTS, type MotoLessonType } from '../../utils/motoLessonType';

type Entry = { id: string; date: Date; startTime: Date; duration: number };

/** Conferme già date dall'utente, che viaggiano con la richiesta. */
type BookingConfirmFlags = { skipWeeklyLimit?: boolean; confirmNoBuffer?: boolean };

/**
 * Risposte del backend che **non sono errori**: sono domande a cui l'utente può
 * rispondere "procedi", e la risposta torna indietro come flag (REG-509).
 *
 * Prima esisteva solo il ramo del limite settimanale, cablato dentro
 * `runBooking`; tutto il resto finiva nell'alert generico «Errore … OK», che ha
 * un solo bottone. Risultato: la conferma della pausa (`LESSON_BUFFER_CONFIRM`,
 * REG-484) si vedeva ma non si poteva dare, e la guida restava impossibile da
 * prenotare da app — mentre da web funzionava. Tenerle in un elenco evita che
 * il prossimo codice di conferma aggiunto lato server nasca di nuovo muto.
 */
const CONFIRMABLE_CODES: Array<{
  code: string;
  title: string;
  confirmLabel: string;
  fallback: string;
  flag: BookingConfirmFlags;
}> = [
  {
    code: 'WEEKLY_LIMIT_CONFIRM',
    title: 'Limite settimanale',
    confirmLabel: 'Procedi',
    fallback: "L'allievo ha raggiunto il limite settimanale. Vuoi procedere comunque?",
    flag: { skipWeeklyLimit: true },
  },
  {
    code: 'LESSON_BUFFER_CONFIRM',
    title: 'Pausa tra le guide',
    confirmLabel: 'Prenota comunque',
    fallback: 'Non avrai tempo per una pausa. Vuoi procedere comunque?',
    flag: { confirmNoBuffer: true },
  },
];



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


/* ───────── Shared booking form (used by the new-booking route + quick-book) ─────────
 * REG-639 clay: da solo è un `FormSheet` (titolo, riepilogo come sottotitolo,
 * CTA in fondo). `embedded` = dentro il FormSheet di quick-book: rende solo il
 * contenuto e, in coda, riepilogo + CTA (l'ultima cosa del foglio ospite), così
 * l'ospite tiene testata e segmentato e i due moduli si scambiano in
 * dissolvenza col `contentKey`. Righe = ClayListRow (titolo = campo,
 * sottotitolo = valore), niente icone. When the store carries
 * `presetStartMinutes` (released-scrub position), the start time is seeded to it
 * instead of the current clock time. */
export function BookingForm({ embedded = false }: { embedded?: boolean }) {
  const router = useRouter();
  const data = useSyncExternalStore(bookingSheetStore.subscribe, bookingSheetStore.get);

  const [studentId, setStudentId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [followVehicleId, setFollowVehicleId] = useState('');
  const [extraMotoVehicleIds, setExtraMotoVehicleIds] = useState<string[]>([]);
  const [motoLessonType, setMotoLessonType] = useState<MotoLessonType | null>(null);
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

  // Luogo (REG-392): risolvi il NOME dal locationId contro la lista luoghi
  // fresca (cache-first), invece di dipendere dal nome propagato nel bootstrap
  // — così la label è corretta anche con un bootstrap in cache leggermente vecchio.
  const { data: locList } = useLocations();
  const locById = useMemo(
    () => new Map((locList ?? []).map((l) => [l.id, l])),
    [locList],
  );
  const resolvedLocation = locationId ? locById.get(locationId) : null;
  const locationLabel = resolvedLocation?.name ?? locationName ?? "Sede dell'autoscuola";
  const locationSubLabel = resolvedLocation?.address ?? locationAddress ?? null;

  if (!data) return <View style={s.empty} />;
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
  // Tipo guida moto: solo per le guide moto (fuori → null).
  const effectiveMotoLessonType = primaryIsMoto ? motoLessonType : null;

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
        // Luogo di default dell'allievo (REG-392): alla selezione precompila il
        // Luogo col suo default, SOVRASCRIVENDO il valore corrente. Se l'allievo
        // non ha un default, torna alla sede. Una modifica manuale successiva
        // resta (questo scatta solo al cambio allievo).
        if (st?.defaultLocationId) {
          setLocationId(st.defaultLocationId);
          setLocationName(st.defaultLocationName ?? null);
          setLocationAddress(null);
        } else {
          setLocationId(defaultLocation?.id ?? null);
          setLocationName(defaultLocation?.name ?? null);
          setLocationAddress(defaultLocation?.address ?? null);
        }
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
      selectedDate: toYMD(current), markedDates, monthsBack: 3, monthsCount,
      allowPast: true, title: 'Seleziona data', onSelect: (ymd) => onSelect(fromYMD(ymd)),
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
    doBook: (flags: BookingConfirmFlags) => Promise<unknown>,
    successMessage: (result: unknown) => string,
    initialFlags: BookingConfirmFlags = {},
    /** Chiamata dopo l'alert di errore vero (non sulle domande di conferma):
     *  serve alla multipla per riportare l'utente sulle date da sistemare. */
    onFailure?: () => void,
  ) => {
    setPending(true);
    const settle = async (flags: BookingConfirmFlags = {}) => {
      try {
        const result = await doBook(flags);
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
        // Il BE non risponde "no": risponde "sei sicuro?". Queste NON sono
        // condizioni d'errore, sono domande — vanno riproposte con due
        // risposte, e la conferma si accumula alle precedenti (REG-509: una
        // guida può sforare il limite settimanale E lasciare senza pausa, e
        // confermando la prima non si deve perdere quella conferma).
        const confirmable = CONFIRMABLE_CODES.find((c) => c.code === payload?.code);
        if (confirmable) {
          const msg = typeof payload?.message === 'string' ? payload.message : confirmable.fallback;
          Alert.alert(confirmable.title, msg, [
            { text: 'Annulla', style: 'cancel', onPress: () => setPending(false) },
            {
              text: confirmable.confirmLabel,
              onPress: () => { void settle({ ...flags, ...confirmable.flag }); },
            },
          ]);
          return;
        }
        setPending(false);
        Alert.alert('Errore', err instanceof Error ? err.message : 'Errore nella prenotazione');
        onFailure?.();
      }
    };
    void settle(initialFlags);
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

  /**
   * Prenotazione nel passato: non è più bloccata a priori. Se lo start è già
   * trascorso chiediamo conferma nativa; su "Prenota comunque" si procede con
   * allowPast → il BE la crea. Ritorna true se ha mostrato l'alert (il caller
   * deve fermarsi e attendere la scelta).
   */
  const confirmPastIfNeeded = (start: Date, proceed: () => void): boolean => {
    if (start.getTime() >= Date.now()) return false;
    Alert.alert(
      'Prenotazione nel passato',
      `La guida del ${fmtDay(start)} alle ${fmtTime(start)} è già passata. Vuoi prenotarla comunque?`,
      [
        { text: 'Annulla', style: 'cancel' },
        { text: 'Prenota comunque', onPress: proceed },
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
    const inCurrentWeek = isoWeekStartUTC(start) === isoWeekStartUTC(new Date()) ? 1 : 0;
    const submit = (allowPast: boolean) => {
      const book = (skipWeeklyLimit = false) => runBooking((flags) => regloApi.confirmInstructorBooking({
        studentId, startsAt: start.toISOString(), endsAt: end.toISOString(), instructorId,
        vehicleId: vehiclesEnabled ? vehicleId : null,
        followVehicleId: effectiveFollowVehicleId || null,
        extraMotoVehicleIds: effectiveExtraMotoVehicleIds,
        motoLessonType: effectiveMotoLessonType,
        locationId, ...typesPayload,
        ...(flags.skipWeeklyLimit ? { skipWeeklyLimitCheck: true } : {}),
        ...(flags.confirmNoBuffer ? { confirmNoBuffer: true } : {}),
        ...(allowPast ? { allowPast: true } : {}),
      }), () => 'Guida prenotata.', { skipWeeklyLimit });
      if (confirmWeeklyLimitIfNeeded(inCurrentWeek, () => book(true))) return;
      book();
    };
    if (confirmPastIfNeeded(start, () => submit(true))) return;
    submit(false);
  };

  /** Quel che tutte le date del batch hanno in comune (l'auto al seguito e' la
   *  sola cosa che poi puo' cambiare data per data — REG-608). */
  const batchSharedPayload = () => ({
    instructorId,
    vehicleId: vehiclesEnabled ? vehicleId : null,
    followVehicleId: effectiveFollowVehicleId || null,
    extraMotoVehicleIds: effectiveExtraMotoVehicleIds,
  });

  /** La prenotazione vera: una sola strada, sia col batch intatto sia con le
   *  auto sostituite nel foglio dei conflitti. */
  const submitBatch = (
    slots: ConflictResolvedEntry[],
    opts: { allowPast: boolean; skipWeeklyLimit: boolean; onFailure?: () => void },
  ) =>
    runBooking(
      (flags) => regloApi.confirmInstructorBookingBatch({
        studentId, ...batchSharedPayload(),
        motoLessonType: effectiveMotoLessonType,
        ...typesPayload,
        ...(flags.skipWeeklyLimit ? { skipWeeklyLimitCheck: true } : {}),
        ...(opts.allowPast ? { allowPast: true } : {}), entries: slots,
      }),
      (result) => `${(result as { created: number }).created} guide prenotate.`,
      { skipWeeklyLimit: opts.skipWeeklyLimit },
      opts.onFailure,
    );

  /** Apre «Auto al seguito occupata» con l'esito della prova a vuoto. */
  const openConflictSheet = (
    check: CheckInstructorBookingBatchResult,
    opts: { allowPast: boolean; skipWeeklyLimit: boolean },
  ) => {
    followCarConflictStore.set({
      entries: check.entries,
      freeCount: check.freeCount,
      conflictCount: check.conflictCount,
      suggestedForAll: check.suggestedForAll,
      onConfirm: (resolved) =>
        submitBatch(resolved, {
          ...opts,
          // Qualcuno può aver preso lo slot fra la verifica e la conferma:
          // invece di buttare via tutto, si rifà la prova e si torna a scegliere.
          onFailure: () => void refreshConflictSheet(resolved, opts),
        }),
    });
    router.push(followCarConflictPath());
  };

  const checkBatch = (slots: ConflictResolvedEntry[]) =>
    regloApi.checkInstructorBookingBatch({ ...batchSharedPayload(), entries: slots });

  const refreshConflictSheet = async (
    slots: ConflictResolvedEntry[],
    opts: { allowPast: boolean; skipWeeklyLimit: boolean },
  ) => {
    try {
      const check = await checkBatch(slots);
      if (check.conflictCount) openConflictSheet(check, opts);
    } catch {
      // La prova a vuoto è un aiuto, non un passaggio obbligato: se non
      // risponde, l'errore della creazione l'utente l'ha già letto.
    }
  };

  /**
   * Prova a vuoto, poi prenota: se tutte le date sono libere non si vede
   * niente di nuovo (il caso normale). Altrimenti si apre il foglio dove si
   * scambia l'auto al seguito occupata — il punto è trovare un'altra auto,
   * non un'altra data (REG-608).
   */
  const runBatchCheck = async (
    slots: ConflictResolvedEntry[],
    opts: { allowPast: boolean; skipWeeklyLimit: boolean },
  ) => {
    setPending(true);
    let check: CheckInstructorBookingBatchResult | null = null;
    try {
      check = await checkBatch(slots);
    } catch {
      // Backend che non conosce ancora la prova a vuoto (o rete che cade): si
      // prenota come si è sempre fatto, tutto-o-niente. Mai bloccare una
      // prenotazione per una verifica che è solo un aiuto.
      check = null;
    }
    if (!check || !check.conflictCount) {
      submitBatch(slots, opts);
      return;
    }
    setPending(false);
    openConflictSheet(check, opts);
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
    const nowWeek = isoWeekStartUTC(new Date());
    const currentWeekAdds = payloadEntries.filter((e) => isoWeekStartUTC(new Date(e.startsAt)) === nowWeek).length;
    const submit = (allowPast: boolean) => {
      // Il limite settimanale si chiede PRIMA della prova a vuoto: la prova
      // non lo controlla (è una conferma, non un conflitto di agenda).
      const go = (skipWeeklyLimit = false) =>
        void runBatchCheck(payloadEntries, { allowPast, skipWeeklyLimit });
      if (confirmWeeklyLimitIfNeeded(currentWeekAdds, () => go(true))) return;
      go();
    };
    // Se una o più guide del batch sono nel passato, conferma sulla più vecchia.
    const earliestPast = payloadEntries
      .map((e) => new Date(e.startsAt))
      .filter((d) => d.getTime() < Date.now())
      .sort((a, b) => a.getTime() - b.getTime())[0];
    if (earliestPast && confirmPastIfNeeded(earliestPast, () => submit(true))) return;
    submit(false);
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
  const motoLessonTypeValue = motoLessonType ? MOTO_LESSON_TYPE_LABELS[motoLessonType] : null;

  const locationValue = locationSubLabel ? `${locationLabel} · ${locationSubLabel}` : locationLabel;
  const studentValue = selectedStudentLabel
    ? [selectedStudentLabel, selectedStudentSubtitle].filter(Boolean).join(' · ')
    : 'Seleziona allievo';
  // Mentre prenota il modulo è fermo: le righe non aprono nulla.
  const guard = (fn: () => void) => () => { if (!pending) fn(); };
  const updateEntry = (id: string, patch: Partial<Entry>) =>
    setEntries((p) => p.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  const openEntryDuration = (entry: Entry) => {
    optionsPickerStore.set({
      title: 'Durata', multi: false, selected: [String(entry.duration)],
      options: durations.map((d) => ({ value: String(d), label: `${d} min` })),
      onConfirm: (v) => { const n = Number(v[0]); if (!Number.isNaN(n)) updateEntry(entry.id, { duration: n }); },
    });
    router.push(optionsPickerPath());
  };
  const addEntry = () => {
    const last = entries[entries.length - 1];
    const lastDuration = last?.duration ?? duration;
    const newDate = last ? new Date(last.date) : new Date(date);
    const newTime = last ? new Date(last.startTime.getTime() + lastDuration * 60 * 1000) : normalizeToQuarter(new Date());
    setEntries((p) => [...p, { id: String(p.length) + '-' + newDate.getTime(), date: newDate, startTime: newTime, duration: lastDuration }]);
  };

  const body = (
    <>
      {/* Allievo — priorità massima, lista a sé */}
      <ClayList>
        <ClayListRow
          title="Allievo"
          subtitle={studentValue}
          leading={selectedStudentLabel ? <Avatar userId={studentId || null} name={selectedStudentLabel} size={46} /> : undefined}
          onPress={guard(openStudentPicker)}
          dimmed={!studentOptions.length}
          testID="booking-student"
        />
      </ClayList>

      {/* Quando: una guida (giorno · ora · durata) o più guide insieme */}
      <ClaySection title="Quando">
        <ClayList>
          <ClayListRow
            title="Prenotazione multipla"
            subtitle="Aggiungi più guide insieme"
            trailing={
              <ClayToggle value={multiMode} onValueChange={setMulti} disabled={pending} accessibilityLabel="Prenotazione multipla" testID="booking-multi-toggle" />
            }
          />
        </ClayList>
        <Animated.View key={multiMode ? 'multi' : 'single'} entering={SOFT_SWAP_IN} exiting={SOFT_SWAP_OUT}>
          {!multiMode ? (
            <ClayList style={s.gap}>
              <ClayListRow title="Giorno" subtitle={fmtDay(date)} onPress={guard(() => openDatePicker(date, setDate))} />
              <ClayListRow title="Ora" subtitle={fmtTime(startTime)} onPress={guard(() => openTimePicker(startTime, setStartTime))} />
              <ClayListRow title="Durata" subtitle={`${duration} min`} onPress={guard(openDuration)} />
            </ClayList>
          ) : (
            <>
              {entries.map((entry, i) => (
                <Animated.View key={entry.id} entering={softEnter()} exiting={SOFT_EXIT} layout={SOFT_LAYOUT}>
                  <ClaySection
                    title={`Guida ${i + 1}`}
                    style={s.entry}
                    action={
                      entries.length > 1 ? (
                        <Pressable
                          hitSlop={8}
                          onPress={guard(() => setEntries((p) => p.filter((e) => e.id !== entry.id)))}
                          accessibilityRole="button"
                          accessibilityLabel={`Togli la guida ${i + 1}`}
                          style={({ pressed }) => pressed && s.pressed}
                        >
                          <Text style={s.remove}>Togli</Text>
                        </Pressable>
                      ) : undefined
                    }
                  >
                    <ClayList>
                      <ClayListRow title="Giorno" subtitle={fmtDay(entry.date)} onPress={guard(() => openDatePicker(entry.date, (d) => updateEntry(entry.id, { date: d })))} />
                      <ClayListRow title="Ora" subtitle={fmtTime(entry.startTime)} onPress={guard(() => openTimePicker(entry.startTime, (d) => updateEntry(entry.id, { startTime: d })))} />
                      <ClayListRow title="Durata" subtitle={`${entry.duration} min`} onPress={guard(() => openEntryDuration(entry))} />
                    </ClayList>
                  </ClaySection>
                </Animated.View>
              ))}
              {entries.length < 20 ? (
                <Animated.View layout={SOFT_LAYOUT} style={s.add}>
                  <ClayButton title="Aggiungi guida" variant="secondary" compact onPress={addEntry} disabled={pending} testID="booking-add-entry" />
                </Animated.View>
              ) : null}
            </>
          )}
        </Animated.View>
      </ClaySection>

      {/* Dettagli — priorità inferiore */}
      <ClaySection title="Dettagli">
        <ClayList>
          <ClayListRow title="Luogo" subtitle={locationValue} onPress={guard(openLocationPicker)} />
          {vehiclesEnabled && studentId ? (
            <SoftRow title="Veicolo" subtitle={vehicleValue ?? 'Seleziona veicolo'} onPress={guard(openVehicle)} dimmed={!eligibleVehicles.length} />
          ) : null}
          {needFollowCar ? (
            <SoftRow title="Auto al seguito" subtitle={followCarValue ?? 'Seleziona auto al seguito'} onPress={guard(openFollowCar)} dimmed={!followCarOptions.length} />
          ) : null}
          {primaryIsMoto && extraMotoOptions.length ? (
            <SoftRow title="Moto aggiuntive" subtitle={extraMotosValue ?? 'Nessuna'} onPress={guard(openExtraMotos)} />
          ) : null}
          {primaryIsMoto ? (
            <SoftRow title="Tipo guida moto" subtitle={motoLessonTypeValue ?? 'Non specificato'} onPress={guard(openMotoLessonType)} />
          ) : null}
          {/* Il "Tipo di guida" generico (attività) è ridondante per le moto,
              che usano "Tipo guida moto" (birilli/strada) → nascosto se moto. */}
          {!primaryIsMoto ? (
            <SoftRow title="Tipo di guida" subtitle={typeValue} onPress={guard(openType)} />
          ) : null}
        </ClayList>
      </ClaySection>
    </>
  );

  const summary = summarySub ? `${summaryMain} · ${summarySub}` : summaryMain;
  const cta = (
    <ClayButton
      title={ctaLabel}
      loading={pending}
      disabled={!canConfirm}
      onPress={multiMode ? confirmMulti : confirmSingle}
      testID="booking-submit"
    />
  );

  // Dentro quick-book: il foglio (testata col segmentato, X) è dell'ospite;
  // qui solo contenuto + riepilogo + CTA, che restano l'ultima cosa del foglio.
  if (embedded) {
    return (
      <>
        {body}
        <View style={s.embeddedCta}>
          <Text style={s.summary} numberOfLines={1}>{summary}</Text>
          {cta}
        </View>
      </>
    );
  }

  return (
    <FormSheet
      title="Nuova prenotazione"
      subtitle={summary}
      onClose={() => { if (!pending) router.back(); }}
      cta={cta}
      testID="new-booking-sheet"
    >
      {body}
    </FormSheet>
  );
}

/** Riga che compare/sparisce (veicolo, moto…) in dissolvenza, mai di botto. */
function SoftRow(props: React.ComponentProps<typeof ClayListRow>) {
  return (
    <Animated.View entering={SOFT_SWAP_IN} exiting={SOFT_SWAP_OUT}>
      <ClayListRow {...props} />
    </Animated.View>
  );
}

const s = StyleSheet.create({
  empty: { backgroundColor: '#FFFFFF', height: 1 },
  gap: { marginTop: 14 },
  entry: { marginTop: 22 },
  add: { marginTop: 18 },
  remove: { fontSize: 15, fontWeight: '500', color: '#C13515' },
  pressed: { opacity: 0.55 },
  // Stessa distanza che `FormSheet` mette sopra la sua CTA.
  embeddedCta: { marginTop: 22 },
  summary: { fontSize: 14, color: CLAY.ink3, marginBottom: 10, paddingHorizontal: 4 },
});
