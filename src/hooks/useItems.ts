import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, ApiError } from '../lib/api';
import type { CreateItemInput, UpdateItemInput } from '../lib/api';
import type { Item } from '../types';

export const itemKeys = {
  forRoom: (roomId: string) => ['items', roomId] as const,
};

export function useItems(roomId: string) {
  return useQuery({
    queryKey: itemKeys.forRoom(roomId),
    queryFn: () => api.items.list(roomId),
    enabled: Boolean(roomId),
  });
}

export function useCreateItem(roomId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateItemInput) => api.items.create(roomId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: itemKeys.forRoom(roomId) }),
  });
}

export function useUpdateItem(roomId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateItemInput }) =>
      api.items.update(id, patch),

    onMutate: async ({ id, patch }) => {
      // Cancel any in-flight refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: itemKeys.forRoom(roomId) });

      // Snapshot the current value for rollback
      const previous = queryClient.getQueryData<Item[]>(itemKeys.forRoom(roomId));

      // Optimistically apply the update
      queryClient.setQueryData<Item[]>(
        itemKeys.forRoom(roomId),
        (old) => old?.map((i) => (i.id === id ? { ...i, ...patch } : i)) ?? [],
      );

      return { previous };
    },

    onError: (err, _variables, ctx) => {
      // Roll back to the snapshot
      if (ctx?.previous !== undefined) {
        queryClient.setQueryData(itemKeys.forRoom(roomId), ctx.previous);
      }

      if (err instanceof ApiError && err.status === 409) {
        toast.error('This item changed in another tab - reloading');
        void queryClient.invalidateQueries({ queryKey: itemKeys.forRoom(roomId) });
      } else {
        toast.error(`Save failed: ${err.message}`);
      }
    },

    onSettled: () => queryClient.invalidateQueries({ queryKey: itemKeys.forRoom(roomId) }),
  });
}

export function useDeleteItem(roomId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.items.delete(id),
    onSuccess: (_data, id) => {
      queryClient.setQueryData<Item[]>(
        itemKeys.forRoom(roomId),
        (old) => old?.filter((i) => i.id !== id) ?? [],
      );
    },
  });
}
