import { apiFetch } from './transport';
import {
  mapProposalCategory,
  mapProposalItem,
  type RawProposalCategory,
  type RawProposalItem,
} from './mappers';
import type {
  ProposalCategory,
  ProposalItem,
  ProposalItemChangelogEntry,
  ProposalRevision,
  ProposalStatus,
  RevisionSnapshot,
} from '../../types';

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
  changeLog?: {
    columnKey: string;
    previousValue: string;
    newValue: string;
    notes?: string;
    proposalStatus: ProposalStatus;
  };
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
  change_log: patch.changeLog
    ? {
        column_key: patch.changeLog.columnKey,
        previous_value: patch.changeLog.previousValue,
        new_value: patch.changeLog.newValue,
        notes: patch.changeLog.notes,
        proposal_status: patch.changeLog.proposalStatus,
      }
    : undefined,
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

  itemChangelog: (itemId: string): Promise<ProposalItemChangelogEntry[]> =>
    apiFetch<{ changelog: Record<string, unknown>[] }>(
      `/api/v1/proposal/items/${itemId}/changelog`,
    ).then((r) =>
      r.changelog.map((row) => ({
        id: row.id as string,
        proposalItemId: row.proposal_item_id as string,
        columnKey: row.column_key as string,
        previousValue: row.previous_value as string,
        newValue: row.new_value as string,
        notes: (row.notes as string | null) ?? null,
        proposalStatus: row.proposal_status as ProposalStatus,
        relatedChangeId: (row.related_change_id as string | null) ?? null,
        revisionId: (row.revision_id as string | null) ?? null,
        changedAt: row.changed_at as string,
      })),
    ),

  revisions: (
    projectId: string,
  ): Promise<{ revisions: ProposalRevision[]; snapshots: RevisionSnapshot[] }> =>
    apiFetch<{
      revisions: Record<string, unknown>[];
      snapshots: Record<string, unknown>[];
    }>(`/api/v1/projects/${projectId}/proposal/revisions`).then((r) => ({
      revisions: r.revisions.map(
        (row): ProposalRevision => ({
          id: row.id as string,
          projectId: row.project_id as string,
          revisionMajor: row.revision_major as number,
          revisionMinor: row.revision_minor as number,
          label: `${String(row.revision_major)}.${String(row.revision_minor)}`,
          triggeredAtStatus: row.triggered_at_status as
            | 'pricing_complete'
            | 'submitted'
            | 'approved',
          openedAt: row.opened_at as string,
          closedAt: (row.closed_at as string | null) ?? null,
        }),
      ),
      snapshots: r.snapshots.map(
        (row): RevisionSnapshot => ({
          revisionId: row.revision_id as string,
          itemId: row.item_id as string,
          quantity: row.quantity != null ? Number(row.quantity) : null,
          unitCostCents: row.unit_cost_cents != null ? (row.unit_cost_cents as number) : null,
          costStatus: row.cost_status as 'none' | 'flagged' | 'resolved',
        }),
      ),
    })),

  updateRevisionItemCost: (
    revisionId: string,
    itemId: string,
    unitCostCents: number,
  ): Promise<RevisionSnapshot> =>
    apiFetch<{ snapshot: Record<string, unknown> }>(
      `/api/v1/proposal/revisions/${revisionId}/items/${itemId}/cost`,
      {
        method: 'PATCH',
        body: JSON.stringify({ unit_cost_cents: unitCostCents }),
      },
    ).then(
      (r): RevisionSnapshot => ({
        revisionId: r.snapshot.revision_id as string,
        itemId: r.snapshot.item_id as string,
        quantity: r.snapshot.quantity != null ? Number(r.snapshot.quantity) : null,
        unitCostCents:
          r.snapshot.unit_cost_cents != null ? (r.snapshot.unit_cost_cents as number) : null,
        costStatus: r.snapshot.cost_status as 'none' | 'flagged' | 'resolved',
      }),
    ),
};
