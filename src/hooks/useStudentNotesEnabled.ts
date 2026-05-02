import { useSession } from '../context/SessionContext';
import { useAutoscuolaSettings } from './queries/useAutoscuolaSettings';
import { isStudent as isStudentRole } from '../utils/roles';

type UseStudentNotesEnabledResult = {
  enabled: boolean;
  loading: boolean;
};

export const useStudentNotesEnabled = (): UseStudentNotesEnabledResult => {
  const { autoscuolaRole } = useSession();
  const isStudent = isStudentRole(autoscuolaRole);
  const { data, isLoading } = useAutoscuolaSettings();

  return {
    enabled: isStudent && Boolean(data?.studentNotesEnabled),
    loading: isLoading,
  };
};
