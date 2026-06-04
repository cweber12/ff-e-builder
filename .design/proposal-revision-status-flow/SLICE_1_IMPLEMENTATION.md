# Slice 1 Implementation: Revision/Status Workflow Shell

## Goal

Ship the smallest UI slice that changes the user's mental model immediately:

- the project status control becomes the primary workflow surface for open revisions
- blocked status progression gives the user a direct path to flagged-cost work
- Spreadsheet View and the Item Detail Panel show local revision context
- duplicate revision signals in the sidebar and default item-list area are removed

This slice does **not** implement full revision draft/session persistence yet.

## Why This Slice First

This fixes the largest comprehension problem without requiring the deeper behavioral rewrite:

- today the app uses `in_progress` both for normal draft work and open revisions
- flagged-cost blockers exist but do not route users to a fix path
- revision state appears in too many places, but not in the right ones

This slice creates the workflow shell that later slices can attach to:

- explicit start-revision flow
- session-scoped revision drafts
- leave-page confirmation
- save-to-revision-log behavior

## In Scope

1. Update the proposal workflow UI so the **project status area** is the only sidebar/list-area revision signal.
2. Add a direct `Open flagged items in Spreadsheet View` CTA when flagged costs block status progression.
3. Open Spreadsheet View in a **flagged-only mode** for the relevant schedule.
4. Show a clear `Revision in progress` state inside Spreadsheet View.
5. Show a clear `Revision in progress` state inside the Proposal Item Detail Panel.
6. Remove duplicate revision labels/chips from the sidebar and default record-list header.

## Out of Scope

- full session draft store
- explicit `Start Revision` modal
- leave-page confirmation
- moving all before/after pricing compare out of record rows
- a true cross-schedule flagged-only review workspace

## Exact File Scope

### 1. Shared proposal-shell state

**File:** [src/App.tsx](/c:/Projects/_current-projects/ffe-builder/src/App.tsx:78)

Add one small shared proposal-shell state seam to `ProjectContext` for opening Spreadsheet View from sibling sidebar UI.

Recommended shape:

```ts
type ProposalSpreadsheetRequest = { categoryId: string; filter: 'all' | 'flagged' } | null;
```

Add to `ProjectContext`:

- `proposalSpreadsheetRequest`
- `onProposalSpreadsheetRequest`
- `onClearProposalSpreadsheetRequest`

Why here:

- `ProposalSidebarSections` lives in the project chrome/sidebar path
- `ProposalTable` lives in the route content path
- they are siblings, so `ProjectContext` is the clean seam

### 2. Sidebar workflow/status area

**File:** [src/components/project/AppBarActions.tsx](/c:/Projects/_current-projects/ffe-builder/src/components/project/AppBarActions.tsx:147)

#### Change `ProposalSidebarSections`

Current issues:

- the `View` section repeats `openRev.label open · flagged · resolved`
- `ProposalRevisionChip` duplicates revision state again under the status control

Change:

- keep the compare toggle, but remove revision summary text from the `View` section
- remove `ProposalRevisionChip` from `ProposalSidebarContext`
- pass a callback into the status control so blocked flagged states can open Spreadsheet View

Recommended wording change:

- `Revision mode` -> `Compare revision values`

This keeps the control but stops using it as the shell-level revision status display.

#### Change `ProposalSidebarContext`

Current issues:

- status control only shows lifecycle stage
- revision chip sits separately beneath it

Change:

- fold revision context into the workflow/status block
- when an open revision exists, status copy should read like:
  - `Revision 1.1 in progress`
  - `Based on Submitted`
  - `3 flagged costs`
- add the blocked CTA:
  - `Open flagged items in Spreadsheet View`

Implementation note:

- compute the first category containing flagged items from `categoriesWithItems` + `snapshots`
- CTA should set the shared `proposalSpreadsheetRequest`

### 3. Status control + blocked CTA

**Files:**

- [src/components/shared/ProposalStatusSelect/ProposalStatusSelect.tsx](/c:/Projects/_current-projects/ffe-builder/src/components/shared/ProposalStatusSelect/ProposalStatusSelect.tsx:1)
- [src/components/shared/ProposalStatusSelect/ProposalStatusConfirmModal.tsx](/c:/Projects/_current-projects/ffe-builder/src/components/shared/ProposalStatusSelect/ProposalStatusConfirmModal.tsx:1)

#### `ProposalStatusSelect`

Add optional props:

- `openRevisionLabel?: string`
- `blockedAction?: { label: string; onClick: () => void }`
- optionally `displayStatusLabel?: string` if you want to start the `Draft` wording here

Behavior:

- if `revisionGuard` exists, show open revision context in the control area rather than relying on a separate chip
- when blocked, render the CTA below the warning text

#### `ProposalStatusConfirmModal`

Not required for the first pass, but recommended:

- when blocked, include the same CTA in the modal body so the user is not trapped in a dead-end confirmation

This can be a secondary action button or inline text button.

### 4. Proposal table route shell

**File:** [src/components/proposal/table/ProposalTable.tsx](/c:/Projects/_current-projects/ffe-builder/src/components/proposal/table/ProposalTable.tsx:19)

Add a controlled Spreadsheet View request path:

- consume `proposalSpreadsheetRequest` from `useProjectContext()` via `ProjectProposalRoute` prop plumbing
- derive whether the selected schedule should open Spreadsheet View
- drive Spreadsheet View open/filter state into `ProposalCategorySection`

Recommended prop additions into `ProposalCategorySection`:

- `spreadsheetRequest?: { filter: 'all' | 'flagged' } | null`
- `onSpreadsheetRequestHandled?: () => void`

### 5. Schedule section state

**File:** [src/components/proposal/table/category/ProposalCategorySection.tsx](/c:/Projects/_current-projects/ffe-builder/src/components/proposal/table/category/ProposalCategorySection.tsx:1)

This file is the local state owner for the record list and Spreadsheet View overlay. It is the correct place to add the flagged-only filter for the first slice.

Changes:

- replace local boolean `isExpanded` with:

```ts
type ExpandedSpreadsheetMode = null | { filter: 'all' | 'flagged' };
```

- respond to the shared spreadsheet request when `categoryId` matches
- pass filtered items to `ProposalCategoryExpandedTable`
- compute `flaggedItemsInCategory` from `openRev` + `snapshotsByRevThenItem`

Recommended rule:

- default `Open Spreadsheet View` from the row/schedule menu still opens `filter: 'all'`
- blocked-status CTA opens `filter: 'flagged'`

### 6. Default record-list header

**File:** [src/components/proposal/table/category/ProposalCategoryHeader.tsx](/c:/Projects/_current-projects/ffe-builder/src/components/proposal/table/category/ProposalCategoryHeader.tsx:1)

Current issue:

- record mode header shows `Revision X.Y compare`
- table mode header shows `Revision X.Y` badge

Required change for this slice:

- remove revision badges/text from **record mode**

Keep/adjust for Spreadsheet View:

- allow revision context only when the expanded spreadsheet overlay is open

This aligns with the clarified rule:

- sidebar/list area: only project status control indicates revision
- Spreadsheet View: local revision indication is allowed

### 7. Spreadsheet View overlay

**File:** [src/components/proposal/table/category/ProposalCategoryExpandedTable.tsx](/c:/Projects/_current-projects/ffe-builder/src/components/proposal/table/category/ProposalCategoryExpandedTable.tsx:1)

Add props:

- `viewFilter?: 'all' | 'flagged'`
- `flaggedCount?: number`

Behavior:

- header should show `Revision in progress` when `hasOpenRevision`
- if `viewFilter === 'flagged'`, show a secondary label such as:
  - `Flagged costs only`
  - `3 items in this schedule`
- rows should be filtered before rendering

Keep this slice modest:

- do not add a full filter builder
- do not add cross-schedule aggregation
- this is a system-owned mode, not a user-authored filter

### 8. Detail panel revision context

**File:** [src/components/proposal/table/detail/ProposalItemDetailPanel.tsx](/c:/Projects/_current-projects/ffe-builder/src/components/proposal/table/detail/ProposalItemDetailPanel.tsx:1)

Current issue:

- the panel shows changelog content, but the panel header itself does not clearly anchor the user in an active revision workflow

Change:

- when `openRev` exists, add a concise revision state block in the panel header or immediately below it:
  - `Revision 1.1 in progress`
  - `Based on Submitted` if easily available, otherwise just the revision label in this slice

Do not add a second shell-style summary card. Keep it local to the panel.

## Behavior Spec

### A. No open revision

- project status behaves as today, except any duplicate revision chips/summary copy are gone
- compare toggle is disabled
- Spreadsheet View opens normally
- detail panel shows no revision banner

### B. Open revision, no blocked progression attempt

- project status area shows revision context
- sidebar/list area does not repeat that context elsewhere
- Spreadsheet View opened manually shows `Revision in progress`
- detail panel shows `Revision in progress`

### C. Open revision with flagged costs

- project status area shows flagged count
- status control warning text includes `Open flagged items in Spreadsheet View`
- clicking it:
  - switches to the first schedule containing flagged items
  - opens Spreadsheet View
  - applies `flagged-only` filter in that schedule

### D. Multiple schedules with flagged items

First-slice behavior:

- CTA opens the **first** schedule containing flagged items
- Spreadsheet View shows only flagged items within that schedule

Follow-up slice:

- cross-schedule flagged-review workspace or explicit flagged-schedule navigation

## Acceptance Criteria

1. With an open revision, the sidebar no longer shows:
   - `open · flagged · resolved` helper text in the `View` section
   - `ProposalRevisionChip` or equivalent duplicate revision summary card

2. The project status/workflow area is the only sidebar/list-area surface that indicates revision status.

3. Record-mode schedule headers no longer show `Revision X.Y` or `Revision compare`.

4. With an open revision, Spreadsheet View clearly indicates that revision work is in progress.

5. With an open revision, Proposal Item Detail Panel clearly indicates that revision work is in progress.

6. When flagged costs block progression, the user sees a direct `Open flagged items in Spreadsheet View` action.

7. Clicking that action opens Spreadsheet View filtered to flagged items for the relevant schedule.

8. The flagged-only Spreadsheet View mode is visually labeled as a scoped/system-owned view, not a generic spreadsheet state.

## Risks / Decisions To Lock

### 1. `In progress` vs `Draft`

This slice can ship without the visible label rename, but the confusion will remain partially unresolved.

Recommendation:

- if low risk, include the visible label rename in the same slice
- if not, defer it to Slice 2 but keep the prop seam ready in `ProposalStatusSelect`

### 2. First flagged schedule only

Because the current proposal shell is schedule-at-a-time, the simplest flagged-only implementation is schedule-scoped, not project-wide.

Recommendation:

- accept this for Slice 1
- document project-wide flagged review as the next UX enhancement if needed

### 3. Record-row before/after compare

The current default list still supports `revisionMode` row compare in [ProposalRecordRow.tsx](/c:/Projects/_current-projects/ffe-builder/src/components/proposal/table/row/ProposalRecordRow.tsx:199).

This technically conflicts with the long-term direction that detailed compare belongs in the detail panel only.

Recommendation:

- do **not** expand that work in Slice 1 unless it is causing active confusion
- if touched, keep it limited to removing revision labels/chrome from the list shell, not rewriting row pricing blocks yet

## Verification Targets

Targeted tests to add/update:

- [src/components/shared/ProposalStatusSelect/ProposalStatusSelect.test.tsx](/c:/Projects/_current-projects/ffe-builder/src/components/shared/ProposalStatusSelect/ProposalStatusSelect.test.tsx)
  - blocked CTA renders
  - blocked CTA callback fires

- [src/components/proposal/table/category/ProposalCategoryExpandedTable.test.tsx](/c:/Projects/_current-projects/ffe-builder/src/components/proposal/table/category/ProposalCategoryExpandedTable.test.tsx)
  - flagged-only mode renders filtered items only
  - revision-in-progress header copy renders

- [src/components/proposal/table/category/ProposalCategoryHeader.test.tsx](/c:/Projects/_current-projects/ffe-builder/src/components/proposal/table/category/ProposalCategoryHeader.test.tsx)
  - record mode no longer shows revision badge/text

- add a focused test around `ProposalTable` / `ProposalCategorySection`
  - shared spreadsheet request opens the correct schedule in flagged-only mode

## Recommended Commit Boundary

One slice, one commit:

`feat(proposal): clarify revision workflow shell and route blocked costs into flagged spreadsheet review`
