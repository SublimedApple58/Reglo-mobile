import { useSyncExternalStore } from 'react';
import type {
  RoadCatalog,
  RoadDetail,
  RoadLesson,
  RoadPoint,
  RoadSessionWithLesson,
} from '../types/regloApi';
import { bearingDeg, haversineMeters } from './format';
import { FALLBACK_BASE_CATALOG } from './markerArt';
import {
  EMPTY_PROGRESS,
  planAlertExpired,
  progressFromTrack,
  stepPlanAlerts,
  type PlanAlert,
  type PlanProgress,
} from './planAlerts';

/**
 * REG-638 Reglo Road — stato della modalità Road (un solo store di modulo,
 * letto con `useSyncExternalStore`). Tiene ciò che serve alla mappa dal vivo:
 * percorso disegnato, ultima posizione, km stimati in locale, segnalazioni
 * fatte in questa guida, toast «Annulla». I numeri FINALI (riepilogo) arrivano
 * dal server con `POST /end` e stanno in `summary`.
 */

export type RoadFix = {
  lat: number;
  lng: number;
  /** m/s */
  speed: number | null;
  heading: number | null;
  accuracy: number | null;
  t: number;
};

export type RoadLocalMarker = {
  clientId: string;
  kind: string;
  label: string;
  note: string | null;
  lat: number;
  lng: number;
  street: string | null;
  sentiment: 'good' | 'bad' | null;
  recordedAt: string;
};

export type RoadSentiment = 'good' | 'bad';

export type RoadToast = {
  clientId: string;
  kind: string;
  label: string;
  street: string | null;
  sentiment: RoadSentiment | null;
  at: string;
};

export type RoadPhase = 'idle' | 'active' | 'ending' | 'summary';

type State = {
  phase: RoadPhase;
  session: RoadSessionWithLesson | null;
  catalog: RoadCatalog;
  track: Array<{ latitude: number; longitude: number }>;
  distanceMeters: number;
  fix: RoadFix | null;
  street: string | null;
  markers: RoadLocalMarker[];
  toast: RoadToast | null;
  summary: RoadDetail | null;
  /** Il pagellino è acceso per l'autoscuola (bottone nell'header). */
  evaluationEnabled: boolean;
  /** Guida su cui si può entrare in Road adesso (da `/road/state`). */
  eligible: RoadLesson | null;
  /** Road acceso per l'autoscuola: c'è la tab «Road» con «Avvia guida» (Road libero, sempre). */
  roadEnabled: boolean;
  /** `/road/state` ha risposto almeno una volta (prima vale la cache delle impostazioni). */
  roadKnown: boolean;
  /** Ultimo segno scelto in «Segnala»: resta per la sessione (default «da migliorare»). */
  sentimentMode: RoadSentiment;
  /** REG-650: «Avvisi delle tappe» dell'autoscuola (da `/road/state`, acceso se assente). */
  planAlertsEnabled: boolean;
  /** REG-650: tappe del giro raggiunte / già avvisate in questa guida. */
  planProgress: PlanProgress;
  /** REG-650: la card dell'avviso a schermo (una alla volta). */
  planAlert: PlanAlert | null;
};

const INITIAL: State = {
  phase: 'idle',
  session: null,
  catalog: { base: FALLBACK_BASE_CATALOG, custom: [] },
  track: [],
  distanceMeters: 0,
  fix: null,
  street: null,
  markers: [],
  toast: null,
  summary: null,
  evaluationEnabled: false,
  eligible: null,
  roadEnabled: false,
  roadKnown: false,
  sentimentMode: 'bad',
  planAlertsEnabled: true,
  planProgress: EMPTY_PROGRESS,
  planAlert: null,
};

let state: State = INITIAL;
const listeners = new Set<() => void>();

function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  listeners.forEach((fn) => fn());
}

// Filtri uguali al backend: fix imprecisi (> 50 m) e salti > 180 km/h fuori.
const MAX_ACCURACY_M = 50;
const MAX_SPEED_MS = 50;

export const roadStore = {
  get: () => state,
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },

  setCatalog(catalog: RoadCatalog) {
    set({ catalog: { base: catalog.base?.length ? catalog.base : FALLBACK_BASE_CATALOG, custom: catalog.custom ?? [] } });
  },

  setSentimentMode(sentimentMode: RoadSentiment) {
    if (sentimentMode !== state.sentimentMode) set({ sentimentMode });
  },

  setEligible(eligible: RoadLesson | null) {
    if (eligible?.appointmentId === state.eligible?.appointmentId) return;
    set({ eligible });
  },

  setRoadEnabled(enabled: boolean) {
    if (enabled !== state.roadEnabled || !state.roadKnown) set({ roadEnabled: enabled, roadKnown: true });
  },

  setPlanAlertsEnabled(enabled: boolean) {
    if (enabled !== state.planAlertsEnabled) set({ planAlertsEnabled: enabled, ...(enabled ? {} : { planAlert: null }) });
  },

  /** La card dell'avviso si chiude (tempo scaduto o tocco). */
  dismissPlanAlert(key?: string) {
    if (!state.planAlert || (key && state.planAlert.key !== key)) return;
    set({ planAlert: null });
  },

  setEvaluationEnabled(enabled: boolean) {
    set({ evaluationEnabled: enabled });
  },

  /** Entra (o rientra) in una sessione attiva. */
  startSession(session: RoadSessionWithLesson) {
    const same = state.session?.id === session.id;
    set({
      phase: 'active',
      session,
      summary: null,
      ...(same
        ? {}
        : {
            track: [],
            distanceMeters: session.distanceMeters ?? 0,
            fix: session.last
              ? {
                  lat: session.last.lat,
                  lng: session.last.lng,
                  speed: session.last.speed,
                  heading: session.last.heading,
                  accuracy: null,
                  t: session.last.at ? new Date(session.last.at).getTime() : Date.now(),
                }
              : null,
            street: session.last?.street ?? null,
            markers: [],
            toast: null,
            planProgress: EMPTY_PROGRESS,
            planAlert: null,
          }),
    });
  },

  /** Ripresa dopo un kill: percorso e segnalazioni già sul server. */
  hydrateFromDetail(detail: RoadDetail) {
    if (state.session?.id !== detail.id) return;
    const serverTrack = detail.track.map(([lat, lng]) => ({ latitude: lat, longitude: lng }));
    const known = new Set(state.markers.map((m) => m.clientId));
    const serverMarkers: RoadLocalMarker[] = detail.markers
      .filter((m) => !known.has(m.clientId))
      .map((m) => ({
        clientId: m.clientId,
        kind: m.kind,
        label: m.label,
        note: m.note,
        lat: m.lat,
        lng: m.lng,
        street: m.street,
        sentiment: m.sentiment ?? null,
        recordedAt: m.recordedAt,
      }));
    const stops = state.session?.plan?.stops ?? [];
    const fromTrack = stops.length ? progressFromTrack(stops, serverTrack) : EMPTY_PROGRESS;
    set({
      planProgress: {
        reached: [...new Set([...state.planProgress.reached, ...fromTrack.reached])],
        alerted: [...new Set([...state.planProgress.alerted, ...fromTrack.alerted])],
      },
      track: [...serverTrack, ...state.track],
      distanceMeters: Math.max(state.distanceMeters, detail.distanceMeters ?? 0),
      markers: [...serverMarkers, ...state.markers].sort(
        (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime(),
      ),
    });
  },

  ingestPoints(points: RoadPoint[]) {
    if (state.phase !== 'active' && state.phase !== 'ending') return;
    let { fix, distanceMeters, planProgress, planAlert } = state;
    const track = state.track.slice();
    const stops = state.planAlertsEnabled ? state.session?.plan?.stops ?? [] : [];
    for (const p of points) {
      const [t, lat, lng, speed, heading, accuracy] = p;
      if (accuracy != null && accuracy > MAX_ACCURACY_M) continue;
      let h = heading;
      if (fix) {
        const d = haversineMeters(fix.lat, fix.lng, lat, lng);
        const dt = Math.max(0.001, (t - fix.t) / 1000);
        if (d / dt > MAX_SPEED_MS) continue;
        distanceMeters += d;
        if ((h == null || h < 0) && d > 3) h = bearingDeg(fix.lat, fix.lng, lat, lng);
      }
      fix = { lat, lng, speed, heading: h ?? fix?.heading ?? null, accuracy, t };
      track.push({ latitude: lat, longitude: lng });
      if (stops.length) {
        if (planAlert && planAlertExpired(planAlert, t)) planAlert = null;
        ({ progress: planProgress, alert: planAlert } = stepPlanAlerts(stops, planProgress, planAlert, { lat, lng, t }));
      }
    }
    set({ fix, distanceMeters, track, planProgress, planAlert });
  },

  setStreet(street: string | null) {
    if (street && street !== state.street) set({ street });
  },

  addMarker(marker: RoadLocalMarker) {
    set({
      markers: [...state.markers, marker],
      toast: {
        clientId: marker.clientId,
        kind: marker.kind,
        label: marker.label,
        street: marker.street,
        sentiment: marker.sentiment,
        at: marker.recordedAt,
      },
    });
  },

  removeMarker(clientId: string) {
    set({
      markers: state.markers.filter((m) => m.clientId !== clientId),
      toast: state.toast?.clientId === clientId ? null : state.toast,
    });
  },

  dismissToast(clientId?: string) {
    if (!state.toast) return;
    if (clientId && state.toast.clientId !== clientId) return;
    set({ toast: null });
  },

  setPhase(phase: RoadPhase) {
    set({ phase });
  },

  showSummary(summary: RoadDetail) {
    set({ phase: 'summary', summary, toast: null, planAlert: null });
  },

  updateSummary(summary: RoadDetail) {
    if (state.summary?.id === summary.id) set({ summary });
  },

  reset() {
    state = { ...INITIAL, catalog: state.catalog, evaluationEnabled: state.evaluationEnabled, eligible: null, roadEnabled: state.roadEnabled, roadKnown: state.roadKnown, planAlertsEnabled: state.planAlertsEnabled };
    listeners.forEach((fn) => fn());
  },
};

/**
 * Tutto lo stato Road: si ridisegna a OGNI cambio, compreso ogni fix GPS
 * (~1 al secondo in guida). Solo per la schermata della mappa dal vivo; altrove
 * `useRoadSelector` (REG-639 fluidità: prima le tab intere si ridisegnavano a
 * ogni fix).
 */
export function useRoadState(): State {
  return useSyncExternalStore(roadStore.subscribe, roadStore.get);
}

/**
 * Una parte dello stato Road: chi la usa si ridisegna solo quando cambia quel
 * valore. Il selettore deve restituire un primitivo o un oggetto già nello
 * stato (mai un oggetto nuovo a ogni chiamata).
 */
export function useRoadSelector<T>(select: (s: State) => T): T {
  return useSyncExternalStore(roadStore.subscribe, () => select(roadStore.get()));
}

export function lessonStudentName(lesson: RoadLesson | null | undefined): string {
  return lesson?.student?.name?.trim() || 'Allievo';
}
