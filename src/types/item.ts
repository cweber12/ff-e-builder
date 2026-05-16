import type { ItemStatus } from './itemValidation';
import type { Material } from './material';

export type { ItemStatus } from './itemValidation';

export type GeneratedItemProposalFields = {
  proposalCategoryId: string | null;
  productTag: string;
  plan: string;
  drawings: string;
  location: string;
  sizeLabel: string;
  sizeMode: 'imperial' | 'metric';
  sizeW: string;
  sizeD: string;
  sizeH: string;
  sizeUnit: string;
  cbm: number;
  quantity: number;
  quantityUnit: string;
};

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

export type GeneratedItem = Item & GeneratedItemProposalFields;

export type CustomColumnDef = {
  id: string;
  projectId: string;
  label: string;
  sortOrder: number;
  tableType: 'ffe' | 'proposal';
  createdAt: string;
  updatedAt: string;
};
