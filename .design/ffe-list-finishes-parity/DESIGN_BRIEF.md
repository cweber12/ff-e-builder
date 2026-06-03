# Design Brief: FF&E List Panel Parity With Finishes Panel

## Problem

When designers move between the Finish Library and FF&E Catalog, the side-panel experience changes shape and hierarchy. The finishes panel behaves like a focused utility rail with a clear header, filters, search, add action, and compact scannable rows. The current FF&E list reads more like page content. That mismatch makes the FF&E Catalog feel less cohesive and slows item browsing, especially when users want to keep the catalog page in view while managing the visible FF&E set.

## Solution

Turn the FF&E list into a docked management panel that uses the same structural language as the finishes panel: identical header/action hierarchy, the same control stack, and the same compact row rhythm. On desktop, the panel should behave like a dedicated left-side utility rail beside the catalog canvas. On mobile, it should preserve the current slide-in panel behavior. The catalog page remains the primary surface and should stay centered within the remaining visible workspace whenever the FF&E list panel is open.

## Experience Principles

1. Utility rail over content page -- The FF&E list should feel like an operational side panel, not a second main page competing with the catalog.
2. Pattern reuse over bespoke variation -- Reuse the finishes panel grammar so users learn one browse-and-manage pattern across related tools.
3. Catalog focus over list dominance -- The list supports navigation and maintenance, but the catalog sheet stays visually central and primary.

## Aesthetic Direction

- **Philosophy**: Shared utility-rail language within the existing warm paper workspace.
- **Tone**: Calm, organized, editorial, task-focused.
- **Reference points**: The current finishes panel in `MaterialsView`, the catalog navigator row rhythm, and the app's sidebar chrome.
- **Anti-references**: Card-heavy dashboard layouts, dense spreadsheet styling, or a second full-width FF&E content page competing with the catalog stage.

## Existing Patterns

- Typography: `font-display` uses Manrope Variable; serif is reserved for page-level heroes. Utility labels use the existing `eyebrow` and `num` classes.
- Colors: Warm paper/canvas tokens from `src/index.css` drive the UI. Relevant surfaces include `bg-white`, `bg-canvas-shell`, `bg-canvas-chrome`, `border-neutral-200`, and brand blue actions.
- Spacing: The finishes panel uses `px-4 py-4` header padding, `gap-3` stacked controls, `px-4 py-3` list rows, and `h-16 w-16` media blocks.
- Components: `Button` variants such as `addAction`, `SidebarHeaderMenu`, `toolbar-select`, `toolbar-input`, `ImageFrame`, `ItemStatusChip`, `SlotPortal`, and the project tool sidebar shell already establish the needed vocabulary.

## Component Inventory

| Component              | Status     | Notes                                                                                                                                                   |
| ---------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FF&E list panel shell  | Modify     | Convert current FF&E list from page section to finishes-style docked panel structure.                                                                   |
| FF&E list header       | Modify     | Match finishes header pattern: title, count, options/actions framing if needed.                                                                         |
| FF&E category dropdown | New/Modify | Add a top control matching the finishes category select styling; likely filters proposal-category groups rather than replacing grouping logic outright. |
| FF&E search input      | New        | Add finishes-style `toolbar-input` search for item ID, name, and location text.                                                                         |
| Add item button        | Modify     | Replace text-link `Add +` treatment with full-width `addAction` button matching finishes.                                                               |
| FF&E list row          | Modify     | Restructure row into shared four-zone layout: image, ID/quantity, name/location, status/edit.                                                           |
| FF&E row image cell    | Reuse      | Reuse `ImageFrame` with the existing 64x64 compact treatment.                                                                                           |
| FF&E status cell       | Reuse      | Reuse `ItemStatusChip`, but place it in the dedicated trailing status/edit column.                                                                      |
| FF&E row edit action   | Modify     | Promote edit/remove affordance into the trailing action column instead of a separate page-level text link treatment.                                    |
| Catalog stage shell    | Modify     | Adjust desktop layout so the catalog sheet centers within remaining space when the docked FF&E panel is visible.                                        |
| Mobile FF&E panel      | Modify     | Mirror the desktop panel structure inside the existing slide-in mobile shell.                                                                           |

## Key Interactions

- Opening FF&E List from the FF&E tool should reveal a docked desktop panel using the same visual structure as the finishes panel rather than navigating to a content-first list page.
- The panel header shows `FF&E`, the visible item count, a category dropdown, a search field, and a full-width add-item action in the same order and spacing as the finishes panel.
- The category dropdown filters the list by Proposal Category or equivalent FF&E grouping while preserving the existing shared-generated-item data model.
- The search field filters live against item tag/ID, item name, and location/category text.
- Each row uses a four-part structure:
  image, ID/quantity, name/location, status/edit.
- Clicking the row's primary content should keep catalog navigation efficient, ideally targeting the item's catalog page without making the trailing edit controls ambiguous.
- The trailing status/edit column should keep status legible at scan speed and expose edit or maintenance actions without disrupting row navigation.
- Add item should keep the current Add to FF&E flow, but the entry point should visually match the finishes panel's `New finish` pattern.
- On desktop, when the panel is open, the catalog stage width shrinks but its page remains centered inside the available canvas region rather than drifting or pinning visually off-center.
- On mobile, the same panel content should appear in a right-side overlay with the existing close behavior.

## Responsive Behavior

- Desktop: FF&E list renders as a dedicated docked panel in the tool shell, analogous to the materials finishes rail. The catalog canvas occupies the remaining width and centers the page within that space.
- Tablet/mobile: FF&E list becomes a slide-in overlay panel from the side, preserving the catalog as the underlying primary surface.
- The control stack remains vertical across breakpoints to preserve parity with the finishes panel.
- Row density should stay compact, but trailing controls may collapse to simpler action text/buttons on narrower widths if needed.

## Accessibility Requirements

- Preserve keyboard access for panel toggle, category dropdown, search input, add action, row navigation, and edit/remove controls.
- Maintain visible focus states using the existing brand focus ring patterns.
- Keep text/background contrast consistent with the current neutral and brand palette.
- Ensure row actions are not hidden behind hover-only affordances.
- Distinguish row-primary navigation from trailing edit/status controls for screen readers with explicit labels.
- Preserve dialog semantics for add-item flows and mobile slide-in panel interactions.

## Out of Scope

- Redesigning catalog page typography, export layout, or editor controls.
- Changing FF&E item data structure, proposal-linking rules, or Add to FF&E business logic.
- Reworking the Finish Library itself beyond using it as the structural reference.
- Introducing a new cross-tool design language separate from the existing sidebar/panel system.

## Assumptions

- The requested parity is primarily structural and visual, not a request to make FF&E item behavior identical to finish drag-and-drop behavior.
- The desktop implementation should follow the existing slot-portal shell used by `MaterialsView` rather than keeping FF&E list as standalone page content.
- "Category dropdown" refers to filtering the FF&E list by its current Proposal Category grouping source, since the catalog/list grouping currently comes from FF&E-visible items grouped by Proposal Category.
