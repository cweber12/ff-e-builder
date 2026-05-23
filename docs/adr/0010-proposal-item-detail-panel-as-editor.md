# ADR-0010: Proposal Item Detail Panel is the focused editor, not a viewer

| Field      | Value              |
| ---------- | ------------------ |
| Date       | 2026-05-23         |
| Status     | Accepted           |
| Relates to | ADR-0008, ADR-0009 |

---

## Context

The current `ProposalItemDetailPanel` is a centered modal overlay that displays
a Proposal Item's images, fields, and totals in read-only form. It is opened
from the Proposal Table's per-row `⋮ → View details` action. To change any
value the user must close the panel and edit the cell in the table.

This makes the panel a duplicate, read-only view of the row. It adds no
editing capability the table lacks, and the spatial freedom it provides
(larger images, more breathing room for long descriptions) is wasted because
no editing happens there.

The Proposal Table itself is a dense, spreadsheet-style surface optimised for
bulk data entry across many items. It is not the right place to edit a single
item carefully — image cells are small, swatch selection requires a separate
modal, and adjacent rows compete for attention. Two distinct editing modes
exist conceptually but only one is implemented.

## Decision

Reposition the Proposal Item Detail Panel as the **focused single-item
editor**, co-equal with the Proposal Table:

- Dock the panel to the right side of the viewport (40–50% width) so the
  table remains visible while editing one item.
- Make every field inline-editable using the same components used by the
  table cells; the panel becomes the canonical place to edit images, swatches,
  notes, and descriptive fields.
- Add prev/next navigation across items in the active Proposal Category.
- Add a quick-actions menu in the panel header (Duplicate, Add to FF&E,
  Delete) so the user does not return to the row's `⋮` for common actions.
- When a Revision Round is open, render the item-scoped changelog inside the
  panel; this is also the surface used to attach retrospective notes to
  silently-logged non-price changes per ADR-0009.
- On narrow viewports the same component renders full-screen as the mobile
  editor; mobile cards become tap-to-open-editor.
- Unify the Materials display: a single rendering path drives both the
  in-panel materials list and the swatch gallery so they cannot drift.

The Proposal Table remains the bulk-entry surface; the Detail Panel becomes
the focused-edit surface. Row-click opens the panel by default
(see Stop 3a in the proposal-UX grill session, 2026-05-23).

## Considered options

- **Keep the panel read-only and treat the table as the only editor** —
  rejected: edit ergonomics in the table are already at the limit of what a
  spreadsheet-style surface can carry without losing density; pushing more
  affordances into rows degrades the bulk-entry use case.
- **Delete the panel entirely** — rejected: image-heavy review (renderings,
  plans, swatches) is poorly served by row-sized thumbnails, and a focused
  edit surface is needed for mobile per Stop 9.
- **Two separate components, one read-only viewer and one editor** —
  rejected: doubles the maintenance surface and forces the user to choose
  between viewing and editing before opening, which is the same mental cost
  as today's "close then re-edit in row".

## Consequences

- `ProposalItemDetailPanel` is a substantial rewrite; it shares editable-field
  components with the table cells to keep edit behaviour consistent across
  the two surfaces.
- Mobile (`MobileProposalCards`) no longer needs a parallel edit
  implementation; it composes the same editor component full-screen.
- The shared editable-fields component becomes a third caller alongside the
  table cell renderers and the cell-anchored Size popover from Stop 3b;
  these should land as one coordinated module to avoid edit-behaviour drift.
- Row-click on the Proposal Table now opens the panel (replacing the
  previously-unused `onRowClick`); the `⋮ → View details` action becomes
  redundant and is removed.
- Per ADR-0009, the panel changelog becomes the place to attach retrospective
  notes to non-price changes; the panel and the audit workflow are now
  coupled and should be specced together.
