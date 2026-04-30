# Architecture

## 1. Context diagram (C4 Level 1)

```mermaid
C4Context
  title FF&E Builder — System Context

  Person(designer, "Designer / Buyer", "Creates projects, rooms, and FF&E items; exports specs")
  System(app, "FF&E Builder", "React SPA + Cloudflare Workers API")
  System_Ext(firebase, "Firebase Auth", "Google-managed OIDC identity provider")
  System_Ext(neon, "Neon Postgres", "Serverless relational database (branching, autoscale)")
  System_Ext(cf, "Cloudflare Workers", "Edge compute that hosts the API")

  Rel(designer, app, "Uses", "HTTPS browser")
  Rel(app, firebase, "Authenticates", "Firebase JS SDK / REST")
  Rel(app, cf, "Calls API", "HTTPS /api/*  (JWT in Authorization header)")
  Rel(cf, neon, "Queries", "Neon serverless driver over WebSocket")
```

---

## 2. Component diagram (C4 Level 2)

```mermaid
C4Component
  title FF&E Builder — Components

  Container_Boundary(spa, "React SPA (Vite, TypeScript)") {
    Component(ui, "UI Layer", "React, shadcn/ui, Tailwind", "Renders views and forms")
    Component(auth, "Auth module", "Firebase Auth SDK", "Sign-in, token refresh")
    Component(apiClient, "API Client", "fetch + Zod", "Calls /api/* with JWT")
  }

  Container_Boundary(worker, "Cloudflare Workers API (Hono, TypeScript)") {
    Component(router, "Router", "Hono", "Routes HTTP requests to handlers")
    Component(authMw, "Auth middleware", "Firebase Admin SDK", "Verifies ID tokens")
    Component(handlers, "Route handlers", "TypeScript", "Business logic")
    Component(db, "DB layer", "Drizzle ORM + Neon driver", "SQL queries")
  }

  Rel(ui, auth, "Uses")
  Rel(ui, apiClient, "Calls")
  Rel(apiClient, router, "HTTPS /api/*")
  Rel(router, authMw, "Middleware chain")
  Rel(authMw, handlers, "Passes verified userId")
  Rel(handlers, db, "Queries")
```

---

## 3. Sequence diagram — "user edits an item"

```mermaid
sequenceDiagram
  participant U as User
  participant W as React (GitHub Pages)
  participant F as Firebase Auth
  participant A as Worker (api.workers.dev)
  participant D as Neon Postgres

  U->>W: Click "Save"
  W->>F: Get current ID token
  F-->>W: ID token JWT
  W->>A: PATCH /api/v1/items/:id  (Bearer <token>)
  A->>F: verifyIdToken (Admin SDK)
  F-->>A: { uid: ... }
  A->>D: SELECT ownership; UPDATE item
  D-->>A: rows
  A-->>W: 200 OK { item }
  W-->>U: re-render
```

---

## 4. Entity-Relationship Diagram

```mermaid
erDiagram
  USERS {
    text id PK "Firebase UID"
    text email
    timestamptz created_at
  }

  PROJECTS {
    uuid id PK
    text owner_id FK
    text name
    text status
    timestamptz created_at
    timestamptz updated_at
  }

  ROOMS {
    uuid id PK
    uuid project_id FK
    text name
    int sort_order
  }

  ITEMS {
    uuid id PK
    uuid room_id FK
    text name
    text vendor
    text model_number
    int quantity
    int unit_price_cents "always integer cents"
    text status
    text notes
    timestamptz created_at
    timestamptz updated_at
  }

  USERS ||--o{ PROJECTS : owns
  PROJECTS ||--o{ ROOMS : contains
  ROOMS ||--o{ ITEMS : contains
```

---

## 5. Decisions

Architecture decisions are recorded as ADRs in [/docs/adr/](/docs/adr/).

| #                                        | Decision                                                                     | Status   |
| ---------------------------------------- | ---------------------------------------------------------------------------- | -------- |
| [0001](adr/0001-server-side-db-proxy.md) | Server-side DB proxy (Cloudflare Worker between client and Neon)             | Accepted |
| [0002](adr/0002-manual-types-for-now.md) | Hand-written TypeScript types; defer auto-generation until schema stabilizes | Accepted |
