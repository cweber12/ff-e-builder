-- Migration: 0010_image_crop_params
-- Adds non-destructive crop parameters to image_assets.
-- Values are normalized floats (0.0–1.0) as a fraction of the original image dimensions.
-- NULL means no crop applied; existing export center-crop fallback remains in effect.

ALTER TABLE image_assets
  ADD COLUMN IF NOT EXISTS crop_x      double precision,
  ADD COLUMN IF NOT EXISTS crop_y      double precision,
  ADD COLUMN IF NOT EXISTS crop_width  double precision,
  ADD COLUMN IF NOT EXISTS crop_height double precision;
