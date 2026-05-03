import { useQueries } from '@tanstack/react-query';
import { useRooms } from './useRooms';
import { itemKeys } from './useItems';
import { api } from '../../lib/api';
import type { RoomWithItems } from '../../types';

export function useRoomsWithItems(projectId: string) {
  const { data: rooms, isLoading: roomsLoading, error: roomsError } = useRooms(projectId);

  const itemQueries = useQueries({
    queries: (rooms ?? []).map((room) => ({
      queryKey: itemKeys.forRoom(room.id),
      queryFn: () => api.items.list(room.id),
      enabled: Boolean(room.id && projectId),
    })),
  });

  const roomsWithItems: RoomWithItems[] = (rooms ?? []).map((room, index) => ({
    ...room,
    items: itemQueries[index]?.data ?? [],
  }));

  const isLoading =
    roomsLoading || (rooms !== undefined && itemQueries.some((q) => q.isLoading && !q.data));
  const error = roomsError ?? itemQueries.find((q) => q.error)?.error ?? null;

  return { roomsWithItems, isLoading, error };
}
