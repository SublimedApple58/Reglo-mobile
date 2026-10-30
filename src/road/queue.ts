import * as FileSystem from 'expo-file-system/legacy';
import type { AddRoadHotspotCheckInput, AddRoadMarkerInput, RoadPoint } from '../types/regloApi';

/**
 * REG-638 Reglo Road — code persistenti su file (sopravvivono a kill/crash).
 *
 * - `points`: punti GPS non ancora spediti. L'uploader ne "congela" un lotto in
 *   `inflight` con il suo `seq`: finché il server non lo conferma si rimanda
 *   ESATTAMENTE quel lotto (stesso seq, stessi punti), così l'idempotenza del
 *   backend (`@@unique(sessionId, seq)`) non perde mai punti.
 * - `markerOps`: segnalazioni da creare / annullare, coda separata. Ogni
 *   segnalazione ha il suo `clientId` generato in app (idempotente lato server).
 *   Nella stessa coda i ripassi sui punti critici (REG-681, `check-*`).
 *
 * Un solo runtime JS: lo stato vive in memoria e si scrive su file a ogni
 * modifica (scritture in fila, mai concorrenti).
 */

export type MarkerOp =
  | { op: 'add'; sessionId: string; input: AddRoadMarkerInput }
  | { op: 'remove'; sessionId: string; clientId: string }
  | { op: 'check-add'; sessionId: string; input: AddRoadHotspotCheckInput }
  | { op: 'check-remove'; sessionId: string; clientId: string };

type QueueState = {
  sessionId: string | null;
  nextSeq: number;
  points: RoadPoint[];
  inflight: { seq: number; points: RoadPoint[] } | null;
  markerOps: MarkerOp[];
};

const FILE = `${FileSystem.documentDirectory}reglo-road-queue.json`;
const EMPTY: QueueState = { sessionId: null, nextSeq: 0, points: [], inflight: null, markerOps: [] };

let state: QueueState = { ...EMPTY };
let loaded: Promise<void> | null = null;
let writeChain: Promise<void> = Promise.resolve();

function persist() {
  const snapshot = JSON.stringify(state);
  writeChain = writeChain
    .then(() => FileSystem.writeAsStringAsync(FILE, snapshot))
    .catch(() => undefined);
  return writeChain;
}

export function loadQueue(): Promise<void> {
  if (!loaded) {
    loaded = (async () => {
      try {
        const raw = await FileSystem.readAsStringAsync(FILE);
        const parsed = JSON.parse(raw) as Partial<QueueState>;
        state = {
          sessionId: parsed.sessionId ?? null,
          nextSeq: Number.isInteger(parsed.nextSeq) ? (parsed.nextSeq as number) : 0,
          points: Array.isArray(parsed.points) ? parsed.points : [],
          inflight: parsed.inflight ?? null,
          markerOps: Array.isArray(parsed.markerOps) ? parsed.markerOps : [],
        };
      } catch {
        state = { ...EMPTY };
      }
    })();
  }
  return loaded;
}

export const roadQueue = {
  get sessionId() {
    return state.sessionId;
  },
  get pendingPoints() {
    return state.points.length + (state.inflight?.points.length ?? 0);
  },
  get pendingMarkers() {
    return state.markerOps.length;
  },

  /**
   * Allinea la coda a una sessione. Stessa sessione (ripresa dopo un kill):
   * si tiene tutto. Sessione nuova: punti vecchi buttati (il server li
   * rifiuterebbe comunque), segnalazioni vecchie tenute (accettate fino a 2 h
   * dopo la chiusura).
   */
  async attach(sessionId: string, serverLastSeq: number) {
    await loadQueue();
    if (state.sessionId === sessionId) {
      state.nextSeq = Math.max(state.nextSeq, serverLastSeq + 1);
    } else {
      state = {
        sessionId,
        nextSeq: serverLastSeq + 1,
        points: [],
        inflight: null,
        markerOps: state.markerOps,
      };
    }
    await persist();
  },

  async appendPoints(points: RoadPoint[]) {
    await loadQueue();
    if (!state.sessionId || !points.length) return;
    state.points.push(...points);
    await persist();
  },

  /** Lotto da spedire: quello in volo (da rimandare) o uno nuovo. */
  async takeBatch(max = 600): Promise<{ sessionId: string; seq: number; points: RoadPoint[] } | null> {
    await loadQueue();
    if (!state.sessionId) return null;
    if (!state.inflight) {
      if (!state.points.length) return null;
      const points = state.points.splice(0, max);
      state.inflight = { seq: state.nextSeq, points };
      state.nextSeq += 1;
      await persist();
    }
    return { sessionId: state.sessionId, seq: state.inflight.seq, points: state.inflight.points };
  },

  async ackBatch(seq: number) {
    if (state.inflight?.seq === seq) {
      state.inflight = null;
      await persist();
    }
  },

  /** Sessione chiusa lato server: i punti non servono più. */
  async dropPoints() {
    state.points = [];
    state.inflight = null;
    await persist();
  },

  async pushMarkerOp(op: MarkerOp) {
    await loadQueue();
    if (op.op === 'remove' || op.op === 'check-remove') {
      // «Annulla» prima che l'add sia partito: basta togliere l'add.
      const addOp = op.op === 'remove' ? 'add' : 'check-add';
      const idx = state.markerOps.findIndex((m) => m.op === addOp && m.input.clientId === op.clientId);
      if (idx >= 0) {
        state.markerOps.splice(idx, 1);
        await persist();
        return;
      }
    }
    state.markerOps.push(op);
    await persist();
  },

  peekMarkerOp(): MarkerOp | null {
    return state.markerOps[0] ?? null;
  },

  async shiftMarkerOp(op: MarkerOp) {
    if (state.markerOps[0] === op) {
      state.markerOps.shift();
      await persist();
    }
  },

  /** Fine guida: si scollega la sessione (le segnalazioni in coda restano). */
  async detach() {
    await loadQueue();
    state = { ...EMPTY, markerOps: state.markerOps };
    await persist();
  },

  async clearAll() {
    state = { ...EMPTY };
    await persist();
  },
};
