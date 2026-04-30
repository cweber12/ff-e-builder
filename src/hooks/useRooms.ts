import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { CreateRoomInput, UpdateRoomInput } from '../lib/api';
import type { Room } from '../types';

export const roomKeys = {
  forProject: (projectId: string) => ['rooms', projectId] as const,
};

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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: roomKeys.forProject(projectId) }),
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
  });
}

export function useDeleteRoom(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.rooms.delete(id),
    onSuccess: (_data, id) => {
      queryClient.setQueryData<Room[]>(
        roomKeys.forProject(projectId),
        (old) => old?.filter((r) => r.id !== id) ?? [],
      );
    },
  });
}
