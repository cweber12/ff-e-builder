-- Migration: 0021_proposal_status
-- Adds proposal-level status and status timestamp to projects.
-- Apply via: pnpm migrate

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS proposal_status text NOT NULL DEFAULT 'in_progress',
  ADD COLUMN IF NOT EXISTS proposal_status_updated_at timestamptz NOT NULL DEFAULT NOW();

ALTER TABLE projects
  DROP CONSTRAINT IF EXISTS projects_proposal_status_check,
  ADD CONSTRAINT projects_proposal_status_check
    CHECK (proposal_status IN ('in_progress', 'pricing_complete', 'submitted', 'approved'));
