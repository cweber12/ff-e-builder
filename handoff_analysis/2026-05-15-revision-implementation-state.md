# Revision Round Implementation — Current State

**Date:** 2026-05-15  
**Purpose:** Grill session context for Claude Opus 4.7. Covers the complete revision flow as-built, known gaps, and the goals the implementation is aiming to achieve.

---

## 1. What a Revision Round Is (Domain Model)

A **Revision Round** is a numbered snapshot of a proposal's pricing at the moment a tracked field change is confirmed. Rounds are numbered `MAJOR.MINOR`:

- **MAJOR** increments once per acceptance cycle — after a proposal reaches `approved`, the next round in the new cycle is `2.1`, `3.1`, etc.
- **MINOR** increments within a cycle for each sub-round — `1.1`, `1.2`, `1.3`, then `2.1`, etc.

When a round is **open**, the proposal status is `in_progress`. When the PM advances to `pricing_complete` or beyond, the round **closes** automatically. On `approved`, the snapshot values are **baked** into `proposal_items` as the new source of truth and `last_revision_major` is bumped on the project row. Historical rounds are **preserved** (never deleted) for audit.

**Price-Affecting Columns:** Currently every confirmed change is treated as price-affecting (any column, when confirmed via the modal). Only `quantity` and `unit_cost_cents` are locked in `proposal_items` during a revision — all other fields write through freely but still flag the snapshot.

---

## 2. Database Schema

### `proposal_revisions`

```sql
id                  uuid  PK
project_id          uuid  FK → projects
revision_major      int
revision_minor      int
triggered_at_status text  CHECK IN ('pricing_complete','submitted','approved')
opened_at           timestamptz  DEFAULT now()
closed_at           timestamptz  NULL
UNIQUE (project_id, revision_major, revision_minor)
-- partial unique index: at most one open revision per project
UNIQUE INDEX WHERE closed_at IS NULL
```

### `proposal_revision_snapshots`

```sql
revision_id     uuid  FK → proposal_revisions  (CASCADE DELETE)
item_id         uuid  FK → proposal_items       (CASCADE DELETE)
quantity        numeric  NULL
unit_cost_cents int      NULL
cost_status     text  DEFAULT 'none'
                      CHECK IN ('none','flagged','resolved')
PRIMARY KEY (revision_id, item_id)
```

`cost_status` meanings:

- `none` — item untouched in this round
- `flagged` — PM must review the unit cost before advancing
- `resolved` — PM has entered (or auto-confirmed) the unit cost

### `proposal_item_changelog`

```sql
id                uuid  PK
proposal_item_id  uuid  FK → proposal_items (CASCADE DELETE)
column_key        text
previous_value    text
new_value         text
notes             text  NULL
proposal_status   text  CHECK IN ('in_progress','pricing_complete','submitted','approved')
related_change_id uuid  NULL  (unused currently)
revision_id       uuid  NULL  FK → proposal_revisions (SET NULL on delete)
is_price_affecting boolean  NOT NULL  DEFAULT false
changed_at        timestamptz  DEFAULT now()
```

### `projects` (relevant columns)

```sql
proposal_status        text  DEFAULT 'in_progress'
last_revision_major    int   DEFAULT 0
```

---

## 3. API — Server-Side Revision Logic

### `api/src/lib/revisions.ts`

**`isPriceAffectingColumn()`**  
Returns `true` always. Every confirmed change is treated as price-affecting at this stage.

**`findOpenRevision(sql, projectId)`**  
Returns the one open revision (if any) for the project. Enforced unique by partial index.

**`nextRevisionNumber(sql, projectId)`**

- Reads `last_revision_major` from `projects`
- `currentMajor = last_revision_major + 1` — this isolates the current cycle
- Queries `proposal_revisions WHERE revision_major = currentMajor` for the highest existing minor
- Returns `{ major: currentMajor, minor: highestMinor + 1 }` (or `minor: 1` if none)

**`openRevision(sql, projectId, triggeredAtStatus)`**

1. Calls `nextRevisionNumber` → inserts into `proposal_revisions`
2. Snapshots ALL items: `INSERT INTO proposal_revision_snapshots SELECT pi.id, pi.quantity, pi.unit_cost_cents, 'none' FROM proposal_items ...`
3. Folds orphan changelog entries (`revision_id IS NULL`) into the new revision
4. Sets `proposal_status = 'in_progress'` on the project
5. Returns the new revision row

**`closeOpenRevision(sql, projectId)`**  
Sets `closed_at = NOW()` on any open revision for the project.

**`bakeApprovedRevision(sql, projectId)`**

1. Finds the latest revision (`ORDER BY revision_major DESC, revision_minor DESC LIMIT 1`)
2. `UPDATE proposal_items SET quantity = COALESCE(s.quantity, pi.quantity), unit_cost_cents = COALESCE(s.unit_cost_cents, pi.unit_cost_cents)` from snapshot
3. Updates `last_revision_major` on the project
4. Does **NOT** delete revision rows or changelog — history is preserved

---

### `api/src/routes/proposal.ts` — `PATCH /proposal/items/:id`

Decision flow when an item is saved:

```
1. Read current proposal_status and open revision (findOpenRevision)

2. willOpenRevision = !openRev && cl.is_price_affecting === true
                     && status IN ('pricing_complete','submitted','approved')

3. If willOpenRevision → openRevision(...) → now openRev is set

4. UPDATE proposal_items:
   - quantity / unit_cost_cents → LOCKED (CASE WHEN lockPriceFields THEN old_value)
     when any revision is open (openRev != null)
   - all other fields update freely

5. If openRev && cl.is_price_affecting:
   - quantity change → UPDATE snapshot SET quantity=new_qty, cost_status='flagged'
     (unit_cost_cents kept as-is; existing baseline pre-filled for PM review)
   - other price-affecting change → UPDATE snapshot SET cost_status='flagged',
     unit_cost_cents=NULL (PM must enter fresh)

6. INSERT INTO proposal_item_changelog (..., is_price_affecting)
   with revision_id = openRev?.id ?? null

7. Return { item }
   — NOTE: does NOT return whether a revision was opened
```

### `api/src/routes/projects.ts` — `PATCH /projects/:id`

When `proposal_status` changes:

```
If currentStatus === 'in_progress' AND nextStatus !== 'in_progress':
  1. Auto-resolve any still-flagged snapshots:
     SET unit_cost_cents = COALESCE(unit_cost_cents, 0), cost_status = 'resolved'
     (no hard block — null costs default to $0)
  2. closeOpenRevision(sql, id)

If nextStatus === 'approved':
  bakeApprovedRevision(sql, id)
```

---

### `api/src/routes/proposal.ts` — `GET /projects/:id/proposal/revisions`

Returns data scoped to the **current acceptance cycle only** (`revision_major = last_revision_major + 1`):

```json
{
  "revisions": [...],   // ProposalRevision[] ordered by revision_minor DESC
  "snapshots": [...],   // RevisionSnapshot[] for all items in current-cycle revisions
  "changelog": [...]    // ProposalItemChangelogEntry[] for open revision only, ASC
}
```

The changelog in this response is filtered to `r.closed_at IS NULL` so only the **currently open** revision's entries are included.

---

### `api/src/routes/proposal.ts` — `PATCH /proposal/revisions/:revisionId/items/:itemId/cost`

Resolves a cost flag manually:

- Validates revision belongs to project and is still open
- `UPDATE proposal_revision_snapshots SET unit_cost_cents = ?, cost_status = 'resolved'`

---

## 4. Client-Side — Data Flow

### `src/lib/api/proposal.ts`

`proposalItemUpdatePayload(patch)` maps `patch.changeLog` → `change_log` including `is_price_affecting`.

`revisions(projectId)` → maps the API response into:

```typescript
{
  revisions: ProposalRevision[]
  snapshots: RevisionSnapshot[]
  changelog: ProposalItemChangelogEntry[]
}
```

`changelog.previousValue` / `newValue` default to `''` (not null) if null in DB.

---

### `src/hooks/proposal/useProposal.ts`

**`useUpdateProposalItem()`**  
Variables: `{ id, patch, projectId? }`  
`onSuccess`:

- Updates item in `proposalKeys.items(categoryId)` cache
- Invalidates `proposalKeys.changelog(itemId)`
- If `patch.changeLog.isPriceAffecting && projectId`:
  - Invalidates `proposalKeys.revisions(projectId)` ← triggers revision block to appear
  - Invalidates `projectKeys.all` ← refreshes `proposalStatus` back to `in_progress`

**`useProposalRevisions(projectId)`**  
Fetches from `GET /projects/:id/proposal/revisions`.

**`useUpdateRevisionItemCost(projectId)`**  
On success, invalidates `proposalKeys.revisions(projectId)`.

---

### `src/components/proposal/table/ProposalTable.tsx`

**`ProposalTable`** (outer):

- Passes `proposalStatus={project?.proposalStatus ?? 'in_progress'}` to each `ProposalCategorySection`
- Wires `onItemSave={(item, patch) => updateItem.mutate({ id: item.id, patch, projectId })}`

**`ProposalCategorySection`**:

- Calls `useProposalRevisions(projectId)`
- Computes:
  ```typescript
  const openRev = revisions.find((r) => r.closedAt === null) ?? null;
  const hasOpenRevision = openRev !== null;
  const snapshotsByRevThenItem = Map<revisionId, Map<itemId, RevisionSnapshot>>;
  const changelogByItemId = Map<itemId, ProposalItemChangelogEntry[]>;
  // filtered to openRev.id entries only
  ```
- When `proposalStatus !== 'in_progress'` → `handleItemSave` intercepts saves, calls `patchToChangeInfo`, shows `ChangeConfirmModal`
- When `proposalStatus === 'in_progress'` → saves bypass the modal (direct `onItemSave`)

**Table header rendering (conditional on `hasOpenRevision`)**:

- `hasOpenRevision = false`: single-row header, Qty/Unit Cost/Total are sticky editable right-side cells
- `hasOpenRevision = true`: two-row header
  - Row 1: drag handle | draggable cols | locked Qty (rowSpan=2) | locked UC (rowSpan=2) | locked Total (rowSpan=2) | Notes (rowSpan=2) | **REVISION X.X** (colSpan=3, sticky right-10, brand-300 left border) | ⋮ (rowSpan=2)
  - Row 2: placeholder `<th colSpan={draggableColOrder.length}>` | Rev Qty sub | Rev UC sub | Rev Total sub

**Sticky position math:**

```
right-0   = 40px  ⋮ options column
right-10  = 40px  Rev Total / REVISION span anchor
right-[160px] = 40+120 = 160px  Rev Unit Cost
right-[288px] = 40+120+128 = 288px  Rev Qty / Notes
```

**`ProposalRow` body (when `openRev != null`)**:

- Renders locked (read-only) baseline Qty / UC / Total
- Renders `RevisionNotesCell` with changelog entries for this item
- Renders `RevisionQtyCell`, `RevisionCostCell`, `RevisionTotalCell` with sticky `tdClassName`

**`ChangeHistoryDot`**:

- Uses `useProposalItemChangelog(itemId)` (per-item fetch)
- Filters entries to: `e.revisionId !== null && revisionLabelMap.has(e.revisionId)`
  — only current-cycle entries, suppressing history from prior acceptance cycles
- Only rendered when `proposalStatus !== 'in_progress'` (dot and revision block are mutually exclusive — revision open ↔ status is `in_progress` ↔ dots hidden)

---

## 5. `ChangeConfirmModal`

Shown when any cell edit is saved while `proposalStatus !== 'in_progress'`.

Props: `columnLabel`, `previousValue`, `newValue`, `proposalStatus`, `isPriceAffecting`  
State: `notes` (textarea), `priceAffecting` (checkbox — pre-filled from `isPriceAffecting` prop)  
On confirm: returns `{ notes?, isPriceAffecting }` to caller

The initial `isPriceAffecting` value comes from `patchToChangeInfo`:

- `size`, `quantity`, `cbm` → `true`
- `unitCostCents`, text fields, custom columns → `false`

The PM can override the checkbox in either direction.

---

## 6. `RevisionCostCell` Behaviour

| `cost_status` | `unit_cost_cents` | Display                                                      |
| ------------- | ----------------- | ------------------------------------------------------------ |
| `none`        | any               | read-only, neutral text                                      |
| `none`        | null              | static `—`                                                   |
| `flagged`     | not null          | amber bg, ⚑ icon, pre-filled value, clickable → inline input |
| `flagged`     | null              | amber bg, ⚑ icon, `—`, clickable → blank inline input        |
| `resolved`    | any               | green text, formatted amount                                 |

Committing the input fires `useUpdateRevisionItemCost` → `PATCH /proposal/revisions/:revisionId/items/:itemId/cost` → sets `cost_status = 'resolved'`.

---

## 7. Goals for This Implementation

### Immediate / confirmed goals

1. **PM visibility during a live revision** — while a revision is open, the table shows a sticky right block (REVISION X.X) alongside the locked baseline so the PM can see both sets of numbers at once.
2. **Qty-only changes require PM confirmation of total** — `cost_status = 'flagged'` with the existing unit cost pre-filled. PM sees the pre-calculated total and can accept or override.
3. **Non-qty price-affecting changes require PM to enter a new unit cost** — `cost_status = 'flagged'`, `unit_cost_cents = NULL`. PM must type the new cost before it resolves.
4. **Revision history is never deleted** — prior cycles (1.x) survive acceptance. Only `last_revision_major` advances to isolate the new cycle's numbering.
5. **ChangeHistoryDot is scoped to current cycle** — historical dots from old acceptance cycles are suppressed.

### Known open questions / design gaps

1. **What happens when multiple price-affecting changes hit the same item in one open revision?** Each PATCH call updates the snapshot again (`UPDATE proposal_revision_snapshots SET ...`). The snapshot only holds one qty and one unit_cost_cents. Multiple changes to the same column overwrite. The changelog correctly records every individual change. Is this the right UX?

2. **Non-price-affecting edits during an open revision** — currently, once `proposal_status = 'in_progress'` (revision open), all further cell edits skip the modal entirely (`handleItemSave` early-returns). This means text fields, notes, etc. can be edited silently with no changelog entry. Is that intended?

3. **What does the PM do to "close" a revision round?** There is no explicit "close revision" button. The only way to close is to advance the proposal status (e.g. click "Mark Pricing Complete"). Is a manual close-without-advance needed?

4. **Revision Notes column** — `RevisionNotesCell` shows the `notes` from changelog entries for the open revision. But a single item could have multiple changelog entries (multiple column changes). The cell stacks all note strings. Is per-entry or per-item the right granularity?

5. **Proposal goes directly to `approved` from `in_progress`** — `bakeApprovedRevision` is called, but `closeOpenRevision` is NOT explicitly called first (it's only called when `currentStatus === 'in_progress' && nextStatus !== 'in_progress'`). The close call IS inside that same block, so it does run before bake. ✓ Confirm this path works.

6. **`willOpenRevision` condition uses `cl.is_price_affecting`** — but the server also checks `proposalStatus` is not `in_progress`. If a revision is already open but the client didn't refresh yet, can a duplicate revision be opened? The partial unique index `WHERE closed_at IS NULL` enforces at-most-one-open at the DB level.

7. **The PATCH response doesn't tell the client whether a revision was opened** — the client invalidates `proposalKeys.revisions` only when `patch.changeLog.isPriceAffecting` is true. So if PM confirms a change as price-affecting, the table re-fetches. But if for some reason the API opens a revision and the client doesn't know (e.g. a non-price-affecting change that triggers a revision due to race condition), the table would stay stale.

8. **Auto-resolve to $0 on advance** — when the PM advances to `pricing_complete` without having entered costs for all flagged items, those get auto-resolved to `unit_cost_cents = 0`. Is $0 the right default, or should the pre-revision baseline value be kept? Currently, for quantity-only changes, the snapshot already has the old unit_cost_cents pre-filled, so auto-resolve at $0 would wipe it. This seems wrong for qty-only items.

9. **`RevisionTotalCell` computation** — the total should be `snapshot.quantity * snapshot.unitCostCents` (using revised qty and cost). If either is null (not yet set by PM), what should the cell show? Is it calculated client-side or does the API provide it?

10. **No UI warning before advancing** — there is no client-side confirmation dialog before advancing from `in_progress` to `pricing_complete` warning about unresolved flagged items. The 422 hard block was removed. PM could advance with unresolved items with no feedback.

---

## 8. File Map

| File                                                     | Role                                                                   |
| -------------------------------------------------------- | ---------------------------------------------------------------------- |
| `db/migrations/0022_proposal_item_changelog.sql`         | changelog table                                                        |
| `db/migrations/0023_proposal_revisions.sql`              | revision rounds table                                                  |
| `db/migrations/0024_proposal_revision_snapshots.sql`     | snapshots table                                                        |
| `db/migrations/0025_projects_last_revision_major.sql`    | last_revision_major column on projects                                 |
| `db/migrations/0026_changelog_is_price_affecting.sql`    | is_price_affecting column on changelog                                 |
| `api/src/lib/revisions.ts`                               | all revision server logic (open, close, bake, numbering)               |
| `api/src/routes/proposal.ts`                             | PATCH /proposal/items/:id, PATCH cost, GET revisions                   |
| `api/src/routes/projects.ts`                             | PATCH /projects/:id (status advance, close revision, bake)             |
| `src/types/proposal.ts`                                  | ProposalRevision, RevisionSnapshot, ProposalItemChangelogEntry         |
| `src/lib/api/proposal.ts`                                | client API functions, payload mappers                                  |
| `src/hooks/proposal/useProposal.ts`                      | useProposalRevisions, useUpdateProposalItem, useUpdateRevisionItemCost |
| `src/lib/query/keys.ts`                                  | proposalKeys.revisions                                                 |
| `src/components/proposal/ChangeConfirmModal.tsx`         | modal for confirmed field changes                                      |
| `src/components/proposal/table/ProposalTable.tsx`        | table layout, two-row header, ProposalRow, ChangeHistoryDot            |
| `src/components/proposal/revision/RevisionCostCell.tsx`  | inline cost-entry for flagged snapshots                                |
| `src/components/proposal/revision/RevisionQtyCell.tsx`   | snapshot qty display                                                   |
| `src/components/proposal/revision/RevisionTotalCell.tsx` | snapshot total display                                                 |
| `src/components/proposal/revision/RevisionNotesCell.tsx` | stacked changelog notes for open revision                              |
