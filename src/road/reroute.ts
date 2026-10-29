import type { RoadPlanStop } from '../types/regloApi';
import { haversineMeters } from './format';
import type { LatLngTuple } from './roadGuide';

/**
 * REG-654 Reglo Road — riaggancio della linea suggerita dopo una deviazione.
 *
 * Tutto in JS sulle posizioni di `tracking.ts`, niente rete per accorgersene:
 * oltre 50 m dalla linea per 12 s = fuori percorso; allora (al massimo una
 * volta ogni 45 s) si chiede `POST /road/plan/route` dalla posizione attuale
 * con le sole tappe rimaste, nell'ordine già scelto, poi la sede. Rete giù =
 * resta la linea vecchia e si riprova al giro dopo.
 *
 * Tappa saltata apposta: la prossima tappa si lascia perdere se l'istruttore
 * le si è avvicinato (≤ 150 m) e poi se ne allontana di altri 300 m, oppure se
 * dopo 3 ricalcoli di fila verso di lei non si è avvicinato. Non conta come
 * raggiunta: l'esito lo calcola il server dal tracciato.
 */

export const REROUTE_OFF_M = 50;
export const REROUTE_OFF_MS = 12_000;
export const REROUTE_GAP_MS = 45_000;
const SKIP_NEAR_M = 150;
const SKIP_AWAY_M = 300;
const SKIP_TRIES = 3;
/** Avvicinamento minimo tra il primo e il terzo ricalcolo perché la tappa resti. */
const SKIP_PROGRESS_M = 100;
/** Vertici della linea guardati davanti a quello già passato (~1,5 km a 10 m l'uno). */
const LINE_WINDOW = 150;

export type RerouteState = {
  /** Da quando l'auto è oltre 50 m dalla linea (null = sulla linea). */
  offSince: number | null;
  /** Ultimo ricalcolo chiesto (ms). */
  lastAt: number;
  pending: boolean;
  /** La prossima tappa da raggiungere, e com'è andata finora verso di lei. */
  target: string | null;
  targetMin: number;
  tries: number;
  triesFromM: number;
  /** Tappe lasciate perdere in questa guida. */
  skipped: string[];
};

export const INITIAL_REROUTE: RerouteState = {
  offSince: null,
  lastAt: 0,
  pending: false,
  target: null,
  targetMin: Infinity,
  tries: 0,
  triesFromM: Infinity,
  skipped: [],
};

type Pt = { lat: number; lng: number };

/** Distanza (m) dal tratto a–b, in proiezione locale (va bene a scala di città). */
function segmentMeters(p: Pt, a: LatLngTuple, b: LatLngTuple): number {
  const k = Math.cos((p.lat * Math.PI) / 180) * 111_320;
  const ax = (a[1] - p.lng) * k;
  const ay = (a[0] - p.lat) * 110_540;
  const bx = (b[1] - p.lng) * k;
  const by = (b[0] - p.lat) * 110_540;
  const dx = bx - ax;
  const dy = by - ay;
  const len = dx * dx + dy * dy;
  const t = len > 0 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len)) : 0;
  return Math.hypot(ax + t * dx, ay + t * dy);
}

/** Quanto dista l'auto dalla parte di linea ancora da fare (dal vertice passato in poi). */
export function distanceFromLine(line: LatLngTuple[], passed: number, p: Pt): number {
  let best = Infinity;
  const from = Math.max(0, passed - 2);
  const to = Math.min(line.length - 1, passed + LINE_WINDOW);
  for (let i = from; i < to; i++) {
    const d = segmentMeters(p, line[i], line[i + 1]);
    if (d < best) best = d;
  }
  return best;
}

/** Le tappe ancora da fare, nell'ordine della linea. */
export function remainingStops(stops: RoadPlanStop[], reached: string[], skipped: string[]): RoadPlanStop[] {
  return stops.filter((s) => !reached.includes(s.key) && !skipped.includes(s.key));
}

/**
 * Un punto GPS. Restituisce lo stato (lo stesso oggetto se non cambia niente)
 * e `request: true` quando va chiesto un ricalcolo adesso.
 */
export function stepReroute(
  st: RerouteState,
  p: Pt & { t: number },
  ctx: {
    line: LatLngTuple[] | null;
    passed: number;
    stops: RoadPlanStop[];
    reached: string[];
    end: Pt | null;
  },
): { state: RerouteState; request: boolean } {
  if (!ctx.line || ctx.line.length < 2) return { state: st, request: false };
  let next = st;
  const patch = (x: Partial<RerouteState>) => {
    next = { ...next, ...x };
  };

  // La prossima tappa: cambia quando è raggiunta o lasciata perdere.
  const left = remainingStops(ctx.stops, ctx.reached, next.skipped);
  const target = left[0] ?? null;
  if ((target?.key ?? null) !== next.target) {
    patch({ target: target?.key ?? null, targetMin: Infinity, tries: 0, triesFromM: Infinity });
  }
  if (target) {
    const d = haversineMeters(p.lat, p.lng, target.lat, target.lng);
    if (d < next.targetMin) patch({ targetMin: d });
    // Avvicinata e poi lasciata alle spalle: la si lascia perdere.
    if (next.targetMin <= SKIP_NEAR_M && d >= next.targetMin + SKIP_AWAY_M) {
      patch({ skipped: [...next.skipped, target.key], target: null, targetMin: Infinity, tries: 0, triesFromM: Infinity });
    }
  }

  const off = distanceFromLine(ctx.line, ctx.passed, p) > REROUTE_OFF_M;
  if (!off) {
    if (next.offSince !== null) patch({ offSince: null });
    return { state: next, request: false };
  }
  if (next.offSince === null) patch({ offSince: p.t });
  const due =
    !next.pending &&
    p.t - (next.offSince ?? p.t) >= REROUTE_OFF_MS &&
    p.t - next.lastAt >= REROUTE_GAP_MS;
  if (!due) return { state: next, request: false };

  // Terzo ricalcolo di fila verso la stessa tappa senza avvicinarsi: si passa alla dopo.
  const cur = target && !next.skipped.includes(target.key) ? target : null;
  if (cur) {
    const d = haversineMeters(p.lat, p.lng, cur.lat, cur.lng);
    const tries = next.tries + 1;
    if (tries >= SKIP_TRIES && d > next.triesFromM - SKIP_PROGRESS_M) {
      patch({ skipped: [...next.skipped, cur.key], target: null, targetMin: Infinity, tries: 0, triesFromM: Infinity });
    } else {
      patch({ tries, triesFromM: next.tries === 0 ? d : next.triesFromM });
    }
  }
  // Niente tappe e niente sede: la linea non porterebbe da nessuna parte.
  if (!remainingStops(ctx.stops, ctx.reached, next.skipped).length && !ctx.end) {
    return { state: next, request: false };
  }
  patch({ pending: true, lastAt: p.t });
  return { state: next, request: true };
}
