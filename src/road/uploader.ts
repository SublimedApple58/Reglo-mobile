import * as Location from 'expo-location';
import NetInfo from '@react-native-community/netinfo';
import { regloApi } from '../services/regloApi';
import { RegloApiError } from '../services/apiClient';
import { roadQueue } from './queue';
import { roadStore } from './roadStore';

/**
 * REG-638 Reglo Road — uploader delle code.
 *
 * - Ogni ~10 s (o quando la coda supera ~40 punti) spedisce un lotto di punti
 *   con `seq` progressivo persistito; `duplicate: true` vale come ok.
 * - Prima dei punti svuota la coda delle segnalazioni (create / annullate).
 * - Offline o errore di rete: backoff esponenziale (2 s → 60 s), riparte da
 *   solo quando NetInfo torna online.
 * - `accepted:false` / `SESSION_CLOSED`: la guida è stata chiusa altrove → si
 *   ferma e avvisa chi ha registrato `onSessionClosed`.
 * - Nome della via: `reverseGeocodeAsync` dell'ultima posizione, al massimo
 *   ogni ~20 s, campo `street` (via senza civico).
 */

const FLUSH_EVERY_MS = 10_000;
const FLUSH_AT_POINTS = 40;
const GEOCODE_EVERY_MS = 20_000;
const MAX_BATCHES_PER_FLUSH = 6;

let flushing: Promise<boolean> | null = null;
let lastFlushAt = 0;
let failures = 0;
let nextAttemptAt = 0;
let lastGeocodeAt = 0;
let street: string | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let netUnsub: (() => void) | null = null;
let closedHandler: (() => void) | null = null;

/** Errore "applicativo" (il server ha risposto con un rifiuto): non si ritenta. */
function isRejection(err: unknown): boolean {
  return err instanceof RegloApiError && err.status === 400;
}

function errorCode(err: unknown): string | null {
  if (!(err instanceof RegloApiError)) return null;
  const payload = err.payload as { code?: string } | null | undefined;
  return payload?.code ?? null;
}

async function refreshStreet(force = false) {
  const fix = roadStore.get().fix;
  if (!fix) return street;
  if (!force && Date.now() - lastGeocodeAt < GEOCODE_EVERY_MS) return street;
  lastGeocodeAt = Date.now();
  try {
    const res = await Location.reverseGeocodeAsync({ latitude: fix.lat, longitude: fix.lng });
    const first = res?.[0];
    const name = first?.street?.trim() || null;
    if (name) {
      street = name;
      roadStore.setStreet(name);
    }
  } catch {
    // geocoder limitato o offline: si tiene l'ultima via
  }
  return street;
}

async function flushMarkers() {
  for (;;) {
    const op = roadQueue.peekMarkerOp();
    if (!op) return;
    try {
      if (op.op === 'add') {
        await regloApi.addRoadMarker(op.sessionId, op.input);
      } else if (op.op === 'remove') {
        await regloApi.removeRoadMarker(op.sessionId, op.clientId);
      } else if (op.op === 'check-add') {
        await regloApi.addRoadHotspotCheck(op.sessionId, op.input);
      } else {
        await regloApi.removeRoadHotspotCheck(op.sessionId, op.clientId);
      }
      await roadQueue.shiftMarkerOp(op);
    } catch (err) {
      // Rifiuto del server (guida chiusa da > 2 h, tipo sconosciuto, …):
      // rimandarla non cambierebbe niente → si scarta. Rete: si ritenta.
      // Un ripasso verso un backend che non lo conosce ancora (404) non deve
      // bloccare per sempre la coda delle segnalazioni dietro di lui.
      const unknownRoute = (op.op === 'check-add' || op.op === 'check-remove') && err instanceof RegloApiError && err.status === 404;
      if (isRejection(err) || unknownRoute) {
        await roadQueue.shiftMarkerOp(op);
        continue;
      }
      throw err;
    }
  }
}

async function flushPoints() {
  for (let i = 0; i < MAX_BATCHES_PER_FLUSH; i++) {
    const batch = await roadQueue.takeBatch();
    if (!batch) return;
    let res;
    try {
      res = await regloApi.sendRoadPoints(batch.sessionId, {
        seq: batch.seq,
        points: batch.points,
        street,
      });
    } catch (err) {
      const code = errorCode(err);
      if (code === 'SESSION_CLOSED' || code === 'NOT_FOUND' || code === 'FORBIDDEN') {
        // sessione chiusa/cancellata altrove: la coda si scollega (i punti
        // successivi non vanno più accodati né spediti)
        await roadQueue.detach();
        closedHandler?.();
        return;
      }
      if (isRejection(err)) {
        // lotto malformato: non si sblocca rimandandolo
        await roadQueue.ackBatch(batch.seq);
        continue;
      }
      throw err;
    }
    if (res && res.accepted === false) {
      await roadQueue.detach();
      closedHandler?.();
      return;
    }
    await roadQueue.ackBatch(batch.seq);
  }
}

export const roadUploader = {
  /** Chi gestisce la chiusura remota della sessione (roadActions). */
  onSessionClosed(fn: (() => void) | null) {
    closedHandler = fn;
  },

  get street() {
    return street;
  },

  /** Via corrente, aggiornata se è passato abbastanza tempo. */
  refreshStreet,

  maybeFlush() {
    const due = Date.now() - lastFlushAt >= FLUSH_EVERY_MS;
    if (due || roadQueue.pendingPoints >= FLUSH_AT_POINTS || roadQueue.pendingMarkers > 0) {
      void roadUploader.flush();
    }
  },

  /**
   * Spedisce tutto quello che può. Ritorna true se le code sono vuote.
   * `force` ignora il backoff (fine guida, ritorno online).
   */
  flush(force = false): Promise<boolean> {
    if (flushing) return flushing;
    if (!force && Date.now() < nextAttemptAt) return Promise.resolve(false);
    flushing = (async () => {
      try {
        await refreshStreet();
        await flushMarkers();
        await flushPoints();
        failures = 0;
        nextAttemptAt = 0;
        return roadQueue.pendingPoints === 0 && roadQueue.pendingMarkers === 0;
      } catch {
        failures += 1;
        nextAttemptAt = Date.now() + Math.min(60_000, 2_000 * 2 ** Math.min(failures, 5));
        return false;
      } finally {
        lastFlushAt = Date.now();
        flushing = null;
      }
    })();
    return flushing;
  },

  start() {
    if (!timer) {
      timer = setInterval(() => roadUploader.maybeFlush(), FLUSH_EVERY_MS / 2);
    }
    if (!netUnsub) {
      let wasOnline = true;
      netUnsub = NetInfo.addEventListener((s) => {
        const online = !!s.isConnected;
        if (online && !wasOnline) void roadUploader.flush(true);
        wasOnline = online;
      });
    }
  },

  stop() {
    if (timer) clearInterval(timer);
    timer = null;
    netUnsub?.();
    netUnsub = null;
    failures = 0;
    nextAttemptAt = 0;
  },

  resetStreet() {
    street = null;
    lastGeocodeAt = 0;
  },
};
