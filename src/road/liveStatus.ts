import { useSyncExternalStore } from 'react';
import { roadQueue } from './queue';
import { isRoadTrackingActive, startRoadTracking } from './tracking';
import { roadUploader } from './uploader';

/**
 * REG-693 Reglo Road — «sto registrando?» in una riga.
 *
 * Fonte: l'ascolto GPS della schermata (1 Hz), anche i fix scartati per
 * precisione scarsa. Ogni secondo si ricalcola lo stato e si notifica SOLO se
 * cambia (il pannello non si ridisegna a ogni fix):
 * - `gps`: `ok` · `weak` (precisione oltre 25 m, o in movimento e fix più
 *   vecchio di 5 s) · `lost` (in movimento e nessun fix da 15 s; da fermi iOS
 *   può non mandarne, quindi solo dopo 2 min) · `waiting` (appena entrati);
 * - `offline`: punti in coda e nessun invio riuscito da oltre 60 s (si
 *   salvano sul telefono e partono quando torna la rete);
 * - `speedKmh`: velocità dell'ultimo fix, a 0 se fermo da 3 s.
 *
 * Watchdog (ogni 30 s): se il task di tracking non è più attivo (Android che
 * lo ferma per risparmio energetico, iOS dopo un errore) lo si riaccende.
 */

export type GpsQuality = 'waiting' | 'ok' | 'weak' | 'lost';
export type LiveStatus = { gps: GpsQuality; offline: boolean; speedKmh: number; restarted: boolean };

const WEAK_ACCURACY_M = 25;
const WEAK_AGE_MS = 5_000;
const LOST_AGE_MS = 15_000;
/** Da fermi iOS può smettere di consegnare fix: «perso» solo dopo tanto. */
const LOST_STILL_MS = 120_000;
/** Sopra questa velocità (m/s) l'auto si muoveva: un buco di fix è un problema vero. */
const MOVING_MS = 2;
const SPEED_STALE_MS = 4_000;
const OFFLINE_AFTER_MS = 60_000;
const WATCHDOG_MS = 30_000;
/** «GPS riattivato» resta visibile qualche secondo. */
const RESTARTED_SHOW_MS = 6_000;

let lastFixAt = 0;
let lastAccuracy: number | null = null;
let lastSpeed: number | null = null;
let pendingSince = 0;
let restartedAt = 0;
let startedAt = 0;
let status: LiveStatus = { gps: 'waiting', offline: false, speedKmh: 0, restarted: false };
const listeners = new Set<() => void>();
let tick: ReturnType<typeof setInterval> | null = null;
let watchdog: ReturnType<typeof setInterval> | null = null;

function compute(now: number): LiveStatus {
  const age = lastFixAt ? now - lastFixAt : Infinity;
  const moving = (lastSpeed ?? 0) >= MOVING_MS;
  const lostAfter = moving ? LOST_AGE_MS : LOST_STILL_MS;
  const gps: GpsQuality = !lastFixAt
    ? now - startedAt > LOST_AGE_MS
      ? 'lost'
      : 'waiting'
    : age > lostAfter
      ? 'lost'
      : (moving && age > WEAK_AGE_MS) || (lastAccuracy != null && lastAccuracy > WEAK_ACCURACY_M)
        ? 'weak'
        : 'ok';
  // In coda c'è sempre qualcosa (i punti partono ogni 10 s): conta da quanto
  // tempo non riesce un invio, non da quanto c'è roba in coda.
  const pending = roadQueue.pendingPoints > 0 || roadQueue.pendingMarkers > 0;
  pendingSince = pending ? Math.max(roadUploader.lastOkAt, startedAt) : 0;
  const speedKmh = age > SPEED_STALE_MS || lastSpeed == null ? 0 : Math.max(0, Math.round(lastSpeed * 3.6));
  return {
    gps,
    offline: !!pendingSince && now - pendingSince > OFFLINE_AFTER_MS,
    speedKmh,
    restarted: !!restartedAt && now - restartedAt < RESTARTED_SHOW_MS,
  };
}

function refresh() {
  const next = compute(Date.now());
  if (
    next.gps === status.gps &&
    next.offline === status.offline &&
    next.speedKmh === status.speedKmh &&
    next.restarted === status.restarted
  ) {
    return;
  }
  status = next;
  listeners.forEach((fn) => fn());
}

export const liveStatus = {
  /** Ogni fix dell'ascolto, anche quelli scartati per la mappa. */
  reportFix(fix: { accuracy: number | null; speed: number | null }, at = Date.now()) {
    lastFixAt = at;
    lastAccuracy = fix.accuracy;
    lastSpeed = fix.speed;
    refresh();
  },

  /** Schermata live montata: parte il ricalcolo a 1 Hz e il watchdog. */
  start() {
    lastFixAt = 0;
    lastAccuracy = null;
    lastSpeed = null;
    pendingSince = 0;
    restartedAt = 0;
    startedAt = Date.now();
    status = { gps: 'waiting', offline: false, speedKmh: 0, restarted: false };
    tick ??= setInterval(refresh, 1000);
    watchdog ??= setInterval(() => {
      void (async () => {
        if (await isRoadTrackingActive()) return;
        try {
          await startRoadTracking();
          restartedAt = Date.now();
          refresh();
        } catch {
          // permesso tolto: lo stato GPS lo mostra comunque
        }
      })();
    }, WATCHDOG_MS);
  },

  stop() {
    if (tick) clearInterval(tick);
    if (watchdog) clearInterval(watchdog);
    tick = null;
    watchdog = null;
  },

  get() {
    return status;
  },

  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};

export function useLiveStatus(): LiveStatus {
  return useSyncExternalStore(liveStatus.subscribe, liveStatus.get, liveStatus.get);
}

/** Riga del pannello quando c'è qualcosa da dire (null = tutto a posto). */
export function liveStatusLine(st: LiveStatus): string | null {
  if (st.restarted) return 'GPS riattivato';
  if (st.gps === 'lost') return 'GPS perso · in pausa';
  if (st.offline) return 'Offline · salvato sul telefono';
  if (st.gps === 'weak') return 'Segnale GPS debole';
  if (st.gps === 'waiting') return 'Ricerca del GPS…';
  return null;
}
