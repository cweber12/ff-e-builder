// ─── Cloudflare Worker environment bindings ───────────────────────────────
export interface Env {
  /** Public Firebase project ID — safe in [vars] */
  FIREBASE_PROJECT_ID: string;
  /** Service account email — Worker secret */
  FIREBASE_ADMIN_CLIENT_EMAIL: string;
  /** Service account private key (PEM) — Worker secret */
  FIREBASE_ADMIN_PRIVATE_KEY: string;
  /** Neon serverless connection string — Worker secret */
  NEON_DATABASE_URL: string;
  IMAGES_BUCKET: R2Bucket;
  /** Comma-separated list of authorized emails — Worker secret */
  AUTHORIZED_EMAILS?: string;
}

// ─── Hono context variables ────────────────────────────────────────────────
export interface HonoVariables {
  /** Firebase UID of the authenticated user */
  uid: string;
  /** Email from the Firebase ID token (null if provider omits it) */
  email: string | null;
  /** Whether the authenticated user is on the authorized email allowlist */
  isAuthorized: boolean;
}

// ─── Database entity types ─────────────────────────────────────────────────

export interface Project {
  id: string;
  owner_uid: string;
  name: string;
  client_name: string;
  company_name: string;
  project_location: string;
  budget_mode: 'shared' | 'individual';
  /** Always integer cents — see /docs/money.md */
  budget_cents: number;
  /** Always integer cents - see /docs/money.md */
  ffe_budget_cents: number;
  /** Always integer cents - see /docs/money.md */
  proposal_budget_cents: number;
  created_at: string;
  updated_at: string;
}

export interface Room {
  id: string;
  project_id: string;
  name: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Item {
  id: string;
  room_id: string;
  item_name: string;
  description: string | null;
  category: string | null;
  vendor: string | null;
  model: string | null;
  item_id_tag: string | null;
  dimensions: string | null;
  seat_height: string | null;
  finishes: string | null;
  notes: string | null;
  qty: number;
  /** Always integer cents — see /docs/money.md */
  unit_cost_cents: number;
  /**
   * numeric(5,2) — Postgres returns this as a string.
   * Parse with parseFloat only at the display layer.
   */
  markup_pct: string;
  lead_time: string | null;
  status: 'pending' | 'ordered' | 'approved' | 'received';
  image_url: string | null;
  link_url: string | null;
  sort_order: number;
  /** Optimistic concurrency version counter */
  version: number;
  created_at: string;
  updated_at: string;
  materials?: Material[];
}

export interface Material {
  id: string;
  project_id: string;
  name: string;
  material_id: string;
  description: string;
  swatch_hex: string;
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  owner_uid: string;
  name: string;
  email: string;
  phone: string;
  company_name: string;
  created_at: string;
  updated_at: string;
}

export interface ProposalCategory {
  id: string;
  project_id: string;
  name: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ProposalItem {
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
  materials: Material[];
  cbm: string;
  quantity: string;
  quantity_unit: string;
  unit_cost_cents: number;
  sort_order: number;
  version: number;
  created_at: string;
  updated_at: string;
}

export type CalibrationStatus = 'uncalibrated' | 'calibrated';

export interface MeasuredPlan {
  id: string;
  project_id: string;
  owner_uid: string;
  name: string;
  sheet_reference: string;
  image_r2_key: string;
  image_filename: string;
  image_content_type: string;
  image_byte_size: number;
  created_at: string;
  updated_at: string;
}

export interface PlanCalibration {
  id: string;
  measured_plan_id: string;
  start_x: number;
  start_y: number;
  end_x: number;
  end_y: number;
  real_world_length: string;
  unit: 'in' | 'ft' | 'mm' | 'cm' | 'm';
  pixels_per_unit: string;
  created_at: string;
  updated_at: string;
}

export interface LengthLine {
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

export interface Measurement {
  id: string;
  measured_plan_id: string;
  target_kind: 'ffe' | 'proposal';
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

export type ImageEntityType =
  | 'project'
  | 'room'
  | 'item'
  | 'item_option'
  | 'material'
  | 'proposal_item'
  | 'proposal_swatch'
  | 'proposal_plan';

export interface ImageAsset {
  id: string;
  entity_type: ImageEntityType;
  owner_uid: string;
  project_id: string;
  room_id: string | null;
  item_id: string | null;
  material_id: string | null;
  proposal_item_id: string | null;
  r2_key: string;
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

// ─── Zod input schemas (co-located with types for easy import) ─────────────
import { z } from 'zod';

// Intentionally duplicated from src/types/itemValidation to keep the API worker
// self-contained and avoid cross-boundary imports from the React client bundle.
const itemStatuses = ['pending', 'ordered', 'approved', 'received'] as const;
const budgetModes = ['shared', 'individual'] as const;
const sizeModes = ['imperial', 'metric'] as const;
const calibrationStatuses = ['uncalibrated', 'calibrated'] as const;
const planMeasurementUnits = ['in', 'ft', 'mm', 'cm', 'm'] as const;

export const CreateProjectSchema = z.object({
  name: z.string().min(1).max(255),
  client_name: z.string().max(255).default(''),
  company_name: z.string().max(255).default(''),
  project_location: z.string().max(255).default(''),
  budget_mode: z.enum(budgetModes).default('shared'),
  budget_cents: z.number().int().nonnegative().default(0),
  ffe_budget_cents: z.number().int().nonnegative().default(0),
  proposal_budget_cents: z.number().int().nonnegative().default(0),
});
export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;

export const UpdateProjectSchema = CreateProjectSchema.partial();
export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>;

export const CreateRoomSchema = z.object({
  name: z.string().min(1).max(255),
  sort_order: z.number().int().nonnegative().default(0),
});
export type CreateRoomInput = z.infer<typeof CreateRoomSchema>;

export const UpdateRoomSchema = CreateRoomSchema.partial();
export type UpdateRoomInput = z.infer<typeof UpdateRoomSchema>;

export const CreateItemSchema = z.object({
  room_id: z.string().uuid().optional(),
  item_name: z.string().min(1).max(255),
  description: z.string().max(4000).nullable().default(null),
  category: z.string().max(100).nullable().default(null),
  item_id_tag: z.string().max(100).nullable().default(null),
  dimensions: z.string().max(100).nullable().default(null),
  seat_height: z.string().max(100).nullable().default(null),
  notes: z.string().nullable().default(null),
  qty: z.number().int().nonnegative().default(1),
  unit_cost_cents: z.number().int().nonnegative().default(0),
  lead_time: z.string().max(100).nullable().default(null),
  status: z.enum(itemStatuses).default('pending'),
  image_url: z.string().url().nullable().default(null),
  link_url: z.string().url().nullable().default(null),
  sort_order: z.number().int().nonnegative().default(0),
});
export type CreateItemInput = z.infer<typeof CreateItemSchema>;

export const UpdateItemSchema = CreateItemSchema.partial().extend({
  version: z.number().int().nonnegative(),
});
export type UpdateItemInput = z.infer<typeof UpdateItemSchema>;

const SwatchHexSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/);

export const CreateMaterialSchema = z.object({
  name: z.string().max(255).default(''),
  material_id: z.string().max(100).default(''),
  description: z.string().max(1000).default(''),
  swatch_hex: SwatchHexSchema.default('#D9D4C8'),
});
export type CreateMaterialInput = z.infer<typeof CreateMaterialSchema>;

export const UpdateMaterialSchema = CreateMaterialSchema.partial();
export type UpdateMaterialInput = z.infer<typeof UpdateMaterialSchema>;

export const AssignMaterialSchema = z.object({
  material_id: z.string().uuid(),
});

export const CreateAndAssignMaterialSchema = CreateMaterialSchema;

export const UpsertUserProfileSchema = z.object({
  name: z.string().max(255).default(''),
  email: z.string().email().or(z.literal('')).default(''),
  phone: z.string().max(100).default(''),
  company_name: z.string().max(255).default(''),
});
export type UpsertUserProfileInput = z.infer<typeof UpsertUserProfileSchema>;

export const CreateProposalCategorySchema = z.object({
  name: z.string().min(1).max(100),
  sort_order: z.number().int().nonnegative().default(0),
});
export type CreateProposalCategoryInput = z.infer<typeof CreateProposalCategorySchema>;

export const UpdateProposalCategorySchema = CreateProposalCategorySchema.partial();
export type UpdateProposalCategoryInput = z.infer<typeof UpdateProposalCategorySchema>;

export const CreateProposalItemSchema = z.object({
  category_id: z.string().uuid().optional(),
  product_tag: z.string().max(100).default(''),
  plan: z.string().max(255).default(''),
  drawings: z.string().max(255).default(''),
  location: z.string().max(255).default(''),
  description: z.string().max(1000).default(''),
  size_label: z.string().max(255).default(''),
  size_mode: z.enum(sizeModes).default('imperial'),
  size_w: z.string().max(50).default(''),
  size_d: z.string().max(50).default(''),
  size_h: z.string().max(50).default(''),
  size_unit: z.string().max(20).default('in'),
  cbm: z.number().nonnegative().default(0),
  quantity: z.number().nonnegative().default(1),
  quantity_unit: z.string().max(50).default('unit'),
  unit_cost_cents: z.number().int().nonnegative().default(0),
  sort_order: z.number().int().nonnegative().default(0),
});
export type CreateProposalItemInput = z.infer<typeof CreateProposalItemSchema>;

export const UpdateProposalItemSchema = CreateProposalItemSchema.partial().extend({
  version: z.number().int().nonnegative(),
});
export type UpdateProposalItemInput = z.infer<typeof UpdateProposalItemSchema>;

export const CreateMeasuredPlanSchema = z.object({
  name: z.string().min(1).max(255),
  sheet_reference: z.string().max(100).default(''),
});
export type CreateMeasuredPlanInput = z.infer<typeof CreateMeasuredPlanSchema>;

export const UpdatePlanCalibrationSchema = z.object({
  start_x: z.number().min(0).max(1),
  start_y: z.number().min(0).max(1),
  end_x: z.number().min(0).max(1),
  end_y: z.number().min(0).max(1),
  real_world_length: z.number().positive(),
  unit: z.enum(planMeasurementUnits),
  pixels_per_unit: z.number().positive(),
});
export type UpdatePlanCalibrationInput = z.infer<typeof UpdatePlanCalibrationSchema>;

export const CalibrationStatusSchema = z.enum(calibrationStatuses);
export type CalibrationStatusInput = z.infer<typeof CalibrationStatusSchema>;

export const ImageEntitySchema = z.object({
  entity_type: z.enum([
    'project',
    'room',
    'item',
    'item_option',
    'material',
    'proposal_item',
    'proposal_swatch',
    'proposal_plan',
  ]),
  entity_id: z.string().uuid(),
});

export const ImageUploadQuerySchema = ImageEntitySchema.extend({
  alt_text: z.string().max(500).optional().default(''),
});

export const ImageListQuerySchema = ImageEntitySchema;
