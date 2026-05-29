import { apiFetch } from './transport';
import { mapMaterial, type RawMaterial } from './mappers';
import type { Material, MaterialType } from '../../types';

export type CreateMaterialInput = {
  name: string;
  code?: string;
  finishId?: string | null;
  materialType?: MaterialType | null;
  materialId?: string;
  description?: string;
};

export type UpdateMaterialInput = Partial<CreateMaterialInput>;

const DEFAULT_MATERIAL_NAME_PREFIX = 'Material';
const DEFAULT_NAME_INDEX_PADDING = 3;

function parseDefaultNameIndex(name: string, prefix: string): number | null {
  const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = name.match(new RegExp(`^${escapedPrefix}\\s+(\\d+)$`, 'i'));
  if (!match) return null;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatDefaultMaterialName(index: number) {
  const suffix = String(index).padStart(DEFAULT_NAME_INDEX_PADDING, '0');
  return `${DEFAULT_MATERIAL_NAME_PREFIX} ${suffix}`;
}

export function nextDefaultMaterialName(materials: readonly Pick<Material, 'name'>[] | undefined) {
  const maxExisting = (materials ?? []).reduce((currentMax, material) => {
    const parsed = parseDefaultNameIndex(material.name.trim(), DEFAULT_MATERIAL_NAME_PREFIX);
    return parsed === null ? currentMax : Math.max(currentMax, parsed);
  }, 0);
  return formatDefaultMaterialName(maxExisting + 1);
}

const materialCreatePayload = (input: CreateMaterialInput) => ({
  name: input.name,
  code: input.code ?? '',
  finish_id: input.finishId ?? null,
  material_type: input.materialType ?? null,
  material_id: input.materialId ?? '',
  description: input.description ?? '',
});

const materialUpdatePayload = (patch: UpdateMaterialInput) => ({
  name: patch.name,
  code: patch.code,
  finish_id: patch.finishId,
  material_type: patch.materialType,
  material_id: patch.materialId,
  description: patch.description,
});

export const materialsApi = {
  list: (projectId: string): Promise<Material[]> =>
    apiFetch<{ materials: RawMaterial[] }>(`/api/v1/projects/${projectId}/materials`).then((r) =>
      r.materials.map(mapMaterial),
    ),

  create: (projectId: string, input: CreateMaterialInput): Promise<Material> =>
    apiFetch<{ material: RawMaterial }>(`/api/v1/projects/${projectId}/materials`, {
      method: 'POST',
      body: JSON.stringify(materialCreatePayload(input)),
    }).then((r) => mapMaterial(r.material)),

  update: (id: string, patch: UpdateMaterialInput): Promise<Material> =>
    apiFetch<{ material: RawMaterial }>(`/api/v1/materials/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(materialUpdatePayload(patch)),
    }).then((r) => mapMaterial(r.material)),

  delete: (id: string): Promise<void> =>
    apiFetch<void>(`/api/v1/materials/${id}`, { method: 'DELETE' }),

  assignToItem: (itemId: string, materialId: string): Promise<Material> =>
    apiFetch<{ material: RawMaterial }>(`/api/v1/items/${itemId}/materials`, {
      method: 'POST',
      body: JSON.stringify({ material_id: materialId }),
    }).then((r) => mapMaterial(r.material)),

  createAndAssignToItem: (itemId: string, input: CreateMaterialInput): Promise<Material> =>
    apiFetch<{ material: RawMaterial }>(`/api/v1/items/${itemId}/materials/new`, {
      method: 'POST',
      body: JSON.stringify(materialCreatePayload(input)),
    }).then((r) => mapMaterial(r.material)),

  removeFromItem: (itemId: string, materialId: string): Promise<void> =>
    apiFetch<void>(`/api/v1/items/${itemId}/materials/${materialId}`, { method: 'DELETE' }),

  updateForItem: (
    itemId: string,
    materialId: string,
    patch: UpdateMaterialInput,
  ): Promise<Material> =>
    apiFetch<{ material: RawMaterial }>(`/api/v1/items/${itemId}/materials/${materialId}`, {
      method: 'PATCH',
      body: JSON.stringify(materialUpdatePayload(patch)),
    }).then((r) => mapMaterial(r.material)),

  assignToProposalItem: (proposalItemId: string, materialId: string): Promise<Material> =>
    apiFetch<{ material: RawMaterial }>(`/api/v1/proposal/items/${proposalItemId}/materials`, {
      method: 'POST',
      body: JSON.stringify({ material_id: materialId }),
    }).then((r) => mapMaterial(r.material)),

  createAndAssignToProposalItem: (
    proposalItemId: string,
    input: CreateMaterialInput,
  ): Promise<Material> =>
    apiFetch<{ material: RawMaterial }>(`/api/v1/proposal/items/${proposalItemId}/materials/new`, {
      method: 'POST',
      body: JSON.stringify(materialCreatePayload(input)),
    }).then((r) => mapMaterial(r.material)),

  removeFromProposalItem: (proposalItemId: string, materialId: string): Promise<void> =>
    apiFetch<void>(`/api/v1/proposal/items/${proposalItemId}/materials/${materialId}`, {
      method: 'DELETE',
    }),

  updateForProposalItem: (
    proposalItemId: string,
    materialId: string,
    patch: UpdateMaterialInput,
  ): Promise<Material> =>
    apiFetch<{ material: RawMaterial }>(
      `/api/v1/proposal/items/${proposalItemId}/materials/${materialId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(materialUpdatePayload(patch)),
      },
    ).then((r) => mapMaterial(r.material)),
};
