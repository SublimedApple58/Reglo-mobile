import { useQuery } from '@tanstack/react-query';
import { useSession } from '../../context/SessionContext';
import { regloApi } from '../../services/regloApi';
import type { EvaluationSheetConfig } from '../../types/regloApi';
import { queryKeys, STALE_TIMES } from './queryKeys';

/**
 * Configurazione del pagellino dell'autoscuola (Altro → Pagellino): voci
 * attive in ordine + interruttore. Non serve al foglio "Dettagli guida", che
 * carica voci e punteggi della singola guida in una chiamata dedicata.
 */
export const useEvaluationSheet = () => {
  const { activeCompanyId } = useSession();

  return useQuery<EvaluationSheetConfig>({
    queryKey: queryKeys.evaluationSheet(activeCompanyId),
    queryFn: async () =>
      (await regloApi.getEvaluationSheet()) ?? { enabled: false, items: [] },
    enabled: !!activeCompanyId,
    staleTime: STALE_TIMES.evaluationSheet,
  });
};
