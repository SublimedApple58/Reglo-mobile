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
export type HistoryLine = { pts: HistoryPt[]; startedAt: string };

/**
 * Un colore per guida, come «Tutti i percorsi» della scheda allievo web
 * (`ROUTE_COLORS` in `reglo/components/pages/Autoscuole/road/StudentRoad.tsx`):
 * palette istruttori dell'agenda senza blu/azzurro/indaco/ciano, stesso
 * ordine (la guida più recente prende il primo). Di notte gli stessi toni più
 * chiari (Tailwind 400), leggibili sulla mappa scura. Le due liste vanno
 * cambiate insieme al web.
 */
const HISTORY_COLORS_DAY = ['#E11D48', '#059669', '#D97706', '#7C3AED', '#0D9488', '#EA580C', '#C026D3', '#65A30D', '#DB2777', '#57534E'];
const HISTORY_COLORS_NIGHT = ['#FB7185', '#34D399', '#FBBF24', '#A78BFA', '#2DD4BF', '#FB923C', '#E879F9', '#A3E635', '#F472B6', '#A8A29E'];
export const historyColor = (i: number, night: boolean) => {
  const list = night ? HISTORY_COLORS_NIGHT : HISTORY_COLORS_DAY;
  return list[i % list.length];
};

/** Posti fissi sulla mappa: tante quante ne manda il server. */
export const HISTORY_SLOTS = 5;

const cache = new Map<string, HistoryLine[]>();
/** Richiesta in corso per guida: chi monta nel frattempo la aspetta (prima restava senza dati). */
const inflight = new Map<string, Promise<HistoryLine[] | null>>();

function loadHistory(sessionId: string, studentId: string): Promise<HistoryLine[] | null> {
  let p = inflight.get(sessionId);
  if (!p) {
    p = regloApi
      .getRoadStudentHistory(studentId)
      .then((r) => {
        const got = r.items
          .slice(0, HISTORY_SLOTS)
          .map((it) => ({ startedAt: it.startedAt, pts: it.track.map(([latitude, longitude]) => ({ latitude, longitude })) }))
          .filter((l) => l.pts.length >= 2);
        cache.set(sessionId, got);
        return got;
      })
      .catch(() => null)
      .finally(() => inflight.delete(sessionId));
    inflight.set(sessionId, p);
  }
  return p;
}

export function useRoadHistory(sessionId: string | null, studentId: string | null): HistoryLine[] {
  const [lines, setLines] = useState<HistoryLine[]>(() => (sessionId ? cache.get(sessionId) ?? [] : []));
  useEffect(() => {
    if (!sessionId || !studentId) return;
    const hit = cache.get(sessionId);
    if (hit) {
      setLines(hit);
      return;
    }
    let alive = true;
    const task = InteractionManager.runAfterInteractions(() => {
      void loadHistory(sessionId, studentId).then((got) => {
        if (alive && got) setLines(got);
      });
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
