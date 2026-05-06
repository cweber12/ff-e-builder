# Claude — Project Context for FF&E Builder

Authoritative rules live in [/AGENTS.md](/AGENTS.md). Follow that file first.

## Claude-specific quick guardrails

1. **Migrations are SQL files in `/db/migrations`.** Run from repo root with `pnpm migrate`.
2. **DB access is API-only.** Client calls `/api/v1/*`; never import `@neondatabase` in `/src`.
3. **Deploy via workspace script.** Use `pnpm --filter ffe-api deploy`, not raw `wrangler deploy`.
4. **Firebase secrets stay Worker-only.** `FIREBASE_ADMIN_*` never belongs in React code.
5. **Run checks before every commit.** `pnpm typecheck && pnpm lint && pnpm test && pnpm build` must all pass before drafting a commit message.
