import type { ItemStatus } from './itemValidation';
import type { Material } from './material';

export type { ItemStatus } from './itemValidation';

export type Item = {
  id: string;
  roomId: string;
  itemName: string;
  description: string | null;
  category: string | null;
  itemIdTag: string | null;
  dimensions: string | null;
  notes: string | null;
  qty: number;
  /** Always integer cents — see /docs/money.md */
  unitCostCents: number;
  leadTime: string | null;
  status: ItemStatus;
  /** User-defined custom column values keyed by ItemColumnDef id */
  customData: Record<string, string>;
  sortOrder: number;
  /** Optimistic concurrency version counter */
  version: number;
  createdAt: string;
  updatedAt: string;
  materials: Material[];
};

export type CustomColumnDef = {
  id: string;
  projectId: string;
  label: string;
  sortOrder: number;
  tableType: 'ffe' | 'proposal';
  createdAt: string;
  updatedAt: string;
};
