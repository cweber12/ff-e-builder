# Sidebar relocation — move right sidebar into the left rail

Status: in progress. Decisions locked via grill-me session.

## Goal

Remove the right sidebar (`ProjectTabToolbarSidebar`) entirely. Move the options
dropdown to the right of the **active** tab in the left rail (icon-only hamburger),
and move the rest of each tool's controls into a contextual **section** below the
tabs in the left rail.

## Layout

### Left rail (desktop, `lg:`) — width **208px**

Two zones separated by a **thin hairline divider, no heading**:

1. **Tabs** (unchanged nav): FF&E, Proposal, Plans, Materials, Budget.
   - The **active tab row** gets an **icon-only hamburger** (`☰`, lucide `Menu`),
     right-aligned. Renders **only on the active tab**, and **only when that tool
     has an options menu** (FF&E _list_ view has none → no icon).
   - Opens the tool's **options dropdown** (same items as today), opening
     **rightward over the canvas** (`panelEdge: right`).
2. **Section** (contextual controls for active tool), below the divider:
   - **Buttons / clickable text → full tab styling** (neutral palette, hover/active
     weight + animation). Includes the primary Add/New/Upload action — **flattened
     to neutral**, no brand color.
   - **Selects, search, segmented controls, proposal status → keep their function**,
     recolored to the tab neutral palette.

### Per-tool mapping

Options dropdown **keeps its current items**; the section gets everything else.

| Tool      | Options dropdown (`☰` on active tab)            | Section (under tabs)                                                              |
| --------- | ------------------------------------------------ | --------------------------------------------------------------------------------- |
| FF&E      | Editor, Print, Download ▸ **＋ Zoom ▸** (nested) | Category, Items (jump select), Editor button, View (Catalog/List)                 |
| Proposal  | Add category, Upload, Download, Columns          | Revision chip, Status select, Add category button                                 |
| Plans     | Upload plan                                      | Sort select, plan/calibrated stats, Upload button                                 |
| Materials | New, Upload, Download ▸, Delete all              | Finishes/Materials select, Grid/Table toggle, New button, Search, Category filter |
| Budget    | FF&E/Proposal Budget, Download ▸                 | FF&E Budget + Proposal Budget buttons                                             |

### Mobile — one combined drop panel

Tabs stay horizontal in the header. A single `☰` at the right of the tab row toggles
**one full-width panel** containing **both** the section controls **and** the
options-menu actions as rows. No always-on bar, no nested menu.

## Mechanics

- **Collapse removed entirely**: drop the header Sidebar toggle, the collapsed-rail
  UI, and `lib/sidebarPreferences` persistence.
- **Catalog editor popover**: flip `resolveCatalogEditorPopoverAnchor` to anchor
  against the **left rail's right edge** (extending rightward) instead of the old
  right sidebar.
- **Slot-portal mechanism kept**: relocate the slot host `<div>`s into the rail
  section, minimizing churn in CatalogView / MaterialsView / PlansPage.

## Files in play

`App.tsx`, `ProjectToolNav.tsx`, `ProjectToolSidebar.tsx`, `ProjectHeader.tsx`,
`SidebarHeaderMenu.tsx`, `CatalogView.tsx`, `catalogEditorPopoverAnchor.ts`,
`AppBarActions.tsx`, `MaterialsView.tsx`, `PlansPage.tsx`, `index.css`.
Remove `ProjectTabToolbarSidebar.tsx` + `lib/sidebarPreferences`. Update tests for
the affected sidebar/header components.

## Slices

- [x] 1. Rail widen (208px) + section scaffold + divider (structure + CSS).
- [x] 2. Hamburger on active tab + relocate options menus (desktop).
- [x] 3. Per-tool section content + tab styling (relocate slot hosts into the rail). Also
     retired the right-sidebar usage + collapse plumbing, and flipped the editor popover
     anchor to the rail (pulled forward from slice 4).
- [x] 4. FF&E Zoom nested in options menu (editor popover anchor already done in slice 3).
- [ ] 5. Mobile combined drop panel.
- [ ] 6. Remove dead code (`ProjectTabToolbarSidebar`, `sidebarPreferences`, collapse) + fix tests.
