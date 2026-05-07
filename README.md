# ChillDesignStudio

> Specification management for interior designers — organize furniture, fixtures & equipment across projects, rooms, and vendors.

![Build status](https://github.com/cweber12/ff-e-builder/actions/workflows/ci.yml/badge.svg)

---

## Quick start

**Prerequisites:** Node 20+, pnpm 9+

```bash
pnpm install
cp .env.example .env.local   # then fill in your credentials
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173).

---

## Architecture at a glance

```mermaid
C4Context
  title ChillDesignStudio - System Context

  Person(designer, "Designer", "Creates projects, FF&E schedules, proposals, material libraries, and exports")
  System(app, "ChillDesignStudio", "React SPA + Cloudflare Workers API")
  System_Ext(firebase, "Firebase Auth", "Google-managed identity provider")
  System_Ext(neon, "Neon Postgres", "Serverless relational database")
  System_Ext(r2, "Cloudflare R2", "Private image object storage")
  System_Ext(cf, "Cloudflare", "Edge network hosting the Workers API")

  Rel(designer, app, "Uses", "HTTPS")
  Rel(app, firebase, "Authenticates via", "Firebase SDK / REST")
  Rel(app, cf, "API calls to Workers", "HTTPS /api/v1/*")
  Rel(cf, neon, "Queries via", "Neon serverless driver")
  Rel(cf, r2, "Stores private images", "R2 binding")
```

For component diagrams, sequence diagrams, and the ERD see [docs/architecture.md](docs/architecture.md).

---

## UI surfaces

- **Brand** -- the application presents as ChillDesignStudio while retaining the existing project-first workspace.
- **User information** -- the projects page includes editable user contact details for project documentation.
- **Project Snapshot** (`/projects/:id`, `/projects/:id/snapshot`) -- opening a project now lands on a read-first overview page that becomes the default in-project entry point before drilling into FF&E, Proposal, Materials, or Budget.
- **Default sample content** -- every new project is preloaded with FF&E rooms/items, Proposal categories/items, project images, item renderings, and material/swatch imagery so exports can be reviewed against realistic data immediately.
- **Proposal** (`/projects/:id/proposal/table`) -- project proposal rows grouped by category, seeded with Millwork, Ceiling, Flooring, and Walls, with rendering uploads, image-only Plan cells, assigned Finish Library Materials for Swatch Cells, drawing/location fields, size entry, CBM, quantity units, integer-cent totals, image-aware Excel import with column mapping, and CSV/Excel/PDF exports with equal-width project image bands plus cell-filling row imagery.
- **Project images** -- project cards support up to three private project images, managed from the card options menu, with one selected preview image.

- **Project header** -- compact read-only project identity, project-section navigation, and Project Options for updating project data, images, or deletion.
- **Plans** (`/projects/:id/plans`, `/projects/:id/plans/:planId`) -- project-level architectural plan library plus a full-window opened-plan workspace with protected image viewing, saved per-plan calibration, reusable Length Line measurements, item-linked rectangle measurements with highlighted overlays, a measured-items sidebar, session-only zoom/pan/rotation controls, and crop framing stored on each measured item.
- **FF&E Table** (`/projects/:id/ffe/table`) -- FF&E items grouped by room with persisted collapse state, room subtotals, inline editing, structure mutations, a dedicated Rendering column, item descriptions, per-room and full-project export (CSV, Excel, PDF), and Excel import with a column-mapping wizard.
- **FF&E Catalog** (`/projects/:id/ffe/catalog`) -- printable one-item-per-page FF&E catalog with click-to-edit item text, main Rendering plus up to three selectable option renderings, browser print, direct PDF export, and per-item PDF export with editable customer-approval/signature fields.
- **FF&E Summary** (`/projects/:id/ffe/summary`) -- room subtotals, budget progress, status counts, vendor totals, and CSV/Excel/PDF export.
- **Materials** (`/projects/:id/ffe/materials`, `/projects/:id/proposal/materials`) -- project-specific material libraries store an image swatch, ID, and description for use from either tool. See [docs/materials.md](docs/materials.md).
- **Images** -- project, room, FF&E item, material, Proposal Rendering, Plan Image, Material Visual, and Measured Plan source images are stored privately behind the API Worker. Shared entity images use Neon `image_assets`; Measured Plan source-image metadata lives on `measured_plans`; image bytes live in the private Cloudflare R2 `ffe-images` bucket. See [docs/images.md](docs/images.md).

## Frontend deploy notes

- GitHub Pages serves the Vite app from `/ff-e-builder/`.
- The frontend build now emits stable asset filenames in `dist/assets/` so a new
  Pages deploy does not leave the browser pointing at a removed hashed bundle
  from the previous release.
- The build also publishes a compatibility copy for the known stale bundle name
  `assets/index-BD_UO_br.js`; this lets browsers with a cached older
  `index.html` recover instead of loading a blank page from a 404 script.

---

## Project structure

```
/
├── src/               # React + Vite front-end (TypeScript)
│   ├── components/    # Domain-aware UI components (ItemsTable, CatalogView, …)
│   │   └── primitives/  # Generic design-system atoms (Button, Modal, Drawer, …)
│   ├── hooks/         # Custom React hooks, query keys, and optimistic cache helpers with barrel export (index.ts)
│   ├── lib/           # Client-side utilities (API client modules/tests, calc, export/import modules, …)
│   ├── types/         # Shared TypeScript types with barrel export (index.ts)
│   ├── data/          # Static fixture data (demo seed)
│   ├── test/          # Vitest global setup
│   └── vite-env.d.ts  # Vite client-types reference
├── tests/
│   └── e2e/           # Playwright end-to-end tests
├── public/            # Static assets (Vite copies to dist/)
│   └── 404.html       # GitHub Pages SPA redirect script
├── api/               # Cloudflare Workers API (TypeScript)
│   └── src/
│       ├── routes/    # Hono route handlers (projects, plans, rooms, items, materials, proposal, images, users)
│       ├── middleware/ # Auth middleware (Firebase JWT verification)
│       └── lib/       # Worker-only utilities (db, firebase-auth, ownership)
├── db/
│   └── migrations/    # SQL migration files; apply via `pnpm migrate`, never from client
├── docs/              # Project documentation
│   └── adr/           # Architecture Decision Records
├── .github/
│   └── workflows/     # ci.yml (PR gates) + deploy.yml (main → gh-pages)
├── .env.example       # Required environment variables (no secrets)
├── CONTEXT.md         # Canonical product/domain language for agents and engineers
├── AGENTS.md          # Canonical rules for all AI agents
├── vite.config.ts     # Vite + Vitest config
├── tailwind.config.ts # Tailwind v3 design tokens
├── playwright.config.ts
└── README.md          # This file
```

---

## Where to go next

| Audience             | Resource                                           |
| -------------------- | -------------------------------------------------- |
| AI agents & Codex    | [AGENTS.md](AGENTS.md)                             |
| Domain language      | [CONTEXT.md](CONTEXT.md)                           |
| Engineers onboarding | [docs/architecture.md](docs/architecture.md)       |
| Ops / deployment     | [docs/runbook.md](docs/runbook.md)                 |
| Accessibility        | [docs/accessibility.md](docs/accessibility.md)     |
| Privacy              | [docs/privacy.md](docs/privacy.md)                 |
| Troubleshooting      | [docs/troubleshooting.md](docs/troubleshooting.md) |
| Changelog            | [docs/changelog.md](docs/changelog.md)             |
| Contributing         | [docs/contributing.md](docs/contributing.md)       |
