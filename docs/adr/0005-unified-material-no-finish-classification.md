# ADR-0005: Unified Material — Remove Finish Classification

| Field  | Value      |
| ------ | ---------- |
| Date   | 2026-05-04 |
| Status | Accepted   |

---

## Context

The Finish Library used two parallel tracks for the same underlying `materials` table row: a **Material** (assigned to FF&E Items) and a **Swatch** (assigned to Proposal Items). A `finish_classification` column (`material`, `swatch`, `hybrid`) drove section filters in the library UI. There was also a legacy `material_swatches` table (multiple hex colors per material) and a `proposal_items.swatches` JSONB column (hex strings on the item row) predating the normalized join-table approach.

In practice, users and code treated these as the same thing. The classification was never set explicitly by users — it was set by migration defaults or import logic. The export pipeline already routed entirely through the assignment join tables (`item_materials`, `proposal_item_materials`) and ignored classification for rendering. The dual naming created ongoing confusion and dead-code accumulation.

## Decision

Collapse to a single **Material** type in the Finish Library. Remove all classification infrastructure:

- Drop `finish_classification` column from `materials`
- Drop `material_swatches` table
- Drop `swatches` JSONB column from `proposal_items`

A Material's visual is either an uploaded image or a `swatch_hex` color; image takes precedence. The same Material can be assigned to FF&E Items and Proposal Items without re-classification.

Export rendering diverges at the output layer only: Proposal exports render the Material visual as an image-only Swatch Cell; FF&E exports render the Material visual + material ID inline on the item row.

Finish Library filters move from classification-based tabs (Materials / Swatches / All) to assignment-based tabs (All / Used in FF&E / Used in Proposal) with secondary Room and Proposal Category dropdowns for drill-down.

## Consequences

- The `finish_classification` column, `material_swatches` table, and `proposal_items.swatches` JSONB column cannot be recovered without a new migration. Historical data in those columns is discarded.
- Import workflows that previously auto-classified entries as `swatch` must be updated to create plain Materials.
- The `FinishClassification` frontend type and all `finishClassification` field references are removed.
- Export logic is simplified: Proposal swatch rendering no longer has a JSONB hex fallback path.
