import { useMutation, useQueryClient } from '@tanstack/react-query';
import { regloApi } from '../../services/regloApi';
import type {
  AutoscuolaAppointment,
  UpdateAppointmentStatusInput,
} from '../../types/regloApi';

type StatusUpdateVars = {
  appointmentId: string;
  input: UpdateAppointmentStatusInput;
};

export const useUpdateAppointmentStatus = () => {
  const queryClient = useQueryClient();

  return useMutation<AutoscuolaAppointment, Error, StatusUpdateVars>({
    mutationFn: ({ appointmentId, input }) =>
      regloApi.updateAppointmentStatus(appointmentId, input),
    // No optimistic update: the UI refreshes from the backend once the mutation
    // settles. The invalidation is awaited so the caller's spinner stays up
    // until the refetched (true) data is in.
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['appointments'] }),
        queryClient.invalidateQueries({ queryKey: ['agenda-bootstrap'] }),
      ]);
    },
  });
};
