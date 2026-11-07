import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Ricca 7 (07/11/2026) — aspetto di Road scelto dall'istruttore.
 * - `auto`: come sempre, scuro da 15' prima del tramonto a 15' dopo l'alba;
 * - `day` / `night`: forzato.
 * È una preferenza del telefono (non dell'autoscuola): resta salvata.
 */
export type RoadNightMode = 'auto' | 'day' | 'night';

const KEY = 'reglo.road.nightMode';
let mode: RoadNightMode = 'auto';
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

AsyncStorage.getItem(KEY)
  .then((v) => {
    if (v === 'day' || v === 'night') {
      mode = v;
      emit();
    }
  })
  .catch(() => undefined);

export const roadNightMode = {
  get: () => mode,
  set(next: RoadNightMode) {
    if (next === mode) return;
    mode = next;
    emit();
    AsyncStorage.setItem(KEY, next).catch(() => undefined);
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
};

export function useRoadNightMode(): RoadNightMode {
  return useSyncExternalStore(roadNightMode.subscribe, roadNightMode.get);
}
