import type { RoadPlanStop } from '../types/regloApi';
import { haversineMeters } from './format';

/**
 * REG-650 Reglo Road — avvisi delle tappe del giro durante la guida.
 *
 * Tutto in JS sulle posizioni che `tracking.ts` passa già a `roadStore`
 * (niente geofence nativi, niente rete): a ~300 m da una tappa compare la card
 * nera in alto, una alla volta; entro 40 m la tappa è raggiunta. Un percorso
 * d'esame conta dal suo inizio. Ogni tappa avvisa una volta sola; l'esito che
 * fa fede (riepilogo) lo calcola il server a «Termina guida».
 */

export const PLAN_ALERT_AHEAD_M = 300;
/** Uguale a `PLAN_REACHED_M` del backend. */
export const PLAN_REACHED_M = 40;
/** La card si chiude da sola: avviso dopo 10 s, «raggiunta» dopo 3,5 s. */
export const PLAN_ALERT_MS = 10_000;
export const PLAN_REACHED_MS = 3_500;

export type PlanProgress = { reached: string[]; alerted: string[] };

export type PlanAlert = {
  key: string;
  /** Numero della tappa nel giro (1, 2, 3), come nella card del giro. */
  n: number;
  title: string;
  reason: string;
  /** Distanza dall'ultima posizione, arrotondata a 10 m. */
  meters: number;
  reached: boolean;
  /** Quando è comparsa (o è diventata «raggiunta»): da qui parte la chiusura. */
  at: number;
};

export const EMPTY_PROGRESS: PlanProgress = { reached: [], alerted: [] };

const round10 = (m: number) => Math.max(10, Math.round(m / 10) * 10);

/**
 * Un punto GPS: aggiorna tappe raggiunte, avvisi dati e la card. Restituisce
 * gli stessi oggetti se non cambia niente (lo store non ridisegna a vuoto).
 */
export function stepPlanAlerts(
  stops: RoadPlanStop[],
  progress: PlanProgress,
  alert: PlanAlert | null,
  point: { lat: number; lng: number; t: number },
): { progress: PlanProgress; alert: PlanAlert | null } {
  let { reached, alerted } = progress;
  let next = alert;
  let nearest: { stop: RoadPlanStop; n: number; d: number } | null = null;

  stops.forEach((stop, i) => {
    if (reached.includes(stop.key)) return;
    const d = haversineMeters(point.lat, point.lng, stop.lat, stop.lng);
    if (d <= PLAN_REACHED_M) {
      reached = [...reached, stop.key];
      if (!alerted.includes(stop.key)) alerted = [...alerted, stop.key];
      // Anche passata di corsa senza avviso: si dice che è raggiunta.
      next = { key: stop.key, n: i + 1, title: stop.title, reason: stop.reason, meters: 0, reached: true, at: point.t };
      return;
    }
    if (next && next.key === stop.key && !next.reached) {
      const meters = round10(d);
      if (meters !== next.meters) next = { ...next, meters };
      return;
    }
    if (!alerted.includes(stop.key) && d <= PLAN_ALERT_AHEAD_M && (!nearest || d < nearest.d)) {
      nearest = { stop, n: i + 1, d };
    }
  });

  // Una card alla volta: un nuovo avviso solo se non ce n'è un'altra a schermo
  // (la tappa resta da avvisare e lo sarà al punto dopo la chiusura).
  const pick = nearest as { stop: RoadPlanStop; n: number; d: number } | null;
  if (pick && !next) {
    alerted = [...alerted, pick.stop.key];
    next = {
      key: pick.stop.key,
      n: pick.n,
      title: pick.stop.title,
      reason: pick.stop.reason,
      meters: round10(pick.d),
      reached: false,
      at: point.t,
    };
  }

  const changed = reached !== progress.reached || alerted !== progress.alerted;
  return { progress: changed ? { reached, alerted } : progress, alert: next };
}

/** Card scaduta? (avviso 10 s, «raggiunta» 3,5 s). */
export function planAlertExpired(alert: PlanAlert, now: number): boolean {
  return now - alert.at >= (alert.reached ? PLAN_REACHED_MS : PLAN_ALERT_MS);
}

/** Ripresa dopo un kill: le tappe già toccate dal tracciato non avvisano più. */
export function progressFromTrack(stops: RoadPlanStop[], track: Array<{ latitude: number; longitude: number }>): PlanProgress {
  const reached = stops
    .filter((s) => track.some((p) => haversineMeters(p.latitude, p.longitude, s.lat, s.lng) <= PLAN_REACHED_M))
    .map((s) => s.key);
  return { reached, alerted: reached };
}

/** «Giro: 2 tappe su 3» — null se la guida non aveva un giro. */
export function planOutcomeLine(planReached: { reached: string[]; total: number } | null | undefined): string | null {
  if (!planReached || planReached.total <= 0) return null;
  const n = planReached.reached.length;
  return `Giro: ${n} ${n === 1 ? 'tappa' : 'tappe'} su ${planReached.total}`;
}
