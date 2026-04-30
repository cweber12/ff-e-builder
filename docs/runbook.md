# Runbook

Operational procedures for FF&E Builder.

---

## Deploy

### Frontend (GitHub Pages) — automated

Pushing to `main` triggers `.github/workflows/deploy.yml`, which:

1. Runs `pnpm build` (Vite + TypeScript)
2. Uploads `dist/` as a GitHub Pages artifact
3. Deploys via `actions/deploy-pages@v4`

The `public/404.html` SPA redirect script is included in the build automatically.
No manual steps are needed for the frontend.

Required GitHub Actions secrets for the production frontend build:

```text
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_APP_ID
VITE_API_BASE_URL
```

These `VITE_` values are public client configuration, but GitHub Actions still
requires them to be mapped explicitly into the build step environment.

### API Worker (Cloudflare)

```bash
cd api
pnpm deploy          # runs: wrangler deploy
```

Prerequisites before first deploy:

1. Worker secrets must be set (see **Set Worker secrets** below).
2. Run the initial DB migration against the production Neon branch (see **Run a migration**).
3. The Cloudflare account must have the Worker created (`wrangler deploy` creates it on first run).

---

## Rollback

### Frontend rollback

Revert the merge commit on `main` — this re-triggers `deploy.yml` and redeploys
the previous build automatically:

```bash
git revert -m 1 <merge-commit-sha>
git push origin main
```

Alternatively, open **Settings → Pages → Deployments** in GitHub and redeploy
an earlier artifact.

### API Worker rollback

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

## Set Worker secrets

Secrets are **never** committed to the repo. Set them once via Wrangler:

```bash
cd api
wrangler secret put NEON_DATABASE_URL
# paste the Neon connection string when prompted

wrangler secret put FIREBASE_ADMIN_CLIENT_EMAIL
# paste the service account client_email

wrangler secret put FIREBASE_ADMIN_PRIVATE_KEY
# paste the full PEM private key (including -----BEGIN/END----- lines)
# Wrangler stores \n as literal \\n; the Worker decodes it on startup.
```

Verify secrets are set:

```bash
wrangler secret list
```

---

## Run a DB migration

### Locally

```bash
# Load your Neon connection string (never commit .env.local)
source .env.local   # or: dotenv -e .env.local -- pnpm migrate

pnpm migrate
# Applies any .sql files in /db/migrations/ not yet in the _migrations table.
```

### In CI / on deploy

1. Set `NEON_DATABASE_URL` as a GitHub Actions secret.
2. Add a migration step to the deploy workflow **before** `wrangler deploy`:

```yaml
- name: Run DB migrations
  run: pnpm migrate
  env:
    NEON_DATABASE_URL: ${{ secrets.NEON_DATABASE_URL }}
```

### Adding a new migration

1. Create `db/migrations/<NNNN>_<description>.sql` (next sequential number).
2. Write idempotent SQL (`IF NOT EXISTS`, `CREATE OR REPLACE`, etc.).
3. Test locally: `pnpm migrate`.
4. Commit the file; it will be applied on the next CI deploy run.

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
