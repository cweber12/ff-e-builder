# Design Review: Item Library

Reviewed against: `.design/item-library-overhaul/DESIGN_BRIEF.md`  
Philosophy: calm, precise, editorial, low-noise  
Date: 2026-06-04

## Screenshots Reviewed

Browser capture tools were not available in this session, so this review is based on the user-provided screenshots pasted in chat:

- Desktop Item Library list surface
- Tablet Item Library list surface
- Mobile Item Library list surface
- Desktop row hover state
- Desktop detail panel open state

Spreadsheet View was explicitly excluded from this review.

## Summary

The Item Library is materially closer to the brief than the original proposal table. The one-schedule model, flatter row rhythm, stronger image presence, and compact breakpoint adaptation are all moving in the right direction.

The remaining issues are mostly hierarchy problems, not structural failures. The default list still has three areas that break the intended editorial calm:

1. the sidebar still reads like a verbose utility stack instead of an integrated workflow rail,
2. the plan block hierarchy is backwards, with metadata sitting above the plan image instead of beside it,
3. the materials block still produces irregular text stacks that add visual noise row to row.

## Must Fix

### 1. Sidebar still breaks the low-noise, editorial reading model

**Why it fails**

In the desktop, tablet, and mobile screenshots, the left Item Library sidebar still reads like a settings panel rather than a refined project tool rail. The `Workflow`, `View`, `Actions`, and `Display` sections are technically organized, but the experience is still too verbose and too visually fragmented for the brief's "calm, precise, editorial" direction.

The biggest offenders are:

- repeated framing around proposal status,
- extra revision explainer copy,
- utility sections that feel stacked rather than integrated,
- too many lightweight text rows competing for attention with the main list.

**Code reference**

- [AppBarActions.tsx](/abs/path/c:/Projects/_current-projects/ffe-builder/src/components/project/AppBarActions.tsx:214)
- [AppBarActions.tsx](/abs/path/c:/Projects/_current-projects/ffe-builder/src/components/project/AppBarActions.tsx:226)
- [AppBarActions.tsx](/abs/path/c:/Projects/_current-projects/ffe-builder/src/components/project/AppBarActions.tsx:238)
- [AppBarActions.tsx](/abs/path/c:/Projects/_current-projects/ffe-builder/src/components/project/AppBarActions.tsx:258)
- [AppBarActions.tsx](/abs/path/c:/Projects/_current-projects/ffe-builder/src/components/project/AppBarActions.tsx:340)

**Best optimization**

- Collapse the sidebar into fewer, stronger modules.
- Keep `Proposal status` at the top, but make it the primary workflow card instead of one block inside a longer stack.
- Remove or heavily compress the revision helper sentence under `Revision mode`.
- Consolidate low-frequency actions so the rail looks more like a project sidebar and less like an inspector panel.

**Why this is the best choice**

The main list is now calm enough that the sidebar has become the loudest part of the page. Tightening the rail will improve the whole page immediately without changing the underlying interaction model.

### 2. Plan block hierarchy is reversed from the agreed scan model

**Why it fails**

In the desktop screenshot, `Location` and `Drawing` are visually leading the plan section while the plan image sits below them. That makes the block read top-to-bottom instead of left-to-right, weakens the image as the anchor, and reduces row-to-row comparability.

This also conflicts with the agreed structure: plan image first, metadata in a column to the right.

**Code reference**

- [ProposalRecordRow.tsx](/abs/path/c:/Projects/_current-projects/ffe-builder/src/components/proposal/table/row/ProposalRecordRow.tsx:152)
- [ProposalRecordRow.tsx](/abs/path/c:/Projects/_current-projects/ffe-builder/src/components/proposal/table/row/ProposalRecordRow.tsx:158)
- [ProposalRecordRow.tsx](/abs/path/c:/Projects/_current-projects/ffe-builder/src/components/proposal/table/row/ProposalRecordRow.tsx:169)

**Best optimization**

- Make the plan image the left column of the plan block.
- Move `Location` and `Drawing` into a fixed metadata column on the right.
- Keep both values vertically stacked and aligned to the top edge of the image.

**Why this is the best choice**

It restores the intended grouped-column model and gives the eye one consistent rule: image first, metadata second. That is easier to scan and closer to both the brief and the FF&E-inspired reference direction.

## Should Fix

### 3. Materials labels still create irregular noise and should be clamped harder

**Why it fails**

In the desktop screenshot, the materials block still creates tall, uneven text clusters because each material name and finish can wrap freely. The swatches align, but the text does not. This is especially visible on rows with long finish names.

Your desired rule is more disciplined: a two-column grid, one material per entry, one line per text row, maximum two lines total per entry.

**Code reference**

- [MaterialLibraryModal.tsx](/abs/path/c:/Projects/_current-projects/ffe-builder/src/components/materials/MaterialLibraryModal.tsx:1135)
- [MaterialLibraryModal.tsx](/abs/path/c:/Projects/_current-projects/ffe-builder/src/components/materials/MaterialLibraryModal.tsx:1154)
- [MaterialLibraryModal.tsx](/abs/path/c:/Projects/_current-projects/ffe-builder/src/components/materials/MaterialLibraryModal.tsx:1162)
- [MaterialLibraryModal.tsx](/abs/path/c:/Projects/_current-projects/ffe-builder/src/components/materials/MaterialLibraryModal.tsx:1170)

**Best optimization**

- Keep the two-column grid.
- Clamp material name to one line.
- Clamp finish name to one line.
- Reserve exactly two text rows below each swatch, whether or not both rows are populated.

**Why this is the best choice**

This preserves the information density without letting the materials block become the tallest or noisiest section in a row.

### 4. Compact layouts are usable, but the sidebar remains too heavy for tablet and mobile

**Why it fails**

On tablet and mobile, the compact cards themselves are reasonably legible, but the left-side workflow rail still consumes too much attention relative to the list. The page becomes tool-heavy before it becomes item-first.

**Code reference**

- [AppBarActions.tsx](/abs/path/c:/Projects/_current-projects/ffe-builder/src/components/project/AppBarActions.tsx:214)
- [AppBarActions.tsx](/abs/path/c:/Projects/_current-projects/ffe-builder/src/components/project/AppBarActions.tsx:320)

**Best optimization**

- Reduce sidebar copy further at compact breakpoints.
- Consider hiding lower-priority sections behind a single `More` or `Library settings` disclosure on smaller widths.

**Why this is the best choice**

The responsive layout already reorganizes the list correctly. The sidebar just has not been reduced aggressively enough to match that simplification.

## Could Improve

### 5. Hover media treatment is lighter than before, but still slightly too prominent

**Why it fails**

The hover screenshot is much improved, but the overlay text still competes with the image itself, especially on the plan thumbnail. The edit icon is the better affordance; the helper copy should stay secondary.

**Code reference**

- [ProposalRecordRow.tsx](/abs/path/c:/Projects/_current-projects/ffe-builder/src/components/proposal/table/row/ProposalRecordRow.tsx:134)
- [ProposalRecordRow.tsx](/abs/path/c:/Projects/_current-projects/ffe-builder/src/components/proposal/table/row/ProposalRecordRow.tsx:159)

**Best optimization**

- Keep the edit icon.
- Reduce helper text contrast and visual weight further.
- Prefer very short copy such as `Paste image` / `Paste swatch`.

**Why this is the best choice**

It keeps the fast update workflow while protecting the calm presentation of the row.

## What Is Working

- The one-schedule focus is clearly better than the old continuous multi-category scroll.
- The grouped record layout is much easier to scan than the original spreadsheet surface.
- Desktop rows have a stable rhythm and clearer section alignment than earlier slices.
- Tablet/mobile now reorganize instead of merely shrinking the desktop strip.
- The detail panel reads like the correct place for fuller item context.

## Recommended Next Refinement Order

1. Redesign the sidebar into a tighter workflow-first rail.
2. Rebuild the plan block so the image sits left and `Location` / `Drawing` sit in a right-hand metadata column.
3. Clamp materials text to a strict two-line-per-entry model.
4. Optionally soften hover helper text further after the structural fixes land.
