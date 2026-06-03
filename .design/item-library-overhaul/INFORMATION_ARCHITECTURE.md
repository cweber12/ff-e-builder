# Information Architecture: Item Library Overhaul

## Site Map

- Dashboard `/projects`
  - Project Snapshot `/projects/:projectId/snapshot`
  - FF&E `/projects/:projectId/ffe/catalog`
  - Item Library `/projects/:projectId/proposal/table`
    - Default list view `(same URL, in-page mode)`
      - Active Schedule `(same URL, in-page state)`
      - Item Detail Panel `(same URL, side panel state)`
      - Revision Mode `(same URL, in-page state)`
    - Spreadsheet View `(same URL, full-screen/in-page mode)`
      - Active Schedule `(same URL, in-page state)`
      - Item-to-item editing flow `(same URL, in-page state)`
  - Plans `/projects/:projectId/plans`
  - Materials `/projects/:projectId/materials`
  - Budget `/projects/:projectId/budget`

Notes:

- This slice does not introduce a new route. `Item Library` remains mounted on the existing proposal route: `/projects/:projectId/proposal/table`.
- Schedule selection, detail panel, revision mode, and Spreadsheet View are UI states, not new URL layers, unless later implementation work finds a strong reason to persist them in query params.

## Navigation Model

- **Primary navigation**: The existing project-tool navigation remains the primary system with a maximum of five visible tool destinations: `FF&E`, `Item Library` (label change only), `Plans`, `Materials`, and `Budget`.
- **Secondary navigation**: Item Library adds one high-priority contextual switcher in the main content header: a `Schedule` dropdown. This is the only schedule-navigation control in the default desktop experience. The per-schedule list does not move into the left project rail.
- **Contextual controls**: The Item Library sidebar holds view-level controls and actions, organized into sections instead of being split between table headers and overflow menus:
  - `View`: Spreadsheet View entry, Revision Mode toggle, mobile-only schedule selector fallback
  - `Actions`: Add schedule, add item, import, export
  - `Display`: Column/configuration controls relevant to Spreadsheet View
  - `Status`: Proposal status and revision summary
- **Utility navigation**: The top project header keeps the breadcrumb back to `Projects`, the project name, save status, and user/account controls.
- **Mobile navigation**: The existing mobile project-tool tab row remains the primary tool navigation. Item Library keeps the schedule switch as a compact dropdown in the content header, with sidebar/context controls exposed via the existing tool-panel pattern.

## Content Hierarchy

### Item Library: Default List View

1. Schedule context -- The active schedule selector, item count, and selected-schedule subtotal come first because users need fast orientation before scanning items.
2. Scan-first item list -- The default view is the page’s core working surface and should occupy most of the attention budget.
3. Sidebar actions and status -- Important but secondary; these support the work rather than define it.
4. Detail panel -- High-value on demand, but only after the user selects an item.

### Item Library: Item Record

1. Item block -- Rendering, item ID, item name, and location are the primary identity signals and should be scannable first.
2. Plan block -- Plan image and drawing reference provide immediate spatial/design context.
3. Specs block -- Dimensions, footprint, two-line description preview, and CBM support evaluation without overwhelming the row.
4. Materials block -- Assigned finishes/swatches are visually important and deserve a dedicated area instead of being buried in specs.
5. Pricing block -- Quantity, unit cost, and total are essential but should read as a compact summary rather than dominate the row.

### Item Library: Spreadsheet View

1. Active schedule context -- Users still need to know which schedule they are editing.
2. Dense editable table -- This is the main purpose of Spreadsheet View: fast inline editing across many fields.
3. Item-to-item switching and full inline editing -- Supports power-user maintenance and repetitive edits.
4. Secondary controls -- Column visibility, revision comparison, and related table settings remain available but should not overpower the editable grid.

### Item Detail Panel

1. Item identity and imagery -- Reinforce the selected item and support image maintenance.
2. Full item fields -- Rich editing lives here outside Spreadsheet View.
3. Custom data -- Present here rather than in the default list so custom fields do not pollute the scan-first surface.
4. Revision/changelog context -- Supportive historical information, secondary to current editing.

## User Flows

### Open Item Library And Scan A Schedule

1. User opens a project and selects `Item Library` from the project-tool navigation.
2. User lands on `/projects/:projectId/proposal/table`.
3. User sees the Item Library header with the active schedule dropdown, item count, and selected-schedule subtotal.
4. User scans the default list view.
   - If the active schedule is correct -> they continue scanning items.
   - If they need a different schedule -> they open the schedule dropdown and switch context without changing routes.
5. User remains in one schedule-focused workspace instead of scrolling through all schedules.

### Switch Schedules

1. User opens the `Schedule` dropdown in the main content header.
2. User sees user-defined schedules plus metadata such as item count and subtotal.
3. User selects a schedule.
   - If the schedule has items -> the default list re-renders with that schedule’s records.
   - If the schedule is empty -> the page shows an empty-state message for that schedule plus the add/import actions.
4. User continues work in the selected schedule.

### Inspect And Edit An Item From The Default List

1. User scans the structured item records in the default list.
2. User clicks an item row or block.
3. The Item Detail Panel opens on the same page.
4. User reviews full description, complete fields, and custom data.
5. User edits focused fields or images.
   - If they need dense cross-item editing -> they switch to Spreadsheet View.
   - If they need only focused maintenance -> they stay in the detail panel.

### Update Rendering, Plan Image, Or Swatches Quickly

1. User hovers an image surface in the default list, Spreadsheet View, or detail panel.
2. The interface reveals a visible update affordance such as `Paste image` or `Replace image`.
3. User pastes with `Ctrl+V` or activates the explicit image-update control.
   - If clipboard content is a valid image -> the image updates in place and confirms success.
   - If clipboard content is invalid -> the UI preserves the explicit upload path and shows clear failure feedback.
4. User continues scanning without being forced into a separate maintenance workflow.

### Enter Spreadsheet View For Dense Editing

1. User chooses `Spreadsheet View` from the Item Library sidebar `View` section.
2. The page switches from the grouped record list to the dense editable schedule table on the same route.
3. User edits text fields inline, switches between items quickly, and accesses the full field set for that schedule.
4. User exits Spreadsheet View when dense editing is complete and returns to the default scan-first list.

### Review Revisions Without Polluting The Default View

1. User notices revision context in the sidebar `Status` section.
2. User enables `Revision Mode` from the `View` section when comparison is needed.
3. The Item Library reveals before/after pricing comparison surfaces.
4. User reviews flagged vs. resolved items and resolves the required work.
5. User turns Revision Mode off to return to the calmer default reading surface.

## Naming Conventions

| Concept                            | Label in UI      | Notes                                                                                                                   |
| ---------------------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Proposal tool surface              | Item Library     | UI rename for this slice only; route/API/internal model remain proposal-based.                                          |
| Proposal category                  | Schedule         | User-facing grouping term for Furniture, Lighting, Millwork, Walls, Ceilings, Floors, Signage, and other custom groups. |
| Add proposal category action       | Add schedule     | Keeps the UI language consistent with the new schedule model.                                                           |
| Expanded/full-screen editing mode  | Spreadsheet View | Explicitly names the dense-editing mode as an optional alternative, not the default experience.                         |
| Proposal item identity tag         | Item ID          | Clearer on the new scan-first surface than raw internal/product-tag wording.                                            |
| Primary item image                 | Rendering        | Matches existing product language and current image semantics.                                                          |
| Item-attached plan visual          | Plan Image       | Keeps plan-specific imagery distinct from rendering.                                                                    |
| Finish assignment area             | Materials        | Dedicated block in the default list, even though the underlying domain uses Finish Library materials.                   |
| Selected group count/total context | Schedule summary | Header-level summary for the active schedule, not the whole project by default.                                         |
| Status control                     | Proposal Status  | Retains the current lifecycle term because the underlying workflow is still proposal-owned.                             |

## Component Reuse Map

| Component                                                                               | Used on                                      | Behavior differences                                                                                                                   |
| --------------------------------------------------------------------------------------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `ProjectHeader`                                                                         | All in-project routes                        | Unchanged shell; Item Library only changes the active tool label and contextual controls.                                              |
| `ProjectToolSidebar`                                                                    | Desktop in-project routes                    | Continues to host project-tool nav plus Item Library-specific contextual sections.                                                     |
| `ProjectToolNav`                                                                        | Desktop rail and mobile tab row              | Label changes from `Proposal` to `Item Library` in UI copy for this slice.                                                             |
| `ProposalTable`                                                                         | Item Library route                           | Evolves from multi-category spreadsheet surface into the orchestrator for schedule selection, default list mode, and Spreadsheet View. |
| `ProposalCategorySection`                                                               | Item Library main content                    | Shifts from repeated category sections to a single active-schedule surface.                                                            |
| `ProposalCategoryHeader`                                                                | Active schedule content                      | Slimmed down substantially; no longer the primary home for actions, columns, or mode switches.                                         |
| `ProposalCategoryExpandedTable`                                                         | Spreadsheet View                             | Retained as the high-density editing surface, renamed in UI copy to Spreadsheet View.                                                  |
| `ProposalItemDetailPanel`                                                               | Item Library item editing                    | Gains responsibility for showing custom data and remaining the primary focused editor outside Spreadsheet View.                        |
| Shared sidebar primitives (`SidebarButton`, `SidebarHeaderMenu`, `SidebarHeaderSelect`) | Item Library sidebar                         | Reused to build structured `View`, `Actions`, `Display`, and `Status` sections.                                                        |
| Shared image/table cells                                                                | Default list, Spreadsheet View, detail panel | Reused but reorganized into grouped blocks and visible hover/paste affordances.                                                        |
| `ProposalStatusSelect`                                                                  | Item Library sidebar status section          | Retains proposal lifecycle semantics even though page-level branding shifts to Item Library.                                           |

## Content Growth Plan

- **Schedules**: User-defined schedules will grow over time. The IA supports this by keeping schedule switching in a dropdown rather than in a permanently expanding sidebar list.
- **Items within a schedule**: This is the fastest-growing content set and the main reason the default view must optimize for scanning, not raw column count.
- **Materials/finish assignments**: These accumulate per item; a dedicated Materials block prevents growth in finish usage from destabilizing the row anatomy.
- **Custom data**: Custom columns may continue to grow, but the default Item Library view will not absorb them. They stay in the detail panel and Spreadsheet View where complexity is intentional.
- **Revision data**: Revision history can expand substantially. Revision Mode contains that complexity so the default browsing surface stays calm.
- **Starter schedule suggestions vs. user-defined schedules**: The IA supports a small set of suggested starters at creation time without hard-coding the information architecture around a fixed taxonomy.

## URL Strategy

- **Pattern**: Continue using the existing project-scoped route: `/projects/:projectId/proposal/table`
- **Dynamic segments**: `:projectId` remains the only required route segment for this feature in this slice.
- **Query parameters**:
  - None are required for the initial IA.
  - If later implementation needs state persistence, query params should be limited to high-value restorable state such as `schedule`, `view=spreadsheet`, or `revision=on`.
  - Detail-panel open state and transient editing state should remain local UI state unless shareable URLs become a requirement.
