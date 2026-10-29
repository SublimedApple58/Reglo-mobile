import type { AutoscuolaStudent, RoadFreeOptions } from '../types/regloApi';
import { regloApi } from '../services/regloApi';
import { prefetchUserPhotos } from '../services/userPhotos';

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

/**
 * Foto dei volti di Road scaricate prima di servire (Tiziano 28/10): i tre
 * suggeriti e gli allievi recenti, appena le opzioni arrivano.
 */
export function prefetchRoadFaces(next: RoadFreeOptions | null) {
  if (!next) return;
  prefetchUserPhotos([...(next.suggestions ?? []).map((f) => f.id), ...next.recentStudents.slice(0, 8).map((r) => r.id)]);
}

/**
 * All'avvio dell'app istruttore (tab Road visibile): opzioni e foto già
 * pronte quando si tocca Road, invece di tre attese in fila (opzioni → URL
 * delle foto → foto). Una volta per avvio; la tab poi le riconferma.
 */
let warmed = false;
export function warmRoadFree() {
  if (warmed) return;
  warmed = true;
  void regloApi
    .getRoadFreeOptions()
    .then((next) => {
      if (!roadFreeStore.get()) roadFreeStore.set(next);
      prefetchRoadFaces(next);
      void refreshRoadStudents();
    })
    .catch(() => {
      warmed = false;
    });
}

/**
 * Allievi e ore per la lente «Tutti» (foglio «Con chi guidi?»), pronti prima
 * che il foglio si apra (fluidità 29/10): il foglio parte da qui e riconferma
 * in sottofondo; chi legge si ridisegna solo se la lista è cambiata.
 */
export type RoadStudents = { students: AutoscuolaStudent[]; minutes: Record<string, number> };
let roadStudents: RoadStudents | null = null;
let studentsKey = '';
let studentsInflight: Promise<RoadStudents | null> | null = null;
export const getRoadStudents = () => roadStudents;
export function refreshRoadStudents(): Promise<RoadStudents | null> {
  if (studentsInflight) return studentsInflight;
  studentsInflight = Promise.all([regloApi.getStudents(), regloApi.getStudentsCompletedHours().catch(() => ({}))])
    .then(([students, minutes]) => {
      const next = { students, minutes: minutes ?? {} };
      const key = JSON.stringify(next);
      if (key !== studentsKey) {
        studentsKey = key;
        roadStudents = next;
      }
      return roadStudents;
    })
    .catch(() => roadStudents)
    .finally(() => {
      studentsInflight = null;
    });
  return studentsInflight;
}

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
