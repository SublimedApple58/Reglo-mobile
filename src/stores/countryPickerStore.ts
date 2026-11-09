import type { PhoneCountry } from '../utils/phoneCountries';

/**
 * Drives the `(auth)/country-picker` form sheet «Prefisso» — aperto dal
 * selettore a sinistra di `PhoneField`. Chi lo apre semina il paese attuale e
 * la callback; il tocco su una riga richiama `onPick` e chiude.
 */
export type CountryPickerData = {
  selectedIso: string;
  onPick: (country: PhoneCountry) => void;
};

let _data: CountryPickerData | null = null;
const _listeners = new Set<() => void>();

export const countryPickerStore = {
  set(data: CountryPickerData) {
    _data = data;
    _listeners.forEach((fn) => fn());
  },
  get(): CountryPickerData | null {
    return _data;
  },
  subscribe(fn: () => void) {
    _listeners.add(fn);
    return () => {
      _listeners.delete(fn);
    };
  },
};
