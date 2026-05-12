# Changelog

All notable changes to ChillDesignStudio will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

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
- fix(ui): add missing `context="ffe"` prop to `MaterialLibraryModal` in `AddItemDrawer` and `ItemsTable`
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
