import { useSyncExternalStore } from 'react';

import { regloApi } from '../services/regloApi';
import type { RoadExamRoute, RoadExaminerGroup } from '../types/regloApi';

/**
 * R4 — percorsi d'esame per esaminatore («Prova un percorso d'esame» in guida).
 * Si caricano all'apertura del foglio e restano in memoria: la linea viola del
 * percorso provato in guida la prende da qui.
 */
let groups: RoadExaminerGroup[] | null = null;
let error = false;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());

export const examRoutesStore = {
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  get: () => groups,
  hasError: () => error,
  load(): Promise<void> {
    if (inflight) return inflight;
    inflight = regloApi
      .getRoadExamRoutesByExaminer()
      .then((next) => {
        groups = next;
        error = false;
      })
      .catch(() => {
        error = groups == null;
      })
      .finally(() => {
        inflight = null;
        emit();
      });
    return inflight;
  },
  route(id: string | null | undefined): RoadExamRoute | null {
    if (!id || !groups) return null;
    for (const g of groups) {
      const r = g.routes.find((x) => x.id === id);
      if (r) return r;
    }
    return null;
  },
};

export function useExamRouteGroups() {
  return useSyncExternalStore(examRoutesStore.subscribe, examRoutesStore.get);
}
