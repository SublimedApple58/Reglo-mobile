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

/** Da quanto prima compare la card (in linea d'aria; per una zona, dal tratto). */
export const HOTSPOT_AHEAD_M = 180;
/** Entro tanti metri dal centro si è «sul punto»: compaiono «Meglio» / «Ancora no». */
export const HOTSPOT_AT_M = 40;
/** Entro tanti metri dal tratto si è «dentro la zona». */
export const HOTSPOT_ZONE_AT_M = 25;
/** Zona senza tratto (non ancora calcolato): dentro se entro metà lunghezza + tanto dal centro. */
const HOTSPOT_ZONE_FALLBACK_M = 20;
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
/** Fine del passaggio: oltre tanti metri dal punto... */
export const HOTSPOT_REARM_M = 150;
/** ...e almeno tanto dopo la chiusura della card: avvicinamento e «sopra» si riarmano. */
export const HOTSPOT_REARM_MS = 45_000;
/** Lo stesso avviso (avvicinamento o «sopra») sullo stesso punto non torna prima di tanto. */
export const HOTSPOT_COOLDOWN_MS = 60_000;

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

/**
 * Un punto in questo passaggio. Due inneschi separati: l'avvicinamento (180 m)
 * e il «sopra» (40 m dal centro, 25 m dal tratto di una zona). Il «sopra»
 * scatta anche se l'avvicinamento è già stato mostrato e chiuso. Il passaggio
 * finisce oltre 150 m e 45 s dopo la chiusura della card: si riarmano entrambi.
 */
export type HotspotSeen = {
  ahead: boolean;
  at: boolean;
  /** Quando si è chiusa l'ultima card del punto (null = ancora aperta). */
  closedAt: number | null;
  /** Ultimo avviso di ciascun tipo (ms), per il cooldown: resta dopo il riarmo. */
  aheadAt: number | null;
  atAt: number | null;
};

export type HotspotWatch = {
  alert: HotspotAlert | null;
  /** Punti avvisati in questo passaggio (chiave → stato). */
  seen: Record<string, HotspotSeen>;
};

export const EMPTY_HOTSPOT_WATCH: HotspotWatch = { alert: null, seen: {} };

/** Distanza in metri da un punto a una linea [lat, lng][] (proiezione locale). */
export function distanceToLineMeters(lat: number, lng: number, line: LatLngTuple[]): number {
  if (line.length === 1) return haversineMeters(lat, lng, line[0][0], line[0][1]);
  const kx = M_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);
  let best = Infinity;
  for (let i = 1; i < line.length; i++) {
    const ax = (line[i - 1][1] - lng) * kx;
    const ay = (line[i - 1][0] - lat) * M_PER_DEG_LAT;
    const bx = (line[i][1] - lng) * kx;
    const by = (line[i][0] - lat) * M_PER_DEG_LAT;
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2));
    best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
  }
  return best;
}

/** Distanza dal punto critico: dal tratto se è una zona disegnata, altrimenti dal centro. */
export function hotspotDistance(h: RoadStudentHotspot, p: { lat: number; lng: number }): number {
  const center = haversineMeters(p.lat, p.lng, h.lat, h.lng);
  if (h.extentM && h.extent && h.extent.length >= 2) return Math.min(center, distanceToLineMeters(p.lat, p.lng, h.extent));
  return center;
}

/** Entro tanti metri (da `hotspotDistance`) si è sul punto o dentro la zona. */
export function hotspotAtRadius(h: RoadStudentHotspot): number {
  if (!h.extentM) return HOTSPOT_AT_M;
  if (h.extent && h.extent.length >= 2) return HOTSPOT_ZONE_AT_M;
  return h.extentM / 2 + HOTSPOT_ZONE_FALLBACK_M;
}

const cooled = (last: number | null, t: number) => last == null || t - last >= HOTSPOT_COOLDOWN_MS;

/**
 * La card si chiude (da sola o dalla schermata): da qui partono i 45 s del
 * riarmo. Restituisce lo stesso oggetto se la card aperta non è quella.
 */
export function closeHotspotWatch(watch: HotspotWatch, key: string | undefined, t: number): HotspotWatch {
  const cur = watch.alert;
  if (!cur || (key && cur.hotspot.key !== key)) return watch;
  const k = cur.hotspot.key;
  const prev = watch.seen[k];
  return { alert: null, seen: prev ? { ...watch.seen, [k]: { ...prev, closedAt: t } } : watch.seen };
}

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
  let seen = watch.seen;
  const patch = (key: string, next: HotspotSeen) => {
    seen = { ...seen, [key]: next };
  };
  const openKey = alert?.hotspot.key ?? null;

  // Fine del passaggio: lontani e card chiusa da un po' → avvicinamento e «sopra» di nuovo pronti.
  for (const h of hotspots) {
    const st = seen[h.key];
    if (!st || (!st.ahead && !st.at) || h.key === openKey || st.closedAt == null) continue;
    if (p.t - st.closedAt >= HOTSPOT_REARM_MS && hotspotDistance(h, p) > HOTSPOT_REARM_M) {
      patch(h.key, { ...st, ahead: false, at: false });
    }
  }
  const done = (next: HotspotAlert | null) =>
    next === watch.alert && seen === watch.seen ? watch : { alert: next, seen };

  if (alert?.decided) return done(alert);
  if (alert) {
    const h = alert.hotspot;
    const d = hotspotDistance(h, p);
    const atR = hotspotAtRadius(h);
    const minMeters = Math.min(alert.minMeters, d);
    if (alert.phase === 'ahead') {
      if (d <= atR) {
        alert = { ...alert, phase: 'at', meters: d, minMeters };
        const st = seen[h.key];
        if (st) patch(h.key, { ...st, at: true, atAt: p.t });
      } else if (minMeters <= HOTSPOT_PASS_M && d > minMeters + 15) {
        alert = { ...alert, phase: 'decide', meters: d, minMeters, leftAt: p.t };
      } else if (d > minMeters + HOTSPOT_AWAY_M || d > HOTSPOT_AHEAD_M + HOTSPOT_AWAY_M) alert = null;
      else if (Math.round(d / 10) !== Math.round(alert.meters / 10)) alert = { ...alert, meters: d, minMeters };
    } else if (alert.phase === 'at') {
      // Passato il punto (o uscito dalla zona): si decide (la card resta 20 s).
      if (d > atR + 10) alert = { ...alert, phase: 'decide', meters: d, minMeters, leftAt: p.t };
    } else if (alert.leftAt != null && p.t - alert.leftAt > HOTSPOT_DECIDE_MS) {
      alert = null;
    }
    if (!alert) {
      const st = seen[h.key];
      if (st) patch(h.key, { ...st, closedAt: p.t });
    }
    return done(alert);
  }

  // Nessuna card: prima un «sopra» (il più vicino), poi un avvicinamento entro 180 m.
  let at: { h: RoadStudentHotspot; d: number } | null = null;
  let ahead: { h: RoadStudentHotspot; d: number } | null = null;
  for (const h of hotspots) {
    const d = hotspotDistance(h, p);
    if (d > HOTSPOT_AHEAD_M) continue;
    const st = seen[h.key];
    if (d <= hotspotAtRadius(h)) {
      if (!st?.at && cooled(st?.atAt ?? null, p.t) && (!at || d < at.d)) at = { h, d };
    } else if (!st?.ahead && !st?.at && cooled(st?.aheadAt ?? null, p.t) && (!ahead || d < ahead.d)) {
      ahead = { h, d };
    }
  }
  const best = at ?? ahead;
  if (best) {
    const st: HotspotSeen = seen[best.h.key] ?? { ahead: false, at: false, closedAt: null, aheadAt: null, atAt: null };
    patch(
      best.h.key,
      at
        ? { ...st, ahead: true, at: true, closedAt: null, atAt: p.t }
        : { ...st, ahead: true, closedAt: null, aheadAt: p.t },
    );
    alert = {
      hotspot: best.h,
      phase: at ? 'at' : 'ahead',
      meters: best.d,
      minMeters: best.d,
      leftAt: null,
    };
  }
  return done(alert);
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
