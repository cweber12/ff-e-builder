# Agent Routing Guide

## Purpose

Route each task to the smallest effective context so work is faster, safer, and more token-efficient.

## Scope

Applies to frontend, API, DB, and cross-boundary work.

## Routing principles

1. Route by change boundary, not by preferred tool.
2. Keep one owner agent per slice.
3. Escalate only when a boundary crossing is confirmed.
4. Load minimal context first, then expand only on demand.
5. Prefer targeted verification first, with full-suite checks only at risk gates.

## Agent roles

### UI Shell Agent

Owns shared layout, navigation chrome, theme tokens, primitives, and global style behavior.

Best for changes that affect multiple screens visually.

### Feature Module Agent

Owns one product slice end-to-end inside a single feature boundary.

Best for page or module changes without contract or schema changes.

### API Agent

Owns route behavior, auth and ownership middleware behavior, validation, and payload semantics.

Best for request, response, or endpoint behavior changes.

### Database Agent

Owns migrations, compatibility, constraints, and data integrity conventions.

Best for schema and persistence semantics.

### Integration Agent

Owns cross-boundary coordination and final alignment checks.

Best when two or more boundaries are touched in one slice.

## Default assignment rules

1. If only one boundary changes, assign that boundary owner.
2. If two boundaries change, assign the higher-risk boundary as owner and request one review pass from the second boundary owner.
3. If three or more boundaries change, split into slices first, then assign one owner per slice.
4. If scope expands during discovery, pause and re-approve scope before continuing.

## Escalation triggers

1. A new migration is needed after frontend or API work has started.
2. Response shape drifts from client assumptions.
3. Auth or ownership behavior affects multiple routes or modules.
4. A shared utility change affects more than one product area.
5. Verification failures appear outside the planned slice.

## Minimal context packs

### UI Shell

- `AGENTS.md`
- `CONTEXT.md`
- `docs/reference/design-system.md`
- `docs/reference/accessibility.md`

### Feature Module

- `AGENTS.md`
- `CONTEXT.md`
- `docs/architecture.md` section 8 (file and folder conventions) — derive paths from the convention before searching
- Target module files under `src/components/`, `src/hooks/`, and `src/lib/`

### API

- `AGENTS.md`
- `docs/architecture.md`
- `api/src/`
- `docs/ops/runbook.md`

### Database

- `AGENTS.md`
- `docs/reference/money.md`
- `db/migrations/`
- `scripts/migrate.ts`

### Integration

- `AGENTS.md`
- `CONTEXT.md`
- `docs/architecture.md`
- Only impacted feature docs, not all docs

## Handoff template between agents

1. One-sentence task outcome.
2. In-scope and out-of-scope file list.
3. Behavior delta summary.
4. Verification required for this slice only.
5. Risks and assumptions.
6. Suggested commit message.

## Anti-patterns

1. Too many micro-agents for one small task.
2. Always loading the full docs set by default.
3. Running full-suite checks for every small UI tweak.
4. Silent scope expansion after discovery.
5. Cross-boundary edits without explicit ownership.

## Default workflow

1. Pick owner agent based on boundary.
2. Execute narrow discovery in that boundary.
3. Confirm scope and verification level.
4. Implement one slice.
5. Run targeted verification.
6. Handoff or escalate only if trigger conditions are met.
