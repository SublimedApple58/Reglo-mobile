import { useSyncExternalStore } from 'react';

/**
 * REG-700 Road ridotta: durante la guida l'istruttore esce dalla modalità a
 * tutto schermo e usa il resto dell'app (agenda, allievi, messaggi). Il GPS e
 * la coda continuano (task in background, non legati alla schermata); sopra la
 * tab bar resta la barra «Guida con <Nome> · N min · Torna in Road».
 *
 * Vale solo con la guida in corso (`phase === 'active'`): chiusura e
 * riepilogo tornano sempre a tutto schermo. `RoadController` instrada.
 */
let minimized = false;
const listeners = new Set<() => void>();

function set(next: boolean) {
  if (next === minimized) return;
  minimized = next;
  listeners.forEach((fn) => fn());
}

export const roadMiniStore = {
  get: () => minimized,
  set,
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};

/** «Riduci» dalla modalità Road: si torna all'agenda, la guida continua. */
export function minimizeRoad() {
  set(true);
}

/** «Torna in Road» dalla barra ridotta o dalla tab Road. */
export function returnToRoad() {
  set(false);
}

export function useRoadMinimized(): boolean {
  return useSyncExternalStore(roadMiniStore.subscribe, roadMiniStore.get);
}
