-- Migration: 0011_unified_material
-- Removes the finish_classification distinction between Materials and Swatches.
-- All Finish Library entries are now plain Materials. See ADR-0005.

-- 1. Drop the classification column — was never user-set; driven by migration defaults only.
ALTER TABLE materials DROP COLUMN IF EXISTS finish_classification;

-- 2. Drop the legacy multi-hex-color table — superseded by swatch_hex on the materials row.
DROP TABLE IF EXISTS material_swatches;

-- 3. Drop the legacy JSONB hex-swatch column on takeoff_items — superseded by the
--    normalized takeoff_item_materials join table introduced in migration 0008.
ALTER TABLE takeoff_items DROP COLUMN IF EXISTS swatches;
