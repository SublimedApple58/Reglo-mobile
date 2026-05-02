import { useMutation, useQueryClient } from '@tanstack/react-query';
import { regloApi } from '../../services/regloApi';
import type {
  CreateBookingRequestInput,
  CreateBookingRequestResult,
  AutoscuolaAppointmentWithRelations,
} from '../../types/regloApi';
import { useSession } from '../../context/SessionContext';

export const useBookSlot = () => {
  const queryClient = useQueryClient();
  const { activeCompanyId } = useSession();

  return useMutation<CreateBookingRequestResult, Error, CreateBookingRequestInput>({
    mutationFn: (input) => regloApi.createBookingRequest(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['available-slots'] });
      queryClient.invalidateQueries({ queryKey: ['date-availability'] });
      queryClient.invalidateQueries({ queryKey: ['booking-options'] });
      queryClient.invalidateQueries({ queryKey: ['payment-profile'] });
      queryClient.invalidateQueries({ queryKey: ['payment-history'] });
    },
  });
};
