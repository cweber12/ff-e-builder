import type { ItemStatus } from './itemValidation';
import type { Material } from './material';

export type { ItemStatus } from './itemValidation';

export type Item = {
  id: string;
  roomId: string;
  itemName: string;
  description: string | null;
  category: string | null;
  vendor: string | null;
  model: string | null;
  itemIdTag: string | null;
  dimensions: string | null;
  seatHeight: string | null;
  finishes: string | null;
  notes: string | null;
  qty: number;
  /** Always integer cents — see /docs/money.md */
  unitCostCents: number;
  /** Parsed from Postgres numeric(5,2) string */
  markupPct: number;
  leadTime: string | null;
  status: ItemStatus;
  imageUrl: string | null;
  linkUrl: string | null;
  sortOrder: number;
  /** Optimistic concurrency version counter */
  version: number;
  createdAt: string;
  updatedAt: string;
  materials: Material[];
};
