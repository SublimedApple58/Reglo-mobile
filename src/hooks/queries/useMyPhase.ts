import { useQuery } from '@tanstack/react-query';
import { useSession } from '../../context/SessionContext';
import { regloApi } from '../../services/regloApi';
import type { StudentPhasePayload } from '../../types/regloApi';
import { isStudent as isStudentRole } from '../../utils/roles';
import { queryKeys, STALE_TIMES } from './queryKeys';

export const useMyPhase = () => {
  const { activeCompanyId, autoscuolaRole } = useSession();
  const isStudent = isStudentRole(autoscuolaRole);

  return useQuery<StudentPhasePayload>({
    queryKey: queryKeys.studentPhase(activeCompanyId),
    queryFn: () => regloApi.getMyPhase(),
    enabled: !!activeCompanyId && isStudent,
    staleTime: STALE_TIMES.studentPhase,
  });
};
