-- Migration: 0006_image_asset_constraints
-- Repairs image uniqueness to respect the full entity shape and enforces the
-- Project Image count limit in the database.

DROP INDEX IF EXISTS image_assets_primary_project_idx;
DROP INDEX IF EXISTS image_assets_primary_room_idx;
DROP INDEX IF EXISTS image_assets_primary_item_idx;
DROP INDEX IF EXISTS image_assets_primary_material_idx;
DROP INDEX IF EXISTS image_assets_primary_takeoff_item_idx;

CREATE UNIQUE INDEX IF NOT EXISTS image_assets_primary_project_idx
  ON image_assets(project_id)
  WHERE is_primary
    AND room_id IS NULL
    AND item_id IS NULL
    AND material_id IS NULL
    AND takeoff_item_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS image_assets_primary_room_idx
  ON image_assets(room_id)
  WHERE is_primary
    AND room_id IS NOT NULL
    AND item_id IS NULL
    AND material_id IS NULL
    AND takeoff_item_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS image_assets_primary_item_idx
  ON image_assets(item_id)
  WHERE is_primary
    AND item_id IS NOT NULL
    AND material_id IS NULL
    AND takeoff_item_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS image_assets_primary_material_idx
  ON image_assets(material_id)
  WHERE is_primary
    AND material_id IS NOT NULL
    AND takeoff_item_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS image_assets_primary_takeoff_item_idx
  ON image_assets(takeoff_item_id)
  WHERE is_primary
    AND room_id IS NULL
    AND item_id IS NULL
    AND material_id IS NULL
    AND takeoff_item_id IS NOT NULL;

CREATE OR REPLACE FUNCTION enforce_project_image_limit()
RETURNS trigger AS $$
BEGIN
  IF NEW.room_id IS NULL
    AND NEW.item_id IS NULL
    AND NEW.material_id IS NULL
    AND NEW.takeoff_item_id IS NULL THEN
    IF (
      SELECT COUNT(*)
      FROM image_assets
      WHERE owner_uid = NEW.owner_uid
        AND project_id = NEW.project_id
        AND room_id IS NULL
        AND item_id IS NULL
        AND material_id IS NULL
        AND takeoff_item_id IS NULL
        AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) >= 3 THEN
      RAISE EXCEPTION 'Projects can have up to 3 images' USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS image_assets_project_limit_chk ON image_assets;

CREATE TRIGGER image_assets_project_limit_chk
  BEFORE INSERT OR UPDATE OF project_id, room_id, item_id, material_id, takeoff_item_id
  ON image_assets
  FOR EACH ROW
  EXECUTE FUNCTION enforce_project_image_limit();
