-- Migration: 0018_items_schema_cleanup
-- Removes three unused columns from items (seat_height, image_url, link_url).
-- All item images are stored in image_assets (R2). seat_height and link_url
-- had no data and have been replaced by the description field and image_assets.
--
-- Adds user-defined custom columns backed by jsonb:
--   item_column_defs — project-scoped label registry (max 10 per project enforced by API)
--   items.custom_data — per-item key/value store keyed by column def UUID
--
-- Apply via: pnpm migrate

ALTER TABLE items
  DROP COLUMN IF EXISTS seat_height,
  DROP COLUMN IF EXISTS image_url,
  DROP COLUMN IF EXISTS link_url;

ALTER TABLE items
  ADD COLUMN IF NOT EXISTS custom_data jsonb NOT NULL DEFAULT '{}';

-- ─── Custom column definition registry ───────────────────────────────────
CREATE TABLE IF NOT EXISTS item_column_defs (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  label       text        NOT NULL CHECK (char_length(label) BETWEEN 1 AND 100),
  sort_order  integer     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS item_column_defs_project_id_idx ON item_column_defs(project_id);

CREATE OR REPLACE TRIGGER item_column_defs_updated_at
  BEFORE UPDATE ON item_column_defs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
