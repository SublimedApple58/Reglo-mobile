import { useCallback, useSyncExternalStore } from 'react';
import { regloApi } from '../services/regloApi';
import { FALLBACK_BASE_CATALOG } from './markerArt';
import type { RoadLesson, RoadPlan, RoadPlanResponse, RoadPlanRouteResponse, RoadPlanStop } from '../types/regloApi';

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
      if (JSON.stringify(prev) !== JSON.stringify(data)) notify();
    })
    .catch(() => {
      // Giro non disponibile: i fogli partono senza, come con l'interruttore spento.
      if (!entries.has(key)) {
        entries.set(key, { data: null, at: Date.now() });
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
}

/**
 * REG-667: il giro modificato dall'istruttore (tappe tolte, riordinate,
 * aggiunte) vince su quello proposto, per allievo e durata. Resta in memoria
 * come la scelta «Segui il giro»; si manda al server all'ingresso in Road.
 */
const overrides = new Map<string, RoadPlan>();
/** Risposta con il giro modificato al posto di quello proposto (stabile per useSyncExternalStore). */
const merged = new Map<string, { base: RoadPlanResponse | null; over: RoadPlan; out: RoadPlanResponse | null }>();
function withOverride(key: string, data: RoadPlanResponse | null): RoadPlanResponse | null {
  const over = overrides.get(key);
  if (!over) return data;
  const hit = merged.get(key);
  if (hit && hit.base === data && hit.over === over) return hit.out;
  const out = data ? { ...data, plan: over } : null;
  merged.set(key, { base: data, over, out });
  return out;
}

export function setPlanOverride(studentId: string, durationMin: number, plan: RoadPlan | null) {
  const key = planKey(studentId, durationMin);
  if (plan) overrides.set(key, plan);
  else overrides.delete(key);
  merged.delete(key);
  notify();
}

export function hasPlanOverride(studentId: string | null | undefined, durationMin: number) {
  return !!studentId && overrides.has(planKey(studentId, durationMin));
}

/** Il giro di allievo + durata: `undefined` = in arrivo, `null` = non c'è. */
export function usePlan(studentId: string | null | undefined, durationMin: number): RoadPlanResponse | null | undefined {
  const key = studentId ? planKey(studentId, durationMin) : '';
  const get = useCallback(() => {
    const entry = key ? entries.get(key) : undefined;
    return entry ? withOverride(key, entry.data) : undefined;
  }, [key]);
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
export function chosenPlan(studentId: string | null | undefined, durationMin: number): RoadPlan | null {
  if (!studentId || choices.get(studentId) === false) return null;
  const key = planKey(studentId, durationMin);
  const plan = overrides.get(key) ?? entries.get(key)?.data?.plan ?? null;
  return plan?.stops.length ? plan : null;
}

export function chosenLessonPlan(lesson: RoadLesson): RoadPlan | null {
  return chosenPlan(lesson.student?.id, lessonMinutes(lesson));
}

/** «Pedoni · SS150»: cosa e dove (la via da sola si ripete, QA 30/10). Percorso d'esame: il suo nome. */
export function planStopLabel(stop: RoadPlanStop): string {
  const what = stop.kind ? FALLBACK_BASE_CATALOG.find((c) => c.key === stop.kind)?.label : null;
  const where = stop.title.replace(/^Strada Statale (\d+).*$/i, 'SS$1');
  return what && what !== where ? `${what} · ${where}` : where;
}
