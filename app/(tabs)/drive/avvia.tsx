import React, { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SHEET_BOTTOM } from '../../../src/utils/sheetPresentation';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';

import { FormSheet } from '../../../src/components/SheetScaffold';
import { CTA_HEIGHT, CTA_RADIUS } from '../../../src/theme';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { RoadPressable } from '../../../src/components/road/RoadPressable';
import { ROAD_EXIT, ROAD_LAYOUT, ROAD_SPRING, ROAD_TEXT_IN, roadEnter, roadStagger } from '../../../src/road/motion';
import { regloApi } from '../../../src/services/regloApi';
import type { AutoscuolaStudent, RoadBriefing, RoadFreeOptions, RoadFreeVehicle } from '../../../src/types/regloApi';
import { vehicleServesStudent } from '../../../src/utils/license';
import { matchesPersonSearch } from '../../../src/utils/peopleSearch';
import { beginRoadEntry, ROAD_ROUTE, roadPendingStart, SHEET_HANDOFF_MS } from '../../../src/road/entryFlow';
import { ROAD_FREE_PRIVACY_ROUTE, roadFreePreselect, roadFreeStore } from '../../../src/road/freeStartStore';
import { BriefingRows, RoadAvatar } from '../../../src/components/road/RoadTabParts';
import { enterRoadFree, hasSeenRoadPrivacy } from '../../../src/road/roadActions';
import { car34Art } from '../../../src/road/markerArt';
import { formatHm } from '../../../src/road/format';

type Person = { id: string; name: string; detail: string; sortKey: string };

const initialsOf = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?';
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
  const live = useSyncExternalStore(roadFreeStore.subscribe, roadFreeStore.get);
  const [options] = useState<RoadFreeOptions | null>(() => live);
  const [students, setStudents] = useState<AutoscuolaStudent[] | null>(null);
  const [minutes, setMinutes] = useState<Record<string, number>>({});
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
    regloApi
      .getStudents()
      .then((list) => alive && setStudents(list))
      .catch(() => alive && setStudents([]));
    regloApi
      .getStudentsCompletedHours()
      .then((m) => alive && setMinutes(m ?? {}))
      .catch(() => undefined);
    return () => {
      alive = false;
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

  const pick = (id: string) => {
    Haptics.selectionAsync().catch(() => undefined);
    setStudentId(id);
    setQuery('');
    setStep('summary');
  };

  const canStart = !!studentId && !!vehicleId && !starting;

  const onStart = async () => {
    if (!studentId || !vehicleId || starting) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    const input = { studentId, vehicleId, durationMin: duration };
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
    const ok = await start();
    setStarting(false);
    if (!ok) return;
    router.back();
    setTimeout(() => router.push(ROAD_ROUTE), SHEET_HANDOFF_MS);
  };

  const back = (to: 'student' | 'summary') => (
    <RoadPressable kind="small" onPress={() => setStep(to)} hitSlop={10} style={s.x} accessibilityLabel="Indietro">
      <Ionicons name="chevron-back" size={20} color="#3A3A3C" />
    </RoadPressable>
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
    <View style={s.search}>
      <Ionicons name="search" size={18} color="#8E8E93" />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#8E8E93"
        style={s.searchInput}
        autoCorrect={false}
        autoCapitalize="words"
        returnKeyType="search"
        clearButtonMode="while-editing"
        testID={testID}
      />
    </View>
  );

  // ── Passo 1: con chi guidi? ────────────────────────────────────────────
  if (step === 'student') {
    let lastLetter = '';
    return (
      <FormSheet title="Con chi guidi?" subtitle={nowLabel} contentKey="student" testID="road-free-pick">
        {searchField(query, setQuery, 'Cerca allievo', 'road-free-search')}
        {/* Righe a tutta larghezza come le liste native: escono dal margine del foglio. */}
        <View style={s.bleed}>
          {shownSuggested.length ? (
            <View>
              <Text style={s.section}>Le tue ultime guide</Text>
              {shownSuggested.map((p, i) => (
                <Animated.View key={`s-${p.id}`} entering={roadStagger(i)} exiting={ROAD_EXIT} layout={ROAD_LAYOUT}>
                  <PersonRow person={p} dark onPress={() => pick(p.id)} />
                </Animated.View>
              ))}
            </View>
          ) : null}

          <Text style={s.section}>
            {q ? `Risultati · ${shownAll.length}` : `Tutti gli allievi${students ? ` · ${shownAll.length}` : ''}`}
          </Text>
          {!students ? (
            <ActivityIndicator color="#6A6A6A" style={{ marginTop: 18 }} />
          ) : shownAll.length ? (
            shownAll.map((p, i) => {
              const letter = p.sortKey[0]?.toUpperCase() ?? '';
              const header = !q && letter !== lastLetter ? letter : null;
              lastLetter = letter;
              return (
                // Le prime righe entrano a cascata; filtrando, le righe escono e le altre scivolano.
                <Animated.View key={p.id} entering={roadStagger(Math.min(i, 10))} exiting={ROAD_EXIT} layout={ROAD_LAYOUT}>
                  {header ? <Text style={s.letter}>{header}</Text> : null}
                  <PersonRow person={p} onPress={() => pick(p.id)} />
                </Animated.View>
              );
            })
          ) : (
            <Text style={s.empty}>Nessun allievo trovato.</Text>
          )}
        </View>
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
        <View>
          <Text style={s.section}>{title}</Text>
          {items.map((v, i) => (
            <Animated.View key={v.id} entering={roadStagger(i)} exiting={ROAD_EXIT} layout={ROAD_LAYOUT}>
              <VehicleRow vehicle={v} selected={v.id === vehicleId} onPress={v.busy ? undefined : () => choose(v)} />
            </Animated.View>
          ))}
        </View>
      ) : null;
    const who = selected ? firstName(selected.name) : null;
    const lic = selectedStudent?.licenseCategory ? `patente ${selectedStudent.licenseCategory}` : null;
    return (
      <FormSheet
        // Indietro a sinistra, la X (unica chiusura del foglio) in alto a destra.
        leading={back('summary')}
        title="Che auto usi?"
        subtitle={[who ? `Per ${who}` : null, lic].filter(Boolean).join(' · ') || nowLabel}
        contentKey="vehicle"
        testID="road-free-vehicles"
      >
        {searchField(vehicleQuery, setVehicleQuery, 'Cerca per nome o targa')}
        <View style={s.bleed}>
          {section(mine.length === 1 ? 'La tua' : 'Le tue', mine)}
          {section(mine.length ? `Altre auto · ${free.length}` : `Libere adesso · ${free.length}`, free)}
          {section('Occupate adesso', busy)}
          {!list.length ? (
            <Text style={s.empty}>{vq ? 'Nessuna auto trovata.' : 'Nessuna auto adatta a questo allievo.'}</Text>
          ) : null}
        </View>
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
          <RoadAvatar name={selected?.name ?? '?'} size={48} />
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
      cta={
        <RoadPressable
          kind="cta"
          onPress={() => void onStart()}
          disabled={!canStart}
          style={[s.cta, !canStart && !starting && s.ctaOff]}
          accessibilityRole="button"
          testID="road-free-go"
        >
          {starting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              {canStart ? <Ionicons name="play" size={17} color="#FFFFFF" /> : null}
              <Text style={[s.ctaTx, !canStart && s.ctaTxOff]}>
                {selected ? `Parti con ${firstName(selected.name)}` : 'Scegli l\'allievo'}
              </Text>
            </>
          )}
        </RoadPressable>
      }
    >
      {briefing?.lines.length ? (
        <>
          <Text style={[s.label, { marginTop: 4 }]}>{briefing.title}</Text>
          <BriefingRows lines={briefing.lines} />
        </>
      ) : null}

      <Text style={[s.label, !briefing?.lines.length && { marginTop: 4 }]}>Guida</Text>
      <Pressable
        onPress={() => setStep('vehicle')}
        style={({ pressed }) => [s.autoRow, pressed && { opacity: 0.7 }]}
        accessibilityRole="button"
        accessibilityLabel="Cambia auto"
        testID="road-free-vehicle"
      >
        <Ionicons name="car-outline" size={21} color="#111111" />
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
          <Text style={[s.name, { flex: 1, color: '#6A6A6A' }]}>
            {vehicles.length ? 'Scegli l\'auto' : 'Nessuna auto adatta a questo allievo'}
          </Text>
        )}
        <Text style={s.changeTx}>Cambia</Text>
        <Ionicons name="chevron-forward" size={17} color="#C7C7CC" />
      </Pressable>

      <DurationSegment
        durations={options.durations}
        value={duration}
        onChange={(d) => {
          Haptics.selectionAsync().catch(() => undefined);
          setDuration(d);
        }}
      />
      <Animated.Text key={endLine} entering={ROAD_TEXT_IN} style={[s.endLine, clash && { color: '#B42318' }]}>
        {endLine}
      </Animated.Text>
      <Text style={s.note}>Entra in agenda da adesso, già presente, con crediti e pagamento come le altre guide.</Text>
    </FormSheet>
  );
}

/**
 * Durate come controllo segmentato nativo: la parte bianca scivola sulla
 * durata scelta, morbida e senza rimbalzo, invece di saltarci.
 */
function DurationSegment({ durations, value, onChange }: { durations: number[]; value: number; onChange: (d: number) => void }) {
  const [w, setW] = useState(0);
  const idx = Math.max(0, durations.indexOf(value));
  const segW = durations.length ? (w - 8) / durations.length : 0;
  const x = useSharedValue(0);
  useEffect(() => {
    x.value = withSpring(idx * segW, ROAD_SPRING);
  }, [idx, segW, x]);
  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return (
    <View style={[s.segment, { marginTop: 18 }]} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {segW > 0 ? <Animated.View style={[s.segThumb, { width: segW }, thumb]} /> : null}
      {durations.map((d) => {
        const on = d === value;
        return (
          <Pressable
            key={d}
            onPress={() => onChange(d)}
            style={s.segItem}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
          >
            <Text style={[s.segTx, on && s.segTxOn]}>{d} min</Text>
          </Pressable>
        );
      })}
    </View>
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

function VehicleRow({ vehicle, selected, onPress }: { vehicle: RoadFreeVehicle; selected: boolean; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [s.row, pressed && !!onPress && { backgroundColor: '#F7F7F5' }]}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled: !onPress }}
    >
      <Image source={car34Art(vehicle.carColor)} style={[s.car, vehicle.busy && { opacity: 0.4 }]} resizeMode="contain" />
      <View style={s.rowBody}>
        <Text style={[s.name, vehicle.busy && s.muted]} numberOfLines={1}>{vehicle.name}</Text>
        <Text style={[s.detail, vehicle.busy && s.muted]} numberOfLines={1}>{vehicleDetail(vehicle)}</Text>
      </View>
      {selected ? <Ionicons name="checkmark" size={21} color="#111111" style={{ marginRight: 22 }} /> : <View style={{ width: 43 }} />}
    </Pressable>
  );
}

function PersonRow({ person, dark, onPress }: { person: Person; dark?: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [s.row, pressed && { backgroundColor: '#F7F7F5' }]}
      accessibilityRole="button"
      testID="road-free-student"
    >
      <View style={[s.avatar, dark && s.avatarDark]}>
        <Text style={[s.avatarTx, dark && { color: '#FFFFFF' }]}>{initialsOf(person.name)}</Text>
      </View>
      <View style={s.rowBody}>
        <Text style={s.name} numberOfLines={1}>{person.name}</Text>
        <Text style={s.detail} numberOfLines={1}>{person.detail}</Text>
      </View>
      <Ionicons name="chevron-forward" size={17} color="#C7C7CC" style={{ marginRight: 22 }} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  // form sheet: padding fisso, niente safe area (§13.2.1)
  // form sheet: respiro in fondo = SHEET_BOTTOM, mai insets.bottom (§13.2.1)
  root: { backgroundColor: '#FFFFFF', paddingTop: 26, paddingHorizontal: 22, paddingBottom: SHEET_BOTTOM },
  // Le liste vanno a tutta larghezza (righe native), oltre il margine del foglio.
  bleed: { marginHorizontal: -22, marginTop: 6 },
  stickyHead: { backgroundColor: '#FFFFFF', paddingTop: 26, paddingHorizontal: 22, paddingBottom: 8 },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  title: { fontSize: 26, fontWeight: '600', color: '#111111', letterSpacing: -0.7 },
  sub: { fontSize: 15, fontWeight: '400', color: '#6A6A6A', marginTop: 4 },
  x: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(120,120,128,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  search: {
    height: 44,
    borderRadius: 14,
    backgroundColor: '#F2F2F0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  searchInput: { flex: 1, height: 44, fontSize: 16.5, color: '#111111' },
  // Intestazioni di sezione native in frase normale (niente maiuscoletto da eyebrow).
  section: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6A6A6A',
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 4,
  },
  letter: { fontSize: 13, fontWeight: '600', color: '#8E8E93', paddingHorizontal: 22, paddingTop: 12, paddingBottom: 2 },
  row: { flexDirection: 'row', alignItems: 'center', paddingLeft: 22, minHeight: 64 },
  rowBody: {
    flex: 1,
    marginLeft: 13,
    alignSelf: 'stretch',
    justifyContent: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(60,60,67,0.18)',
  },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#ECECEA', alignItems: 'center', justifyContent: 'center' },
  avatarDark: { backgroundColor: '#111111' },
  avatarTx: { fontSize: 15, fontWeight: '600', color: '#3A3A3C' },
  name: { fontSize: 16.5, fontWeight: '500', color: '#111111', letterSpacing: -0.2 },
  detail: { fontSize: 13.5, fontWeight: '400', color: '#6A6A6A', marginTop: 1 },
  muted: { color: '#B0B0B0' },
  empty: { fontSize: 14.5, color: '#6A6A6A', paddingHorizontal: 22, paddingTop: 14 },
  studentCard: {
    marginTop: 18,
    borderRadius: 22,
    backgroundColor: '#F7F7F5',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  change: { fontSize: 15, fontWeight: '600', color: '#111111' },
  who: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  whoName: { fontSize: 21, fontWeight: '600', color: '#111111', letterSpacing: -0.5 },
  changeTx: { fontSize: 15, fontWeight: '400', color: '#6A6A6A' },
  endLine: { fontSize: 14, fontWeight: '400', color: '#6A6A6A', marginTop: 10 },
  label: { fontSize: 14, fontWeight: '500', color: '#6A6A6A', marginTop: 22, marginBottom: 2 },
  autoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    minHeight: 60,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(60,60,67,0.18)',
  },
  car: { width: 58, height: 42 },
  segment: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: 18, backgroundColor: '#F2F2F0' },
  segItem: { flex: 1, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  segThumb: {
    position: 'absolute',
    top: 4,
    left: 4,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  segItemOn: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  segTx: { fontSize: 15, fontWeight: '500', color: '#6A6A6A', letterSpacing: -0.2 },
  segTxOn: { color: '#111111', fontWeight: '600' },
  note: { fontSize: 13, fontWeight: '400', color: '#8E8E93', lineHeight: 18, marginTop: 4 },
  cta: {
    height: CTA_HEIGHT,
    borderRadius: CTA_RADIUS,
    backgroundColor: '#111111',
    flexDirection: 'row',
    gap: 9,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  ctaOff: { backgroundColor: '#ECECEC', shadowOpacity: 0, elevation: 0 },
  ctaTx: { fontSize: 17, fontWeight: '600', color: '#FFFFFF', letterSpacing: -0.3 },
  ctaTxOff: { color: '#A3A3A3' },
});
