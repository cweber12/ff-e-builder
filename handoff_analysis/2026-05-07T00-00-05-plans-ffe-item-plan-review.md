# Handoff Analysis

## Update type

New feature implementation planning for FF&E plan-image publishing from the Plans workspace.

This handoff supported a domain/entity-path slice, not a CSS polish pass or a hooks-only refactor. The main goal was to identify the smallest viable end-to-end implementation for a missing image entity type (`item_plan`) and the exact surfaces that needed to change across DB constraints, worker routing, client types, and the first FF&E display surface.

## Initial prompt

```text
TASK FOR CHEAP MODEL:
Repo root:
c:\Projects\_current-projects\ffe-builder

Update type:
new feature implementation planning for FF&E plan-image support

Primary goal:
Identify the smallest viable end-to-end slice to let Plans publish saved FF&E measurement crops into a new FF&E plan-image surface.

Important current context:
- Proposal plan-image publishing from Plans already exists.
- Plans measurement + crop flow already exists.
- The likely missing blocker is a new image entity path for FF&E, not new measurement logic.
- We want the next step to stay intentionally small.
- Prefer one first visible FF&E surface, not a broad rollout.

Inspect only these files unless absolutely necessary:
- src/types/image.ts
- src/types/item.ts
- src/components/FfeItemDetailPanel.tsx
- src/components/ItemsTable.tsx
- src/components/ffe/catalog/CatalogView.tsx
- src/components/shared/ImageFrame.tsx
- src/hooks/queryKeys.ts
- src/hooks/useImages.ts
- src/lib/api/images.ts
- src/lib/api.ts
- src/pages/PlanCanvasPage.tsx
- src/pages/PlanCanvasPage.test.tsx
- api/src/routes/images.ts
- api/src/types.ts
- db/migrations/
- README.md
- docs/architecture.md
- docs/changelog.md

What you may do:
- Read and analyze only.
- Do not make code changes.
- Do not run tests or repo-wide verification.
- Do not redesign the product.

What I need from you:
- Confirm the exact missing domain/entity support for FF&E plan images.
- Identify the smallest backend change.
- Identify the smallest frontend change.
- Recommend exactly one first FF&E surface to update.
- Identify the exact change needed back in Plans after the entity exists.
- Call out any compile-time/type traps, ownership traps, and cache traps.
- Use exact repo-relative file paths everywhere.

Return your response in EXACTLY this format:

## 1. Missing Domain Surface
- Exact missing entity/type:
- Exact repo-relative files that prove it:
- Closest existing model to copy:
- Why this is definitely the real blocker (not a UI-only issue):

## 2. Smallest Viable Next Slice
- Recommended next slice:
- Why this is the right next step now:
- Must-do-now files:
- Same-pass files:
- Can-defer files:

## 3. Backend Change Summary
- Existing worker/storage path to copy:
- Exact repo-relative files:
- Whether DB migration is definitely required, probably required, or conditional:
- Smallest viable backend implementation:
- Ownership/authorization trap to avoid:

## 4. Frontend Change Summary
- Existing generic client support that already works:
- Exact repo-relative files:
- Smallest viable frontend implementation:
- Exact first FF&E surface to update:
- Surfaces to defer:

## 5. Plans Integration Follow-Up
- Exact change needed in src/pages/PlanCanvasPage.tsx after the entity exists:
- Can the current proposal-only save flow be generalized cleanly:
- Any state/nullability traps to watch:

## 6. Test Targets
- Best exact test files to extend first:
- What they already cover:
- What new tests belong in this slice only:
- Any test setup traps to watch:

## 7. Reuse vs Missing
- Reuse directly:
- Reuse with adaptation:
- Missing and must be built:
- Explicitly defer:

## 8. Risks That Matter
- Highest-risk implementation trap:
- Highest-risk type trap:
- Highest-risk cache/render trap:
- Exact repo-relative files for each:

## 9. Recommended Working Order
- Step 1:
- Step 2:
- Step 3:

Rules:
- Be concise and concrete.
- Use exact repo-relative paths.
- Separate “already exists” from “missing”.
- Separate “must-do-now” from “can-defer”.
- If something is uncertain, label it as uncertain instead of implying it exists.
- Prefer smallest viable implementation over ideal architecture.
- Do not suggest broader UX redesign.
- Do not mention files outside the allowed scope unless absolutely necessary; if you must, label them as “out-of-scope but relevant”.
```

## Cheap agent response

```text
1. Missing Domain Surface
Exact missing entity/type: 'item_plan' — a new ImageEntityType variant for FF&E item plan images published from the Plans workspace.

Exact repo-relative files that prove it:

image.ts — ImageEntityType union has 8 members; 'item_plan' is absent
0013_ffe_item_options.sql — image_assets_entity_type_chk constraint enumerates all 8 values; 'item_plan' is not in it
images.ts — getOwnedEntityContext() routes item, item_option through getOwnedItemContext; no 'item_plan' branch (falls through to the same item path, which would work, but without an explicit branch the R2 key is wrong — it would reuse the item path)
images.ts lines ~170–175 — buildR2Key() has no 'item_plan' case; it would silently fall through to the generic item key, colliding with the primary item rendering
PlanCanvasPage.tsx lines 336–337, 491–492 — canSavePlanImage and handleSavePlanImage hard-code targetKind !== 'proposal' guards; FF&E path (targetKind === 'ffe') is explicitly excluded
Closest existing model to copy: 'proposal_plan' — same pattern: one image per item, upload-then-crop, R2 key under item's subtree, getOwnedItemContext resolves ownership (not getOwnedProposalItemContext)

Why this is definitely the real blocker (not a UI-only issue): The DB CHECK constraint on image_assets.entity_type would reject an INSERT with entity_type = 'item_plan' with a DB error before it ever reaches R2. No frontend workaround exists — the value must be added to the constraint via migration first.

2. Smallest Viable Next Slice
Recommended next slice: Add 'item_plan' end-to-end: DB migration + Worker type + R2 key path + unique index, then expose a read-only PanZoomFrame/ImageFrame in FfeItemDetailPanel.tsx.

Why this is the right next step now: The proposal_plan surface is already fully working — this is a near-copy. The UI display in FfeItemDetailPanel.tsx is the most direct first-visible surface. Plans publishing for FF&E can be unlocked in the same pass.

Must-do-now files:

db/migrations/0017_ffe_item_plan.sql (new)
types.ts — add 'item_plan' to the ImageEntityType type definition
images.ts — add 'item_plan' to buildR2Key(), imageInsertErrorMessage(), getOwnedEntityContext() (already falls through to item path but needs an explicit branch for correct R2 key)
image.ts — add 'item_plan' to ImageEntityType, CROPPABLE_ENTITY_TYPES, CROP_ASPECT
FfeItemDetailPanel.tsx — add read-only plan image section (mirror the Proposal detail panel pattern)
PlanCanvasPage.tsx — generalize handleSavePlanImage and canSavePlanImage to cover targetKind === 'ffe'
Same-pass files:

PlanCanvasPage.test.tsx — new test: "Save as plan image" button visible for ffe measurement with saved crop
changelog.md — one-line entry
Can-defer files:

CatalogView.tsx — plan image column in catalog PDF
src/components/ItemsTable.tsx — plan image cell in the FF&E table
Any FF&E export changes
3. Backend Change Summary
Existing worker/storage path to copy: 'proposal_plan' branch in images.ts — same getOwnedEntityContext() → getOwnedItemContext() shape. The only structural difference is the R2 key path and unique-constraint behavior.

Exact repo-relative files:

images.ts
types.ts (add 'item_plan' to ImageEntityType union)
db/migrations/0017_ffe_item_plan.sql (new)
ownership.ts — no change needed; getOwnedItemContext already exists and is correct
Whether DB migration is definitely required: Definitely required. The image_assets_entity_type_chk constraint is a DB-level CHECK; any INSERT with entity_type = 'item_plan' will fail until the constraint is updated. The migration must also add a unique index to enforce one-plan-image-per-item and update the shape constraint.

Smallest viable backend implementation:

Migration drops/recreates image_assets_entity_type_chk to add 'item_plan', drops/recreates image_assets_entity_shape_chk to add an item_plan arm (same shape as item/item_option: room_id NOT NULL, item_id NOT NULL, material_id IS NULL, proposal_item_id IS NULL), adds UNIQUE INDEX image_assets_primary_item_plan_idx ON image_assets(item_id, entity_type) WHERE is_primary AND entity_type = 'item_plan'
In buildR2Key(): add if (entityType === 'item_plan') return \
b
a
s
e
/
r
o
o
m
s
/
base/rooms/{context.roomId}/items/
c
o
n
t
e
x
t
.
i
t
e
m
I
d
/
p
l
a
n
/
context.itemId/plan/{imageId}.{ext}``
In getOwnedEntityContext(): add explicit if (entityType === 'item_plan') branch calling getOwnedItemContext (functionally identical to falling through, but explicit is safer for future code)
In imageInsertErrorMessage(): add if (entityType === 'item_plan') return 'This item already has a plan image'
Ownership/authorization trap to avoid: 'item_plan' uses getOwnedItemContext (joins items → rooms → projects) — not getOwnedProposalItemContext. If the wrong resolver is used, uploads for FF&E items to an entityId that is a proposal item UUID would silently succeed with wrong ownership. The branch must call getOwnedItemContext explicitly.

4. Frontend Change Summary
Existing generic client support that already works: Everything in images.ts — imagesApi.list, imagesApi.upload, imagesApi.setCrop, imagesApi.delete — is generic over ImageEntityType. Adding 'item_plan' to the union type is sufficient for them to accept it. useImages, useUploadImage, imageKeys.forEntity in hooks are likewise generic.

Exact repo-relative files:

image.ts — type-only change
FfeItemDetailPanel.tsx — add plan image ImageSection
PlanCanvasPage.tsx — generalize save handler
Smallest viable frontend implementation:

image.ts: add 'item_plan' to union, CROPPABLE_ENTITY_TYPES, CROP_ASPECT (use same 103/75 ratio as proposal_plan)
FfeItemDetailPanel.tsx: add an <ImageSection label="Plan"> with <ImageFrame entityType="item_plan" entityId={item.id} ... disabled /> next to the existing "Rendering" and "Options" sections — read-only, same disabled prop as current "Rendering"
PlanCanvasPage.tsx: change canSavePlanImage to selectedMeasurement?.targetKind === 'proposal' || selectedMeasurement?.targetKind === 'ffe'; change handleSavePlanImage to branch on targetKind for entityType ('proposal_plan' vs 'item_plan') and the UI button condition from targetKind === 'proposal' to always-visible when crop is saved
Exact first FF&E surface to update: FfeItemDetailPanel.tsx — already has the ImageSection helper, already imports ImageFrame, already shows Rendering and Options panels; adding Plan is a 10-line addition.

Surfaces to defer: CatalogView.tsx (catalog PDF), src/components/ItemsTable.tsx (inline table cell) — both are higher complexity and don't gate the core publish flow.

5. Plans Integration Follow-Up
Exact change needed in PlanCanvasPage.tsx after the entity exists:

canSavePlanImage (line ~336): remove targetKind === 'proposal' guard — condition becomes just savedCropParams !== null && planNaturalSize.width > 0 && ...
handleSavePlanImage (line ~490): add const entityType = selectedMeasurement.targetKind === 'ffe' ? 'item_plan' : 'proposal_plan' and use it in all three api.images.* calls
Crop sidebar button/hint (lines ~1169, ~1181): remove the targetKind === 'proposal' visibility guard so it renders for both kinds; update hint copy
Can the current proposal-only save flow be generalized cleanly: Yes. The entire save sequence (list existing → delete all → download plan blob → upload → setCrop → setQueryData) is entity-type-agnostic. The only variable is entityType and the imageKeys.forEntity cache key — both are already parameterized by entityType string. A single const entityType = ... local variable branches the logic cleanly with no structural change.

Any state/nullability traps to watch:

queryClient.setQueryData(imageKeys.forEntity('proposal_plan', ...)) is currently hard-coded. After generalization it must use the computed entityType variable or the item_plan cache key will never be populated and FfeItemDetailPanel will stay empty until next query refetch.
handleSavePlanImage currently guards selectedMeasurement.targetKind !== 'proposal' — removing this guard requires ensuring selectedMeasurement.targetItemId is a valid FF&E item UUID, not a proposal item UUID. It is — targetItemId is always the direct item the measurement was associated with, so no additional guard is needed.
6. Test Targets
Best exact test files to extend first:

PlanCanvasPage.test.tsx — already has the full mock setup including measurements with targetKind: 'ffe'
What they already cover: Crop guidance panel render for targetKind='ffe' (test 3), "Save as plan image" button for targetKind='proposal' (test 4)

What new tests belong in this slice only:

Test: "Save as plan image" button visible and enabled for targetKind='ffe' with saved crop
Test: "Save as plan image" button absent/disabled for targetKind='ffe' without saved crop (the existing measurement-1 fixture has no crop, so it's ready to use)
Optionally: images.ts worker test for item_plan upload → stored at correct R2 key (but this is in test which is a separate Vitest config)
Any test setup traps to watch: The measurement-1 fixture (targetKind: 'ffe', no crop) is already in the test mock. The measurement-2 fixture (targetKind: 'proposal', with crop) is also there. For a new "ffe with crop" test you'll need to add a third mock measurement or patch measurement-1 to include cropX/Y/Width/Height. Changing measurement-1 would break test 3 (which asserts no crop guidance without a crop), so add a new fixture measurement instead.

7. Reuse vs Missing
Reuse directly: getOwnedItemContext (ownership), imagesApi.* client functions, useImages / useUploadImage hooks, imageKeys.forEntity, ImageFrame component, handleSavePlanImage logic structure, buildR2Key pattern

Reuse with adaptation: imageInsertErrorMessage (add item_plan branch), getOwnedEntityContext (add explicit item_plan arm), canSavePlanImage / handleSavePlanImage in PlanCanvasPage (add entityType branch), image_assets_entity_type_chk and entity_shape_chk constraints (drop/recreate with item_plan added)

Missing and must be built: db/migrations/0017_ffe_item_plan.sql, the item_plan R2 key path in buildR2Key(), unique index image_assets_primary_item_plan_idx

Explicitly defer: Plan image cell in CatalogView.tsx, plan image cell in src/components/ItemsTable.tsx, catalog PDF export with item plan image, any FF&E-specific crop aspect ratio tuning

8. Risks That Matter
Highest-risk implementation trap: R2 key collision. If buildR2Key() falls through without an explicit 'item_plan' branch it uses the generic item path (rooms/.../items/.../imageId.ext), which is the same path as the 'item' primary rendering. An item_plan upload would overwrite a rendering at the R2 level without any DB-level collision (different entity_type). Explicit branch is mandatory.

File: images.ts
Highest-risk type trap: Adding 'item_plan' to ImageEntityType may surface exhaustiveness gaps in existing switch/conditional blocks that pattern-match on ImageEntityType. The most likely location is CROP_ASPECT (a Partial<Record<>> so not exhaustive — safe) and CROPPABLE_ENTITY_TYPES (a Set — only matters if something iterates it). The imageInsertErrorMessage switch in images.ts is the only place where a missing item_plan case returns null instead of a user-facing message, which would cause a 409 with no message — not a compile error but a silent UX failure.

Files: image.ts, images.ts
Highest-risk cache/render trap: queryClient.setQueryData at the end of handleSavePlanImage is currently hard-coded to imageKeys.forEntity('proposal_plan', ...). After generalizing, this must use the computed entityType variable. If it remains hard-coded to 'proposal_plan', the FfeItemDetailPanel will not auto-update after publish — it uses useImages('item_plan', item.id) which is a different cache key. The item plan image will only appear after the next background refetch.

File: PlanCanvasPage.tsx
9. Recommended Working Order
Step 1 (DB + Worker): Write db/migrations/0017_ffe_item_plan.sql — drop/recreate constraints to add 'item_plan', add unique index. Then update types.ts and images.ts (explicit buildR2Key branch, getOwnedEntityContext branch, imageInsertErrorMessage branch). Run pnpm migrate and deploy Worker.

Step 2 (Types + display surface): Add 'item_plan' to image.ts (ImageEntityType, CROPPABLE_ENTITY_TYPES, CROP_ASPECT). Add the plan image ImageSection to FfeItemDetailPanel.tsx. At this point the display surface exists and can be manually verified (though empty until Step 3).

Step 3 (Plans integration + tests): Generalize handleSavePlanImage and canSavePlanImage in PlanCanvasPage.tsx to handle both targetKind values. Fix the hard-coded 'proposal_plan' cache key to use the computed entityType. Update button/hint visibility. Extend PlanCanvasPage.test.tsx with the FF&E crop-save button test.
```

## What was very helpful

- It correctly identified that this was a missing domain/entity-path problem, not a UI polish problem. That reduced a lot of unnecessary exploration.
- It proved the backend blocker with a concrete DB constraint argument instead of just saying “add a new type”.
- It pointed to the exact three critical implementation seams:
  - DB constraint + unique index
  - worker `buildR2Key()` branch
  - `PlanCanvasPage.tsx` cache key generalization
- It recommended one first visible FF&E surface instead of broadening the rollout. Choosing `FfeItemDetailPanel.tsx` kept the slice small.
- The “reuse vs missing” split was high value for this kind of feature planning pass.
- The state/cache trap about `imageKeys.forEntity('proposal_plan', ...)` being hard-coded was especially valuable and prevented a likely stale-render bug.
- The response matched the requested shape well enough that implementation could follow it almost mechanically.

## What was helpful but could have been better

- It used shortened file names like `image.ts`, `images.ts`, and `types.ts` instead of exact repo-relative paths in several places. The prompt asked for exact repo-relative paths everywhere, so this weakened direct actionability.
- It mixed certainty levels a little. For example, some “would work” statements around ownership routing and fallthrough behavior should have been labeled more explicitly as inference from code paths.
- The frontend recommendation called for a read-only `PanZoomFrame/ImageFrame` in `FfeItemDetailPanel.tsx`, but it did not clearly choose one. That left a small decision back on the main agent.
- It suggested a test strategy that would have preferred a third fixture for FF&E-with-crop; that was useful, but it could have gone one step further and say whether reusing the existing FF&E fixture by changing its crop values was acceptable if the crop-guidance test did not rely on missing crop state.

## What was not helpful

- The mangled multi-line `buildR2Key()` string in the backend section was noisy and lower trust. It was clearly trying to present a path template but formatting corruption made it less usable.
- Mentioning `ownership.ts` without a repo-relative path or explicit need was mildly distracting because this slice did not require an ownership helper change.
- The optional worker test mention was lower value in this handoff because the immediate implementation path was already obvious and the main repo test seam was on the client/workspace side.

## What was missing that would have helped

- A direct note that the cheap-agent-guessed path `src/components/FfeItemDetailPanel.tsx` might be wrong, with advice to verify the actual component location before implementation. The real file lived under `src/components/ffe/items/FfeItemDetailPanel.tsx`.
- A stronger callout that `docs/images.md` should also be updated, not just `README.md`, `docs/architecture.md`, and `docs/changelog.md`, because this slice introduced a new public image entity type and R2 key shape.
- A concise “minimum edited files” list using exact repo-relative paths only, with no commentary, would have reduced the need to normalize names mentally.
- It could have explicitly said whether `src/lib/api/images.ts`, `src/hooks/useImages.ts`, and `src/hooks/queryKeys.ts` required no code changes or merely appeared not to. That distinction matters when trying to minimize reads.

## Generic instructions / terms / keywords for this use case

- “Prove the blocker is domain/backend, not UI-only.”
- “Use exact repo-relative paths everywhere.”
- “Separate reuse directly / reuse with adaptation / missing and must be built.”
- “Prefer the smallest viable vertical slice.”
- “Recommend exactly one first visible surface.”
- “Call out cache-key traps explicitly.”
- “Call out ownership/authorization traps explicitly.”
- “Distinguish certainty from inference.”
- “List must-do-now files separately from same-pass and can-defer files.”
- “If a likely component path may be nested, verify the actual path before recommending edits.”
- “For new entity types, include docs impact: README, architecture, and image/storage docs.”
- “When discussing tests, say whether existing fixtures can be safely reused or require a new fixture.”

## Anything else that may help next time

- For feature-planning handoffs that add a new entity type, the most useful prompt shape is:
  1. prove missing domain support
  2. identify the smallest backend delta
  3. identify the smallest first-visible frontend surface
  4. identify the exact follow-up change back in the originating feature
  5. identify the highest-risk cache and storage collision traps
- The cheap agent did best here when it was forced to stay narrow and compare against an already-working sibling path (`proposal_plan`).
- For repo efficiency, a future version of this prompt should explicitly ask:
  - “Which files definitely require edits?”
  - “Which files definitely do not require edits?”
    That would further reduce unnecessary follow-up reads by the main agent.
