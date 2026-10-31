import { useEffect, useSyncExternalStore } from 'react';
import { InteractionManager } from 'react-native';
import { regloApi } from '../services/regloApi';
import type { RoadLesson, RoadStudentRoad } from '../types/regloApi';

/**
 * REG-662 (piano 005) — avvio guida in tre fogli nativi spinti uno sopra
 * l'altro: «Con chi guidi?» → «<Nome> su Road» → «Parti con <Nome>».
 * Trascinando giù si torna al passo prima, la X chiude tutto
 * (`router.dismissAll()`). La scelta passa da un foglio all'altro qui.
 */
export const AVVIO_ALLIEVO_ROUTE = '/(tabs)/drive/avvia-allievo' as const;
export const AVVIO_PARTI_ROUTE = '/(tabs)/drive/avvia-parti' as const;

type Choice = {
  studentId: string | null;
  /** Guida in agenda: il foglio 2 entra in Road su quella (niente foglio 3). */
  lesson: RoadLesson | null;
};

let choice: Choice = { studentId: null, lesson: null };
const choiceListeners = new Set<() => void>();
export const avvioStore = {
  get: () => choice,
  set: (next: Partial<Choice>) => {
    choice = { ...choice, ...next };
    choiceListeners.forEach((fn) => fn());
  },
  subscribe: (fn: () => void) => {
    choiceListeners.add(fn);
    return () => {
      choiceListeners.delete(fn);
    };
  },
};

// ── Road di un allievo (briefing, guide, punti da migliorare) ────────────
const cache = new Map<string, RoadStudentRoad | null>();
const inflight = new Map<string, Promise<RoadStudentRoad | null>>();
/**
 * REG-694: errori a parte, MAI in `cache`. Prima un errore diventava `null`,
 * cioè «nessuna storia»: a schermo «Prima guida in Road», niente briefing.
 */
const failed = new Set<string>();
let version = 0;
const listeners = new Set<() => void>();
const emit = () => {
  version++;
  listeners.forEach((fn) => fn());
};
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

/** `undefined` = non ancora saputo (o errore: vedi `roadStudentFailed`), `null` = Road spento. */
export function roadStudentData(id: string | null | undefined): RoadStudentRoad | null | undefined {
  return id ? cache.get(id) : undefined;
}

export function prefetchRoadStudent(id: string): Promise<RoadStudentRoad | null> {
  if (cache.has(id)) return Promise.resolve(cache.get(id) ?? null);
  const cur = inflight.get(id);
  if (cur) return cur;
  failed.delete(id);
  const p = regloApi
    .getRoadForStudent(id)
    .then(
      (res) => {
        cache.set(id, res ?? null);
        return res ?? null;
      },
      () => {
        failed.add(id);
        return null;
      },
    )
    .then((res) => {
      inflight.delete(id);
      emit();
      return res;
    });
  inflight.set(id, p);
  return p;
}

export function roadStudentFailed(id: string | null | undefined): boolean {
  return !!id && failed.has(id);
}

/** «Riprova»: torna a «non ancora saputo» (scheletro) e richiede. */
export function retryRoadStudent(id: string) {
  failed.delete(id);
  emit();
  void prefetchRoadStudent(id);
}

/** Scalda i dati di più allievi uno alla volta, a riposo (suggeriti, ultime guide). */
export function warmRoadStudents(ids: string[]) {
  const task = InteractionManager.runAfterInteractions(async () => {
    for (const id of ids) {
      if (!cache.has(id) && !failed.has(id)) await prefetchRoadStudent(id);
    }
  });
  return () => task.cancel();
}

/** Dati Road dell'allievo; li chiede dopo le animazioni se non ci sono ancora. */
export function useRoadStudent(id: string | null | undefined): RoadStudentRoad | null | undefined {
  useSyncExternalStore(subscribe, () => version);
  useEffect(() => {
    if (!id || cache.has(id) || failed.has(id)) return;
    const task = InteractionManager.runAfterInteractions(() => void prefetchRoadStudent(id));
    return () => task.cancel();
  }, [id]);
  return roadStudentData(id);
}

/** Come `useRoadStudent`, con l'errore distinto dal vuoto. */
export function useRoadStudentState(id: string | null | undefined) {
  const data = useRoadStudent(id);
  return { data, failed: roadStudentFailed(id) };
}

/** Ha qualcosa da dire su Road (briefing, guide o punti)? Altrimenti il foglio 2 si salta. */
export function hasRoadHistory(data: RoadStudentRoad | null | undefined): boolean {
  if (!data) return false;
  return !!data.briefing?.lines.length || data.items.length > 0 || !!data.hotspots?.length;
}

/** Svuota la cache (fine guida: i dati dell'allievo sono cambiati). */
export function forgetRoadStudent(id: string) {
  const had = failed.delete(id);
  if (cache.delete(id) || had) emit();
}
