import { useAutoscuolaSettings } from './queries/useAutoscuolaSettings';

/**
 * REG-638 Reglo Road attivo per l'autoscuola. A differenza degli altri flag
 * (`!== false`), Road nasce spento e vale SOLO `=== true`: un setting assente
 * o non ancora caricato NON accende nulla.
 */
export const useRoadEnabled = (): { enabled: boolean; loading: boolean } => {
  const { data, isLoading } = useAutoscuolaSettings();
  return { enabled: data?.roadEnabled === true, loading: isLoading };
};
