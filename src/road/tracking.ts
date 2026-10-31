import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import type { RoadPoint } from '../types/regloApi';
import { roadQueue } from './queue';
import { roadStore } from './roadStore';
import { roadUploader } from './uploader';
import { fixHistory } from './fixHistory';

/**
 * REG-638 Reglo Road — tracking GPS.
 *
 * Il task va definito a livello di modulo e PRIMA che l'app monti (lo importa
 * `entry.ts`): così riceve le posizioni anche in background / schermo spento,
 * quando iOS sveglia l'app per consegnarle. Ogni lotto di posizioni:
 * 1. finisce nella coda su file (punti `[tMs, lat, lng, speed, heading, acc]`);
 * 2. aggiorna lo stato live della mappa (se l'app è viva in primo piano);
 * 3. chiede all'uploader di spedire se è il momento (≥ 40 punti o ≥ 10 s).
 *
 * Permesso: basta «Mentre usi l'app». Il tracking parte in primo piano e,
 * grazie a UIBackgroundModes `location` + indicatore blu, continua in
 * background. Su Android gira come foreground service con notifica.
 */
export const ROAD_LOCATION_TASK = 'reglo-road-location';

type TaskData = { locations?: Location.LocationObject[] };

const toPoint = (l: Location.LocationObject): RoadPoint => {
  const c = l.coords;
  const num = (v: number | null | undefined) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null);
  return [Math.round(l.timestamp), c.latitude, c.longitude, num(c.speed), num(c.heading), num(c.accuracy)];
};

/**
 * REG-698: una sola fonte GPS. Il task consegna i fix a ~1 Hz: la schermata
 * live li ascolta da qui (prima apriva un secondo ascolto `watchPositionAsync`
 * in parallelo); in coda e nei km vanno solo i punti utili (ogni 8 m o 10 s),
 * come prima con `distanceInterval: 8`.
 */
const QUEUE_MIN_M = 8;
const QUEUE_MAX_GAP_MS = 10_000;
let lastQueued: RoadPoint | null = null;
const fixListeners = new Set<(l: Location.LocationObject) => void>();

/** Ogni fix del tracking (anche quelli che non finiscono in coda). */
export function onRoadFix(fn: (l: Location.LocationObject) => void) {
  fixListeners.add(fn);
  return () => {
    fixListeners.delete(fn);
  };
}

function worthQueueing(p: RoadPoint): boolean {
  const prev = lastQueued;
  if (!prev || p[0] - prev[0] >= QUEUE_MAX_GAP_MS) return true;
  const dLat = (p[1] - prev[1]) * 111_320;
  const dLng = (p[2] - prev[2]) * 111_320 * Math.cos((p[1] * Math.PI) / 180);
  return Math.hypot(dLat, dLng) >= QUEUE_MIN_M;
}

if (!TaskManager.isTaskDefined(ROAD_LOCATION_TASK)) {
  TaskManager.defineTask<TaskData>(ROAD_LOCATION_TASK, async ({ data, error }) => {
    if (error) return;
    const locations = data?.locations ?? [];
    if (!locations.length) return;
    const sorted = locations.slice().sort((a, b) => a.timestamp - b.timestamp);
    for (const l of sorted) fixListeners.forEach((fn) => fn(l));
    const points: RoadPoint[] = [];
    for (const l of sorted) {
      const p = toPoint(l);
      if (!worthQueueing(p)) continue;
      lastQueued = p;
      points.push(p);
    }
    if (!points.length) return;
    try {
      await roadQueue.appendPoints(points);
    } catch {
      // la coda su file non deve mai far cadere il task
    }
    roadStore.ingestPoints(points);
    // REG-696: anche a schermo spento si sa dov'era l'auto qualche secondo fa.
    for (const p of points) if (p[5] == null || p[5] <= 50) fixHistory.push(p[1], p[2], p[0]);
    roadUploader.maybeFlush();
  });
}

export async function isRoadTrackingActive(): Promise<boolean> {
  try {
    return await Location.hasStartedLocationUpdatesAsync(ROAD_LOCATION_TASK);
  } catch {
    return false;
  }
}

export async function startRoadTracking(): Promise<void> {
  if (await isRoadTrackingActive()) return;
  lastQueued = null;
  await Location.startLocationUpdatesAsync(ROAD_LOCATION_TASK, {
    accuracy: Location.Accuracy.BestForNavigation,
    activityType: Location.ActivityType.AutomotiveNavigation,
    // REG-698: ~1 Hz (anche la schermata live usa questi fix); in coda si sfoltisce.
    distanceInterval: 0,
    timeInterval: 1000,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'Guida in corso',
      notificationBody: 'Reglo Road registra il percorso',
      notificationColor: '#111111',
      killServiceOnDestroy: false,
    },
  });
}

export async function stopRoadTracking(): Promise<void> {
  try {
    if (await isRoadTrackingActive()) {
      await Location.stopLocationUpdatesAsync(ROAD_LOCATION_TASK);
    }
  } catch {
    // già fermo
  }
}
