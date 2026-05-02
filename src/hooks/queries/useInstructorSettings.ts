import { useQuery } from '@tanstack/react-query';
import { useSession } from '../../context/SessionContext';
import { regloApi } from '../../services/regloApi';
import { queryKeys, STALE_TIMES } from './queryKeys';

type InstructorSettingsData = Awaited<ReturnType<typeof regloApi.getInstructorSettings>>;

export const useInstructorSettings = () => {
  const { activeCompanyId } = useSession();

  return useQuery<InstructorSettingsData>({
    queryKey: queryKeys.instructorSettings(activeCompanyId),
    queryFn: () => regloApi.getInstructorSettings(),
    enabled: !!activeCompanyId,
    staleTime: STALE_TIMES.instructorSettings,
  });
};
