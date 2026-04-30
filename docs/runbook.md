# Runbook

Operational procedures for FF&E Builder.

---

## Deploy

```bash
pnpm deploy
# Runs: wrangler deploy (api/) + vite build + upload to Pages
```

- All environment variables must be set in the Cloudflare dashboard (Worker env) and
  in the repo's CI secrets before deploying.
- Worker secrets are managed via `wrangler secret put <VAR_NAME>` — never committed.

---

## Rollback

1. Open the Cloudflare dashboard → Workers → `ffe-api` → Deployments.
2. Find the previous stable deployment and click **Rollback to this deployment**.
3. If the rollback is DB-related, first check whether any migrations need to be
   reversed (Drizzle does not auto-generate down migrations; write one manually in
   `/db/migrations/`).

---

## Read logs

```bash
wrangler tail ffe-api          # live tail of Worker logs
wrangler tail ffe-api --format pretty  # human-readable
```

For historic logs, use the Cloudflare dashboard → Workers Analytics or Logpush.

---

## Rotate Firebase service account

1. Open Firebase console → Project settings → Service accounts.
2. Click **Generate new private key** and download the JSON.
3. Extract `client_email` and `private_key` from the JSON file.
4. Update Cloudflare Worker secrets:
   ```bash
   wrangler secret put FIREBASE_ADMIN_CLIENT_EMAIL
   wrangler secret put FIREBASE_ADMIN_PRIVATE_KEY
   ```
5. Delete the old key in the Firebase console.
6. Redeploy (`pnpm deploy`) so the Worker picks up the new secrets.
7. **Delete the downloaded JSON file** — never commit it.

---

## Run a DB migration

```bash
pnpm db:generate   # generate SQL from schema changes (Drizzle Kit)
pnpm db:migrate    # apply pending migrations against NEON_DATABASE_URL
```

- `NEON_DATABASE_URL` must be set in your local `.env.local` (for dev) or in the
  Worker environment (for production).
- Migrations are applied once; they are not idempotent unless written that way.
- Always review generated SQL in `/db/migrations/` before running against production.
- Never apply migrations from the client (React/Vite) side.

---

## Check migration status

```bash
pnpm db:studio     # opens Drizzle Studio at http://localhost:4983
```
