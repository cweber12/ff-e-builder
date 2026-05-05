import { getCurrentIdToken } from './auth';
import { compressImage } from './compress-image';
import type {
  CropParams,
  ImageAsset,
  ImageEntityType,
  Item,
  ItemStatus,
  Material,
  Project,
  Room,
  TakeoffCategory,
  TakeoffItem,
  UserProfile,
} from '../types';

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
  company_name: string;
  project_location: string;
  budget_mode: 'shared' | 'individual';
  budget_cents: number;
  ffe_budget_cents: number;
  takeoff_budget_cents: number;
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
  materials?: RawMaterial[];
}

interface RawImageAsset {
  id: string;
  entity_type: ImageEntityType;
  owner_uid: string;
  project_id: string;
  room_id: string | null;
  item_id: string | null;
  material_id: string | null;
  takeoff_item_id: string | null;
  filename: string;
  content_type: string;
  byte_size: number;
  alt_text: string;
  is_primary: boolean;
  crop_x: number | null;
  crop_y: number | null;
  crop_width: number | null;
  crop_height: number | null;
  created_at: string;
  updated_at: string;
}

interface RawUserProfile {
  owner_uid: string;
  name: string;
  email: string;
  phone: string;
  company_name: string;
  created_at: string;
  updated_at: string;
}

interface RawTakeoffCategory {
  id: string;
  project_id: string;
  name: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface RawTakeoffItem {
  id: string;
  category_id: string;
  product_tag: string;
  plan: string;
  drawings: string;
  location: string;
  description: string;
  size_label: string;
  size_mode: 'imperial' | 'metric';
  size_w: string;
  size_d: string;
  size_h: string;
  size_unit: string;
  swatches: string[];
  materials?: RawMaterial[];
  cbm: string;
  quantity: string;
  quantity_unit: string;
  unit_cost_cents: number;
  sort_order: number;
  version: number;
  created_at: string;
  updated_at: string;
}

interface RawMaterial {
  id: string;
  project_id: string;
  name: string;
  material_id: string;
  description: string;
  swatch_hex: string;
  swatches?: string[];
  finish_classification: 'material' | 'swatch' | 'hybrid';
  created_at: string;
  updated_at: string;
}

// ─── Mappers ──────────────────────────────────────────────────────────────

const mapProject = (r: RawProject): Project => ({
  id: r.id,
  ownerUid: r.owner_uid,
  name: r.name,
  clientName: r.client_name,
  companyName: r.company_name ?? '',
  projectLocation: r.project_location ?? '',
  budgetMode: r.budget_mode ?? 'shared',
  budgetCents: r.budget_cents,
  ffeBudgetCents: r.ffe_budget_cents ?? 0,
  takeoffBudgetCents: r.takeoff_budget_cents ?? 0,
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
  materials: (r.materials ?? []).map(mapMaterial),
});

const mapImageAsset = (r: RawImageAsset): ImageAsset => ({
  id: r.id,
  entityType: r.entity_type,
  ownerUid: r.owner_uid,
  projectId: r.project_id,
  roomId: r.room_id,
  itemId: r.item_id,
  materialId: r.material_id ?? null,
  takeoffItemId: r.takeoff_item_id ?? null,
  filename: r.filename,
  contentType: r.content_type,
  byteSize: r.byte_size,
  altText: r.alt_text,
  isPrimary: r.is_primary,
  cropX: r.crop_x ?? null,
  cropY: r.crop_y ?? null,
  cropWidth: r.crop_width ?? null,
  cropHeight: r.crop_height ?? null,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const mapUserProfile = (r: RawUserProfile): UserProfile => ({
  ownerUid: r.owner_uid,
  name: r.name,
  email: r.email,
  phone: r.phone,
  companyName: r.company_name,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const mapTakeoffCategory = (r: RawTakeoffCategory): TakeoffCategory => ({
  id: r.id,
  projectId: r.project_id,
  name: r.name,
  sortOrder: r.sort_order,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const mapTakeoffItem = (r: RawTakeoffItem): TakeoffItem => ({
  id: r.id,
  categoryId: r.category_id,
  productTag: r.product_tag,
  plan: r.plan,
  drawings: r.drawings,
  location: r.location,
  description: r.description,
  sizeLabel: r.size_label,
  sizeMode: r.size_mode,
  sizeW: r.size_w,
  sizeD: r.size_d,
  sizeH: r.size_h,
  sizeUnit: r.size_unit as TakeoffItem['sizeUnit'],
  swatches: Array.isArray(r.swatches) ? r.swatches : [],
  materials: Array.isArray(r.materials) ? r.materials.map(mapMaterial) : [],
  cbm: Number(r.cbm),
  quantity: Number(r.quantity),
  quantityUnit: r.quantity_unit,
  unitCostCents: r.unit_cost_cents,
  sortOrder: r.sort_order,
  version: r.version,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const mapMaterial = (r: RawMaterial): Material => ({
  id: r.id,
  projectId: r.project_id,
  name: r.name,
  materialId: r.material_id,
  description: r.description,
  swatchHex: r.swatch_hex,
  swatches: r.swatches?.length ? r.swatches : [r.swatch_hex],
  finishClassification: r.finish_classification ?? 'material',
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

// ─── Client input types ───────────────────────────────────────────────────

export type CreateProjectInput = {
  name: string;
  clientName?: string;
  companyName?: string;
  projectLocation?: string;
  budgetMode?: 'shared' | 'individual';
  budgetCents?: number;
  ffeBudgetCents?: number;
  takeoffBudgetCents?: number;
};

export type UpdateProjectInput = {
  name?: string;
  clientName?: string;
  companyName?: string;
  projectLocation?: string;
  budgetMode?: 'shared' | 'individual';
  budgetCents?: number;
  ffeBudgetCents?: number;
  takeoffBudgetCents?: number;
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
  roomId?: string;
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
  swatches?: string[];
  finishClassification?: 'material' | 'swatch' | 'hybrid';
};

export type UpdateMaterialInput = Partial<CreateMaterialInput>;

export type UpsertUserProfileInput = {
  name?: string;
  email?: string;
  phone?: string;
  companyName?: string;
};

export type CreateTakeoffCategoryInput = {
  name: string;
  sortOrder?: number;
};

export type UpdateTakeoffCategoryInput = {
  name?: string;
  sortOrder?: number;
};

export type CreateTakeoffItemInput = {
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
  swatches?: string[];
  cbm?: number;
  quantity?: number;
  quantityUnit?: string;
  unitCostCents?: number;
  sortOrder?: number;
};

export type UpdateTakeoffItemInput = Partial<CreateTakeoffItemInput> & {
  categoryId?: string;
  version: number;
};

// ─── Core fetch helper ────────────────────────────────────────────────────

const BASE_URL = import.meta.env.VITE_API_BASE_URL;

const buildAuthHeaders = async (init: RequestInit): Promise<Headers> => {
  const token = await getCurrentIdToken();

  const headers = new Headers(init.headers);
  if (init.body !== undefined && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (token !== undefined) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return headers;
};

const apiFetchResponse = async (path: string, init: RequestInit = {}): Promise<Response> => {
  const headers = await buildAuthHeaders(init);
  const res = await fetch(`${BASE_URL}${path}`, { ...init, headers });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const message = typeof body['message'] === 'string' ? body['message'] : res.statusText;
    throw new ApiError(res.status, message, body);
  }

  return res;
};

const apiFetch = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
  const res = await apiFetchResponse(path, init);

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
          company_name: input.companyName ?? '',
          project_location: input.projectLocation ?? '',
          budget_mode: input.budgetMode ?? 'shared',
          budget_cents: input.budgetCents ?? 0,
          ffe_budget_cents: input.ffeBudgetCents ?? 0,
          takeoff_budget_cents: input.takeoffBudgetCents ?? 0,
        }),
      }).then((r) => mapProject(r.project)),

    update: (id: string, patch: UpdateProjectInput): Promise<Project> =>
      apiFetch<{ project: RawProject }>(`/api/v1/projects/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: patch.name,
          client_name: patch.clientName,
          company_name: patch.companyName,
          project_location: patch.projectLocation,
          budget_mode: patch.budgetMode,
          budget_cents: patch.budgetCents,
          ffe_budget_cents: patch.ffeBudgetCents,
          takeoff_budget_cents: patch.takeoffBudgetCents,
        }),
      }).then((r) => mapProject(r.project)),

    delete: (id: string): Promise<void> =>
      apiFetch<void>(`/api/v1/projects/${id}`, { method: 'DELETE' }),
  },
  users: {
    me: (): Promise<UserProfile> =>
      apiFetch<{ profile: RawUserProfile }>('/api/v1/users/me').then((r) =>
        mapUserProfile(r.profile),
      ),

    updateMe: (input: UpsertUserProfileInput): Promise<UserProfile> =>
      apiFetch<{ profile: RawUserProfile }>('/api/v1/users/me', {
        method: 'PUT',
        body: JSON.stringify({
          name: input.name ?? '',
          email: input.email ?? '',
          phone: input.phone ?? '',
          company_name: input.companyName ?? '',
        }),
      }).then((r) => mapUserProfile(r.profile)),
  },

  takeoff: {
    categories: (projectId: string): Promise<TakeoffCategory[]> =>
      apiFetch<{ categories: RawTakeoffCategory[] }>(
        `/api/v1/projects/${projectId}/takeoff/categories`,
      ).then((r) => r.categories.map(mapTakeoffCategory)),

    createCategory: (
      projectId: string,
      input: CreateTakeoffCategoryInput,
    ): Promise<TakeoffCategory> =>
      apiFetch<{ category: RawTakeoffCategory }>(
        `/api/v1/projects/${projectId}/takeoff/categories`,
        {
          method: 'POST',
          body: JSON.stringify({
            name: input.name,
            sort_order: input.sortOrder ?? 0,
          }),
        },
      ).then((r) => mapTakeoffCategory(r.category)),

    updateCategory: (id: string, patch: UpdateTakeoffCategoryInput): Promise<TakeoffCategory> =>
      apiFetch<{ category: RawTakeoffCategory }>(`/api/v1/takeoff/categories/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: patch.name,
          sort_order: patch.sortOrder,
        }),
      }).then((r) => mapTakeoffCategory(r.category)),

    deleteCategory: (id: string): Promise<void> =>
      apiFetch<void>(`/api/v1/takeoff/categories/${id}`, { method: 'DELETE' }),

    items: (categoryId: string): Promise<TakeoffItem[]> =>
      apiFetch<{ items: RawTakeoffItem[] }>(`/api/v1/takeoff/categories/${categoryId}/items`).then(
        (r) => r.items.map(mapTakeoffItem),
      ),

    createItem: (categoryId: string, input: CreateTakeoffItemInput): Promise<TakeoffItem> =>
      apiFetch<{ item: RawTakeoffItem }>(`/api/v1/takeoff/categories/${categoryId}/items`, {
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
          swatches: input.swatches ?? [],
          cbm: input.cbm ?? 0,
          quantity: input.quantity ?? 1,
          quantity_unit: input.quantityUnit ?? 'unit',
          unit_cost_cents: input.unitCostCents ?? 0,
          sort_order: input.sortOrder ?? 0,
        }),
      }).then((r) => mapTakeoffItem(r.item)),

    updateItem: (id: string, patch: UpdateTakeoffItemInput): Promise<TakeoffItem> =>
      apiFetch<{ item: RawTakeoffItem }>(`/api/v1/takeoff/items/${id}`, {
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
          swatches: patch.swatches,
          cbm: patch.cbm,
          quantity: patch.quantity,
          quantity_unit: patch.quantityUnit,
          unit_cost_cents: patch.unitCostCents,
          sort_order: patch.sortOrder,
          version: patch.version,
        }),
      }).then((r) => mapTakeoffItem(r.item)),

    deleteItem: (id: string): Promise<void> =>
      apiFetch<void>(`/api/v1/takeoff/items/${id}`, { method: 'DELETE' }),
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
          room_id: patch.roomId,
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
          swatches: input.swatches,
          finish_classification: input.finishClassification ?? 'material',
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
          swatches: patch.swatches,
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
          swatches: input.swatches,
          finish_classification: input.finishClassification ?? 'material',
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

    assignToTakeoffItem: (takeoffItemId: string, materialId: string): Promise<Material> =>
      apiFetch<{ material: RawMaterial }>(`/api/v1/takeoff/items/${takeoffItemId}/materials`, {
        method: 'POST',
        body: JSON.stringify({ material_id: materialId }),
      }).then((r) => mapMaterial(r.material)),

    createAndAssignToTakeoffItem: (
      takeoffItemId: string,
      input: CreateMaterialInput,
    ): Promise<Material> =>
      apiFetch<{ material: RawMaterial }>(`/api/v1/takeoff/items/${takeoffItemId}/materials/new`, {
        method: 'POST',
        body: JSON.stringify({
          name: input.name,
          material_id: input.materialId,
          description: input.description,
          finish_classification: input.finishClassification ?? 'swatch',
        }),
      }).then((r) => mapMaterial(r.material)),

    removeFromTakeoffItem: (takeoffItemId: string, materialId: string): Promise<void> =>
      apiFetch<void>(`/api/v1/takeoff/items/${takeoffItemId}/materials/${materialId}`, {
        method: 'DELETE',
      }),

    updateForTakeoffItem: (
      takeoffItemId: string,
      materialId: string,
      patch: UpdateMaterialInput,
    ): Promise<Material> =>
      apiFetch<{ material: RawMaterial }>(
        `/api/v1/takeoff/items/${takeoffItemId}/materials/${materialId}`,
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
