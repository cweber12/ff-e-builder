-- Migration: 0008_finish_library
-- Adds takeoff_item_materials join table so Take-Off Items can reference the
-- shared material library instead of owning direct takeoff_swatch image assets.
-- Migrates any existing takeoff_swatch image assets into named material records.

-- 1. Create the join table
CREATE TABLE IF NOT EXISTS takeoff_item_materials (
  takeoff_item_id uuid        NOT NULL REFERENCES takeoff_items(id) ON DELETE CASCADE,
  material_id     uuid        NOT NULL REFERENCES materials(id)     ON DELETE CASCADE,
  sort_order      integer     NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (takeoff_item_id, material_id)
);

CREATE INDEX IF NOT EXISTS takeoff_item_materials_material_id_idx
  ON takeoff_item_materials(material_id);

CREATE INDEX IF NOT EXISTS takeoff_item_materials_item_sort_idx
  ON takeoff_item_materials(takeoff_item_id, sort_order);

-- 2. Migrate existing takeoff_swatch image assets into material library entries.
--    Each swatch becomes an independent materials row; the image_assets row is
--    updated in place to entity_type='material' so unique(r2_key) is preserved.
DO $$
DECLARE
  swatch      RECORD;
  mat_id      uuid;
  mat_name    text;
  next_sort   integer;
BEGIN
  FOR swatch IN
    SELECT
      ia.id          AS image_id,
      ia.owner_uid,
      ia.project_id,
      ia.takeoff_item_id,
      ia.r2_key,
      ia.filename,
      ia.content_type,
      ia.byte_size,
      ia.alt_text,
      ia.created_at
    FROM  image_assets ia
    WHERE ia.entity_type = 'takeoff_swatch'
    ORDER BY ia.takeoff_item_id, ia.created_at
  LOOP
    -- Build a unique name within the project
    mat_name := COALESCE(NULLIF(TRIM(swatch.alt_text), ''), 'Swatch');
    IF EXISTS (
      SELECT 1 FROM materials
      WHERE project_id = swatch.project_id
        AND lower(name) = lower(mat_name)
    ) THEN
      mat_name := mat_name || ' #' || LEFT(swatch.image_id::text, 6);
    END IF;

    mat_id := gen_random_uuid();

    INSERT INTO materials (id, project_id, name, material_id, description, swatch_hex, created_at, updated_at)
    VALUES (mat_id, swatch.project_id, mat_name, '', '', '#D9D4C8', now(), now());

    -- Re-point the image row in place (same R2 object/key, now owned by material)
    UPDATE image_assets
    SET
      entity_type = 'material',
      room_id = NULL,
      item_id = NULL,
      material_id = mat_id,
      takeoff_item_id = NULL,
      is_primary = true,
      updated_at = now()
    WHERE id = swatch.image_id;

    -- Determine next sort position for this takeoff item
    SELECT COALESCE(MAX(sort_order) + 1, 0)
    INTO   next_sort
    FROM   takeoff_item_materials
    WHERE  takeoff_item_id = swatch.takeoff_item_id;

    INSERT INTO takeoff_item_materials (takeoff_item_id, material_id, sort_order)
    VALUES (swatch.takeoff_item_id, mat_id, next_sort);
  END LOOP;

  -- Any migrated rows are no longer takeoff_swatch after in-place updates.
  DELETE FROM image_assets WHERE entity_type = 'takeoff_swatch';
END $$;

-- 3. Remove takeoff_swatch from the entity-type enum constraint
ALTER TABLE image_assets DROP CONSTRAINT IF EXISTS image_assets_entity_type_chk;
ALTER TABLE image_assets ADD CONSTRAINT image_assets_entity_type_chk CHECK (
  entity_type IN ('project', 'room', 'item', 'material', 'takeoff_item', 'takeoff_plan')
);

-- 4. Update the entity-shape constraint to match
ALTER TABLE image_assets DROP CONSTRAINT IF EXISTS image_assets_entity_shape_chk;
ALTER TABLE image_assets ADD CONSTRAINT image_assets_entity_shape_chk CHECK (
  (
    entity_type = 'project'
    AND room_id IS NULL AND item_id IS NULL AND material_id IS NULL AND takeoff_item_id IS NULL
  )
  OR (
    entity_type = 'room'
    AND room_id IS NOT NULL AND item_id IS NULL AND material_id IS NULL AND takeoff_item_id IS NULL
  )
  OR (
    entity_type = 'item'
    AND room_id IS NOT NULL AND item_id IS NOT NULL AND material_id IS NULL AND takeoff_item_id IS NULL
  )
  OR (
    entity_type = 'material'
    AND room_id IS NULL AND item_id IS NULL AND material_id IS NOT NULL AND takeoff_item_id IS NULL
  )
  OR (
    entity_type IN ('takeoff_item', 'takeoff_plan')
    AND room_id IS NULL AND item_id IS NULL AND material_id IS NULL AND takeoff_item_id IS NOT NULL
  )
);
