-- Migration: 0039_proposal_item_footprint
-- Adds the Footprint fields: the width × depth and derived area an item occupies
-- on a Measured Plan, captured from the Plans measurement flow. Footprint is
-- plan-derived and presentation-only; it is exclusive with applying a
-- measurement to the item's quantity (a measurement updates either quantity OR
-- footprint, never both).
--
-- Footprint is surfaced only in the Proposal view, but the fields live on BOTH
-- `items` (the canonical Generated Item store that the Proposal view reads) and
-- `proposal_items` (the write target / legacy unlinked rows), mirroring the
-- existing size_* fields so the proposal_items -> items sync round-trips it.

ALTER TABLE items
  ADD COLUMN IF NOT EXISTS footprint_label text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS footprint_w     text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS footprint_d     text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS footprint_unit  text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS footprint_area  numeric(12,3);

ALTER TABLE proposal_items
  ADD COLUMN IF NOT EXISTS footprint_label text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS footprint_w     text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS footprint_d     text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS footprint_unit  text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS footprint_area  numeric(12,3);

ALTER TABLE items
  DROP CONSTRAINT IF EXISTS items_footprint_area_chk;
ALTER TABLE items
  ADD CONSTRAINT items_footprint_area_chk
  CHECK (footprint_area IS NULL OR footprint_area >= 0);

ALTER TABLE proposal_items
  DROP CONSTRAINT IF EXISTS proposal_items_footprint_area_chk;
ALTER TABLE proposal_items
  ADD CONSTRAINT proposal_items_footprint_area_chk
  CHECK (footprint_area IS NULL OR footprint_area >= 0);
