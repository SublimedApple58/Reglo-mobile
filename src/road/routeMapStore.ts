import type { RoadDetail } from '../types/regloApi';

/** Seed della mappa a tutto schermo del percorso (dettaglio guida allievo). */
let data: RoadDetail | null = null;
const listeners = new Set<() => void>();

export const roadRouteMapStore = {
  set(next: RoadDetail | null) {
    data = next;
    listeners.forEach((fn) => fn());
  },
  get: () => data,
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};
