import { haversineMeters } from './format';

/**
 * REG-723 — quali punti GPS entrano nella linea disegnata dal vivo.
 *
 * Nella guida vera del 4/11 i primi punti arrivano a macchina ferma e sono
 * imprecisi (fino a 42 m, salti di 76, 21 e 20 m con velocità 0): la linea
 * partiva con zig-zag e punte che attraversavano i palazzi. A metà guida ci
 * sono tratti senza velocità con precisione fino a 75 m.
 *
 * - avvio: la linea parte solo da un punto preciso (≤ 15 m); se non arriva
 *   entro 30 s si accetta il limite normale, per non restare senza linea;
 * - sempre: fuori i punti oltre 25 m (lo stesso limite della linea pulita del
 *   server, `clean-track.ts`), e oltre 15 m quelli senza velocità;
 * - fermi: uno spostamento più piccolo della precisione non allunga la linea.
 *
 * Distanza, avvisi e auto non cambiano: usano tutti i fix come prima (uguali
 * al server, che conta i km fino a 50 m).
 */

const START_ACCURACY_M = 15;
const LINE_ACCURACY_M = 25;
const START_WAIT_MS = 30_000;
/** Sotto questa velocità (m/s) l'auto è ferma o quasi. */
const STILL_SPEED_MS = 1;
const STILL_MIN_M = 8;

type Pt = { latitude: number; longitude: number };

export type LineFilter = { since: number | null };

export const LINE_FILTER_START: LineFilter = { since: null };

/** `last` = ultimo punto della linea (null = linea ancora vuota). */
export function keepOnLine(
  f: LineFilter,
  last: Pt | null,
  p: { t: number; lat: number; lng: number; speed: number | null; accuracy: number | null },
): { keep: boolean; filter: LineFilter } {
  const acc = p.accuracy;
  if (!last) {
    const since = f.since ?? p.t;
    const waited = p.t - since >= START_WAIT_MS;
    const limit = waited ? LINE_ACCURACY_M : START_ACCURACY_M;
    if (acc != null && acc > limit) return { keep: false, filter: { since } };
    return { keep: true, filter: { since } };
  }
  if (acc != null && acc > LINE_ACCURACY_M) return { keep: false, filter: f };
  // Senza velocità il fix non viene dal GPS pieno (celle, wi-fi): solo se preciso.
  if (p.speed == null && acc != null && acc > START_ACCURACY_M) return { keep: false, filter: f };
  if (p.speed != null && p.speed >= 0 && p.speed < STILL_SPEED_MS) {
    const d = haversineMeters(last.latitude, last.longitude, p.lat, p.lng);
    if (d < Math.max(acc ?? 0, STILL_MIN_M)) return { keep: false, filter: f };
  }
  return { keep: true, filter: f };
}
