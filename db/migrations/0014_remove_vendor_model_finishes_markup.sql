-- Migration: 0014_remove_vendor_model_finishes_markup
-- Drops vendor, model, finishes, markup_pct from items.
-- sellPrice was derived from markup_pct — no column to drop.
-- Apply via: pnpm migrate

ALTER TABLE items
  DROP COLUMN IF EXISTS vendor,
  DROP COLUMN IF EXISTS model,
  DROP COLUMN IF EXISTS finishes,
  DROP COLUMN IF EXISTS markup_pct;
