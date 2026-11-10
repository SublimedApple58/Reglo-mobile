import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { FormSheet } from '../../../src/components/SheetScaffold';
import { ClayButton, ClayList } from '../../../src/components/clay';
import { SettingToggleRow, SettingValueRow } from '../../../src/components/SettingsRows';
import { clusterSettingsStore } from '../../../src/stores/clusterSettingsStore';
import { optionsPickerStore } from '../../../src/stores/optionsPickerStore';
import { bookingExceptionsDraftStore } from '../../../src/stores/bookingExceptionsDraftStore';
import type { BookingExceptionCases } from '../../../src/stores/bookingExceptionsDraftStore';
import { regloApi } from '../../../src/services/regloApi';
import type { InstructorClusterSettings, StudentBookingExceptions } from '../../../src/types/regloApi';
import { CLAY } from '../../../src/theme/clay';

const DURATION_OPTIONS = [30, 45, 60, 90, 120] as const;

/**
 * Prenotazione degli allievi dall'app (feature «solo eccezioni», stesso modello
 * della web app):
 * - `inherit`    → appBookingActors null + studentBookingExceptions null
 * - `students`   → «Attiva · solo allievi» (eccezioni lasciate come sono)
 * - `both`       → «Attiva · anche istruttori» (idem)
 * - `exceptions` → appBookingActors 'instructors' + eccezioni enabled true
 * - `off`        → appBookingActors 'instructors' + eccezioni enabled false
 * Per percorso: lo stesso per moto/auto/pro con appBookingActorsByPath +
 * studentBookingExceptionsByPath.
 */
type Choice = 'students' | 'both' | 'exceptions' | 'off';
type Mode = Choice | 'inherit' | 'perPath';
type BucketMode = Choice | 'inherit';
type Bucket = 'moto' | 'auto' | 'pro';
type Actor = 'students' | 'instructors' | 'both';

const INHERIT = '_inherit';
const PER_PATH = '_per_path';

const CHOICE_LABEL: Record<Choice, string> = {
  students: 'Attiva · solo allievi',
  both: 'Attiva · anche istruttori',
  exceptions: 'Solo eccezioni',
  off: 'Disattiva',
};
const CHOICE_HINT: Record<Choice, string> = {
  students: 'Gli allievi prenotano quando vogliono',
  both: 'Gli allievi quando vogliono, e anche tu dall’app',
  exceptions: 'Gli allievi prenotano solo nei casi che scegli',
  off: 'Le guide le fissi solo tu',
};
/** Valore corto a destra della riga (il valore lungo non ci sta). */
const CHOICE_SHORT: Record<Choice, string> = {
  students: 'Attiva',
  both: 'Attiva',
  exceptions: 'Solo eccezioni',
  off: 'Disattiva',
};

const PATH_BUCKETS: { key: Bucket; label: string; cats: string }[] = [
  { key: 'moto', label: 'Percorso moto', cats: 'AM · A1 · A2 · A' },
  { key: 'auto', label: 'Percorso auto', cats: 'B · BE' },
  { key: 'pro', label: 'Percorso professionali', cats: 'C · CE · D · DE' },
];

const MODE_LABEL: Record<string, string> = {
  manual_full: 'Manuale totale',
  manual_engine: 'Manuale + motore',
};

/** Casi spenti di partenza se né il gruppo né l'autoscuola ne hanno. */
const NO_CASES: BookingExceptionCases = { slotFill: true, groupSeats: true, lastMinute: false, lastMinuteHours: 24 };

const anyCase = (c: BookingExceptionCases) => c.slotFill || c.groupSeats || c.lastMinute;
const toCases = (e: StudentBookingExceptions | undefined | null): BookingExceptionCases | null =>
  e ? { slotFill: e.slotFill, groupSeats: e.groupSeats, lastMinute: e.lastMinute, lastMinuteHours: e.lastMinuteHours } : null;

function choiceOf(actor: string | undefined | null, exc: StudentBookingExceptions | undefined | null): Choice {
  if (actor === 'students' || actor === 'both') return actor;
  return exc?.enabled && anyCase(exc) ? 'exceptions' : 'off';
}

function casesSummary(c: BookingExceptionCases) {
  const parts: string[] = [];
  if (c.slotFill) parts.push('Annullamenti');
  if (c.groupSeats) parts.push('Guide di gruppo');
  if (c.lastMinute) parts.push(`Ultimo minuto ${c.lastMinuteHours} h`);
  return parts.length ? parts.join(', ') : 'Nessun caso acceso';
}

function casesCount(c: BookingExceptionCases) {
  const n = [c.slotFill, c.groupSeats, c.lastMinute].filter(Boolean).length;
  return n === 0 ? 'Nessuno' : n === 1 ? '1 caso' : `${n} casi`;
}

const actorOf = (c: Choice): Actor => (c === 'students' || c === 'both' ? c : 'instructors');
const withEnabled = (c: BookingExceptionCases, enabled: boolean): StudentBookingExceptions => ({ enabled, ...c });

// Impostazioni del gruppo lette dal server: le eccezioni non sono nel draft di
// «Il mio gruppo». Cache di modulo così riaprendo il foglio sono già pronte.
type Loaded = {
  settings: InstructorClusterSettings;
  companyActors: Actor;
  companyExceptions: StudentBookingExceptions | null;
};
let cache: Loaded | null = null;

export default function BookingRulesScreen() {
  const router = useRouter();
  const data = useSyncExternalStore(clusterSettingsStore.subscribe, clusterSettingsStore.get);

  const [loaded, setLoaded] = useState<Loaded | null>(cache);
  const [loadError, setLoadError] = useState(false);
  const [mode, setMode] = useState<Mode>('inherit');
  const [cases, setCases] = useState<BookingExceptionCases>(NO_CASES);
  const [bucketMode, setBucketMode] = useState<Record<Bucket, BucketMode>>({ moto: 'inherit', auto: 'inherit', pro: 'inherit' });
  const [bucketCases, setBucketCases] = useState<Record<Bucket, BookingExceptionCases>>({ moto: NO_CASES, auto: NO_CASES, pro: NO_CASES });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seeded = useRef(false);
  // Dopo il picker, «Solo eccezioni» apre il sotto-foglio al ritorno del focus.
  const pendingCases = useRef<'simple' | Bucket | null>(null);

  useEffect(() => {
    let alive = true;
    regloApi
      .getInstructorSettings()
      .then((res) => {
        if (!alive) return;
        const next: Loaded = {
          settings: res.settings,
          companyActors: res.companyDefaults.appBookingActors,
          companyExceptions: res.companyDefaults.studentBookingExceptions ?? null,
        };
        cache = next;
        setLoaded(next);
      })
      .catch(() => {
        if (alive && !cache) setLoadError(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  // Bozza locale seminata una volta dal server.
  useEffect(() => {
    if (!loaded || seeded.current) return;
    seeded.current = true;
    const st = loaded.settings;
    const baseCases = toCases(st.studentBookingExceptions) ?? toCases(loaded.companyExceptions) ?? NO_CASES;
    setCases(baseCases);
    const byActor = st.appBookingActorsByPath ?? {};
    const byExc = st.studentBookingExceptionsByPath ?? {};
    const perPath = Boolean(byActor.moto || byActor.auto || byActor.pro);
    const bm = { moto: 'inherit', auto: 'inherit', pro: 'inherit' } as Record<Bucket, BucketMode>;
    const bc = { moto: baseCases, auto: baseCases, pro: baseCases } as Record<Bucket, BookingExceptionCases>;
    for (const { key } of PATH_BUCKETS) {
      bc[key] = toCases(byExc[key]) ?? baseCases;
      if (byActor[key]) bm[key] = choiceOf(byActor[key], byExc[key] ?? st.studentBookingExceptions ?? loaded.companyExceptions);
    }
    setBucketMode(bm);
    setBucketCases(bc);
    if (perPath) setMode('perPath');
    else if (st.appBookingActors) setMode(choiceOf(st.appBookingActors, st.studentBookingExceptions ?? loaded.companyExceptions));
    else setMode('inherit');
  }, [loaded]);

  const openCases = useCallback(
    (target: 'simple' | Bucket) => {
      const bucket = target === 'simple' ? null : PATH_BUCKETS.find((b) => b.key === target) ?? null;
      bookingExceptionsDraftStore.set({
        subtitle: bucket ? `${bucket.label} · quando gli allievi prenotano da soli` : 'Quando gli allievi prenotano da soli',
        value: target === 'simple' ? cases : bucketCases[target],
        onConfirm: (v) => {
          if (target === 'simple') setCases(v);
          else setBucketCases((prev) => ({ ...prev, [target]: v }));
        },
      });
      router.push('/(tabs)/notes/booking-exceptions' as never);
    },
    [cases, bucketCases, router],
  );

  useFocusEffect(
    useCallback(() => {
      const target = pendingCases.current;
      if (!target) return;
      pendingCases.current = null;
      openCases(target);
    }, [openCases]),
  );

  if (!data) return <View style={s.empty} />;

  const {
    companyDefaults: cd,
    setAppBookingActors, setAppBookingActorsByPath,
    instructorBookingMode, setInstructorBookingMode,
    bookingSlotDurations, toggleDuration,
    roundedHoursOnly, setRoundedHoursOnly,
  } = data;

  const ready = Boolean(loaded);
  const companyChoice = loaded ? choiceOf(loaded.companyActors, loaded.companyExceptions) : null;
  const inheritLabel = companyChoice ? `Come l’autoscuola · ${CHOICE_LABEL[companyChoice]}` : 'Come l’autoscuola';
  const modeValue = instructorBookingMode ? MODE_LABEL[instructorBookingMode] : MODE_LABEL[cd.instructorBookingMode];

  const choiceOptions = (inherit: string) => [
    { value: INHERIT, label: inherit },
    ...(Object.keys(CHOICE_LABEL) as Choice[]).map((k) => ({ value: k, label: CHOICE_LABEL[k], subtitle: CHOICE_HINT[k] })),
  ];

  const pickMain = () => {
    optionsPickerStore.set({
      title: 'Prenotazione dall’app',
      hint: 'Come prenotano le guide i tuoi allievi',
      tone: 'mono',
      multi: false,
      options: [
        ...choiceOptions(inheritLabel),
        { value: PER_PATH, label: 'Per percorso', subtitle: 'Moto, auto e professionali separati' },
      ],
      selected: [mode === 'inherit' ? INHERIT : mode === 'perPath' ? PER_PATH : mode],
      onConfirm: ([v]) => {
        setError(null);
        if (v === PER_PATH) {
          if (mode !== 'perPath') {
            // Si parte dal valore semplice corrente su tutte e tre le righe.
            const seed: BucketMode = mode === 'inherit' ? 'inherit' : mode;
            setBucketMode({ moto: seed, auto: seed, pro: seed });
            setBucketCases({ moto: cases, auto: cases, pro: cases });
          }
          setMode('perPath');
          return;
        }
        const next = (v === INHERIT ? 'inherit' : v) as Mode;
        setMode(next);
        if (next === 'exceptions') pendingCases.current = 'simple';
      },
    });
    router.push('/(tabs)/notes/select-options' as never);
  };

  const pickBucket = (b: (typeof PATH_BUCKETS)[number]) => {
    optionsPickerStore.set({
      title: b.label,
      hint: b.cats,
      tone: 'mono',
      multi: false,
      options: choiceOptions('Come l’autoscuola'),
      selected: [bucketMode[b.key] === 'inherit' ? INHERIT : bucketMode[b.key]],
      onConfirm: ([v]) => {
        setError(null);
        const next = (v === INHERIT ? 'inherit' : v) as BucketMode;
        setBucketMode((prev) => ({ ...prev, [b.key]: next }));
        if (next === 'exceptions') pendingCases.current = b.key;
      },
    });
    router.push('/(tabs)/notes/select-options' as never);
  };

  const pickMode = () => {
    optionsPickerStore.set({
      title: 'Modalità istruttore',
      hint: 'Come prenoti tu per i tuoi allievi',
      tone: 'mono',
      multi: false,
      options: [
        { value: INHERIT, label: `Come l’autoscuola · ${MODE_LABEL[cd.instructorBookingMode]}` },
        { value: 'manual_full', label: MODE_LABEL.manual_full },
        { value: 'manual_engine', label: MODE_LABEL.manual_engine },
      ],
      selected: [instructorBookingMode ?? INHERIT],
      onConfirm: ([v]) => setInstructorBookingMode(v === INHERIT ? undefined : v),
    });
    router.push('/(tabs)/notes/select-options' as never);
  };

  const pickDurations = () => {
    optionsPickerStore.set({
      title: 'Durate delle guide',
      hint: 'Fra cui scelgono gli allievi',
      tone: 'mono',
      multi: true,
      confirmLabel: 'Conferma',
      options: DURATION_OPTIONS.map((d) => ({ value: String(d), label: `${d} minuti` })),
      selected: bookingSlotDurations.map(String),
      onConfirm: (values) => {
        const next = new Set(values.map(Number));
        for (const d of DURATION_OPTIONS) {
          if (next.has(d) !== bookingSlotDurations.includes(d)) toggleDuration(d);
        }
      },
    });
    router.push('/(tabs)/notes/select-options' as never);
  };

  // Una sola chiamata con tutti i campi della prenotazione; la UI si aggiorna
  // solo sulla risposta del server (niente optimistic update).
  const save = async () => {
    if (!loaded || saving) return;
    if (!bookingSlotDurations.length) {
      setError('Scegli almeno una durata.');
      return;
    }
    if (mode === 'exceptions' && !anyCase(cases)) {
      setError('Con «Solo eccezioni» accendi almeno un caso.');
      return;
    }
    if (mode === 'perPath' && PATH_BUCKETS.some((b) => bucketMode[b.key] === 'exceptions' && !anyCase(bucketCases[b.key]))) {
      setError('Ogni percorso con «Solo eccezioni» ha bisogno di almeno un caso.');
      return;
    }
    setError(null);

    let appBookingActors: Actor | null = null;
    let appBookingActorsByPath: Partial<Record<Bucket, Actor>> | null = null;
    let studentBookingExceptions: StudentBookingExceptions | null | undefined;
    let studentBookingExceptionsByPath: Partial<Record<Bucket, StudentBookingExceptions>> | null = null;

    if (mode === 'inherit') {
      studentBookingExceptions = null;
    } else if (mode === 'students' || mode === 'both') {
      appBookingActors = mode; // eccezioni del gruppo lasciate come sono
    } else if (mode === 'exceptions' || mode === 'off') {
      appBookingActors = 'instructors';
      studentBookingExceptions = withEnabled(cases, mode === 'exceptions');
    } else {
      const prevByExc = loaded.settings.studentBookingExceptionsByPath ?? {};
      const actors: Partial<Record<Bucket, Actor>> = {};
      const excs: Partial<Record<Bucket, StudentBookingExceptions>> = {};
      for (const { key } of PATH_BUCKETS) {
        const m = bucketMode[key];
        if (m === 'inherit') continue;
        actors[key] = actorOf(m);
        if (m === 'exceptions' || m === 'off') excs[key] = withEnabled(bucketCases[key], m === 'exceptions');
        else if (prevByExc[key]) excs[key] = prevByExc[key]; // «Attiva»: eccezioni come sono
      }
      if (Object.keys(actors).length === 0) {
        // Tutte «Come l'autoscuola»: è il caso semplice.
        studentBookingExceptions = null;
      } else {
        appBookingActorsByPath = actors;
        studentBookingExceptionsByPath = Object.keys(excs).length ? excs : null;
      }
    }

    setSaving(true);
    try {
      const res = await regloApi.updateInstructorSettings({
        bookingSlotDurations,
        roundedHoursOnly,
        instructorBookingMode: instructorBookingMode as 'manual_full' | 'manual_engine' | undefined,
        appBookingActors,
        appBookingActorsByPath,
        ...(studentBookingExceptions !== undefined ? { studentBookingExceptions } : {}),
        studentBookingExceptionsByPath,
      });
      // Allinea la bozza di «Il mio gruppo»: gli altri fogli salvano anche
      // appBookingActors e non devono riportare indietro il valore vecchio.
      setAppBookingActors(res.appBookingActors ?? undefined);
      setAppBookingActorsByPath(res.appBookingActorsByPath ?? undefined);
      if (cache) cache = { ...cache, settings: { ...cache.settings, ...res } };
      router.back();
    } catch {
      setError('Non siamo riusciti a salvare. Riprova.');
    } finally {
      setSaving(false);
    }
  };

  const mainValue = !ready ? '' : mode === 'inherit' ? 'Autoscuola' : mode === 'perPath' ? 'Per percorso' : CHOICE_SHORT[mode];
  const mainSubtitle = !ready
    ? null
    : mode === 'inherit'
      ? inheritLabel
      : mode === 'perPath'
        ? 'Moto, auto e professionali separati'
        : mode === 'exceptions'
          ? casesSummary(cases)
          : CHOICE_HINT[mode];

  return (
    <FormSheet
      title="Prenotazione guide"
      subtitle="Chi prenota, come e per quanto"
      busy={saving}
      testID="booking-rules-sheet"
      cta={
        <ClayButton
          title="Salva"
          loading={saving}
          disabled={!ready}
          onPress={saving ? undefined : save}
          testID="booking-rules-save"
        />
      }
    >
      <ClayList>
        <SettingValueRow
          title="Prenotazione dall’app"
          subtitle={loadError ? 'Non riusciamo a leggere le impostazioni' : mainSubtitle}
          value={mainValue}
          onPress={ready ? pickMain : () => {}}
          testID="booking-rules-actor"
        />
        {ready && mode === 'exceptions' ? (
          <SettingValueRow
            title="Quando prenotano"
            value={casesCount(cases)}
            onPress={() => openCases('simple')}
            testID="booking-rules-cases"
          />
        ) : null}
        {ready && mode === 'perPath'
          ? PATH_BUCKETS.flatMap((b) => {
              const m = bucketMode[b.key];
              const rows = [
                <SettingValueRow
                  key={b.key}
                  title={b.label}
                  subtitle={m === 'exceptions' ? `${b.cats} · ${casesSummary(bucketCases[b.key])}` : b.cats}
                  value={m === 'inherit' ? 'Autoscuola' : CHOICE_SHORT[m]}
                  onPress={() => pickBucket(b)}
                  testID={`booking-rules-path-${b.key}`}
                />,
              ];
              if (m === 'exceptions') {
                rows.push(
                  <SettingValueRow
                    key={`${b.key}-cases`}
                    title="Quando prenotano"
                    value={casesCount(bucketCases[b.key])}
                    onPress={() => openCases(b.key)}
                    testID={`booking-rules-path-${b.key}-cases`}
                  />,
                );
              }
              return rows;
            })
          : null}
      </ClayList>

      <ClayList style={s.section}>
        <SettingValueRow
          title="Durate"
          subtitle="Fra cui scelgono gli allievi"
          value={bookingSlotDurations.length ? `${bookingSlotDurations.join(', ')} min` : 'Nessuna'}
          onPress={pickDurations}
          testID="booking-rules-durations"
        />
        <SettingValueRow
          title="Modalità istruttore"
          subtitle={!instructorBookingMode ? 'Come l’autoscuola' : null}
          value={modeValue}
          onPress={pickMode}
          testID="booking-rules-mode"
        />
        <SettingToggleRow
          title="Solo orari tondi"
          subtitle="Guide solo a ore piene, come 9:00 e 10:00"
          value={roundedHoursOnly}
          onValueChange={setRoundedHoursOnly}
        />
      </ClayList>

      {error ? <Text style={s.error}>{error}</Text> : null}
    </FormSheet>
  );
}

const s = StyleSheet.create({
  empty: { backgroundColor: '#FFFFFF', height: 1 },
  section: { marginTop: 22 },
  error: { fontSize: 14, lineHeight: 19, fontWeight: '500', color: CLAY.ink, marginTop: 14, marginHorizontal: 4 },
});
