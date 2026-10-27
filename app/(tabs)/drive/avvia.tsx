import React, { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';

import { GlassCloseButton } from '../../../src/components/GlassCloseButton';
import { regloApi } from '../../../src/services/regloApi';
import type { AutoscuolaStudent, RoadFreeOptions } from '../../../src/types/regloApi';
import { studentPickerStore } from '../../../src/stores/studentPickerStore';
import { vehicleServesStudent } from '../../../src/utils/license';
import { beginRoadEntry, ROAD_ROUTE, roadPendingStart, SHEET_HANDOFF_MS } from '../../../src/road/entryFlow';
import { ROAD_FREE_PRIVACY_ROUTE, roadFreeStore } from '../../../src/road/freeStartStore';
import { enterRoadFree, hasSeenRoadPrivacy } from '../../../src/road/roadActions';
import { formatHm } from '../../../src/road/format';

const CALENDAR_ICON = require('../../../assets/icons/fluent-calendar.png');

type Pick = { id: string; name: string };

const initialsOf = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?';
/** «Giorgia Bianchi» → «Giorgia B.» */
const shortName = (name: string) => {
  const [first, ...rest] = name.trim().split(/\s+/);
  const last = rest[rest.length - 1];
  return last ? `${first} ${last[0]}.` : first ?? name;
};
const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

/**
 * REG-638 Road libero — «Avvia guida» (anteprima A2-2). Allievo (recenti a
 * chip + «Altro…»), veicolo, durata; «Parti» crea la guida vera in agenda da
 * adesso e apre Road. Form sheet alto quanto il contenuto: la radice è lo
 * scroll del foglio (design-system §13.2.1).
 */
export default function AvviaGuidaSheet() {
  const router = useRouter();
  const live = useSyncExternalStore(roadFreeStore.subscribe, roadFreeStore.get);
  const [options] = useState<RoadFreeOptions | null>(() => live);
  const [students, setStudents] = useState<AutoscuolaStudent[] | null>(null);
  const [extra, setExtra] = useState<Pick | null>(null);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [vehicleId, setVehicleId] = useState<string | null>(options?.defaultVehicleId ?? null);
  const [duration, setDuration] = useState<number>(options?.defaultDuration ?? 60);
  const [starting, setStarting] = useState(false);

  // Tutti gli allievi: servono per «Altro…» e per la patente (veicolo adatto).
  useEffect(() => {
    let alive = true;
    regloApi
      .getStudents()
      .then((list) => {
        if (alive) setStudents(list);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const chips: Pick[] = useMemo(() => {
    const recent = options?.recentStudents ?? [];
    const list = extra && !recent.some((r) => r.id === extra.id) ? [extra, ...recent] : recent;
    return list.slice(0, 6);
  }, [options, extra]);

  const selectedStudent = students?.find((st) => st.id === studentId) ?? null;
  const selectedName =
    chips.find((c) => c.id === studentId)?.name ??
    (selectedStudent ? `${selectedStudent.firstName} ${selectedStudent.lastName}` : null);

  const vehicles = useMemo(() => {
    const all = options?.vehicles ?? [];
    if (!selectedStudent) return all;
    return all.filter((v) => vehicleServesStudent(v, selectedStudent));
  }, [options, selectedStudent]);

  // Cambia allievo → se il veicolo scelto non va bene, il primo libero adatto.
  useEffect(() => {
    if (vehicles.some((v) => v.id === vehicleId && !v.busy)) return;
    setVehicleId(vehicles.find((v) => !v.busy)?.id ?? null);
  }, [vehicles, vehicleId]);

  const openPicker = () => {
    const opts = (students ?? [])
      .filter((st) => st.status !== 'inactive' && st.studentPhase !== 'PATENTATO')
      .map((st) => ({
        value: st.id,
        label: `${st.firstName} ${st.lastName}`.trim(),
        subtitle: st.licenseCategory ? `Patente ${st.licenseCategory}` : null,
        licenseCategory: st.licenseCategory ?? null,
      }));
    studentPickerStore.set({
      selectedId: studentId,
      options: opts,
      onSelect: (id) => {
        const o = opts.find((x) => x.value === id);
        if (o) setExtra({ id, name: o.label });
        setStudentId(id);
      },
    });
    router.push('/(tabs)/drive/select-student');
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

  if (!options) {
    return (
      <View style={[s.root, { alignItems: 'center', paddingVertical: 40 }]}>
        <ActivityIndicator color="#111111" />
      </View>
    );
  }

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
          <Text style={s.sub}>Da adesso, {formatHm(new Date().toISOString())}</Text>
        </View>
        <GlassCloseButton onPress={() => router.back()}>
          <Pressable onPress={() => router.back()} hitSlop={10} style={s.x}>
            <Ionicons name="close" size={20} color="#3A3A3C" />
          </Pressable>
        </GlassCloseButton>
      </View>

      <Text style={s.label}>Allievo</Text>
      <View style={s.chips}>
        {chips.map((c) => {
          const on = c.id === studentId;
          return (
            <Pressable
              key={c.id}
              onPress={() => setStudentId(c.id)}
              style={({ pressed }) => [s.chip, on && s.chipOn, pressed && { opacity: 0.85 }]}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              testID="road-free-student"
            >
              <View style={[s.avatar, on && s.avatarOn]}>
                <Text style={[s.avatarTx, on && { color: '#111111' }]}>{initialsOf(c.name)}</Text>
              </View>
              <Text style={[s.chipTx, on && s.chipTxOn]} numberOfLines={1}>
                {shortName(c.name)}
              </Text>
            </Pressable>
          );
        })}
        <Pressable
          onPress={openPicker}
          disabled={!students}
          style={({ pressed }) => [s.chip, s.chipMore, pressed && { opacity: 0.85 }]}
          accessibilityRole="button"
          testID="road-free-more"
        >
          {students ? <Text style={s.chipTx}>{chips.length ? 'Altro…' : 'Scegli allievo'}</Text> : <ActivityIndicator color="#6A6A6A" />}
        </Pressable>
      </View>

      <Text style={s.label}>Veicolo</Text>
      {vehicles.length ? (
        <View style={s.segment}>
          {vehicles.map((v) => {
            const on = v.id === vehicleId;
            return (
              <Pressable
                key={v.id}
                onPress={() => !v.busy && setVehicleId(v.id)}
                disabled={v.busy}
                style={[s.segItem, on && s.segItemOn]}
                accessibilityRole="button"
                accessibilityState={{ selected: on, disabled: v.busy }}
              >
                <Text style={[s.segTx, on && s.segTxOn, v.busy && s.segTxBusy]} numberOfLines={1}>
                  {v.name}
                </Text>
                {v.busy ? <Text style={s.segBusy}>occupata</Text> : null}
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

      <View style={s.note}>
        <Image source={CALENDAR_ICON} style={s.noteImg} resizeMode="contain" />
        <Text style={s.noteTx}>
          Si crea una guida vera in agenda da adesso, già presente: crediti e pagamento come le altre. Finisce con
          «Termina guida».
        </Text>
      </View>

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
            {selectedName ? `Parti con ${firstName(selectedName)}` : 'Scegli l\'allievo'}
          </Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  // form sheet: padding fisso, niente safe area (§13.2.1)
  root: { backgroundColor: '#FFFFFF', paddingTop: 26, paddingHorizontal: 22, paddingBottom: 22 },
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
  label: { fontSize: 13.5, fontWeight: '500', color: '#6A6A6A', marginTop: 22, marginBottom: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 5,
    paddingRight: 15,
    borderRadius: 22,
    backgroundColor: '#F2F2F0',
    maxWidth: '100%',
  },
  chipOn: { backgroundColor: '#111111' },
  chipMore: { paddingLeft: 16, paddingRight: 16, minWidth: 80, justifyContent: 'center' },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#3A3A3C', alignItems: 'center', justifyContent: 'center' },
  avatarOn: { backgroundColor: '#FFFFFF' },
  avatarTx: { fontSize: 12.5, fontWeight: '600', color: '#FFFFFF' },
  chipTx: { fontSize: 15, fontWeight: '500', color: '#111111', letterSpacing: -0.2 },
  chipTxOn: { color: '#FFFFFF' },
  segment: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, padding: 4, borderRadius: 18, backgroundColor: '#F2F2F0' },
  segItem: {
    flexGrow: 1,
    minWidth: 90,
    minHeight: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
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
  segTxBusy: { color: '#B0B0B0' },
  segBusy: { fontSize: 11, fontWeight: '500', color: '#B0B0B0', marginTop: 1 },
  empty: { fontSize: 14, color: '#6A6A6A' },
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 22,
    borderRadius: 18,
    backgroundColor: '#F7F7F5',
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  noteImg: { width: 28, height: 28 },
  noteTx: { flex: 1, fontSize: 13.5, fontWeight: '400', color: '#3A3A3C', lineHeight: 19 },
  cta: {
    height: 54,
    borderRadius: 27,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
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
