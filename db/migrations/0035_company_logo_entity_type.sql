-- Migration: 0035_company_logo_entity_type
-- Extends image_assets entity-type constraints to accept company_logo images.
-- Migration 0034 added the companies table and the company_id column but
-- neglected to add 'company_logo' to the entity_type_chk and entity_shape_chk
-- constraints, causing every logo upload to fail with a CHECK violation.
-- Apply via: pnpm migrate

ALTER TABLE image_assets DROP CONSTRAINT IF EXISTS image_assets_entity_type_chk;
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
    'proposal_plan',
    'company_logo'
  )
);

ALTER TABLE image_assets DROP CONSTRAINT IF EXISTS image_assets_entity_shape_chk;
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
  OR (
    entity_type = 'company_logo'
    AND room_id IS NULL AND item_id IS NULL AND material_id IS NULL AND proposal_item_id IS NULL
  )
);
