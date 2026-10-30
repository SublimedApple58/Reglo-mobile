/**
 * REG-678 Reglo Road — il movimento dell'auto nella guida dal vivo.
 *
 * I punti GPS arrivano a scatti (uno ogni 8 m dal tracking, uno al secondo
 * dall'ascolto della schermata): disegnati così l'auto saltava. Qui si tiene
 * una posizione «mostrata» che si muove a ogni fotogramma:
 * - stima: dall'ultimo punto si va avanti nella direzione di marcia alla sua
 *   velocità (al massimo 1,5 s, poi si aspetta il punto dopo);
 * - inseguimento: la posizione mostrata va verso la stima con una molla senza
 *   rimbalzo (esponenziale), così le correzioni del GPS si vedono come una
 *   curva morbida e non come un salto;
 * - direzione: l'auto gira verso la direzione di marcia in fretta, la camera
 *   più lentamente (la mappa non «balla» a ogni curva del GPS). Da fermi la
 *   direzione non cambia (il GPS fermo dà direzioni a caso).
 * Logica pura, senza React: la schermata chiama `sample()` a ogni fotogramma.
 */

export type MotionFix = {
  lat: number;
  lng: number;
  /** m/s */
  speed: number | null;
  /** gradi da nord, null se non nota */
  heading: number | null;
  accuracy: number | null;
};

export type MotionSample = {
  lat: number;
  lng: number;
  /** Direzione dell'auto (gradi). */
  heading: number;
  /** Direzione della camera (gradi): segue l'auto con un po' di ritardo. */
  camHeading: number;
  accuracy: number | null;
};

/** Oltre questa distanza da quella mostrata (ripresa, salto del GPS) l'auto ci va subito. */
const SNAP_M = 120;
/** Fin dove ci si spinge avanti senza un punto nuovo. */
const MAX_AHEAD_S = 1.5;
/** Sotto questa velocità la direzione resta quella di prima. */
const MIN_MOVING_MS = 1.2;
/** Rapidità dell'inseguimento (1/s): più alto = più attaccato al GPS. */
const POS_RATE = 4.5;
const CAR_TURN_RATE = 7;
const CAM_TURN_RATE = 2.2;

const M_PER_DEG_LAT = 110_540;
const mPerDegLng = (lat: number) => 111_320 * Math.cos((lat * Math.PI) / 180);

/** La differenza più corta fra due direzioni, in (-180, 180]. */
export function headingDelta(from: number, to: number): number {
  return ((((to - from) % 360) + 540) % 360) - 180;
}

const norm = (h: number) => ((h % 360) + 360) % 360;

/** Direzione da a a b (gradi da nord). */
export function bearing(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const r = Math.PI / 180;
  const y = Math.sin((bLng - aLng) * r) * Math.cos(bLat * r);
  const x = Math.cos(aLat * r) * Math.sin(bLat * r) - Math.sin(aLat * r) * Math.cos(bLat * r) * Math.cos((bLng - aLng) * r);
  return norm(Math.atan2(y, x) / r);
}

export function createLiveMotion(initial?: MotionFix | null, initialHeading = 0) {
  let fix: (MotionFix & { at: number }) | null = initial ? { ...initial, at: Date.now() } : null;
  let lat = initial?.lat ?? 0;
  let lng = initial?.lng ?? 0;
  let heading = norm(initial?.heading ?? initialHeading);
  let camHeading = heading;
  let target = heading;
  let last = 0;

  return {
    get ready() {
      return fix !== null;
    },

    /** Un punto GPS nuovo (dal tracking o dall'ascolto della schermata). */
    push(next: MotionFix, at = Date.now()) {
      // Direzione: quella del GPS se in movimento, altrimenti dal tragitto.
      const moving = (next.speed ?? 0) >= MIN_MOVING_MS;
      if (moving && next.heading != null && next.heading >= 0) target = norm(next.heading);
      else if (fix && moving) {
        const dLat = (next.lat - fix.lat) * M_PER_DEG_LAT;
        const dLng = (next.lng - fix.lng) * mPerDegLng(next.lat);
        if (Math.hypot(dLat, dLng) > 3) target = bearing(fix.lat, fix.lng, next.lat, next.lng);
      }
      const first = fix === null;
      fix = { ...next, at };
      if (first) {
        lat = next.lat;
        lng = next.lng;
        heading = camHeading = target = norm(next.heading ?? target);
      }
    },

    /** La posizione da disegnare adesso (`now` in ms). */
    sample(now = Date.now()): MotionSample | null {
      if (!fix) return null;
      const dt = last ? Math.min(0.25, Math.max(0, (now - last) / 1000)) : 0;
      last = now;

      // Stima: avanti dall'ultimo punto lungo la direzione di marcia.
      let tLat = fix.lat;
      let tLng = fix.lng;
      const v = fix.speed ?? 0;
      if (v >= MIN_MOVING_MS) {
        const ahead = Math.min(MAX_AHEAD_S, Math.max(0, (now - fix.at) / 1000)) * v;
        const r = (target * Math.PI) / 180;
        tLat += (Math.cos(r) * ahead) / M_PER_DEG_LAT;
        tLng += (Math.sin(r) * ahead) / mPerDegLng(fix.lat);
      }

      const gap = Math.hypot((tLat - lat) * M_PER_DEG_LAT, (tLng - lng) * mPerDegLng(lat));
      if (gap > SNAP_M || dt === 0) {
        lat = tLat;
        lng = tLng;
      } else {
        const k = 1 - Math.exp(-POS_RATE * dt);
        lat += (tLat - lat) * k;
        lng += (tLng - lng) * k;
      }
      heading = norm(heading + headingDelta(heading, target) * (1 - Math.exp(-CAR_TURN_RATE * dt)));
      camHeading = norm(camHeading + headingDelta(camHeading, heading) * (1 - Math.exp(-CAM_TURN_RATE * dt)));
      return { lat, lng, heading, camHeading, accuracy: fix.accuracy };
    },

    /** Dopo «Ricentra» la camera riparte allineata all'auto. */
    alignCamera() {
      camHeading = heading;
    },
  };
}

export type LiveMotion = ReturnType<typeof createLiveMotion>;
