/**
 * REG-688 Reglo Road — zoom e inclinazione automatici della guida dal vivo.
 *
 * Come Apple Mappe e Google Maps:
 * - più si va veloci, più la camera sale (si vede più strada davanti);
 * - vicino alla svolta scende e si inclina di più (si vede bene l'incrocio);
 * - tutto cambia piano (inseguimento esponenziale, niente scatti).
 * Su iOS conta l'altitudine (metri), su Android lo zoom: lo zoom si ricava
 * dall'altitudine, così le due piattaforme inquadrano uguale.
 * Logica pura, senza React: la schermata chiama `step()` a ogni fotogramma.
 */

/** Altitudine da fermi / in città lenta e a velocità piena (metri). */
const ALT_SLOW = 560;
const ALT_FAST = 1150;
/** Fra queste velocità (km/h) l'altitudine passa da ALT_SLOW ad ALT_FAST. */
const KMH_SLOW = 10;
const KMH_FAST = 60;
/** Vicino alla svolta: da quanti metri prima si scende, e fin dove. */
const TURN_FROM_M = 160;
const ALT_TURN = 470;
/** Inclinazione in marcia e sull'incrocio (gradi). */
const PITCH_CRUISE = 45;
const PITCH_TURN = 55;
/** Rapidità dell'inseguimento (1/s): l'altitudine con calma, l'inclinazione un po' più svelta. */
const ALT_RATE = 0.9;
const PITCH_RATE = 1.2;

/** Altitudine (iOS) e zoom (Android) che inquadrano uguale: 900 m ≈ zoom 16,4. */
export const zoomForAltitude = (altitude: number) => 16.4 + Math.log2(900 / altitude);

export type CameraFrame = { altitude: number; pitch: number; zoom: number };

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const smooth = (x: number) => x * x * (3 - 2 * x);

/** Dove deve stare la camera per questa velocità e questa distanza dalla svolta. */
export function cameraTarget(speedMs: number, turnMeters: number | null): { altitude: number; pitch: number } {
  const kmh = Math.max(0, speedMs) * 3.6;
  let altitude = ALT_SLOW + (ALT_FAST - ALT_SLOW) * smooth(clamp01((kmh - KMH_SLOW) / (KMH_FAST - KMH_SLOW)));
  let pitch = PITCH_CRUISE;
  if (turnMeters != null && turnMeters < TURN_FROM_M) {
    const k = smooth(clamp01(1 - turnMeters / TURN_FROM_M));
    altitude = altitude + (Math.min(altitude, ALT_TURN) - altitude) * k;
    pitch = PITCH_CRUISE + (PITCH_TURN - PITCH_CRUISE) * k;
  }
  return { altitude, pitch };
}

export function createLiveCamera() {
  let altitude = ALT_SLOW;
  let pitch = PITCH_CRUISE;
  let last = 0;
  return {
    /** La camera di questo fotogramma (`now` in ms). */
    step(now: number, speedMs: number, turnMeters: number | null): CameraFrame {
      const dt = last ? Math.min(0.25, Math.max(0, (now - last) / 1000)) : 0;
      last = now;
      const t = cameraTarget(speedMs, turnMeters);
      altitude += (t.altitude - altitude) * (1 - Math.exp(-ALT_RATE * dt));
      pitch += (t.pitch - pitch) * (1 - Math.exp(-PITCH_RATE * dt));
      return { altitude, pitch, zoom: zoomForAltitude(altitude) };
    },
  };
}

// ─── Ritorno sull'auto (REG-685) ────────────────────────────────────────────

/** Durata del ritorno morbido sull'auto (Ricentra o dopo 10 s senza tocchi). */
export const RETURN_MS = 700;
/** Dopo un gesto sulla mappa, la camera torna da sola sull'auto dopo… */
export const AUTO_RETURN_MS = 10_000;

/** Accelera e frena dolce (cubica): parte e arriva senza scatti. */
export const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

export type CamPose = { lat: number; lng: number; heading: number; pitch: number; altitude: number; zoom: number };

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const headingLerp = (a: number, b: number, k: number) => {
  const d = ((((b - a) % 360) + 540) % 360) - 180;
  return (((a + d * k) % 360) + 360) % 360;
};

/** La camera a metà strada fra `from` (dove l'ha lasciata l'utente) e `to` (quella che segue). */
export function blendPose(from: CamPose, to: CamPose, k: number): CamPose {
  return {
    lat: lerp(from.lat, to.lat, k),
    lng: lerp(from.lng, to.lng, k),
    heading: headingLerp(from.heading, to.heading, k),
    pitch: lerp(from.pitch, to.pitch, k),
    // L'altitudine si mescola in scala logaritmica (come lo zoom): niente «tuffo».
    altitude: Math.exp(lerp(Math.log(from.altitude), Math.log(to.altitude), k)),
    zoom: lerp(from.zoom, to.zoom, k),
  };
}
