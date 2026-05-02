import { useSession } from '../context/SessionContext';
import { useAutoscuolaSettings } from './queries/useAutoscuolaSettings';
import { useBookingOptions } from './queries/useBookingOptions';
import { isStudent as isStudentRole } from '../utils/roles';

type UseSwapEnabledResult = {
  enabled: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
};

export const useSwapEnabled = (): UseSwapEnabledResult => {
  const { autoscuolaRole, user } = useSession();
  const isStudent = isStudentRole(autoscuolaRole);
  const studentId = user?.id ?? null;
  const settings = useAutoscuolaSettings();
  const bookingOpts = useBookingOptions(isStudent ? studentId : null);

  // Prefer cluster-resolved swapEnabled from booking options
  const enabled = isStudent && (
    typeof bookingOpts.data?.swapEnabled === 'boolean'
      ? bookingOpts.data.swapEnabled
      : Boolean(settings.data?.swapEnabled)
  );

  return {
    enabled,
    loading: settings.isLoading || bookingOpts.isLoading,
    refresh: async () => {
      await Promise.all([settings.refetch(), bookingOpts.refetch()]);
    },
  };
};
