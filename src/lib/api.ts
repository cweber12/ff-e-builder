import { auth } from './auth';
import type { Item, ItemStatus, Project, Room } from '../types';

// ─── Error type ───────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body: unknown = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ─── Raw response shapes (snake_case from worker) ─────────────────────────

interface RawProject {
  id: string;
  owner_uid: string;
  name: string;
  client_name: string;
  budget_cents: number;
  created_at: string;
  updated_at: string;
}

interface RawRoom {
  id: string;
  project_id: string;
  name: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface RawItem {
  id: string;
  room_id: string;
  item_name: string;
  category: string | null;
  vendor: string | null;
  model: string | null;
  item_id_tag: string | null;
  dimensions: string | null;
  seat_height: string | null;
  finishes: string | null;
  notes: string | null;
  qty: number;
  unit_cost_cents: number;
  /** Postgres numeric(5,2) is returned as a string */
  markup_pct: string;
  lead_time: string | null;
  status: ItemStatus;
  image_url: string | null;
  link_url: string | null;
  sort_order: number;
  version: number;
  created_at: string;
  updated_at: string;
}

// ─── Mappers ──────────────────────────────────────────────────────────────

const mapProject = (r: RawProject): Project => ({
  id: r.id,
  ownerUid: r.owner_uid,
  name: r.name,
  clientName: r.client_name,
  budgetCents: r.budget_cents,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const mapRoom = (r: RawRoom): Room => ({
  id: r.id,
  projectId: r.project_id,
  name: r.name,
  sortOrder: r.sort_order,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const mapItem = (r: RawItem): Item => ({
  id: r.id,
  roomId: r.room_id,
  itemName: r.item_name,
  category: r.category,
  vendor: r.vendor,
  model: r.model,
  itemIdTag: r.item_id_tag,
  dimensions: r.dimensions,
  seatHeight: r.seat_height,
  finishes: r.finishes,
  notes: r.notes,
  qty: r.qty,
  unitCostCents: r.unit_cost_cents,
  markupPct: parseFloat(r.markup_pct),
  leadTime: r.lead_time,
  status: r.status,
  imageUrl: r.image_url,
  linkUrl: r.link_url,
  sortOrder: r.sort_order,
  version: r.version,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

// ─── Client input types ───────────────────────────────────────────────────

export type CreateProjectInput = {
  name: string;
  clientName?: string;
  budgetCents?: number;
};

export type UpdateProjectInput = {
  name?: string;
  clientName?: string;
  budgetCents?: number;
};

export type CreateRoomInput = {
  name: string;
  sortOrder?: number;
};

export type UpdateRoomInput = {
  name?: string;
  sortOrder?: number;
};

export type CreateItemInput = {
  itemName: string;
  category?: string | null;
  vendor?: string | null;
  model?: string | null;
  itemIdTag?: string | null;
  dimensions?: string | null;
  seatHeight?: string | null;
  finishes?: string | null;
  notes?: string | null;
  qty?: number;
  unitCostCents?: number;
  markupPct?: number;
  leadTime?: string | null;
  status?: ItemStatus;
  imageUrl?: string | null;
  linkUrl?: string | null;
  sortOrder?: number;
};

export type UpdateItemInput = {
  itemName?: string;
  category?: string | null;
  vendor?: string | null;
  model?: string | null;
  itemIdTag?: string | null;
  dimensions?: string | null;
  seatHeight?: string | null;
  finishes?: string | null;
  notes?: string | null;
  qty?: number;
  unitCostCents?: number;
  markupPct?: number;
  leadTime?: string | null;
  status?: ItemStatus;
  imageUrl?: string | null;
  linkUrl?: string | null;
  sortOrder?: number;
  /** Required for optimistic concurrency — must match the current DB version */
  version: number;
};

// ─── Core fetch helper ────────────────────────────────────────────────────

const BASE_URL = import.meta.env.VITE_API_BASE_URL;

const apiFetch = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
  const token = await auth.currentUser?.getIdToken(false);

  const headers: Record<string, string> = {};
  if (init.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (token !== undefined) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...init, headers });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const message = typeof body['message'] === 'string' ? body['message'] : res.statusText;
    throw new ApiError(res.status, message, body);
  }

  if (res.status === 204) {
    return undefined as unknown as T;
  }

  return res.json() as Promise<T>;
};

// ─── API namespace ────────────────────────────────────────────────────────

export const api = {
  projects: {
    list: (): Promise<Project[]> =>
      apiFetch<{ projects: RawProject[] }>('/api/v1/projects').then((r) =>
        r.projects.map(mapProject),
      ),

    create: (input: CreateProjectInput): Promise<Project> =>
      apiFetch<{ project: RawProject }>('/api/v1/projects', {
        method: 'POST',
        body: JSON.stringify({
          name: input.name,
          client_name: input.clientName ?? '',
          budget_cents: input.budgetCents ?? 0,
        }),
      }).then((r) => mapProject(r.project)),

    update: (id: string, patch: UpdateProjectInput): Promise<Project> =>
      apiFetch<{ project: RawProject }>(`/api/v1/projects/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: patch.name,
          client_name: patch.clientName,
          budget_cents: patch.budgetCents,
        }),
      }).then((r) => mapProject(r.project)),

    delete: (id: string): Promise<void> =>
      apiFetch<void>(`/api/v1/projects/${id}`, { method: 'DELETE' }),
  },

  rooms: {
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
  },

  items: {
    list: (roomId: string): Promise<Item[]> =>
      apiFetch<{ items: RawItem[] }>(`/api/v1/rooms/${roomId}/items`).then((r) =>
        r.items.map(mapItem),
      ),

    create: (roomId: string, input: CreateItemInput): Promise<Item> =>
      apiFetch<{ item: RawItem }>(`/api/v1/rooms/${roomId}/items`, {
        method: 'POST',
        body: JSON.stringify({
          item_name: input.itemName,
          category: input.category,
          vendor: input.vendor,
          model: input.model,
          item_id_tag: input.itemIdTag,
          dimensions: input.dimensions,
          seat_height: input.seatHeight,
          finishes: input.finishes,
          notes: input.notes,
          qty: input.qty,
          unit_cost_cents: input.unitCostCents,
          markup_pct: input.markupPct,
          lead_time: input.leadTime,
          status: input.status,
          image_url: input.imageUrl,
          link_url: input.linkUrl,
          sort_order: input.sortOrder,
        }),
      }).then((r) => mapItem(r.item)),

    update: (id: string, patch: UpdateItemInput): Promise<Item> =>
      apiFetch<{ item: RawItem }>(`/api/v1/items/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          item_name: patch.itemName,
          category: patch.category,
          vendor: patch.vendor,
          model: patch.model,
          item_id_tag: patch.itemIdTag,
          dimensions: patch.dimensions,
          seat_height: patch.seatHeight,
          finishes: patch.finishes,
          notes: patch.notes,
          qty: patch.qty,
          unit_cost_cents: patch.unitCostCents,
          markup_pct: patch.markupPct,
          lead_time: patch.leadTime,
          status: patch.status,
          image_url: patch.imageUrl,
          link_url: patch.linkUrl,
          sort_order: patch.sortOrder,
          version: patch.version,
        }),
      }).then((r) => mapItem(r.item)),

    delete: (id: string): Promise<void> =>
      apiFetch<void>(`/api/v1/items/${id}`, { method: 'DELETE' }),
  },
};
