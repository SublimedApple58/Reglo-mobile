import { useSession } from '../context/SessionContext';
import { useRoadState } from '../road/roadStore';
import { isInstructor } from '../utils/roles';

/**
 * REG-638 — tab bar dell'istruttore (anche titolare-istruttore), «T1 piatta»
 * scelta da Tiziano: Agenda · Road · Allievi · Tu. Road solo con Road acceso.
 * Disponibilità e Notifiche escono dalla barra: orologio e campanella
 * nell'intestazione dell'Agenda.
 */
export function useInstructorTabs(): { instructorApp: boolean; showRoad: boolean } {
  const { autoscuolaRole } = useSession();
  const { roadEnabled } = useRoadState();
  const instructorApp = isInstructor(autoscuolaRole);
  return { instructorApp, showRoad: instructorApp && roadEnabled };
}
