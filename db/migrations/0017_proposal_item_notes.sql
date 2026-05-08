-- Migration: 0017_proposal_item_notes
-- Adds a free-text notes field to proposal_items.
-- Apply via: pnpm migrate
ALTER TABLE proposal_items
  ADD COLUMN IF NOT EXISTS notes text NOT NULL DEFAULT '';
