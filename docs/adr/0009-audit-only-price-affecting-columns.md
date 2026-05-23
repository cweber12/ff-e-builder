# ADR-0009: Audit prompt fires only on Price-Affecting Column edits

| Field      | Value      |
| ---------- | ---------- |
| Date       | 2026-05-23 |
| Status     | Accepted   |
| Relates to | ADR-0007   |

---

## Context

ADR-0007 established a per-field Proposal Item changelog so each cell can carry
its own history once the proposal advances past `in_progress`. The original
implementation also surfaces a `ChangeConfirmModal` to the user on **every**
tracked field edit past `in_progress`, prompting for change notes and a
price-affecting flag.

In practice this interrupts data entry on every cosmetic correction —
typo fixes in `description`, `notes`, `drawings`, and `location` all trigger the
modal even though those columns are not Price-Affecting Columns per CONTEXT.md
and cannot, by definition, open a Revision Round. The modal accounts for the
majority of friction reported on the Proposal Table.

## Decision

Restrict the `ChangeConfirmModal` user prompt to edits of **Price-Affecting
Columns only** (`quantity`, `size`, `cbm`, and `unitCostCents`). Edits to
other tracked fields continue to write changelog records as today, but do so
silently without a confirmation step.

Notes input for non-price changes moves to the **Proposal Item Detail Panel**
changelog view (per ADR-0010), where the user can annotate after the fact if
they choose.

## Considered options

- **Keep modal on every tracked edit** — rejected: the friction is the most
  common day-to-day complaint; the audit value of forced notes on non-price
  fields is low because non-price changes do not affect costs and rarely need
  per-edit context.
- **Per-user setting to enable/disable the modal** — rejected: settings split
  the team across two audit behaviours, undermining the consistency of the
  changelog for downstream consumers (revisions, exports, ADR-0007 cost
  reconciliation).
- **Always silent, never prompt** — rejected: Price-Affecting Column edits
  open a Revision Round and require the user's intent to be captured at the
  moment of change; silently snapshotting a price-affecting change makes the
  Revision Snapshot harder to interpret later.

## Consequences

- Changelog volume and shape are unchanged; only the user prompt is gated.
- `proposalPatchToGeneratedItemChangeInfo` (or its caller) becomes the single
  point that decides "prompt vs silent log" based on whether the patch touches
  a Price-Affecting Column.
- Tests covering the modal must distinguish between price-affecting and
  non-price patches.
- The Proposal Item Detail Panel changelog (ADR-0010) becomes the
  retrospective surface for adding notes to silently-logged changes.
