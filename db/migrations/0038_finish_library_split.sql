-- Migration: 0038_finish_library_split
-- Splits the unified materials table into two distinct concepts:
--   - finishes: project-scoped visual references (the reusable library)
--   - materials: project-specific application entries that reference a finish
-- Adds a mandatory unique `code` field to both tables (auto-generated per-project).
-- Adds `material_type` enum to materials for construction type (veneer, laminate, etc.).
-- Migrates existing material rows into finishes and re-points images accordingly.
-- See plan: address-the-following-questions-jiggly-naur.md

-- ─── 1. Create finishes table ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS finishes (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   uuid        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  code         text        NOT NULL DEFAULT '',
  name         text        NOT NULL,
  category     text        CHECK (category IN ('wood','metal','stone','glass','fabric','solid_color')),
  sub_category text        NOT NULL DEFAULT '',
  description  text        NOT NULL DEFAULT '',
  manufacturer text        NOT NULL DEFAULT '',
  source_url   text        NOT NULL DEFAULT '',
  swatch_hex   text        NOT NULL DEFAULT '#D9D4C8',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT finishes_swatch_hex_chk CHECK (swatch_hex ~ '^#[0-9A-Fa-f]{6}$')
);

CREATE INDEX IF NOT EXISTS finishes_project_id_idx
  ON finishes(project_id);

CREATE UNIQUE INDEX IF NOT EXISTS finishes_project_name_idx
  ON finishes(project_id, lower(name));

CREATE UNIQUE INDEX IF NOT EXISTS finishes_project_code_idx
  ON finishes(project_id, code);

CREATE OR REPLACE TRIGGER finishes_updated_at
  BEFORE UPDATE ON finishes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── 2. Add new columns to materials ─────────────────────────────────────────
--   finish_id: optional FK to the finish this material is based on
--   material_type: optional construction type enum
--   code: mandatory unique project-scoped identifier (populated below)

ALTER TABLE materials
  ADD COLUMN IF NOT EXISTS finish_id     uuid REFERENCES finishes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS material_type text CHECK (material_type IN (
    'veneer','laminate','solid','powder_coat','anodized',
    'upholstery','stone_slab','glass','painted','stained'
  )),
  ADD COLUMN IF NOT EXISTS code          text;

-- ─── 3. Add finish_id column to image_assets ─────────────────────────────────

ALTER TABLE image_assets
  ADD COLUMN IF NOT EXISTS finish_id uuid REFERENCES finishes(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS image_assets_finish_id_idx
  ON image_assets(finish_id) WHERE finish_id IS NOT NULL;

-- ─── 4. Migrate existing materials → finishes ────────────────────────────────
-- Each existing material row becomes a finish with a sequential code.
-- Codes are 1-based integers per project ordered by creation time then name.

WITH ranked AS (
  SELECT
    id,
    project_id,
    name,
    category,
    COALESCE(sub_category, '') AS sub_category,
    description,
    COALESCE(manufacturer, '') AS manufacturer,
    COALESCE(source_url, '')   AS source_url,
    swatch_hex,
    created_at,
    updated_at,
    ROW_NUMBER() OVER (PARTITION BY project_id ORDER BY created_at, lower(name)) AS rn
  FROM materials
),
inserted AS (
  INSERT INTO finishes (
    code, project_id, name, category, sub_category, description,
    manufacturer, source_url, swatch_hex, created_at, updated_at
  )
  SELECT
    rn::text,
    project_id, name, category, sub_category, description,
    manufacturer, source_url, swatch_hex, created_at, updated_at
  FROM ranked
  RETURNING id, project_id, name
)
UPDATE materials m
SET finish_id = ins.id
FROM inserted ins
WHERE ins.project_id = m.project_id AND ins.name = m.name;

-- ─── 5. Populate code on materials (sequential per project) ──────────────────

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY project_id ORDER BY created_at, lower(name)) AS rn
  FROM materials
)
UPDATE materials m
SET code = r.rn::text
FROM ranked r
WHERE r.id = m.id;

-- ─── 6. Update image_assets entity_type check constraint ─────────────────────
-- Must happen before converting rows to entity_type='finish' so existing
-- pre-0038 shape constraints do not reject the data rewrite.

ALTER TABLE image_assets DROP CONSTRAINT IF EXISTS image_assets_entity_type_chk;
ALTER TABLE image_assets ADD CONSTRAINT image_assets_entity_type_chk CHECK (
  entity_type IN (
    'project',
    'room',
    'item',
    'item_plan',
    'item_option',
    'material',
    'finish',
    'proposal_item',
    'proposal_swatch',
    'proposal_plan',
    'company_logo'
  )
);

-- ─── 7. Update image_assets entity_shape check constraint ────────────────────

ALTER TABLE image_assets DROP CONSTRAINT IF EXISTS image_assets_entity_shape_chk;
ALTER TABLE image_assets ADD CONSTRAINT image_assets_entity_shape_chk CHECK (
  (
    entity_type = 'project'
    AND room_id IS NULL AND item_id IS NULL AND material_id IS NULL
    AND proposal_item_id IS NULL AND finish_id IS NULL
  )
  OR (
    entity_type = 'room'
    AND room_id IS NOT NULL AND item_id IS NULL AND material_id IS NULL
    AND proposal_item_id IS NULL AND finish_id IS NULL
  )
  OR (
    entity_type IN ('item', 'item_plan', 'item_option')
    AND room_id IS NOT NULL AND item_id IS NOT NULL AND material_id IS NULL
    AND proposal_item_id IS NULL AND finish_id IS NULL
  )
  OR (
    entity_type = 'material'
    AND room_id IS NULL AND item_id IS NULL AND material_id IS NOT NULL
    AND proposal_item_id IS NULL AND finish_id IS NULL
  )
  OR (
    entity_type = 'finish'
    AND room_id IS NULL AND item_id IS NULL AND material_id IS NULL
    AND proposal_item_id IS NULL AND finish_id IS NOT NULL
  )
  OR (
    entity_type IN ('proposal_item', 'proposal_swatch', 'proposal_plan')
    AND room_id IS NULL AND item_id IS NULL AND material_id IS NULL
    AND proposal_item_id IS NOT NULL AND finish_id IS NULL
  )
  OR (
    entity_type = 'company_logo'
    AND room_id IS NULL AND item_id IS NULL AND material_id IS NULL
    AND proposal_item_id IS NULL AND finish_id IS NULL
  )
);

-- ─── 8. Migrate material swatch images → finish images ───────────────────────
-- Existing image_assets rows linked to materials via material_id become finish
-- images so the finish carries the visual reference going forward.

UPDATE image_assets ia
SET
  finish_id   = m.finish_id,
  material_id = NULL,
  entity_type = 'finish'
FROM materials m
WHERE ia.material_id = m.id
  AND m.finish_id IS NOT NULL
  AND ia.entity_type = 'material';

-- ─── 9. Make code NOT NULL on materials after population ─────────────────────

ALTER TABLE materials
  ALTER COLUMN code SET NOT NULL;

-- ─── 10. Add unique index for materials.code ──────────────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS materials_project_code_idx
  ON materials(project_id, code);

-- ─── 11. Update entity lookup index to include finish_id ─────────────────────

DROP INDEX IF EXISTS image_assets_entity_lookup_idx;
CREATE INDEX IF NOT EXISTS image_assets_entity_lookup_idx
  ON image_assets(project_id, entity_type, room_id, item_id, material_id, proposal_item_id, finish_id, is_primary);

-- ─── 12. Add primary image unique index for finishes ─────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS image_assets_primary_finish_idx
  ON image_assets(finish_id, entity_type)
  WHERE is_primary AND entity_type = 'finish';
