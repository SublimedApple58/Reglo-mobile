import type { AutoscuolaLocation, CreateLocationInput } from '../types/regloApi';

// Drives the more/location-form formSheet route. LocationsScreen publishes the
// location being edited (or null to create) + the submit handler, then pushes
// the route. The sheet reads this and calls onSubmit on save.
export type LocationFormStoreData = {
  initial: AutoscuolaLocation | null;
  onSubmit: (values: CreateLocationInput) => Promise<void>;
};

let _data: LocationFormStoreData | null = null;
const _listeners = new Set<() => void>();

export const locationFormStore = {
  set(data: LocationFormStoreData) {
    _data = data;
    _listeners.forEach((fn) => fn());
  },
  get(): LocationFormStoreData | null {
    return _data;
  },
  subscribe(fn: () => void) {
    _listeners.add(fn);
    return () => { _listeners.delete(fn); };
  },
};
