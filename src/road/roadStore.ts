import { useSyncExternalStore } from 'react';
import type {
  RoadCatalog,
  RoadDetail,
  RoadHotspotOutcome,
  RoadLesson,
  RoadPlanStop,
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
import { INITIAL_REROUTE, remainingStops, stepReroute, type RerouteState } from './reroute';
import { advanceOnLine, type RoadGuide } from './roadGuide';
import { EMPTY_HOTSPOT_WATCH, stepHotspotWatch, type HotspotWatch } from './navGuide';

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
  /**
   * REG-696: l'altra posizione possibile («qui» se la segnalazione è stata
   * rimessa dov'era l'auto qualche secondo prima, e viceversa).
   */
  alt?: { lat: number; lng: number; recordedAt: string } | null;
  /** Secondi tra il punto retrodatato e il tocco (null = nessuna differenza utile). */
  retroSec?: number | null;
  placed?: 'retro' | 'here';
};

export type RoadSentiment = 'good' | 'bad';

export type RoadToast = {
  clientId: string;
  kind: string;
  label: string;
  street: string | null;
  sentiment: RoadSentiment | null;
  at: string;
  /** REG-696: «N s fa / Qui» (null = posizione unica). */
  retroSec: number | null;
  placed: 'retro' | 'here';
  /** Cambia a ogni spostamento: il toast resta altri 5 s. */
  rev: number;
};

export type RoadPhase = 'idle' | 'active' | 'ending' | 'summary';

/** REG-681: un ripasso sul punto critico fatto in questa guida. */
export type RoadLocalCheck = {
  clientId: string;
  hotspotKey: string;
  kind: string;
  label: string;
  outcome: RoadHotspotOutcome;
  recordedAt: string;
};

type State = {
  phase: RoadPhase;
  session: RoadSessionWithLesson | null;
  catalog: RoadCatalog;
  track: Array<{ latitude: number; longitude: number }>;
  distanceMeters: number;
  /** Salti impossibili di fila rispetto all'ultimo fix (REG-693). */
  spikes: number;
  fix: RoadFix | null;
  street: string | null;
  markers: RoadLocalMarker[];
  toast: RoadToast | null;
  summary: RoadDetail | null;
  /** REG-691: ultimi punti della guida chiusa ancora in invio (i km si aggiornano dopo). */
  summarySyncing: boolean;
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
  /** REG-652: linea suggerita, tappe in ordine, sede, punti dell'allievo. */
  guide: RoadGuide | null;
  /** REG-652: fin dove la linea è già percorsa (indice di vertice, solo avanti). */
  guidePassed: number;
  /** REG-654: fuori percorso, ultimo ricalcolo, tappe lasciate perdere. */
  reroute: RerouteState;
  /** REG-681: la card del punto critico che si avvicina (una alla volta). */
  hotspotWatch: HotspotWatch;
  /** REG-681: i ripassi fatti in questa guida («Meglio» / «Ancora no»). */
  checks: RoadLocalCheck[];
};

/** REG-654: il ricalcolo da chiedere (lo fa la schermata Road, lo store non va in rete). */
export type RerouteRequest = {
  sessionId: string;
  start: { lat: number; lng: number };
  stops: RoadPlanStop[];
};
let rerouteHandler: ((req: RerouteRequest) => void) | null = null;

const INITIAL: State = {
  phase: 'idle',
  session: null,
  catalog: { base: FALLBACK_BASE_CATALOG, custom: [] },
  track: [],
  distanceMeters: 0,
  spikes: 0,
  fix: null,
  street: null,
  markers: [],
  toast: null,
  summary: null,
  summarySyncing: false,
  evaluationEnabled: false,
  eligible: null,
  roadEnabled: false,
  roadKnown: false,
  sentimentMode: 'bad',
  planAlertsEnabled: true,
  planProgress: EMPTY_PROGRESS,
  planAlert: null,
  guide: null,
  guidePassed: 0,
  reroute: INITIAL_REROUTE,
  hotspotWatch: EMPTY_HOTSPOT_WATCH,
  checks: [],
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
/** Dopo tanti salti di fila il riferimento era sbagliato: si riparte dal punto nuovo. */
const MAX_SPIKES = 3;

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

  /** REG-652: arriva (anche a pezzi) la guida della sessione attiva. */
  setGuide(guide: RoadGuide) {
    if (state.session?.id !== guide.sessionId) return;
    const sameLine = state.guide?.line === guide.line;
    set({ guide, ...(sameLine ? {} : { guidePassed: 0 }) });
  },

  /** REG-654: chi chiede il ricalcolo (la schermata Road, finché è montata). */
  setRerouteHandler(fn: ((req: RerouteRequest) => void) | null) {
    rerouteHandler = fn;
  },

  /** REG-654: la linea riagganciata. Null (rete o Google giù) = resta la vecchia. */
  applyReroute(
    sessionId: string,
    route: { line: Array<[number, number]> | null; end: { lat: number; lng: number } | null; steps?: RoadGuide['steps'] } | null,
  ) {
    if (state.session?.id !== sessionId || !state.guide) return;
    const reroute = { ...state.reroute, pending: false };
    if (!route?.line || route.line.length < 2) {
      set({ reroute });
      return;
    }
    set({
      guide: { ...state.guide, line: route.line, end: route.end, steps: route.steps ?? [] },
      guidePassed: 0,
      reroute: { ...reroute, offSince: null },
    });
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
            spikes: 0,
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
            guide: null,
            guidePassed: 0,
            reroute: INITIAL_REROUTE,
            hotspotWatch: EMPTY_HOTSPOT_WATCH,
            checks: [],
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
    const knownChecks = new Set(state.checks.map((c) => c.clientId));
    const serverChecks: RoadLocalCheck[] = (detail.hotspotChecks ?? [])
      .filter((c) => !knownChecks.has(c.clientId))
      .map((c) => ({
        clientId: c.clientId,
        hotspotKey: c.hotspotKey ?? '',
        kind: c.kind,
        label: c.label,
        outcome: c.outcome,
        recordedAt: c.recordedAt,
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
      checks: [...serverChecks, ...state.checks],
    });
  },

  ingestPoints(points: RoadPoint[]) {
    if (state.phase !== 'active' && state.phase !== 'ending') return;
    let { fix, distanceMeters, planProgress, planAlert, guidePassed, reroute, hotspotWatch, spikes } = state;
    const hotspots = state.guide?.hotspots ?? [];
    let request: RerouteRequest | null = null;
    const track = state.track.slice();
    // Le tappe nell'ordine della linea (REG-652), così il numero dell'avviso è quello sulla mappa.
    // Le tappe raggiunte si contano anche con gli avvisi spenti (servono al riaggancio, REG-654).
    const stops = state.guide?.stops ?? state.session?.plan?.stops ?? [];
    const alertsOn = state.planAlertsEnabled;
    const line = state.guide?.line ?? null;
    const guideStops = state.guide?.stops ?? [];
    for (const p of points) {
      const [t, lat, lng, speed, heading, accuracy] = p;
      if (accuracy != null && accuracy > MAX_ACCURACY_M) continue;
      let h = heading;
      if (fix) {
        const d = haversineMeters(fix.lat, fix.lng, lat, lng);
        const dt = Math.max(0.001, (t - fix.t) / 1000);
        if (d / dt > MAX_SPEED_MS) {
          // REG-693: un salto isolato è un fix sbagliato e si scarta. Ma se i
          // salti continuano è il riferimento a essere sbagliato (era lui il
          // fix fuori posto): si riparte dal punto nuovo senza contare la
          // distanza, altrimenti km e linea restavano fermi fino alla fine.
          spikes += 1;
          if (spikes < MAX_SPIKES) continue;
          spikes = 0;
          fix = { lat, lng, speed, heading: heading ?? null, accuracy, t };
          track.push({ latitude: lat, longitude: lng });
          continue;
        }
        spikes = 0;
        distanceMeters += d;
        if ((h == null || h < 0) && d > 3) h = bearingDeg(fix.lat, fix.lng, lat, lng);
      }
      fix = { lat, lng, speed, heading: h ?? fix?.heading ?? null, accuracy, t };
      track.push({ latitude: lat, longitude: lng });
      // La finestra «com'è andata» si misura con l'orologio del telefono (lo
      // stesso del timer della schermata): il tempo dei punti GPS può essere
      // su un'altra base (punti arrivati in ritardo, simulatore).
      if (hotspots.length) hotspotWatch = stepHotspotWatch(hotspotWatch, hotspots, { lat, lng, t: Date.now() });
      if (stops.length) {
        if (planAlert && planAlertExpired(planAlert, t)) planAlert = null;
        ({ progress: planProgress, alert: planAlert } = stepPlanAlerts(stops, planProgress, planAlert, { lat, lng, t }));
        if (!alertsOn) planAlert = null;
      }
      if (line) {
        guidePassed = advanceOnLine(line, guidePassed, { lat, lng });
        const step = stepReroute(reroute, { lat, lng, t }, {
          line,
          passed: guidePassed,
          stops: guideStops,
          reached: planProgress.reached,
          end: state.guide?.end ?? null,
        });
        reroute = step.state;
        if (step.request && state.session && rerouteHandler) {
          request = {
            sessionId: state.session.id,
            start: { lat, lng },
            stops: remainingStops(guideStops, planProgress.reached, reroute.skipped),
          };
        } else if (step.request) {
          reroute = { ...reroute, pending: false };
        }
      }
    }
    set({ fix, distanceMeters, track, planProgress, planAlert, guidePassed, reroute, hotspotWatch, spikes });
    if (request) rerouteHandler?.(request);
  },

  /** REG-681: la card del punto critico si chiude (tempo scaduto, tocco, ripasso segnato). */
  closeHotspotAlert(key?: string) {
    const cur = state.hotspotWatch.alert;
    if (!cur || (key && cur.hotspot.key !== key)) return;
    set({ hotspotWatch: { ...state.hotspotWatch, alert: null } });
  },

  /**
   * REG-681: «Meglio» / «Ancora no» toccato (la card resta col «Segnato») o
   * annullato (si torna a chiedere, con altri 20 s per decidere).
   */
  markHotspotDecided(key: string, decided: boolean) {
    const cur = state.hotspotWatch.alert;
    if (!cur || cur.hotspot.key !== key) return;
    const alert = decided ? { ...cur, decided: true } : { ...cur, decided: false, phase: 'decide' as const, leftAt: Date.now() };
    set({ hotspotWatch: { ...state.hotspotWatch, alert } });
  },

  addCheck(check: RoadLocalCheck) {
    set({ checks: [...state.checks.filter((c) => c.clientId !== check.clientId), check] });
  },

  removeCheck(clientId: string) {
    set({ checks: state.checks.filter((c) => c.clientId !== clientId) });
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
        retroSec: marker.retroSec ?? null,
        placed: marker.placed ?? 'here',
        rev: 0,
      },
    });
  },

  /** REG-696: «qui / N s fa» — la segnalazione passa all'altra posizione. */
  swapMarkerPlace(clientId: string) {
    const m = state.markers.find((x) => x.clientId === clientId);
    if (!m?.alt) return null;
    const next: RoadLocalMarker = {
      ...m,
      lat: m.alt.lat,
      lng: m.alt.lng,
      recordedAt: m.alt.recordedAt,
      alt: { lat: m.lat, lng: m.lng, recordedAt: m.recordedAt },
      placed: m.placed === 'retro' ? 'here' : 'retro',
    };
    set({
      markers: state.markers.map((x) => (x.clientId === clientId ? next : x)),
      toast:
        state.toast?.clientId === clientId
          ? { ...state.toast, placed: next.placed ?? 'here', at: next.recordedAt, rev: state.toast.rev + 1 }
          : state.toast,
    });
    return next;
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

  showSummary(summary: RoadDetail, syncing = false) {
    set({ phase: 'summary', summary, summarySyncing: syncing, toast: null, planAlert: null, hotspotWatch: EMPTY_HOTSPOT_WATCH });
  },

  updateSummary(summary: RoadDetail, syncing?: boolean) {
    if (state.summary?.id === summary.id) set({ summary, ...(syncing === undefined ? {} : { summarySyncing: syncing }) });
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
