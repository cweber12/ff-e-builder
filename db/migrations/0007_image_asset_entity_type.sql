-- Migration: 0007_image_asset_entity_type
-- Adds an explicit image role discriminator so Take-Off renderings, plan
-- images, and swatches can coexist on the same Take-Off Item.

ALTER TABLE image_assets
  ADD COLUMN IF NOT EXISTS entity_type text;

UPDATE image_assets
SET entity_type = CASE
  WHEN takeoff_item_id IS NOT NULL AND is_primary = true THEN 'takeoff_item'
  WHEN takeoff_item_id IS NOT NULL AND is_primary = false THEN 'takeoff_swatch'
  WHEN material_id IS NOT NULL THEN 'material'
  WHEN item_id IS NOT NULL THEN 'item'
  WHEN room_id IS NOT NULL THEN 'room'
  ELSE 'project'
END
WHERE entity_type IS NULL;

ALTER TABLE image_assets
  ALTER COLUMN entity_type SET NOT NULL;

ALTER TABLE image_assets
  DROP CONSTRAINT IF EXISTS image_assets_entity_type_chk;

ALTER TABLE image_assets
  ADD CONSTRAINT image_assets_entity_type_chk CHECK (
    entity_type IN (
      'project',
      'room',
      'item',
      'material',
      'takeoff_item',
      'takeoff_swatch',
      'takeoff_plan'
    )
  );

ALTER TABLE image_assets
  DROP CONSTRAINT IF EXISTS image_assets_entity_shape_chk;

ALTER TABLE image_assets
  ADD CONSTRAINT image_assets_entity_shape_chk CHECK (
    (
      entity_type = 'project'
      AND room_id IS NULL
      AND item_id IS NULL
      AND material_id IS NULL
      AND takeoff_item_id IS NULL
    )
    OR (
      entity_type = 'room'
      AND room_id IS NOT NULL
      AND item_id IS NULL
      AND material_id IS NULL
      AND takeoff_item_id IS NULL
    )
    OR (
      entity_type = 'item'
      AND room_id IS NOT NULL
      AND item_id IS NOT NULL
      AND material_id IS NULL
      AND takeoff_item_id IS NULL
    )
    OR (
      entity_type = 'material'
      AND room_id IS NULL
      AND item_id IS NULL
      AND material_id IS NOT NULL
      AND takeoff_item_id IS NULL
    )
    OR (
      entity_type IN ('takeoff_item', 'takeoff_swatch', 'takeoff_plan')
      AND room_id IS NULL
      AND item_id IS NULL
      AND material_id IS NULL
      AND takeoff_item_id IS NOT NULL
    )
  );

DROP INDEX IF EXISTS image_assets_entity_lookup_idx;
DROP INDEX IF EXISTS image_assets_primary_project_idx;
DROP INDEX IF EXISTS image_assets_primary_room_idx;
DROP INDEX IF EXISTS image_assets_primary_item_idx;
DROP INDEX IF EXISTS image_assets_primary_material_idx;
DROP INDEX IF EXISTS image_assets_primary_takeoff_item_idx;
DROP INDEX IF EXISTS image_assets_primary_takeoff_plan_idx;

CREATE INDEX IF NOT EXISTS image_assets_entity_lookup_idx
  ON image_assets(project_id, entity_type, room_id, item_id, material_id, takeoff_item_id, is_primary);

CREATE UNIQUE INDEX IF NOT EXISTS image_assets_primary_project_idx
  ON image_assets(project_id, entity_type)
  WHERE is_primary AND entity_type = 'project';

CREATE UNIQUE INDEX IF NOT EXISTS image_assets_primary_room_idx
  ON image_assets(room_id, entity_type)
  WHERE is_primary AND entity_type = 'room';

CREATE UNIQUE INDEX IF NOT EXISTS image_assets_primary_item_idx
  ON image_assets(item_id, entity_type)
  WHERE is_primary AND entity_type = 'item';

CREATE UNIQUE INDEX IF NOT EXISTS image_assets_primary_material_idx
  ON image_assets(material_id, entity_type)
  WHERE is_primary AND entity_type = 'material';

CREATE UNIQUE INDEX IF NOT EXISTS image_assets_primary_takeoff_item_idx
  ON image_assets(takeoff_item_id, entity_type)
  WHERE is_primary AND entity_type = 'takeoff_item';

CREATE UNIQUE INDEX IF NOT EXISTS image_assets_primary_takeoff_plan_idx
  ON image_assets(takeoff_item_id, entity_type)
  WHERE is_primary AND entity_type = 'takeoff_plan';

CREATE OR REPLACE FUNCTION enforce_project_image_limit()
RETURNS trigger AS $$
BEGIN
  IF NEW.entity_type = 'project' THEN
    IF (
      SELECT COUNT(*)
      FROM image_assets
      WHERE owner_uid = NEW.owner_uid
        AND project_id = NEW.project_id
        AND entity_type = 'project'
        AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) >= 3 THEN
      RAISE EXCEPTION 'Projects can have up to 3 images' USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
