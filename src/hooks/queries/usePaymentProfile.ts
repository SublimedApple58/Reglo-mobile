import { useQuery } from '@tanstack/react-query';
import { useSession } from '../../context/SessionContext';
import { regloApi } from '../../services/regloApi';
import type { MobileStudentPaymentProfile } from '../../types/regloApi';
import { queryKeys, STALE_TIMES } from './queryKeys';

export const usePaymentProfile = () => {
  const { activeCompanyId } = useSession();

  return useQuery<MobileStudentPaymentProfile>({
    queryKey: queryKeys.paymentProfile(activeCompanyId),
    queryFn: () => regloApi.getPaymentProfile(),
    enabled: !!activeCompanyId,
    staleTime: STALE_TIMES.paymentProfile,
  });
};
