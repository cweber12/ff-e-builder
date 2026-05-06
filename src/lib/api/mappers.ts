import type {
  ImageAsset,
  ImageEntityType,
  Item,
  ItemStatus,
  Material,
  Project,
  ProposalCategory,
  ProposalItem,
  Room,
  UserProfile,
} from '../../types';

export interface RawProject {
  id: string;
  owner_uid: string;
  name: string;
  client_name: string;
  company_name: string;
  project_location: string;
  budget_mode: 'shared' | 'individual';
  budget_cents: number;
  ffe_budget_cents: number;
  proposal_budget_cents: number;
  created_at: string;
  updated_at: string;
}

export interface RawRoom {
  id: string;
  project_id: string;
  name: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface RawItem {
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

export interface RawImageAsset {
  id: string;
  entity_type: ImageEntityType;
  owner_uid: string;
  project_id: string;
  room_id: string | null;
  item_id: string | null;
  material_id: string | null;
  proposal_item_id: string | null;
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

export interface RawUserProfile {
  owner_uid: string;
  name: string;
  email: string;
  phone: string;
  company_name: string;
  created_at: string;
  updated_at: string;
}

export interface RawProposalCategory {
  id: string;
  project_id: string;
  name: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface RawProposalItem {
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

export interface RawMaterial {
  id: string;
  project_id: string;
  name: string;
  material_id: string;
  description: string;
  swatch_hex: string;
  created_at: string;
  updated_at: string;
}

// Response mappers
export const mapProject = (r: RawProject): Project => ({
  id: r.id,
  ownerUid: r.owner_uid,
  name: r.name,
  clientName: r.client_name,
  companyName: r.company_name ?? '',
  projectLocation: r.project_location ?? '',
  budgetMode: r.budget_mode ?? 'shared',
  budgetCents: r.budget_cents,
  ffeBudgetCents: r.ffe_budget_cents ?? 0,
  proposalBudgetCents: r.proposal_budget_cents ?? 0,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export const mapRoom = (r: RawRoom): Room => ({
  id: r.id,
  projectId: r.project_id,
  name: r.name,
  sortOrder: r.sort_order,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export const mapItem = (r: RawItem): Item => ({
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

export const mapImageAsset = (r: RawImageAsset): ImageAsset => ({
  id: r.id,
  entityType: r.entity_type,
  ownerUid: r.owner_uid,
  projectId: r.project_id,
  roomId: r.room_id,
  itemId: r.item_id,
  materialId: r.material_id ?? null,
  proposalItemId: r.proposal_item_id ?? null,
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

export const mapUserProfile = (r: RawUserProfile, authorized = false): UserProfile => ({
  ownerUid: r.owner_uid,
  name: r.name,
  email: r.email,
  phone: r.phone,
  companyName: r.company_name,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  authorized,
});

export const mapProposalCategory = (r: RawProposalCategory): ProposalCategory => ({
  id: r.id,
  projectId: r.project_id,
  name: r.name,
  sortOrder: r.sort_order,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export const mapProposalItem = (r: RawProposalItem): ProposalItem => ({
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
  sizeUnit: r.size_unit as ProposalItem['sizeUnit'],
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

export const mapMaterial = (r: RawMaterial): Material => ({
  id: r.id,
  projectId: r.project_id,
  name: r.name,
  materialId: r.material_id,
  description: r.description,
  swatchHex: r.swatch_hex,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});
