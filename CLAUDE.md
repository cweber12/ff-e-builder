# Claude — Project Context for ChillDesignStudio

Authoritative rules live in [/AGENTS.md](/AGENTS.md). Follow that file first.

## Claude-specific additions

These items are not in AGENTS.md and apply only to Claude:

1. **Migrations are SQL files in `/db/migrations`.** Run from repo root with `pnpm migrate`.
2. **DB access is API-only.** Client calls `/api/v1/*`; never import `@neondatabase` in `/src`.
3. **Deploy via workspace script.** Use `pnpm --filter ffe-api deploy`, not raw `wrangler deploy`.
4. **Firebase secrets stay Worker-only.** `FIREBASE_ADMIN_*` never belongs in React code.
