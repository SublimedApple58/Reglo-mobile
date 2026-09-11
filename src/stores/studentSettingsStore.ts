import type { ReactNode } from 'react';

/**
 * Seed del form sheet "Impostazioni allievo" (guide di gruppo, pronto per
 * l'esame, luogo di default). Stesso pattern seed-and-callback degli altri
 * sheet nativi: la scheda allievo tiene stato e chiamate, il foglio disegna.
 */
export type StudentSettingsData = {
  studentName?: string | null;
  group?: { value: boolean; saving: boolean; onChange: (next: boolean) => void } | null;
  examReady?: { value: boolean; saving: boolean; onChange: (next: boolean) => void } | null;
  location?: { label: string; onPress: () => void } | null;
  /** Slot libero per righe future senza toccare il foglio. */
  extra?: ReactNode;
};

let _data: StudentSettingsData | null = null;
const _listeners = new Set<() => void>();

export const studentSettingsStore = {
  set(data: StudentSettingsData) {
    _data = data;
    _listeners.forEach((fn) => fn());
  },
  get(): StudentSettingsData | null {
    return _data;
  },
  clear() {
    _data = null;
    _listeners.forEach((fn) => fn());
  },
  subscribe(fn: () => void) {
    _listeners.add(fn);
    return () => {
      _listeners.delete(fn);
    };
  },
};
