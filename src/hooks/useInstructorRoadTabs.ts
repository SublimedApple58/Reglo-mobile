import { useSession } from '../context/SessionContext';
import { useRoadState } from '../road/roadStore';
import { isInstructor } from '../utils/roles';

/**
 * REG-638 — tab bar dell'app istruttore con Road acceso (scelta B di Tiziano):
 * Home · Disponibilità · Road (al centro, in rilievo) · Allievi · Altro.
 * Le notifiche lasciano la tab bar e passano alla campanella in alto.
 */
export function useInstructorRoadTabs(): boolean {
  const { autoscuolaRole } = useSession();
  const { roadEnabled } = useRoadState();
  return roadEnabled && (isInstructor(autoscuolaRole) || autoscuolaRole === 'INSTRUCTOR_OWNER');
}
