import type { Router } from 'expo-router';
import type { RoadLesson } from '../types/regloApi';
import { enterRoad, hasSeenRoadPrivacy } from './roadActions';

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

export const ROAD_INVITE_ROUTE = '/(tabs)/home/road-invite' as const;
export const ROAD_PRIVACY_ROUTE = '/(tabs)/home/road-privacy' as const;
export const ROAD_ROUTE = '/road' as const;

/** Pausa fra la chiusura di un form sheet iOS e la prossima presentazione. */
export const SHEET_HANDOFF_MS = 380;

/**
 * «Entra in Road»: al primo ingresso sul dispositivo passa dall'informativa
 * (che poi chiede il permesso); altrimenti chiede il permesso e parte.
 */
export async function beginRoadEntry(router: Router, lesson: RoadLesson) {
  if (!(await hasSeenRoadPrivacy())) {
    roadEntryStore.set({ lesson });
    router.push(ROAD_PRIVACY_ROUTE);
    return;
  }
  const ok = await enterRoad(lesson.appointmentId);
  if (ok) router.replace(ROAD_ROUTE);
}
