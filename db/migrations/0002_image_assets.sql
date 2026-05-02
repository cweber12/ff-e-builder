-- Migration: 0002_image_assets
-- Normalizes image metadata for private Cloudflare R2 objects.
--
-- R2 object bytes live in the ffe-images bucket. This table stores only the
-- ownership, entity links, object key, and display metadata needed by the app.

CREATE TABLE IF NOT EXISTS image_assets (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_uid    text        NOT NULL,
  project_id   uuid        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  room_id      uuid        REFERENCES rooms(id) ON DELETE CASCADE,
  item_id      uuid        REFERENCES items(id) ON DELETE CASCADE,
  r2_key       text        NOT NULL UNIQUE,
  filename     text        NOT NULL,
  content_type text        NOT NULL,
  byte_size    integer     NOT NULL CHECK (byte_size > 0),
  alt_text     text        NOT NULL DEFAULT '',
  is_primary   boolean     NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT image_assets_entity_shape_chk CHECK (
    (room_id IS NULL AND item_id IS NULL)
    OR (room_id IS NOT NULL AND item_id IS NULL)
    OR (room_id IS NOT NULL AND item_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS image_assets_owner_uid_idx ON image_assets(owner_uid);
CREATE INDEX IF NOT EXISTS image_assets_project_id_idx ON image_assets(project_id);
CREATE INDEX IF NOT EXISTS image_assets_room_id_idx ON image_assets(room_id) WHERE room_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS image_assets_item_id_idx ON image_assets(item_id) WHERE item_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS image_assets_entity_lookup_idx
  ON image_assets(project_id, room_id, item_id, is_primary);
CREATE UNIQUE INDEX IF NOT EXISTS image_assets_primary_project_idx
  ON image_assets(project_id)
  WHERE is_primary AND room_id IS NULL AND item_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS image_assets_primary_room_idx
  ON image_assets(room_id)
  WHERE is_primary AND room_id IS NOT NULL AND item_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS image_assets_primary_item_idx
  ON image_assets(item_id)
  WHERE is_primary AND item_id IS NOT NULL;

CREATE OR REPLACE TRIGGER image_assets_updated_at
  BEFORE UPDATE ON image_assets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
