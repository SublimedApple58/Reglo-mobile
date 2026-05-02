import { useQuery } from '@tanstack/react-query';
import { useSession } from '../../context/SessionContext';
import { regloApi } from '../../services/regloApi';
import type { AutoscuolaHoliday } from '../../types/regloApi';
import { queryKeys, STALE_TIMES } from './queryKeys';

export const useHolidays = (params: { from: string; to: string } | null) => {
  const { activeCompanyId } = useSession();

  return useQuery<AutoscuolaHoliday[]>({
    queryKey: queryKeys.holidays(activeCompanyId, params as Record<string, unknown>),
    queryFn: () => regloApi.getHolidays(params!),
    enabled: !!activeCompanyId && !!params,
    staleTime: STALE_TIMES.holidays,
  });
};
