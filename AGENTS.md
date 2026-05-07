# FF&E Builder — Agent Rules

## Project

**FF&E Builder** is a web application for interior designers and procurement teams to manage Furniture, Fixtures & Equipment (FF&E) specifications across projects. Users organize items into rooms, attach vendor and pricing data, and export specification sheets. The React + Vite front-end authenticates with Firebase Auth, then calls a Cloudflare Workers API that is the sole gateway to a Neon (serverless Postgres) database. See [/docs/architecture.md](/docs/architecture.md) for the full system design.

---

## Operating rules

> These rules apply to every agent (Codex, Cursor, Claude, Copilot, etc.) working in this repo.

- **Never commit automatically.** After every change, output the commit message in conventional-commits format (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`) with a body explaining the _why_. Do not run `pnpm typecheck`, `pnpm lint`, `pnpm test`, or `pnpm build` — provide the check command as a prompt for the user or a delegated model to run, then wait for any errors to be reported before proceeding.

- **Never run destructive commands** (`rm -rf`, DB drops, `git push --force`) without explicit user confirmation in the same message.

- **After any change to file structure, dependencies, env vars, or public APIs:** update `/README.md`, `/docs/`, and any affected sub-folder README in the **same commit**.

- **After adding or changing a feature:** update `/docs/changelog.md` with a one-line entry under `Unreleased`.

- **Never put secrets in committed files.** `.env.local` is gitignored; `.env.example` is the source of truth for required vars.

- **Never read from `.env.local`.** Agents must treat `.env.local` as off-limits and use `.env.example`, committed docs, or user-provided values instead.

- **Money is stored and computed as integer minor units (cents).** See [/docs/money.md](/docs/money.md).

- **Never call the Neon database directly from the client.** All DB access goes through the API worker. See [/docs/architecture.md](/docs/architecture.md).

---

## Code organisation rules

> These rules keep the codebase consistent as it grows. Follow them whenever creating or moving code.

### Types

- **Domain types live in `src/types/`.** If a type describes a data model (project, room, item, image, or any combination like `RoomWithItems`), it belongs in `src/types/`, not inside a component or hook file.
- **Re-export everything from `src/types/index.ts`.** Consumers should be able to import all types from `'../types'` — never from `'../types/room'`, `'../types/item'`, etc., directly.
- **`RoomWithItems` is defined in `src/types/room.ts`** and re-exported from `src/types/index.ts`. Do not re-export it from `ItemsTable.tsx` or any other component.

### Hooks

- **Hooks live in `src/hooks/` and are barrel-exported from `src/hooks/index.ts`.** When adding a new hook file, add its exports to `index.ts` in the same commit.
- **Hooks must not import from component files.** A hook can import from `../types`, `../lib/*`, or other hooks. It must never import from `../components/*` — not even for types.

### Components

- **Each component gets its own file.** Do not define a second exported component inside an existing component file (e.g. modals, sub-views). Extract it to `src/components/<ComponentName>.tsx`.
- **Primitives live in `src/components/primitives/` and are barrel-exported from `src/components/primitives/index.ts`.** Generic, reusable UI atoms (Button, Modal, Drawer, etc.) go here; domain-aware components (ProjectHeader, ItemsTable, etc.) go directly under `src/components/`.

### Constants

- **Shared UI constants live in `src/lib/constants.ts`.** Values used across multiple files (e.g. `BRAND_RGB`) belong here, not hardcoded inline. Import from `'../lib/constants'` or `'./constants'` as appropriate.

### API / monorepo boundary

- **The API worker (`api/`) must never import from `src/`.** The `api/` and `src/` packages are independent — the Worker must be self-contained. If both packages need the same constant (e.g. `itemStatuses`), define it in each package separately and add a comment noting the intentional duplication.
- **The React client (`src/`) must never import from `api/`.** All communication goes through the HTTP API at runtime.

---

## Tech stack

Pin these exact versions unless a version bump is explicitly requested.

| Layer               | Technology                     | Version        |
| ------------------- | ------------------------------ | -------------- |
| UI framework        | React                          | 18.x           |
| Build tool          | Vite                           | 5.x            |
| Language            | TypeScript                     | 5.x            |
| Package manager     | pnpm                           | 9.x            |
| Runtime (Node)      | Node.js                        | 20 LTS         |
| Auth                | Firebase Auth                  | 10.x           |
| API runtime         | Cloudflare Workers             | (wrangler 3.x) |
| API framework       | Hono                           | 4.x            |
| Database            | Neon (serverless Postgres)     | —              |
| ORM / query builder | Drizzle ORM                    | 0.30.x         |
| Migration runner    | tsx + @neondatabase/serverless | —              |
| Styling             | Tailwind CSS                   | 3.x            |
| Component library   | shadcn/ui                      | latest         |
| Testing             | Vitest + Testing Library       | 2.x            |
| Linting             | ESLint + Prettier              | —              |

---

## Definition of done

Every feature is done when **all** of the following are true:

- [ ] **Types updated** — TypeScript interfaces/types reflect the change
- [ ] **Tests added/updated** — unit or integration tests cover the new behavior
- [ ] **Docs updated** — `/README.md`, `/docs/`, and any sub-folder README touched if relevant
- [ ] **`pnpm typecheck` passes** — no TypeScript errors
- [ ] **`pnpm lint` passes** — exits 0
- [ ] **`pnpm test` passes** — all tests green
- [ ] **`pnpm build` passes** — exits 0
- [ ] **Commit message drafted** — conventional-commits format with a body explaining the _why_

> Provide the check command `pnpm typecheck && pnpm lint && pnpm test && pnpm build` as a prompt for the user or a delegated lighter model to run. Do not execute it yourself. Only draft the commit message after the user confirms all four pass.

---

## Files to read first when picking up work

1. `README.md` — project overview and quick start
2. `AGENTS.md` — **this file** — operating rules for all agents
3. `docs/architecture.md` — system design, diagrams, decision rationale
4. `docs/changelog.md` — what has changed recently and what is in flight
