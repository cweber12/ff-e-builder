-- Migration: 0019_column_defs_table_type
-- Extends item_column_defs to serve both the FF&E and Proposal tables.
--
-- Changes:
--   item_column_defs — add table_type column ('ffe' | 'proposal'); backfill
--     existing rows to 'ffe'. Drop the old project-level index and replace
--     with a composite (project_id, table_type) index.
--   proposal_items   — add custom_data jsonb column for user-defined column
--     values, mirroring items.custom_data.
--
-- The API enforces max 10 custom columns per (project_id, table_type).
--
-- Apply via: pnpm migrate

-- ─── item_column_defs: add table_type ─────────────────────────────────────
ALTER TABLE item_column_defs
  ADD COLUMN IF NOT EXISTS table_type text NOT NULL DEFAULT 'ffe'
    CHECK (table_type IN ('ffe', 'proposal'));

-- Backfill: all existing rows belong to the FF&E table.
UPDATE item_column_defs SET table_type = 'ffe' WHERE table_type = 'ffe';

-- Replace the old single-column index with a composite one.
DROP INDEX IF EXISTS item_column_defs_project_id_idx;
CREATE INDEX IF NOT EXISTS item_column_defs_project_table_idx
  ON item_column_defs(project_id, table_type);

-- ─── proposal_items: add custom_data ──────────────────────────────────────
ALTER TABLE proposal_items
  ADD COLUMN IF NOT EXISTS custom_data jsonb NOT NULL DEFAULT '{}';
