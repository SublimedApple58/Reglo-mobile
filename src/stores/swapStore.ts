import type { AutoscuolaAppointmentWithRelations } from '../types/regloApi';

/**
 * Drives the `home/swap-lesson` formSheet (instructor "Scambia con…"). The parent
 * screen computes the swappable candidates + keeps the API/refresh logic; the
 * route renders the list, owns the search field, and confirms before swapping.
 */
export type SwapData = {
  sourceName: string;
  candidates: AutoscuolaAppointmentWithRelations[];
  vehiclesEnabled: boolean;
  /** Performs the swap. Returns true on success so the route can dismiss. */
  onSwap: (target: AutoscuolaAppointmentWithRelations) => Promise<boolean>;
};

let _data: SwapData | null = null;
const _listeners = new Set<() => void>();

export const swapStore = {
  set(data: SwapData) {
    _data = data;
    _listeners.forEach((fn) => fn());
  },
  get(): SwapData | null {
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
