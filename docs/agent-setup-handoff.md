# Agent Setup Handoff (2026-05-08)

This note is a transfer brief for any incoming agent that needs to understand the current agent configuration, project architecture, and documentation quality in this repository.

## Scope Reviewed

- `.claude/`
- `.agents/`
- `.github/`
- `docs/`
- `AGENTS.md`
- `CLAUDE.md`
- `CONTEXT.md`

## What This Project Is

ChillDesignStudio is a project-first interior design specification workspace.

Key domain split:

- FF&E is room-grouped.
- Proposal is category-grouped.
- Plans is a first-class tool for measured plan workflows.

Core technical architecture:

- Frontend: React + Vite (`src/`)
- API: Cloudflare Workers + Hono (`api/`)
- DB: Neon Postgres (SQL migrations in `db/migrations/`)
- Auth: Firebase Auth
- Storage: Cloudflare R2 for private images

Boundary rule:

- Client must call `/api/v1/*` only.
- No direct Neon access from client code.

## Agent Governance Structure

Primary authority:

1. `AGENTS.md` (repo-wide canonical rules)
2. Agent-specific additions (`CLAUDE.md`, `.github/copilot-instructions.md`)
3. Tool/runtime permissions (for example `.claude/settings.local.json`)

Current state:

- `AGENTS.md`, `CLAUDE.md`, and `.github/copilot-instructions.md` are mostly aligned on core policy.
- Domain language quality is high due to detailed canonical terms in `CONTEXT.md`.

## What Works Optimally

- Strong canonical domain vocabulary in `CONTEXT.md` (reduces naming drift and semantic confusion).
- Well-documented architecture in `docs/architecture.md` (context/component/sequence/ERD coverage).
- Good CI baseline in `.github/workflows/ci.yml` (lint, typecheck, test, build).
- Clear deploy path for frontend Pages in `.github/workflows/deploy.yml`.
- Changelog discipline is strong in `docs/changelog.md`.

## What Works Well But Could Be Improved

- Skill mirroring across `.agents/skills` and `.claude/skills` keeps local utility high, but duplication increases maintenance overhead.
- Operational guidance is generally good, but doc consistency should be tightened for product naming and stack wording.
- Agent setup knowledge is spread across multiple files and would benefit from a single concise precedence/ownership matrix.

## Problems and Inconsistencies

### 1) Policy-vs-permission mismatch risk

- `AGENTS.md` says agents should not directly run `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` and should delegate/report commands for user or light model execution.
- `.claude/settings.local.json` currently permits running these commands directly.
- Result: behavior can vary by runtime/agent despite shared intended policy.

### 2) Skill availability mismatch

- `.agents/skills/heavy-agent-delegation/` exists and includes prompt templates.
- Equivalent heavy-agent-delegation skill is not present in `.claude/skills/`.
- Result: delegation workflows are easier to enforce in one environment than another.

### 3) Historical audit drift

- `docs/agent-file-audit.md` appears partially stale relative to current repo state.
- Some previously flagged issues were already fixed, so treating that file as current truth can cause confusion.

### 4) Minor naming and wording drift

- `docs/runbook.md` still references the older product label in places ("FF&E Builder").
- `docs/plans-context.md` stack wording mentions Drizzle while `docs/architecture.md` states current worker data access is handwritten SQL.

## Suggested Improvements (High Value)

1. Add explicit instruction precedence in `AGENTS.md`.
2. Decide and document one skill-source strategy:
   - Option A: `.agents/skills` is the single source of truth.
   - Option B: mirrored skills are required and must be kept in lockstep.
3. Reconcile policy and permissions between `AGENTS.md` and `.claude/settings.local.json`.
4. Refresh or supersede `docs/agent-file-audit.md`.
5. Normalize naming/stack statements in:
   - `docs/runbook.md`
   - `docs/plans-context.md`

## Suggested Execution Order

1. Governance alignment pass

- Confirm final policy for check commands and delegation.
- Align runtime permissions to that policy.

2. Skill topology pass

- Choose single-source or mirrored strategy.
- Add missing skill(s) or remove drift vectors.

3. Documentation consistency pass

- Update stale naming/stack language.
- Mark `docs/agent-file-audit.md` as superseded if replaced.

4. Operational clarity pass

- Ensure README/runbook clearly distinguish:
  - frontend Pages deploy (automated)
  - API Worker deploy (`pnpm --filter ffe-api deploy`)

## Quick Start For Incoming Agent

Read in this order:

1. `README.md`
2. `AGENTS.md`
3. `CONTEXT.md`
4. `docs/architecture.md`
5. `docs/changelog.md`
6. this file (`docs/agent-setup-handoff.md`)

Keep these invariants:

- API-only DB access from client side
- integer minor units for money
- canonical domain terms from `CONTEXT.md`
- update docs/changelog when behavior or public surface changes
