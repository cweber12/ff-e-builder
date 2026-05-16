import { apiFetch } from './transport';
import { mapItem, type RawItem } from './mappers';
import type { Item, ItemStatus, ProposalStatus } from '../../types';

export type CreateItemInput = {
  itemName: string;
  description?: string | null;
  category?: string | null;
  itemIdTag?: string | null;
  dimensions?: string | null;
  notes?: string | null;
  qty?: number;
  unitCostCents?: number;
  leadTime?: string | null;
  status?: ItemStatus;
  customData?: Record<string, string>;
  sortOrder?: number;
};

export type UpdateItemInput = {
  roomId?: string;
  itemName?: string;
  description?: string | null;
  category?: string | null;
  itemIdTag?: string | null;
  dimensions?: string | null;
  notes?: string | null;
  qty?: number;
  unitCostCents?: number;
  leadTime?: string | null;
  status?: ItemStatus;
  customData?: Record<string, string>;
  sortOrder?: number;
  changeLog?: {
    columnKey: string;
    previousValue: string;
    newValue: string;
    notes?: string;
    proposalStatus: ProposalStatus;
    isPriceAffecting?: boolean;
  };
  /** Required for optimistic concurrency - must match the current DB version */
  version: number;
};

export const itemsApi = {
  list: (roomId: string): Promise<Item[]> =>
    apiFetch<{ items: RawItem[] }>(`/api/v1/rooms/${roomId}/items`).then((r) =>
      r.items.map(mapItem),
    ),

  create: (roomId: string, input: CreateItemInput): Promise<Item> =>
    apiFetch<{ item: RawItem }>(`/api/v1/rooms/${roomId}/items`, {
      method: 'POST',
      body: JSON.stringify({
        item_name: input.itemName,
        description: input.description,
        category: input.category,
        item_id_tag: input.itemIdTag,
        dimensions: input.dimensions,
        notes: input.notes,
        qty: input.qty,
        unit_cost_cents: input.unitCostCents,
        lead_time: input.leadTime,
        status: input.status,
        custom_data: input.customData,
        sort_order: input.sortOrder,
      }),
    }).then((r) => mapItem(r.item)),

  update: (id: string, patch: UpdateItemInput): Promise<Item> =>
    apiFetch<{ item: RawItem }>(`/api/v1/items/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        item_name: patch.itemName,
        room_id: patch.roomId,
        description: patch.description,
        category: patch.category,
        item_id_tag: patch.itemIdTag,
        dimensions: patch.dimensions,
        notes: patch.notes,
        qty: patch.qty,
        unit_cost_cents: patch.unitCostCents,
        lead_time: patch.leadTime,
        status: patch.status,
        custom_data: patch.customData,
        sort_order: patch.sortOrder,
        change_log: patch.changeLog
          ? {
              column_key: patch.changeLog.columnKey,
              previous_value: patch.changeLog.previousValue,
              new_value: patch.changeLog.newValue,
              ...(patch.changeLog.notes ? { notes: patch.changeLog.notes } : {}),
              proposal_status: patch.changeLog.proposalStatus,
              is_price_affecting: patch.changeLog.isPriceAffecting ?? false,
            }
          : undefined,
        version: patch.version,
      }),
    }).then((r) => mapItem(r.item)),

  delete: (id: string): Promise<void> =>
    apiFetch<void>(`/api/v1/items/${id}`, { method: 'DELETE' }),
};
