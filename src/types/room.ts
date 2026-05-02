import type { Item } from './item';

export type Room = {
  id: string;
  projectId: string;
  name: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type RoomWithItems = Room & { items: Item[] };
