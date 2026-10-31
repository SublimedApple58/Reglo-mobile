import type { Router } from 'expo-router';
import { regloApi } from '../services/regloApi';
import type { RoadDetail } from '../types/regloApi';
import { roadRouteMapStore, type RoadPercorsoPending } from './routeMapStore';

/** Percorsi già aperti: riaprirli è immediato (una guida finita non cambia). */
const cache = new Map<string, RoadDetail>();
const CACHE_MAX = 20;

function remember(id: string, detail: RoadDetail) {
  cache.delete(id);
  cache.set(id, detail);
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value as string);
}

async function load(appointmentId: string, hint: RoadPercorsoPending['hint']) {
  roadRouteMapStore.setPending({ appointmentId, status: 'loading', hint });
  let detail: RoadDetail | null;
  let failed = false;
  try {
    detail = await regloApi.getRoadForAppointment(appointmentId);
  } catch {
    detail = null;
    failed = true;
  }
  // aperto un altro percorso nel frattempo: questa risposta non serve più
  if (roadRouteMapStore.pending()?.appointmentId !== appointmentId) return;
  if (!detail) {
    roadRouteMapStore.setPending({ appointmentId, status: failed ? 'error' : 'empty', hint });
    return;
  }
  remember(appointmentId, detail);
  roadRouteMapStore.set(detail);
}

/**
 * REG-638 — apre il foglio «Percorso Road» di una guida (dettaglio guida e
 * storico dell'allievo nell'app istruttore). Il foglio è registrato negli stack
 * home, notes e drive: si spinge su quello da cui si arriva.
 * REG-694: il foglio si apre subito; i dati arrivano dopo (scheletro), un
 * errore resta nel foglio con «Riprova» invece di un tocco che non fa niente.
 */
export function openRoadPercorso(
  router: Router,
  stack: 'home' | 'notes' | 'drive',
  appointmentId: string,
  preloaded?: RoadDetail | null,
  hint?: RoadPercorsoPending['hint'],
): void {
  const ready = preloaded ?? cache.get(appointmentId) ?? null;
  if (ready) {
    remember(appointmentId, ready);
    roadRouteMapStore.set(ready);
  } else {
    void load(appointmentId, hint ?? null);
  }
  router.push(`/(tabs)/${stack}/road-percorso`);
}

/** «Riprova» dal foglio in errore. */
export function retryRoadPercorso() {
  const cur = roadRouteMapStore.pending();
  if (cur) void load(cur.appointmentId, cur.hint);
}
