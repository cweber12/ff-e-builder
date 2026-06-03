# Design Brief: Item Library Overhaul

## Problem

Lead interior designers and PMs need to review and maintain project items quickly, but the current Proposal page behaves like a wide spreadsheet. It forces horizontal scrolling, mixes too many controls into the table chrome, shows all categories in one continuous stream, and makes image-heavy specification work feel noisy instead of focused. Users need a cleaner way to jump into one schedule, scan items rapidly, update images with minimal friction, and reserve dense editing for moments when they explicitly want it.

## Solution

Reframe the current Proposal page as an Item Library: a calmer, scan-first workspace for project items grouped by user-defined schedules. The default experience shows one selected schedule at a time in a structured multi-block list that emphasizes imagery, item identity, plan context, materials, and pricing without spreadsheet sprawl. Fast image maintenance stays available everywhere through visible hover affordances and paste support, while a secondary Spreadsheet View preserves high-density editing for power-user workflows.

## Experience Principles

1. Scanability over spreadsheet density -- The default view should privilege quick visual comprehension, grouped information blocks, and low horizontal friction over exposing every editable field at once.
2. Progressive disclosure over control clutter -- Primary context switching and lightweight actions stay visible; advanced column controls, dense editing, and revision comparison appear only when intentionally invoked.
3. Image-first maintenance over modal-heavy workflows -- Rendering, plan image, and swatch updates should feel immediate through hover affordances and `Ctrl+V` paste support, reducing friction for the most common maintenance action.

## Aesthetic Direction

- **Philosophy**: Editorial spec workspace. The interface should feel like a refined, image-aware scheduling surface rather than an admin grid.
- **Tone**: Calm, precise, editorial, low-noise.
- **Reference points**: A polished specification browser, somewhere between a premium asset library and a luxury scheduling tool.
- **Anti-references**: Airtable, Notion table view, or a generic admin data grid.

## Existing Patterns

Components, tokens, and conventions already in the codebase that this design must respect or extend.

- Typography: Tailwind uses `Manrope Variable` and `DM Sans Variable` for sans/display UI, `Fraunces Variable` for selective serif emphasis, and `JetBrains Mono Variable` for tabular/meta content.
- Colors: Tailwind is wired to CSS-variable tokens for `brand`, `neutral`, `canvas`, `surface`, `success`, `warning`, and `danger` scales. The proposal redesign should extend these tokens rather than introduce a disconnected palette.
- Spacing: Existing spacing is Tailwind-first with a few custom extensions (`13`, `18`, `112`, `128`) and shared radius/shadow tokens (`radius-sm`, `radius-md`, `radius-pill`, `shadow-*`, `paper-shadow`).
- Components: Existing proposal and shared UI vocabulary includes `ProposalTable`, `ProposalCategorySection`, `ProposalCategoryHeader`, `ProposalCategoryExpandedTable`, `ProposalItemDetailPanel`, shared sidebar controls, shared table/image cells, `ProposalStatusSelect`, `ColumnsPanel`, `SidebarHeaderSelect`, `SidebarHeaderMenu`, and shared modals. The redesign should reuse and reorganize these patterns rather than replace the app shell.

## Component Inventory

| Component                            | Status | Notes                                                                                                                            |
| ------------------------------------ | ------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Item Library page title / copy layer | Modify | Rename Proposal UI copy to Item Library for this slice without changing routes, API contracts, or internal data model names.     |
| Schedule selector                    | New    | Main-content header dropdown for user-defined schedules with count and subtotal metadata.                                        |
| Item Library header summary          | New    | Context bar showing active schedule, item count, and selected-schedule subtotal.                                                 |
| Default item row blocks              | New    | Replace spreadsheet-style default presentation with structured blocks: Item, Plan, Specs, Materials, Pricing.                    |
| Item block                           | Modify | Group rendering, ID, item name, and location into one high-scan identity block.                                                  |
| Plan block                           | Modify | Group plan image with drawing reference; remove location from this block.                                                        |
| Specs block                          | Modify | Show dimensions, footprint, two-line description preview, and CBM.                                                               |
| Materials block                      | New    | Dedicated block for swatch strip / assigned finishes in the default list.                                                        |
| Pricing block                        | Modify | Compact quantity, unit cost, and total display; revision comparison hidden by default outside revision mode.                     |
| Image hover affordance               | Modify | Visible hover actions for rendering, plan image, and swatches, with paste support in any mode.                                   |
| Spreadsheet View                     | Modify | Preserve full-screen dense editing mode as an optional power-user surface with full inline text editing and fast item switching. |
| Item detail panel                    | Modify | Keep as the focused editing surface; add custom data here instead of surfacing custom fields in the default list.                |
| Proposal sidebar context             | Modify | Reorganize into Item Library-specific sections for view, actions, display/configuration, and status/revision context.            |
| Category/schedule header             | Modify | Strip category-row chrome down to essentials; remove most controls from per-schedule headers.                                    |
| Revision mode toggle                 | New    | Optional mode that reveals before/after pricing comparison only when the user requests it.                                       |
| Add schedule flow                    | Modify | UI copy and entry point shift from Add category to Add schedule.                                                                 |

## Key Interactions

- The user opens the Item Library and lands in a single active schedule instead of a vertically continuous all-schedules view.
- The user switches schedules from a dropdown in the main content header. The menu includes schedule names plus count and subtotal metadata so switching feels informed.
- The default list renders each item as a structured horizontal record with five blocks: Item, Plan, Specs, Materials, and Pricing.
- The user can scan descriptions inline as a two-line preview; full description remains in the item detail panel and Spreadsheet View.
- Hovering rendering, plan image, or swatch surfaces reveals an explicit update affordance. The same surfaces accept `Ctrl+V` paste for rapid image replacement in any mode.
- Clicking an item opens the existing detail panel for focused editing, richer fields, and custom data.
- The user can enter an optional Spreadsheet View when they need dense editing, broad inline text updates, or rapid switching across items. This mode keeps all fields editable inline.
- The sidebar owns top-level actions and configuration: add schedule, add item, import/export, revision mode, display controls for Spreadsheet View, and proposal status/revision context.
- Revision comparison is not part of the default reading experience. A dedicated revision mode reveals before/after pricing values when needed.

## Responsive Behavior

- Desktop is the primary target. The default Item Library view should optimize for wide-screen scanning without relying on horizontal page scrolling.
- The schedule selector stays in the main content header on desktop. On narrower layouts it may collapse into a smaller dropdown treatment while remaining the primary context switch.
- The default item row should preserve its grouped-block logic on tablet, reducing density before collapsing into more vertical stacking.
- On mobile, the interface can stack record blocks vertically and rely more heavily on the detail panel/mobile editor patterns already present in the proposal surface.
- Spreadsheet View remains optional and desktop-forward; on narrow screens it should degrade gracefully or defer to the existing focused item-editing patterns instead of forcing a compressed grid.

## Accessibility Requirements

- Maintain accessible contrast across the neutral/canvas palette and any new hover or revision states, especially for metadata, badges, and image action affordances.
- All schedule switching, item selection, sidebar actions, revision toggles, and Spreadsheet View controls must be keyboard reachable and visibly focused.
- Hover-only image affordances must have a keyboard-accessible equivalent.
- `Ctrl+V` image updates should be additive convenience, not the only mechanism; explicit buttons or menus must remain available.
- The grouped record layout must preserve clear semantics for screen readers, including meaningful labels for each block and each image surface.
- Detail panel and any full-screen/Spreadsheet View transitions must preserve focus management and escape/close behavior.

## Out of Scope

- Renaming routes, API contracts, hooks, database entities, or internal type names from Proposal to Item Library.
- Replacing the existing Proposal export/document concept; the client-facing document remains Proposal for this slice.
- Redesigning the underlying revision system, proposal status lifecycle, or pricing logic.
- Surfacing custom data fields in the default item list.
- Broad rework of FF&E, Materials, Plans, or Budget tool shells beyond the copy and interaction seams required to support this page redesign.
