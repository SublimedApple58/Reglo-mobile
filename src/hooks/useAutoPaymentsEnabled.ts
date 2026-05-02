import { useSession } from '../context/SessionContext';
import { useAutoscuolaSettings } from './queries/useAutoscuolaSettings';
import { isStudent as isStudentRole } from '../utils/roles';

type UseAutoPaymentsEnabledResult = {
  enabled: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
};

export const useAutoPaymentsEnabled = (): UseAutoPaymentsEnabledResult => {
  const { autoscuolaRole } = useSession();
  const isStudent = isStudentRole(autoscuolaRole);
  const { data, isLoading, refetch } = useAutoscuolaSettings();

  return {
    enabled: isStudent && Boolean(data?.autoPaymentsEnabled),
    loading: isLoading,
    refresh: async () => { await refetch(); },
  };
};
