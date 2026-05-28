import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../../lib/api';
import type { CreateFinishInput, UpdateFinishInput } from '../../lib/api';
import type { Finish } from '../../types';
import { finishKeys, imageKeys } from '../../lib/query';
import { appendListItem, removeListItem } from '../optimisticList';

export function useFinishes(projectId: string) {
  return useQuery({
    queryKey: finishKeys.forProject(projectId),
    queryFn: () => api.finishes.list(projectId),
    enabled: Boolean(projectId),
  });
}

export function useCreateFinish(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateFinishInput) => api.finishes.create(projectId, input),
    onSuccess: (finish) => {
      queryClient.setQueryData<Finish[]>(finishKeys.forProject(projectId), (old) =>
        appendListItem(old, finish),
      );
    },
    onError: (err) => toast.error(`Finish create failed: ${err.message}`),
  });
}

export function useUpdateFinish(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateFinishInput }) =>
      api.finishes.update(id, patch),
    onSuccess: (finish) => {
      queryClient.setQueryData<Finish[]>(finishKeys.forProject(projectId), (old) =>
        upsertFinish(old, finish),
      );
    },
    onError: (err) => toast.error(`Finish update failed: ${err.message}`),
  });
}

export function useDeleteFinish(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.finishes.delete(id),
    onSuccess: (_data, id) => {
      queryClient.setQueryData<Finish[]>(finishKeys.forProject(projectId), (old) =>
        removeListItem(old, id),
      );
      void queryClient.removeQueries({ queryKey: imageKeys.forEntity('finish', id) });
    },
    onError: (err) => toast.error(`Finish delete failed: ${err.message}`),
  });
}

function upsertFinish(list: Finish[] | undefined, finish: Finish): Finish[] {
  if (!list) return [finish];
  const idx = list.findIndex((f) => f.id === finish.id);
  if (idx === -1) return appendListItem(list, finish);
  return list.map((f) => (f.id === finish.id ? finish : f));
}
