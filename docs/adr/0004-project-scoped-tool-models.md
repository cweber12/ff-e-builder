# ADR-0004: Project-Scoped Tool Models

| Field  | Value      |
| ------ | ---------- |
| Date   | 2026-05-03 |
| Status | Accepted   |

---

## Context

ChillDesignStudio now supports both room-based FF&E schedules and category-based Proposals inside the same Project. The tempting shortcut was to reuse Rooms and Items for both tools, but Proposal rows have different grouping language, columns, units, image needs, and export shape.

## Decision

Keep FF&E and Proposal as separate Project-scoped data models. FF&E uses `rooms` and `items`; Proposal uses `proposal_categories` and `proposal_items`. They share Project ownership, budgets, user profile context, material library access, and the private `image_assets`/R2 gateway, but each tool owns its own row schema and page routes.

The Proposal model was originally named Take-Off. Migration `0012_proposal_rename.sql` renamed the database tables, routes, and client modules to Proposal.

## Consequences

- FF&E behavior can evolve without Proposal-specific columns or category rules leaking into room/item code.
- Proposal can use category defaults, measurement units, CBM, drawing/location fields, and dedicated exports without bending the FF&E item model.
- Shared project services still need careful seams, especially Materials, because FF&E and Proposal both assign entries from the unified Finish Library.
