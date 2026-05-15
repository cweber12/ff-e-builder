-- Persistent counter for Revision Round MAJOR numbering.
-- When a proposal is accepted (`approved`), all proposal_revisions rows for that
-- project are deleted as part of the bake step. We still need to remember which
-- MAJOR number was just completed so that the NEXT cycle starts at MAJOR + 1.

ALTER TABLE projects
  ADD COLUMN last_revision_major int NOT NULL DEFAULT 0;
