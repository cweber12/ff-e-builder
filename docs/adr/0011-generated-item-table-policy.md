# ADR-0011: Generated Item Table Policy Over A Shared Shell

| Field       | Value      |
| ----------- | ---------- |
| Date        | 2026-05-29 |
| Status      | Accepted   |
| Complements | ADR-0008   |

---

## Context

ADR-0008 set the direction that FF&E and Proposal are views over shared Generated Item data and that table/export behavior should converge on shared modules with view presets.

In practice the two tables diverged below the cell layer:

- **Rendering engines differ.** `src/components/ffe/items/FfeTableView.tsx` drives layout through TanStack Table (`useReactTable`, `ColumnDef[]`, `flexRender`). `src/components/proposal/table/category/ProposalCategorySection.tsx` hand-rolls rows by mapping over a column order. There is no shared table shell.
- **Structure differs.** FF&E is a ~2,279-line monolith that owns its entire scaffold; Proposal is a thin orchestrator (`ProposalTable.tsx`) plus a ~700-line section. The shells do not share a shape.
- **Consistency-critical policy was duplicated as per-view twins** and drifted: `lib/table/emptyColumns.ts` exposed both `emptyProposalColumnIds` and `emptyFfeColumnIds` (same omission policy, two copies), so "omit empty columns by default" landed in Proposal but not FF&E. `generatedItemStickyStyles.ts` exposed `ffeStickyEdgeColumnClassNames`, `proposalStickyEdgeColumnClassNames`, and `proposalStickyValueColumnClassNames` — FF&E has edge-only sticky while Proposal has edge + value, which is the visible FF&E sticky gap.

FF&E is a secondary surface to the FF&E Catalog. Rewriting FF&E onto Proposal's engine (or vice versa) to enable one shared shell is not worth the cost. The goal is **visual consistency** (sticky columns, column order, column organization) and **functional consistency** (icons, options, actions) without an engine rewrite.

## Decision

Share a **Generated Item Table Policy**, not a shared shell or a shared rendering engine.

- Do **not** build a unified `<GeneratedItemTable>` component and do **not** converge the two rendering engines. The shells stay separate; FF&E keeps TanStack, Proposal keeps hand-rolled rows.
- Introduce the **Generated Item Table Policy**: a pure resolver keyed by a View Preset that produces a **Resolved Column Model** — an ordered list of column descriptors carrying id, label, group, sticky kind, `omitWhenEmpty`, cell kind, and actions/icons.
- Both shells **read** the Resolved Column Model and only translate it into their own engine (FF&E → TanStack `ColumnDef[]`; Proposal → hand-rolled order). Neither shell decides order, sticky, omission, organization, or the action set on its own.
- **Proposal behavior is canonical.** FF&E derives from the same policy and diverges only through explicit View Preset fields (ADR-0008 permits different default columns and labels).
- Collapse per-view policy twins (`emptyFfeColumnIds`/`emptyProposalColumnIds`, the `ffe`/`proposal` sticky-style pairs) into single policy functions consumed through the Resolved Column Model.

## Consequences

- Changes to order, organization, sticky designation, empty-column omission, and per-column actions/icons are made once in the policy/preset and both tables inherit them.
- The policy is a pure function, so it becomes the unit-test surface for consistency rules that today are only reachable by rendering large components.
- **Residual divergence:** which columns are sticky and in what order is shared, but the exact sticky pixel offset (it depends on preceding column widths) is still computed per engine. Given FF&E is secondary, this is acceptable.
- Migration is incremental, one policy at a time: empty-omission first (the active bug), then sticky, then order/organization, then actions. FF&E keeps its engine throughout.
- No database, route, or runtime-contract change. This complements ADR-0008 and supersedes nothing.
- Future architecture passes should not re-suggest unifying the two table shells or rendering engines; that path was considered and rejected here for a load-bearing reason (FF&E secondary to the Catalog).
