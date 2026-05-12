import type {
  CalibrationStatus,
  ImageAsset,
  ImageEntityType,
  Item,
  CustomColumnDef,
  ItemStatus,
  LengthLine,
  Measurement,
  PlanCalibration,
  Material,
  MeasuredPlan,
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
  description: string | null;
  category: string | null;
  item_id_tag: string | null;
  dimensions: string | null;
  notes: string | null;
  qty: number;
  unit_cost_cents: number;
  lead_time: string | null;
  status: ItemStatus;
  custom_data: Record<string, string>;
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
  notes: string;
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
  custom_data: Record<string, string>;
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

export interface RawMeasuredPlan {
  id: string;
  project_id: string;
  owner_uid: string;
  name: string;
  sheet_reference: string;
  source_type: MeasuredPlan['sourceType'];
  image_filename: string;
  image_content_type: string;
  image_byte_size: number;
  pdf_filename: string | null;
  pdf_content_type: string | null;
  pdf_byte_size: number | null;
  pdf_page_number: number | null;
  pdf_page_width_pt: string | null;
  pdf_page_height_pt: string | null;
  pdf_render_scale: string | null;
  pdf_rendered_width_px: number | null;
  pdf_rendered_height_px: number | null;
  pdf_rotation: number | null;
  calibration_status: CalibrationStatus;
  measurement_count: number;
  created_at: string;
  updated_at: string;
}

export interface RawPlanCalibration {
  id: string;
  measured_plan_id: string;
  start_x: number;
  start_y: number;
  end_x: number;
  end_y: number;
  real_world_length: string;
  unit: PlanCalibration['unit'];
  pixels_per_unit: string;
  created_at: string;
  updated_at: string;
}

export interface RawLengthLine {
  id: string;
  measured_plan_id: string;
  start_x: number;
  start_y: number;
  end_x: number;
  end_y: number;
  measured_length_base: string | null;
  label: string | null;
  created_at: string;
  updated_at: string;
}

export interface RawMeasurement {
  id: string;
  measured_plan_id: string;
  target_kind: Measurement['targetKind'];
  target_item_id: string;
  target_tag_snapshot: string;
  rect_x: number;
  rect_y: number;
  rect_width: number;
  rect_height: number;
  horizontal_span_base: string;
  vertical_span_base: string;
  crop_x: number | null;
  crop_y: number | null;
  crop_width: number | null;
  crop_height: number | null;
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
  description: r.description,
  category: r.category,
  itemIdTag: r.item_id_tag,
  dimensions: r.dimensions,
  notes: r.notes,
  qty: r.qty,
  unitCostCents: r.unit_cost_cents,
  leadTime: r.lead_time,
  status: r.status,
  customData: r.custom_data ?? {},
  sortOrder: r.sort_order,
  version: r.version,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  materials: (r.materials ?? []).map(mapMaterial),
});

export interface RawItemColumnDef {
  id: string;
  project_id: string;
  label: string;
  sort_order: number;
  table_type: 'ffe' | 'proposal';
  created_at: string;
  updated_at: string;
}

export const mapItemColumnDef = (r: RawItemColumnDef): CustomColumnDef => ({
  id: r.id,
  projectId: r.project_id,
  label: r.label,
  sortOrder: r.sort_order,
  tableType: r.table_type,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
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
  notes: r.notes,
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
  customData: r.custom_data ?? {},
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

export const mapMeasuredPlan = (r: RawMeasuredPlan): MeasuredPlan => ({
  id: r.id,
  projectId: r.project_id,
  ownerUid: r.owner_uid,
  name: r.name,
  sheetReference: r.sheet_reference ?? '',
  sourceType: r.source_type ?? 'image',
  imageFilename: r.image_filename,
  imageContentType: r.image_content_type,
  imageByteSize: r.image_byte_size,
  pdfFilename: r.pdf_filename,
  pdfContentType: r.pdf_content_type,
  pdfByteSize: r.pdf_byte_size,
  pdfPageNumber: r.pdf_page_number,
  pdfPageWidthPt: r.pdf_page_width_pt === null ? null : Number(r.pdf_page_width_pt),
  pdfPageHeightPt: r.pdf_page_height_pt === null ? null : Number(r.pdf_page_height_pt),
  pdfRenderScale: r.pdf_render_scale === null ? null : Number(r.pdf_render_scale),
  pdfRenderedWidthPx: r.pdf_rendered_width_px,
  pdfRenderedHeightPx: r.pdf_rendered_height_px,
  pdfRotation: r.pdf_rotation,
  calibrationStatus: r.calibration_status,
  measurementCount: r.measurement_count,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export const mapPlanCalibration = (r: RawPlanCalibration): PlanCalibration => ({
  id: r.id,
  measuredPlanId: r.measured_plan_id,
  startX: r.start_x,
  startY: r.start_y,
  endX: r.end_x,
  endY: r.end_y,
  realWorldLength: Number(r.real_world_length),
  unit: r.unit,
  pixelsPerUnit: Number(r.pixels_per_unit),
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export const mapLengthLine = (r: RawLengthLine): LengthLine => ({
  id: r.id,
  measuredPlanId: r.measured_plan_id,
  startX: r.start_x,
  startY: r.start_y,
  endX: r.end_x,
  endY: r.end_y,
  measuredLengthBase: r.measured_length_base === null ? null : Number(r.measured_length_base),
  label: r.label,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export const mapMeasurement = (r: RawMeasurement): Measurement => ({
  id: r.id,
  measuredPlanId: r.measured_plan_id,
  targetKind: r.target_kind,
  targetItemId: r.target_item_id,
  targetTagSnapshot: r.target_tag_snapshot,
  rectX: r.rect_x,
  rectY: r.rect_y,
  rectWidth: r.rect_width,
  rectHeight: r.rect_height,
  horizontalSpanBase: Number(r.horizontal_span_base),
  verticalSpanBase: Number(r.vertical_span_base),
  cropX: r.crop_x,
  cropY: r.crop_y,
  cropWidth: r.crop_width,
  cropHeight: r.crop_height,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});
