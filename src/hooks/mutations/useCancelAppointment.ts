import { useMutation, useQueryClient } from '@tanstack/react-query';
import { regloApi } from '../../services/regloApi';
import type { CancelAppointmentResult } from '../../types/regloApi';

export const useCancelAppointment = () => {
  const queryClient = useQueryClient();

  return useMutation<CancelAppointmentResult, Error, string>({
    mutationFn: (appointmentId) => regloApi.cancelAppointment(appointmentId),
    // No optimistic update: refresh from the backend after the cancel settles.
    // The invalidation is awaited so the caller's spinner stays up until the
    // refetched (true) data is in.
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['appointments'] }),
        queryClient.invalidateQueries({ queryKey: ['date-availability'] }),
        queryClient.invalidateQueries({ queryKey: ['agenda-bootstrap'] }),
        queryClient.invalidateQueries({ queryKey: ['payment-profile'] }),
        queryClient.invalidateQueries({ queryKey: ['payment-history'] }),
      ]);
    },
  });
};
