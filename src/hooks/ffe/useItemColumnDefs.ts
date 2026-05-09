import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  columnDefsApi,
  type CreateItemColumnDefInput,
  type UpdateItemColumnDefInput,
} from '../../lib/api/columnDefs';
import { columnDefKeys } from '../queryKeys';
import type { ItemColumnDef } from '../../types';

export function useItemColumnDefs(projectId: string) {
  return useQuery({
    queryKey: columnDefKeys.forProject(projectId),
    queryFn: () => columnDefsApi.list(projectId),
    enabled: Boolean(projectId),
  });
}

export function useCreateItemColumnDef(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateItemColumnDefInput) => columnDefsApi.create(projectId, input),
    onSuccess: (created) => {
      queryClient.setQueryData<ItemColumnDef[]>(columnDefKeys.forProject(projectId), (old) => [
        ...(old ?? []),
        created,
      ]);
    },
    onError: () => {
      toast.error('Failed to add column');
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: columnDefKeys.forProject(projectId) }),
  });
}

export function useUpdateItemColumnDef(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ defId, patch }: { defId: string; patch: UpdateItemColumnDefInput }) =>
      columnDefsApi.update(projectId, defId, patch),
    onSuccess: (updated) => {
      queryClient.setQueryData<ItemColumnDef[]>(
        columnDefKeys.forProject(projectId),
        (old) => old?.map((d) => (d.id === updated.id ? updated : d)) ?? [],
      );
    },
    onError: () => {
      toast.error('Failed to update column');
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: columnDefKeys.forProject(projectId) }),
  });
}

export function useDeleteItemColumnDef(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (defId: string) => columnDefsApi.delete(projectId, defId),
    onMutate: async (defId) => {
      await queryClient.cancelQueries({ queryKey: columnDefKeys.forProject(projectId) });
      const previous = queryClient.getQueryData<ItemColumnDef[]>(
        columnDefKeys.forProject(projectId),
      );
      queryClient.setQueryData<ItemColumnDef[]>(
        columnDefKeys.forProject(projectId),
        (old) => old?.filter((d) => d.id !== defId) ?? [],
      );
      return { previous };
    },
    onError: (_err, _defId, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(columnDefKeys.forProject(projectId), ctx.previous);
      }
      toast.error('Failed to delete column');
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: columnDefKeys.forProject(projectId) }),
  });
}
