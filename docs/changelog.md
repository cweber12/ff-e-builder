# Changelog

All notable changes to FF&E Builder will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

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
