// REG-636 — per-participant moto of a moto group lesson. Mirror of the backend
// pure helpers `planMotoChange` / `motoChoicesForSeat` (lib/autoscuole/group-moto.ts)
// plus the swap-confirm copy shared with the web roster: the app previews the
// change locally, the server recomputes it under the group lock.

import { vehicleServesStudent } from './license';

export type MotoFleetVehicle = {
  id: string;
  name: string;
  licenseCategory: string | null;
  transmission: string | null;
};

export type MotoSeat = {
  appointmentId: string;
  vehicleId: string | null;
  license: { licenseCategory: string | null; transmission: string | null };
};

export type MotoChangePlan =
  | { ok: false; reason: 'seat_not_found' | 'not_in_fleet' | 'incompatible' }
  | { ok: true; kind: 'noop' | 'assign' }
  | {
      ok: true;
      kind: 'swap';
      otherAppointmentId: string;
      otherNextVehicleId: string | null;
      otherBlockedVehicleId: string | null;
    };

export const MOTO_CHANGE_MESSAGES: Record<'seat_not_found' | 'not_in_fleet' | 'incompatible', string> = {
  seat_not_found: 'Allievo non trovato in questa guida.',
  not_in_fleet: 'La moto non fa parte di questa guida di gruppo.',
  incompatible: "La patente dell'allievo non è compatibile con questa moto.",
};

export const planMotoChange = (args: {
  fleet: MotoFleetVehicle[];
  seats: MotoSeat[];
  appointmentId: string;
  vehicleId: string | null;
}): MotoChangePlan => {
  const seat = args.seats.find((s) => s.appointmentId === args.appointmentId);
  if (!seat) return { ok: false, reason: 'seat_not_found' };
  if (seat.vehicleId === args.vehicleId) return { ok: true, kind: 'noop' };
  if (args.vehicleId === null) return { ok: true, kind: 'assign' };

  const moto = args.fleet.find((m) => m.id === args.vehicleId);
  if (!moto) return { ok: false, reason: 'not_in_fleet' };
  if (!vehicleServesStudent(moto, seat.license)) return { ok: false, reason: 'incompatible' };

  const holder = args.seats.find(
    (s) => s.appointmentId !== seat.appointmentId && s.vehicleId === args.vehicleId,
  );
  if (!holder) return { ok: true, kind: 'assign' };

  const moverMoto = seat.vehicleId ? args.fleet.find((m) => m.id === seat.vehicleId) ?? null : null;
  const holderCanRide = moverMoto ? vehicleServesStudent(moverMoto, holder.license) : false;
  return {
    ok: true,
    kind: 'swap',
    otherAppointmentId: holder.appointmentId,
    otherNextVehicleId: holderCanRide && moverMoto ? moverMoto.id : null,
    otherBlockedVehicleId: moverMoto && !holderCanRide ? moverMoto.id : null,
  };
};

export type MotoChoice = {
  vehicleId: string;
  state: 'current' | 'free' | 'taken';
  holderAppointmentId: string | null;
};

/** Compatible fleet motos in picker order (current → free → taken) + the excluded ones. */
export const motoChoicesForSeat = (args: {
  fleet: MotoFleetVehicle[];
  seats: MotoSeat[];
  appointmentId: string;
}): { choices: MotoChoice[]; incompatibleVehicleIds: string[] } => {
  const seat = args.seats.find((s) => s.appointmentId === args.appointmentId);
  if (!seat) return { choices: [], incompatibleVehicleIds: [] };
  const current: MotoChoice[] = [];
  const free: MotoChoice[] = [];
  const taken: MotoChoice[] = [];
  const incompatibleVehicleIds: string[] = [];
  for (const moto of args.fleet) {
    if (!vehicleServesStudent(moto, seat.license)) {
      incompatibleVehicleIds.push(moto.id);
      continue;
    }
    if (moto.id === seat.vehicleId) {
      current.push({ vehicleId: moto.id, state: 'current', holderAppointmentId: seat.appointmentId });
      continue;
    }
    const holder = args.seats.find((s) => s.appointmentId !== seat.appointmentId && s.vehicleId === moto.id);
    if (holder) taken.push({ vehicleId: moto.id, state: 'taken', holderAppointmentId: holder.appointmentId });
    else free.push({ vehicleId: moto.id, state: 'free', holderAppointmentId: null });
  }
  return { choices: [...current, ...free, ...taken], incompatibleVehicleIds };
};

/** "Luca B." — holder label in the picker. */
export const shortStudentName = (name: string | null | undefined) => {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'Allievo';
  if (parts.length < 2) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1].charAt(0)}.`;
};

/** "Luca" — first word of the name, used in the confirm copy. */
export const firstStudentName = (name: string | null | undefined) =>
  (name ?? '').trim().split(/\s+/)[0] || 'Allievo';

const motoWithCategory = (m: MotoFleetVehicle) =>
  `${m.name}${m.licenseCategory ? ` (${m.licenseCategory})` : ''}`;

/** Title + message of the native swap Alert (same wording as the web confirm). */
export const describeMotoSwap = (args: {
  plan: Extract<MotoChangePlan, { kind: 'swap' }>;
  moverName: string;
  otherName: string;
  pickedMoto: MotoFleetVehicle;
  fleet: MotoFleetVehicle[];
  otherLicenseCategory: string | null;
}) => {
  const { plan, moverName, otherName, pickedMoto, fleet, otherLicenseCategory } = args;
  const otherNext = plan.otherNextVehicleId ? fleet.find((m) => m.id === plan.otherNextVehicleId) ?? null : null;
  const blocked = plan.otherBlockedVehicleId ? fleet.find((m) => m.id === plan.otherBlockedVehicleId) ?? null : null;
  if (otherNext) {
    return {
      title: `Scambiare le moto con ${otherName}?`,
      message: `${moverName} prende la ${pickedMoto.name}, ${otherName} prende la ${otherNext.name}.`,
      confirmLabel: 'Scambia',
    };
  }
  const why = blocked
    ? `non può guidare la ${motoWithCategory(blocked)}${otherLicenseCategory ? `, la sua patente è ${otherLicenseCategory}` : ''}.`
    : `${moverName} non ha una moto fissa da cedere in cambio.`;
  return {
    title: `Dare a ${moverName} la moto di ${otherName}?`,
    message: `${moverName} prende la ${pickedMoto.name}.\n\n${otherName} passerà ad A rotazione: ${why}`,
    confirmLabel: 'Conferma',
  };
};
