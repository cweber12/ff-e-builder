# ADR-0001: Server-side DB Proxy (Cloudflare Worker)

| Field | Value |
|---|---|
| Date | 2026-04-30 |
| Status | Accepted |
| Deciders | @cweber12 |

---

## Context

FF&E Builder is a browser-based SPA that needs to read and write structured data in a
Neon (serverless Postgres) database. Neon supports a WebSocket-based driver that can
run in browsers, so it is technically possible to connect directly from the React app.

However, direct browser-to-database access requires that the database credentials
(`NEON_DATABASE_URL`, which contains username and password) be present in the
client-side JavaScript bundle. This means every user who opens DevTools can see and
reuse those credentials. Row-level security (RLS) in Postgres can reduce blast radius,
but it cannot eliminate the credential-exposure risk entirely, and it adds significant
maintenance complexity.

Additionally, the app authenticates users via Firebase Auth. Validating Firebase ID
tokens requires the Firebase Admin SDK, which cannot run in a browser. Some form of
server-side component is therefore already required for auth verification.

## Decision

All database access goes through a **Cloudflare Workers API** (`/api/*`). The React
SPA never imports the Neon driver and never holds database credentials. The Worker
verifies the user's Firebase ID token on every request, enforces authorization rules
in application code, and is the only component that holds `NEON_DATABASE_URL`.

## Consequences

### Positive
- Database credentials are never exposed to the browser or the client bundle.
- Auth token verification happens server-side, where the Firebase Admin SDK can run.
- A single enforcement point for authorization logic makes security audits easier.
- The Worker layer is stateless and scales horizontally on Cloudflare's edge network.
- The API surface (Hono routes) is independently testable.

### Negative / Trade-offs
- Every DB operation has an additional network hop (SPA → Worker → Neon).
  Neon's serverless driver mitigates cold-start latency, and Cloudflare Workers have
  sub-millisecond startup, so practical latency impact is small.
- More moving parts: a Worker must be deployed and kept in sync with schema changes.
- Local development requires running the Worker locally (via `wrangler dev`).

### Neutral
- The Neon driver and Drizzle ORM become Worker-only dependencies, not present in
  the Vite bundle. Bundle size is smaller as a result.

## Alternatives considered

| Alternative | Why rejected |
|---|---|
| Direct browser → Neon via WebSocket driver | Exposes DB credentials in the client bundle; unacceptable security risk |
| Supabase PostgREST / auto-generated API | Vendor lock-in; less control over auth integration and query structure |
| PlanetScale / Turso / other serverless DB | Neon was already chosen for its Postgres compatibility and branching; switching adds migration cost with no clear benefit |
