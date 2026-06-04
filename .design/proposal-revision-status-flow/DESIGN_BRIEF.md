# Design Brief: Proposal Revision + Status Flow

## Problem

Project status and revision state currently blur together in a way that is hard for designers and PMs to reason about. A new project and an active revision both appear as `in_progress`, revision entry is triggered implicitly by edits, flagged costs are resolved in a hidden cell-level interaction, and the user loses confidence about what is draft work, what is already logged, and what still blocks advancing the project.

The result is operational friction:

- Users do not know whether they are editing the live proposal or an active revision.
- Users cannot easily tell how to resolve flagged costs and move the project forward.
- The current workflow mixes lifecycle status, revision review, and per-item edits across multiple surfaces without one clear source of truth.
- Users have no session-safe draft behavior for an open revision, so leaving the page feels risky.

## Solution

Redesign the flow as two clearly separated but connected systems:

- **Project status** communicates the proposal's lifecycle milestone.
- **Revision session** communicates whether a temporary revision workspace is open, what changed, and what still needs review.

The interface should feel like a calm document workflow:

- A proposal is either in its normal lifecycle, or it has an active revision session layered on top.
- Starting a revision is an explicit action, not an invisible side effect.
- Revision edits can happen from Spreadsheet View or the Item Detail Panel, but the revision comparison and previous values live in the Item Detail Panel only.
- The project status control is the primary workflow surface that shows `Revision in progress`; do not repeat revision-summary chips elsewhere in the sidebar or item-list chrome.
- Spreadsheet View and the Item Detail Panel should still indicate that a revision is in progress while the user is working inside those surfaces.
- Flagged costs become a first-class review queue with obvious next steps.
- When flagged costs block status progression, the user gets a direct link into Spreadsheet View filtered to only flagged-cost items.
- Revision drafts are session-safe, and leaving the page prompts the user to save their current revision work to the revision log.

## Experience Principles

1. Explicit workflow state over implicit side effects -- starting, editing, saving, and closing a revision must always be visible as named actions.
2. One review surface over scattered clues -- revision history, before/after values, and cost resolution should converge in the Item Detail Panel and a dedicated revision review queue.
3. Confidence over raw speed -- advancing status should feel safe, with clear blockers, saved-draft behavior, and predictable confirmation at exit points.

## Aesthetic Direction

- **Philosophy**: Editorial operations workspace. Keep the current warm paper-and-ink UI, but make workflow state read like a composed approval system rather than spreadsheet machinery.
- **Tone**: Calm, exact, trustworthy.
- **Reference points**: Document approval tools, procurement review flows, structured publishing workflows.
- **Anti-references**: Spreadsheet-heavy audit UIs, hidden inline admin states, noisy alert-driven dashboards.

## Existing Patterns

Components, tokens, and conventions already in the codebase that this design must respect or extend.

- Typography: `Manrope Variable` / `DM Sans Variable` for UI, `Fraunces Variable` reserved for page-level emphasis.
- Colors: warm neutral canvas and paper tokens from [src/index.css](/c:/Projects/_current-projects/ffe-builder/src/index.css:20), with semantic `brand`, `warning`, `success`, and `danger` scales in [tailwind.config.ts](/c:/Projects/_current-projects/ffe-builder/tailwind.config.ts:1).
- Spacing: tokenized spacing and compact panel rhythm already established in sidebars, record rows, and detail panels.
- Components: extend `ProposalStatusSelect`, `ChangeConfirmModal`, `ProposalItemDetailPanel`, `Badge`, `SegmentedControl`, `Modal`, and shared editable field controls instead of inventing a parallel design language.

## Component Inventory

| Component                                    | Status | Notes                                                                                                     |
| -------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------- |
| Proposal lifecycle status control            | Modify | Keep `ProposalStatusSelect`, but separate lifecycle stage from revision session state.                    |
| Revision session summary card                | New    | Fold this into the project status control instead of creating separate sidebar revision chips.            |
| Start revision modal                         | New    | Replaces surprise revision opening with explicit session start.                                           |
| Leave revision confirmation                  | New    | On route change, tab close, or tool switch: save to revision log, keep editing, or discard local draft.   |
| Revision review queue                        | New    | Dedicated list of items with flagged costs or pending revision changes.                                   |
| Flagged-cost filtered Spreadsheet View entry | New    | Status-blocking states should deep-link into Spreadsheet View scoped to flagged items only.               |
| Proposal item detail panel revision compare  | Modify | Becomes the only place that shows previous values and before/after comparisons.                           |
| Proposal item detail panel revision actions  | Modify | Add save-to-log, resolve cost, and next-flagged-item navigation.                                          |
| Spreadsheet revision indicators              | Modify | Keep table calm: show changed/flagged indicators only, no full before/after compare block.                |
| Revision session draft store                 | New    | Shared client state for spreadsheet and detail-panel edits before they are committed to the revision log. |
| Status advance confirmation                  | Modify | Explain what will happen in lifecycle terms and direct users to blockers instead of generic denial.       |

## Key Interactions

### Current Workflow Walkthrough

1. **New project editing**
   The project starts in `in_progress`, which is semantically vague. It is unclear whether this means draft creation, active pricing work, or open revision work.

2. **Advancing status**
   The user changes status through `ProposalStatusSelect`. The control knows about flagged revision items, but the reason for a blocked advance is disconnected from the place where the user fixes it.

3. **Editing after pricing/submission/approval**
   A price-affecting edit can silently flip the project back into `in_progress` by opening a revision on the server. The user experiences this as a status regression rather than a deliberate revision session.

4. **Resolving flagged costs**
   The blocking action lives in a revision cost cell. The user must discover that an amber value is clickable and that it controls whether status can advance.

5. **Understanding what changed**
   The table can show revision compare state, but the item-level story is fragmented. The detail panel only shows current-revision changelog entries, not a full revision workspace.

6. **Leaving mid-revision**
   The current model persists immediately and has no session-safe revision draft workflow. Users do not get a clear "save revision work before leaving" decision.

### Target Workflow Walkthrough

1. **Base proposal state**
   Replace visible `In progress` copy for the pre-pricing state with `Draft`. Keep the lifecycle stages as:
   `Draft` -> `Pricing complete` -> `Submitted` -> `Approved`

2. **Revision as a separate layer**
   When the proposal has passed `Draft`, editing a tracked field does not immediately collapse lifecycle state. Instead the user gets:
   `Start Revision 1.1 from Submitted?`
   The base lifecycle stage remains visible as context.

3. **Open revision session**
   Once started, the **project status control** becomes the primary sidebar/list-area signal:
   `Revision 1.1 in progress`
   `Based on Submitted`
   `3 flagged costs`
   `Unsaved changes`

   Do not duplicate this as separate revision chips or helper cards elsewhere in the sidebar or item-list area.

4. **Editing during revision**
   Users can edit in Spreadsheet View or the Item Detail Panel. Both write into the same session draft store. Spreadsheet View stays scan-first, but it should still show a clear local revision-in-progress state while the user is inside that workspace.

5. **Reviewing previous values**
   Opening the Item Detail Panel shows field-level compare blocks only there:
   `Previous`
   `Current revision draft`
   `Resolve cost`
   `Notes / rationale`

   The Item Detail Panel header should also indicate that a revision is currently in progress so users never lose workflow context while editing one item deeply.

6. **Handling flagged costs**
   Flagged items surface in a review queue with explicit actions:
   `Confirm unchanged cost`
   `Enter revised cost`
   `Next flagged item`
   Status advancement always points back to this queue.

   When the user is blocked at status progression, provide a direct link:
   `Open flagged items in Spreadsheet View`
   That view should open already filtered to only items with flagged costs so the user can resolve them in one focused pass.

7. **Saving revision work**
   Users can explicitly save the current revision session to the revision log without advancing lifecycle status. Session drafts also autosave locally so edits are not lost mid-session.

8. **Leaving the page**
   If the user has unlogged revision draft changes, route exit prompts:
   `Save to revision log`
   `Keep editing`
   `Discard draft`

9. **Closing the revision**
   Once all flagged costs are resolved and the revision is saved, the lifecycle control can move forward again. The confirmation language should reflect the real action:
   `Mark revision pricing complete`
   `Resubmit revision`
   `Approve revision`

## Responsive Behavior

- Desktop: keep lifecycle status and revision session summary visible in the sidebar/top workflow area; open the Item Detail Panel docked right; allow a docked or modal revision review queue depending on viewport width.
- Tablet: collapse the review queue into a full-height overlay while keeping the detail panel full-screen when opened.
- Mobile: treat revision review and item detail as full-screen stacked workspaces with a sticky revision session header and explicit back/save actions.

## Accessibility Requirements

- All revision/session states must be available as text, not color-only cues.
- Flagged-cost items need keyboard-focusable actions, not click-only cell discovery.
- Any link that opens flagged-only Spreadsheet View must move focus into the filtered workspace and clearly announce that the view is scoped to flagged-cost items.
- Leave-page confirmation must trap focus correctly and describe consequences clearly.
- Revision compare sections in the Item Detail Panel must use semantic labels for previous vs revised values.
- Status and revision summaries should announce blocking conditions to screen readers in plain language.
- Maintain visible focus rings using the repo's existing brand focus token patterns.

## Out of Scope

- Redesigning FF&E revision behavior or allowing FF&E to resolve Proposal revision costs.
- Changing the long-term revision-numbering scheme (`MAJOR.MINOR`).
- Full historical revision archive browsing across prior major cycles.
- Proposal export redesign beyond whatever copy changes are needed to match the new workflow language.

## Rollout Plan

1. **Clarify the state model**
   Introduce a UX distinction between lifecycle stage and revision session state. Rename visible pre-pricing `In progress` to `Draft`. Define a derived display state for `Revision X.Y draft/open` without losing the base stage context.

2. **Make revision start explicit**
   Replace the current surprise-open behavior with a one-time `Start Revision` decision when a tracked edit is attempted outside `Draft`.

3. **Add revision session draft behavior**
   Create a shared draft layer used by Spreadsheet View and the Item Detail Panel. Autosave locally during the session. Add explicit `Save to revision log`.

4. **Move compare detail into the Item Detail Panel**
   Remove row-level before/after comparison from the main table. Keep compact badges in Spreadsheet View, but show previous values, revised values, and notes only in the detail panel.

5. **Promote flagged costs into a review queue**
   Add a dedicated queue/worklist and direct every blocked status advance to that queue. Support `confirm existing cost` for quantity-only changes and `enter revised cost` for size/CBM/unit-cost changes.

   Also add a secondary escape hatch from the blocked status UI:
   `Open flagged items in Spreadsheet View`
   This should apply a system-owned flagged-cost filter automatically rather than relying on the user to build the filter manually.

6. **Rewrite status advance copy**
   Change confirmations and blocking states so they talk about the real workflow outcome, for example:
   `Submitted + Revision 1.1 open`
   instead of a generic return to `In progress`.

7. **Add safe-exit behavior**
   On navigation away from an open revision session with unsaved draft changes, require a decision to save to the revision log, continue editing, or discard.

8. **Tune history visibility**
   Keep current-revision change history and prior values inside the Item Detail Panel only, as requested. The table should communicate that an item changed, not narrate the whole diff.

## Clarified Visibility Rules

- The **project status control** is the only revision indicator that should appear in the sidebar or item-list area.
- Do not show separate revision chips, summary cards, or duplicate revision banners beside the item list or sidebar sections.
- **Spreadsheet View** should indicate revision-in-progress within the workspace itself, because the user is actively editing there.
- **Proposal Item Detail Panel** should indicate revision-in-progress within the panel header/body, because that is the canonical single-item revision review surface.
- Previous values and detailed before/after comparison remain **detail-panel only**.
