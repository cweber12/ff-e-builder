# FF&E Builder — Agent Rules

## Project

**FF&E Builder** is a web application for interior designers and procurement teams to manage Furniture, Fixtures & Equipment (FF&E) specifications across projects. Users organize items into rooms, attach vendor and pricing data, and export specification sheets. The React + Vite front-end authenticates with Firebase Auth, then calls a Cloudflare Workers API that is the sole gateway to a Neon (serverless Postgres) database. See [/docs/architecture.md](/docs/architecture.md) for the full system design.

---

## Operating rules

> These rules apply to every agent (Codex, Cursor, Claude, Copilot, etc.) working in this repo.

- **Never commit automatically.** After every change, output a commit message in conventional-commits format (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`) with a body explaining the _why_.

- **Never run destructive commands** (`rm -rf`, DB drops, `git push --force`) without explicit user confirmation in the same message.

- **After any change to file structure, dependencies, env vars, or public APIs:** update `/README.md`, `/docs/`, and any affected sub-folder README in the **same commit**.

- **After adding or changing a feature:** update `/docs/changelog.md` with a one-line entry under `Unreleased`.

- **Never put secrets in committed files.** `.env.local` is gitignored; `.env.example` is the source of truth for required vars.

- **Money is stored and computed as integer minor units (cents).** See [/docs/money.md](/docs/money.md).

- **Never call the Neon database directly from the client.** All DB access goes through the API worker. See [/docs/architecture.md](/docs/architecture.md).

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
- [ ] **Lint passes** — `pnpm lint` exits 0
- [ ] **Build passes** — `pnpm build` exits 0
- [ ] **Commit message drafted** — conventional-commits format with a body explaining the _why_

---

## Files to read first when picking up work

1. `README.md` — project overview and quick start
2. `AGENTS.md` — **this file** — operating rules for all agents
3. `docs/architecture.md` — system design, diagrams, decision rationale
4. `docs/changelog.md` — what has changed recently and what is in flight
