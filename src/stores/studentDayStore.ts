// REG-802 — il foglio «giorno» delle disponibilità dell'allievo legge da qui il
// giorno toccato e restituisce le fasce scelte con `onDone`. Stesso schema di
// `publishDayStore`: chi apre il foglio pubblica i dati, il foglio li consuma.
import type { StudentAvailabilityBand, StudentBandKey } from '../types/regloApi';

export type StudentDayStoreData = {
  /** «Venerdì» */
  dayLabel: string;
  bands: StudentAvailabilityBand[];
  selected: StudentBandKey[];
  /** `applyAll` = «Uguale per tutti i giorni». */
  onDone: (selected: StudentBandKey[], applyAll: boolean) => void;
};

let data: StudentDayStoreData | null = null;
const listeners = new Set<() => void>();

export const studentDayStore = {
  set(next: StudentDayStoreData) {
    data = next;
    listeners.forEach((fn) => fn());
  },
  get(): StudentDayStoreData | null {
    return data;
  },
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};
