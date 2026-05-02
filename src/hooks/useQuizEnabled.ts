import { useSession } from '../context/SessionContext';
import { useAutoscuolaSettings } from './queries/useAutoscuolaSettings';
import { isStudent as isStudentRole } from '../utils/roles';

type UseQuizEnabledResult = {
  enabled: boolean;
  loading: boolean;
};

export const useQuizEnabled = (): UseQuizEnabledResult => {
  const { autoscuolaRole } = useSession();
  const isStudent = isStudentRole(autoscuolaRole);
  const { data, isLoading } = useAutoscuolaSettings();

  return {
    enabled: isStudent && Boolean(data?.quizEnabled),
    loading: isLoading,
  };
};
