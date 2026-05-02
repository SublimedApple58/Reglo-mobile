import { useMutation, useQueryClient } from '@tanstack/react-query';
import { regloApi } from '../../services/regloApi';
import type { CreateAvailabilitySlotsInput, CreateSlotsResult } from '../../types/regloApi';

export const useSaveAvailability = () => {
  const queryClient = useQueryClient();

  return useMutation<CreateSlotsResult, Error, CreateAvailabilitySlotsInput>({
    mutationFn: (input) => regloApi.createAvailabilitySlots(input),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['available-slots'] });
      queryClient.invalidateQueries({ queryKey: ['date-availability'] });
      queryClient.invalidateQueries({ queryKey: ['agenda-bootstrap'] });
    },
  });
};
