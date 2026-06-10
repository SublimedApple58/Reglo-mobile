import type { AutoscuolaVehicle } from '../types/regloApi';

// Drives the more/vehicle-form formSheet route. The Vehicles screen (Owner or
// Instructor) publishes the vehicle being edited (or null to create) plus the
// availabilityWeeks horizon and a reload callback, then pushes the route. The
// sheet does the create/update + availability persistence itself via regloApi
// and calls onChanged() so the list refreshes.
export type VehicleFormStoreData = {
  initial: AutoscuolaVehicle | null;
  availabilityWeeks: number;
  onChanged: () => void | Promise<void>;
};

let _data: VehicleFormStoreData | null = null;
const _listeners = new Set<() => void>();

export const vehicleFormStore = {
  set(data: VehicleFormStoreData) {
    _data = data;
    _listeners.forEach((fn) => fn());
  },
  get(): VehicleFormStoreData | null {
    return _data;
  },
  clear() {
    _data = null;
  },
  subscribe(fn: () => void) {
    _listeners.add(fn);
    return () => { _listeners.delete(fn); };
  },
};
