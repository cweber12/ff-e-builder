# Claude — Project Context for FF&E Builder

This project follows the rules in [/AGENTS.md](/AGENTS.md). **Read it before doing anything else.**

---

## Things most likely to bite Claude specifically

1. **DB migrations live in `/db/migrations` — never run from the client.**
   Drizzle migrations are applied via `pnpm db:migrate` inside the API worker context,
   never from browser code or any Vite/React module.

2. **Firebase config is public; the secret is the service account.**
   The `VITE_FIREBASE_*` vars are safe to ship in the client bundle — they are the
   public Firebase web config. The sensitive pieces are `FIREBASE_ADMIN_PROJECT_ID`,
   `FIREBASE_ADMIN_CLIENT_EMAIL`, and `FIREBASE_ADMIN_PRIVATE_KEY`, which live only
   in the Cloudflare Worker's environment. Never expose them client-side.

3. **All DB queries pass through `/api/*` — never import `@neondatabase` in the React app.**
   The Neon driver is a Worker-only dependency. Any attempt to import it in the Vite
   bundle will fail at build time and would expose credentials at runtime.

4. **When asked to "deploy", run the deploy script — do not push directly.**
   Use `pnpm deploy` (which calls `wrangler deploy`). Never use `wrangler deploy`
   directly unless the script is broken and you have confirmed with the user.

5. **Money is always integer cents.** Never use `parseFloat` or `toFixed(2)` on price
   fields. See `/docs/money.md` for the full convention and display helpers.
