import { useSyncExternalStore } from 'react';
import { regloApi } from '../services/regloApi';
import type { RoadDetail, RoadExamRoute, RoadHotspotDetail, RoadHotspots } from '../types/regloApi';
import { prefetchUserPhotos } from '../services/userPhotos';

/**
 * REG-646 Reglo Road — punti critici nell'app istruttore: cache di modulo.
 *
 * Fluidità (design-system §15.8, nessun fetch al tocco): la tab Road scalda
 * il periodo di default appena è a riposo, la schermata scalda gli altri due
 * periodi e i dettagli dei primi punti, il foglio di un punto scalda i
 * percorsi delle guide. Al tocco i dati sono già qui; la rete riconferma
 * dopo, e chi legge si ridisegna solo se la risposta è cambiata.
 */

export type HotspotPeriod = 30 | 90 | 365;
export const HOTSPOT_PERIODS: Array<{ value: HotspotPeriod; label: string; long: string }> = [
  { value: 30, label: '30 giorni', long: 'negli ultimi 30 giorni' },
  { value: 90, label: '3 mesi', long: 'negli ultimi 3 mesi' },
  { value: 365, label: '1 anno', long: "nell'ultimo anno" },
];
export const DEFAULT_HOTSPOT_PERIOD: HotspotPeriod = 90;
/** Dettagli scaldati in anticipo: i primi punti della lista. */
const PREFETCH_DETAILS = 8;
/** Guide scaldate quando si apre il foglio di un punto. */
const PREFETCH_SESSIONS = 6;

/** Inizio del giorno di N giorni fa: la stessa chiave per tutto il giorno (cache del server). */
export function hotspotFrom(period: HotspotPeriod, now = new Date()) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - period);
  return d.toISOString();
}

const lists = new Map<HotspotPeriod, RoadHotspots>();
const listKeys = new Map<HotspotPeriod, string>();
const details = new Map<string, RoadHotspotDetail>();
const sessions = new Map<string, RoadDetail>();
let routes: RoadExamRoute[] | null = null;
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
const detailKey = (key: string, period: HotspotPeriod) => `${period}|${key}`;

export const hotspotsStore = {
  list: (period: HotspotPeriod) => lists.get(period) ?? null,
  detail: (key: string, period: HotspotPeriod) => details.get(detailKey(key, period)) ?? null,
  session: (id: string) => sessions.get(id) ?? null,
  routes: () => routes,
  subscribe,
};

/** Ridisegna chi legge lo store quando arriva qualcosa di nuovo. */
export function useHotspotsVersion() {
  return useSyncExternalStore(subscribe, () => version);
}

const inflight = new Map<string, Promise<unknown>>();
function once<T>(key: string, run: () => Promise<T>): Promise<T> {
  const cur = inflight.get(key) as Promise<T> | undefined;
  if (cur) return cur;
  const p = run().finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

/** Lista di un periodo; errore = eccezione (la schermata lo mostra). */
export function loadHotspots(period: HotspotPeriod): Promise<RoadHotspots> {
  return once(`list:${period}`, async () => {
    const next = await regloApi.getRoadHotspots({ from: hotspotFrom(period) });
    const key = JSON.stringify(next.hotspots) + next.totalErrors;
    if (listKeys.get(period) !== key) {
      listKeys.set(period, key);
      lists.set(period, next);
      emit();
    }
    return lists.get(period)!;
  });
}

export function loadExamRoutes(): Promise<RoadExamRoute[] | null> {
  return once('routes', async () => {
    const next = await regloApi.getRoadExamRoutes().catch(() => null);
    if (next && JSON.stringify(next) !== JSON.stringify(routes)) {
      routes = next;
      emit();
    }
    return routes;
  });
}

export function loadHotspotDetail(key: string, period: HotspotPeriod): Promise<RoadHotspotDetail> {
  return once(`detail:${detailKey(key, period)}`, async () => {
    const next = await regloApi.getRoadHotspot(key, { from: hotspotFrom(period) });
    const k = detailKey(key, period);
    if (JSON.stringify(details.get(k)) !== JSON.stringify(next)) {
      details.set(k, next);
      emit();
    }
    prefetchUserPhotos(next.students.map((st) => st.id));
    return next;
  });
}

/** Dalla tab Road, a riposo: il periodo di default e i percorsi d'esame. */
let warmed = false;
export function warmRoadHotspots() {
  if (warmed) return;
  warmed = true;
  void loadHotspots(DEFAULT_HOTSPOT_PERIOD).catch(() => {
    warmed = false;
  });
  void loadExamRoutes();
}

/** Dalla schermata: dettagli dei primi punti, uno alla volta (non intasa la rete). */
export async function prefetchHotspotDetails(period: HotspotPeriod) {
  const list = lists.get(period)?.hotspots.slice(0, PREFETCH_DETAILS) ?? [];
  for (const h of list) {
    if (details.has(detailKey(h.key, period))) continue;
    await loadHotspotDetail(h.key, period).catch(() => undefined);
  }
}

/** Dal foglio di un punto: i percorsi delle guide, pronti per «Percorso Road». */
export async function prefetchHotspotSessions(detail: RoadHotspotDetail) {
  for (const sess of detail.sessions.slice(0, PREFETCH_SESSIONS)) {
    if (sessions.has(sess.id)) continue;
    await once(`session:${sess.id}`, async () => {
      const d = await regloApi.getRoadSession(sess.id).catch(() => null);
      if (d) sessions.set(sess.id, d);
    });
  }
}

export async function loadHotspotSession(id: string) {
  const cached = sessions.get(id);
  if (cached) return cached;
  const d = await regloApi.getRoadSession(id).catch(() => null);
  if (d) sessions.set(id, d);
  return d;
}

/** Punto aperto nel foglio (seed-and-read, come gli altri fogli Road). */
let selected: { key: string; period: HotspotPeriod } | null = null;
export const hotspotSheetStore = {
  set(next: { key: string; period: HotspotPeriod }) {
    selected = next;
  },
  get: () => selected,
};
