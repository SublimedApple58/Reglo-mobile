import { useQuery } from '@tanstack/react-query';
import { useSession } from '../../context/SessionContext';
import { regloApi } from '../../services/regloApi';
import { isStudent } from '../../utils/roles';
import { queryKeys, STALE_TIMES } from './queryKeys';

/**
 * REG-802 — le disponibilità a fasce dell'allievo (Profilo › Disponibilità e la
 * riga del Profilo). Letta dal Profilo all'apertura della tab, così la pagina
 * si apre già piena (§15: nessun fetch al tocco).
 */
export const useMyStudentAvailability = () => {
  const { activeCompanyId, autoscuolaRole } = useSession();
  return useQuery({
    queryKey: queryKeys.studentAvailability(activeCompanyId),
    queryFn: () => regloApi.getMyAvailability(),
    enabled: !!activeCompanyId && isStudent(autoscuolaRole),
    staleTime: STALE_TIMES.availability,
  });
};
