import * as Location from 'expo-location';

import { regloApi } from '../services/regloApi';
import type { RoadPlanStop, RoadSessionWithLesson, RoadStudentHotspot } from '../types/regloApi';
import { haversineMeters } from './format';
import { hasPlanOverride, lessonMinutes } from './planStore';

/**
 * REG-652 Reglo Road — la mappa del giro durante la guida: linea suggerita
 * sulle strade vere (partenza → tappe → sede, REG-653), tappe numerate
 * nell'ordine della linea e i punti critici di QUELL'allievo.
 *
 * Due richieste, una volta per sessione, all'ingresso in Road (mai durante la
 * guida): `POST /road/plan/route` (solo con un giro) e `GET /road/plan` per i
 * punti dell'allievo. Rete giù o Routes API giù = niente linea, restano tappe e
 * punti; nessun errore a schermo. Il riaggancio dopo una deviazione (REG-654)
 * sta in `reroute.ts` + `fetchReroute`.
 */

export type LatLngTuple = [number, number];

export type RoadGuide = {
  sessionId: string;
  /** La linea suggerita, o null (senza giro o Google giù). */
  line: LatLngTuple[] | null;
  /** Tappe nell'ordine della linea (ottimizzato dal server alla partenza). */
  stops: RoadPlanStop[];
  /** La sede dove si chiude la linea. */
  end: { lat: number; lng: number } | null;
  /** I punti critici dell'allievo (i suoi errori ripetuti). */
  hotspots: RoadStudentHotspot[];
};

/** Massimo di punti dell'allievo sulla mappa: posti fissi in MapView (crash AIRMap). */
export const GUIDE_HOTSPOT_SLOTS = 8;
/** Sulla linea se entro tanti metri da un suo vertice: la parte prima si attenua. */
export const GUIDE_ON_LINE_M = 50;
/** Quanti vertici avanti si cercano a ogni punto GPS (la linea è semplificata a ~10 m). */
const GUIDE_LOOKAHEAD = 150;

/** Le tappe nell'ordine dato dal server; chiavi sconosciute o mancanti = ordine originale. */
export function orderGuideStops(stops: RoadPlanStop[], order: string[] | null | undefined): RoadPlanStop[] {
  if (!order || order.length !== stops.length) return stops;
  const byKey = new Map(stops.map((s) => [s.key, s]));
  const out = order.map((k) => byKey.get(k));
  return out.every(Boolean) ? (out as RoadPlanStop[]) : stops;
}

/**
 * Fin dove la linea è già stata percorsa: il vertice più vicino davanti a
 * quello già passato, se l'auto è entro 50 m dalla linea. Non torna mai
 * indietro (si attenua solo la strada fatta).
 */
export function advanceOnLine(line: LatLngTuple[], passed: number, point: { lat: number; lng: number }): number {
  let best = -1;
  let bestD = GUIDE_ON_LINE_M;
  const to = Math.min(line.length, passed + GUIDE_LOOKAHEAD);
  for (let i = Math.max(0, passed); i < to; i++) {
    const d = haversineMeters(point.lat, point.lng, line[i][0], line[i][1]);
    if (d <= bestD) [best, bestD] = [i, d];
  }
  return best > passed ? best : passed;
}

/** Le punte dei punti critici per la mappa (i più ripetuti). */
export function guideHotspots(list: RoadStudentHotspot[] | null | undefined): RoadStudentHotspot[] {
  return [...(list ?? [])].sort((a, b) => b.errors - a.errors).slice(0, GUIDE_HOTSPOT_SLOTS);
}

const loading = new Set<string>();

type Pt = { lat: number; lng: number };

/**
 * Da dove parte la linea: l'ultima posizione della sessione, o la prima del
 * GPS. Appena entrati in Road spesso non c'è ancora nessun fix (e
 * `getLastKnownPosition` può essere vuoto): si aspetta il primo, fino a 60 s.
 */
async function startPoint(session: RoadSessionWithLesson, waitFix: () => Promise<Pt | null>) {
  if (session.last) return { lat: session.last.lat, lng: session.last.lng };
  const first = await waitFix();
  if (first) return first;
  const p = await Location.getLastKnownPositionAsync().catch(() => null);
  return p ? { lat: p.coords.latitude, lng: p.coords.longitude } : null;
}

/**
 * Carica la guida della sessione (una volta). `onReady` riceve il risultato
 * anche se parziale: la linea e i punti arrivano da due richieste separate.
 */
export async function loadRoadGuide(
  session: RoadSessionWithLesson,
  waitFix: () => Promise<Pt | null>,
  onReady: (guide: RoadGuide) => void,
) {
  if (loading.has(session.id)) return;
  loading.add(session.id);
  const planStops = session.plan?.stops ?? [];
  let guide: RoadGuide = { sessionId: session.id, line: null, stops: planStops, end: null, hotspots: [] };
  onReady(guide);

  const studentId = session.lesson.student?.id;
  const hotspotsReq = studentId
    ? regloApi
        .getRoadPlan({ studentId, durationMin: lessonMinutes(session.lesson) })
        .then((r) => guideHotspots(r.studentHotspots))
        .catch(() => [] as RoadStudentHotspot[])
    : Promise.resolve([] as RoadStudentHotspot[]);

  // REG-667: un giro modificato dall'istruttore tiene il suo ordine (niente riottimizzazione).
  const custom = !!studentId && hasPlanOverride(studentId, lessonMinutes(session.lesson));
  const routeReq = planStops.length
    ? startPoint(session, waitFix).then((start) =>
        start ? regloApi.getRoadPlanRoute({ start, stops: planStops, optimize: !custom }).catch(() => null) : null,
      )
    : Promise.resolve(null);

  hotspotsReq.then((hotspots) => {
    guide = { ...guide, hotspots };
    onReady(guide);
  });
  routeReq.then((route) => {
    if (!route) return;
    guide = {
      ...guide,
      line: route.line && route.line.length >= 2 ? route.line : null,
      stops: orderGuideStops(planStops, route.order),
      end: route.end,
    };
    onReady(guide);
  });
}

/** A fine guida / uscita: la prossima sessione ricarica. */
export function forgetRoadGuide(sessionId: string) {
  loading.delete(sessionId);
}

/**
 * REG-654: la linea riagganciata dalla posizione attuale, con le sole tappe
 * rimaste nell'ordine già scelto (niente riottimizzazione), poi la sede. Null
 * se la rete o Google non rispondono: resta la linea vecchia.
 */
export async function fetchReroute(
  start: Pt,
  stops: RoadPlanStop[],
): Promise<{ line: LatLngTuple[] | null; end: Pt | null } | null> {
  const route = await regloApi.getRoadPlanRoute({ start, stops, optimize: false }).catch(() => null);
  if (!route) return null;
  return { line: route.line && route.line.length >= 2 ? route.line : null, end: route.end };
}
