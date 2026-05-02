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
}

// ─── Hono context variables ────────────────────────────────────────────────
export interface HonoVariables {
  /** Firebase UID of the authenticated user */
  uid: string;
}

// ─── Database entity types ─────────────────────────────────────────────────

export interface Project {
  id: string;
  owner_uid: string;
  name: string;
  client_name: string;
  /** Always integer cents — see /docs/money.md */
  budget_cents: number;
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
  swatches?: string[];
  created_at: string;
  updated_at: string;
}

export type ImageEntityType = 'project' | 'room' | 'item' | 'material';

export interface ImageAsset {
  id: string;
  owner_uid: string;
  project_id: string;
  room_id: string | null;
  item_id: string | null;
  material_id: string | null;
  r2_key: string;
  filename: string;
  content_type: string;
  byte_size: number;
  alt_text: string;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

// ─── Zod input schemas (co-located with types for easy import) ─────────────
import { z } from 'zod';

// Intentionally duplicated from src/types/itemValidation to keep the API worker
// self-contained and avoid cross-boundary imports from the React client bundle.
const itemStatuses = ['pending', 'ordered', 'approved', 'received'] as const;

export const CreateProjectSchema = z.object({
  name: z.string().min(1).max(255),
  client_name: z.string().max(255).default(''),
  budget_cents: z.number().int().nonnegative().default(0),
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
  category: z.string().max(100).nullable().default(null),
  vendor: z.string().max(255).nullable().default(null),
  model: z.string().max(255).nullable().default(null),
  item_id_tag: z.string().max(100).nullable().default(null),
  dimensions: z.string().max(100).nullable().default(null),
  seat_height: z.string().max(100).nullable().default(null),
  finishes: z.string().max(255).nullable().default(null),
  notes: z.string().nullable().default(null),
  qty: z.number().int().nonnegative().default(1),
  unit_cost_cents: z.number().int().nonnegative().default(0),
  markup_pct: z.number().nonnegative().default(0),
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
  name: z.string().min(1).max(255),
  material_id: z.string().max(100).default(''),
  description: z.string().max(1000).default(''),
  swatch_hex: SwatchHexSchema.default('#D9D4C8'),
  swatches: z.array(SwatchHexSchema).max(12).optional(),
});
export type CreateMaterialInput = z.infer<typeof CreateMaterialSchema>;

export const UpdateMaterialSchema = CreateMaterialSchema.partial();
export type UpdateMaterialInput = z.infer<typeof UpdateMaterialSchema>;

export const AssignMaterialSchema = z.object({
  material_id: z.string().uuid(),
});

export const CreateAndAssignMaterialSchema = CreateMaterialSchema;

export const ImageEntitySchema = z.object({
  entity_type: z.enum(['project', 'room', 'item', 'material']),
  entity_id: z.string().uuid(),
});

export const ImageUploadQuerySchema = ImageEntitySchema.extend({
  alt_text: z.string().max(500).optional().default(''),
});

export const ImageListQuerySchema = ImageEntitySchema;
