import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../../lib/api';
import { removeListItem } from '../optimisticList';
import { planKeys } from '../queryKeys';
import type { CreateMeasuredPlanInput } from '../../lib/api';
import type { MeasuredPlan } from '../../types';

export function useMeasuredPlans(projectId: string) {
  return useQuery({
    queryKey: planKeys.forProject(projectId),
    queryFn: () => api.plans.list(projectId),
    enabled: projectId.length > 0,
  });
}

export function useCreateMeasuredPlan(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateMeasuredPlanInput) => api.plans.create(projectId, input),
    onSuccess: (created) => {
      queryClient.setQueryData<MeasuredPlan[]>(planKeys.forProject(projectId), (old) => [
        created,
        ...(old ?? []),
      ]);
    },
    onError: (err) => toast.error(`Measured Plan upload failed: ${err.message}`),
  });
}

export function useDeleteMeasuredPlan(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (plan: MeasuredPlan) => api.plans.delete(projectId, plan.id),
    onSuccess: (_data, plan) => {
      queryClient.setQueryData<MeasuredPlan[]>(planKeys.forProject(projectId), (old) =>
        removeListItem(old, plan.id),
      );
    },
    onError: (err) => toast.error(`Measured Plan delete failed: ${err.message}`),
  });
}
