import type { RoadFreeOptions } from '../types/regloApi';

/**
 * REG-638 Road libero — opzioni di «Avvia guida» (durate, veicoli, allievi
 * recenti) lette dalla tab Road e passate al foglio senza rileggerle.
 */
let options: RoadFreeOptions | null = null;
const listeners = new Set<() => void>();

export const roadFreeStore = {
  set(next: RoadFreeOptions | null) {
    options = next;
    listeners.forEach((fn) => fn());
  },
  get: () => options,
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};

export const ROAD_FREE_SHEET_ROUTE = '/(tabs)/drive/avvia' as const;
export const ROAD_FREE_PRIVACY_ROUTE = '/(tabs)/drive/road-privacy' as const;

/**
 * Allievo già scelto nella tab Road (volto toccato): il foglio «Parti con»
 * si apre direttamente sul riepilogo. Si legge una volta e si svuota.
 */
let preselect: string | null = null;
export const roadFreePreselect = {
  set(studentId: string | null) {
    preselect = studentId;
  },
  take() {
    const id = preselect;
    preselect = null;
    return id;
  },
};

/** Per quanti secondi «Annulla» resta sul banner di Road (il server tiene 15 s). */
export const ROAD_UNDO_SECONDS = 10;

export type RoadFreeStarted = {
  sessionId: string;
  /** «14:32–15:22 con Sara». */
  label: string;
  /** Durata scelta, per la riga del riepilogo («restano quelli dei 50 minuti»). */
  bookedMinutes: number;
  until: number;
};

/**
 * Guida appena avviata da Road libero: banner «In agenda: … · Annulla» per
 * 10 secondi e riga in più nel riepilogo. Solo memoria: dopo un kill dell'app
 * la finestra per annullare è comunque scaduta.
 */
let started: RoadFreeStarted | null = null;
const startedListeners = new Set<() => void>();
export const roadFreeStarted = {
  set(next: RoadFreeStarted | null) {
    started = next;
    startedListeners.forEach((fn) => fn());
  },
  get: () => started,
  subscribe(fn: () => void) {
    startedListeners.add(fn);
    return () => {
      startedListeners.delete(fn);
    };
  },
};
