import { apiFetch } from './transport';
import { mapMaterial, type RawMaterial } from './mappers';
import type { Material } from '../../types';

const DEFAULT_SWATCH_HEX = '#D9D4C8';

export type CreateMaterialInput = {
  name: string;
  materialId?: string;
  description?: string;
  swatchHex?: string;
};

export type UpdateMaterialInput = Partial<CreateMaterialInput>;

const materialCreatePayload = (input: CreateMaterialInput) => ({
  name: input.name,
  material_id: input.materialId ?? '',
  description: input.description ?? '',
  swatch_hex: input.swatchHex ?? DEFAULT_SWATCH_HEX,
});

const materialUpdatePayload = (patch: UpdateMaterialInput) => ({
  name: patch.name,
  material_id: patch.materialId,
  description: patch.description,
  swatch_hex: patch.swatchHex,
});

const assignedMaterialUpdatePayload = (patch: UpdateMaterialInput) => ({
  name: patch.name,
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
      body: JSON.stringify(assignedMaterialUpdatePayload(patch)),
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
        body: JSON.stringify(assignedMaterialUpdatePayload(patch)),
      },
    ).then((r) => mapMaterial(r.material)),
};
