import { useEffect, useState, useSyncExternalStore } from 'react';
import { InteractionManager } from 'react-native';

import { regloApi } from '../services/regloApi';

/**
 * Ricca 8+9 — tasto «Storico» della guida dal vivo: le ultime tracce
 * dell'allievo (anche con altri istruttori) tenui sotto quella in corso.
 *
 * Le tracce si chiedono una volta per guida, dopo le animazioni d'avvio, e
 * restano in memoria per la sessione. Se la richiesta fallisce il tasto non
 * compare. La scelta acceso/spento resta per tutta la vita dell'app (come i
 * suoni), spenta all'avvio.
 */

export type HistoryPt = { latitude: number; longitude: number };

/** Posti fissi sulla mappa: tante quante ne manda il server. */
export const HISTORY_SLOTS = 5;

const cache = new Map<string, HistoryPt[][]>();
const loading = new Set<string>();

export function useRoadHistory(sessionId: string | null, studentId: string | null): HistoryPt[][] {
  const [lines, setLines] = useState<HistoryPt[][]>(() => (sessionId ? cache.get(sessionId) ?? [] : []));
  useEffect(() => {
    if (!sessionId || !studentId) return;
    const hit = cache.get(sessionId);
    if (hit) {
      setLines(hit);
      return;
    }
    if (loading.has(sessionId)) return;
    loading.add(sessionId);
    let alive = true;
    const task = InteractionManager.runAfterInteractions(() => {
      regloApi
        .getRoadStudentHistory(studentId)
        .then((r) => {
          const got = r.items
            .slice(0, HISTORY_SLOTS)
            .map((it) => it.track.map(([latitude, longitude]) => ({ latitude, longitude })))
            .filter((l) => l.length >= 2);
          cache.set(sessionId, got);
          if (alive) setLines(got);
        })
        .catch(() => undefined)
        .finally(() => loading.delete(sessionId));
    });
    return () => {
      alive = false;
      task.cancel();
    };
  }, [sessionId, studentId]);
  return lines;
}

// ── acceso / spento ──
let shown = false;
const listeners = new Set<() => void>();

export const roadHistoryToggle = {
  get: () => shown,
  set(next: boolean) {
    if (next === shown) return;
    shown = next;
    listeners.forEach((l) => l());
  },
};

export function useRoadHistoryShown(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => shown,
  );
}
