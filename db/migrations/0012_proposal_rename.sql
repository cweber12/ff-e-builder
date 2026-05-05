-- Migration: 0012_proposal_rename
-- Renames takeoff_* tables/columns to proposal_* to reflect "Proposal" feature rename.
-- Apply via: pnpm db:migrate

-- ── Step 1: Drop all constraints and indexes that reference old names ─────────
-- Must happen before any renames or entity_type updates, because both
-- image_assets_entity_type_chk and image_assets_entity_shape_chk reference
-- the old entity_type string values and the takeoff_item_id column.

ALTER TABLE image_assets DROP CONSTRAINT IF EXISTS image_assets_entity_type_chk;
ALTER TABLE image_assets DROP CONSTRAINT IF EXISTS image_assets_entity_shape_chk;

DROP INDEX IF EXISTS image_assets_primary_takeoff_item_idx;
DROP INDEX IF EXISTS image_assets_primary_takeoff_plan_idx;
DROP INDEX IF EXISTS image_assets_entity_lookup_idx;
DROP INDEX IF EXISTS image_assets_takeoff_item_id_idx;

-- ── Step 2: Rename tables ────────────────────────────────────────────────────

ALTER TABLE takeoff_categories     RENAME TO proposal_categories;
ALTER TABLE takeoff_items          RENAME TO proposal_items;
ALTER TABLE takeoff_item_materials RENAME TO proposal_item_materials;

-- ── Step 3: Rename columns ───────────────────────────────────────────────────

ALTER TABLE projects     RENAME COLUMN takeoff_budget_cents TO proposal_budget_cents;
ALTER TABLE image_assets RENAME COLUMN takeoff_item_id      TO proposal_item_id;
ALTER TABLE proposal_item_materials RENAME COLUMN takeoff_item_id TO proposal_item_id;

-- ── Step 4: Update entity_type string values in existing rows ────────────────

UPDATE image_assets SET entity_type = 'proposal_item'   WHERE entity_type = 'takeoff_item';
UPDATE image_assets SET entity_type = 'proposal_swatch' WHERE entity_type = 'takeoff_swatch';
UPDATE image_assets SET entity_type = 'proposal_plan'   WHERE entity_type = 'takeoff_plan';

-- ── Step 5: Recreate constraints with new names/values ───────────────────────

ALTER TABLE image_assets ADD CONSTRAINT image_assets_entity_type_chk CHECK (
  entity_type IN (
    'project',
    'room',
    'item',
    'material',
    'proposal_item',
    'proposal_swatch',
    'proposal_plan'
  )
);

ALTER TABLE image_assets ADD CONSTRAINT image_assets_entity_shape_chk CHECK (
  (
    entity_type = 'project'
    AND room_id IS NULL AND item_id IS NULL AND material_id IS NULL AND proposal_item_id IS NULL
  )
  OR (
    entity_type = 'room'
    AND room_id IS NOT NULL AND item_id IS NULL AND material_id IS NULL AND proposal_item_id IS NULL
  )
  OR (
    entity_type = 'item'
    AND room_id IS NOT NULL AND item_id IS NOT NULL AND material_id IS NULL AND proposal_item_id IS NULL
  )
  OR (
    entity_type = 'material'
    AND room_id IS NULL AND item_id IS NULL AND material_id IS NOT NULL AND proposal_item_id IS NULL
  )
  OR (
    entity_type IN ('proposal_item', 'proposal_swatch', 'proposal_plan')
    AND room_id IS NULL AND item_id IS NULL AND material_id IS NULL AND proposal_item_id IS NOT NULL
  )
);

-- ── Step 6: Recreate indexes ─────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS image_assets_entity_lookup_idx
  ON image_assets(project_id, entity_type, room_id, item_id, material_id, proposal_item_id, is_primary);

CREATE INDEX IF NOT EXISTS image_assets_proposal_item_id_idx
  ON image_assets(proposal_item_id) WHERE proposal_item_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS image_assets_primary_proposal_item_idx
  ON image_assets(proposal_item_id, entity_type)
  WHERE is_primary AND entity_type = 'proposal_item';

CREATE UNIQUE INDEX IF NOT EXISTS image_assets_primary_proposal_plan_idx
  ON image_assets(proposal_item_id, entity_type)
  WHERE is_primary AND entity_type = 'proposal_plan';

-- ── Step 7: Rename remaining indexes and triggers ────────────────────────────

DROP INDEX IF EXISTS projects_budget_idx;
CREATE INDEX IF NOT EXISTS projects_budget_idx
  ON projects(owner_uid, budget_mode, budget_cents, ffe_budget_cents, proposal_budget_cents);

ALTER INDEX IF EXISTS takeoff_categories_project_id_idx RENAME TO proposal_categories_project_id_idx;
ALTER INDEX IF EXISTS takeoff_items_category_id_idx     RENAME TO proposal_items_category_id_idx;
ALTER INDEX IF EXISTS takeoff_item_materials_material_id_idx RENAME TO proposal_item_materials_material_id_idx;
ALTER INDEX IF EXISTS takeoff_item_materials_item_sort_idx   RENAME TO proposal_item_materials_item_sort_idx;

ALTER TRIGGER takeoff_categories_updated_at ON proposal_categories RENAME TO proposal_categories_updated_at;
ALTER TRIGGER takeoff_items_updated_at      ON proposal_items      RENAME TO proposal_items_updated_at;
