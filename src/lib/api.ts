import { compressImage } from './compress-image';
import { apiFetch, apiFetchResponse } from './api/transport';
import { itemsApi } from './api/items';
import { projectsApi } from './api/projects';
import { roomsApi } from './api/rooms';
import { usersApi } from './api/users';
import {
  mapImageAsset,
  mapMaterial,
  mapProposalCategory,
  mapProposalItem,
  type RawImageAsset,
  type RawMaterial,
  type RawProposalCategory,
  type RawProposalItem,
} from './api/mappers';
import type {
  CropParams,
  ImageAsset,
  ImageEntityType,
  Material,
  ProposalCategory,
  ProposalItem,
} from '../types';

// Compatibility export
export { ApiError } from './api/transport';
export type { CreateItemInput, UpdateItemInput } from './api/items';
export type { CreateProjectInput, UpdateProjectInput } from './api/projects';
export type { CreateRoomInput, UpdateRoomInput } from './api/rooms';
export type { UpsertUserProfileInput } from './api/users';

// Client input types
export type ImageEntityRef = {
  entityType: ImageEntityType;
  entityId: string;
};

export type UploadImageInput = ImageEntityRef & {
  file: File;
  altText?: string;
};

export type CreateMaterialInput = {
  name: string;
  materialId?: string;
  description?: string;
  swatchHex?: string;
};

export type UpdateMaterialInput = Partial<CreateMaterialInput>;

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
};

export type UpdateProposalItemInput = Partial<CreateProposalItemInput> & {
  categoryId?: string;
  version: number;
};

// API namespace

export const api = {
  projects: projectsApi,
  users: usersApi,

  proposal: {
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
          body: JSON.stringify({
            name: input.name,
            sort_order: input.sortOrder ?? 0,
          }),
        },
      ).then((r) => mapProposalCategory(r.category)),

    updateCategory: (id: string, patch: UpdateProposalCategoryInput): Promise<ProposalCategory> =>
      apiFetch<{ category: RawProposalCategory }>(`/api/v1/proposal/categories/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: patch.name,
          sort_order: patch.sortOrder,
        }),
      }).then((r) => mapProposalCategory(r.category)),

    deleteCategory: (id: string): Promise<void> =>
      apiFetch<void>(`/api/v1/proposal/categories/${id}`, { method: 'DELETE' }),

    items: (categoryId: string): Promise<ProposalItem[]> =>
      apiFetch<{ items: RawProposalItem[] }>(
        `/api/v1/proposal/categories/${categoryId}/items`,
      ).then((r) => r.items.map(mapProposalItem)),

    createItem: (categoryId: string, input: CreateProposalItemInput): Promise<ProposalItem> =>
      apiFetch<{ item: RawProposalItem }>(`/api/v1/proposal/categories/${categoryId}/items`, {
        method: 'POST',
        body: JSON.stringify({
          product_tag: input.productTag ?? '',
          plan: input.plan ?? '',
          drawings: input.drawings ?? '',
          location: input.location ?? '',
          description: input.description ?? '',
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
        }),
      }).then((r) => mapProposalItem(r.item)),

    updateItem: (id: string, patch: UpdateProposalItemInput): Promise<ProposalItem> =>
      apiFetch<{ item: RawProposalItem }>(`/api/v1/proposal/items/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          category_id: patch.categoryId,
          product_tag: patch.productTag,
          plan: patch.plan,
          drawings: patch.drawings,
          location: patch.location,
          description: patch.description,
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
          version: patch.version,
        }),
      }).then((r) => mapProposalItem(r.item)),

    deleteItem: (id: string): Promise<void> =>
      apiFetch<void>(`/api/v1/proposal/items/${id}`, { method: 'DELETE' }),
  },

  rooms: roomsApi,
  items: itemsApi,

  images: {
    list: ({ entityType, entityId }: ImageEntityRef): Promise<ImageAsset[]> => {
      const params = new URLSearchParams({
        entity_type: entityType,
        entity_id: entityId,
      });
      return apiFetch<{ images: RawImageAsset[] }>(`/api/v1/images?${params}`).then((r) =>
        r.images.map(mapImageAsset),
      );
    },

    upload: async ({
      entityType,
      entityId,
      file,
      altText = '',
    }: UploadImageInput): Promise<ImageAsset> => {
      const compressed = await compressImage(file);
      const params = new URLSearchParams({
        entity_type: entityType,
        entity_id: entityId,
        alt_text: altText,
      });
      const body = new FormData();
      body.append('file', compressed);

      return apiFetch<{ image: RawImageAsset }>(`/api/v1/images?${params}`, {
        method: 'POST',
        body,
      }).then((r) => mapImageAsset(r.image));
    },

    getContentBlob: async (imageId: string): Promise<Blob> => {
      const response = await apiFetchResponse(`/api/v1/images/${imageId}/content`);
      return response.blob();
    },

    delete: (imageId: string): Promise<void> =>
      apiFetch<void>(`/api/v1/images/${imageId}`, { method: 'DELETE' }),

    setPrimary: (imageId: string): Promise<ImageAsset> =>
      apiFetch<{ image: RawImageAsset }>(`/api/v1/images/${imageId}/primary`, {
        method: 'PATCH',
      }).then((r) => mapImageAsset(r.image)),

    setCrop: (imageId: string, params: CropParams | null): Promise<ImageAsset> =>
      apiFetch<{ image: RawImageAsset }>(`/api/v1/images/${imageId}/crop`, {
        method: 'PATCH',
        body: JSON.stringify(
          params
            ? {
                crop_x: params.cropX,
                crop_y: params.cropY,
                crop_width: params.cropWidth,
                crop_height: params.cropHeight,
              }
            : { crop_x: null, crop_y: null, crop_width: null, crop_height: null },
        ),
      }).then((r) => mapImageAsset(r.image)),
  },
  materials: {
    list: (projectId: string): Promise<Material[]> =>
      apiFetch<{ materials: RawMaterial[] }>(`/api/v1/projects/${projectId}/materials`).then((r) =>
        r.materials.map(mapMaterial),
      ),

    create: (projectId: string, input: CreateMaterialInput): Promise<Material> =>
      apiFetch<{ material: RawMaterial }>(`/api/v1/projects/${projectId}/materials`, {
        method: 'POST',
        body: JSON.stringify({
          name: input.name,
          material_id: input.materialId ?? '',
          description: input.description ?? '',
          swatch_hex: input.swatchHex ?? '#D9D4C8',
        }),
      }).then((r) => mapMaterial(r.material)),

    update: (id: string, patch: UpdateMaterialInput): Promise<Material> =>
      apiFetch<{ material: RawMaterial }>(`/api/v1/materials/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: patch.name,
          material_id: patch.materialId,
          description: patch.description,
          swatch_hex: patch.swatchHex,
        }),
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
        body: JSON.stringify({
          name: input.name,
          material_id: input.materialId ?? '',
          description: input.description ?? '',
          swatch_hex: input.swatchHex ?? '#D9D4C8',
        }),
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
        body: JSON.stringify({
          name: patch.name,
          material_id: patch.materialId,
          description: patch.description,
        }),
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
      apiFetch<{ material: RawMaterial }>(
        `/api/v1/proposal/items/${proposalItemId}/materials/new`,
        {
          method: 'POST',
          body: JSON.stringify({
            name: input.name,
            material_id: input.materialId,
            description: input.description,
            swatch_hex: input.swatchHex ?? '#D9D4C8',
          }),
        },
      ).then((r) => mapMaterial(r.material)),

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
          body: JSON.stringify({
            name: patch.name,
            material_id: patch.materialId,
            description: patch.description,
          }),
        },
      ).then((r) => mapMaterial(r.material)),
  },
};
