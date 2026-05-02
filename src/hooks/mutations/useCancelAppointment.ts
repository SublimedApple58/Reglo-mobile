import { useMutation, useQueryClient } from '@tanstack/react-query';
import { regloApi } from '../../services/regloApi';
import type {
  CancelAppointmentResult,
  AutoscuolaAppointmentWithRelations,
} from '../../types/regloApi';

type CancelContext = {
  previousAppointments?: [readonly unknown[], AutoscuolaAppointmentWithRelations[] | undefined][];
};

export const useCancelAppointment = () => {
  const queryClient = useQueryClient();

  return useMutation<CancelAppointmentResult, Error, string, CancelContext>({
    mutationFn: (appointmentId) => regloApi.cancelAppointment(appointmentId),
    onMutate: async (appointmentId) => {
      await queryClient.cancelQueries({ queryKey: ['appointments'] });

      const queries = queryClient.getQueriesData<AutoscuolaAppointmentWithRelations[]>({
        queryKey: ['appointments'],
      });
      const previousAppointments = queries.map(
        ([key, data]) => [key, data] as [readonly unknown[], AutoscuolaAppointmentWithRelations[] | undefined],
      );

      // Optimistically mark as cancelled (not remove — avoids flash on refetch)
      for (const [key] of queries) {
        queryClient.setQueryData<AutoscuolaAppointmentWithRelations[]>(key, (old) =>
          old?.map((a) =>
            a.id === appointmentId ? { ...a, status: 'cancelled' } : a,
          ),
        );
      }

      return { previousAppointments };
    },
    onError: (_err, _appointmentId, context) => {
      if (context?.previousAppointments) {
        for (const [key, data] of context.previousAppointments) {
          queryClient.setQueryData(key, data);
        }
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['date-availability'] });
      queryClient.invalidateQueries({ queryKey: ['agenda-bootstrap'] });
      queryClient.invalidateQueries({ queryKey: ['payment-profile'] });
      queryClient.invalidateQueries({ queryKey: ['payment-history'] });
    },
  });
};
