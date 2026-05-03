-- Migration: 0004_material_swatches
-- Legacy color swatch storage retained for backward-compatible material records.

CREATE TABLE IF NOT EXISTS material_swatches (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id uuid        NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  swatch_hex  text        NOT NULL,
  sort_order  integer     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT material_swatches_hex_chk CHECK (swatch_hex ~ '^#[0-9A-Fa-f]{6}$')
);

CREATE INDEX IF NOT EXISTS material_swatches_material_id_idx
  ON material_swatches(material_id, sort_order);

INSERT INTO material_swatches (material_id, swatch_hex, sort_order)
SELECT id, swatch_hex, 0
FROM materials
WHERE NOT EXISTS (
  SELECT 1
  FROM material_swatches
  WHERE material_swatches.material_id = materials.id
);
