-- Revision Rounds for the Proposal tool.
-- A Revision Round is opened when a Price-Affecting Column is edited while the
-- proposal is in pricing_complete, submitted, or approved. It is closed when
-- the proposal status advances past in_progress. Numbering is MAJOR.MINOR:
--   * MAJOR increments with each acceptance cycle (after `approved`).
--   * MINOR increments for each sub-round triggered within one cycle.

CREATE TABLE proposal_revisions (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          uuid        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  revision_major      int         NOT NULL,
  revision_minor      int         NOT NULL,
  triggered_at_status text        NOT NULL
    CHECK (triggered_at_status IN ('pricing_complete', 'submitted', 'approved')),
  opened_at           timestamptz NOT NULL DEFAULT now(),
  closed_at           timestamptz,
  UNIQUE (project_id, revision_major, revision_minor)
);

CREATE INDEX proposal_revisions_project_idx
  ON proposal_revisions (project_id, revision_major DESC, revision_minor DESC);

-- Partial unique index: at most one open revision per project.
CREATE UNIQUE INDEX proposal_revisions_one_open_per_project_idx
  ON proposal_revisions (project_id)
  WHERE closed_at IS NULL;

-- Associate existing changelog entries with a Revision Round. Existing rows
-- remain NULL (legacy entries display by status as a graceful fallback).
ALTER TABLE proposal_item_changelog
  ADD COLUMN revision_id uuid REFERENCES proposal_revisions(id) ON DELETE SET NULL;

CREATE INDEX proposal_item_changelog_revision_idx
  ON proposal_item_changelog (revision_id);
