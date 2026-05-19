-- Migration: 0033_generated_item_lookup_indexes
-- Adds query-focused indexes for the current Generated Item bridge.
-- These support the hot table-loading and cross-view defaulting paths without
-- changing the transitional items / proposal_items storage contract.

CREATE INDEX IF NOT EXISTS rooms_project_lower_name_idx
  ON rooms(project_id, lower(name));

CREATE INDEX IF NOT EXISTS proposal_categories_project_lower_name_idx
  ON proposal_categories(project_id, lower(name));

CREATE INDEX IF NOT EXISTS proposal_items_category_sort_idx
  ON proposal_items(category_id, sort_order, created_at);

CREATE INDEX IF NOT EXISTS proposal_item_changelog_revision_changed_idx
  ON proposal_item_changelog(revision_id, changed_at)
  WHERE revision_id IS NOT NULL;
