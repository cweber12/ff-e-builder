# Changelog

All notable changes to ChillDesignStudio will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

- feat(ui): move the project sidebar toggle into the tab header, remove the expanded sidebar rail toggle, and introduce a titled/divided sidebar shell hierarchy for clearer context and section structure
- fix(ui): remove duplicate header/sidebar chevrons, convert collapsed sidebar to a rail-only toggle, and tighten tab-sidebar section spacing with a persistent expanded-state rail
- feat(ui): add a collapsed-by-default project tab sidebar with a centered tab-header Open/Close <current tab> panel toggle that expands content to full width when closed
- fix(ui): center project tabs in the header row and move the active-tab panel Open/Close toggle to the left side of the tab bar
- fix(ui): rebind tab-sidebar portal slots after panel collapse/expand remounts so Materials and Catalog controls no longer disappear, and update the tab-header panel toggle to stateful Open/Close tab-style text
- fix(catalog): portal the editor popover to the document body for reliable click interaction above the catalog canvas, narrow panel width, and convert multi-option status and document-mark placement controls to dropdowns
- fix(catalog): replace Editor tab pills with a top category dropdown, force single-column editor toggle rows, and raise the editor popover stacking so it stays clickable above the catalog stage
- feat(catalog): move page navigation chevrons beside the catalog canvas, convert sidebar View into a dropdown with category/item and zoom controls, anchor the Editor popover from the header/sidebar corner, and enforce export-safe catalog fonts for preview/PDF parity
- refactor(ffe): remove the legacy FF&E editable table stack and table-only imports/exports, keeping Catalog and List as the active FF&E surfaces
- feat(catalog): add FF&E item status editing to the Catalog Editor Text tab and persist changes through existing item update mutations
- feat(ffe): wire end-to-end Add to FF&E and Remove from FF&E visibility flows across Proposal row/detail actions, Proposal category bulk add, and FF&E List Add+ picker with shared FF&E and Proposal query invalidation
- feat(ffe): add a read-only FF&E List view grouped by Proposal Category with Catalog/List navigation, item-card catalog deep links, and legacy `/ffe/table` redirect compatibility
- fix(ui): center Sidebar Add button content, keep non-add sidebar buttons left-aligned by making trailing-chevron alignment explicit, and move SidebarButton from primitives into shared/sidebar
- refactor(ui): extract shared ProjectTabToolbarSidebar plus SidebarButton and SidebarButtonGroup primitives to unify tab-sidebar button layout, left alignment, hover weight emphasis, and blue Add action states
- fix(ui): align FF&E sidebar actions left, switch the View toggle to toolbar-segmented styling, move open-revision status from room headers to the sidebar top, and anchor the Columns popover from the trigger top-right toward the right
- fix(ui): normalize FF&E sidebar action button text to true left-justified alignment, force full-width export trigger alignment, remove hover scale motion, and increase hover text weight emphasis
- fix(ui): polish tab-specific project sidebars with compact utility-panel cards, consistent left-aligned controls, narrower width, and a dropdown-based compact Proposal status selector that preserves confirmation flow
- fix(ui): tighten the tab-toolbar sidebar width and remove forced full-width stretching so stacked controls align left with intrinsic sizing where appropriate
- fix(ui): left-align stacked tab-sidebar controls and convert portal toolbar groups to full-width vertical forms with start-aligned labels, inputs, and actions
- fix(ui): force tab-toolbar action clusters and portal slots into full-width column layout to prevent sidebar overflow on plans, materials, and project action controls
- fix(ui): structure tab-specific sidebar controls into labeled vertical sections with enforced single-column containers and overflow guards
- fix(ui): restore the project header as a top bar and move only tab-specific toolbar controls into a clean vertical sidebar layout
- feat(ui): reorient project header/tab toolbar into a clean left-edge sidebar with vertical project navigation and action rail sections
- fix(ui): display the selected project header tab in bold text instead of using an underline indicator
- fix(ui): replace invalid Tailwind `text-brand-800/900/950` apply utilities in add-action styles with supported brand shades to restore Vite CSS compilation
- feat(ui): shift project-toolbar action hierarchy left, remove redundant active-tab title text, add animated theme-tinted Add actions, compact proposal status control, and refresh toolbar/category icons including Columns
- fix(plans): align PlanInspector and MeasurementTargetPicker exports to prevent runtime module-link failures in the plans canvas inspector
- feat(materials): add 10-second Undo toast for pasted swatch overwrites, restoring previous primary swatches when possible and showing non-blocking restore failures
- fix(materials): enforce manual collision-policy parity in finishes/materials Excel imports by using exact normalized finish-name matching and row-level use-existing or swatch-overwrite outcomes
- fix(table): drive FF&E and Proposal sticky column class assignment from shared resolver sticky descriptors, and add FF&E value-sticky behavior for Quantity and Unit Cost
- fix(table): route FF&E and Proposal first-load empty-column omission through shared `resolveGeneratedItemColumns` policy metadata and remove duplicated per-view empty-column logic
- refactor(table): add `resolveGeneratedItemColumns` policy seam and unit coverage for shared preset ordering, group mapping, sticky designation, and omit-when-empty metadata
- docs(adr): add ADR-0011 — share a Generated Item Table Policy / Resolved Column Model across FF&E and Proposal instead of a unified table shell or rendering engine; record CONTEXT.md terms and correct architecture.md section 8.4 to match
- docs(architecture): add canonical File And Folder Conventions (section 8) defining casing by file kind, folder layout, barrel policy, the shared Generated Item Table layout, and a tracked deviation/migration table; agent-routing Feature Module context pack now points at it
- refactor(primitives): rename `toast-api.ts` to `toastApi.ts` to remove the lone kebab-case module name (Phase 0 of the structure cleanup)
- fix(plans): correct quick-create measurement save payload shape so Add item from measurement persists measurement records reliably
- feat(plans): reorganize measured-area inspector actions into clear Measured area, Apply measurement, and Plan image sections with updated button wording
- feat(plans): add Add item from measurement quick-create panel that can create an Uncategorized proposal item, save the measurement, and publish the measured Plan Image in one flow
- feat(plans): switch measured-area highlights to high-visibility yellow on canvas and exported Plan Images with a clean solid border
- fix(ui): remove the project options button from the top-right project header and rely on project summary editing entry points
- fix(materials): generate MAT/FIN paste defaults from API project data, include finish_id in generated item material payloads for swatch rendering, and clear paste pending UI after upload response
- fix(materials): fallback swatch circles to full image blobs when thumbnails are unavailable and pass freshest FF&E item data into MaterialLibraryModal to prevent inconsistent assigned-material loading
- fix(materials): rename paste defaults to MAT NNN and FIN NNN, refresh swatch cell/image queries after upload, and remove swatch-label truncation under thumbnails
- fix(materials): show two-line swatch cell labels with material name plus finish name under each thumbnail in FF&E and Proposal tables
- fix(materials): scope swatch paste pending UI to the active FF&E or Proposal row so only the target cell shows Pasting swatch
- fix(materials): generate deterministic Material NNN and Finish NNN defaults during swatch paste creation so pasted cells avoid blank import-style names
- fix(api): align Proposal create-and-assign material route with current materials schema by generating code and persisting finish/material-type fields
- feat(materials): route swatch image paste in FF&E and Proposal materials cells (plus Catalog Editor Add swatch) through create+assign, attach-finish, and overwrite-or-discard branches with finish image uploads
- refactor(proposal-table): isolate Proposal Category tracked-edit decision and confirmation payload flow behind a focused seam with dedicated tests for price-affecting change handling
- refactor(proposal-table): organize proposal table files into category, row, detail, and dialogs subfolders while preserving behavior and imports
- refactor(proposal-table): remove Proposal-local Add Column, Add Group, and Change Confirm pass-through modal shells and import shared modal seams directly
- refactor(proposal-table): extract category mobile card and expanded table rendering into focused modules while preserving Proposal category behavior
- fix(materials): wire Options -> Export to open an anchored format popover, keep exports available in Grid/Table modes, and disable export when the active filtered tab list is empty
- fix(migrations): make finish-library split migration update image_assets constraints before converting material image rows to finish entities
- fix(materials): complete issue #92 options workflows by enabling tab-aware export and delete-all actions, correcting finishes export routing, and adding dedicated finishes CSV/Excel/PDF exporters
- feat(materials): add a 3-step Project Materials Excel import modal with finish resolution by name then code, non-blocking unresolved-finish warnings, and tab-aware MaterialsView options wiring
- feat(materials): add a 3-step Finishes Excel import modal in MaterialsView (upload, confirm, import) with swatch image uploads, progress tracking, and per-row warning summaries
- feat(imports): add finishes/materials spreadsheet parser APIs with synonym-based auto-mapping and header-warning handling for low-signal files
- feat(materials): move Materials toolbar view toggle into an Options dropdown shell and switch tab toggles to the shared SegmentedControl primitive
- fix(catalog): rename OPTION RENDERINGS to OPTIONS, hide the options heading when no option images exist, and align LOCATION heading typography behavior with other section headings
- feat(catalog): replace Catalog Editor accordion groups with top tab navigation that shows one panel at a time without internal editor scrolling
- feat(catalog): finalize Catalog Editor with keyboard-complete color swatch chips, header-level Document Mark toggle behavior, and brand-aligned sticky popover chrome
- fix(catalog): keep catalog main and bottom rows stacked with consistent spacing by removing forced vertical spread in the content block grid
- fix(catalog): make the catalog main two-column section fit content height instead of stretching to a fixed-height slot
- fix(catalog): change qty-only catalog callout copy to QUANTITY: N and align its typography with PRODUCT SPECIFICATIONS
- feat(catalog): add compact two-column Text and Layout control grids in Catalog Editor with stacked labels and narrow-popover single-column fallback
- docs(agent): add planner agent and skill for grill-then-delegate planning sessions across Copilot and Claude Code
- docs(agent): add specialized custom agents for UI shell, feature modules, API contracts, DB migrations, and cross-boundary integration verification
- fix(catalog): keep catalog text fields as click-to-edit buttons in editor mode instead of forcing immediate textbox rendering
- refactor(ui): replace shared app-bar, catalog, materials, and export inline SVG action icons with Lucide imports and standardize export triggers on a consistent Download affordance
- feat(catalog): add export-safe typography controls in the Catalog Editor with Source Sans 3 selection and zoned title/body/metadata color tokens reflected in preview
- feat(catalog): move option image add/replace/remove and Add swatch actions into the Catalog Editor Media section, and remove in-canvas media add affordances
- feat(catalog): replace the toolbar Layout action with an Editor panel shell, add unified editor state branches, and gate inline catalog text editing to editor-open mode
- refactor(ui): retire legacy btn-action CSS utilities and migrate toolbar actions to Button toolbar variants across app bar, catalog, materials, plans, columns, budget, and export controls
- refactor(ui): add Button asChild plus ButtonLink support and migrate remaining snapshot, save-state, deferred-cost, and dashboard company button or link actions to the shared primitive
- refactor(ui): normalize audited eyebrow and numeric labels to shared .eyebrow and .num utilities in dashboard, overview, demo, budget snapshot, and totals bar
- refactor(ui): add SegmentedControl primitive and migrate dimension, plan-rail, and proposal status toggles to shared segmented variants
- refactor(ui): add a shared Badge primitive and migrate snapshot plus proposal inline pill or chip spans to centralized badge variants
- refactor(ui): add shared MenuPanel and DropdownMenu primitives, then migrate Project, Export, FF&E, and Proposal action menus to unify menu styling and portal behavior
- refactor(ui): migrate DashboardPage primary project-create CTAs to the shared Button primitive and remove inline button class styling
- fix(ui): render shared export dropdowns in a high-z portal layer so they no longer appear under sticky table headers
- refactor(ui): unify FF&E toolbar export to the shared ExportMenu used by MaterialsView so trigger and dropdown styles stay consistent
- feat(ui): unify project tab-toolbar controls around shared catalog-style action buttons, borderless segmented toggles, and consistent icon treatment across FF&E, Proposal, Materials, Plans, Budget, and Catalog
- feat(materials): render library cards in a 4-column grid on desktop and open add/edit material form in a popover modal instead of an inline side panel
- feat(materials): move materials controls into the tab toolbar (left: view toggle plus filter, right: count/search/export/add) and remove in-page Finish library and Project library headers
- feat(plans): center plans cards in-page and switch the list from grid columns to a responsive flex-wrap layout
- feat(plans): move the Plans filter toggle into the header toolbar beside the Plans label and place Sort immediately left of Upload plan
- feat(plans): move Plans badges and upload action into the project tab-toolbar action slot and remove the in-page Plan library hero copy
- feat(catalog): move the catalog room label and page-jump picker into the centered project tab-toolbar slot above the catalog stage
- feat(ui): split project tool chrome into a tabs row plus a dedicated toolbar row, hide the active tab from the tab strip, and surface it as the left toolbar header
- feat(table): add opt-in debounced saves to shared editable Generated Item cells and enable `debounceMs={400}` for Proposal table edits with blur flush and final-value coalescing
- feat(columns): add shared section-header Columns panel (visible/hidden/custom with drag reorder and CRUD) for Proposal and FF&E, plus always-visible 6-dot drag affordance and focusable hide buttons on sortable headers
- refactor(ffe-table): split `FfeTable` into a thin entrypoint with extracted `FfeTableView`, `RoomHeader`, `RoomItemsSection`, `SortableItemRow`, and `DeleteRoomModal`; memoize sortable row rendering and isolate row item selectors
- feat(proposal-table): add sticky-left editable ID badge chrome with calmer `py-3` row rhythm and hover-lift styling; remove `productTag` from proposal draggable/hideable column rotation while preserving export visibility
- feat(table): add opt-in `affordance="hover"` underline cues to shared editable text controls and adopt them in Proposal and FF&E table rows
- refactor(table): add shared `useGeneratedItemColumns` and `useActionsMenu` hooks; migrate Proposal and FF&E tables to use shared column and portaled-menu behavior
- refactor(proposal): extract Proposal table category section, header, row, item actions, and delete modals into dedicated `src/components/proposal/table/*` files and slim `ProposalTable.tsx` orchestration

- perf(proposal): add POST /proposal/categories/:id/reorder and POST /rooms/:id/reorder endpoints; replace N-sequential-PATCH drag-end handlers on proposal and FFE tables with a single batched call plus optimistic reorder and rollback

- feat(catalog): add a show or hide cost toggle for FF&E catalog browser, print, and PDF exports with a compact quantity-only image band when costs are hidden
- feat(catalog): add a session-only main rendering top or center alignment control for FF&E catalog preview and PDF export prep
- feat(catalog): consolidate catalog presentation controls into a layout options popover with browser-preview-aware image alignment, cost display, swatch labels, watermark placement, and approval visibility
- feat(catalog): restore the catalog actions dropdown and move layout controls into a dedicated 2x2 layout popover with watermark opacity controls
- feat(catalog): add a plan image size layout toggle and refine finish schedule labels plus quantity-only typography
- fix(catalog): constrain expanded plan image layout so catalog quantity, rendering, options, and approval sections stay visible
- feat(company): add Company entity — DB migration, GET/PUT /api/v1/company, company_logo image support, and removal of company_name from UserProfile
- feat(company): add Company client types, API client, and hooks (slice 2)
- feat(company): add CompanyProfilePage at /company — identity, brand colours, document mark, logo upload
- feat(company): link Dashboard company badges and UserMenu to /company (slice 4)

- refactor(src): reorganise file layout — move ChangeConfirmModal to shared/modals, proposalStatusConfig to lib/table, BRAND_RGB to lib/constants, PDF plan utils to lib/plans, table hooks to hooks/shared, and table-UI components to shared/table

- docs(db): add generated database-map tooling for migration-derived schema orientation
- refactor(db): add Generated Item lookup indexes for shared FF&E and Proposal table reads

- fix(table): let Proposal baseline revision columns scroll while keeping revised values sticky
- fix(exports): refine Proposal Excel image aspect ratios, centering, column header contrast, and material swatch grid placement
- fix(exports): polish Proposal Excel table styling with theme headers, thin borders, striped rows, and square multi-swatch cells
- fix(table): refresh Proposal item locations after FF&E Location renames
- fix(imports): populate Proposal Location from combined Drawings / Location imports
- fix(table): mirror linked FF&E and Proposal material edits across Generated Item views
- fix(table): show linked Proposal material assignments in FF&E Generated Item reads
- docs(table): document current FF&E and Proposal Generated Item table state
- refactor(table): move Proposal quantity and unit-cost sticky styles into shared table helpers
- refactor(table): move Proposal sticky table edge styles into shared Generated Item table helpers
- fix(table): keep FF&E column drag context out of table header markup
- refactor(table): move FF&E sticky table edge styles into shared Generated Item table helpers
- refactor(table): clarify FF&E copy for edits added to an open Proposal revision
- refactor(table): show FF&E Product Description edits in shared Proposal revision history
- feat(table): allow FF&E Drawings edits to sync through shared Generated Items
- fix(table): sync FF&E Location renames into linked Proposal item locations
- fix(table): move FF&E-visible Proposal items when their Proposal Location changes
- fix(table): rebase saved table column settings when built-in defaults change
- refactor(table): align FF&E default columns with Proposal generated item fields
- fix(imports): skip computed Proposal totals when creating import custom columns
- fix(imports): detect Proposal template headers before merged follower rows
- fix(proposal): persist Proposal Name through Generated Item mirroring for FF&E views
- refactor(table): share generated item editable text table cell chrome
- refactor(table): route FF&E text cells through shared generated item edit control
- refactor(table): share generated item revision indicators across FF&E and Proposal
- refactor(table): route FF&E numeric cells through shared generated item edit control
- refactor(table): route Proposal CBM editing through shared generated item number cell
- refactor(table): route Proposal unit-cost editing through shared generated item money cell
- refactor(table): route Proposal quantity editing through shared generated item quantity cell
- refactor(table): share generated item size modal wiring between FF&E and Proposal
- refactor(table): share generated item size trigger between FF&E and Proposal
- refactor(table): share generated item material badge rendering between FF&E and Proposal
- refactor(table): route Proposal swatch cell through shared generated item materials cell
- refactor(table): share generated item row drag handle between FF&E and Proposal
- fix(table): match FF&E generated item image sizes to Proposal
- refactor(table): share generated item row action trigger between FF&E and Proposal

- refactor(table): share generated item Rendering and Plan image cells

- refactor(table): move generated item text-wrap behavior into table presets

- refactor(table): move FF&E generated item column widths into shared table presets

- fix(table): align FF&E Name and Product Description column widths with Proposal

- fix(proposal): map Proposal Name to FF&E Name instead of Product Description

- refactor(table): share mobile table field chrome between FF&E and Proposal

- refactor(table): share Proposal revision history indicator UI between Proposal and FF&E

- refactor(api): remove FF&E items and Locations by clearing FF&E visibility

- refactor(table): show linked Proposal revision indicators in FF&E

- refactor(images): share linked Generated Item Rendering and Plan images between FF&E and Proposal

- feat(proposal): add explicit Add to FF&E action for Proposal items

- refactor(table): standardize Generated Item field labels and rename FF&E table groups to Location

- refactor(table): move FF&E and Proposal edit-change helpers into shared Generated Item table utilities

- refactor(table): centralize Generated Item change-field metadata for FF&E and Proposal views

- refactor(table): centralize FF&E and Proposal Generated Item table view presets

- refactor(ui): confirm FF&E edits before recording Proposal revision history

- refactor(api): record FF&E edits in Proposal revision history for linked Generated Items
- refactor(db): add canonical Generated Item references to Proposal revision records
- refactor(api): preserve canonical Generated Items when deleting Proposal Categories

- refactor(api): mirror FF&E and Proposal item writes through linked Generated Item rows

- refactor(api): keep Proposal reads legacy-compatible while staging Generated Item read bridge

- refactor(api): add Generated Item read bridge for FF&E and Proposal groupings

- refactor(db): stage shared Generated Item schema for FF&E and Proposal table consolidation

- docs(architecture): record shared Generated Item Table direction for FF&E and Proposal views

- refactor(architecture): route FF&E and Proposal Finish Library consumers through the public materials barrel

- docs(architecture): clarify generated architecture-map review signals for route composition, facades, shared dependencies, and unknown ownership

- docs(architecture): make generated architecture maps product-module-aware with ownership heuristics and cross-area import summaries

- docs(architecture): add generated architecture-map tooling and docs under `docs/generated`

- fix(exports): refine Proposal Excel table polish with centered image placement, stronger category/header borders, clearer revised-proposal headers, unit-aware quantities, and bold dimension separators in Size cells

- fix(exports): polish Proposal Excel exports with 4:3 row imagery, compatibility-safe non-frozen panes, right-side formula-backed budget summaries, and recalculating item, category, revision, and grand totals

- feat(proposal): redesign revision table layout — Revision Snapshots now appear as a sticky right block (REVISION X.X header spanning Qty/UC/Total sub-columns) that replaces the editable baseline zone while a round is open; baseline columns become read-only locked cols; quantity-only snapshot changes are flagged (cost_status=flagged) with existing unit cost pre-filled for PM confirmation; revision history and changelog are preserved permanently after approval (never deleted); ChangeHistoryDot filters to current acceptance cycle only

- feat(proposal): add Revision Rounds — MAJOR.MINOR-numbered snapshots of Qty and Unit Cost are stored per round, displayed as scrollable column groups to the left of the sticky Qty/Cost/Total zone, with inline flagged-cost editing and change history grouped by round

- feat(ui): redesign project shell and table chrome — two-row editorial header with underline tabs, lifted Add Room/Category modal state, flush-edge table layout for FF&E and Proposal routes, new shared components (ItemStatusChip, ProposalStatusSelect, TotalsBar, BulkActionBar, DeferredCostBanner, SaveStatusIndicator), and new hooks (useRowSelection, useTableDensity, useSaveStatus)

- refactor(plans): move the Measured Plan upload form into a dedicated Plans module with colocated upload-panel coverage
- refactor(plans): move the opened-plan viewport into a dedicated Plans component and keep page tests focused on shell orchestration
- refactor(plans): move opened-plan inspector UI into a dedicated Plans module and share measurement formatting helpers from `src/lib/plans`
- refactor(plans): move first-pass Plans library and opened-plan tool selector UI into focused `src/components/plans` modules
- feat(plans): tighten the Measured Plan inspector with dropdown-based item/area selection and a full-bleed center canvas
- feat(plans): simplify the Measured Plan workspace into a compact canvas-first workbench with contextual tool inspector and top-bar sheet switching
- feat(plans): add PDF-backed Measured Plan uploads with page selection, rendered-page measurement, and explicit measurement-to-item application controls
- feat(plans): add a guided crop-to-item flow for measured plan images and surface FF&E Plan Images in a default table column
- refactor(lib): move API facade tests into `src/lib/api`, move item sorting and brand constants into concern folders, and remove obsolete query, image, and project snapshot root facades
- refactor(lib): remove unused root compatibility facades for auth state, calc aliasing, formatting, observability, import helpers, and sample-data re-exports
- refactor(lib): move money, image compression, query client, project snapshot, and export test modules into focused `src/lib/*` subfolders while keeping root compatibility facades
- refactor(imports): move FF&E and Proposal spreadsheet import adapters under `src/lib/import/formats` while keeping generic parsing modules at the import root

- feat(proposal): add persisted Proposal Item notes with inline table editing and CSV/Excel/PDF export support

- feat(plans): add canvas click-to-select for measured areas plus temporary Space+drag pan in the fullscreen measurement workspace without changing active tool mode

- feat(plans): true fullscreen measurement workspace — project header and tab bar hidden on `plans/:planId`; shell locked to viewport; exit/minimize via "Plans Library" breadcrumb in the workspace header

- feat(plans): add FF&E `item_plan` image support so measured plan crops can publish into a dedicated FF&E detail-panel plan image surface without colliding with the main rendering
- fix(plans): shrink the opened-plan viewport toolbar, keep the plan canvas filling the available window height, and convert the right sidebar into a one-open-section accordion while keeping the plan selector always visible
- feat(plans): let proposal measurements save their selected Measured Plan crop into the existing Proposal Plan image surface by replacing/uploading a `proposal_plan` asset and applying percentage crop params
- feat(plans): add per-measurement crop framing to the full-window Plans workspace, persist crop rectangles through the existing measurement API, and render saved/draft crop overlays inside measured item highlights
- feat(plans): convert the opened plan view into a full-window fixed-height workspace, replace the text tool rail with icon controls, add measured-item selection/highlight overlays, and persist item-linked rectangle measurements
- feat(plans): add persisted Length Line measurement CRUD, canvas overlays, and a reusable measured-span sidebar on top of saved plan calibration
- feat(plans): persist per-plan calibration lines with raw-pixel geometry, add calibration read/write worker + client APIs, and make the opened plan workspace save and render reference-line scale overlays
- feat(plans): add the opened-plan workspace shell with a dedicated `plans/:planId` route, protected source-image canvas, plan selector, calibration-aware tool rail, and session-only zoom/pan/rotation controls
- feat(plans): add the first project-level Plans slice with a new nav tab, persisted Measured Plan uploads/library cards, worker/API support, and foundational plans-domain tables for upcoming calibration and measurement tooling
- fix(catalog): reorganize the FF&E catalog page and PDF export into a cleaner four-section spec-sheet layout with rendering and notes up top, horizontal options, materials beneath, a full-width approval band, and omission of blank or zero-value export fields

- refactor(hooks): extend `useUploadImage` to accept optional entity params at mutation time; route `MaterialsView` and `MaterialLibraryModal` swatch uploads through the hook so `imageKeys` no longer leaks onto the public hooks barrel

- refactor(hooks): remove `optimisticList` and `queryKeys` from the public hooks barrel; remove internal query key re-exports from domain sub-barrels; only `imageKeys` (used by MaterialsView and MaterialLibraryModal) remains on the public surface
- refactor(ffe): remove vendor, model, finishes, markupPct, and sellPrice fields from Item type; update all components, hooks, tests, and export utilities to reflect simplified schema
- feat(ffe): add item descriptions, rename the FF&E table image column to Rendering, support up to three selectable item option renderings, and add editable catalog approval/signature PDF fields
- feat(ffe): catalog view is now the default when clicking the FF&E tab; catalog/table toggle added to the tab bar matching the materials library pattern "Delete room and all items" alongside "Move items to another room" — DB cascade handles item deletion automatically
- feat(proposal): DeleteCategoryModal added to ProposalTable with "Move items to another category" and "Delete category and all items" options; previously deletion fired immediately with no confirmation
- feat(projects): route dashboard project cards and `/projects/:id` to the new Project Snapshot landing page with a first-class Snapshot tab
- fix(proposal): widen Proposal table rendering and plan columns so image previews do not overlap adjacent cells
- fix(crop): remove crop CSS transform from browser image display; crop now only affects export
- fix(crop): initialize CropModal pendingParams from existing crop so re-save without interaction works
- fix(images): set aspect-[117/75] on FFE item table cell image frames to match Excel export cell proportions
- fix(images): set aspect-[117/75] / aspect-[103/75] on proposal table rendering / plan cell image frames
- fix(images): set aspect-[117/75] on ProposalItemDetailPanel rendering frame; plan frame uses same ratio
- feat(ui): ProposalItemDetailPanel plan image supports scroll-to-zoom and drag-to-pan with cursor-aware zoom, percent indicator, and Reset button; rendering and plan display at identical size
- refactor(ui): FfeItemDetailPanel layout now mirrors ProposalItemDetailPanel — single image on top, metadata below; materials moved into metadata scroll area

- docs: normalize agent/docs command guidance (`pnpm migrate`, `pnpm --filter ffe-api deploy`) and API/route path examples (`/api/v1/*`, `/projects/:id/ffe/*`); legacy "Take-Off" terms below refer to the current Proposal surface
- refactor(api): move shared API transport, auth headers, and `ApiError` into `src/lib/api/transport.ts`
- refactor(api): move raw worker response contracts and client mappers into `src/lib/api/mappers.ts`
- refactor(api): move project and user API namespaces into focused client modules behind the existing API facade
- refactor(api): move room API operations into a focused client module behind the existing API facade
- refactor(api): move FF&E item API operations into a focused client module behind the existing API facade
- refactor(api): move material library and assignment API operations into a focused client module behind the existing API facade
- refactor(api): move image metadata, upload, blob download, primary, and crop operations into a focused client module
- refactor(api): move Proposal category and item operations into a focused client module behind the existing API facade
- test(api): split API client coverage into focused module-level test files with shared transport test setup
- refactor(hooks): centralize React Query cache keys and replace raw item cache invalidation keys
- refactor(hooks): share optimistic list snapshot, rollback, and transform helpers across FF&E room and item hooks
- refactor(hooks): reuse shared list transform helpers across Project, Proposal, and Material cache updates
- refactor(hooks): name image cache transforms for upload, delete, primary selection, and crop updates
- refactor(hooks): route app and component hook imports through the canonical hooks barrel
- refactor(hooks): keep React Query keys owned by `queryKeys.ts` and complete slice barrel exports
- refactor(hooks): make the root hooks barrel re-export slice barrels instead of hook implementation files
- test(images): wait for project image previews to load before asserting modal slot controls
- refactor(exports): move shared export download, filename, money, percent, and CSV helpers into `src/lib/export/shared.ts`
- refactor(exports): move FF&E row helpers and CSV export implementations behind dedicated `src/lib/export/` modules
- refactor(exports): move Proposal export document preparation into `src/lib/export/proposalDocument.ts` without changing PDF or Excel rendering
- refactor(exports): move shared export image conversion and Excel placement helpers into `src/lib/export/imageHelpers.ts`
- refactor(exports): move Proposal export asset collection into `src/lib/export/proposalAssets.ts`
- refactor(exports): split FF&E, Proposal, Materials, and Catalog renderers into focused `src/lib/export/` modules while keeping `exportUtils.ts` as a compatibility barrel
- refactor(exports): add canonical `src/lib/export/index.ts` barrel while keeping `exportUtils.ts` as a compatibility re-export
- refactor(exports): remove the `exportUtils.ts` compatibility barrel and point export coverage at `src/lib/export`
- refactor(exports): migrate app and component callers to the canonical `src/lib/export` barrel
- refactor(auth): split Firebase auth actions from the React auth context to satisfy React Refresh lint rules
- test(exports): add direct shared helper, FF&E row helper, Proposal document, Proposal CSV, and Materials CSV coverage for the refactored export modules
- docs(proposal): align current domain and architecture docs with the Proposal rename
- fix(proposal): repair renamed Proposal item-material join column so category item loading no longer 500s after the Take-Off rename
- fix(images): allow `proposal_swatch` uploads through API validation after the Proposal rename
- feat(materials): add `finish_classification` field (`material | swatch | hybrid`) to the Finish Library — migration 0009, API schemas, client types, and all create/update routes updated
- feat(materials): Finish Library scope toggles renamed from All/FF&E/Take-Off to All Finishes/Materials/Swatches; filter uses `finish_classification` not assignment references
- fix(imports): Replace broken `takeoff_swatch` entity type in Take-Off Excel import with material create + image upload flow so swatch images import correctly into the Finish Library
- feat(imports): Take-Off swatch import auto-generates `material_id` (numeric max+1) and name (Import N, monotonic) when not supplied — never backfills gaps
- feat(imports): Add optional Materials/Finishes column mapping to FF&E Excel import; comma-separated material names are created and assigned to each imported item
- fix(ui): add missing `context="ffe"` prop to `MaterialLibraryModal` in `AddItemDrawer` and `FfeTable`
- fix(exports): Take-Off Excel/PDF swatch export now resolves swatch images from assigned material assets instead of removed `takeoff_swatch` image entities
- fix(imports): resolve Take-Off swatch import 500s by correcting SQL aggregate filter syntax in import material ID generation
- fix(takeoff): keep the sticky right-side `Total Cost`/options headers pinned at the top in expanded table mode by adding `top-0` to sticky header cells
- fix(takeoff): restore right-side sticky behavior for `Total Cost` cells (`right-24 z-10`) and use dedicated expanded-header sticky classes so `Total Cost`/options headers stay fixed vertically while body rows scroll

- fix(takeoff): stop auto-seeding default Take-Off categories from the API so new Take-Off Tables start empty
- fix(takeoff): add a zero-category empty state message on the Take-Off Table while keeping the grand total visible
- fix(takeoff): refactor Take-Off table inline cell inputs to click-to-edit pattern — border shown only when cell is empty or in edit mode, matching FF&E table UX; save on blur/Enter, cancel on Escape for all text and numeric cells
- fix(takeoff): harmonize Take-Off inline row input styling with FF&E-style visible bordered controls
- fix(imports): use neutral Imported fallback category naming in Take-Off spreadsheet import instead of Millwork
- fix(exports): rewrite FF&E Excel export with ExcelJS to include a per-item image column alongside all data columns
- fix(exports): rewrite FF&E PDF export to include a pre-cropped image column (18 mm) rendered via canvas pre-processing before autoTable
- fix(exports): fix Take-Off PDF export where jsPDF v4 clip() corrupted graphics state making all table text invisible; replaced with canvas pre-crop + addImage
- fix(exports): fix Take-Off Excel rendering and plan images squished by switching from contain-letterbox to cover-crop placement
- fix(exports): fix Take-Off Excel project image not reaching full row width in equal-width slot layout
- feat(images): allow Ctrl+V paste uploads directly into Project Images modal slots
- feat(imports): show live progress bars with estimated time remaining during FF&E and Take-Off Excel imports
- fix(imports): when Take-Off import detects project images, replace existing project images with the imported set and surface per-image upload errors in the import result
- fix(ui): use the same icon-only add control for landing-page project creation and Take-Off item creation
- fix(projects): label project-card tool actions as Create or Open based on existing FF&E rooms and Take-Off categories, and refine card/dropdown styling
- feat(projects): open FF&E or Take-Off directly from project-card tool dropdown and remove the intermediate tool chooser page
- feat(projects): restructure the landing page into Welcome, Companies, and Projects sections with two-column company cards and a projects action row
- feat(projects): add Project Options update flow from cards and project header
- feat(ui): simplify the Project Header into a compact read-only identity and tool navigation bar
- feat(imports): add image-aware Take-Off spreadsheet import with detected categories, column mapping, and skipped summary rows
- docs(agents): forbid agents from reading `.env.local`
- feat(takeoff): add image-backed Take-Off swatches, nested PDF export modes, and polished project-aware PDF/Excel exports
- fix(exports): align Take-Off PDF and Excel layouts around a shared presentation model and complete metadata coverage
- fix(exports): make Take-Off Excel project bands span the full table width and crop rendering/swatch images to fill their cells
- fix(exports): make Take-Off Excel project images equal-width, contain renderings inside cells, and show one cell-filling swatch preview
- fix(exports): anchor Take-Off Excel images to measured cell dimensions with 2px padding
- feat(images): add Take-Off Plan Images for image-only Plan cells and Excel export fallback behavior
- feat(sample-data): seed new projects with populated FF&E, Take-Off, project-image, and swatch content for export review
- fix(images): insert additional project images as non-preview images so uploads can reach the 3-image limit
- fix(images): allow Take-Off renderings and multiple Project Images by repairing image constraints, preview promotion, and inline upload errors
- docs(context): add domain glossary, current architecture map, and project-scoped tool ADR
- feat(takeoff): add ChillDesignStudio project shell, user info, project metadata, budgets, and Take-Off Table tool
- feat(takeoff): split FF&E and Take-Off into separate project pages with take-off tabs, import, and exports
- feat(takeoff): share table wrappers and dimension editor, add project image manager, and align take-off materials/images
- feat(ui): add pasted image uploads, room add icons, collapsed room images, and subtler budget display
- fix(materials): simplify swatch upload and use icon-only material card actions
- feat(materials): use material images as swatches in forms, tables, and exports
- fix(materials): clarify assignment and removal flows and limit materials to one swatch
- feat(materials): add searchable material picker cards and table/export library view
- fix(auth): wait for Firebase auth readiness before attaching API bearer tokens
- feat(materials): add project Materials tab and project-mounted material API routes
- feat(materials): support multiple material swatches and add-item material assignment
- feat(materials): add project material libraries with swatches, images, item assignments, and catalog display
- feat(ui): align tab actions in the project tab bar and refine project, room, and catalog image spacing
- feat(ui): move room and catalog secondary actions into options menus and add page-turn catalog transitions
- feat(ui): refine room table scrolling, expanded table view, budget popover, image containment, and add-item category controls
- feat(images): add image update/delete menus and collapsible room image panels
- feat(ui): add collapsible budget control, animated catalog navigation, and clean status icons
- feat(images): add uploadable project, room, item, and catalog image frames
- feat(images): add private R2-backed image storage API and normalized image metadata
- feat(exports): add CSV, Excel, PDF export flows and spreadsheet import mapping
- refactor(quality): phase-2 code-quality pass — BRAND_RGB constant, DRY export breakdown helpers, fix budget-tracker casts, onError toast for useUpdateRoom, seed.ts error handling, queryClient comments, TODO→docs/roadmap.md
- refactor(quality): phase-1 code-quality pass — fix silent reportError, remove API→client cross-boundary import, move RoomWithItems to types layer, extract DeleteProjectModal, add hooks barrel export

---

## [1.0.0] - 2026-05-01

- chore(scaffold): initialize repo with agent context and docs
- build(phase-1): Vite + React + TS scaffold with lint/format/test toolchain and CI/CD
- feat(api): Cloudflare Worker proxy with Hono, Firebase auth, ownership checks, DB migration schema
- feat(client): typed API client, TanStack Query hooks with optimistic updates, Firebase auth gate
- fix(migrate): run SQL migration files through Neon Pool so multi-statement schema setup succeeds
- feat(design-system): tokens, primitives, and project header
- feat(table): read-only items table with room grouping and totals
- fix(ci): use packageManager as the single pnpm version source in GitHub Actions
- fix(ci): provide Vite env values for test and deploy workflows
- feat(auth): add email/password sign-in and surface Firebase auth errors
- fix(deploy): emit stable frontend asset filenames to avoid GitHub Pages 404s after deploy
- feat(table): add validated inline editing for item cells and status changes
- feat(table): add item and room structure mutations with drawer forms, confirmations, and reorder support
- fix(deploy): keep a compatibility copy of the known stale GitHub Pages bundle name
- feat(catalog): add printable item catalog route with PDF-oriented A4 layout
- feat(release): nested routing, summary view, responsive layouts, accessibility audit, and launch docs

---

<!-- Template for a release:

## [0.1.0] - YYYY-MM-DD

### Added
- ...

### Changed
- ...

### Fixed
- ...

### Removed
- ...

-->
