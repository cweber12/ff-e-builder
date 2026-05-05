import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../../lib/api';
import { roomKeys } from '../queryKeys';
import {
  appendListItem,
  removeListItem,
  replaceListItem,
  restoreQueryList,
  snapshotQueryList,
} from '../optimisticList';
import type { CreateRoomInput, UpdateRoomInput } from '../../lib/api';
import type { Room } from '../../types';

export { roomKeys } from '../queryKeys';

export function useRooms(projectId: string) {
  return useQuery({
    queryKey: roomKeys.forProject(projectId),
    queryFn: () => api.rooms.list(projectId),
    enabled: Boolean(projectId),
  });
}

export function useCreateRoom(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateRoomInput) => api.rooms.create(projectId, input),
    onMutate: async (input) => {
      const queryKey = roomKeys.forProject(projectId);
      const previous = await snapshotQueryList<Room>(queryClient, queryKey);
      const optimisticRoom: Room = {
        id: `optimistic-${crypto.randomUUID()}`,
        projectId,
        name: input.name,
        sortOrder: input.sortOrder ?? previous?.length ?? 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      queryClient.setQueryData<Room[]>(queryKey, (old) => appendListItem(old, optimisticRoom));
      return { previous, optimisticId: optimisticRoom.id };
    },
    onError: (_err, _input, ctx) => {
      restoreQueryList(queryClient, roomKeys.forProject(projectId), ctx?.previous);
    },
    onSuccess: (created, _input, ctx) => {
      queryClient.setQueryData<Room[]>(roomKeys.forProject(projectId), (old) =>
        replaceListItem(old, ctx?.optimisticId, created),
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: roomKeys.forProject(projectId) }),
  });
}

export function useUpdateRoom(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateRoomInput }) =>
      api.rooms.update(id, patch),
    onSuccess: (updated) => {
      queryClient.setQueryData<Room[]>(
        roomKeys.forProject(projectId),
        (old) => old?.map((r) => (r.id === updated.id ? updated : r)) ?? [],
      );
    },
    onError: (err: Error) => {
      toast.error(`Failed to update room: ${err.message}`);
    },
  });
}

export function useDeleteRoom(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.rooms.delete(id),
    onMutate: async (id) => {
      const queryKey = roomKeys.forProject(projectId);
      const previous = await snapshotQueryList<Room>(queryClient, queryKey);
      queryClient.setQueryData<Room[]>(queryKey, (old) => removeListItem(old, id));
      return { previous };
    },
    onError: (err, _id, ctx) => {
      restoreQueryList(queryClient, roomKeys.forProject(projectId), ctx?.previous);
      toast.error(`Delete failed: ${err.message}`);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: roomKeys.forProject(projectId) }),
  });
}
