-- Migration: 0001_initial
-- Creates the core projects / rooms / items schema.
--
-- Apply via: pnpm migrate
-- Money columns are bigint cents (integer minor units) — see /docs/money.md.
-- markup_pct stays numeric because it is a percentage, not a price.

-- ─── Projects ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projects (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_uid    text        NOT NULL,
  name         text        NOT NULL,
  client_name  text        NOT NULL DEFAULT '',
  budget_cents bigint      NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS projects_owner_uid_idx ON projects(owner_uid);

-- ─── Rooms ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rooms (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  sort_order  integer     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rooms_project_id_idx ON rooms(project_id);

-- ─── Items ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS items (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id         uuid          NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  item_name       text          NOT NULL,
  category        text,
  vendor          text,
  model           text,
  item_id_tag     text,
  dimensions      text,
  seat_height     text,
  finishes        text,
  notes           text,
  qty             integer       NOT NULL DEFAULT 1  CHECK (qty >= 0),
  unit_cost_cents bigint        NOT NULL DEFAULT 0  CHECK (unit_cost_cents >= 0),
  markup_pct      numeric(5,2)  NOT NULL DEFAULT 0  CHECK (markup_pct >= 0),
  lead_time       text,
  status          text          NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','ordered','approved','received')),
  image_url       text,
  link_url        text,
  sort_order      integer       NOT NULL DEFAULT 0,
  version         integer       NOT NULL DEFAULT 1,   -- optimistic concurrency
  created_at      timestamptz   NOT NULL DEFAULT now(),
  updated_at      timestamptz   NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS items_room_id_idx ON items(room_id);

-- ─── Auto-update updated_at trigger ────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER rooms_updated_at
  BEFORE UPDATE ON rooms
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER items_updated_at
  BEFORE UPDATE ON items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
