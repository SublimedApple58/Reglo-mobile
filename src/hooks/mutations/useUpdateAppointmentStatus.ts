import { useMutation, useQueryClient } from '@tanstack/react-query';
import { regloApi } from '../../services/regloApi';
import type {
  AutoscuolaAppointment,
  AutoscuolaAppointmentWithRelations,
  UpdateAppointmentStatusInput,
} from '../../types/regloApi';

type StatusUpdateVars = {
  appointmentId: string;
  input: UpdateAppointmentStatusInput;
};

type StatusContext = {
  previousAppointments?: [readonly unknown[], AutoscuolaAppointmentWithRelations[] | undefined][];
};

export const useUpdateAppointmentStatus = () => {
  const queryClient = useQueryClient();

  return useMutation<AutoscuolaAppointment, Error, StatusUpdateVars, StatusContext>({
    mutationFn: ({ appointmentId, input }) =>
      regloApi.updateAppointmentStatus(appointmentId, input),
    onMutate: async ({ appointmentId, input }) => {
      await queryClient.cancelQueries({ queryKey: ['appointments'] });
      await queryClient.cancelQueries({ queryKey: ['agenda-bootstrap'] });

      const queries = queryClient.getQueriesData<AutoscuolaAppointmentWithRelations[]>({
        queryKey: ['appointments'],
      });
      const previousAppointments = queries.map(
        ([key, data]) => [key, data] as [readonly unknown[], AutoscuolaAppointmentWithRelations[] | undefined],
      );

      // Optimistically update status
      for (const [key] of queries) {
        queryClient.setQueryData<AutoscuolaAppointmentWithRelations[]>(key, (old) =>
          old?.map((a) =>
            a.id === appointmentId
              ? { ...a, status: input.status, type: input.lessonType ?? a.type }
              : a,
          ),
        );
      }

      return { previousAppointments };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousAppointments) {
        for (const [key, data] of context.previousAppointments) {
          queryClient.setQueryData(key, data);
        }
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['agenda-bootstrap'] });
    },
  });
};
