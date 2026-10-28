import { useSession } from '../context/SessionContext';
import { useRoadSelector } from '../road/roadStore';
import { isInstructor } from '../utils/roles';
import { useRoadEnabled } from './useRoadEnabled';

/**
 * REG-638 — tab bar dell'istruttore (anche titolare-istruttore), «T1 piatta»
 * scelta da Tiziano: Agenda · Road · Allievi · Tu. Road solo con Road acceso.
 * Disponibilità e Notifiche escono dalla barra: orologio e campanella
 * nell'intestazione dell'Agenda.
 */
export function useInstructorTabs(): { instructorApp: boolean; showRoad: boolean } {
  const { autoscuolaRole } = useSession();
  const roadEnabled = useRoadSelector((s) => s.roadEnabled);
  const roadKnown = useRoadSelector((s) => s.roadKnown);
  // Giro Road (Tiziano 28/10): niente tab che compare di botto. Finché
  // `/road/state` non risponde vale l'ultimo stato noto, cioè le impostazioni
  // dell'autoscuola persistite su disco (stesso servizio Road); al primo avvio
  // senza cache il velo di caricamento (`AuthGate`) aspetta le impostazioni.
  const { enabled: cachedRoad } = useRoadEnabled();
  const instructorApp = isInstructor(autoscuolaRole);
  return { instructorApp, showRoad: instructorApp && (roadKnown ? roadEnabled : cachedRoad) };
}
