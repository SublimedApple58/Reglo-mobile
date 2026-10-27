import type { RoadFreeOptions } from '../types/regloApi';

/**
 * REG-638 Road libero — opzioni di «Avvia guida» (durate, veicoli, allievi
 * recenti) lette dalla tab Road e passate al foglio senza rileggerle.
 */
let options: RoadFreeOptions | null = null;
const listeners = new Set<() => void>();

export const roadFreeStore = {
  set(next: RoadFreeOptions | null) {
    options = next;
    listeners.forEach((fn) => fn());
  },
  get: () => options,
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};

export const ROAD_FREE_SHEET_ROUTE = '/(tabs)/drive/avvia' as const;
export const ROAD_FREE_PRIVACY_ROUTE = '/(tabs)/drive/road-privacy' as const;
