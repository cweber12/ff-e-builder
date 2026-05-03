import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, ApiError } from '../../lib/api';
import { recordItemCreated } from '../../lib/telemetry';
import type { CreateItemInput, UpdateItemInput } from '../../lib/api';
import type { Item } from '../../types';

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
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: itemKeys.forRoom(roomId) });
      const previous = queryClient.getQueryData<Item[]>(itemKeys.forRoom(roomId));
      const optimisticItem: Item = {
        id: `optimistic-${crypto.randomUUID()}`,
        roomId,
        itemName: input.itemName,
        category: input.category ?? null,
        vendor: input.vendor ?? null,
        model: input.model ?? null,
        itemIdTag: input.itemIdTag ?? null,
        dimensions: input.dimensions ?? null,
        seatHeight: input.seatHeight ?? null,
        finishes: input.finishes ?? null,
        notes: input.notes ?? null,
        qty: input.qty ?? 1,
        unitCostCents: input.unitCostCents ?? 0,
        markupPct: input.markupPct ?? 0,
        leadTime: input.leadTime ?? null,
        status: input.status ?? 'pending',
        imageUrl: input.imageUrl ?? null,
        linkUrl: input.linkUrl ?? null,
        sortOrder: input.sortOrder ?? previous?.length ?? 0,
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        materials: [],
      };
      queryClient.setQueryData<Item[]>(itemKeys.forRoom(roomId), (old) => [
        ...(old ?? []),
        optimisticItem,
      ]);
      return { previous, optimisticId: optimisticItem.id };
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.previous !== undefined) {
        queryClient.setQueryData(itemKeys.forRoom(roomId), ctx.previous);
      }
    },
    onSuccess: (created, _input, ctx) => {
      recordItemCreated();
      queryClient.setQueryData<Item[]>(
        itemKeys.forRoom(roomId),
        (old) => old?.map((item) => (item.id === ctx?.optimisticId ? created : item)) ?? [created],
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: itemKeys.forRoom(roomId) }),
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
        (old) =>
          old?.map((i) =>
            i.id === id
              ? {
                  ...i,
                  ...patch,
                  roomId: patch.roomId ?? i.roomId,
                }
              : i,
          ) ?? [],
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
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: itemKeys.forRoom(roomId) });
      const previous = queryClient.getQueryData<Item[]>(itemKeys.forRoom(roomId));
      queryClient.setQueryData<Item[]>(
        itemKeys.forRoom(roomId),
        (old) => old?.filter((i) => i.id !== id) ?? [],
      );
      return { previous };
    },
    onError: (err, _id, ctx) => {
      if (ctx?.previous !== undefined) {
        queryClient.setQueryData(itemKeys.forRoom(roomId), ctx.previous);
      }
      toast.error(`Delete failed: ${err.message}`);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: itemKeys.forRoom(roomId) }),
  });
}

export function useMoveItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      toRoomId,
      version,
    }: {
      id: string;
      fromRoomId: string;
      toRoomId: string;
      version: number;
    }) => api.items.update(id, { roomId: toRoomId, version }),
    onMutate: async ({ id, fromRoomId, toRoomId }) => {
      await queryClient.cancelQueries({ queryKey: itemKeys.forRoom(fromRoomId) });
      await queryClient.cancelQueries({ queryKey: itemKeys.forRoom(toRoomId) });
      const previousFrom = queryClient.getQueryData<Item[]>(itemKeys.forRoom(fromRoomId));
      const previousTo = queryClient.getQueryData<Item[]>(itemKeys.forRoom(toRoomId));
      const itemToMove = previousFrom?.find((item) => item.id === id);

      queryClient.setQueryData<Item[]>(
        itemKeys.forRoom(fromRoomId),
        (old) => old?.filter((item) => item.id !== id) ?? [],
      );

      if (itemToMove) {
        queryClient.setQueryData<Item[]>(itemKeys.forRoom(toRoomId), (old) => [
          ...(old ?? []),
          { ...itemToMove, roomId: toRoomId },
        ]);
      }

      return { previousFrom, previousTo };
    },
    onError: (_err, variables, ctx) => {
      if (ctx?.previousFrom !== undefined) {
        queryClient.setQueryData(itemKeys.forRoom(variables.fromRoomId), ctx.previousFrom);
      }
      if (ctx?.previousTo !== undefined) {
        queryClient.setQueryData(itemKeys.forRoom(variables.toRoomId), ctx.previousTo);
      }
    },
    onSettled: (_data, _error, variables) => {
      void queryClient.invalidateQueries({ queryKey: itemKeys.forRoom(variables.fromRoomId) });
      void queryClient.invalidateQueries({ queryKey: itemKeys.forRoom(variables.toRoomId) });
    },
  });
}
