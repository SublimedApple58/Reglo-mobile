import React, { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Alert, InteractionManager, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useNavigation, useRouter } from 'expo-router';
import Animated from 'react-native-reanimated';

import { FormSheet } from '../../../src/components/SheetScaffold';
import { CLAY } from '../../../src/theme';
import { ClayButton, ClayIconButton, ClayList, ClaySearchField, ClaySegmented, ClaySurface, Icon3D, PlayGlyph } from '../../../src/components/clay';
import { ROAD_LAYOUT, ROAD_TEXT_IN } from '../../../src/road/motion';
import type { RoadFreeVehicle } from '../../../src/types/regloApi';
import { matchesPersonSearch } from '../../../src/utils/peopleSearch';
import { beginRoadEntry, roadPendingStart, SHEET_HANDOFF_MS } from '../../../src/road/entryFlow';
import { ROAD_FREE_PRIVACY_ROUTE } from '../../../src/road/freeStartStore';
import { enterRoadFree, hasSeenRoadPrivacy } from '../../../src/road/roadActions';
import { car34Art } from '../../../src/road/markerArt';
import { formatHm } from '../../../src/road/format';
import { chosenPlan, prefetchPlan } from '../../../src/road/planStore';
import { RoadPlanLine } from '../../../src/components/road/RoadPlanCard';
import { firstName, useAvvioData, usePerson, VehicleRow, vehicleDetail, vehiclesFor } from '../../../src/road/avvioParts';
import { avvioStore } from '../../../src/road/avvioFlow';

/**
 * REG-662 (piano 005) — avvio guida, foglio 3 di 3: «Parti con <Nome>».
 * Durata (col giro di quella durata in una riga), auto (riga che apre la
 * scelta con ricerca nello stesso foglio), «Fino alle …» e la CTA. Le
 * conferme (limite settimanale, pausa, prenotazioni bloccate, guida di
 * adesso) sono quelle di sempre (`enterRoadFree`).
 */
export default function AvviaPartiSheet() {
  const router = useRouter();
  const navigation = useNavigation();
  const choice = useSyncExternalStore(avvioStore.subscribe, avvioStore.get);
  const studentId = choice.studentId;
  const data = useAvvioData();
  const { options } = data;
  const person = usePerson(studentId, data);
  const [step, setStep] = useState<'summary' | 'vehicle'>('summary');
  const [vehicleQuery, setVehicleQuery] = useState('');
  const [vehicleId, setVehicleId] = useState<string | null>(options?.defaultVehicleId ?? null);
  const [duration, setDuration] = useState<number>(options?.defaultDuration ?? 60);
  const [starting, setStarting] = useState(false);

  // Il giro di TUTTE le durate: cambiare durata non aspetta la rete.
  const durationsKey = (options?.durations ?? []).join(',');
  useEffect(() => {
    if (!studentId) return;
    const task = InteractionManager.runAfterInteractions(() => {
      for (const d of durationsKey ? durationsKey.split(',').map(Number) : [duration]) prefetchPlan(studentId, d);
    });
    return () => task.cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId, durationsKey]);

  const vehicles = useMemo(() => vehiclesFor(options, person?.student ?? null), [options, person]);
  // L'auto scelta non va bene per l'allievo → la tua libera, poi la prima libera adatta.
  useEffect(() => {
    if (vehicles.some((v) => v.id === vehicleId && !v.busy)) return;
    setVehicleId((vehicles.find((v) => v.mine && !v.busy) ?? vehicles.find((v) => !v.busy))?.id ?? null);
  }, [vehicles, vehicleId]);
  const selectedVehicle = vehicles.find((v) => v.id === vehicleId) ?? null;

  const closeAll = () => router.dismissAll();
  const nowLabel = `Da adesso, ${formatHm(new Date().toISOString())}`;
  const first = person ? firstName(person.name) : 'Allievo';

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
      router.dismissAll();
      setTimeout(() => router.push(ROAD_FREE_PRIVACY_ROUTE), SHEET_HANDOFF_MS);
      return;
    }
    setStarting(true);
    // Se parte, RoadController sostituisce la radice con /road: i fogli
    // spariscono senza la loro scivolata (il passaggio lo fa il velo).
    navigation.setOptions({ animation: 'none' });
    const ok = await start();
    setStarting(false);
    if (!ok) navigation.setOptions({ animation: 'default' });
  };

  // ── Scelta dell'auto: ricerca, la tua, libere, occupate ────────────────
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
    const lic = person?.student?.licenseCategory ? `patente ${person.student.licenseCategory}` : null;
    return (
      <FormSheet
        leading={<ClayIconButton icon="back" onPress={() => setStep('summary')} accessibilityLabel="Indietro" />}
        title="Che auto usi?"
        subtitle={[`Per ${first}`, lic].filter(Boolean).join(' · ')}
        contentKey="vehicle"
        onClose={closeAll}
        testID="road-free-vehicles"
      >
        <ClaySearchField value={vehicleQuery} onChangeText={setVehicleQuery} placeholder="Cerca per nome o targa" autoCapitalize="words" />
        {section(mine.length === 1 ? 'La tua' : 'Le tue', mine)}
        {section(mine.length ? `Altre auto · ${free.length}` : `Libere adesso · ${free.length}`, free)}
        {section('Occupate adesso', busy)}
        {!list.length ? <Text style={s.empty}>{vq ? 'Nessuna auto trovata.' : 'Nessuna auto adatta a questo allievo.'}</Text> : null}
      </FormSheet>
    );
  }

  const endsAt = new Date(Date.now() + duration * 60_000);
  const next = options?.nextLesson ?? null;
  const clash = next && new Date(next.startsAt).getTime() < endsAt.getTime();
  const endLine = [
    `Fino alle ${formatHm(endsAt.toISOString())}`,
    next ? `alle ${formatHm(next.startsAt)} hai ${next.studentName ?? 'un\'altra guida'}` : 'poi sei libero',
  ].join(' · ');

  return (
    <FormSheet
      title={`Parti con ${first}`}
      subtitle={nowLabel}
      contentKey="summary"
      onClose={closeAll}
      busy={starting}
      testID="road-free-sheet"
      cta={
        <ClayButton
          onPress={() => void onStart()}
          disabled={!studentId || !vehicleId}
          loading={starting}
          leading={studentId && vehicleId ? <PlayGlyph /> : null}
          title={`Parti con ${first} · ${duration} min`}
          testID="road-free-go"
        />
      }
    >
      <Text style={[s.label, { marginTop: 4 }]}>Durata</Text>
      {options ? (
        <ClaySegmented options={options.durations.map((d) => ({ value: d, label: `${d} min` }))} value={duration} onChange={setDuration} />
      ) : null}
      <View style={s.planLine}>
        <RoadPlanLine studentId={studentId} durationMin={duration} />
      </View>

      <Text style={s.label}>Auto</Text>
      <ClaySurface
        onPress={() => setStep('vehicle')}
        padded={false}
        radius={24}
        style={s.autoRow}
        testID="road-free-vehicle"
        accessibilityLabel="Cambia auto"
      >
        {selectedVehicle ? <Icon3D source={car34Art(selectedVehicle.carColor)} size={56} width={70} /> : null}
        {selectedVehicle ? (
          <View style={{ flex: 1 }}>
            <Text style={s.name} numberOfLines={1}>{selectedVehicle.name}</Text>
            <Text style={s.detail} numberOfLines={1}>
              {selectedVehicle.mine ? ['La tua auto', selectedVehicle.plate].filter(Boolean).join(' · ') : vehicleDetail(selectedVehicle)}
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

const s = StyleSheet.create({
  section: { fontSize: 14, fontWeight: '500', color: CLAY.ink3, paddingHorizontal: 4, paddingTop: 22, paddingBottom: 8 },
  name: { fontSize: 16.5, fontWeight: '500', color: CLAY.ink, letterSpacing: -0.2 },
  detail: { fontSize: 13.5, fontWeight: '400', color: CLAY.ink3, marginTop: 1 },
  empty: { fontSize: 14.5, color: CLAY.ink3, paddingHorizontal: 4, paddingTop: 14 },
  changeTx: { fontSize: 15, fontWeight: '600', color: CLAY.ink, textDecorationLine: 'underline' },
  endLine: { fontSize: 14, fontWeight: '400', color: CLAY.ink3, marginTop: 16 },
  label: { fontSize: 15, fontWeight: '600', color: CLAY.ink, marginTop: 22, marginBottom: 10, letterSpacing: -0.2 },
  planLine: { marginTop: 10, paddingHorizontal: 4 },
  autoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 8, paddingRight: 18, paddingVertical: 8 },
});
