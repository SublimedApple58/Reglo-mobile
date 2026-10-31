import * as Location from 'expo-location';
import NetInfo from '@react-native-community/netinfo';
import { regloApi } from '../services/regloApi';
import { RegloApiError } from '../services/apiClient';
import { loadQueue, roadQueue } from './queue';
import { roadStore } from './roadStore';

/**
 * REG-638 Reglo Road — uploader delle code.
 *
 * - Ogni ~10 s (o quando la coda supera ~40 punti) spedisce un lotto di punti
 *   con `seq` progressivo persistito; `duplicate: true` vale come ok.
 * - Prima dei punti svuota la coda delle segnalazioni (create / annullate).
 * - Offline o errore di rete: backoff esponenziale (2 s → 60 s), riparte da
 *   solo quando NetInfo torna online.
 * - `accepted:false` / `SESSION_CLOSED` / `NOT_FOUND`: il server non prenderà
 *   mai più punti di quella guida (cancellata o chiusa da oltre 2 h) → si
 *   buttano solo quelli; se era la guida in corso si avvisa `onSessionClosed`.
 * - REG-691: un 401 o un FORBIDDEN non buttano mai niente. Si spedisce anche
 *   dopo «Termina» e dopo un nuovo login (punti in ritardo accettati dal
 *   server fino a 2 h dalla chiusura).
 * - Nome della via: `reverseGeocodeAsync` dell'ultima posizione, al massimo
 *   ogni ~20 s, campo `street` (via senza civico).
 */

const FLUSH_EVERY_MS = 10_000;
const FLUSH_AT_POINTS = 40;
const GEOCODE_EVERY_MS = 20_000;
const MAX_BATCHES_PER_FLUSH = 6;

let flushing: Promise<boolean> | null = null;
let lastFlushAt = 0;
/** REG-693: ultimo invio andato a buon fine (lo stato «Offline» del pannello). */
let lastOkAt = Date.now();
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

/** Guide che il server rifiuta per questo utente (FORBIDDEN): si riprovano al prossimo login, non si buttano. */
const parked = new Set<string>();
const syncedListeners = new Set<(sessionId: string) => void>();

async function flushMarkers() {
  for (;;) {
    const op = roadQueue.peekMarkerOp(parked);
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
      // REG-691: «non è tua» (altro utente, autoscuola cambiata) non butta
      // niente: la guida resta in coda e si riprova al prossimo login.
      if (errorCode(err) === 'FORBIDDEN') {
        parked.add(op.sessionId);
        continue;
      }
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

/** La guida in corso è stata chiusa o cancellata altrove. */
async function closedElsewhere(sessionId: string) {
  if (roadQueue.sessionId !== sessionId) return;
  await roadQueue.detach();
  closedHandler?.();
}

async function flushPoints() {
  for (let i = 0; i < MAX_BATCHES_PER_FLUSH * 2; i++) {
    const batch = await roadQueue.takeBatch(600, parked);
    if (!batch) return;
    let res;
    try {
      res = await regloApi.sendRoadPoints(batch.sessionId, {
        seq: batch.seq,
        points: batch.points,
        street: batch.sessionId === roadQueue.sessionId ? street : null,
      });
    } catch (err) {
      const code = errorCode(err);
      if (code === 'FORBIDDEN') {
        // REG-691: mai buttare per un «non è tua» (può essere un cambio di
        // autoscuola o di utente): si salta finché non torna lo stesso utente.
        parked.add(batch.sessionId);
        continue;
      }
      if (code === 'SESSION_CLOSED' || code === 'NOT_FOUND') {
        // guida cancellata o chiusa da oltre 2 h: il server non li prenderà mai
        await roadQueue.dropPoints(batch.sessionId);
        await closedElsewhere(batch.sessionId);
        continue;
      }
      if (isRejection(err)) {
        // lotto malformato: non si sblocca rimandandolo
        await roadQueue.ackBatch(batch.sessionId, batch.seq);
        continue;
      }
      throw err;
    }
    if (res && res.accepted === false) {
      await roadQueue.dropPoints(batch.sessionId);
      await closedElsewhere(batch.sessionId);
      continue;
    }
    await roadQueue.ackBatch(batch.sessionId, batch.seq);
    if (batch.sessionId !== roadQueue.sessionId && roadQueue.pendingFor(batch.sessionId) === 0) {
      syncedListeners.forEach((fn) => fn(batch.sessionId));
    }
  }
}

/** Timer acceso anche fuori da Road finché restano punti di guide chiuse da spedire. */
let active = false;

function ensureTimer() {
  if (!timer) {
    timer = setInterval(() => {
      if (!active && roadQueue.pendingAllPoints === 0 && roadQueue.pendingMarkers === 0) {
        teardown();
        return;
      }
      roadUploader.maybeFlush();
    }, FLUSH_EVERY_MS / 2);
  }
  if (!netUnsub) {
    let wasOnline = true;
    netUnsub = NetInfo.addEventListener((s) => {
      const online = !!s.isConnected;
      if (online && !wasOnline) void roadUploader.flush(true);
      wasOnline = online;
    });
  }
}

function teardown() {
  if (timer) clearInterval(timer);
  timer = null;
  netUnsub?.();
  netUnsub = null;
}

export const roadUploader = {
  /** Chi gestisce la chiusura remota della sessione (roadActions). */
  onSessionClosed(fn: (() => void) | null) {
    closedHandler = fn;
  },

  get street() {
    return street;
  },

  get lastOkAt() {
    return lastOkAt;
  },

  /** Via corrente, aggiornata se è passato abbastanza tempo. */
  refreshStreet,

  maybeFlush() {
    const due = Date.now() - lastFlushAt >= FLUSH_EVERY_MS;
    if (due || roadQueue.pendingPoints >= FLUSH_AT_POINTS || roadQueue.pendingMarkers > 0 || roadQueue.pendingAllPoints > roadQueue.pendingPoints) {
      void roadUploader.flush();
    }
  },

  /**
   * Spedisce tutto quello che può. Ritorna true se le code dell'utente
   * attuale sono vuote (guida in corso e guide chiuse).
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
        lastOkAt = Date.now();
        return roadQueue.pendingAllPoints === 0 && roadQueue.pendingMarkers === 0;
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
    active = true;
    ensureTimer();
  },

  /**
   * Fuori dalla guida: il timer resta acceso solo finché ci sono punti o
   * segnalazioni di guide chiuse da spedire (REG-691), poi si spegne da solo.
   */
  stop() {
    active = false;
    failures = 0;
    nextAttemptAt = 0;
    if (roadQueue.pendingAllPoints > 0 || roadQueue.pendingMarkers > 0) ensureTimer();
    else teardown();
  },

  /**
   * Nuovo utente loggato (o login rinnovato): le guide «parcheggiate» si
   * riprovano e, se c'è qualcosa in coda, si riparte a spedire.
   */
  async resumeAfterLogin() {
    parked.clear();
    await loadQueue();
    if (roadQueue.pendingAllPoints > 0 || roadQueue.pendingMarkers > 0) {
      ensureTimer();
      void roadUploader.flush(true);
    }
  },

  /** Avvisa quando gli ultimi punti di una guida chiusa sono arrivati al server. */
  onSessionSynced(fn: (sessionId: string) => void) {
    syncedListeners.add(fn);
    return () => {
      syncedListeners.delete(fn);
    };
  },

  resetStreet() {
    street = null;
    lastGeocodeAt = 0;
  },
};
