import type { AutoscuolaLocation } from '../types/regloApi';

/**
 * Drives the `home/manage-lesson-location` formSheet route. The manage-lesson
 * route publishes the current location id + onSelect (applied immediately,
 * optimistic) + onRequestCreate (push the add-location form), then pushes the
 * route. The picker reads this and calls back on tap.
 */
export type LocationPickerData = {
  selectedLocationId: string | null;
  onSelect: (location: AutoscuolaLocation) => void;
  onRequestCreate: () => void;
};

let _data: LocationPickerData | null = null;
const _listeners = new Set<() => void>();

export const locationPickerStore = {
  set(data: LocationPickerData) {
    _data = data;
    _listeners.forEach((fn) => fn());
  },
  get(): LocationPickerData | null {
    return _data;
  },
  subscribe(fn: () => void) {
    _listeners.add(fn);
    return () => {
      _listeners.delete(fn);
    };
  },
};
