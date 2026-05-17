-- Migration: 0029_items_ffe_visibility
-- Adds an explicit FF&E visibility flag for canonical Generated Items.
-- Proposal items can stay linked to items for shared data/revisions without
-- appearing in FF&E until a user chooses Add to FF&E. Furniture remains visible.

ALTER TABLE items
  ADD COLUMN IF NOT EXISTS is_ffe_visible boolean NOT NULL DEFAULT true;

UPDATE items i
SET is_ffe_visible = false
FROM proposal_item_generated_item_links link
JOIN proposal_items pi ON pi.id = link.proposal_item_id
JOIN proposal_categories pc ON pc.id = pi.category_id
WHERE i.id = link.item_id
  AND lower(trim(pc.name)) <> 'furniture';

UPDATE items i
SET is_ffe_visible = true
FROM proposal_categories pc
WHERE i.proposal_category_id = pc.id
  AND lower(trim(pc.name)) = 'furniture';

CREATE INDEX IF NOT EXISTS items_room_ffe_visible_idx
  ON items(room_id, is_ffe_visible, sort_order, created_at);
