-- Migration: 0034_companies
-- Adds the companies table for company profile data (name, location, theme
-- colors, document mark preferences).  Extends image_assets to support
-- company-level images (logo) by making project_id nullable and adding a
-- company_id FK.  Drops the superseded company_name column from user_profiles.
--
-- Ownership model: one Company per authenticated user (owner_uid UNIQUE).
-- The UUID primary key is intentional so a future multi-user org model can
-- add a company_members join table without breaking the schema.

-- ─── 1. companies ─────────────────────────────────────────────────────────

CREATE TABLE companies (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_uid         text        NOT NULL REFERENCES user_profiles(owner_uid) ON DELETE CASCADE,
  name              text        NOT NULL,
  location          text,
  color_primary     text,
  color_secondary   text,
  color_accent      text,
  mark_enabled      boolean     NOT NULL DEFAULT false,
  mark_include_name boolean     NOT NULL DEFAULT true,
  mark_placement_h  text        NOT NULL DEFAULT 'right'
    CONSTRAINT companies_mark_placement_h_chk CHECK (mark_placement_h IN ('left', 'center', 'right')),
  mark_placement_v  text        NOT NULL DEFAULT 'footer'
    CONSTRAINT companies_mark_placement_v_chk CHECK (mark_placement_v IN ('header', 'footer')),
  mark_opacity      integer     NOT NULL DEFAULT 30
    CONSTRAINT companies_mark_opacity_chk CHECK (mark_opacity >= 0 AND mark_opacity <= 100),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_uid)
);

CREATE INDEX IF NOT EXISTS companies_owner_uid_idx ON companies(owner_uid);

CREATE OR REPLACE TRIGGER companies_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── 2. Extend image_assets for company-level images ──────────────────────
-- project_id becomes nullable so company-owned assets (e.g. logo) can be
-- stored without a project context.  A CHECK ensures every row has at least
-- one of project_id or company_id.

ALTER TABLE image_assets
  ALTER COLUMN project_id DROP NOT NULL;

ALTER TABLE image_assets
  ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE CASCADE;

ALTER TABLE image_assets
  ADD CONSTRAINT image_assets_entity_owner_chk
    CHECK (project_id IS NOT NULL OR company_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS image_assets_company_id_idx
  ON image_assets(company_id) WHERE company_id IS NOT NULL;

-- One logo per company (enforced at DB level).
CREATE UNIQUE INDEX IF NOT EXISTS image_assets_company_logo_idx
  ON image_assets(company_id)
  WHERE company_id IS NOT NULL AND entity_type = 'company_logo';

-- ─── 3. Drop superseded column ────────────────────────────────────────────
-- company_name on user_profiles is superseded by the companies table.
-- projects.company_name is left untouched for now; a future migration will
-- add a company_id FK to projects and retire that free-text field.

ALTER TABLE user_profiles DROP COLUMN IF EXISTS company_name;
