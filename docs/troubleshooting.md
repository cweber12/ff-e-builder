# Troubleshooting

## GitHub Pages shows a blank page or bundle 404

Hard refresh the page. The build emits stable `assets/index.js` plus a
compatibility copy for the known stale bundle name. If a new missing bundle name
appears, inspect the deployed `index.html` and add a temporary compatibility
copy in `vite.config.ts`.

## Firebase `auth/unauthorized-domain`

Add the deployed host in Firebase Console:

1. Authentication -> Settings -> Authorized domains.
2. Add `cweber12.github.io`.
3. Re-test Google sign-in.

## CORS errors from the API

Confirm the Worker CORS origin includes:

```text
https://cweber12.github.io
```

Then redeploy:

```bash
cd api
wrangler deploy
```

## Expired or missing token

Sign out and sign in again. If API calls still fail, verify the frontend is
sending an `Authorization: Bearer <token>` header and the Worker
`FIREBASE_PROJECT_ID` matches the Firebase project used by the frontend.

## Migration errors

Run migrations from the repo root with `NEON_DATABASE_URL` set:

```bash
pnpm migrate
```

If Neon reports that multiple commands cannot be inserted into a prepared
statement, make sure the migration runner is using the Neon `Pool` query path,
not prepared single-statement execution.

If image uploads fail after a deploy, confirm the latest image migration has
been applied. Stale `image_assets` indexes can block valid Proposal Rendering
or Project Image inserts and surface as server-side upload failures.
