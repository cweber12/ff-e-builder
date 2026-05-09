import { apiFetch } from './transport';
import {
  mapProposalCategory,
  mapProposalItem,
  type RawProposalCategory,
  type RawProposalItem,
} from './mappers';
import type { ProposalCategory, ProposalItem } from '../../types';

export type CreateProposalCategoryInput = {
  name: string;
  sortOrder?: number;
};

export type UpdateProposalCategoryInput = {
  name?: string;
  sortOrder?: number;
};

export type CreateProposalItemInput = {
  productTag?: string;
  plan?: string;
  drawings?: string;
  location?: string;
  description?: string;
  notes?: string;
  sizeLabel?: string;
  sizeMode?: 'imperial' | 'metric';
  sizeW?: string;
  sizeD?: string;
  sizeH?: string;
  sizeUnit?: string;
  cbm?: number;
  quantity?: number;
  quantityUnit?: string;
  unitCostCents?: number;
  sortOrder?: number;
  customData?: Record<string, string>;
};

export type UpdateProposalItemInput = Partial<CreateProposalItemInput> & {
  categoryId?: string;
  version: number;
};

const proposalCategoryCreatePayload = (input: CreateProposalCategoryInput) => ({
  name: input.name,
  sort_order: input.sortOrder ?? 0,
});

const proposalCategoryUpdatePayload = (patch: UpdateProposalCategoryInput) => ({
  name: patch.name,
  sort_order: patch.sortOrder,
});

const proposalItemCreatePayload = (input: CreateProposalItemInput) => ({
  product_tag: input.productTag ?? '',
  plan: input.plan ?? '',
  drawings: input.drawings ?? '',
  location: input.location ?? '',
  description: input.description ?? '',
  notes: input.notes ?? '',
  size_label: input.sizeLabel ?? '',
  size_mode: input.sizeMode ?? 'imperial',
  size_w: input.sizeW ?? '',
  size_d: input.sizeD ?? '',
  size_h: input.sizeH ?? '',
  size_unit: input.sizeUnit ?? 'in',
  cbm: input.cbm ?? 0,
  quantity: input.quantity ?? 1,
  quantity_unit: input.quantityUnit ?? 'unit',
  unit_cost_cents: input.unitCostCents ?? 0,
  sort_order: input.sortOrder ?? 0,
  custom_data: input.customData ?? {},
});

const proposalItemUpdatePayload = (patch: UpdateProposalItemInput) => ({
  category_id: patch.categoryId,
  product_tag: patch.productTag,
  plan: patch.plan,
  drawings: patch.drawings,
  location: patch.location,
  description: patch.description,
  notes: patch.notes,
  size_label: patch.sizeLabel,
  size_mode: patch.sizeMode,
  size_w: patch.sizeW,
  size_d: patch.sizeD,
  size_h: patch.sizeH,
  size_unit: patch.sizeUnit,
  cbm: patch.cbm,
  quantity: patch.quantity,
  quantity_unit: patch.quantityUnit,
  unit_cost_cents: patch.unitCostCents,
  sort_order: patch.sortOrder,
  custom_data: patch.customData,
  version: patch.version,
});

export const proposalApi = {
  categories: (projectId: string): Promise<ProposalCategory[]> =>
    apiFetch<{ categories: RawProposalCategory[] }>(
      `/api/v1/projects/${projectId}/proposal/categories`,
    ).then((r) => r.categories.map(mapProposalCategory)),

  createCategory: (
    projectId: string,
    input: CreateProposalCategoryInput,
  ): Promise<ProposalCategory> =>
    apiFetch<{ category: RawProposalCategory }>(
      `/api/v1/projects/${projectId}/proposal/categories`,
      {
        method: 'POST',
        body: JSON.stringify(proposalCategoryCreatePayload(input)),
      },
    ).then((r) => mapProposalCategory(r.category)),

  updateCategory: (id: string, patch: UpdateProposalCategoryInput): Promise<ProposalCategory> =>
    apiFetch<{ category: RawProposalCategory }>(`/api/v1/proposal/categories/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(proposalCategoryUpdatePayload(patch)),
    }).then((r) => mapProposalCategory(r.category)),

  deleteCategory: (id: string): Promise<void> =>
    apiFetch<void>(`/api/v1/proposal/categories/${id}`, { method: 'DELETE' }),

  items: (categoryId: string): Promise<ProposalItem[]> =>
    apiFetch<{ items: RawProposalItem[] }>(`/api/v1/proposal/categories/${categoryId}/items`).then(
      (r) => r.items.map(mapProposalItem),
    ),

  createItem: (categoryId: string, input: CreateProposalItemInput): Promise<ProposalItem> =>
    apiFetch<{ item: RawProposalItem }>(`/api/v1/proposal/categories/${categoryId}/items`, {
      method: 'POST',
      body: JSON.stringify(proposalItemCreatePayload(input)),
    }).then((r) => mapProposalItem(r.item)),

  updateItem: (id: string, patch: UpdateProposalItemInput): Promise<ProposalItem> =>
    apiFetch<{ item: RawProposalItem }>(`/api/v1/proposal/items/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(proposalItemUpdatePayload(patch)),
    }).then((r) => mapProposalItem(r.item)),

  deleteItem: (id: string): Promise<void> =>
    apiFetch<void>(`/api/v1/proposal/items/${id}`, { method: 'DELETE' }),
};
