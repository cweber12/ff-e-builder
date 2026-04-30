# ADR-0002: Manual TypeScript Types for Now

| Field    | Value      |
| -------- | ---------- |
| Date     | 2026-04-30 |
| Status   | Accepted   |
| Deciders | @cweber12  |

---

## Context

The database schema (defined in `/db/migrations/0001_initial.sql`) has a corresponding set
of TypeScript types in `/api/src/types.ts`. These are currently written by hand. As the
schema evolves, hand-maintained types can drift from the actual DB schema if a developer
forgets to update both in sync.

Several tools exist to auto-generate TypeScript types from a live Postgres schema:

- **kanel** — generates types from a connected Postgres instance; mature and configurable
- **pg-typegen** — similar generation approach
- **Drizzle ORM** — schema-as-code (TypeScript is the source of truth, migrations are derived)
- **Zapatos** — runtime-safe query builder with generated types

The question is whether to introduce one of these tools now or defer it.

## Decision

**Keep hand-written types for now.** Revisit when the schema stabilizes after Phase 3
(DB query implementation) and the type/schema mismatch issue actually manifests.

Specifically, do **not** add an auto-generation tool until at least one of:

- A type mismatch bug is caught in review or tests, OR
- The schema exceeds ~5 tables, OR
- A second engineer joins the project and the sync burden becomes real.

At that point, prefer **Drizzle ORM** (schema-as-code) over runtime introspection tools
because it keeps TypeScript as the source of truth and generates migrations from the
schema rather than the reverse.

## Consequences

### Positive

- Zero additional tooling or setup cost right now
- No live DB connection needed during development or CI
- Types are readable and easily audited alongside the schema SQL

### Negative / Trade-offs

- Hand-maintained types can drift from the DB schema; caught only at test or runtime
- Adding a column to the DB requires remembering to update types in a separate file
- Small risk of subtle nullable/non-nullable mismatches

### Neutral

- The migration SQL in `/db/migrations/` remains the authoritative schema definition
- All type changes still require updating `/api/src/types.ts` manually

## Alternatives considered

| Alternative                  | Why deferred                                                                           |
| ---------------------------- | -------------------------------------------------------------------------------------- |
| Drizzle ORM (schema-as-code) | Would invert the migration workflow; high setup cost before schema stabilizes          |
| kanel / pg-typegen           | Requires a live DB connection in CI; adds complexity for limited gain at current scale |
| Zapatos                      | Tighter coupling to query patterns; better evaluated after Phase 3                     |
