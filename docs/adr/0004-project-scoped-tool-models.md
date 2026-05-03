# ADR-0004: Project-Scoped Tool Models

| Field  | Value      |
| ------ | ---------- |
| Date   | 2026-05-03 |
| Status | Accepted   |

---

## Context

ChillDesignStudio now supports both room-based FF&E schedules and category-based Take-Off Tables inside the same Project. The tempting shortcut was to reuse Rooms and Items for both tools, but Take-Off rows have different grouping language, columns, units, image needs, and export shape.

## Decision

Keep FF&E and Take-Off as separate Project-scoped data models. FF&E uses `rooms` and `items`; Take-Off uses `takeoff_categories` and `takeoff_items`. They share Project ownership, budgets, user profile context, material library access, and the private `image_assets`/R2 gateway, but each tool owns its own row schema and page routes.

## Consequences

- FF&E behavior can evolve without Take-Off-specific columns or category rules leaking into room/item code.
- Take-Off can use category defaults, measurement units, CBM, drawing/location fields, and dedicated exports without bending the FF&E item model.
- Shared project services still need careful boundaries, especially Materials, because FF&E material assignment is normalized while Take-Off swatches are currently row-level values.
