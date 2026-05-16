-- Migration: 0028_generated_item_revision_links
-- Stages canonical Generated Item references on Proposal revision history while
-- preserving the current Proposal Item route contract.

ALTER TABLE proposal_item_changelog
  ADD COLUMN IF NOT EXISTS generated_item_id uuid REFERENCES items(id) ON DELETE SET NULL;

ALTER TABLE proposal_revision_snapshots
  ADD COLUMN IF NOT EXISTS generated_item_id uuid REFERENCES items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS proposal_item_changelog_generated_item_idx
  ON proposal_item_changelog(generated_item_id, changed_at DESC)
  WHERE generated_item_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS proposal_revision_snapshots_generated_item_idx
  ON proposal_revision_snapshots(generated_item_id)
  WHERE generated_item_id IS NOT NULL;

UPDATE proposal_item_changelog cl
SET generated_item_id = link.item_id
FROM proposal_item_generated_item_links link
WHERE cl.proposal_item_id = link.proposal_item_id
  AND cl.generated_item_id IS NULL;

UPDATE proposal_revision_snapshots s
SET generated_item_id = link.item_id
FROM proposal_item_generated_item_links link
WHERE s.item_id = link.proposal_item_id
  AND s.generated_item_id IS NULL;
