-- Add is_price_affecting flag to proposal_item_changelog so the client can
-- distinguish edits that triggered a Revision Round from non-price-affecting
-- edits within the same round.
ALTER TABLE proposal_item_changelog
  ADD COLUMN is_price_affecting boolean NOT NULL DEFAULT false;
