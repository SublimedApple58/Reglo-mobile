import { useQuery } from '@tanstack/react-query';
import { useSession } from '../../context/SessionContext';
import { regloApi } from '../../services/regloApi';
import type { AvailableSlot } from '../../types/regloApi';
import { queryKeys, STALE_TIMES } from './queryKeys';

type AvailableSlotsParams = {
  studentId: string;
  date: string;
  durationMinutes: number;
  lessonType?: string;
  instructorId?: string;
};

export const useAvailableSlots = (params: AvailableSlotsParams | null) => {
  const { activeCompanyId } = useSession();

  return useQuery<AvailableSlot[]>({
    queryKey: queryKeys.availableSlots(activeCompanyId, params as Record<string, unknown>),
    queryFn: () => regloApi.getAvailableSlots(params!),
    enabled: !!activeCompanyId && !!params,
    staleTime: STALE_TIMES.availableSlots,
  });
};
