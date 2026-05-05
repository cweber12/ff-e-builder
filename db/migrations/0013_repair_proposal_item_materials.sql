-- Migration: 0013_repair_proposal_item_materials
-- Repairs databases where 0012 renamed takeoff_item_materials to
-- proposal_item_materials but left the join column as takeoff_item_id.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'proposal_item_materials'
      AND column_name = 'takeoff_item_id'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'proposal_item_materials'
      AND column_name = 'proposal_item_id'
  ) THEN
    ALTER TABLE proposal_item_materials
      RENAME COLUMN takeoff_item_id TO proposal_item_id;
  END IF;
END $$;

ALTER INDEX IF EXISTS takeoff_item_materials_material_id_idx RENAME TO proposal_item_materials_material_id_idx;
ALTER INDEX IF EXISTS takeoff_item_materials_item_sort_idx   RENAME TO proposal_item_materials_item_sort_idx;
