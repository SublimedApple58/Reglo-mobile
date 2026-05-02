import { useQuery } from '@tanstack/react-query';
import { useSession } from '../../context/SessionContext';
import { regloApi } from '../../services/regloApi';
import type { StudentAppointmentPaymentHistoryItem } from '../../types/regloApi';
import { queryKeys, STALE_TIMES } from './queryKeys';

export const usePaymentHistory = (limit: number = 40) => {
  const { activeCompanyId } = useSession();

  return useQuery<StudentAppointmentPaymentHistoryItem[]>({
    queryKey: queryKeys.paymentHistory(activeCompanyId, limit),
    queryFn: () => regloApi.getPaymentHistory(limit),
    enabled: !!activeCompanyId,
    staleTime: STALE_TIMES.paymentHistory,
  });
};
