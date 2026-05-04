# Architecture

## 1. System Context

```mermaid
C4Context
  title ChillDesignStudio - System Context

  Person(designer, "Designer / Procurement User", "Creates projects, FF&E schedules, Take-Off Tables, material libraries, and exports")
  System(app, "ChillDesignStudio", "React SPA + Cloudflare Workers API")
  System_Ext(firebase, "Firebase Auth", "OIDC identity provider")
  System_Ext(neon, "Neon Postgres", "Serverless relational database")
  System_Ext(r2, "Cloudflare R2", "Private object storage for Project Images and row-level Renderings")
  System_Ext(cf, "Cloudflare Workers", "Edge runtime hosting the API")

  Rel(designer, app, "Uses", "HTTPS browser")
  Rel(app, firebase, "Signs in and refreshes tokens", "Firebase JS SDK")
  Rel(app, cf, "Calls authenticated API", "HTTPS /api/v1/* with Bearer token")
  Rel(cf, firebase, "Verifies ID tokens", "Firebase public keys")
  Rel(cf, neon, "Reads and writes data", "Neon serverless SQL client")
  Rel(cf, r2, "Streams private image objects", "R2 binding")
```

ChillDesignStudio is still stored in the `ffe-builder` repository. In domain language, FF&E is one tool inside the product; it is no longer the whole product shell. See [../CONTEXT.md](../CONTEXT.md) for canonical project terms.

## 2. Main Modules

```mermaid
C4Component
  title ChillDesignStudio - Components

  Container_Boundary(spa, "React SPA (Vite, TypeScript)") {
    Component(routes, "Route Shell", "react-router-dom", "Project list, tool chooser, FF&E pages, Take-Off Table pages")
    Component(ui, "Components", "React + Tailwind", "Tables, modals, headers, exports, imports, image frames")
    Component(hooks, "Data Hooks", "TanStack Query", "Project, room, item, material, image, user profile, and Take-Off Table queries")
    Component(auth, "Auth Module", "Firebase Auth SDK", "Sign-in state and ID token access")
    Component(apiClient, "API Client", "fetch", "Maps client models to /api/v1 payloads")
  }

  Container_Boundary(worker, "Cloudflare Workers API (Hono, TypeScript)") {
    Component(router, "Router", "Hono", "Mounts route modules under /api/v1")
    Component(authMw, "Auth Middleware", "Firebase token verification", "Rejects unauthenticated API calls")
    Component(ownership, "Ownership Helpers", "SQL lookups", "Ensures resources belong to the Firebase UID")
    Component(routeHandlers, "Route Handlers", "TypeScript", "Projects, rooms, items, materials, take-off, images, users")
    Component(db, "Database Client", "Neon serverless SQL template", "Hand-written SQL queries")
    Component(imageGateway, "Image Gateway", "Cloudflare R2 binding", "Uploads, primary image selection, protected downloads")
  }

  Rel(routes, ui, "Renders")
  Rel(ui, hooks, "Reads and mutates")
  Rel(hooks, apiClient, "Calls")
  Rel(apiClient, auth, "Gets current ID token")
  Rel(apiClient, router, "HTTPS /api/v1/*")
  Rel(router, authMw, "Applies to /api/v1/*")
  Rel(authMw, routeHandlers, "Passes Firebase UID")
  Rel(routeHandlers, ownership, "Checks")
  Rel(routeHandlers, db, "Queries")
  Rel(routeHandlers, imageGateway, "Streams image bytes")
```

The Worker uses hand-written SQL through `@neondatabase/serverless`; there is no current Drizzle schema in the repo. SQL migrations in `db/migrations/` are the database source of truth, and API/client TypeScript models are maintained manually.

## 3. Frontend Routes

- `/signin` is public.
- `/projects` lists projects, editable user information, and project image previews.
- `/projects/:id` shows the tool chooser for FF&E and Take-Off Table.
- `/projects/:id/ffe/table` shows the editable FF&E table grouped by Room.
- `/projects/:id/ffe/catalog` shows printable FF&E catalog pages.
- `/projects/:id/ffe/materials` shows the shared project material library from the FF&E tool.
- `/projects/:id/ffe/summary` shows FF&E budget and status summaries.
- `/projects/:id/takeoff/table` shows the editable Take-Off Table grouped by Take-Off Category.
- `/projects/:id/takeoff/materials` shows the shared project material library from the Take-Off tool.
- `/projects/:id/takeoff/summary` shows Take-Off category and cost summaries.

Legacy project routes such as `/projects/:id/table` redirect to their FF&E equivalents.

## 4. API, Auth, And Storage Conventions

- Firebase Auth owns user identity. The client waits for auth readiness and sends the current ID token as `Authorization: Bearer <token>` on API calls.
- The Worker auth middleware protects all `/api/v1/*` routes. `/healthz` is public.
- The client never imports API worker code and never talks to Neon or R2 directly.
- Route modules live under `api/src/routes/`: `projects`, `rooms`, `items`, `materials`, `takeoff`, `images`, and `users`.
- Ownership is checked in the Worker with helper queries. Cross-user or missing resources return `404` to avoid leaking existence.
- Money is stored and transported as integer cents. See [money.md](money.md).
- Image bytes live in the private R2 bucket `ffe-images`; image metadata lives in Neon `image_assets`.
- R2 object keys are user/project scoped. Current image entity types are `project`, `room`, `item`, `material`, `takeoff_item`, `takeoff_plan`, and `takeoff_swatch`. In domain language, the primary image attached to an FF&E Item or Take-Off Item row is a Rendering, while a Take-Off Plan Image is a separate row-level visual.
- Project images are limited to three per Project, with one `is_primary` image used as the preview image in the project list and as the primary Project Image in exports.
- Take-Off Category defaults are created lazily when a project's take-off categories are read: Millwork, Ceiling, Flooring, and Walls.

## 5. Data Flow

### User edits an FF&E Item

```mermaid
sequenceDiagram
  participant U as User
  participant W as React SPA
  participant F as Firebase Auth
  participant A as Worker API
  participant D as Neon Postgres

  U->>W: Edit item cell
  W->>F: Get current ID token
  F-->>W: ID token JWT
  W->>A: PATCH /api/v1/items/:id
  A->>A: Verify token and load UID
  A->>D: Check item ownership through room/project
  A->>D: UPDATE item WHERE id and version match
  D-->>A: Updated row
  A-->>W: JSON item
  W-->>U: Refresh table state
```

### User uploads an image

```mermaid
sequenceDiagram
  participant U as User
  participant W as React SPA
  participant A as Worker API
  participant D as Neon Postgres
  participant R as Cloudflare R2

  U->>W: Choose image file
  W->>A: POST /api/v1/images?entity_type=...&entity_id=...
  A->>D: Verify entity ownership
  A->>R: Put object under users/{uid}/projects/{projectId}/...
  A->>D: Insert image_assets metadata
  A-->>W: JSON image metadata
  W->>A: GET /api/v1/images/:id/content
  A->>R: Read private object
  A-->>W: Image bytes
```

## 6. Entity Relationship Diagram

```mermaid
erDiagram
  PROJECTS {
    uuid id PK
    text owner_uid "Firebase UID"
    text name
    text client_name
    text company_name
    text project_location
    text budget_mode "shared | individual"
    bigint budget_cents "integer cents"
    bigint ffe_budget_cents "integer cents"
    bigint takeoff_budget_cents "integer cents"
    timestamptz created_at
    timestamptz updated_at
  }

  USER_PROFILES {
    text owner_uid PK "Firebase UID"
    text name
    text email
    text phone
    text company_name
    timestamptz created_at
    timestamptz updated_at
  }

  ROOMS {
    uuid id PK
    uuid project_id FK
    text name
    int sort_order
    timestamptz created_at
    timestamptz updated_at
  }

  ITEMS {
    uuid id PK
    uuid room_id FK
    text item_name
    text category
    text vendor
    text model
    text item_id_tag
    text dimensions
    int qty
    bigint unit_cost_cents "integer cents"
    numeric markup_pct
    text status
    int sort_order
    int version
    timestamptz created_at
    timestamptz updated_at
  }

  TAKEOFF_CATEGORIES {
    uuid id PK
    uuid project_id FK
    text name
    int sort_order
    timestamptz created_at
    timestamptz updated_at
  }

  TAKEOFF_ITEMS {
    uuid id PK
    uuid category_id FK
    text product_tag
    text plan
    text drawings
    text location
    text description
    text size_label
    text size_mode "imperial | metric"
    text size_w
    text size_d
    text size_h
    text size_unit
    jsonb swatches
    numeric cbm
    numeric quantity
    text quantity_unit
    bigint unit_cost_cents "integer cents"
    int sort_order
    int version
    timestamptz created_at
    timestamptz updated_at
  }

  MATERIALS {
    uuid id PK
    uuid project_id FK
    text name
    text material_id
    text description
    text swatch_hex
    timestamptz created_at
    timestamptz updated_at
  }

  MATERIAL_SWATCHES {
    uuid id PK
    uuid material_id FK
    text swatch_hex
    int sort_order
    timestamptz created_at
  }

  ITEM_MATERIALS {
    uuid item_id FK
    uuid material_id FK
    int sort_order
    timestamptz created_at
  }

  IMAGE_ASSETS {
    uuid id PK
    text owner_uid "Firebase UID"
    uuid project_id FK
    uuid room_id FK
    uuid item_id FK
    uuid material_id FK
    uuid takeoff_item_id FK
    text r2_key
    text filename
    text content_type
    int byte_size
    text alt_text
    boolean is_primary
    timestamptz created_at
    timestamptz updated_at
  }

  PROJECTS ||--o{ ROOMS : contains
  ROOMS ||--o{ ITEMS : contains
  PROJECTS ||--o{ TAKEOFF_CATEGORIES : contains
  TAKEOFF_CATEGORIES ||--o{ TAKEOFF_ITEMS : contains
  PROJECTS ||--o{ MATERIALS : owns
  ITEMS ||--o{ ITEM_MATERIALS : uses
  MATERIALS ||--o{ ITEM_MATERIALS : assigned_to
  MATERIALS ||--o{ MATERIAL_SWATCHES : has
  PROJECTS ||--o{ IMAGE_ASSETS : has
  ROOMS ||--o{ IMAGE_ASSETS : can_have
  ITEMS ||--o{ IMAGE_ASSETS : can_have
  MATERIALS ||--o{ IMAGE_ASSETS : can_have
  TAKEOFF_ITEMS ||--o{ IMAGE_ASSETS : can_have
```

## 7. Testing And Verification

Common local checks:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm --filter ffe-api typecheck
pnpm --filter ffe-api test
```

Focused checks are preferred while iterating, for example:

```bash
pnpm exec vitest run src/components/ItemsTable.test.tsx
pnpm exec vitest run src/lib/exportUtils.test.ts
```

Database migrations are applied with:

```bash
pnpm migrate
```

The API Worker can be run locally with:

```bash
pnpm --filter ffe-api dev
```

## 8. Agent Guardrails

- Read `README.md`, `AGENTS.md`, this file, and `docs/changelog.md` before broad changes.
- Never commit automatically; provide a conventional commit message after changes.
- Do not run destructive commands or force-push without explicit confirmation.
- Keep the client/API boundary intact: `src/` must not import from `api/`, and `api/` must not import from `src/`.
- Put domain types in `src/types/` and export them from `src/types/index.ts`.
- Put hooks in `src/hooks/` and export them from `src/hooks/index.ts`.
- Put reusable UI primitives in `src/components/primitives/` and export them from its barrel.
- Update docs and `docs/changelog.md` when feature behavior, public APIs, env vars, file structure, or dependencies change.
- Keep monetary values as integer cents from DB through API and application state.

## 9. Decisions

Architecture decisions are recorded as ADRs in [adr/](adr/).

| #                                              | Decision                                                                  | Status   |
| ---------------------------------------------- | ------------------------------------------------------------------------- | -------- |
| [0001](adr/0001-server-side-db-proxy.md)       | Server-side DB proxy between the client and Neon                          | Accepted |
| [0002](adr/0002-manual-types-for-now.md)       | Hand-written TypeScript types; defer generation until schema pain is real | Accepted |
| [0003](adr/0003-no-storybook-yet.md)           | No Storybook in v1; rely on focused tests and written design-system docs  | Accepted |
| [0004](adr/0004-project-scoped-tool-models.md) | Keep FF&E and Take-Off as separate project-scoped data models             | Accepted |
