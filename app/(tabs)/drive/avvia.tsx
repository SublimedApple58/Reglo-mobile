import React, { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';

import { GlassCloseButton } from '../../../src/components/GlassCloseButton';
import { regloApi } from '../../../src/services/regloApi';
import type { AutoscuolaStudent, RoadFreeOptions } from '../../../src/types/regloApi';
import { vehicleServesStudent } from '../../../src/utils/license';
import { matchesPersonSearch } from '../../../src/utils/peopleSearch';
import { beginRoadEntry, ROAD_ROUTE, roadPendingStart, SHEET_HANDOFF_MS } from '../../../src/road/entryFlow';
import { ROAD_FREE_PRIVACY_ROUTE, roadFreeStore } from '../../../src/road/freeStartStore';
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

function detailOf(st: AutoscuolaStudent | undefined, minutes: number | undefined) {
  const license = st?.licenseCategory
    ? `Patente ${st.licenseCategory}${st.transmission === 'automatic' ? ' automatica' : ''}`
    : null;
  return [license, hoursLabel(minutes)].filter(Boolean).join(' · ');
}

/**
 * REG-638 Road libero — «Avvia guida» in due passi (anteprime avvia/1-2).
 * 1. «Con chi guidi?»: ricerca in cima, prima le tue ultime guide, poi tutti
 *    gli allievi in ordine alfabetico (regge decine di allievi).
 * 2. Riepilogo: allievo (Cambia), auto preselezionata con la lista per
 *    cambiarla, durata, «Parti con …».
 * Form sheet alto quanto il contenuto: la radice è lo scroll del foglio
 * (design-system §13.2.1); la ricerca resta attaccata in cima.
 */
export default function AvviaGuidaSheet() {
  const router = useRouter();
  const live = useSyncExternalStore(roadFreeStore.subscribe, roadFreeStore.get);
  const [options] = useState<RoadFreeOptions | null>(() => live);
  const [students, setStudents] = useState<AutoscuolaStudent[] | null>(null);
  const [minutes, setMinutes] = useState<Record<string, number>>({});
  const [step, setStep] = useState<'student' | 'summary'>('student');
  const [query, setQuery] = useState('');
  const [studentId, setStudentId] = useState<string | null>(null);
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

  const byId = useMemo(() => new Map((students ?? []).map((st) => [st.id, st])), [students]);

  const everyone: Person[] = useMemo(
    () =>
      (students ?? [])
        .filter((st) => st.status !== 'inactive' && st.studentPhase !== 'PATENTATO')
        .map((st) => {
          const name = `${st.firstName} ${st.lastName}`.trim();
          return { id: st.id, name, detail: detailOf(st, minutes[st.id]), sortKey: name.toLocaleLowerCase('it') };
        })
        .sort((a, b) => a.sortKey.localeCompare(b.sortKey, 'it')),
    [students, minutes],
  );

  const suggested: Person[] = useMemo(
    () =>
      (options?.recentStudents ?? []).map((r) => ({
        id: r.id,
        name: r.name,
        detail: detailOf(byId.get(r.id), minutes[r.id]),
        sortKey: r.name.toLocaleLowerCase('it'),
      })),
    [options, byId, minutes],
  );

  const q = query.trim();
  const shownSuggested = q ? [] : suggested;
  const shownAll = q ? everyone.filter((p) => matchesPersonSearch(p.name, q)) : everyone;

  const selected = everyone.find((p) => p.id === studentId) ?? suggested.find((p) => p.id === studentId) ?? null;
  const selectedStudent = studentId ? byId.get(studentId) ?? null : null;

  const vehicles = useMemo(() => {
    const all = options?.vehicles ?? [];
    return selectedStudent ? all.filter((v) => vehicleServesStudent(v, selectedStudent)) : all;
  }, [options, selectedStudent]);

  // Cambia allievo → se l'auto scelta non va bene, la prima libera adatta.
  useEffect(() => {
    if (vehicles.some((v) => v.id === vehicleId && !v.busy)) return;
    setVehicleId(vehicles.find((v) => !v.busy)?.id ?? null);
  }, [vehicles, vehicleId]);

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

  const close = (
    <GlassCloseButton onPress={() => router.back()}>
      <Pressable onPress={() => router.back()} hitSlop={10} style={s.x} accessibilityLabel="Chiudi">
        <Ionicons name="close" size={20} color="#3A3A3C" />
      </Pressable>
    </GlassCloseButton>
  );
  const nowLabel = `Da adesso, ${formatHm(new Date().toISOString())}`;

  if (!options) {
    return (
      <View style={[s.root, { alignItems: 'center', paddingVertical: 40 }]}>
        <ActivityIndicator color="#111111" />
      </View>
    );
  }

  // ── Passo 1: con chi guidi? ────────────────────────────────────────────
  if (step === 'student') {
    let lastLetter = '';
    return (
      <ScrollView
        style={{ backgroundColor: '#FFFFFF' }}
        contentContainerStyle={s.listRoot}
        stickyHeaderIndices={[0]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        testID="road-free-pick"
      >
        <View style={s.stickyHead}>
          <View style={s.top}>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>Con chi guidi?</Text>
              <Text style={s.sub}>{nowLabel}</Text>
            </View>
            {close}
          </View>
          <View style={s.search}>
            <Ionicons name="search" size={18} color="#8E8E93" />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Cerca allievo"
              placeholderTextColor="#8E8E93"
              style={s.searchInput}
              autoCorrect={false}
              autoCapitalize="words"
              returnKeyType="search"
              clearButtonMode="while-editing"
              testID="road-free-search"
            />
          </View>
        </View>

        {shownSuggested.length ? (
          <View>
            <Text style={s.section}>Le tue ultime guide</Text>
            {shownSuggested.map((p) => (
              <PersonRow key={`s-${p.id}`} person={p} dark onPress={() => pick(p.id)} />
            ))}
          </View>
        ) : null}

        <Text style={s.section}>
          {q ? `Risultati · ${shownAll.length}` : `Tutti gli allievi${students ? ` · ${shownAll.length}` : ''}`}
        </Text>
        {!students ? (
          <ActivityIndicator color="#6A6A6A" style={{ marginTop: 18 }} />
        ) : shownAll.length ? (
          shownAll.map((p) => {
            const letter = p.sortKey[0]?.toUpperCase() ?? '';
            const header = !q && letter !== lastLetter ? letter : null;
            lastLetter = letter;
            return (
              <View key={p.id}>
                {header ? <Text style={s.letter}>{header}</Text> : null}
                <PersonRow person={p} onPress={() => pick(p.id)} />
              </View>
            );
          })
        ) : (
          <Text style={s.empty}>Nessun allievo trovato.</Text>
        )}
      </ScrollView>
    );
  }

  // ── Passo 2: riepilogo ─────────────────────────────────────────────────
  return (
    <ScrollView
      style={{ backgroundColor: '#FFFFFF' }}
      contentContainerStyle={s.root}
      showsVerticalScrollIndicator={false}
      alwaysBounceVertical={false}
      testID="road-free-sheet"
    >
      <View style={s.top}>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Avvia guida</Text>
          <Text style={s.sub}>{nowLabel}</Text>
        </View>
        {close}
      </View>

      <Pressable
        onPress={() => setStep('student')}
        style={({ pressed }) => [s.studentCard, pressed && { opacity: 0.8 }]}
        accessibilityRole="button"
        accessibilityLabel="Cambia allievo"
      >
        <View style={[s.avatar, s.avatarDark]}>
          <Text style={[s.avatarTx, { color: '#FFFFFF' }]}>{initialsOf(selected?.name ?? '?')}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.name} numberOfLines={1}>{selected?.name ?? 'Allievo'}</Text>
          {selected?.detail ? <Text style={s.detail} numberOfLines={1}>{selected.detail}</Text> : null}
        </View>
        <Text style={s.change}>Cambia</Text>
      </Pressable>

      <Text style={s.label}>Auto</Text>
      {vehicles.length ? (
        <View style={s.vehList}>
          {vehicles.map((v, i) => {
            const on = v.id === vehicleId;
            return (
              <Pressable
                key={v.id}
                onPress={() => {
                  if (v.busy) return;
                  Haptics.selectionAsync().catch(() => undefined);
                  setVehicleId(v.id);
                }}
                disabled={v.busy}
                style={({ pressed }) => [s.vehRow, i > 0 && s.vehSep, pressed && !v.busy && { backgroundColor: '#FAFAFA' }]}
                accessibilityRole="radio"
                accessibilityState={{ selected: on, disabled: v.busy }}
              >
                <Image source={car34Art(v.carColor)} style={[s.car, v.busy && { opacity: 0.4 }]} resizeMode="contain" />
                <View style={{ flex: 1 }}>
                  <Text style={[s.name, v.busy && s.muted]} numberOfLines={1}>{v.name}</Text>
                  <Text style={[s.detail, v.busy && s.muted]} numberOfLines={1}>
                    {v.busy ? 'occupata adesso' : [v.plate, v.transmission === 'automatic' ? 'automatica' : null].filter(Boolean).join(' · ') || ' '}
                  </Text>
                </View>
                {v.busy ? null : (
                  <View style={[s.radio, on && s.radioOn]}>
                    {on ? <Ionicons name="checkmark" size={15} color="#FFFFFF" /> : null}
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      ) : (
        <Text style={s.empty}>Nessuna auto adatta a questo allievo.</Text>
      )}

      <Text style={s.label}>Durata</Text>
      <View style={s.segment}>
        {options.durations.map((d) => {
          const on = d === duration;
          return (
            <Pressable key={d} onPress={() => setDuration(d)} style={[s.segItem, on && s.segItemOn]} accessibilityRole="button">
              <Text style={[s.segTx, on && s.segTxOn]}>{d} min</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={s.note}>
        La guida entra in agenda da adesso, già presente, con crediti e pagamento come le altre. Finisce con «Termina
        guida».
      </Text>

      <Pressable
        onPress={() => void onStart()}
        disabled={!canStart}
        style={({ pressed }) => [s.cta, !canStart && !starting && s.ctaOff, pressed && { opacity: 0.88 }]}
        accessibilityRole="button"
        testID="road-free-go"
      >
        {starting ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={[s.ctaTx, !canStart && s.ctaTxOff]}>
            {selected ? `Parti con ${firstName(selected.name)}` : 'Scegli l\'allievo'}
          </Text>
        )}
      </Pressable>
    </ScrollView>
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
  root: { backgroundColor: '#FFFFFF', paddingTop: 26, paddingHorizontal: 22, paddingBottom: 22 },
  listRoot: { backgroundColor: '#FFFFFF', paddingBottom: 30 },
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
    marginTop: 16,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#F2F2F0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  searchInput: { flex: 1, height: 44, fontSize: 16.5, color: '#111111' },
  section: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6A6A6A',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
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
  label: { fontSize: 13.5, fontWeight: '500', color: '#6A6A6A', marginTop: 22, marginBottom: 10 },
  vehList: { borderRadius: 22, borderWidth: 1, borderColor: '#ECECEC', overflow: 'hidden' },
  vehRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 14 },
  vehSep: { borderTopWidth: 1, borderTopColor: '#F2F2F2' },
  car: { width: 58, height: 42 },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: '#D0D0D0', alignItems: 'center', justifyContent: 'center' },
  radioOn: { backgroundColor: '#111111', borderColor: '#111111' },
  segment: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: 18, backgroundColor: '#F2F2F0' },
  segItem: { flex: 1, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
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
  note: { fontSize: 13, fontWeight: '400', color: '#6A6A6A', lineHeight: 18, marginTop: 20 },
  cta: {
    height: 54,
    borderRadius: 27,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
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
