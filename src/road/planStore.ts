import { useCallback, useSyncExternalStore } from 'react';
import { regloApi } from '../services/regloApi';
import type { RoadLesson, RoadPlan, RoadPlanResponse } from '../types/regloApi';

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

/** Il giro di allievo + durata: `undefined` = in arrivo, `null` = non c'è. */
export function usePlan(studentId: string | null | undefined, durationMin: number): RoadPlanResponse | null | undefined {
  const key = studentId ? planKey(studentId, durationMin) : '';
  const get = useCallback(() => (key ? entries.get(key) : undefined), [key]);
  const entry = useSyncExternalStore(subscribe, get);
  return entry ? entry.data : undefined;
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
  const plan = entries.get(planKey(studentId, durationMin))?.data?.plan ?? null;
  return plan?.stops.length ? plan : null;
}

export function chosenLessonPlan(lesson: RoadLesson): RoadPlan | null {
  return chosenPlan(lesson.student?.id, lessonMinutes(lesson));
}
