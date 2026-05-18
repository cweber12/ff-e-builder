# Scout Agent Instructions: Repo Grep for Schema / Type Drift

## Role

You are a scout agent. Your job is to inspect the repository and produce an evidence-based report. Do **not** modify source files, migrations, types, or tests unless explicitly instructed in a later task.

Your output should help a follow-up implementation agent understand where the database schema, TypeScript types, Zod schemas, route logic, and frontend usage are drifting apart.

## Required output location

Generate your final report as a markdown file in:

```text
docs/generated/schema-type-drift-grep-report.md
```

If `docs/generated` does not exist, create it.

Do not place the final report only in chat. The report must be written to the file above.

## Goal

Compare the current database schema/migrations against the app’s TypeScript types, Zod schemas, route handlers, helpers, and UI usage.

Identify:

1. Columns/types used by code but missing from the database.
2. Database columns/tables/indexes that appear unused or stale.
3. TypeScript interfaces or Zod schemas that are missing fields returned by the database.
4. Route/helper logic that depends on schema assumptions not reflected in migrations.
5. Tables or columns that might be safe to drop, but only if there is strong evidence.

## Recommended tools

Use `ripgrep` / `rg` as the main tool. It is the fastest and clearest tool for this task.

Optional supporting tools:

- `ast-grep` for syntax-aware TypeScript searches when text grep is too noisy.
- `knip` for general unused files/exports/dependencies, but **do not** treat Knip as proof that database tables or columns are safe to drop.

## Suggested command pack

Run these from the repo root and include meaningful results in the report.

```bash
# Core suspected schema drift
rg -n "proposal_items|item_name|is_ffe_visible|custom_data|table_type|last_revision_major" .

# Revision workflow
rg -n "proposal_revisions|proposal_revision_snapshots|revision_major|revision_minor|closed_at|openRevision|findOpenRevision|bakeApprovedRevision" .

# Image constraints / primary image behavior
rg -n "image_assets|is_primary|proposal_swatch|item_option|entity_type|r2_key" .

# Material join tables
rg -n "item_materials|proposal_item_materials|material_id" .

# Possible stale columns
rg -n "cost_update_deferred|related_change_id" .

# SQL write/read paths
rg -n "INSERT INTO|UPDATE|DELETE FROM|SELECT \*|SELECT .* FROM" api/src migrations

# Type/schema definitions
rg -n "interface |type |Schema|z\." api/src
```

If the repo uses a different migrations directory name, search for it:

```bash
find . -maxdepth 4 -type f \( -name "*.sql" -o -name "*.ts" \) | rg "migration|schema|db|sql"
```

## Specific suspected drift to investigate first

Search the entire repo for these terms and report all meaningful hits:

- `proposal_items`
- `proposal_items.item_name`
- `item_name`
- `is_ffe_visible`
- `rooms.is_ffe_visible`
- `items.is_ffe_visible`
- `item_column_defs`
- `table_type`
- `custom_data`
- `proposal_items.custom_data`
- `cost_update_deferred`
- `related_change_id`
- `proposal_revisions`
- `proposal_revision_snapshots`
- `last_revision_major`
- `image_assets`
- `is_primary`
- `proposal_swatch`
- `item_option`
- `proposal_item_generated_item_links`
- `proposal_item_changelog`
- `item_materials`
- `proposal_item_materials`

Also inspect:

- all migration files
- `api/src/types.ts`
- all route files under `api/src/routes`
- helper/lib files under `api/src/lib`
- frontend API client/types/hooks that consume API response shapes

## Questions to answer

### 1. Missing DB columns

For each suspected missing DB column, answer:

- Is this column referenced by app code?
- Is it present in the latest database schema/migrations?
- Is it inserted, updated, selected, filtered, or only typed?
- Would missing this column cause runtime failure?
- What exact migration would likely fix it?

Pay special attention to:

- `proposal_items.item_name`
- `rooms.is_ffe_visible`
- `items.is_ffe_visible`

### 2. Missing TypeScript/interface fields

Find DB columns returned by `SELECT *` or route responses that are missing from TypeScript interfaces.

Pay special attention to:

- `Project.last_revision_major`
- `Room.is_ffe_visible`
- `Item.is_ffe_visible`
- `ItemColumnDef.table_type`
- `ProposalItem.custom_data`
- any proposal revision fields returned from endpoints but not typed

### 3. Zod/schema drift

Compare create/update Zod schemas against DB columns and route update logic.

For each schema, report:

- fields accepted by Zod but not present in DB
- DB-required fields missing from Zod/default handling
- fields accepted by Zod but ignored by route logic
- fields route logic updates but Zod does not accept

### 4. Revision workflow schema check

Inspect the revision-related code and migrations.

Report whether the database supports:

- multiple revisions per project
- exactly one open revision per project
- composite uniqueness on `(project_id, revision_major, revision_minor)`
- closing/opening revision rounds
- baking approved revisions back into baseline proposal items

Check whether any unique indexes accidentally prevent multiple revision rows for the same project.

### 5. Image schema/index check

Inspect image upload/list/delete logic and image-related migrations/indexes.

Report whether indexes/constraints allow the intended behavior:

- up to 3 project images
- one primary project image
- one rendering per FF&E/proposal row, if intended
- one plan image per row, if intended
- multiple proposal swatches, if intended
- multiple item options, if intended
- one primary among multiple swatches/options, if intended

Look specifically for unique indexes that should be partial with `WHERE is_primary = true`.

### 6. Drop candidates

Identify any tables or columns that appear unused.

Do **not** recommend dropping based on absence from `types.ts` alone. A table may still be needed as a join table, audit table, migration table, or helper-only table.

For every drop candidate, include:

- grep evidence showing no meaningful references
- whether it appears in migrations only
- whether frontend uses it indirectly through API responses
- whether it may be reserved for future workflow
- risk level: low / medium / high
- recommendation: keep / rename / deprecate / drop later / safe to drop

## Required report format

Write the report to:

```text
docs/generated/schema-type-drift-grep-report.md
```

Use this structure:

```md
# Repo Grep Report: Schema / Type Drift

## Executive Summary

- 3–8 bullets summarizing the most important findings.
- Clearly separate confirmed runtime risks from cleanup-only issues.

## Confirmed Runtime Risks

| Issue | Evidence | Why it matters | Recommended fix |
| ----- | -------- | -------------- | --------------- |

## TypeScript / Zod Drift

| Field/Table | DB status | Type/Zod status | Code usage | Recommendation |
| ----------- | --------- | --------------- | ---------- | -------------- |

## Migration / Schema Drift

| Object | Current schema behavior | Code expects | Recommendation |
| ------ | ----------------------- | ------------ | -------------- |

## Revision Workflow Findings

Include exact file paths, line numbers, and snippets.

## Image Asset / Index Findings

Include exact file paths, line numbers, and snippets.

## Possible Drop Candidates

| Table/Column | Evidence for unused | Risk | Recommendation |
| ------------ | ------------------- | ---- | -------------- |

## Grep Evidence

For each important term, include:

- command used
- files matched
- relevant line numbers
- 1–3 line snippet per meaningful hit

## Unknowns / Needs Human Decision

List anything that could not be determined from grep alone.
```

## Evidence requirements

For every claim, include:

- file path
- line number
- short snippet
- usage type: read, write, select, insert, update, delete, route response, migration definition, type-only, schema-only, frontend consumption

Good example:

```md
### `proposal_items.item_name`

Evidence:

- `api/src/routes/proposal.ts:214`
  - `item_name = COALESCE(${d.item_name ?? null}, item_name)`
  - Usage: UPDATE/write path
- `api/src/types.ts:87`
  - `item_name: string;`
  - Usage: Type/interface
- `migrations/xxxx.sql`
  - no `item_name` column found in `proposal_items`
  - Usage: schema missing

Conclusion: confirmed runtime risk if PATCH includes `item_name`.
```

## How to classify findings

Use these labels:

### Confirmed runtime risk

Use when code clearly reads/writes a DB object that does not exist, or when a database constraint/index clearly blocks intended route behavior.

### Likely drift

Use when type/schema/route behavior appears inconsistent, but runtime impact depends on path coverage or frontend usage.

### Cleanup candidate

Use when a DB object appears unused but does not cause immediate runtime issues.

### Keep / supporting table

Use when a table is not directly typed but is clearly used as a join table, audit table, migration table, generated-link table, or revision/history table.

## Constraints

- Do not edit source files.
- Do not apply migrations.
- Do not propose broad refactors.
- Do not assume a table is unused just because it is not a top-level TypeScript interface.
- Prefer exact evidence over interpretation.
- If uncertain, say what grep could not prove.
- Keep recommendations practical and migration-focused.

## Final response after writing the file

After creating `docs/generated/schema-type-drift-grep-report.md`, respond with a short summary containing:

1. Where the report was saved.
2. The top 3 confirmed findings.
3. Any commands that failed or could not be run.
4. Any areas that need a human decision.

```

```
