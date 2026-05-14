import { useSession } from '../context/SessionContext';
import { useMyPhase } from './queries/useMyPhase';
import { isStudent as isStudentRole } from '../utils/roles';
import type { AutoscuolaStudentPhase } from '../types/regloApi';

type UseStudentPhaseResult = {
  /** Effective phase for the current user. Defaults to PRATICA for students until data loads. Null for non-students. */
  phase: AutoscuolaStudentPhase | null;
  theoryExamAt: string | null;
  drivingExamAt: string | null;
  /**
   * Phases the autoscuola has enabled. Defaults to ['PRATICA'] (legacy) when
   * the backend response does not carry the field. Null for non-students.
   */
  phasesEnabled: Array<'TEORIA' | 'PRATICA'> | null;
  /**
   * Whether the student has been granted a nominal quiz license seat.
   * Drives the quiz tab visibility. False until data loads or for non-students.
   */
  hasQuizAccess: boolean;
  /**
   * Whether the autoscuola auto-assigns a quiz seat to every new sign-up.
   * Read-only from mobile (managed by the owner). False for non-students.
   */
  autoAssignQuizOnSignup: boolean;
  loading: boolean;
};

export const useStudentPhase = (): UseStudentPhaseResult => {
  const { autoscuolaRole } = useSession();
  const isStudent = isStudentRole(autoscuolaRole);
  const { data, isLoading } = useMyPhase();

  if (!isStudent) {
    return {
      phase: null,
      theoryExamAt: null,
      drivingExamAt: null,
      phasesEnabled: null,
      hasQuizAccess: false,
      autoAssignQuizOnSignup: false,
      loading: false,
    };
  }

  return {
    phase: data?.phase ?? 'PRATICA',
    theoryExamAt: data?.theoryExamAt ?? null,
    drivingExamAt: data?.drivingExamAt ?? null,
    phasesEnabled: data?.phasesEnabled ?? ['PRATICA'],
    hasQuizAccess: Boolean(data?.hasQuizAccess),
    autoAssignQuizOnSignup: Boolean(data?.autoAssignQuizOnSignup),
    loading: isLoading,
  };
};
