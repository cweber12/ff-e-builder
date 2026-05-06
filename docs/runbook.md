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

The Vite build uses stable asset filenames for GitHub Pages. This avoids blank
screens caused by browsers requesting an older hashed bundle name after a fresh
deploy.

The build also writes a compatibility copy at
`dist/assets/index-BD_UO_br.js`. This covers the known stale bundle requested by
previously cached `index.html` files. After this release has aged out of browser
caches, the copy can be removed in a maintenance cleanup.

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

Firebase Authentication must also be configured for the deployed frontend:

1. Open Firebase Console -> Authentication -> Settings -> Authorized domains.
2. Add the deployed GitHub Pages host, for example `cweber12.github.io`.
3. Add any custom production domain used for the app.
4. Open Authentication -> Sign-in method and enable both Google and Email/Password providers.

If the deployed app logs `auth/unauthorized-domain`, the current browser host is
missing from Firebase Authorized domains.

### Catalog print checks

The catalog route is `/projects/:id/ffe/catalog`. It uses regular browser printing,
not a print library. Validate the print path before a release:

1. Open the catalog in Chrome.
2. Click **Print / Save as PDF**.
3. Confirm the preview shows one A4 page per item with no navigation chrome.
4. Repeat in Safari when available. Safari may be stricter about page-break
   placement; if an item bleeds into the next page, check that `.catalog-page`
   still has `break-after: page` and `@page { size: A4; margin: 0; }`.

### Final 1.0.0 launch steps

1. Configure Firebase Authentication:
   - Authorized domains: `cweber12.github.io`
   - Sign-in providers: Google enabled
   - Email/password disabled for the 1-user-tier launch
2. Configure Worker CORS origin to `https://cweber12.github.io`.
3. Set Worker secrets:
   ```bash
   cd api
   wrangler secret put NEON_DATABASE_URL
   wrangler secret put FIREBASE_ADMIN_CLIENT_EMAIL
   wrangler secret put FIREBASE_ADMIN_PRIVATE_KEY
   ```
4. Apply migrations from the repo root:
   ```bash
   pnpm migrate
   ```
5. Deploy the Worker:
   ```bash
   pnpm --filter ffe-api deploy
   ```
6. Push to `main`; GitHub Actions deploys the frontend to Pages.

Smoke checklist:

1. Open the GitHub Pages URL.
2. Sign in with Google.
3. Create a project.
4. Edit the project budget.
5. Add a room.
6. Add an item.
7. Edit item quantity, unit cost, and markup.
8. Change item status.
9. Export CSV.
10. Open catalog and print/save as PDF.

### API Worker (Cloudflare)

```bash
pnpm --filter ffe-api deploy
```

Prerequisites before first deploy:

1. Worker secrets must be set (see **Set Worker secrets** below).
2. Run the initial DB migration against the production Neon branch (see **Run a migration**).
3. The Cloudflare account must have the Worker created (the deploy script creates it on first run).

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
# Set NEON_DATABASE_URL in your shell (do not commit secrets)
# PowerShell:
#   $env:NEON_DATABASE_URL="postgres://..."
# Bash:
#   export NEON_DATABASE_URL="postgres://..."
pnpm migrate
# Applies any .sql files in /db/migrations/ not yet in the _migrations table.
```

### In CI / on deploy

1. Set `NEON_DATABASE_URL` as a GitHub Actions secret.
2. Add a migration step to the deploy workflow before the API deploy step:

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
6. Redeploy (`pnpm --filter ffe-api deploy`) so the Worker picks up the new secrets.
7. **Delete the downloaded JSON file** — never commit it.
