import React, { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { InteractionManager } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { AutoscuolaStudent, RoadFreeOptions, RoadFreeVehicle } from '../types/regloApi';
import { ClayListRow, Icon3D, markClayRow } from '../components/clay';
import { RoadAvatar } from '../components/road/RoadTabParts';
import { CLAY } from '../theme';
import { vehicleServesStudent } from '../utils/license';
import { car34Art } from './markerArt';
import { formatHm } from './format';
import { getRoadStudents, refreshRoadStudents, roadFreeStore } from './freeStartStore';

/** Parti comuni ai tre fogli dell'avvio (REG-662). */

export type Person = { id: string; name: string; detail: string; sortKey: string };

export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

/** «9 h di guida» · «4,5 h» · «nessuna guida» dai minuti completati. */
function hoursLabel(minutes: number | undefined) {
  if (!minutes) return 'nessuna guida';
  const h = Math.round((minutes / 60) * 2) / 2;
  if (h < 0.5) return `${minutes} min di guida`;
  return `${h.toLocaleString('it-IT')} h di guida`;
}

export function detailOf(st: AutoscuolaStudent | undefined, minutes: number | undefined, blocked = false) {
  // Prenotazioni bloccate: riga secondaria discreta, niente badge (come in agenda non impedisce di partire).
  if (blocked) return 'Prenotazioni bloccate';
  const license = st?.licenseCategory
    ? `Patente ${st.licenseCategory}${st.transmission === 'automatic' ? ' automatica' : ''}`
    : null;
  return [license, hoursLabel(minutes)].filter(Boolean).join(' · ');
}

export function vehicleDetail(v: RoadFreeVehicle) {
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

/**
 * Opzioni di «Avvia guida» e allievi, pronti dal prefetch d'avvio
 * (`warmRoadFree`); la riconferma arriva dopo l'animazione del foglio.
 */
export function useAvvioData() {
  const live = useSyncExternalStore(roadFreeStore.subscribe, roadFreeStore.get);
  const [options] = useState<RoadFreeOptions | null>(() => live);
  const [students, setStudents] = useState<AutoscuolaStudent[] | null>(() => getRoadStudents()?.students ?? null);
  const [minutes, setMinutes] = useState<Record<string, number>>(() => getRoadStudents()?.minutes ?? {});
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
  const byId = useMemo(() => new Map((students ?? []).map((st) => [st.id, st])), [students]);
  const blocked = useMemo(() => new Set(options?.blockedStudentIds ?? []), [options]);
  return { options, students, minutes, byId, blocked };
}

/** Chi è l'allievo scelto: nome e riga sotto (quella del server se c'è). */
export function usePerson(studentId: string | null, data: ReturnType<typeof useAvvioData>) {
  const { options, byId, minutes, blocked } = data;
  return useMemo(() => {
    if (!studentId) return null;
    const st = byId.get(studentId);
    const suggestion = options?.suggestions?.find((x) => x.id === studentId) ?? null;
    const recent = options?.recentStudents?.find((x) => x.id === studentId) ?? null;
    const name = st ? `${st.firstName} ${st.lastName}`.trim() : suggestion?.name ?? recent?.name ?? 'Allievo';
    const detail = blocked.has(studentId) ? 'Prenotazioni bloccate' : suggestion?.detail ?? detailOf(st, minutes[studentId]);
    return { id: studentId, name, detail, student: st ?? null, suggestion };
  }, [studentId, options, byId, minutes, blocked]);
}

/** Auto adatte all'allievo (patente, cambio). */
export function vehiclesFor(options: RoadFreeOptions | null, student: AutoscuolaStudent | null) {
  const all = options?.vehicles ?? [];
  return student ? all.filter((v) => vehicleServesStudent(v, student)) : all;
}

export function VehicleRow({
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

/** Riga allievo statica (niente entrate a cascata: la lista è virtualizzata). */
export const PersonRow = React.memo(function PersonRow({
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
