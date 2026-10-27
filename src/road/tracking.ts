import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import type { RoadPoint } from '../types/regloApi';
import { roadQueue } from './queue';
import { roadStore } from './roadStore';
import { roadUploader } from './uploader';

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

if (!TaskManager.isTaskDefined(ROAD_LOCATION_TASK)) {
  TaskManager.defineTask<TaskData>(ROAD_LOCATION_TASK, async ({ data, error }) => {
    if (error) return;
    const locations = data?.locations ?? [];
    if (!locations.length) return;
    const points = locations
      .slice()
      .sort((a, b) => a.timestamp - b.timestamp)
      .map(toPoint);
    try {
      await roadQueue.appendPoints(points);
    } catch {
      // la coda su file non deve mai far cadere il task
    }
    roadStore.ingestPoints(points);
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
  await Location.startLocationUpdatesAsync(ROAD_LOCATION_TASK, {
    accuracy: Location.Accuracy.BestForNavigation,
    activityType: Location.ActivityType.AutomotiveNavigation,
    distanceInterval: 8,
    timeInterval: 2000,
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
