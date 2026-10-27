import type { Router } from 'expo-router';
import { regloApi } from '../services/regloApi';
import type { RoadDetail } from '../types/regloApi';
import { roadRouteMapStore } from './routeMapStore';

/**
 * REG-638 — apre il foglio «Percorso Road» di una guida (dettaglio guida e
 * storico dell'allievo nell'app istruttore). Il foglio è registrato negli stack
 * home e notes: si spinge su quello da cui si arriva.
 */
export async function openRoadPercorso(
  router: Router,
  stack: 'home' | 'notes',
  appointmentId: string,
  preloaded?: RoadDetail | null,
): Promise<boolean> {
  const detail = preloaded ?? (await regloApi.getRoadForAppointment(appointmentId).catch(() => null));
  if (!detail) return false;
  roadRouteMapStore.set(detail);
  router.push(`/(tabs)/${stack}/road-percorso`);
  return true;
}
