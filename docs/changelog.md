# Changelog

All notable changes to FF&E Builder will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

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
