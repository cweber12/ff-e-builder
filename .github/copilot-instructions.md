# GitHub Copilot — Project Instructions for FF&E Builder

This project follows [/AGENTS.md](/AGENTS.md). Read it before making any suggestion or change.

---

## Key constraints

1. **DB migrations live in `/db/migrations` — never run from the client.**
   Apply migrations via `pnpm db:migrate` in the Worker context only.

2. **Firebase config is public; the service account is secret.**
   `VITE_FIREBASE_*` vars are safe in the client bundle. `FIREBASE_ADMIN_*` vars belong
   only in the Cloudflare Worker environment — never suggest importing them in React code.

3. **All DB queries pass through `/api/*` — never import `@neondatabase` in the React app.**
   The Neon driver is Worker-only. Do not suggest Neon imports in `/src`.

4. **When asked to "deploy", run `pnpm deploy` — do not push directly.**
   This invokes `wrangler deploy` with the correct environment bindings.

5. **Money is always integer cents.** Do not use floats for price fields.
   See `/docs/money.md`.
