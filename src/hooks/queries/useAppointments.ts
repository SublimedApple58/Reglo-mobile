import { useQuery } from '@tanstack/react-query';
import { useSession } from '../../context/SessionContext';
import { regloApi } from '../../services/regloApi';
import type { AutoscuolaAppointmentWithRelations, GetAppointmentsParams } from '../../types/regloApi';
import { queryKeys, STALE_TIMES } from './queryKeys';

export const useAppointments = (params: GetAppointmentsParams | null) => {
  const { activeCompanyId } = useSession();

  return useQuery<AutoscuolaAppointmentWithRelations[]>({
    queryKey: queryKeys.appointments(activeCompanyId, params as Record<string, unknown>),
    queryFn: () => regloApi.getAppointments(params!),
    enabled: !!activeCompanyId && !!params,
    staleTime: STALE_TIMES.appointments,
  });
};
