import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, ApiError } from '../../lib/api';
import { recordItemCreated } from '../../lib/telemetry';
import { itemKeys } from '../queryKeys';
import {
  appendListItem,
  removeListItem,
  replaceListItem,
  restoreQueryList,
  snapshotQueryList,
  updateListItem,
} from '../optimisticList';
import type { CreateItemInput, UpdateItemInput } from '../../lib/api';
import type { Item } from '../../types';

export { itemKeys } from '../queryKeys';

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
      const queryKey = itemKeys.forRoom(roomId);
      const previous = await snapshotQueryList<Item>(queryClient, queryKey);
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
      queryClient.setQueryData<Item[]>(queryKey, (old) => appendListItem(old, optimisticItem));
      return { previous, optimisticId: optimisticItem.id };
    },
    onError: (_err, _input, ctx) => {
      restoreQueryList(queryClient, itemKeys.forRoom(roomId), ctx?.previous);
    },
    onSuccess: (created, _input, ctx) => {
      recordItemCreated();
      queryClient.setQueryData<Item[]>(itemKeys.forRoom(roomId), (old) =>
        replaceListItem(old, ctx?.optimisticId, created),
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
      const queryKey = itemKeys.forRoom(roomId);
      const previous = await snapshotQueryList<Item>(queryClient, queryKey);

      queryClient.setQueryData<Item[]>(queryKey, (old) =>
        updateListItem(old, id, (item) => ({
          ...item,
          ...patch,
          roomId: patch.roomId ?? item.roomId,
        })),
      );

      return { previous };
    },

    onError: (err, _variables, ctx) => {
      restoreQueryList(queryClient, itemKeys.forRoom(roomId), ctx?.previous);

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
      const queryKey = itemKeys.forRoom(roomId);
      const previous = await snapshotQueryList<Item>(queryClient, queryKey);
      queryClient.setQueryData<Item[]>(queryKey, (old) => removeListItem(old, id));
      return { previous };
    },
    onError: (err, _id, ctx) => {
      restoreQueryList(queryClient, itemKeys.forRoom(roomId), ctx?.previous);
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
      const fromQueryKey = itemKeys.forRoom(fromRoomId);
      const toQueryKey = itemKeys.forRoom(toRoomId);
      const previousFrom = await snapshotQueryList<Item>(queryClient, fromQueryKey);
      const previousTo = await snapshotQueryList<Item>(queryClient, toQueryKey);
      const itemToMove = previousFrom?.find((item) => item.id === id);

      queryClient.setQueryData<Item[]>(fromQueryKey, (old) => removeListItem(old, id));

      if (itemToMove) {
        queryClient.setQueryData<Item[]>(toQueryKey, (old) =>
          appendListItem(old, { ...itemToMove, roomId: toRoomId }),
        );
      }

      return { previousFrom, previousTo };
    },
    onError: (_err, variables, ctx) => {
      restoreQueryList(queryClient, itemKeys.forRoom(variables.fromRoomId), ctx?.previousFrom);
      restoreQueryList(queryClient, itemKeys.forRoom(variables.toRoomId), ctx?.previousTo);
    },
    onSettled: (_data, _error, variables) => {
      void queryClient.invalidateQueries({ queryKey: itemKeys.forRoom(variables.fromRoomId) });
      void queryClient.invalidateQueries({ queryKey: itemKeys.forRoom(variables.toRoomId) });
    },
  });
}
