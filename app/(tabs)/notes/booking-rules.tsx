import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { FormSheet } from '../../../src/components/SheetScaffold';
import { ClayButton, ClayList } from '../../../src/components/clay';
import { SettingToggleRow, SettingValueRow } from '../../../src/components/SettingsRows';
import { clusterSettingsStore } from '../../../src/stores/clusterSettingsStore';
import { optionsPickerStore } from '../../../src/stores/optionsPickerStore';

const DURATION_OPTIONS = [30, 45, 60, 90, 120] as const;

const ACTOR_LABEL: Record<string, string> = {
  students: 'Solo allievi',
  instructors: 'Solo istruttori',
  both: 'Entrambi',
};
const ACTOR_HINT: Record<string, string> = {
  students: 'Prenotano gli allievi dall’app',
  instructors: 'Prenoti tu per loro',
  both: 'Gli allievi e tu',
};
/** Nel picker «nessun override» e «per percorso» hanno un valore proprio. */
const INHERIT = '_inherit';
const PER_PATH = '_per_path';

// REG-426: le tre righe del pannello "differenzia per percorso". Ogni riga può
// ereditare ("Default autoscuola") oppure forzare un valore (usa ACTOR_OPTIONS).
const PATH_BUCKETS = [
  { key: 'moto' as const, label: 'Percorso moto', cats: 'AM · A1 · A2 · A' },
  { key: 'auto' as const, label: 'Percorso auto', cats: 'B · BE' },
  { key: 'pro' as const, label: 'Percorso professionali', cats: 'C · CE · D · DE' },
];

const MODE_LABEL: Record<string, string> = {
  manual_full: 'Manuale totale',
  manual_engine: 'Manuale + motore',
};

export default function BookingRulesScreen() {
  const router = useRouter();
  const data = useSyncExternalStore(clusterSettingsStore.subscribe, clusterSettingsStore.get);
  // Modalità "differenzia per percorso" — apre il pannello moto/auto/pro. Locale
  // (hook prima dell'early return); si inizializza da eventuali override dal BE.
  const [perPathOpen, setPerPathOpen] = useState(false);
  const seededRef = useRef(false);
  useEffect(() => {
    if (data && !seededRef.current) {
      const bp = data.appBookingActorsByPath;
      if (bp && (bp.moto || bp.auto || bp.pro)) setPerPathOpen(true);
      seededRef.current = true;
    }
  }, [data]);
  if (!data) return <View style={s.empty} />;

  const {
    companyDefaults: cd,
    appBookingActors, setAppBookingActors,
    appBookingActorsByPath, setAppBookingActorsByPath,
    instructorBookingMode, setInstructorBookingMode,
    bookingSlotDurations, toggleDuration,
    roundedHoursOnly, setRoundedHoursOnly,
    saving, onSave,
  } = data;

  const byPath = appBookingActorsByPath ?? {};

  // Entra in "differenzia": semina le 3 righe col valore semplice corrente (se
  // concreto), altrimenti tutte su "Default autoscuola". Apre il pannello.
  const enterPerPath = () => {
    if (appBookingActors) {
      setAppBookingActorsByPath({ moto: appBookingActors, auto: appBookingActors, pro: appBookingActors });
    } else {
      setAppBookingActorsByPath({});
    }
    setPerPathOpen(true);
  };
  // Torna a un valore semplice: azzera gli override, chiude il pannello.
  const pickSimple = (value: string | undefined) => {
    setAppBookingActors(value);
    setAppBookingActorsByPath(undefined);
    setPerPathOpen(false);
  };
  // Imposta una riga: "Default" rimuove la chiave (eredita), altrimenti forza.
  const pickPath = (bucket: 'moto' | 'auto' | 'pro', value: string | undefined) => {
    const next: { moto?: string; auto?: string; pro?: string } = { ...byPath };
    if (value) next[bucket] = value;
    else delete next[bucket];
    setAppBookingActorsByPath(next);
  };

  const inherit = (label: string | undefined) => (label ? `Come l’autoscuola · ${label}` : 'Come l’autoscuola');
  const actorValue = perPathOpen ? 'Per percorso' : appBookingActors ? ACTOR_LABEL[appBookingActors] : inherit(ACTOR_LABEL[cd.appBookingActors]);
  const modeValue = instructorBookingMode ? MODE_LABEL[instructorBookingMode] : inherit(MODE_LABEL[cd.instructorBookingMode]);

  const actorOptions = (inheritLabel: string) => [
    { value: INHERIT, label: inheritLabel },
    ...Object.keys(ACTOR_LABEL).map((k) => ({ value: k, label: ACTOR_LABEL[k], subtitle: ACTOR_HINT[k] })),
  ];

  // Scelte da lista: il picker unico (form sheet sopra questo foglio).
  const pickActor = () => {
    optionsPickerStore.set({
      title: 'Chi prenota',
      hint: 'Chi può prenotare le guide con te',
      tone: 'mono',
      multi: false,
      options: [
        ...actorOptions(inherit(ACTOR_LABEL[cd.appBookingActors])),
        { value: PER_PATH, label: 'Per percorso', subtitle: 'Moto, auto e professionali separati' },
      ],
      selected: [perPathOpen ? PER_PATH : appBookingActors ?? INHERIT],
      onConfirm: ([v]) => {
        if (v === PER_PATH) {
          if (!perPathOpen) enterPerPath();
        } else pickSimple(v === INHERIT ? undefined : v);
      },
    });
    router.push('/(tabs)/notes/select-options' as never);
  };
  const pickBucket = (bucket: (typeof PATH_BUCKETS)[number]) => {
    optionsPickerStore.set({
      title: bucket.label,
      hint: bucket.cats,
      tone: 'mono',
      multi: false,
      options: actorOptions('Come l’autoscuola'),
      selected: [byPath[bucket.key] ?? INHERIT],
      onConfirm: ([v]) => pickPath(bucket.key, v === INHERIT ? undefined : v),
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
        { value: INHERIT, label: inherit(MODE_LABEL[cd.instructorBookingMode]) },
        { value: 'manual_full', label: MODE_LABEL.manual_full },
        { value: 'manual_engine', label: MODE_LABEL.manual_engine },
      ],
      selected: [instructorBookingMode ?? INHERIT],
      onConfirm: ([v]) => setInstructorBookingMode(v === INHERIT ? undefined : v),
    });
    router.push('/(tabs)/notes/select-options' as never);
  };

  // Durate: scelta multipla nel picker; alla conferma si allinea la selezione.
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

  return (
    // REG-639 (giro dopo la prova sull'iPhone, 28/10): niente chip a griglia.
    // Ogni scelta è una riga col valore che apre il picker (durate a scelta
    // multipla): il foglio resta corto (Tiziano 28/10). Form sheet alto quanto il contenuto: con il
    // percorso aperto si allunga e scorre il foglio stesso (§13.2.1).
    <FormSheet
      title="Prenotazione guide"
      subtitle="Chi prenota, come e per quanto"
      busy={saving}
      testID="booking-rules-sheet"
      cta={
        <ClayButton
          title="Salva"
          loading={saving}
          onPress={saving ? undefined : async () => { await onSave(); router.back(); }}
          testID="booking-rules-save"
        />
      }
    >
      <ClayList>
        <SettingValueRow title="Chi prenota" value={perPathOpen ? 'Per percorso' : actorValue.replace('Come l’autoscuola · ', '')} subtitle={!perPathOpen && !appBookingActors ? 'Come l’autoscuola' : null} onPress={pickActor} testID="booking-rules-actor" />
        {perPathOpen
          ? PATH_BUCKETS.map((b) => (
              <SettingValueRow
                key={b.key}
                title={b.label}
                subtitle={b.cats}
                value={byPath[b.key] ? ACTOR_LABEL[byPath[b.key]!] : 'Autoscuola'}
                onPress={() => pickBucket(b)}
                testID={`booking-rules-path-${b.key}`}
              />
            ))
          : null}
        <SettingValueRow
          title="Durate"
          subtitle="Fra cui scelgono gli allievi"
          value={bookingSlotDurations.length ? `${bookingSlotDurations.join(', ')} min` : 'Nessuna'}
          onPress={pickDurations}
          testID="booking-rules-durations"
        />
        <SettingValueRow title="Modalità istruttore" value={modeValue.replace('Come l’autoscuola · ', '')} subtitle={!instructorBookingMode ? 'Come l’autoscuola' : null} onPress={pickMode} testID="booking-rules-mode" />
      </ClayList>

      <ClayList style={s.section}>
        <SettingToggleRow
          title="Solo orari tondi"
          subtitle="Guide solo a ore piene, come 9:00 e 10:00"
          value={roundedHoursOnly}
          onValueChange={setRoundedHoursOnly}
        />
      </ClayList>
    </FormSheet>
  );
}

const s = StyleSheet.create({
  empty: { backgroundColor: '#FFFFFF', height: 1 },
  section: { marginTop: 22 },
});
