-- Migration: 0005_takeoff_tool
-- Adds project metadata, user profile data, and a separate take-off table model.
--
-- Apply via: pnpm migrate
-- Money columns are bigint cents (integer minor units) -- see /docs/money.md.

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS company_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS project_location text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS budget_mode text NOT NULL DEFAULT 'shared',
  ADD COLUMN IF NOT EXISTS ffe_budget_cents bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS takeoff_budget_cents bigint NOT NULL DEFAULT 0;

ALTER TABLE projects
  DROP CONSTRAINT IF EXISTS projects_budget_mode_chk;

ALTER TABLE projects
  ADD CONSTRAINT projects_budget_mode_chk
  CHECK (budget_mode IN ('shared', 'individual'));

CREATE INDEX IF NOT EXISTS projects_budget_idx
  ON projects(owner_uid, budget_mode, budget_cents, ffe_budget_cents, takeoff_budget_cents);

CREATE TABLE IF NOT EXISTS user_profiles (
  owner_uid    text        PRIMARY KEY,
  name         text        NOT NULL DEFAULT '',
  email        text        NOT NULL DEFAULT '',
  phone        text        NOT NULL DEFAULT '',
  company_name text        NOT NULL DEFAULT '',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE TRIGGER user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS takeoff_categories (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name       text        NOT NULL,
  sort_order integer     NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, name)
);

CREATE INDEX IF NOT EXISTS takeoff_categories_project_id_idx
  ON takeoff_categories(project_id, sort_order, created_at);

CREATE TABLE IF NOT EXISTS takeoff_items (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id     uuid        NOT NULL REFERENCES takeoff_categories(id) ON DELETE CASCADE,
  product_tag     text        NOT NULL DEFAULT '',
  plan            text        NOT NULL DEFAULT '',
  drawings        text        NOT NULL DEFAULT '',
  location        text        NOT NULL DEFAULT '',
  description     text        NOT NULL DEFAULT '',
  size_label      text        NOT NULL DEFAULT '',
  size_mode       text        NOT NULL DEFAULT 'imperial',
  size_w          text        NOT NULL DEFAULT '',
  size_d          text        NOT NULL DEFAULT '',
  size_h          text        NOT NULL DEFAULT '',
  size_unit       text        NOT NULL DEFAULT 'in',
  swatches        jsonb       NOT NULL DEFAULT '[]'::jsonb,
  cbm             numeric(12,3) NOT NULL DEFAULT 0 CHECK (cbm >= 0),
  quantity        numeric(12,2) NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  quantity_unit   text        NOT NULL DEFAULT 'unit',
  unit_cost_cents bigint      NOT NULL DEFAULT 0 CHECK (unit_cost_cents >= 0),
  sort_order      integer     NOT NULL DEFAULT 0,
  version         integer     NOT NULL DEFAULT 1,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT takeoff_items_size_mode_chk CHECK (size_mode IN ('imperial', 'metric'))
);

CREATE INDEX IF NOT EXISTS takeoff_items_category_id_idx
  ON takeoff_items(category_id, sort_order, created_at);

CREATE OR REPLACE TRIGGER takeoff_categories_updated_at
  BEFORE UPDATE ON takeoff_categories
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER takeoff_items_updated_at
  BEFORE UPDATE ON takeoff_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE image_assets
  ADD COLUMN IF NOT EXISTS takeoff_item_id uuid REFERENCES takeoff_items(id) ON DELETE CASCADE;

ALTER TABLE image_assets
  DROP CONSTRAINT IF EXISTS image_assets_entity_shape_chk;

ALTER TABLE image_assets
  ADD CONSTRAINT image_assets_entity_shape_chk CHECK (
    (room_id IS NULL AND item_id IS NULL AND material_id IS NULL AND takeoff_item_id IS NULL)
    OR (room_id IS NOT NULL AND item_id IS NULL AND material_id IS NULL AND takeoff_item_id IS NULL)
    OR (room_id IS NOT NULL AND item_id IS NOT NULL AND material_id IS NULL AND takeoff_item_id IS NULL)
    OR (room_id IS NULL AND item_id IS NULL AND material_id IS NOT NULL AND takeoff_item_id IS NULL)
    OR (room_id IS NULL AND item_id IS NULL AND material_id IS NULL AND takeoff_item_id IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS image_assets_takeoff_item_id_idx
  ON image_assets(takeoff_item_id) WHERE takeoff_item_id IS NOT NULL;

DROP INDEX IF EXISTS image_assets_entity_lookup_idx;
CREATE INDEX IF NOT EXISTS image_assets_entity_lookup_idx
  ON image_assets(project_id, room_id, item_id, material_id, takeoff_item_id, is_primary);

CREATE UNIQUE INDEX IF NOT EXISTS image_assets_primary_takeoff_item_idx
  ON image_assets(takeoff_item_id)
  WHERE is_primary AND takeoff_item_id IS NOT NULL;
