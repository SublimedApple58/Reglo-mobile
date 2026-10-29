import React, { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Alert, InteractionManager, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useNavigation, useRouter } from 'expo-router';

import { FormSheet } from '../../../src/components/SheetScaffold';
import { CLAY } from '../../../src/theme';
import Animated from 'react-native-reanimated';
import {
  ClayButton,
  ClayIconButton,
  ClayList,
  ClayListRow,
  ClaySearchField,
  ClaySegmented,
  ClaySurface,
  Icon3D,
  PlayGlyph,
  markClayRow,
} from '../../../src/components/clay';
import { ROAD_EXIT, ROAD_LAYOUT, ROAD_TEXT_IN, roadStagger } from '../../../src/road/motion';
import { regloApi } from '../../../src/services/regloApi';
import type { AutoscuolaStudent, RoadBriefing, RoadFreeOptions, RoadFreeVehicle } from '../../../src/types/regloApi';
import { vehicleServesStudent } from '../../../src/utils/license';
import { matchesPersonSearch } from '../../../src/utils/peopleSearch';
import { beginRoadEntry, roadPendingStart, SHEET_HANDOFF_MS } from '../../../src/road/entryFlow';
import {
  getRoadStudents,
  refreshRoadStudents,
  ROAD_FREE_PRIVACY_ROUTE,
  roadFreePreselect,
  roadFreeStore,
} from '../../../src/road/freeStartStore';
import { BriefingRows, RoadAvatar } from '../../../src/components/road/RoadTabParts';
import { enterRoadFree, hasSeenRoadPrivacy } from '../../../src/road/roadActions';
import { car34Art } from '../../../src/road/markerArt';
import { formatHm } from '../../../src/road/format';
import { chosenPlan, prefetchPlan } from '../../../src/road/planStore';
import { RoadPlanCard } from '../../../src/components/road/RoadPlanCard';

type Person = { id: string; name: string; detail: string; sortKey: string };

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

/** «9 h di guida» · «4,5 h» · «nessuna guida» dai minuti completati. */
function hoursLabel(minutes: number | undefined) {
  if (!minutes) return 'nessuna guida';
  const h = Math.round((minutes / 60) * 2) / 2;
  if (h < 0.5) return `${minutes} min di guida`;
  return `${h.toLocaleString('it-IT')} h di guida`;
}

function detailOf(st: AutoscuolaStudent | undefined, minutes: number | undefined, blocked = false) {
  // Prenotazioni bloccate: riga secondaria discreta, niente badge (come in agenda non impedisce di partire).
  if (blocked) return 'Prenotazioni bloccate';
  const license = st?.licenseCategory
    ? `Patente ${st.licenseCategory}${st.transmission === 'automatic' ? ' automatica' : ''}`
    : null;
  return [license, hoursLabel(minutes)].filter(Boolean).join(' · ');
}

/**
 * REG-638 Road libero — «Avvia guida» in due passi (anteprime avvia/1-2).
 * 1. «Con chi guidi?»: ricerca in cima, prima le tue ultime guide, poi tutti
 *    gli allievi in ordine alfabetico (regge decine di allievi).
 * 2. Riepilogo: allievo (Cambia), una riga con l'auto preselezionata (la
 *    tua) che apre la scelta con ricerca, durata, «Parti con …».
 * Form sheet alto quanto il contenuto: la radice è lo scroll del foglio
 * (design-system §13.2.1); la ricerca resta attaccata in cima.
 */
export default function AvviaGuidaSheet() {
  const router = useRouter();
  const navigation = useNavigation();
  const live = useSyncExternalStore(roadFreeStore.subscribe, roadFreeStore.get);
  const [options] = useState<RoadFreeOptions | null>(() => live);
  // Lista già pronta dal prefetch d'avvio (`refreshRoadStudents`): il foglio
  // si apre pieno, la riconferma arriva dopo l'animazione e ridisegna solo se
  // qualcosa è cambiato (fluidità 29/10).
  const [students, setStudents] = useState<AutoscuolaStudent[] | null>(() => getRoadStudents()?.students ?? null);
  const [minutes, setMinutes] = useState<Record<string, number>>(() => getRoadStudents()?.minutes ?? {});
  // Volto già scelto nella tab Road → si apre direttamente su «Parti con».
  const [preselected] = useState(() => roadFreePreselect.take());
  const [step, setStep] = useState<'student' | 'summary' | 'vehicle'>(preselected ? 'summary' : 'student');
  const [query, setQuery] = useState('');
  const [vehicleQuery, setVehicleQuery] = useState('');
  const [studentId, setStudentId] = useState<string | null>(preselected);
  const [briefings, setBriefings] = useState<Record<string, RoadBriefing | null>>(() => ({ ...(options?.briefings ?? {}) }));
  const [vehicleId, setVehicleId] = useState<string | null>(options?.defaultVehicleId ?? null);
  const [duration, setDuration] = useState<number>(options?.defaultDuration ?? 60);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    let alive = true;
    const task = InteractionManager.runAfterInteractions(() => {
      void refreshRoadStudents().then((res) => {
        if (!alive) return;
        if (!res) {
          setStudents((prev) => prev ?? []);
          return;
        }
        setStudents((prev) => (prev === res.students ? prev : res.students));
        setMinutes((prev) => (prev === res.minutes ? prev : res.minutes));
      });
    });
    return () => {
      alive = false;
      task.cancel();
    };
  }, []);

  // Briefing dell'allievo scelto: dai suggerimenti, altrimenti dal suo storico Road.
  useEffect(() => {
    if (!studentId || studentId in briefings) return;
    let alive = true;
    regloApi
      .getRoadForStudent(studentId)
      .then((res) => alive && setBriefings((b) => ({ ...b, [studentId]: res?.briefing ?? null })))
      .catch(() => alive && setBriefings((b) => ({ ...b, [studentId]: null })));
    return () => {
      alive = false;
    };
  }, [studentId, briefings]);

  // REG-649: il giro dell'allievo scelto per TUTTE le durate, così cambiare
  // durata non aspetta la rete (dalla tab arriva già quello di default).
  const durationsKey = (options?.durations ?? []).join(',');
  useEffect(() => {
    if (!studentId) return;
    const task = InteractionManager.runAfterInteractions(() => {
      for (const d of durationsKey ? durationsKey.split(',').map(Number) : [duration]) prefetchPlan(studentId, d);
    });
    return () => task.cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId, durationsKey]);

  const byId = useMemo(() => new Map((students ?? []).map((st) => [st.id, st])), [students]);
  const blocked = useMemo(() => new Set(options?.blockedStudentIds ?? []), [options]);

  const everyone: Person[] = useMemo(
    () =>
      (students ?? [])
        .filter((st) => st.status !== 'inactive' && st.studentPhase !== 'PATENTATO')
        .map((st) => {
          const name = `${st.firstName} ${st.lastName}`.trim();
          return { id: st.id, name, detail: detailOf(st, minutes[st.id], blocked.has(st.id)), sortKey: name.toLocaleLowerCase('it') };
        })
        .sort((a, b) => a.sortKey.localeCompare(b.sortKey, 'it')),
    [students, minutes, blocked],
  );

  const suggested: Person[] = useMemo(
    () =>
      (options?.recentStudents ?? []).map((r) => ({
        id: r.id,
        name: r.name,
        detail: detailOf(byId.get(r.id), minutes[r.id], blocked.has(r.id)),
        sortKey: r.name.toLocaleLowerCase('it'),
      })),
    [options, byId, minutes, blocked],
  );

  const q = query.trim();
  const shownSuggested = q ? [] : suggested;
  const shownAll = q ? everyone.filter((p) => matchesPersonSearch(p.name, q)) : everyone;

  const suggestion = options?.suggestions?.find((x) => x.id === studentId) ?? null;
  const selected =
    everyone.find((p) => p.id === studentId) ??
    suggested.find((p) => p.id === studentId) ??
    (suggestion ? { id: suggestion.id, name: suggestion.name, detail: suggestion.detail, sortKey: '' } : null);
  // Riga sotto il nome: quella del server (patente · Nª guida · ore) se c'è.
  const selectedDetail = blocked.has(studentId ?? '') ? 'Prenotazioni bloccate' : suggestion?.detail ?? selected?.detail ?? '';
  const selectedStudent = studentId ? byId.get(studentId) ?? null : null;

  const vehicles = useMemo(() => {
    const all = options?.vehicles ?? [];
    return selectedStudent ? all.filter((v) => vehicleServesStudent(v, selectedStudent)) : all;
  }, [options, selectedStudent]);

  // Cambia allievo → se l'auto scelta non va bene, la tua libera, poi la prima libera adatta.
  useEffect(() => {
    if (vehicles.some((v) => v.id === vehicleId && !v.busy)) return;
    setVehicleId((vehicles.find((v) => v.mine && !v.busy) ?? vehicles.find((v) => !v.busy))?.id ?? null);
  }, [vehicles, vehicleId]);

  const selectedVehicle = vehicles.find((v) => v.id === vehicleId) ?? null;

  const pick = useCallback((id: string) => {
    Haptics.selectionAsync().catch(() => undefined);
    setStudentId(id);
    setQuery('');
    setStep('summary');
  }, []);

  const onStart = async () => {
    if (!studentId || !vehicleId || starting) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    const input = { studentId, vehicleId, durationMin: duration, plan: chosenPlan(studentId, duration) };
    const start = async () => {
      const res = await enterRoadFree(input);
      if (res.kind === 'current') {
        Alert.alert('Hai già una guida adesso', 'Entra in Road su quella invece di crearne un\'altra.', [
          { text: 'Annulla', style: 'cancel' },
          { text: 'Entra in Road', onPress: () => void beginRoadEntry(router, res.lesson) },
        ]);
        return false;
      }
      return res.kind === 'started';
    };

    if (!(await hasSeenRoadPrivacy())) {
      // Primo ingresso sul dispositivo: prima l'informativa, poi parte da lì.
      roadPendingStart.set(start);
      router.back();
      setTimeout(() => router.push(ROAD_FREE_PRIVACY_ROUTE), SHEET_HANDOFF_MS);
      return;
    }
    setStarting(true);
    // Se parte, RoadController sostituisce la radice con /road: il foglio deve
    // sparire senza la sua scivolata nativa (il passaggio lo fa il velo, 240 ms).
    navigation.setOptions({ animation: 'none' });
    const ok = await start();
    setStarting(false);
    if (!ok) navigation.setOptions({ animation: 'default' });
    // Partita la sessione, RoadController sostituisce già la radice con /road
    // (il foglio se ne va con le tab): niente back/push qui, darebbero
    // «GO_BACK not handled» e un secondo passaggio di schermata.
    if (!ok) return;
  };

  const back = (to: 'student' | 'summary') => (
    <ClayIconButton icon="back" onPress={() => setStep(to)} accessibilityLabel="Indietro" />
  );
  const nowLabel = `Da adesso, ${formatHm(new Date().toISOString())}`;

  if (!options) {
    return (
      <FormSheet title="Avvia guida" subtitle={nowLabel}>
        <ActivityIndicator color="#111111" style={{ marginVertical: 30 }} />
      </FormSheet>
    );
  }

  const searchField = (value: string, onChange: (v: string) => void, placeholder: string, testID?: string) => (
    <ClaySearchField value={value} onChangeText={onChange} placeholder={placeholder} autoCapitalize="words" testID={testID} />
  );

  // ── Passo 1: con chi guidi? ────────────────────────────────────────────
  // Lista virtualizzata (fluidità 29/10): un elemento per gruppo (ultime
  // guide, poi una lettera alla volta), righe statiche in memo; il foglio
  // monta solo i gruppi a schermo.
  if (step === 'student') {
    const groups: PickGroup[] = [];
    if (shownSuggested.length) groups.push({ key: 'sugg', title: 'Le tue ultime guide', people: shownSuggested });
    groups.push({
      key: 'all',
      head: q ? `Risultati · ${shownAll.length}` : `Tutti gli allievi${students ? ` · ${shownAll.length}` : ''}`,
      status: !students ? 'loading' : !shownAll.length ? 'empty' : undefined,
      people: [],
    });
    if (students && shownAll.length) {
      if (q) groups.push({ key: 'results', people: shownAll });
      else for (const [letter, people] of byLetter(shownAll)) groups.push({ key: `l-${letter}`, letter, people });
    }
    return (
      <FormSheet
        title="Con chi guidi?"
        subtitle={nowLabel}
        testID="road-free-pick"
        list={{
          data: groups,
          keyExtractor: (g: PickGroup) => g.key,
          renderItem: ({ item }: { item: PickGroup }) => <PickGroupView group={item} onPick={pick} />,
          initialNumToRender: 4,
          maxToRenderPerBatch: 3,
          windowSize: 7,
        }}
      >
        {searchField(query, setQuery, 'Cerca allievo', 'road-free-search')}
      </FormSheet>
    );
  }

  // ── Scelta dell'auto (dal riepilogo): ricerca, la tua, libere, occupate ──
  if (step === 'vehicle') {
    const vq = vehicleQuery.trim();
    const match = (v: RoadFreeVehicle) => !vq || matchesPersonSearch(`${v.name} ${v.plate ?? ''}`, vq);
    const list = vehicles.filter(match);
    const mine = list.filter((v) => v.mine && !v.busy);
    const free = list.filter((v) => !v.mine && !v.busy);
    const busy = list.filter((v) => v.busy);
    const choose = (v: RoadFreeVehicle) => {
      Haptics.selectionAsync().catch(() => undefined);
      setVehicleId(v.id);
      setVehicleQuery('');
      setStep('summary');
    };
    const section = (title: string, items: RoadFreeVehicle[]) =>
      items.length ? (
        <Animated.View layout={ROAD_LAYOUT}>
          <Text style={s.section}>{title}</Text>
          <ClayList>
            {items.map((v) => (
              <VehicleRow key={v.id} vehicle={v} selected={v.id === vehicleId} onPress={v.busy ? undefined : () => choose(v)} />
            ))}
          </ClayList>
        </Animated.View>
      ) : null;
    const who = selected ? firstName(selected.name) : null;
    const lic = selectedStudent?.licenseCategory ? `patente ${selectedStudent.licenseCategory}` : null;
    return (
      <FormSheet
        // Indietro a sinistra, la X in alto a destra.
        leading={back('summary')}
        title="Che auto usi?"
        subtitle={[who ? `Per ${who}` : null, lic].filter(Boolean).join(' · ') || nowLabel}
        contentKey="vehicle"
        testID="road-free-vehicles"
      >
        {searchField(vehicleQuery, setVehicleQuery, 'Cerca per nome o targa')}
        {section(mine.length === 1 ? 'La tua' : 'Le tue', mine)}
        {section(mine.length ? `Altre auto · ${free.length}` : `Libere adesso · ${free.length}`, free)}
        {section('Occupate adesso', busy)}
        {!list.length ? (
          <Text style={s.empty}>{vq ? 'Nessuna auto trovata.' : 'Nessuna auto adatta a questo allievo.'}</Text>
        ) : null}
      </FormSheet>
    );
  }

  // ── Passo 2: «Parti con» (anteprima 3-avvio-fuori-agenda) ─────────────
  const briefing = studentId ? briefings[studentId] ?? null : null;
  const endsAt = new Date(Date.now() + duration * 60_000);
  const next = options.nextLesson ?? null;
  const clash = next && new Date(next.startsAt).getTime() < endsAt.getTime();
  const endLine = [
    `Fino alle ${formatHm(endsAt.toISOString())}`,
    next ? `alle ${formatHm(next.startsAt)} hai ${next.studentName ?? 'un\'altra guida'}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const toStudents = () => setStep('student');
  return (
    <FormSheet
      leading={
        <Pressable onPress={toStudents} accessibilityRole="button" accessibilityLabel="Cambia allievo">
          <RoadAvatar userId={studentId} name={selected?.name ?? '?'} size={52} />
        </Pressable>
      }
      title={
        <Pressable onPress={toStudents} accessibilityRole="button" accessibilityLabel="Cambia allievo">
          <Text style={s.whoName} numberOfLines={1}>{selected?.name ?? 'Allievo'}</Text>
          {selectedDetail ? <Text style={s.detail} numberOfLines={1}>{selectedDetail}</Text> : null}
        </Pressable>
      }
      contentKey="summary"
      testID="road-free-sheet"
      busy={starting}
      cta={
        <ClayButton
          onPress={() => void onStart()}
          disabled={!studentId || !vehicleId}
          loading={starting}
          leading={studentId && vehicleId ? <PlayGlyph /> : null}
          title={selected ? `Parti con ${firstName(selected.name)}` : 'Scegli l\'allievo'}
          testID="road-free-go"
        />
      }
    >
      {/* Ordine dell'anteprima clay v2 approvata: durata, briefing, auto. */}
      <Text style={[s.label, { marginTop: 4 }]}>Durata</Text>
      <ClaySegmented
        options={options.durations.map((d) => ({ value: d, label: `${d} min` }))}
        value={duration}
        onChange={setDuration}
      />

      {briefing?.lines.length ? (
        <>
          <Text style={s.label}>{briefing.title}</Text>
          <BriefingRows lines={briefing.lines} />
        </>
      ) : null}

      <RoadPlanCard studentId={studentId} durationMin={duration} style={s.plan} testID="road-free-plan" />

      <Text style={s.label}>Guida</Text>
      <ClaySurface
        onPress={() => setStep('vehicle')}
        padded={false}
        radius={24}
        style={s.autoRow}
        testID="road-free-vehicle"
        accessibilityLabel="Cambia auto"
      >
        {/* L'auto 3D scelta, la stessa immagine del selettore («Cambia»). */}
        {selectedVehicle ? <Icon3D source={car34Art(selectedVehicle.carColor)} size={56} width={70} /> : null}
        {selectedVehicle ? (
          <View style={{ flex: 1 }}>
            <Text style={s.name} numberOfLines={1}>{selectedVehicle.name}</Text>
            {/* Riga secondaria discreta, alla iOS/Airbnb: «La tua auto · targa». */}
            <Text style={s.detail} numberOfLines={1}>
              {selectedVehicle.mine
                ? ['La tua auto', selectedVehicle.plate].filter(Boolean).join(' · ')
                : vehicleDetail(selectedVehicle)}
            </Text>
          </View>
        ) : (
          <Text style={[s.name, { flex: 1, color: CLAY.ink3, paddingVertical: 14 }]}>
            {vehicles.length ? 'Scegli l\'auto' : 'Nessuna auto adatta a questo allievo'}
          </Text>
        )}
        <Text style={s.changeTx}>Cambia</Text>
      </ClaySurface>

      <Animated.Text key={endLine} entering={ROAD_TEXT_IN} style={[s.endLine, clash && { color: '#B42318' }]}>
        {endLine}
      </Animated.Text>
    </FormSheet>
  );
}

function vehicleDetail(v: RoadFreeVehicle) {
  if (v.busy) return [v.plate, v.busyWith ? `in guida con ${firstName(v.busyWith)}` : 'occupata adesso'].filter(Boolean).join(' · ');
  return (
    [
      v.plate,
      v.transmission === 'automatic' ? 'automatica' : null,
      v.freeUntil ? `libera fino alle ${formatHm(v.freeUntil)}` : null,
    ]
      .filter(Boolean)
      .join(' · ') || ' '
  );
}

function VehicleRow({
  vehicle,
  selected,
  onPress,
  divider,
  first,
  last,
}: {
  vehicle: RoadFreeVehicle;
  selected: boolean;
  onPress?: () => void;
  divider?: boolean;
  first?: boolean;
  last?: boolean;
}) {
  return (
    <ClayListRow
      divider={divider}
      first={first}
      last={last}
      dimmed={vehicle.busy}
      leading={<Icon3D source={car34Art(vehicle.carColor)} size={42} width={58} />}
      title={vehicle.name}
      subtitle={vehicleDetail(vehicle)}
      onPress={onPress}
      chevron={false}
      trailing={selected ? <Ionicons name="checkmark" size={21} color={CLAY.ink} /> : null}
    />
  );
}

/** Raggruppa per iniziale (liste «Tutti gli allievi» alla iOS). */
function byLetter(people: Person[]): Array<[string, Person[]]> {
  const groups = new Map<string, Person[]>();
  for (const p of people) {
    const letter = p.sortKey[0]?.toUpperCase() ?? '#';
    groups.set(letter, [...(groups.get(letter) ?? []), p]);
  }
  return [...groups.entries()];
}

type PickGroup = {
  key: string;
  /** Titolo di sezione («Le tue ultime guide»). */
  title?: string;
  /** Intestazione «Tutti gli allievi · N» con l'eventuale stato. */
  head?: string;
  status?: 'loading' | 'empty';
  letter?: string;
  people: Person[];
};

/** Un gruppo della lista: titolo o lettera e la sua superficie clay. */
const PickGroupView = React.memo(function PickGroupView({ group, onPick }: { group: PickGroup; onPick: (id: string) => void }) {
  if (group.head !== undefined) {
    return (
      <View>
        <Text style={s.section}>{group.head}</Text>
        {group.status === 'loading' ? (
          <ActivityIndicator color={CLAY.ink3} style={{ marginTop: 18 }} />
        ) : group.status === 'empty' ? (
          <Text style={s.empty}>Nessun allievo trovato.</Text>
        ) : null}
      </View>
    );
  }
  return (
    <View>
      {group.title ? <Text style={s.section}>{group.title}</Text> : null}
      {group.letter ? <Text style={s.letter}>{group.letter}</Text> : null}
      <ClayList>
        {group.people.map((p, i) => (
          <PersonRow key={p.id} index={i} person={p} onPick={onPick} />
        ))}
      </ClayList>
    </View>
  );
});

/** Riga allievo statica (niente entrate a cascata: la lista è virtualizzata). */
const PersonRow = React.memo(function PersonRow({
  person,
  onPick,
  divider,
  first,
  last,
}: {
  person: Person;
  onPick: (id: string) => void;
  index: number;
  divider?: boolean;
  first?: boolean;
  last?: boolean;
}) {
  return (
    <ClayListRow
      divider={divider}
      first={first}
      last={last}
      // Stesso volto della tab Allievi e del resto di Road (foto o iniziali).
      leading={<RoadAvatar userId={person.id} name={person.name} size={44} />}
      title={person.name}
      subtitle={person.detail}
      onPress={() => onPick(person.id)}
      testID="road-free-student"
    />
  );
});

// Passano `first`/`last` alla ClayListRow: il respiro di bordo è nella riga.
markClayRow(VehicleRow);
markClayRow(PersonRow);

const s = StyleSheet.create({
  plan: { marginTop: 18 },
  // Intestazioni di sezione native in frase normale (niente maiuscoletto da eyebrow).
  section: { fontSize: 14, fontWeight: '500', color: CLAY.ink3, paddingHorizontal: 4, paddingTop: 22, paddingBottom: 8 },
  letter: { fontSize: 13, fontWeight: '600', color: CLAY.ink4, paddingHorizontal: 4, paddingTop: 16, paddingBottom: 6 },
  name: { fontSize: 16.5, fontWeight: '500', color: CLAY.ink, letterSpacing: -0.2 },
  detail: { fontSize: 13.5, fontWeight: '400', color: CLAY.ink3, marginTop: 1 },
  empty: { fontSize: 14.5, color: CLAY.ink3, paddingHorizontal: 4, paddingTop: 14 },
  whoName: { fontSize: 21, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.5 },
  changeTx: { fontSize: 15, fontWeight: '600', color: CLAY.ink },
  endLine: { fontSize: 14, fontWeight: '400', color: CLAY.ink3, marginTop: 16, textAlign: 'center' },
  label: { fontSize: 14, fontWeight: '500', color: CLAY.ink3, marginTop: 22, marginBottom: 8 },
  autoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 8, paddingRight: 18, paddingVertical: 8 },
});
