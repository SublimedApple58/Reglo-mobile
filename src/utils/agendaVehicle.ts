// Veicolo nei blocchi del calendario (REG-633). Stessa regola del web
// (`reglo/lib/autoscuole/agenda-vehicle-label.ts`): solo il NOME del mezzo,
// mai la targa; guida moto = «Moto + moto extra + Auto al seguito», come
// l'etichetta della home istruttore.

type NamedVehicle = { name?: string | null } | null | undefined;

export function agendaVehicleLabel(appt: {
  vehicle?: NamedVehicle;
  extraMotoVehicles?: NamedVehicle[] | null;
  followVehicle?: NamedVehicle;
}): string | null {
  const names = [appt.vehicle, ...(appt.extraMotoVehicles ?? []), appt.followVehicle]
    .map((v) => v?.name?.trim())
    .filter((name): name is string => Boolean(name));
  return names.length ? names.join(' + ') : null;
}

// Setting dell'autoscuola, spento di default; vale solo col modulo veicoli.
export function showVehicleOnBlocks(
  settings: { agendaShowVehicle?: boolean; vehiclesEnabled?: boolean } | null | undefined,
): boolean {
  return settings?.agendaShowVehicle === true && settings?.vehiclesEnabled !== false;
}
