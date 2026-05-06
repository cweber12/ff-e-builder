-- Migration: 0013_ffe_item_options
-- Adds an FF&E item description column and a dedicated image role for option renderings.
-- Apply via: pnpm migrate

ALTER TABLE items
  ADD COLUMN IF NOT EXISTS description text;

ALTER TABLE image_assets DROP CONSTRAINT IF EXISTS image_assets_entity_type_chk;
ALTER TABLE image_assets DROP CONSTRAINT IF EXISTS image_assets_entity_shape_chk;

ALTER TABLE image_assets ADD CONSTRAINT image_assets_entity_type_chk CHECK (
  entity_type IN (
    'project',
    'room',
    'item',
    'item_option',
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
    entity_type IN ('item', 'item_option')
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

CREATE UNIQUE INDEX IF NOT EXISTS image_assets_primary_item_option_idx
  ON image_assets(item_id, entity_type)
  WHERE is_primary AND entity_type = 'item_option';
