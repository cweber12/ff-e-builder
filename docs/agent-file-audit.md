# Agent File Audit

Audit of `AGENTS.md`, `CLAUDE.md`, `CONTEXT.md`, `.github/copilot-instructions.md`,
`docs/README.md`, `docs/architecture.md`, `docs/changelog.md`, and `docs/plans-context.md`.
Conducted 2026-05-07.

---

## Issue 1 — Direct contradiction: check-run policy (High)

**AGENTS.md** (operating rules):

> "Do not run `pnpm typecheck`, `pnpm lint`, `pnpm test`, or `pnpm build` — provide the check command as a prompt for the user or a delegated model to run."

**CLAUDE.md** (guardrail #5) and **`.github/copilot-instructions.md`** (constraint #5):

> "Run checks before every commit. `pnpm typecheck && pnpm lint && pnpm test && pnpm build` must all pass before drafting a commit message."

These are directly opposite. AGENTS.md is supposed to be authoritative but agent-specific files override it with conflicting instructions. Every agent resolves this differently.

**Fix:** Change CLAUDE.md and copilot-instructions.md guardrail #5 to match AGENTS.md:
_"Provide `pnpm typecheck && pnpm lint && pnpm test && pnpm build` as a prompt for the user to run; do not execute it yourself."_

---

## Issue 2 — `CONTEXT.md` absent from every "read first" list (High)

`CONTEXT.md` is the canonical domain terminology file — it defines Measured Plan, Measurement,
Measurement Crop, Plan Calibration, Rectangle Measurement, Length Line, Plans tool, and all other
product-level language. Without it, agents coin wrong names (e.g. "crop only", "annotation",
"Measure tool" instead of "Plans").

**AGENTS.md "Files to read first"** lists: `README.md`, `AGENTS.md`, `docs/architecture.md`,
`docs/changelog.md`. `CONTEXT.md` is absent from every read-first list across all agent files.

**Fix:** Add `CONTEXT.md` as item #3 in the "Files to read first" list in `AGENTS.md`
(before `docs/architecture.md`).

---

## Issue 3 — `docs/README.md` index is badly stale (Medium)

The index lists 7 entries. The actual `/docs/` directory has 14 files.
Missing entries:

| File                 | Contents                               |
| -------------------- | -------------------------------------- |
| `accessibility.md`   | Accessibility guidelines               |
| `design-system.md`   | Design system reference                |
| `images.md`          | Image entity, upload, and crop docs    |
| `materials.md`       | Finish Library and materials docs      |
| `privacy.md`         | Privacy policy / data handling         |
| `roadmap.md`         | Feature roadmap                        |
| `troubleshooting.md` | Debugging and runbook support          |
| `plans-context.md`   | Plans workspace implementation context |

An agent reading `docs/README.md` as its docs map will miss all of these.

**Fix:** Add all 8 missing files to the index table in `docs/README.md`.

---

## Issue 4 — Product name drift: "FF&E Builder" vs "ChillDesignStudio" (Medium)

The product was renamed to **ChillDesignStudio** (`README.md` H1, `docs/architecture.md` diagrams,
`CONTEXT.md`), but these files still use the old name:

| File                | Stale reference                                        |
| ------------------- | ------------------------------------------------------ |
| `AGENTS.md`         | H1: `# FF&E Builder — Agent Rules`                     |
| `CLAUDE.md`         | H1: `# Claude — Project Context for FF&E Builder`      |
| `docs/changelog.md` | H1 and subtitle: `All notable changes to FF&E Builder` |

Agents reading these files will use the wrong product name in commit messages and docs.

**Fix:** Update the three H1 / subtitle references above to **ChillDesignStudio**.

---

## Issue 5 — Plans missing from `docs/architecture.md` component diagram (Low)

The C4 component diagram Route Handlers description reads:
_"Projects, rooms, items, materials, proposal, images, users"_

Plans is omitted even though it is now a first-class project tool with its own route module
(`api/src/routes/plans.ts`) and a dedicated nav tab.

**Fix:** Add `plans` to the Route Handlers description in the component diagram.

---

## Issue 6 — Rule duplication creates future contradiction risk (Low)

`AGENTS.md`, `CLAUDE.md`, and `.github/copilot-instructions.md` all restate the same guardrails
in slightly different words. Issue 1 is a direct consequence of this divergence. The
agent-specific files add very little over `AGENTS.md` (only the deploy command and
`pnpm migrate` pointer are genuinely unique).

**Fix:** Reduce `CLAUDE.md` and `copilot-instructions.md` to:
_"Authoritative rules are in AGENTS.md. Agent-specific additions only:"_ followed by the
1–2 genuinely unique items. This eliminates future drift.

---

## Summary

| #   | Severity   | Files                                                 | Issue                                              |
| --- | ---------- | ----------------------------------------------------- | -------------------------------------------------- |
| 1   | **High**   | `CLAUDE.md`, `copilot-instructions.md` vs `AGENTS.md` | Contradictory check-run policy                     |
| 2   | **High**   | `AGENTS.md`                                           | `CONTEXT.md` missing from "read first" list        |
| 3   | **Medium** | `docs/README.md`                                      | 8 doc files unindexed                              |
| 4   | **Medium** | `AGENTS.md`, `CLAUDE.md`, `docs/changelog.md`         | Stale product name "FF&E Builder"                  |
| 5   | **Low**    | `docs/architecture.md`                                | Plans missing from component diagram               |
| 6   | **Low**    | `CLAUDE.md`, `copilot-instructions.md`                | Rule duplication creates future contradiction risk |
