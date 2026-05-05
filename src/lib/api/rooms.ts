import { apiFetch } from './transport';
import { mapRoom, type RawRoom } from './mappers';
import type { Room } from '../../types';

export type CreateRoomInput = {
  name: string;
  sortOrder?: number;
};

export type UpdateRoomInput = {
  name?: string;
  sortOrder?: number;
};

export const roomsApi = {
  list: (projectId: string): Promise<Room[]> =>
    apiFetch<{ rooms: RawRoom[] }>(`/api/v1/projects/${projectId}/rooms`).then((r) =>
      r.rooms.map(mapRoom),
    ),

  create: (projectId: string, input: CreateRoomInput): Promise<Room> =>
    apiFetch<{ room: RawRoom }>(`/api/v1/projects/${projectId}/rooms`, {
      method: 'POST',
      body: JSON.stringify({
        name: input.name,
        sort_order: input.sortOrder ?? 0,
      }),
    }).then((r) => mapRoom(r.room)),

  update: (id: string, patch: UpdateRoomInput): Promise<Room> =>
    apiFetch<{ room: RawRoom }>(`/api/v1/rooms/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        name: patch.name,
        sort_order: patch.sortOrder,
      }),
    }).then((r) => mapRoom(r.room)),

  delete: (id: string): Promise<void> =>
    apiFetch<void>(`/api/v1/rooms/${id}`, { method: 'DELETE' }),
};
