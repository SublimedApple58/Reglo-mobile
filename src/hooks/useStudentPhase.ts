import { useSession } from '../context/SessionContext';
import { useMyPhase } from './queries/useMyPhase';
import { isStudent as isStudentRole } from '../utils/roles';
import type { AutoscuolaStudentPhase } from '../types/regloApi';

type UseStudentPhaseResult = {
  /** Effective phase for the current user. Defaults to PRATICA for students until data loads. Null for non-students. */
  phase: AutoscuolaStudentPhase | null;
  theoryExamAt: string | null;
  drivingExamAt: string | null;
  loading: boolean;
};

export const useStudentPhase = (): UseStudentPhaseResult => {
  const { autoscuolaRole } = useSession();
  const isStudent = isStudentRole(autoscuolaRole);
  const { data, isLoading } = useMyPhase();

  if (!isStudent) {
    return { phase: null, theoryExamAt: null, drivingExamAt: null, loading: false };
  }

  return {
    phase: data?.phase ?? 'PRATICA',
    theoryExamAt: data?.theoryExamAt ?? null,
    drivingExamAt: data?.drivingExamAt ?? null,
    loading: isLoading,
  };
};
