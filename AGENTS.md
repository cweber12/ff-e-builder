# ChillDesignStudio — Agent Rules

## Project

**ChillDesignStudio** is a project-first specification workspace for interior design teams. A Project can carry room-based FF&E work and category-based Proposal work. Users organize FF&E Items into Rooms, attach finish library materials, and export catalog sheets and proposals. The React + Vite front-end authenticates with Firebase Auth, then calls a Cloudflare Workers API that is the sole gateway to a Neon (serverless Postgres) database. See [/docs/architecture.md](/docs/architecture.md) for the full system design. See [/CONTEXT.md](/CONTEXT.md) for canonical product terminology.

---

## Chat planning → CLI coding workflow

Use chat for planning, product decisions, PRDs, issue breakdowns, and implementation handoffs. Use CLI agents for code edits, targeted verification, and commits.

- `AGENTS.md` is the operational contract for coding agents: workflow rules, safety rules, repo conventions, verification, and commit behavior.
- `CONTEXT.md` is the product/domain source of truth: user-facing terminology, business rules, relationships, and durable product decisions.
- Do not put coding workflow rules in `CONTEXT.md`; move them here.
- Do not put product/domain terminology only in `AGENTS.md`; move it to `CONTEXT.md`.
- When chat produces a plan for CLI implementation, paste the final handoff into the CLI prompt or save it under `/docs/` if it should become durable project documentation.
- CLI agents must treat the approved handoff as the implementation boundary. If code discovery shows the file list or scope is wrong, stop and ask before expanding the work.

---

## Planning Handoff (Optional, On Request)

The 8-section handoff format below is a template — use it **only when the user requests a handoff prompt** or when you explicitly offer one and the user accepts.

- After a planning or triage session, **offer** to produce a handoff prompt. Do not generate one automatically.
- A `ready-for-agent` issue carrying an Agent Brief is implemented **directly** — no self-preflight, no regenerated handoff.
- For large, ambiguous, cross-cutting work, or anything touching public APIs, DB migrations, dependencies, or CI/build: stop and confirm scope in prose before coding. A formatted handoff is one option; a short scope-confirmation exchange is sufficient.

### Handoff format (on request)

1. **Task** — One-sentence statement of the requested outcome.
2. **Scope** — Editable files as an explicit path list; out-of-scope areas as explicit exclusions.
3. **Behavior** — Expected / actual / reproduction steps / relevant error snippet.
4. **Constraints** — Keep changes minimal and reviewable. No broad refactors unless requested. No dependency, CI, or build changes without Ask First approval.
5. **Proposed File List** — Exact files to modify, with a one-line reason for each.
6. **Verification Plan** — Smallest targeted checks first.
7. **Risks and Assumptions** — Key assumptions requiring confirmation; regressions to watch for.
8. **Suggested Commit Message** — Subject and body following the repo commit message policy.

---

## Issue Implementation Workflow

When implementing GitHub issues:

1. Fetch the issue (`gh issue view <number>`).
2. Apply the **Pre-Implementation Issue Gate** (below). Do not implement while triage is unresolved.
3. Implement the change within the approved scope.
4. Apply the **Verification Policy** before committing (see Operating rules).
5. Commit — one issue per commit where possible.
6. Apply the **Post-Implementation Completion Gate** (below).
7. **Split overlapping issues into separate isolated commits.** Use a backup/reset/apply strategy: implement one issue, commit, then layer the next on top. Do not bundle unrelated issue changes into a single commit.

### Pre-Implementation Issue Gate

- For issue work, fetch issue metadata and discussion context before coding: state, labels, and comments.
- For issue work, use **local-first evidence**: rely on repository files plus issue metadata/comments first; do not run web search unless the user explicitly asks or local sources cannot answer a required implementation detail.
- If triage is unresolved (for example, still `needs-triage` or conflicting state labels), stop and resolve triage state first.
- Moving an issue to `ready-for-agent` requires posting the required triage note/agent brief in the issue.
- The agent must not implement while triage is unresolved.
- If acting as a planning/triage agent, produce a handoff prompt only if the user asks; otherwise proceed per the scope-confirmation gate above.
- If acting as the implementation agent on a `ready-for-agent` issue with an Agent Brief, implement directly — no self-preflight, no regenerated handoff.
- This same gate applies to planning sessions that will lead to implementation handoff.

### Post-Implementation Completion Gate

- After commit, post an issue completion comment and close the issue. See [/docs/reference/issue-completion-template.md](/docs/reference/issue-completion-template.md) for the required structure and close checklist.
- Do not end the issue workflow without both the completion comment and completion state update.

---

## Operating rules

> These rules apply to every agent (Codex, Cursor, Claude, Copilot, etc.) working in this repo.

### Verification Policy (Single Source of Truth)

- **Agent runs targeted tests** (`pnpm exec vitest run <path>`) for touched scope before committing.
- **Agent runs lint + typecheck before committing** (`pnpm exec eslint <changed-files>` and `pnpm typecheck`).
- **User runs the full suite** (`pnpm test && pnpm build`) when necessary — never run it automatically.
- **Never commit code that fails typecheck, lint, or targeted tests.**

- **Prefer cheap, fast mechanisms for codebase search and build verification.** Use lightweight tooling (search agents, execution subagents) for discovery and verification. See agent-specific files for the exact tools available in your environment.
- **Confirm verification before drafting the commit message.**

- **Path Discovery Gate.** When path certainty is low, discover first using `rg --files` and `rg -n` before reading guessed paths. Do not burn cycles on avoidable bad-path reads.

- **Read targeted ranges before whole large files.** For files over a few hundred lines, use `rg -n`/grep to locate the relevant region and read only that range (with the read tool's offset/limit). Reserve full-file reads for files you will edit broadly or that are genuinely small. This extends the Path Discovery Gate to read size, not just path certainty.

- **Shell selection (Windows / PowerShell environments).** This repo's primary shell is PowerShell. Default to the PowerShell tool for environment, `git`, `gh`, and package-manager commands; reserve the Bash tool for genuine POSIX scripts. Never mix syntaxes across tools — do not pass PowerShell constructs (`$null`, `2>$null`, `Select-Object`) to Bash, or bash constructs (`2>/dev/null`, backtick command substitution) to PowerShell. A shell/syntax mismatch is an avoidable wasted round trip.

- **Bound sub-agent (scout / Explore) output.** When dispatching search or exploration subagents, state an output budget in the prompt (for example: "≤150 words per file; report only signatures that affect the plan; no full file trees or summary tables"). The subagent's report is paid for in context regardless of how much you use — consume findings to sharpen your own work, do not request exhaustive dumps you will only skim.

- **Dirty Tree Isolation Protocol.** If the worktree already has unrelated modified files, continue with issue/task implementation using explicit path-scoped staging for touched files only. Stop and ask for guidance only when pre-existing changes overlap files in your approved scope or create merge/behavior ambiguity.

- **Commit automatically after every change.** Stage all changes and commit using conventional-commits format (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`) with a body explaining the _why_. Do not use quotation marks in commit messages.
- **When staged, always include generated architecture map artifacts in the same commit.** If `docs/generated/architecture-map.json` and/or `docs/generated/architecture-map.md` are already staged or modified by checks, commit them together with related code changes (do not split into a separate commit).

- **Confirm execution mode for large multi-slice plans.** Plan approval is not automatically approval to implement every slice inline. For plans of several slices, after the first slice (or before starting), confirm whether the user wants continued inline implementation or the remaining slices converted to issues (`to-issues`). Do not read ahead or pull files for later slices until the execution mode is settled — abandoned look-ahead reads are wasted context.

- **MANDATORY — Sliced-work flow.** When a multi-slice plan has been agreed with the user, follow this loop for **every** slice without exception:
  1. Implement the slice.
  2. Run targeted tests and lint + typecheck before committing (see Verification Policy above). User runs the full suite when necessary.
  3. Commit the changes automatically and output the commit message in a fenced code block.
  4. Wait for the user to confirm their manual checks are green before starting the next slice.
  5. If the user reports failures, fix them in the same slice, amend or add a follow-up commit, and re-issue the commit message; do not advance.

- **Never run destructive commands** (`rm -rf`, DB drops, `git push --force`) without explicit user confirmation in the same message.

- **After any change to file structure, dependencies, env vars, or public APIs:** update `/README.md`, `/docs/`, and any affected sub-folder README in the **same commit**.

- **After adding or changing a feature:** update `/docs/changelog.md` with a one-line entry under `Unreleased`.

- **Never put secrets in committed files.** `.env.local` is gitignored; `.env.example` is the source of truth for required vars.

- **Never read from `.env.local`.** Agents must treat `.env.local` as off-limits and use `.env.example`, committed docs, or user-provided values instead.

- **Money is stored and computed as integer minor units (cents).** See [/docs/reference/money.md](/docs/reference/money.md).

- **Never call the Neon database directly from the client.** All DB access goes through the API worker. See [/docs/architecture.md](/docs/architecture.md).

- **Database migrations run with `pnpm migrate` from the repo root.** Migration files live in `/db/migrations/` as SQL.

- **Deploy the API worker with `pnpm --filter ffe-api deploy`.** Do not use raw `wrangler deploy`.

### CLI commands and sandbox fallback

See [/docs/reference/cli-command-reference.md](/docs/reference/cli-command-reference.md) for known-good command templates (search, git, gh, verification) and the sandbox launcher fallback procedure (`CreateProcessAsUserW failed: 1312`).

---

## Code organisation rules

> These rules keep the codebase consistent as it grows. Follow them whenever creating or moving code.

### Types

- **Domain types live in `src/types/`.** If a type describes a data model (project, room, item, image, or any combination like `RoomWithItems`), it belongs in `src/types/`, not inside a component or hook file.
- **Re-export everything from `src/types/index.ts`.** Consumers should be able to import all types from `'../types'` — never from `'../types/room'`, `'../types/item'`, etc., directly.
- **`RoomWithItems` is defined in `src/types/room.ts`** and re-exported from `src/types/index.ts`. Do not re-export it from `FfeTable.tsx` or any other component.

### Hooks

- **Hooks live in `src/hooks/` and are barrel-exported from `src/hooks/index.ts`.** When adding a new hook file, add its exports to `index.ts` in the same commit.
- **Hooks must not import from component files.** A hook can import from `../types`, `../lib/*`, or other hooks. It must never import from `../components/*` — not even for types.

### Components

- **Each component gets its own file.** Do not define a second exported component inside an existing component file (e.g. modals, sub-views). Extract it to `src/components/<ComponentName>.tsx`.
- **Primitives live in `src/components/primitives/` and are barrel-exported from `src/components/primitives/index.ts`.** Generic, reusable UI atoms (Button, Modal, Drawer, etc.) go here; domain-aware components (ProjectHeader, FfeTable, etc.) go directly under `src/components/`.

### Refactoring

- **Verify symbol names before bulk renames.** When using `replace_all` or any bulk rename, confirm the new name is not a substring of other identifiers before applying. After any rename, run a build to confirm nothing broke.

### Constants

- **Shared UI constants live in `src/lib/constants.ts`.** Values used across multiple files (e.g. `BRAND_RGB`) belong here, not hardcoded inline. Import from `'../lib/constants'` or `'./constants'` as appropriate.

### API / monorepo boundary

- **The API worker (`api/`) must never import from `src/`.** The `api/` and `src/` packages are independent — the Worker must be self-contained. If both packages need the same constant (e.g. `itemStatuses`), define it in each package separately and add a comment noting the intentional duplication.
- **The React client (`src/`) must never import from `api/`.** All communication goes through the HTTP API at runtime.

---

## UI / Styling Conventions

- **Tailwind class merging.** The base `Modal` and `cn()` utility may not resolve conflicting utility classes (e.g. two `max-w-*` values). Use tailwind-merge-aware patterns (`twMerge`, `clsx` + `tailwind-merge`) when overriding base styles, and verify the change has a visible effect after applying.

---

## Domain Notes

- **Image columns store content in `imagesByColumn`, not `values`.** When writing data-import or empty-column filter logic, check `imagesByColumn` for image-type columns before treating them as empty — filtering on `values` alone will incorrectly null them out.

---

## Tech stack

Pin these exact versions unless a version bump is explicitly requested.

| Layer             | Technology                                  | Version                              |
| ----------------- | ------------------------------------------- | ------------------------------------ |
| UI framework      | React                                       | 18.x                                 |
| Build tool        | Vite                                        | 5.x                                  |
| Language          | TypeScript                                  | 5.x                                  |
| Package manager   | pnpm                                        | 9.x                                  |
| Runtime (Node)    | Node.js                                     | 20 LTS                               |
| Auth              | Firebase Auth                               | 12.x                                 |
| API runtime       | Cloudflare Workers                          | (wrangler 3.x)                       |
| API framework     | Hono                                        | 4.x                                  |
| Database          | Neon (serverless Postgres)                  | —                                    |
| DB client         | @neondatabase/serverless (hand-written SQL) | —                                    |
| Migration runner  | tsx + @neondatabase/serverless              | —                                    |
| Styling           | Tailwind CSS                                | 3.x                                  |
| Component library | shadcn/ui                                   | latest                               |
| Testing           | Vitest + Testing Library                    | 2.x (Vitest), 16.x (Testing Library) |
| Linting           | ESLint + Prettier                           | —                                    |

> Verify exact versions against `package.json` and `api/package.json` — the table above reflects pinned majors, not patch-level pins.

---

## Definition of done

Every feature is done when **all** of the following are true:

- [ ] **Types updated** — TypeScript interfaces/types reflect the change
- [ ] **Tests added/updated** — unit or integration tests cover the new behavior (skip for style-only changes, copy edits, and config tweaks)
- [ ] **Docs updated** — `/README.md`, `/docs/`, and any sub-folder README updated for user-visible features, API changes, or architectural decisions
- [ ] **TypeScript compiles clean** — agent runs `pnpm typecheck` before commit; user confirms full compile when risk requires it
- [ ] **Lint exits 0** — agent runs `pnpm exec eslint <changed>` before commit; user confirms full lint when risk requires it
- [ ] **Targeted tests green** — agent runs `pnpm exec vitest run <path>` for touched scope before commit
- [ ] **Full suite** — user runs `pnpm test && pnpm build` when risk or scope requires it
- [ ] **Commit message drafted** — conventional-commits format with a body explaining the _why_

---

## Files to read first when picking up work

1. `README.md` — project overview and quick start
2. `AGENTS.md` — **this file** — operating rules for all agents
3. `CONTEXT.md` — canonical product and domain terminology; read before touching any domain-facing code or docs
4. `docs/architecture.md` — system design, diagrams, decision rationale
5. `docs/changelog.md` — read `Unreleased` and the last 1-3 relevant entries; use targeted search for subsystem-specific history

## Scoped subsystem context docs

- `docs/context/plans-context.md` is a deep reference for the Plans workspace only.
- Read it when a task touches plans routes, canvas workflows, plans API/types, or plans-specific UI behavior.
- Do not read it for unrelated Proposal/FF&E/general tasks.
- Update it only when Plans behavior or interface contracts change; skip updates for refactors that do not change behavior/contracts.
- `docs/context/materials-context.md` is a deep reference for the Finish Library/Materials subsystem only.
- Read it when a task touches materials flows, materials API/types, assignment/removal rules, or materials export behavior.
- Do not read it for unrelated Plans/Proposal/FF&E tasks that do not change materials behavior/contracts.
- Update it only when Materials behavior or interface contracts change; skip updates for refactors that do not change behavior/contracts.
