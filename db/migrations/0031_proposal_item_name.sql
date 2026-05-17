-- Migration: 0031_proposal_item_name
-- Persists the Proposal Name field on proposal_items so compatibility storage
-- does not have to infer names from Product Description during Generated Item
-- mirroring.

ALTER TABLE proposal_items
  ADD COLUMN IF NOT EXISTS item_name text NOT NULL DEFAULT '';

UPDATE proposal_items pi
SET item_name = COALESCE(
  NULLIF(i.item_name, ''),
  NULLIF(pi.description, ''),
  NULLIF(pi.product_tag, ''),
  'Proposal item'
)
FROM proposal_item_generated_item_links link
JOIN items i ON i.id = link.item_id
WHERE pi.id = link.proposal_item_id
  AND NULLIF(pi.item_name, '') IS NULL;

UPDATE proposal_items
SET item_name = COALESCE(
  NULLIF(description, ''),
  NULLIF(product_tag, ''),
  'Proposal item'
)
WHERE NULLIF(item_name, '') IS NULL;
