-- Migration: 0003_material_library
-- Adds project-scoped material library entries and many-to-many item assignments.

CREATE TABLE IF NOT EXISTS materials (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  material_id text        NOT NULL DEFAULT '',
  description text        NOT NULL DEFAULT '',
  swatch_hex  text        NOT NULL DEFAULT '#D9D4C8',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT materials_swatch_hex_chk CHECK (swatch_hex ~ '^#[0-9A-Fa-f]{6}$')
);

CREATE INDEX IF NOT EXISTS materials_project_id_idx ON materials(project_id);
CREATE UNIQUE INDEX IF NOT EXISTS materials_project_name_idx
  ON materials(project_id, lower(name));

CREATE TABLE IF NOT EXISTS item_materials (
  item_id     uuid        NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  material_id uuid        NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  sort_order  integer     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (item_id, material_id)
);

CREATE INDEX IF NOT EXISTS item_materials_material_id_idx ON item_materials(material_id);
CREATE INDEX IF NOT EXISTS item_materials_item_sort_idx ON item_materials(item_id, sort_order);

ALTER TABLE image_assets
  ADD COLUMN IF NOT EXISTS material_id uuid REFERENCES materials(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS image_assets_material_id_idx
  ON image_assets(material_id) WHERE material_id IS NOT NULL;

DROP INDEX IF EXISTS image_assets_entity_lookup_idx;
CREATE INDEX IF NOT EXISTS image_assets_entity_lookup_idx
  ON image_assets(project_id, room_id, item_id, material_id, is_primary);

DROP INDEX IF EXISTS image_assets_primary_project_idx;
DROP INDEX IF EXISTS image_assets_primary_room_idx;
DROP INDEX IF EXISTS image_assets_primary_item_idx;

ALTER TABLE image_assets
  DROP CONSTRAINT IF EXISTS image_assets_entity_shape_chk;

ALTER TABLE image_assets
  ADD CONSTRAINT image_assets_entity_shape_chk CHECK (
    (room_id IS NULL AND item_id IS NULL AND material_id IS NULL)
    OR (room_id IS NOT NULL AND item_id IS NULL AND material_id IS NULL)
    OR (room_id IS NOT NULL AND item_id IS NOT NULL AND material_id IS NULL)
    OR (room_id IS NULL AND item_id IS NULL AND material_id IS NOT NULL)
  );

CREATE UNIQUE INDEX IF NOT EXISTS image_assets_primary_project_idx
  ON image_assets(project_id)
  WHERE is_primary AND room_id IS NULL AND item_id IS NULL AND material_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS image_assets_primary_room_idx
  ON image_assets(room_id)
  WHERE is_primary AND room_id IS NOT NULL AND item_id IS NULL AND material_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS image_assets_primary_item_idx
  ON image_assets(item_id)
  WHERE is_primary AND item_id IS NOT NULL AND material_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS image_assets_primary_material_idx
  ON image_assets(material_id)
  WHERE is_primary AND material_id IS NOT NULL;

CREATE OR REPLACE TRIGGER materials_updated_at
  BEFORE UPDATE ON materials
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
