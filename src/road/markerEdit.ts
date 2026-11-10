import { useSyncExternalStore } from 'react';
import { router } from 'expo-router';

import type { UpdateRoadMarkerInput } from '../types/regloApi';
import { correctRoadMarker, refreshRoadSummary } from './roadActions';
import { roadStore, useRoadSelector, type RoadLocalMarker } from './roadStore';

/**
 * Road novembre R3 — modifica di una segnalazione (tipo, giudizio, nota,
 * posizione, eliminazione) dal foglio «Segnalazione» e dal mirino «Sposta».
 *
 * Il foglio lavora su una segnalazione per `clientId`: in guida è una di
 * `roadStore.markers` (dal vivo), a guida finita una di `summary.markers`
 * (riepilogo, ripasso, «Tutte le segnalazioni»). Niente aggiornamento
 * ottimistico: lo schermo cambia dopo la risposta del server, o dopo che la
 * modifica è entrata nella coda offline (che il server applicherà).
 */

export type MarkerEditTarget = { sessionId: string; clientId: string; live: boolean };

let target: MarkerEditTarget | null = null;
const listeners = new Set<() => void>();

export const markerEditTarget = {
  get: () => target,
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

export function useMarkerEditTarget() {
  return useSyncExternalStore(markerEditTarget.subscribe, markerEditTarget.get);
}

/** Apre il foglio «Segnalazione» su questa segnalazione. */
export function openRoadMarkerSheet(t: MarkerEditTarget) {
  target = t;
  listeners.forEach((fn) => fn());
  router.push('/road/segnalazione');
}

/** La segnalazione aperta, sempre aggiornata (dal vivo o del riepilogo). */
export function useEditedMarker(): RoadLocalMarker | null {
  const t = useMarkerEditTarget();
  return useRoadSelector((s) => {
    if (!t) return null;
    if (t.live) return s.markers.find((m) => m.clientId === t.clientId) ?? null;
    const m = s.summary?.id === t.sessionId ? s.summary.markers.find((x) => x.clientId === t.clientId) : undefined;
    return (m as RoadLocalMarker | undefined) ?? null;
  });
}

/** Etichetta di un tipo dal catalogo (base o dell'autoscuola); null = sconosciuto. */
export function markerLabelFor(kind: string): string | null {
  const { catalog } = roadStore.get();
  const base = catalog.base.find((b) => b.key === kind);
  if (base) return base.label;
  const custom = catalog.custom.find((c) => `custom:${c.id}` === kind);
  return custom?.label ?? null;
}

/**
 * Applica una modifica. `true` = fatta (sul server o in coda): lo stato del
 * telefono è già aggiornato. `false` = errore già mostrato all'istruttore.
 */
export async function applyMarkerEdit(t: MarkerEditTarget, change: { patch: UpdateRoadMarkerInput } | { remove: true }) {
  const ok = await correctRoadMarker(t.sessionId, t.clientId, change);
  if (!ok) return false;
  if (t.live) {
    if ('remove' in change) roadStore.removeMarker(t.clientId);
    else {
      const p = change.patch;
      const label = p.kind ? markerLabelFor(p.kind) : null;
      roadStore.updateLocalMarker(t.clientId, {
        ...(p.kind ? { kind: p.kind, ...(label ? { label } : {}) } : {}),
        ...(p.sentiment !== undefined ? { sentiment: p.sentiment } : {}),
        ...(p.note !== undefined ? { note: p.note } : {}),
        ...(p.extentM !== undefined ? { extentM: p.extentM, extent: null } : {}),
        // Spostata a mano: la via la ricalcola il server, sul telefono si toglie.
        ...(p.lat != null && p.lng != null ? { lat: p.lat, lng: p.lng, street: null, alt: null } : {}),
      });
    }
  } else {
    void refreshRoadSummary();
  }
  return true;
}
