import type { Router } from 'expo-router';
import type { RoadLesson } from '../types/regloApi';
import { enterRoad, ensureMotoStrada, hasSeenRoadPrivacy } from './roadActions';
import { chosenLessonPlan } from './planStore';

/**
 * REG-638 Reglo Road — ingresso. Seed dei due form sheet nativi della home
 * (`road-invite`, `road-privacy`): la guida da cui si entra.
 */

type EntrySeed = { lesson: RoadLesson; locationName?: string | null };

let seed: EntrySeed | null = null;
const listeners = new Set<() => void>();

export const roadEntryStore = {
  set(next: EntrySeed | null) {
    seed = next;
    listeners.forEach((fn) => fn());
  },
  get: () => seed,
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};

/** Il form sheet dell'invito è aperto (niente doppioni al ritorno in foreground). */
export const roadInviteOpen = { current: false };

/**
 * Richiesta di rilettura di `/road/state` (es. subito dopo «Presente»):
 * la ascolta il RoadController. `force` ripropone l'invito anche se era stato
 * chiuso con «Non ora» per questa guida.
 */
type RoadCheckRequest = { force?: boolean };
const checkListeners = new Set<(req: RoadCheckRequest) => void>();
export function requestRoadCheck(req: RoadCheckRequest = {}) {
  checkListeners.forEach((fn) => fn(req));
}
export function onRoadCheckRequest(fn: (req: RoadCheckRequest) => void) {
  checkListeners.add(fn);
  return () => {
    checkListeners.delete(fn);
  };
}

/**
 * Road libero: l'avvio da fare dopo «Prima di partire» (primo ingresso sul
 * dispositivo). Lo lascia il foglio «Avvia guida», lo prende l'informativa.
 */
let pendingStart: (() => Promise<boolean>) | null = null;
export const roadPendingStart = {
  set(fn: (() => Promise<boolean>) | null) {
    pendingStart = fn;
  },
  take() {
    const fn = pendingStart;
    pendingStart = null;
    return fn;
  },
};

export const ROAD_INVITE_ROUTE = '/(tabs)/home/road-invite' as const;
export const ROAD_PRIVACY_ROUTE = '/(tabs)/home/road-privacy' as const;

/**
 * REG-794: lo stack dei fogli di Road (invito, informativa, «Il giro»). Il
 * titolare-istruttore parte da «Oggi»: lì i fogli si aprono in Oggi, senza
 * saltare all'Agenda (e «Non ora» resta dov'era). Altrove l'Agenda, come sempre.
 */
export type RoadSheetBase = 'home' | 'today';
export const roadSheetBase = (segments: string[]): RoadSheetBase =>
  segments[0] === '(tabs)' && segments[1] === 'today' ? 'today' : 'home';
export const roadSheetRoute = (base: RoadSheetBase, name: 'road-invite' | 'road-privacy' | 'giro') =>
  `/(tabs)/${base}/${name}` as const;
export const ROAD_ROUTE = '/road' as const;

/** Pausa fra la chiusura di un form sheet iOS e la prossima presentazione. */
export const SHEET_HANDOFF_MS = 380;

/**
 * «Entra in Road»: al primo ingresso sul dispositivo passa dall'informativa
 * (che poi chiede il permesso); altrimenti chiede il permesso e parte.
 */
export async function beginRoadEntry(router: Router, input: RoadLesson, base: RoadSheetBase = 'home') {
  // REG-753: una moto «Birilli» si passa a «Strada» (con conferma) prima di partire.
  const lesson = await ensureMotoStrada(input);
  if (!lesson) return;
  if (!(await hasSeenRoadPrivacy())) {
    roadEntryStore.set({ lesson });
    router.push(roadSheetRoute(base, 'road-privacy') as never);
    return;
  }
  // REG-649: il giro scelto nella card (o nessuno con «Segui il giro» spento).
  const ok = await enterRoad(lesson.appointmentId, chosenLessonPlan(lesson));
  if (ok) router.replace(ROAD_ROUTE);
}
