# Technical Debt — Plans Module

## TD-PLANS-001: FFE item soft-delete does not remove orphaned measurements

**Context:** When an FFE item is "deleted" (hidden), the worker sets `is_ffe_visible = false` on the `items` row — the row itself is never removed. Any `measurements` rows with `target_item_id = {ffeItemId}` and `target_kind = 'ffe'` are left in place.

**Why it matters:** A hidden FFE item's measurements still appear in the plan canvas measurement list. The target item will resolve from the DB (the row exists), but the item is no longer visible in the FFE table, creating a confusing UX mismatch.

**Note on the proposal path:** This was already fixed — `DELETE /api/v1/proposal/items/:id` now cascade-deletes `measurements` rows before deleting the proposal item row.

**Decision needed:**

- Should hiding an FFE item (soft-delete) also delete its plan measurements?
- Or should FFE measurements persist until the item is hard-deleted or restored?

**Constraint:** `target_item_id` has no FK constraint (it's a discriminated union across two tables), so cleanup must be handled at the application layer in `api/src/routes/items.ts`.

**Suggested fix when ready:**
Add to the FFE item delete handler in `api/src/routes/items.ts`:

```sql
DELETE FROM measurements WHERE target_item_id = ${id} AND target_kind = 'ffe'
```

Decide whether this fires on soft-delete (`is_ffe_visible = false`) or only on a future hard-delete path.
