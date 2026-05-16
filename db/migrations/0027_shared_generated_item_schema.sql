-- Migration: 0027_shared_generated_item_schema
-- Stages the shared Generated Item schema so FF&E and Proposal can become
-- different views over one canonical item table in later slices.
--
-- This migration does not remove proposal_items or switch runtime reads/writes.
-- Existing proposal_items are copied into items and linked through
-- proposal_item_generated_item_links so later slices can reattach images,
-- materials, changelog entries, and revision snapshots safely.

-- ─── Canonical proposal-view fields on items ───────────────────────────────

ALTER TABLE items
  ADD COLUMN IF NOT EXISTS proposal_category_id uuid REFERENCES proposal_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS product_tag text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS drawings text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS location text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS size_label text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS size_mode text NOT NULL DEFAULT 'imperial',
  ADD COLUMN IF NOT EXISTS size_w text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS size_d text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS size_h text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS size_unit text NOT NULL DEFAULT 'in',
  ADD COLUMN IF NOT EXISTS cbm numeric(12,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quantity numeric(12,2) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS quantity_unit text NOT NULL DEFAULT 'unit';

ALTER TABLE items
  DROP CONSTRAINT IF EXISTS items_size_mode_chk,
  DROP CONSTRAINT IF EXISTS items_cbm_chk,
  DROP CONSTRAINT IF EXISTS items_quantity_chk;

ALTER TABLE items
  ADD CONSTRAINT items_size_mode_chk CHECK (size_mode IN ('imperial', 'metric')),
  ADD CONSTRAINT items_cbm_chk CHECK (cbm >= 0),
  ADD CONSTRAINT items_quantity_chk CHECK (quantity >= 0);

CREATE INDEX IF NOT EXISTS items_proposal_category_id_idx
  ON items(proposal_category_id, sort_order, created_at);

-- ─── Default cross-view groupings ───────────────────────────────────────────

INSERT INTO proposal_categories (project_id, name, sort_order)
SELECT p.id, 'Furniture', 0
FROM projects p
WHERE NOT EXISTS (
  SELECT 1
  FROM proposal_categories pc
  WHERE pc.project_id = p.id AND lower(pc.name) = 'furniture'
);

INSERT INTO rooms (project_id, name, sort_order)
SELECT p.id, 'Unassigned', 0
FROM projects p
WHERE NOT EXISTS (
  SELECT 1
  FROM rooms r
  WHERE r.project_id = p.id AND lower(r.name) = 'unassigned'
);

-- Existing FF&E items become Proposal-visible under Furniture by default.
UPDATE items i
SET
  proposal_category_id = pc.id,
  product_tag = COALESCE(i.item_id_tag, ''),
  quantity = i.qty::numeric,
  quantity_unit = 'unit'
FROM rooms r
JOIN proposal_categories pc
  ON pc.project_id = r.project_id
 AND lower(pc.name) = 'furniture'
WHERE i.room_id = r.id
  AND i.proposal_category_id IS NULL;

-- ─── Legacy proposal item compatibility mapping ────────────────────────────

CREATE TABLE IF NOT EXISTS proposal_item_generated_item_links (
  proposal_item_id uuid PRIMARY KEY REFERENCES proposal_items(id) ON DELETE CASCADE,
  item_id uuid NOT NULL UNIQUE REFERENCES items(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS proposal_item_generated_item_links_item_id_idx
  ON proposal_item_generated_item_links(item_id);

WITH source AS (
  SELECT
    pi.id AS proposal_item_id,
    gen_random_uuid() AS generated_item_id,
    r.id AS room_id,
    pi.category_id AS proposal_category_id,
    pi.product_tag,
    pi.plan,
    pi.drawings,
    pi.location,
    pi.description,
    pi.notes,
    pi.size_label,
    pi.size_mode,
    pi.size_w,
    pi.size_d,
    pi.size_h,
    pi.size_unit,
    pi.cbm,
    pi.quantity,
    pi.quantity_unit,
    pi.unit_cost_cents,
    pi.sort_order,
    pi.custom_data,
    pi.version,
    pi.created_at,
    pi.updated_at
  FROM proposal_items pi
  JOIN proposal_categories pc ON pc.id = pi.category_id
  JOIN rooms r
    ON r.project_id = pc.project_id
   AND lower(r.name) = 'unassigned'
  WHERE NOT EXISTS (
    SELECT 1
    FROM proposal_item_generated_item_links link
    WHERE link.proposal_item_id = pi.id
  )
),
inserted AS (
  INSERT INTO items (
    id,
    room_id,
    item_name,
    description,
    category,
    item_id_tag,
    dimensions,
    notes,
    qty,
    unit_cost_cents,
    lead_time,
    status,
    custom_data,
    sort_order,
    version,
    created_at,
    updated_at,
    proposal_category_id,
    product_tag,
    plan,
    drawings,
    location,
    size_label,
    size_mode,
    size_w,
    size_d,
    size_h,
    size_unit,
    cbm,
    quantity,
    quantity_unit
  )
  SELECT
    generated_item_id,
    room_id,
    COALESCE(NULLIF(description, ''), NULLIF(product_tag, ''), 'Proposal item'),
    NULLIF(description, ''),
    NULL,
    NULLIF(product_tag, ''),
    NULLIF(size_label, ''),
    NULLIF(notes, ''),
    GREATEST(0, CEIL(quantity))::int,
    unit_cost_cents,
    NULL,
    'pending',
    custom_data,
    sort_order,
    version,
    created_at,
    updated_at,
    proposal_category_id,
    product_tag,
    plan,
    drawings,
    location,
    size_label,
    size_mode,
    size_w,
    size_d,
    size_h,
    size_unit,
    cbm,
    quantity,
    quantity_unit
  FROM source
  RETURNING id
)
INSERT INTO proposal_item_generated_item_links (proposal_item_id, item_id)
SELECT source.proposal_item_id, source.generated_item_id
FROM source
JOIN inserted ON inserted.id = source.generated_item_id
ON CONFLICT (proposal_item_id) DO NOTHING;
