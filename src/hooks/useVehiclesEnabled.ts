import { useAutoscuolaSettings } from './queries/useAutoscuolaSettings';

type UseVehiclesEnabledResult = {
  enabled: boolean;
  loading: boolean;
};

export const useVehiclesEnabled = (): UseVehiclesEnabledResult => {
  const { data, isLoading } = useAutoscuolaSettings();

  return {
    enabled: data?.vehiclesEnabled !== false,
    loading: isLoading,
  };
};
