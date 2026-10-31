import { useCallback, useSyncExternalStore } from 'react';
import { regloApi } from '../services/regloApi';
import { FALLBACK_BASE_CATALOG } from './markerArt';
import type { RoadLesson, RoadPlan, RoadPlanResponse, RoadPlanRouteResponse, RoadPlanStop, SavedRoadPlan } from '../types/regloApi';

/**
 * REG-649 Reglo Road — il giro della prossima guida nei fogli di partenza.
 *
 * Il giro dipende da allievo e durata (`GET /road/plan`). Si chiede PRIMA del
 * tocco (fluidità §15.8): la tab Road lo scarica per i tre volti suggeriti e
 * per la guida in agenda, RoadController per la guida dell'invito, «Avvia
 * guida» per l'allievo scelto e le sue durate. I fogli leggono da qui.
 *
 * La scelta «Con il giro / Senza giro» è per allievo e vale ovunque (tab,
 * invito, foglio della guida, «Avvia guida»); nasce «con il giro».
 */

type Entry = { data: RoadPlanResponse | null; at: number };

/** Dopo quanto un giro scaricato si riconferma (le guide nuove lo cambiano poco). */
const FRESH_MS = 5 * 60_000;

const entries = new Map<string, Entry>();
const inflight = new Map<string, Promise<void>>();
const choices = new Map<string, boolean>();
const listeners = new Set<() => void>();
let origin: { lat: number; lng: number } | null = null;

const notify = () => listeners.forEach((fn) => fn());
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

export const planKey = (studentId: string, durationMin: number) => `${studentId}|${durationMin}`;

/** Durata della guida in agenda in minuti (15–240, come vuole il server). */
export function lessonMinutes(lesson: Pick<RoadLesson, 'startsAt' | 'endsAt'>) {
  const m = Math.round((new Date(lesson.endsAt).getTime() - new Date(lesson.startsAt).getTime()) / 60_000);
  return Math.min(240, Math.max(15, Number.isFinite(m) ? m : 60));
}

/** Dove sei (ultima posizione nota): il giro parte da qui, altrimenti dalla sede. */
export function setPlanOrigin(next: { lat: number; lng: number } | null) {
  origin = next;
}

/** REG-694: giri il cui caricamento è fallito (`entries` ha `null`, come «nessun giro»). */
const planFailed = new Set<string>();

/** Il giro di allievo + durata non è arrivato per un errore (non perché non c'è). */
export function usePlanFailed(studentId: string | null | undefined, durationMin: number): boolean {
  const key = studentId ? planKey(studentId, durationMin) : '';
  const get = useCallback(() => !!key && planFailed.has(key), [key]);
  return useSyncExternalStore(subscribe, get);
}

/** «Riprova»: torna a «in arrivo» (scheletro) e richiede. */
export function retryPlan(studentId: string, durationMin: number) {
  const key = planKey(studentId, durationMin);
  entries.delete(key);
  planFailed.delete(key);
  notify();
  prefetchPlan(studentId, durationMin);
}

export function prefetchPlan(studentId: string | null | undefined, durationMin: number) {
  if (!studentId) return;
  const key = planKey(studentId, durationMin);
  const cur = entries.get(key);
  if ((cur && Date.now() - cur.at < FRESH_MS) || inflight.has(key)) return;
  const job = regloApi
    .getRoadPlan({ studentId, durationMin, lat: origin?.lat, lng: origin?.lng })
    .then((data) => {
      const prev = entries.get(key)?.data;
      entries.set(key, { data, at: Date.now() });
      if (planFailed.delete(key)) notify();
      if (JSON.stringify(prev) !== JSON.stringify(data)) notify();
    })
    .catch(() => {
      // Giro non disponibile: i fogli partono senza, come con l'interruttore spento.
      // REG-694: ma la riga lo dice («Giro non caricato · Riprova»), non sparisce.
      if (!entries.has(key)) {
        entries.set(key, { data: null, at: Date.now() });
        planFailed.add(key);
        notify();
      }
    })
    .finally(() => {
      inflight.delete(key);
    });
  inflight.set(key, job);
}

export function prefetchLessonPlan(lesson: RoadLesson | null | undefined) {
  if (lesson?.student?.id) prefetchPlan(lesson.student.id, lessonMinutes(lesson));
  if (lesson?.appointmentId) prefetchSavedPlan(lesson.appointmentId);
}

/**
 * REG-667/668: il giro modificato dall'istruttore (tappe tolte, riordinate,
 * aggiunte) vince su quello proposto. È salvato sul server per guida
 * (`/road/plan/saved`, REG-668): si legge insieme al giro proposto, prima del
 * tocco; si scrive con «Salva» nel foglio «Il giro» (UI solo sulla risposta).
 * Alla partenza il server usa comunque quello salvato.
 */
const overrides = new Map<string, SavedRoadPlan | null>();
const savedJobs = new Map<string, Promise<void>>();

export function prefetchSavedPlan(appointmentId: string | null | undefined) {
  if (!appointmentId || overrides.has(appointmentId) || savedJobs.has(appointmentId)) return;
  const job = regloApi
    .getSavedRoadPlan(appointmentId)
    .then((r) => {
      overrides.set(appointmentId, r.saved?.stops.length ? r.saved : null);
    })
    // Rete giù: vale il giro proposto (al prossimo dettaglio si riprova).
    .catch(() => undefined)
    .finally(() => {
      savedJobs.delete(appointmentId);
      notify();
    });
  savedJobs.set(appointmentId, job);
}

/** Salva il giro modificato della guida; errore = eccezione (il foglio resta aperto). */
export async function savePlanOverride(appointmentId: string, plan: RoadPlan) {
  const r = await regloApi.saveRoadPlan({ appointmentId, stops: plan.stops, minutes: plan.minutes });
  overrides.set(appointmentId, r.saved);
  merged.delete(appointmentId);
  notify();
}

/** «Torna al giro suggerito»: cancella il giro salvato. */
export async function resetPlanOverride(appointmentId: string) {
  await regloApi.deleteSavedRoadPlan(appointmentId);
  overrides.set(appointmentId, null);
  merged.delete(appointmentId);
  notify();
}

/** Risposta con il giro salvato al posto di quello proposto (stabile per useSyncExternalStore). */
const merged = new Map<string, { base: RoadPlanResponse | null; over: SavedRoadPlan; out: RoadPlanResponse | null }>();
function withOverride(appointmentId: string | null | undefined, data: RoadPlanResponse | null): RoadPlanResponse | null {
  const over = appointmentId ? overrides.get(appointmentId) : null;
  if (!appointmentId || !over) return data;
  const hit = merged.get(appointmentId);
  if (hit && hit.base === data && hit.over === over) return hit.out;
  const out = data ? { ...data, plan: { stops: over.stops, minutes: over.minutes } } : null;
  merged.set(appointmentId, { base: data, over, out });
  return out;
}

export function hasPlanOverride(appointmentId: string | null | undefined) {
  return !!appointmentId && !!overrides.get(appointmentId);
}

/** Il giro salvato della guida (per «salvato alle …» nel foglio), o null. */
export function useSavedPlan(appointmentId: string | null | undefined): SavedRoadPlan | null {
  const get = useCallback(() => (appointmentId ? overrides.get(appointmentId) ?? null : null), [appointmentId]);
  return useSyncExternalStore(subscribe, get);
}

/**
 * Il giro di allievo + durata: `undefined` = in arrivo, `null` = non c'è. Con
 * `appointmentId` vince il giro salvato per quella guida (e si aspetta anche
 * lui, così non si vede prima il proposto e poi quello salvato).
 */
export function usePlan(
  studentId: string | null | undefined,
  durationMin: number,
  appointmentId?: string | null,
): RoadPlanResponse | null | undefined {
  const key = studentId ? planKey(studentId, durationMin) : '';
  const get = useCallback(() => {
    const entry = key ? entries.get(key) : undefined;
    if (!entry) return undefined;
    if (appointmentId && savedJobs.has(appointmentId)) return undefined;
    return withOverride(appointmentId, entry.data);
  }, [key, appointmentId]);
  return useSyncExternalStore(subscribe, get);
}

// ─── REG-667: la linea del giro per la miniatura e il foglio ────────────────

type Pt = { lat: number; lng: number };
const routes = new Map<string, RoadPlanRouteResponse | null>();
const routeJobs = new Map<string, Promise<RoadPlanRouteResponse | null>>();
const routeKey = (start: Pt, stops: RoadPlanStop[], optimize: boolean) =>
  `${start.lat.toFixed(4)},${start.lng.toFixed(4)}|${stops.map((x) => x.key).join(',')}|${optimize ? 1 : 0}`;

/**
 * La linea del giro (strade vere, chiusa in sede) da `POST /road/plan/route`:
 * il server la tiene in cache 90 giorni per gli stessi punti, qui la si tiene
 * per la sessione dell'app. Si chiede all'apertura del dettaglio, mai al tocco.
 */
export function prefetchPlanRoute(start: Pt, stops: RoadPlanStop[], optimize = true): Promise<RoadPlanRouteResponse | null> {
  const key = routeKey(start, stops, optimize);
  if (routes.has(key)) return Promise.resolve(routes.get(key) ?? null);
  const running = routeJobs.get(key);
  if (running) return running;
  const job = regloApi
    .getRoadPlanRoute({ start, stops, optimize })
    .catch(() => null)
    .then((r) => {
      routes.set(key, r);
      routeJobs.delete(key);
      notify();
      return r;
    });
  routeJobs.set(key, job);
  return job;
}

/** `undefined` = in arrivo, `null` = niente linea (rete o Google giù). */
export function usePlanRoute(start: Pt | null, stops: RoadPlanStop[] | null, optimize = true): RoadPlanRouteResponse | null | undefined {
  const key = start && stops?.length ? routeKey(start, stops, optimize) : '';
  const get = useCallback(() => (key ? routes.get(key) : null), [key]);
  return useSyncExternalStore(subscribe, get);
}

/** Minuti stimati del giro dalla lunghezza della linea (25 km/h di media + 5 min per tappa, come il server). */
export function planMinutesFor(lengthMeters: number | null | undefined, stops: number) {
  if (lengthMeters == null) return null;
  return Math.round((lengthMeters / 1000 / 25) * 60) + stops * 5;
}

export function usePlanChoice(studentId: string | null | undefined): [boolean, (v: boolean) => void] {
  const get = useCallback(() => (studentId ? choices.get(studentId) !== false : true), [studentId]);
  const value = useSyncExternalStore(subscribe, get);
  const set = useCallback(
    (v: boolean) => {
      if (!studentId) return;
      choices.set(studentId, v);
      notify();
    },
    [studentId],
  );
  return [value, set];
}

/** Il giro da mandare all'ingresso in Road: solo se c'è, è acceso e l'istruttore non ha scelto «Senza giro». */
export function chosenPlan(studentId: string | null | undefined, durationMin: number, appointmentId?: string | null): RoadPlan | null {
  if (!studentId || choices.get(studentId) === false) return null;
  const over = appointmentId ? overrides.get(appointmentId) : null;
  const plan = over ? { stops: over.stops, minutes: over.minutes } : (entries.get(planKey(studentId, durationMin))?.data?.plan ?? null);
  return plan?.stops.length ? plan : null;
}

export function chosenLessonPlan(lesson: RoadLesson): RoadPlan | null {
  return chosenPlan(lesson.student?.id, lessonMinutes(lesson), lesson.appointmentId);
}

/** «Pedoni · SS150»: cosa e dove (la via da sola si ripete, QA 30/10). Percorso d'esame: il suo nome. */
export function planStopLabel(stop: RoadPlanStop): string {
  const what = stop.kind ? FALLBACK_BASE_CATALOG.find((c) => c.key === stop.kind)?.label : null;
  const where = stop.title.replace(/^Strada Statale (\d+).*$/i, 'SS$1');
  return what && what !== where ? `${what} · ${where}` : where;
}
