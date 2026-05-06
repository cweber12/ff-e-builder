# GitHub Copilot — Project Instructions for FF&E Builder

Authoritative project rules live in [/AGENTS.md](/AGENTS.md). Read that file first.

## Copilot quick constraints

1. **Migrations are SQL-first.** Use `pnpm migrate` from repo root.
2. **Client/API boundary is strict.** Client talks to `/api/v1/*`; no Neon imports in `/src`.
3. **Deploy via script.** Use `pnpm --filter ffe-api deploy`.
4. **Keep secrets server-side.** `FIREBASE_ADMIN_*` never belongs in client code.
5. **Run checks before every commit.** `pnpm typecheck && pnpm lint && pnpm test && pnpm build` must all pass before drafting a commit message.
