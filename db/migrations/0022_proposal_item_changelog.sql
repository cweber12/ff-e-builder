CREATE TABLE proposal_item_changelog (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_item_id  uuid        NOT NULL REFERENCES proposal_items(id) ON DELETE CASCADE,
  column_key        text        NOT NULL,
  previous_value    text        NOT NULL,
  new_value         text        NOT NULL,
  notes             text,
  proposal_status   text        NOT NULL
    CHECK (proposal_status IN ('in_progress', 'pricing_complete', 'submitted', 'approved')),
  related_change_id uuid        REFERENCES proposal_item_changelog(id),
  changed_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON proposal_item_changelog (proposal_item_id, changed_at DESC);

ALTER TABLE proposal_items
  ADD COLUMN cost_update_deferred boolean NOT NULL DEFAULT false;
