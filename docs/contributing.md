# Contributing

## Branching strategy

| Branch         | Purpose                                       |
| -------------- | --------------------------------------------- |
| `main`         | Production-ready code; protected, requires PR |
| `dev`          | Integration branch for feature branches       |
| `feat/<slug>`  | New features                                  |
| `fix/<slug>`   | Bug fixes                                     |
| `chore/<slug>` | Tooling, deps, config                         |
| `docs/<slug>`  | Documentation-only changes                    |

All work branches off `dev`. PRs target `dev`. `dev` is merged to `main` for releases.

---

## Pull request conventions

- Title follows conventional commits: `feat: add room reorder endpoint`
- Body must include:
  - What changed and why
  - How to test locally
  - Checklist: types ✓, tests ✓, docs ✓, lint ✓, build ✓
- At least one reviewer approval required before merge
- Squash-merge to `dev`; no merge commits

---

## Commit format (Conventional Commits)

```
<type>(<scope>): <short summary>

<body — explain the WHY, not just the what>

<optional footer: BREAKING CHANGE or closes #issue>
```

**Types:** `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`, `ci`

**Examples:**

```
feat(items): add unit_price_cents field to items table

Designers need to record vendor pricing per item so the app can
compute room and project totals. Stored as integer cents per
/docs/money.md convention.

Closes #12
```

```
fix(auth): handle token expiry on API 401 responses

Firebase tokens expire after 1 hour. Without a refresh the user
would see a blank error. Now the API client catches 401, calls
getIdToken(true) to force-refresh, and retries once.
```

---

## How to add a migration

1. Create `db/migrations/<NNNN>_<description>.sql` using the next sequential number.
2. Write explicit SQL for the schema/data change (`IF NOT EXISTS` / `CREATE OR REPLACE` where appropriate).
3. Set `NEON_DATABASE_URL` in your shell.
4. Run `pnpm migrate` from the repo root.
5. Verify the app/API behavior that depends on the migration.
6. Commit the new migration file in the same PR as the related code changes.

---

## How to add an Architecture Decision Record (ADR)

1. Copy `docs/adr/template.md` to `docs/adr/<NNNN>-<slug>.md` where `NNNN` is the
   next sequential number.
2. Fill in all sections.
3. Add a row to the decisions table in `docs/architecture.md`.
4. Commit with `docs(adr): add ADR-NNNN <title>`.
