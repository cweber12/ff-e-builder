-- Migration: 0037_image_thumbnails
-- Adds thumbnail_r2_key and thumbnail_byte_size for 240×240 WebP cover variants.
-- NULL means no thumbnail: existing rows, GIFs, and non-table entity types.
-- Backfill is a separate one-shot job (scripts/backfill-image-thumbnails.ts).

ALTER TABLE image_assets
  ADD COLUMN IF NOT EXISTS thumbnail_r2_key    text,
  ADD COLUMN IF NOT EXISTS thumbnail_byte_size integer;
