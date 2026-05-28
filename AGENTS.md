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

## Planning Handoff Contract (Required)

When a spec, planning, investigation, or implementation workflow is triggered, the agent must return a structured handoff before implementation begins.

### Required handoff format

1. **Task**
   - One-sentence statement of the requested outcome.

2. **Scope**
   - Editable files as an explicit path list.
   - Out-of-scope areas as explicit exclusions.

3. **Behavior**
   - Expected behavior.
   - Actual/current behavior.
   - Reproduction steps.
   - Relevant error snippet, limited to a small excerpt.

4. **Constraints**
   - Keep changes minimal and reviewable.
   - No broad refactors unless explicitly requested.
   - No dependency, CI, or build changes without Ask First approval.

5. **Proposed File List**
   - Exact files to modify, with a one-line reason for each.

6. **Verification Plan**
   - Smallest targeted checks first.
   - Full-suite verification only when required by risk or requested by the user.

7. **Risks and Assumptions**
   - Key assumptions requiring confirmation.
   - Regressions to watch for.

8. **Suggested Commit Message**
   - Subject and body following the repo commit message policy.

### Enforcement

- The agent must not start implementation until this handoff is provided.
- If the task is large, ambiguous, cross-cutting, changes public APIs, touches data migrations, changes dependencies, or affects CI/build configuration, human approval of the handoff is required before coding.
- If the task is small and the user explicitly asks for direct implementation, the handoff can be concise, but it still must identify scope, files, verification, risks, and the commit message before code changes begin.
- During implementation, stay within the approved file list and scope. If a new file or broader change becomes necessary, stop and ask for approval before continuing.
- If the user provides a completed planning handoff from chat, do not re-plan from scratch. Validate it against the repo, call out any mismatch, and proceed only within the approved scope.

---

## Operating rules

> These rules apply to every agent (Codex, Cursor, Claude, Copilot, etc.) working in this repo.

- **Prefer cheap, fast mechanisms for codebase search and build verification.** Use lightweight tooling (search agents, execution subagents) for discovery and verification. See agent-specific files for the exact tools available in your environment.

- **Confirm verification before drafting the commit message.** For ad-hoc single changes (no approved multi-slice plan), run `pnpm typecheck && pnpm lint && pnpm test && pnpm build` unless the user explicitly says they will run checks manually. For approved planning handoffs, follow the handoff's Verification Plan and the MANDATORY sliced-work rule below: run the smallest targeted checks first, run the full suite only when required by risk or request, and if verification is assigned to the user, do not run those commands yourself; finish the implementation, clearly state that verification is waiting on the user's manual checks, output the conventional-commits message in a fenced code block, and stop.

- **Commit automatically after every change.** Stage all changes and commit using conventional-commits format (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`) with a body explaining the _why_. Do not use quotation marks in commit messages.
- **When staged, always include generated architecture map artifacts in the same commit.** If `docs/generated/architecture-map.json` and/or `docs/generated/architecture-map.md` are already staged or modified by checks, commit them together with related code changes (do not split into a separate commit).

- **MANDATORY — Sliced-work flow.** When a multi-slice plan has been agreed with the user, follow this loop for **every** slice without exception:
  1. Implement the slice.
  2. **Do not run `pnpm test`, `pnpm typecheck`, `pnpm lint`, or `pnpm build` yourself** unless the user explicitly asks. The user runs them manually.
  3. Commit the changes automatically and output the commit message in a fenced code block.
  4. Wait for the user to confirm their manual checks are green before starting the next slice.
  5. If the user reports failures, fix them in the same slice, amend or add a follow-up commit, and re-issue the commit message; do not advance.
     This rule overrides any default urge to chain slices or run verification commands without confirmation.

- **Never run destructive commands** (`rm -rf`, DB drops, `git push --force`) without explicit user confirmation in the same message.

- **After any change to file structure, dependencies, env vars, or public APIs:** update `/README.md`, `/docs/`, and any affected sub-folder README in the **same commit**.

- **After adding or changing a feature:** update `/docs/changelog.md` with a one-line entry under `Unreleased`.

- **Never put secrets in committed files.** `.env.local` is gitignored; `.env.example` is the source of truth for required vars.

- **Never read from `.env.local`.** Agents must treat `.env.local` as off-limits and use `.env.example`, committed docs, or user-provided values instead.

- **Money is stored and computed as integer minor units (cents).** See [/docs/money.md](/docs/money.md).

- **Never call the Neon database directly from the client.** All DB access goes through the API worker. See [/docs/architecture.md](/docs/architecture.md).

- **Database migrations run with `pnpm migrate` from the repo root.** Migration files live in `/db/migrations/` as SQL.

- **Deploy the API worker with `pnpm --filter ffe-api deploy`.** Do not use raw `wrangler deploy`.

### Execution fallback for sandboxed CLI agents

- **Primary mode:** run normal repo commands in the default sandbox first.
- **Known failure signature:** if a command fails before execution with a process-creation/sandbox error (for example `CreateProcessAsUserW failed: 1312`), retry once using an approved escalated execution path.
- **Retry rule:** keep the same command and intent on retry; do not broaden scope during fallback.
- **Safety boundary:** escalation is for reliability, not privilege expansion. Do not escalate destructive commands (`rm -rf`, `git reset --hard`, force-push, DB drops) without explicit same-message user confirmation.
- **Reference-first rule:** before composing new command variants, check `/docs/cli-command-reference.md` for an existing template and use it when applicable.
- **Learning loop rule:** when a reusable command format succeeds after experimentation, add or update its template in `/docs/cli-command-reference.md` (template only; never task-specific arguments, secrets, tokens, IDs, or user data).
- **Quality gate for updates:** only record command formats that are likely to recur; if a similar template already exists, update that entry instead of creating a near-duplicate.

Use these command patterns for common tasks:

- **Fast search/discovery**
  - `rg --files`
  - `rg -n "<pattern>" src docs`
- **Targeted verification**
  - `pnpm exec vitest run <path-to-test>`
  - `pnpm exec eslint <path-to-file>`
- **Full verification**
  - `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
- **Issue triage operations (GitHub)**
  - `gh issue view <number> --json number,title,body,labels,state,author,createdAt,updatedAt,url`
  - `gh issue view <number> --comments`
  - `gh issue edit <number> --add-label <label> --remove-label <label>`
  - `gh issue comment <number> --body-file <file>`

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

### Constants

- **Shared UI constants live in `src/lib/constants.ts`.** Values used across multiple files (e.g. `BRAND_RGB`) belong here, not hardcoded inline. Import from `'../lib/constants'` or `'./constants'` as appropriate.

### API / monorepo boundary

- **The API worker (`api/`) must never import from `src/`.** The `api/` and `src/` packages are independent — the Worker must be self-contained. If both packages need the same constant (e.g. `itemStatuses`), define it in each package separately and add a comment noting the intentional duplication.
- **The React client (`src/`) must never import from `api/`.** All communication goes through the HTTP API at runtime.

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
- [ ] **TypeScript compiles clean** — confirmed by user running `pnpm typecheck`
- [ ] **Lint exits 0** — confirmed by user running `pnpm lint`
- [ ] **All tests green** — confirmed by user running `pnpm test`
- [ ] **Build succeeds** — confirmed by user running `pnpm build`
- [ ] **Commit message drafted** — conventional-commits format with a body explaining the _why_

---

## Files to read first when picking up work

1. `README.md` — project overview and quick start
2. `AGENTS.md` — **this file** — operating rules for all agents
3. `CONTEXT.md` — canonical product and domain terminology; read before touching any domain-facing code or docs
4. `docs/architecture.md` — system design, diagrams, decision rationale
5. `docs/changelog.md` — read `Unreleased` and the last 1-3 relevant entries; use targeted search for subsystem-specific history

## Scoped subsystem context docs

- `docs/plans-context.md` is a deep reference for the Plans workspace only.
- Read it when a task touches plans routes, canvas workflows, plans API/types, or plans-specific UI behavior.
- Do not read it for unrelated Proposal/FF&E/general tasks.
- Update it only when Plans behavior or interface contracts change; skip updates for refactors that do not change behavior/contracts.
