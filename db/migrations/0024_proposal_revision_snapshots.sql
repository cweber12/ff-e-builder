-- Revision Snapshots: one row per Proposal Item per Revision Round.
-- When a Revision Round is opened, the API inserts a snapshot for every item
-- in the proposal carrying its current quantity and unit_cost_cents. The item
-- whose edit triggered the round has its snapshot updated to reflect the new
-- quantity (when quantity changed) and is flagged for a cost update otherwise.
--
-- cost_status values:
--   'none'     — no cost update required (e.g. quantity-only change or untouched item)
--   'flagged'  — Price-Affecting Column changed; PM must enter a new unit_cost_cents
--   'resolved' — PM has entered the new unit_cost_cents for this revision

CREATE TABLE proposal_revision_snapshots (
  revision_id     uuid    NOT NULL REFERENCES proposal_revisions(id) ON DELETE CASCADE,
  item_id         uuid    NOT NULL REFERENCES proposal_items(id)     ON DELETE CASCADE,
  quantity        numeric,
  unit_cost_cents int,
  cost_status     text    NOT NULL DEFAULT 'none'
    CHECK (cost_status IN ('none', 'flagged', 'resolved')),
  PRIMARY KEY (revision_id, item_id)
);

CREATE INDEX proposal_revision_snapshots_flagged_idx
  ON proposal_revision_snapshots (revision_id)
  WHERE cost_status = 'flagged';
