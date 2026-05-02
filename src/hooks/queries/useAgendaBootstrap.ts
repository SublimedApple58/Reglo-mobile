import { useQuery } from '@tanstack/react-query';
import { useSession } from '../../context/SessionContext';
import { regloApi } from '../../services/regloApi';
import type { AgendaBootstrapParams, AgendaBootstrapPayload } from '../../types/regloApi';
import { queryKeys, STALE_TIMES } from './queryKeys';

export const useAgendaBootstrap = (params: AgendaBootstrapParams | null) => {
  const { activeCompanyId } = useSession();

  return useQuery<AgendaBootstrapPayload>({
    queryKey: queryKeys.agendaBootstrap(activeCompanyId, params as Record<string, unknown>),
    queryFn: () => regloApi.getAgendaBootstrap(params!),
    enabled: !!activeCompanyId && !!params,
    staleTime: STALE_TIMES.agendaBootstrap,
  });
};
