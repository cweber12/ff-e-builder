-- Migration: 0032_materials_manufacturer_source_url
-- Adds manufacturer and source URL fields to materials, enabling product-page
-- linking and brand-aware filtering in the Finish Library.

ALTER TABLE materials
  ADD COLUMN IF NOT EXISTS manufacturer text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS source_url   text NOT NULL DEFAULT '';
