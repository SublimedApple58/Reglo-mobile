// REG-802 — il foglio «Disponibilità di …» (staff, sola lettura) legge da qui
// i dati già caricati dal dettaglio allievo: nessuna richiesta al tocco (§15).
import type { StudentAvailabilityPayload } from '../types/regloApi';

export type StudentAvailabilitySheetData = { firstName: string; payload: StudentAvailabilityPayload | null };

let data: StudentAvailabilitySheetData | null = null;
const listeners = new Set<() => void>();

export const studentAvailabilitySheetStore = {
  set(next: StudentAvailabilitySheetData) {
    data = next;
    listeners.forEach((fn) => fn());
  },
  get(): StudentAvailabilitySheetData | null {
    return data;
  },
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};
