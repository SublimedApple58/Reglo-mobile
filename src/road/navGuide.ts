import type { RoadPlanStop, RoadRouteStep, RoadStudentHotspot } from '../types/regloApi';
import { haversineMeters } from './format';
import type { LatLngTuple } from './roadGuide';

/**
 * REG-680/681 Reglo Road — la guida «accompagnata»: dove si è sulla linea del
 * giro, la prossima svolta, la prossima tappa e l'avvicinamento ai punti
 * critici dell'allievo. Logica pura (niente React, niente rete): la schermata
 * la chiama a ogni punto GPS.
 */

const M_PER_DEG_LAT = 110_540;
const mPerDegLng = (lat: number) => 111_320 * Math.cos((lat * Math.PI) / 180);

/** La linea misurata: metri dall'inizio a ogni vertice. */
export type MeasuredLine = { line: LatLngTuple[]; cum: number[]; length: number };

export function measureLine(line: LatLngTuple[]): MeasuredLine {
  const cum = [0];
  for (let i = 1; i < line.length; i++) {
    cum.push(cum[i - 1] + haversineMeters(line[i - 1][0], line[i - 1][1], line[i][0], line[i][1]));
  }
  return { line, cum, length: cum[cum.length - 1] ?? 0 };
}

/**
 * Il punto della linea più vicino a `p`, cercato fra i vertici `from`…`to`:
 * quanti metri dall'inizio (`along`) e a che distanza (`off`).
 */
export function projectOnLine(
  m: MeasuredLine,
  p: { lat: number; lng: number },
  from = 0,
  to = m.line.length - 1,
): { along: number; off: number; index: number } {
  let best = { along: 0, off: Infinity, index: 0 };
  const kx = mPerDegLng(p.lat);
  const a0 = Math.max(0, from);
  const a1 = Math.min(m.line.length - 1, to);
  for (let i = a0; i < a1; i++) {
    const [aLat, aLng] = m.line[i];
    const [bLat, bLng] = m.line[i + 1];
    const ax = (aLng - p.lng) * kx;
    const ay = (aLat - p.lat) * M_PER_DEG_LAT;
    const dx = (bLng - aLng) * kx;
    const dy = (bLat - aLat) * M_PER_DEG_LAT;
    const len2 = dx * dx + dy * dy;
    const t = len2 > 0 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2)) : 0;
    const off = Math.hypot(ax + t * dx, ay + t * dy);
    if (off < best.off) best = { along: m.cum[i] + t * (m.cum[i + 1] - m.cum[i]), off, index: i };
  }
  return best;
}

/** REG-689: sotto questa distanza l'auto mostrata sta sulla linea del giro. */
const SNAP_FULL_M = 10;
/** …e oltre questa è libera (GPS smorzato); in mezzo sfuma. */
const SNAP_NONE_M = 25;

/**
 * REG-689 — aggancio dell'auto alla linea del giro, per ogni fotogramma.
 * Cerca vicino all'ultimo tratto trovato (la linea può ripassare dalla stessa
 * strada); se lì non c'è, al massimo una volta al secondo su tutta la linea.
 */
export function createLineSnap(m: MeasuredLine) {
  let idx = 0;
  let fullAt = 0;
  return (lat: number, lng: number) => {
    const p = { lat, lng };
    let hit = projectOnLine(m, p, idx - 5, idx + 60);
    if (hit.off > SNAP_NONE_M) {
      const now = Date.now();
      if (now - fullAt < 1000) return null;
      fullAt = now;
      hit = projectOnLine(m, p);
      if (hit.off > SNAP_NONE_M) return null;
    }
    idx = hit.index;
    const [aLat, aLng] = m.line[hit.index];
    const [bLat, bLng] = m.line[Math.min(hit.index + 1, m.line.length - 1)];
    const segLen = m.cum[Math.min(hit.index + 1, m.cum.length - 1)] - m.cum[hit.index];
    const t = segLen > 0 ? (hit.along - m.cum[hit.index]) / segLen : 0;
    const kx = mPerDegLng(aLat);
    const bearing = ((Math.atan2((bLng - aLng) * kx, (bLat - aLat) * M_PER_DEG_LAT) * 180) / Math.PI + 360) % 360;
    const w = hit.off <= SNAP_FULL_M ? 1 : (SNAP_NONE_M - hit.off) / (SNAP_NONE_M - SNAP_FULL_M);
    return { lat: aLat + (bLat - aLat) * t, lng: aLng + (bLng - aLng) * t, bearing, w };
  };
}

/** Svolte messe sulla linea, in ordine (ognuna cercata dopo la precedente). */
export type PlacedStep = RoadRouteStep & { along: number };

export function placeSteps(m: MeasuredLine, steps: RoadRouteStep[]): PlacedStep[] {
  const out: PlacedStep[] = [];
  let from = 0;
  for (const s of steps) {
    // «Continua su via X»: solo un cambio di nome, non una manovra (come Apple Maps).
    if (s.maneuver === 'NAME_CHANGE') continue;
    const hit = projectOnLine(m, s, from);
    // Svolta lontana dalla linea (linea semplificata, tratto d'esame): si salta.
    if (hit.off > 40) continue;
    out.push({ ...s, along: hit.along });
    from = hit.index;
  }
  return out;
}

/** Dove si mette una tappa sulla linea (la prima volta che la linea ci passa vicino). */
export function placeStops(m: MeasuredLine, stops: RoadPlanStop[]): Array<{ key: string; along: number | null }> {
  let from = 0;
  return stops.map((s) => {
    const hit = projectOnLine(m, s, from);
    if (hit.off > 80) return { key: s.key, along: null };
    from = hit.index;
    return { key: s.key, along: hit.along };
  });
}

// ─── Manovre ────────────────────────────────────────────────────────────────

/** Icona Material (monocromatica) della manovra di Google. */
export function maneuverGlyph(maneuver: string | null | undefined): string {
  switch (maneuver) {
    case 'TURN_RIGHT':
      return 'turn-right';
    case 'TURN_LEFT':
      return 'turn-left';
    case 'TURN_SLIGHT_RIGHT':
      return 'turn-slight-right';
    case 'TURN_SLIGHT_LEFT':
      return 'turn-slight-left';
    case 'TURN_SHARP_RIGHT':
      return 'turn-sharp-right';
    case 'TURN_SHARP_LEFT':
      return 'turn-sharp-left';
    case 'UTURN_RIGHT':
      return 'u-turn-right';
    case 'UTURN_LEFT':
      return 'u-turn-left';
    case 'ROUNDABOUT_RIGHT':
    case 'ROUNDABOUT_CLOCKWISE':
      return 'roundabout-right';
    case 'ROUNDABOUT_LEFT':
    case 'ROUNDABOUT_COUNTERCLOCKWISE':
      return 'roundabout-left';
    case 'FORK_RIGHT':
      return 'fork-right';
    case 'FORK_LEFT':
      return 'fork-left';
    case 'RAMP_RIGHT':
      return 'ramp-right';
    case 'RAMP_LEFT':
      return 'ramp-left';
    case 'MERGE':
      return 'merge';
    case 'ARRIVE':
      return 'flag';
    default:
      return 'straight';
  }
}

/** Testo breve se Google non ne dà uno. */
export function maneuverFallbackText(maneuver: string | null | undefined): string {
  const g = maneuverGlyph(maneuver);
  if (g.startsWith('roundabout')) return 'Entra nella rotatoria';
  if (g.startsWith('u-turn')) return 'Fai inversione';
  if (g.endsWith('right')) return g.includes('slight') || g.startsWith('fork') ? 'Tieni la destra' : 'Svolta a destra';
  if (g.endsWith('left')) return g.includes('slight') || g.startsWith('fork') ? 'Tieni la sinistra' : 'Svolta a sinistra';
  return 'Prosegui dritto';
}

/** «150 m», «1,2 km». */
export function formatDistance(m: number): { value: string; unit: string } {
  if (m >= 1000) return { value: (m / 1000).toFixed(1).replace('.', ','), unit: 'km' };
  if (m >= 100) return { value: String(Math.round(m / 50) * 50), unit: 'm' };
  return { value: String(Math.max(10, Math.round(m / 10) * 10)), unit: 'm' };
}

export type NavState = {
  /** La prossima svolta e quanto manca, o null (finite, o senza svolte). */
  step: { maneuver: string; text: string; meters: number } | null;
  /** REG-690: la svolta subito dopo, se arriva entro 250 m (riga «Poi» del banner). */
  then: { maneuver: string; text: string } | null;
  /** La prossima tappa ancora da fare e quanto manca (sulla linea, o in linea d'aria). */
  stop: { key: string; n: number; title: string; street: string | null; meters: number } | null;
  /** Metri di giro che restano (null senza linea). */
  left: number | null;
  /** Fuori dalla linea (oltre 50 m): la card dice «ricalcolo». */
  offLine: boolean;
};

/** Oltre questa distanza dalla linea l'auto è fuori giro (come REG-654). */
const NAV_OFF_M = 50;
/** Una svolta già passata da tanti metri non è più «la prossima». */
const STEP_PASSED_M = 8;
/** La svolta dopo si annuncia («Poi …») solo se è vicina alla prossima. */
const THEN_MAX_M = 250;

/**
 * Lo stato della card in alto per la posizione `p`. `prevAlong` = dove era
 * l'auto al punto prima (si cerca lì vicino: niente salti indietro su linee
 * che ripassano dalla stessa strada).
 */
export function navState(input: {
  m: MeasuredLine | null;
  steps: PlacedStep[];
  stops: RoadPlanStop[];
  stopAlong: Array<{ key: string; along: number | null }>;
  done: string[];
  p: { lat: number; lng: number };
  prevAlong: number;
  /** Fuori percorso confermato (da 12 s, come il riaggancio): solo allora la card lo dice. */
  offConfirmed?: boolean;
}): NavState & { along: number } {
  const { m, p } = input;
  let along = input.prevAlong;
  let offLine = false;
  if (m && m.line.length >= 2) {
    // Finestra di ricerca: dal vertice di prima a ~1,5 km avanti.
    // Il tratto che contiene il punto di prima (l'ultimo vertice prima di lì):
    // con vertici lontani (strade dritte, linea semplificata) partire dal
    // vertice DOPO saltava il tratto dell'auto e la distanza restava ferma.
    let fromIdx = 0;
    for (let i = 0; i < m.cum.length; i++) {
      if (m.cum[i] <= input.prevAlong - 30) fromIdx = i;
      else break;
    }
    const toIdx = m.cum.findIndex((c) => c > input.prevAlong + 1500);
    const hit = projectOnLine(m, p, fromIdx, toIdx < 0 ? m.line.length - 1 : toIdx);
    // Appena fuori (partenza da un parcheggio, GPS che balla) si resta sulla
    // svolta di prima; «Fuori dal giro» solo quando il riaggancio lo conferma.
    offLine = hit.off > NAV_OFF_M && input.offConfirmed === true;
    if (hit.off <= NAV_OFF_M && hit.along >= input.prevAlong - 30) along = Math.max(input.prevAlong, hit.along);
  }

  const nextStep = m && !offLine ? input.steps.find((s) => s.along > along + STEP_PASSED_M) ?? null : null;
  const step = nextStep
    ? { maneuver: nextStep.maneuver, text: nextStep.text || maneuverFallbackText(nextStep.maneuver), meters: nextStep.along - along }
    : null;
  const after = nextStep ? input.steps[input.steps.indexOf(nextStep) + 1] ?? null : null;
  const then =
    after && after.along - nextStep!.along <= THEN_MAX_M
      ? { maneuver: after.maneuver, text: after.text || maneuverFallbackText(after.maneuver) }
      : null;

  let stop: NavState['stop'] = null;
  input.stops.some((s, i) => {
    if (input.done.includes(s.key)) return false;
    const placed = input.stopAlong.find((x) => x.key === s.key)?.along ?? null;
    const meters =
      m && placed != null && !offLine && placed >= along ? placed - along : haversineMeters(p.lat, p.lng, s.lat, s.lng);
    // La tappa di un punto dell'allievo ha come titolo la via: niente «Via Roma · Via Roma».
    const street = s.street && s.street !== s.title ? s.street : null;
    stop = { key: s.key, n: i + 1, title: s.title, street, meters };
    return true;
  });

  return { step, then, stop, left: m ? Math.max(0, m.length - along) : null, offLine, along };
}

// ─── Punti critici: avviso anticipato e ripasso ────────────────────────────

/** Da quanto prima compare la card (in linea d'aria). */
export const HOTSPOT_AHEAD_M = 180;
/** Entro tanti metri si è «sul punto»: compaiono «Meglio» / «Ancora no». */
export const HOTSPOT_AT_M = 45;
/**
 * Passati accanto: il centro del punto è una media delle segnalazioni e la
 * strada può passarci a qualche decina di metri. Arrivati entro tanto e poi
 * allontanati, il punto conta come passato (si chiede com'è andata).
 */
export const HOTSPOT_PASS_M = 100;
/** Dopo il punto la card resta per decidere, poi si chiude da sola. */
export const HOTSPOT_DECIDE_MS = 20_000;
/** Allontanati di tanto senza esserci passati: l'avviso si chiude. */
const HOTSPOT_AWAY_M = 260;
/** Lo stesso punto riavvisa solo dopo essersene allontanati di tanto. */
const HOTSPOT_REARM_M = 500;

export type HotspotPhase = 'ahead' | 'at' | 'decide';

export type HotspotAlert = {
  hotspot: RoadStudentHotspot;
  phase: HotspotPhase;
  meters: number;
  /** Distanza minima raggiunta (per capire quando ci si allontana). */
  minMeters: number;
  /** Quando è iniziata la fase «decide» (ms). */
  leftAt: number | null;
  /** Toccato «Meglio» / «Ancora no»: la card resta finché la chiude la schermata. */
  decided?: boolean;
};

export type HotspotWatch = {
  alert: HotspotAlert | null;
  /** Punti già avvisati: chiave → si riarma dopo essersene allontanati. */
  armed: Record<string, boolean>;
};

export const EMPTY_HOTSPOT_WATCH: HotspotWatch = { alert: null, armed: {} };

/**
 * Un punto GPS: apre, aggiorna o chiude la card del punto critico. Restituisce
 * lo stesso oggetto se non cambia niente. `decided` = l'istruttore ha già
 * toccato «Meglio» / «Ancora no» per quella card.
 */
export function stepHotspotWatch(
  watch: HotspotWatch,
  hotspots: RoadStudentHotspot[],
  p: { lat: number; lng: number; t: number },
): HotspotWatch {
  let { alert } = watch;
  let armed = watch.armed;
  const rearm = (key: string, on: boolean) => {
    if ((armed[key] ?? true) === on) return;
    armed = { ...armed, [key]: on };
  };

  // Punti già avvisati: si riarmano lontano da loro.
  for (const h of hotspots) {
    if (armed[h.key] === false && haversineMeters(p.lat, p.lng, h.lat, h.lng) > HOTSPOT_REARM_M) rearm(h.key, true);
  }

  if (alert?.decided) return armed === watch.armed ? watch : { alert, armed };
  if (alert) {
    const h = alert.hotspot;
    const d = haversineMeters(p.lat, p.lng, h.lat, h.lng);
    const minMeters = Math.min(alert.minMeters, d);
    if (alert.phase === 'ahead') {
      if (d <= HOTSPOT_AT_M) alert = { ...alert, phase: 'at', meters: d, minMeters };
      else if (minMeters <= HOTSPOT_PASS_M && d > minMeters + 15) {
        alert = { ...alert, phase: 'decide', meters: d, minMeters, leftAt: p.t };
      } else if (d > minMeters + HOTSPOT_AWAY_M || d > HOTSPOT_AHEAD_M + HOTSPOT_AWAY_M) alert = null;
      else if (Math.round(d / 10) !== Math.round(alert.meters / 10)) alert = { ...alert, meters: d, minMeters };
    } else if (alert.phase === 'at') {
      // Passato il punto: si decide (la card resta 15 s).
      if (d > HOTSPOT_AT_M + 10) alert = { ...alert, phase: 'decide', meters: d, minMeters, leftAt: p.t };
    } else if (alert.leftAt != null && p.t - alert.leftAt > HOTSPOT_DECIDE_MS) {
      alert = null;
    }
    return alert === watch.alert && armed === watch.armed ? watch : { alert, armed };
  }

  // Nessuna card: il punto armato più vicino entro 180 m.
  let best: { h: RoadStudentHotspot; d: number } | null = null;
  for (const h of hotspots) {
    if (armed[h.key] === false) continue;
    const d = haversineMeters(p.lat, p.lng, h.lat, h.lng);
    if (d <= HOTSPOT_AHEAD_M && (!best || d < best.d)) best = { h, d };
  }
  if (best) {
    rearm(best.h.key, false);
    alert = {
      hotspot: best.h,
      phase: best.d <= HOTSPOT_AT_M ? 'at' : 'ahead',
      meters: best.d,
      minMeters: best.d,
      leftAt: null,
    };
  }
  return alert === watch.alert && armed === watch.armed ? watch : { alert, armed };
}

/** La frase della card: la nota dell'istruttore, o tipo e quante volte. */
export function hotspotLine(h: RoadStudentHotspot): string {
  const note = h.note?.trim();
  if (note) return `L'ultima volta: «${note}»`;
  const times = h.errors === 1 ? '1 volta' : `${h.errors} volte`;
  const guides = h.sessions === 1 ? '1 guida' : `${h.sessions} guide`;
  return `${h.label} da migliorare ${times} in ${guides}`;
}

/** Lo stato del punto in una riga («In miglioramento», «Superato»), o null. */
export function hotspotStatusLine(h: RoadStudentHotspot): string | null {
  if (h.status === 'overcome') return 'Superato: le ultime volte è andata meglio';
  if (h.status === 'improving') return "In miglioramento: l'ultima volta è andata meglio";
  return null;
}
