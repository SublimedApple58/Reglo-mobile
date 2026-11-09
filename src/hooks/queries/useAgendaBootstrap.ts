import { useQuery } from '@tanstack/react-query';
import { useSession } from '../../context/SessionContext';
import { getAgendaBootstrapComplete } from '../../services/agendaBootstrapPaged';
import type { AgendaBootstrapParams, AgendaBootstrapPayload } from '../../types/regloApi';
import { queryKeys, STALE_TIMES } from './queryKeys';

export const useAgendaBootstrap = (params: AgendaBootstrapParams | null) => {
  const { activeCompanyId } = useSession();

  return useQuery<AgendaBootstrapPayload>({
    queryKey: queryKeys.agendaBootstrap(activeCompanyId, params as Record<string, unknown>),
    // Tutte le pagine: con «Tutti gli istruttori» il limite per richiesta non taglia più la finestra.
    queryFn: () => getAgendaBootstrapComplete(params!),
    enabled: !!activeCompanyId && !!params,
    staleTime: STALE_TIMES.agendaBootstrap,
  });
};
