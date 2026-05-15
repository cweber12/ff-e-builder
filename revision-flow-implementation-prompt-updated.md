# Revision Flow Clarification + Implementation Request

Review `@handoff_analysis/2026-05-15-revision-implementation-state.md` before making changes.

The current revision implementation is close, but the flow is not quite what I intended. This prompt clarifies the desired behavior for proposal revisions, especially the difference between:

1. Normal editing while a proposal is still being drafted.
2. Starting a new revision after pricing/submission.
3. Continuing edits while a revision is already open.
4. Closing/locking a revision after the PM updates revised pricing.

---

# Most Important Correction

The current implementation appears to treat every `proposal_status === 'in_progress'` state as normal draft mode.

That is incorrect.

`in_progress` has two different meanings:

## 1. Draft Mode

Condition:

- `proposal_status = in_progress`
- No open revision exists

Meaning:

- The proposal is still being drafted.
- Edits save directly.
- No revision prompt is needed.
- No revision round should be opened.

## 2. Open Revision Mode

Condition:

- `proposal_status = in_progress`
- An open revision exists, meaning a `proposal_revisions` row exists with `closed_at = null`

Meaning:

- The proposal was previously `pricing_complete` or `submitted`.
- A price-changing revision was triggered.
- The proposal was moved back to `in_progress` so the PM can update revised pricing.
- Edits should still be tracked against the open revision.
- Edits should still prompt for revision notes and price-changing confirmation.

Do not use `proposal_status` alone to determine whether revision behavior should be skipped.

Use both:

```ts
const isDraftMode = proposalStatus === 'in_progress' && !hasOpenRevision;
const isRevisionMode = hasOpenRevision;
const shouldPromptForRevisionChange = proposalStatus !== 'in_progress' || isRevisionMode;
```

Expected behavior:

- Draft mode: direct save.
- Pricing/submitted mode: prompt before save.
- Open revision mode: prompt before save.

---

# Core Concept

A proposal can be edited in two different `in_progress` situations.

## A. Normal draft `in_progress`

The proposal has not reached `pricing_complete` or `submitted`, and there is no open revision.

In this case, edits are normal draft edits. They should not trigger revision prompts, revision columns, revision logs, or price-clearing behavior.

## B. Revision-open `in_progress`

The proposal was previously `pricing_complete` or `submitted`, then a price-changing revision was triggered. Opening the revision moves the proposal status back to `in_progress`.

In this case, `in_progress` does not mean “normal draft mode.” It means “there is an open revision round.” While an open revision exists, all further edits should be tracked against that open revision until the revision is closed.

Therefore, the UI/server should not rely only on `proposal_status === 'in_progress'` to decide whether to skip revision behavior. It must also check whether an open revision exists.

---

# Desired User Flow

## Case 1 — Normal Draft Editing

### Condition

- `proposal_status = in_progress`
- No open revision exists
- No previous revision has been triggered for the current proposal cycle

### Desired behavior

The user can edit item values freely.

No revision modal should appear.

No new revision should be created.

No revision notes should be required.

No revision columns should appear.

This is just normal proposal drafting.

---

## Case 2 — First Edit After Pricing/Submittal

### Condition

- `proposal_status = pricing_complete` or `submitted`
- No open revision exists

### User action

The user edits a proposal item cell.

### Desired behavior

The user should be prompted with a confirmation modal asking:

1. What changed? / revision note
2. Is this change price-changing?
3. Confirm/cancel

The user must be able to mark the edit as either:

- Price-changing
- Not price-changing

---

## Case 2A — Edit Is Not Price-Changing

### Condition

- Proposal is `pricing_complete` or `submitted`
- No open revision exists
- User edits a cell
- User confirms the edit as **not price-changing**

### Desired behavior

The edit should be saved.

The change should be added to the item’s revision/change notes or changelog.

No new revision round should be opened.

No revision pricing columns should be created.

Proposal status should remain unchanged.

Use this for simple notes/text/spec cleanup where the PM wants history but does not need to reprice the item.

### Important implementation detail

The frontend should refresh or invalidate the relevant changelog/notes query even when `isPriceAffecting === false`.

The current implementation may only invalidate revision-related queries when the change is price-affecting. That is not enough because non-price-changing edits after pricing/submission still need to appear in the visible notes/changelog.

---

## Case 2B — Edit Is Price-Changing

### Condition

- Proposal is `pricing_complete` or `submitted`
- No open revision exists
- User edits a cell
- User confirms the edit as **price-changing**

### Desired behavior

A new revision round should be opened.

Opening a revision should:

1. Create the new revision record.
2. Snapshot the current item values.
3. Move the proposal status back to `in_progress`.
4. Show the revision UI columns on the far right of the sticky pricing columns.
5. Add the change note to the revision notes/changelog.
6. Clear or flag the revised cost fields that need PM review.

The revision block should add four revision-related cells to the right side of the table near the sticky pricing area:

1. Revision notes
2. Revision quantity
3. Revision unit cost
4. Revision total cost

The existing/base pricing values should remain visible and locked/read-only during the open revision.

---

# Open Revision Behavior

## Definition

An “open revision” means:

- A `proposal_revisions` row exists with `closed_at = null`
- The proposal status has been moved back to `in_progress`
- The user/PM is actively editing changes for that revision round

Important: `proposal_status = in_progress` is not enough to identify normal draft mode. If an open revision exists, the proposal is in revision mode.

---

## Case 3 — Editing While a Revision Is Open

### Condition

- `proposal_status = in_progress`
- An open revision exists

### Desired behavior

Any new change should be added to the existing open revision.

The user should still be prompted before saving a changed cell.

The prompt should ask for:

1. Revision notes
2. Whether the change is price-changing
3. Confirmation to apply the change to the open revision

---

## Case 3A — Edit During Open Revision Is Not Price-Changing

### Condition

- Proposal is `in_progress`
- An open revision exists
- User edits a cell
- User confirms the edit as **not price-changing**

### Desired behavior

The edit should be saved.

The change note should be added to the open revision notes/changelog.

The revision cost fields should not be cleared.

The existing revision round remains open.

No new revision should be created.

---

## Case 3B — Edit During Open Revision Is Price-Changing

### Condition

- Proposal is `in_progress`
- An open revision exists
- User edits a cell
- User confirms the edit as **price-changing**

### Desired behavior

The edit should be saved into the open revision flow.

The revision note should be added to the open revision notes/changelog.

The revised cost fields for that item should be cleared or flagged so the PM knows the item needs updated pricing.

The PM should then update the revised unit cost before closing the revision.

No new revision should be created.

The existing open revision should continue to be used.

---

# Revised Cost Behavior

When a price-changing edit happens inside an open revision:

## Quantity change

If the user changes quantity:

- Store the revised quantity in the revision snapshot.
- Keep or prefill the existing unit cost if appropriate.
- Flag the cost as needing PM confirmation.
- The PM should be able to accept or override the revised unit cost.
- The revised total should reflect revised quantity × revised unit cost when both values exist.

## Non-quantity price-changing change

If the user changes a field that could affect price but is not quantity:

Examples:

- Size
- Material/spec
- Product/detail
- Custom field marked price-changing

Then:

- Add the change to revision notes.
- Mark the item as needing PM pricing review.
- Clear the revised unit cost, or show it as blank, so the PM must intentionally enter a revised cost.
- Do not silently reuse the old price unless the PM confirms it.

---

# Snapshot vs Changelog Responsibility

The revision snapshot and the changelog have different jobs.

## Revision snapshot

The snapshot should represent the latest revised pricing state for each item in the currently open revision.

If multiple price-changing edits happen to the same item in one open revision, it is acceptable for the snapshot values to be overwritten with the newest revised values.

## Changelog

The changelog should preserve every individual edit and note.

Therefore:

- Snapshot = current revised state for the item in the revision.
- Changelog = full history of each change that happened during the revision.

Do not rely on the snapshot alone for the revision history/log.

---

# Closing a Revision

## Condition

An open revision exists and the PM has reviewed/updated all flagged revised costs.

### User action

The PM moves the proposal status from `in_progress` to `pricing_complete`.

### Desired behavior

Before closing the revision, show a confirmation modal explaining what will happen:

- The open revision will be closed.
- The revised values will be locked in for this revision round.
- The previous values and revision notes will be stored in the revision log.
- The table will return to normal pricing-complete mode.
- The revision block will no longer be editable.

If any revised costs are still flagged/unresolved, the user should be warned.

Preferred behavior:

- Do not auto-resolve unresolved revised costs to `$0`.
- Either block closing until the PM resolves them, or show a very explicit warning requiring confirmation.
- Quantity-only changes with prefilled baseline unit cost should not accidentally become `$0`.

After confirmation:

1. Close the open revision.
2. Set proposal status to `pricing_complete`.
3. Preserve the revision history/log.
4. Keep the closed revision available for history/audit.
5. Return the table to the non-open-revision view.

---

# Important Behavioral Rules

## Rule 1 — Do not treat all `in_progress` states the same

There are two different meanings of `in_progress`:

- Draft mode: `in_progress` with no open revision.
- Revision mode: `in_progress` with an open revision.

Only draft mode should bypass revision prompts.

Revision mode should continue prompting and tracking changes.

Current issue to fix:

`ProposalCategorySection` currently appears to bypass the modal whenever `proposalStatus === 'in_progress'`. That is only correct when there is no open revision. If `hasOpenRevision === true`, edits should go through the revision confirmation flow.

---

## Rule 2 — Non-price-changing edits after pricing/submission should be tracked but should not open a revision

If a proposal is already `pricing_complete` or `submitted`, a non-price-changing edit should still create a changelog/revision note entry, but it should not create a new revision round or move status back to `in_progress`.

---

## Rule 3 — Price-changing edits after pricing/submission should open a revision

A price-changing edit from `pricing_complete` or `submitted` should:

- Open a new revision.
- Move status to `in_progress`.
- Add the revision columns.
- Track the note.
- Flag/clear revised cost fields for PM review.

---

## Rule 4 — Price-changing edits during an open revision should not open another revision

If an open revision already exists, additional price-changing edits should be added to that open revision.

Do not create a second open revision.

Do not increment the revision number.

---

## Rule 5 — All edits during an open revision should be tracked

While an open revision exists, both price-changing and non-price-changing edits should be recorded in the open revision changelog/notes.

The difference is:

- Non-price-changing: save + notes only.
- Price-changing: save + notes + flag/clear revised cost fields.

---

## Rule 6 — The user/PM decides whether a confirmed edit is price-changing

The modal should allow the user/PM to decide whether the change is price-changing.

The backend should not blindly treat every confirmed change as price-affecting.

The server should use the validated `change_log.is_price_affecting` value sent by the client.

The frontend may provide a smart default based on the edited column, but the user should be able to override it.

Suggested defaults:

- Quantity: price-changing by default
- Unit cost: price-changing by default
- Size/CBM/material/spec/product/detail/custom relevant fields: maybe price-changing by default
- Notes/text-only cleanup: not price-changing by default

But the final decision should come from the confirmation modal.

---

## Rule 7 — Do not auto-resolve unresolved costs to zero

The current backend appears to auto-resolve flagged revision costs with something like `COALESCE(unit_cost_cents, 0)` when moving out of `in_progress`.

This conflicts with the desired flow.

Do not silently convert unresolved revised costs to `$0`.

Instead:

- Block closing the revision until flagged costs are resolved, or
- Require explicit PM confirmation before closing with unresolved costs.

Preferred behavior is to block closing until all flagged costs are resolved.

---

## Rule 8 — Closed revision history must remain viewable

Once a revision is closed, its notes and previous/revised values should still be available in the revision history/log UI.

The current revisions endpoint may focus on the current open revision changelog. That is fine for the active table view, but there also needs to be a way to inspect closed revision history.

Closed revision history should include:

- Revision number
- Opened/closed timestamps
- Item changed
- Column changed
- Previous value
- New/revised value
- User-entered notes
- Whether the change was price-changing
- Final revised quantity/unit cost/total where applicable

---

# UI Expectations

## Normal draft mode

Condition:

- `proposal_status = in_progress`
- No open revision

UI:

- Normal editable proposal table.
- No revision columns.
- No revision prompt.

---

## Pricing complete/submitted mode

Condition:

- `proposal_status = pricing_complete` or `submitted`
- No open revision

UI:

- Editing a cell opens the revision confirmation modal.
- User chooses whether the change is price-changing.
- Price-changing opens a revision.
- Non-price-changing saves notes/changelog only.

---

## Open revision mode

Condition:

- `proposal_status = in_progress`
- Open revision exists

UI:

- Show locked baseline pricing columns.
- Show revision notes, revision qty, revision unit cost, and revision total columns.
- Editing any tracked cell opens the revision confirmation modal.
- Price-changing edits flag/clear revised costs.
- Non-price-changing edits only add revision notes/changelog.
- Revision notes should show the relevant notes for that item in the open revision.

---

## Closing revision

Condition:

- Open revision exists
- User attempts to move status to `pricing_complete`

UI:

- Show confirmation before closing.
- Warn about unresolved flagged costs.
- Do not silently auto-resolve unresolved costs to `$0`.

---

# Implementation Guidance

## Frontend

### `ProposalCategorySection` / save flow

Current behavior appears to skip the modal when `proposalStatus === 'in_progress'`.

Update the logic so that:

```ts
const isDraftMode = proposalStatus === 'in_progress' && !hasOpenRevision;
const isRevisionMode = hasOpenRevision;
const shouldPromptForRevisionChange = proposalStatus !== 'in_progress' || isRevisionMode;
```

Expected behavior:

- Draft mode: direct save.
- Pricing/submitted mode: prompt.
- Open revision mode: prompt.

### `ChangeConfirmModal`

Use this modal for:

- First edit after `pricing_complete` / `submitted`
- Any edit while a revision is open

The modal should clearly ask:

- Add revision note
- Is this price-changing?
- Confirm/cancel

### Revision columns

When `hasOpenRevision === true`, show:

- Locked baseline qty/unit cost/total
- Revision notes
- Revision qty
- Revision unit cost
- Revision total

The revision notes column should be treated as part of the revision block, even if the current table header implementation visually separates it from the `REVISION X.X` colspan.

### Status transition UI

When the user attempts to move an open revision from `in_progress` to `pricing_complete`:

- Check whether an open revision exists.
- Check whether unresolved flagged revision costs exist.
- Show a confirmation modal before closing.
- Prefer blocking the transition until unresolved costs are resolved.

---

## Backend

### `PATCH /proposal/items/:id`

Update the save logic so it distinguishes between:

1. No open revision + draft mode
2. No open revision + pricing/submitted + non-price-changing edit
3. No open revision + pricing/submitted + price-changing edit
4. Existing open revision + non-price-changing edit
5. Existing open revision + price-changing edit

Expected behavior:

```text
If no open revision and status is in_progress:
  Save normally.
  No revision.
  No changelog required unless existing behavior already logs draft edits.

If no open revision and status is pricing_complete/submitted:
  Require change_log metadata from client.

  If is_price_affecting = false:
    Save edit.
    Insert changelog with revision_id = null.
    Do not open revision.
    Do not change proposal_status.

  If is_price_affecting = true:
    Open revision.
    Move status to in_progress.
    Insert changelog linked to new revision.
    Update revision snapshot for changed item.
    Flag/clear revised cost fields as needed.

If open revision exists:
  Require change_log metadata from client.
  Save edit according to revision rules.
  Insert changelog linked to open revision.

  If is_price_affecting = true:
    Update revision snapshot.
    Flag/clear revised cost fields.

  If is_price_affecting = false:
    Do not clear revised cost fields.
```

### Price-affecting logic

Do not use a backend helper that always returns `true` for price-affecting changes.

The backend should respect the confirmed `change_log.is_price_affecting` value.

It is okay for the frontend to provide a default, but the user’s modal choice should control the final submitted value.

### Closing revision

When moving from `in_progress` to `pricing_complete` while an open revision exists:

- Check unresolved flagged snapshot costs.
- Do not auto-resolve unresolved costs to `$0`.
- Prefer blocking the close until all flagged costs are resolved.
- If not blocking, require explicit confirmation from the frontend and preserve existing/prefilled costs where applicable.

### Closed revision history

Ensure closed revision data remains queryable for history/log views.

If the existing endpoint only returns changelog entries for the current open revision, consider either:

- Extending it to support closed revision history, or
- Adding a separate revision history endpoint.

---

# Acceptance Criteria

## 1. Draft edit

Given:

- Proposal is `in_progress`
- No open revision exists

When:

- User edits an item value

Then:

- No modal appears
- No revision opens
- Value saves normally

---

## 2. Non-price-changing edit after pricing complete

Given:

- Proposal is `pricing_complete`
- No open revision exists

When:

- User edits a cell
- User marks it as not price-changing
- User enters a note and confirms

Then:

- Edit saves
- Changelog/note is created
- No revision opens
- Proposal remains `pricing_complete`
- The visible notes/changelog refreshes

---

## 3. Price-changing edit after pricing complete

Given:

- Proposal is `pricing_complete`
- No open revision exists

When:

- User edits a cell
- User marks it as price-changing
- User enters a note and confirms

Then:

- A new revision opens
- Proposal moves to `in_progress`
- Revision columns appear
- Baseline pricing is locked/read-only
- Revised cost fields for the item are flagged/cleared for PM review

---

## 4. Non-price-changing edit during open revision

Given:

- Proposal is `in_progress`
- An open revision exists

When:

- User edits a cell
- User marks it as not price-changing
- User enters a note and confirms

Then:

- Edit saves
- Note is linked to the open revision
- No new revision opens
- Revised cost fields are not cleared

---

## 5. Price-changing edit during open revision

Given:

- Proposal is `in_progress`
- An open revision exists

When:

- User edits a cell
- User marks it as price-changing
- User enters a note and confirms

Then:

- Edit saves into the open revision
- Note is linked to the open revision
- No new revision opens
- Revised cost fields for that item are flagged/cleared for PM update

---

## 6. Closing revision

Given:

- Proposal is `in_progress`
- An open revision exists
- PM has updated/resolved all flagged revised costs

When:

- PM moves proposal to `pricing_complete`

Then:

- Confirmation appears
- Open revision closes
- Revised values are locked into the revision history/log
- Proposal becomes `pricing_complete`
- Revision columns are no longer editable

---

## 7. Attempting to close with unresolved costs

Given:

- Proposal is `in_progress`
- An open revision exists
- One or more revised costs are still flagged/unresolved

When:

- PM tries to move proposal to `pricing_complete`

Then:

- PM is warned
- The system must not silently set unresolved costs to `$0`
- Prefer blocking the transition until the costs are resolved

---

## 8. Closed revision history

Given:

- A revision was opened
- Changes were made with notes
- The revision was closed by moving back to `pricing_complete`

When:

- User opens revision history/log

Then:

- The closed revision is visible
- Its notes are visible
- Its changed items are visible
- Previous and revised values are visible where applicable
- The revision has not been deleted or hidden permanently
