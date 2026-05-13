import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  columnDefsApi,
  type CreateColumnDefInput,
  type UpdateColumnDefInput,
} from '../../lib/api/columnDefs';
import { columnDefKeys } from '../../lib/query';
import type { CustomColumnDef } from '../../types';

export function useColumnDefs(projectId: string, tableType: 'ffe' | 'proposal') {
  return useQuery({
    queryKey: columnDefKeys.forTable(projectId, tableType),
    queryFn: () => columnDefsApi.list(projectId, tableType),
    enabled: Boolean(projectId),
  });
}

export function useCreateColumnDef(projectId: string, tableType: 'ffe' | 'proposal') {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: Omit<CreateColumnDefInput, 'tableType'>) =>
      columnDefsApi.create(projectId, { ...input, tableType }),
    onSuccess: (created) => {
      queryClient.setQueryData<CustomColumnDef[]>(
        columnDefKeys.forTable(projectId, tableType),
        (old) => [...(old ?? []), created],
      );
    },
    onError: () => {
      toast.error('Failed to add column');
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: columnDefKeys.forTable(projectId, tableType) }),
  });
}

export function useUpdateColumnDef(projectId: string, tableType: 'ffe' | 'proposal') {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ defId, patch }: { defId: string; patch: UpdateColumnDefInput }) =>
      columnDefsApi.update(projectId, defId, patch),
    onSuccess: (updated) => {
      queryClient.setQueryData<CustomColumnDef[]>(
        columnDefKeys.forTable(projectId, tableType),
        (old) => old?.map((d) => (d.id === updated.id ? updated : d)) ?? [],
      );
    },
    onError: () => {
      toast.error('Failed to update column');
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: columnDefKeys.forTable(projectId, tableType) }),
  });
}

export function useDeleteColumnDef(projectId: string, tableType: 'ffe' | 'proposal') {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (defId: string) => columnDefsApi.delete(projectId, defId),
    onMutate: async (defId) => {
      await queryClient.cancelQueries({
        queryKey: columnDefKeys.forTable(projectId, tableType),
      });
      const previous = queryClient.getQueryData<CustomColumnDef[]>(
        columnDefKeys.forTable(projectId, tableType),
      );
      queryClient.setQueryData<CustomColumnDef[]>(
        columnDefKeys.forTable(projectId, tableType),
        (old) => old?.filter((d) => d.id !== defId) ?? [],
      );
      return { previous };
    },
    onError: (_err, _defId, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(columnDefKeys.forTable(projectId, tableType), ctx.previous);
      }
      toast.error('Failed to delete column');
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: columnDefKeys.forTable(projectId, tableType) }),
  });
}
