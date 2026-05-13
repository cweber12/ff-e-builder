# Per-field proposal item changelog with linked cost records and deferred cost state

Proposal Item Changes are recorded per field rather than per save, so that each cell in the proposal table can display its own history without reconstructing diffs. When a Price-Affecting Column change is confirmed alongside a price update, two changelog records are written in one transaction — one for the field and one for `unitCostCents` — linked by a `related_change_id` FK. This lets `WHERE column_key = 'unitCostCents'` find all cost changes uniformly without knowing which other field triggered the update.

`cost_update_deferred` is stored as a boolean on `proposal_items` rather than derived from changelog state, because the deferred-items banner requires a simple aggregatable query across all items, not a changelog reconstruction per item.

## Considered options

- **Per-save changelog** — rejected: can't display per-cell history without reconstructing field-level diffs from full-item snapshots.
- **Attached `new_unit_cost_cents` field on the triggering record** — rejected: cost history queries require two different patterns (`column_key = 'unitCostCents'` OR `new_unit_cost_cents IS NOT NULL`), complicating future features.
- **Deferred state derived from changelog** — rejected: the deferred banner lists all items with pending cost updates; deriving this per-item requires a subquery or reconstruction instead of a plain boolean filter.
