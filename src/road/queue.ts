import * as FileSystem from 'expo-file-system/legacy';
import type { AddRoadHotspotCheckInput, AddRoadMarkerInput, RoadPoint, UpdateRoadMarkerInput } from '../types/regloApi';

/**
 * REG-638 Reglo Road — code persistenti su file (sopravvivono a kill/crash).
 *
 * - `sessions`: una coda di punti GPS per guida. La guida in corso è
 *   `current`; le altre sono guide già chiuse (o lasciate al logout) con punti
 *   ancora da spedire: il server li accetta fino a 2 h dopo la chiusura
 *   (REG-691). L'uploader "congela" un lotto in `inflight` con il suo `seq`:
 *   finché il server non lo conferma si rimanda ESATTAMENTE quel lotto
 *   (stesso seq, stessi punti), così l'idempotenza del backend
 *   (`@@unique(sessionId, seq)`) non perde mai punti.
 * - `markerOps`: segnalazioni da creare / annullare, coda separata. Ogni
 *   segnalazione ha il suo `clientId` generato in app (idempotente lato server).
 *   Nella stessa coda i ripassi sui punti critici (REG-681, `check-*`).
 * - REG-691: ogni guida e ogni operazione ricordano l'utente che le ha
 *   registrate (`ownerId`). Logout, login scaduto o cambio utente non buttano
 *   più niente: si spedisce solo quando è di nuovo dentro lo stesso utente.
 *   Si scarta solo ciò che il server non accetterà mai (guida cancellata o
 *   chiusa da oltre 2 h) o che resta fermo oltre `STALE_MS`.
 *
 * Un solo runtime JS: lo stato vive in memoria e si scrive su file a ogni
 * modifica (scritture in fila, mai concorrenti).
 */

export type MarkerOp = (
  | { op: 'add'; sessionId: string; input: AddRoadMarkerInput }
  | { op: 'remove'; sessionId: string; clientId: string }
  | { op: 'update'; sessionId: string; clientId: string; patch: UpdateRoadMarkerInput }
  | { op: 'check-add'; sessionId: string; input: AddRoadHotspotCheckInput }
  | { op: 'check-remove'; sessionId: string; clientId: string }
) & { ownerId?: string | null };

type SessionQueue = {
  sessionId: string;
  ownerId: string | null;
  nextSeq: number;
  points: RoadPoint[];
  inflight: { seq: number; points: RoadPoint[] } | null;
  /** Ultima modifica: oltre `STALE_MS` la coda di una guida chiusa si butta. */
  touchedAt: number;
};

type QueueState = {
  current: string | null;
  sessions: SessionQueue[];
  markerOps: MarkerOp[];
};

export type PointBatch = { sessionId: string; seq: number; points: RoadPoint[] };

/** Il server accetta i punti fino a 2 h dalla chiusura: oltre non servono più. */
const STALE_MS = 6 * 60 * 60 * 1000;

const FILE = `${FileSystem.documentDirectory}reglo-road-queue.json`;
const EMPTY: QueueState = { current: null, sessions: [], markerOps: [] };

let state: QueueState = { ...EMPTY, sessions: [], markerOps: [] };
let loaded: Promise<void> | null = null;
let writeChain: Promise<void> = Promise.resolve();
let owner: string | null = null;

function persist() {
  const snapshot = JSON.stringify(state);
  writeChain = writeChain
    .then(() => FileSystem.writeAsStringAsync(FILE, snapshot))
    .catch(() => undefined);
  return writeChain;
}

const pendingOf = (q: SessionQueue) => q.points.length + (q.inflight?.points.length ?? 0);

/** Utente attuale ammesso a spedire questa coda (null = nessuno loggato). */
const mine = (ownerId: string | null | undefined) => !!owner && (!ownerId || ownerId === owner);

function find(sessionId: string | null) {
  return sessionId ? state.sessions.find((q) => q.sessionId === sessionId) ?? null : null;
}

/** Via le code vuote delle guide chiuse e quelle ferme da troppo tempo. */
function prune(now = Date.now()) {
  state.sessions = state.sessions.filter(
    (q) => q.sessionId === state.current || (pendingOf(q) > 0 && now - q.touchedAt < STALE_MS),
  );
}

/** File del formato di prima (una sola sessione): si converte senza perdere niente. */
function migrate(parsed: Record<string, unknown>): QueueState {
  const markerOps = Array.isArray(parsed.markerOps) ? (parsed.markerOps as MarkerOp[]) : [];
  if (Array.isArray(parsed.sessions)) {
    return {
      current: typeof parsed.current === 'string' ? parsed.current : null,
      sessions: parsed.sessions as SessionQueue[],
      markerOps,
    };
  }
  const sessionId = typeof parsed.sessionId === 'string' ? parsed.sessionId : null;
  const sessions: SessionQueue[] = sessionId
    ? [
        {
          sessionId,
          ownerId: null,
          nextSeq: Number.isInteger(parsed.nextSeq) ? (parsed.nextSeq as number) : 0,
          points: Array.isArray(parsed.points) ? (parsed.points as RoadPoint[]) : [],
          inflight: (parsed.inflight as SessionQueue['inflight']) ?? null,
          touchedAt: Date.now(),
        },
      ]
    : [];
  return { current: sessionId, sessions, markerOps };
}

export function loadQueue(): Promise<void> {
  if (!loaded) {
    loaded = (async () => {
      try {
        const raw = await FileSystem.readAsStringAsync(FILE);
        state = migrate(JSON.parse(raw) as Record<string, unknown>);
        prune();
      } catch {
        state = { ...EMPTY, sessions: [], markerOps: [] };
      }
    })();
  }
  return loaded;
}

export const roadQueue = {
  /** Utente loggato (RoadController): decide quali code si possono spedire. */
  setOwner(userId: string | null) {
    owner = userId;
  },

  get sessionId() {
    return state.current;
  },
  /** Punti della guida in corso non ancora confermati dal server. */
  get pendingPoints() {
    const q = find(state.current);
    return q ? pendingOf(q) : 0;
  },
  /** Punti di tutte le guide (anche chiuse) che l'utente attuale deve spedire. */
  get pendingAllPoints() {
    return state.sessions.reduce((n, q) => n + (mine(q.ownerId) ? pendingOf(q) : 0), 0);
  },
  get pendingMarkers() {
    return state.markerOps.filter((m) => mine(m.ownerId)).length;
  },
  /** Punti ancora da spedire di una guida precisa (anche già chiusa). */
  pendingFor(sessionId: string) {
    const q = find(sessionId);
    return q ? pendingOf(q) : 0;
  },

  /**
   * Allinea la coda a una sessione. Stessa sessione (ripresa dopo un kill o un
   * nuovo login): si tiene tutto. Sessione nuova: quella di prima resta in
   * coda con i suoi punti finché il server li accetta.
   */
  async attach(sessionId: string, serverLastSeq: number) {
    await loadQueue();
    let q = find(sessionId);
    if (q) {
      q.nextSeq = Math.max(q.nextSeq, serverLastSeq + 1);
      q.ownerId = q.ownerId ?? owner;
      q.touchedAt = Date.now();
    } else {
      q = { sessionId, ownerId: owner, nextSeq: serverLastSeq + 1, points: [], inflight: null, touchedAt: Date.now() };
      state.sessions.push(q);
    }
    state.current = sessionId;
    prune();
    await persist();
  },

  async appendPoints(points: RoadPoint[]) {
    await loadQueue();
    const q = find(state.current);
    if (!q || !points.length) return;
    q.points.push(...points);
    q.touchedAt = Date.now();
    await persist();
  },

  /**
   * Prossimo lotto da spedire: prima la guida in corso, poi quelle chiuse.
   * Quello in volo si rimanda identico. `skip`: guide da saltare in questo giro.
   */
  async takeBatch(max = 600, skip: ReadonlySet<string> = new Set()): Promise<PointBatch | null> {
    await loadQueue();
    const order = [...state.sessions].sort((a, b) => Number(b.sessionId === state.current) - Number(a.sessionId === state.current));
    const q = order.find((s) => !skip.has(s.sessionId) && mine(s.ownerId) && pendingOf(s) > 0);
    if (!q) return null;
    if (!q.inflight) {
      const points = q.points.splice(0, max);
      q.inflight = { seq: q.nextSeq, points };
      q.nextSeq += 1;
      q.touchedAt = Date.now();
      await persist();
    }
    return { sessionId: q.sessionId, seq: q.inflight.seq, points: q.inflight.points };
  },

  async ackBatch(sessionId: string, seq: number) {
    const q = find(sessionId);
    if (q?.inflight?.seq === seq) {
      q.inflight = null;
      q.touchedAt = Date.now();
      prune();
      await persist();
    }
  },

  /** Il server non accetterà mai più punti di questa guida (cancellata, chiusa da oltre 2 h). */
  async dropPoints(sessionId: string) {
    const q = find(sessionId);
    if (!q) return;
    q.points = [];
    q.inflight = null;
    prune();
    await persist();
  },

  async pushMarkerOp(op: MarkerOp) {
    await loadQueue();
    if (op.op === 'update') {
      // REG-696: correzione prima che l'add sia partito: si corregge l'add.
      const add = state.markerOps.find((m) => m.op === 'add' && m.input.clientId === op.clientId);
      if (add && add.op === 'add') {
        add.input = { ...add.input, ...op.patch } as AddRoadMarkerInput;
        await persist();
        return;
      }
    }
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
    state.markerOps.push({ ...op, ownerId: op.ownerId ?? owner });
    await persist();
  },

  /** Prima operazione che l'utente attuale può spedire (`skip`: guide da saltare). */
  peekMarkerOp(skip: ReadonlySet<string> = new Set()): MarkerOp | null {
    return state.markerOps.find((m) => mine(m.ownerId) && !skip.has(m.sessionId)) ?? null;
  },

  async shiftMarkerOp(op: MarkerOp) {
    const idx = state.markerOps.indexOf(op);
    if (idx >= 0) {
      state.markerOps.splice(idx, 1);
      await persist();
    }
  },

  /**
   * Fine guida (o guida chiusa altrove, o logout): la guida non è più quella
   * in corso, ma i suoi punti non ancora spediti restano in coda.
   */
  async detach() {
    await loadQueue();
    state.current = null;
    prune();
    await persist();
  },

  /** Guida cancellata (annullata nei primi secondi): punti e segnalazioni via. */
  async discardSession(sessionId: string) {
    await loadQueue();
    state.sessions = state.sessions.filter((q) => q.sessionId !== sessionId);
    state.markerOps = state.markerOps.filter((m) => m.sessionId !== sessionId);
    if (state.current === sessionId) state.current = null;
    await persist();
  },
};
