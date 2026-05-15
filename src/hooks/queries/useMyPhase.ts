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
    // The phase is the gate to the whole app experience: fetch it every
    // time the hook re-mounts (e.g. when the student switches tab back to
    // home) so the UI catches an owner-side activation without needing
    // an app restart.
    refetchOnMount: 'always',
    // While the student is still AWAITING the activation, poll every 30
    // seconds so the screen flips to TEORIA automatically as soon as the
    // owner grants a seat. Once the student is in any other phase the
    // polling stops to keep the query idle (focusManager + staleTime
    // handle later updates).
    refetchInterval: (query) => {
      const phase = query.state.data?.phase;
      return phase === 'AWAITING' ? 30 * 1000 : false;
    },
  });
};
