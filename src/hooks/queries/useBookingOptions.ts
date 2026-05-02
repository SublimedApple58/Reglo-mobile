import { useQuery } from '@tanstack/react-query';
import { useSession } from '../../context/SessionContext';
import { regloApi } from '../../services/regloApi';
import type { MobileBookingOptions } from '../../types/regloApi';
import { queryKeys, STALE_TIMES } from './queryKeys';

export const bookingOptionsQueryKey = queryKeys.bookingOptions;

export const useBookingOptions = (studentId: string | null) => {
  const { activeCompanyId } = useSession();

  return useQuery<MobileBookingOptions>({
    queryKey: queryKeys.bookingOptions(activeCompanyId, studentId),
    queryFn: () => regloApi.getBookingOptions(studentId!),
    enabled: !!activeCompanyId && !!studentId,
    staleTime: STALE_TIMES.bookingOptions,
  });
};
