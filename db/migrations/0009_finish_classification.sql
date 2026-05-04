-- Migration: 0009_finish_classification
-- Adds a finish_classification column to the materials table to distinguish
-- between Materials (material), Swatches (swatch), and hybrid entries.
-- Existing rows default to 'material'; swatches migrated in 0008 stay as 'swatch'.

ALTER TABLE materials
  ADD COLUMN IF NOT EXISTS finish_classification text NOT NULL DEFAULT 'material'
    CONSTRAINT materials_classification_chk
      CHECK (finish_classification IN ('material', 'swatch', 'hybrid'));

-- Rows that were migrated from takeoff_swatch image assets in migration 0008 have
-- a blank material_id and no description; mark them as swatches.
UPDATE materials
SET    finish_classification = 'swatch'
WHERE  finish_classification = 'material'
  AND  material_id = ''
  AND  description = ''
  AND  id IN (
    SELECT DISTINCT m.id
    FROM   materials m
    JOIN   image_assets ia
      ON   ia.material_id = m.id
     AND   ia.entity_type = 'material'
    WHERE  m.created_at >= (
      SELECT COALESCE(MAX(created_at), now()) FROM materials
      WHERE  name LIKE 'Swatch%' OR name LIKE 'Import%'
    )
  );
