-- Migration: 0017_ffe_item_plan
-- Adds a dedicated FF&E item plan image role so measured plan crops can publish
-- into a separate item-owned plan-image surface without colliding with the main rendering.
-- Apply via: pnpm migrate

ALTER TABLE image_assets DROP CONSTRAINT IF EXISTS image_assets_entity_type_chk;
ALTER TABLE image_assets DROP CONSTRAINT IF EXISTS image_assets_entity_shape_chk;

ALTER TABLE image_assets ADD CONSTRAINT image_assets_entity_type_chk CHECK (
  entity_type IN (
    'project',
    'room',
    'item',
    'item_plan',
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
    entity_type IN ('item', 'item_plan', 'item_option')
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

CREATE UNIQUE INDEX IF NOT EXISTS image_assets_primary_item_plan_idx
  ON image_assets(item_id, entity_type)
  WHERE is_primary AND entity_type = 'item_plan';
