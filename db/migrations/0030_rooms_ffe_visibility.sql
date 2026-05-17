-- Migration: 0030_rooms_ffe_visibility
-- Adds an explicit FF&E visibility flag for Locations stored in rooms.
-- Removing a Location from FF&E should not delete the room row, items,
-- Proposal rows, images, revisions, or linked generated item data.

ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS is_ffe_visible boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS rooms_project_ffe_visible_idx
  ON rooms(project_id, is_ffe_visible, sort_order, created_at);
