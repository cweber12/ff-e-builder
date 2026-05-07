# Plans Plan Image Slice Handoff Review

Date: `2026-05-07`

## Initial Prompt

```text
TASK FOR CHEAP MODEL:
Scope:
- src/pages/PlanCanvasPage.tsx
- src/lib/api/plans.ts
- src/lib/api/mappers.ts
- src/lib/api.ts
- src/hooks/plans/usePlans.ts
- src/hooks/queryKeys.ts
- src/types/plan.ts
- src/types/item.ts
- src/types/proposal.ts
- src/components/shared/CropModal.tsx
- src/components/FfeItemDetailPanel.tsx
- src/components/ProposalItemDetailPanel.tsx
- src/components/ItemsTable.tsx
- src/components/proposal/ProposalTable.tsx
- src/lib/api/images.ts
- src/hooks/useUploadImage.ts
- api/src/routes/plans.ts
- api/src/routes/images.ts
- api/src/types.ts
- docs/architecture.md
- README.md
- docs/changelog.md

Goal:
Gather exact implementation context for the next Plans slice:
save a derived item Plan Image from a selected measurement + crop.

Important:
Do not redesign the product.
Assume the current direction is correct:
- measurement rectangle is canonical
- crop is separate framing
- crop is already saved on the measurement
- next step is to create/store the item-facing Plan Image artifact from that saved crop

Return findings in EXACTLY this format:

## 1. Current Reusable Save Paths
- Existing image-save/upload paths already in the repo:
- Exact repo-relative files:
- Which of these are directly reusable for derived Plan Image save:
- Which are similar but should NOT be reused:

## 2. Best Next Slice
- Recommended next implementation slice:
- Why this is the highest-value next step now:
- Must-do-now files:
- Same-pass files:
- Can-defer files:

## 3. Derived Plan Image Readiness
- What already exists for crop data persistence:
- What already exists for item/plan image persistence:
- Exact repo-relative files:
- Missing pieces required to turn saved crop data into a stored item Plan Image:
- Whether new API surface is required or an existing path can be reused:

## 4. Source Image -> Cropped Artifact Path
- Best current code path for reading protected Measured Plan image bytes:
- Best current code path for creating/storing image artifacts:
- Where client-side crop/export logic already exists, if anywhere:
- Exact repo-relative files:
- Smallest viable implementation path for this repo:

## 5. Item Attachment Surface
- Existing FF&E item image/plan image surfaces:
- Existing Proposal item image/plan image surfaces:
- Exact repo-relative files:
- What minimum UI change is needed so the new derived Plan Image is visible after save:
- What should explicitly be deferred:

## 6. Risks / Traps
- Nullability or state-shape traps to watch:
- Image-type / entity-type traps to watch:
- Client-vs-worker boundary traps to watch:
- Any likely duplicate-render or stale-cache risks:
- Exact repo-relative files:

## 7. Tests To Extend
- Best existing tests to extend first:
- Exact repo-relative files:
- What they already cover:
- What new tests should be added in this slice only:

## 8. Recommended Working Order
- Step 1:
- Step 2:
- Step 3:

## 9. Reuse vs Missing Summary
- Reuse directly:
- Reuse with adaptation:
- Missing and must be built:
- Explicitly defer:

Rules:
- Use exact repo-relative file paths everywhere.
- Separate “already exists” from “missing”.
- Mark recommendations as must-do-now / same-pass / can-defer.
- If a reuse pattern does NOT actually exist, say that explicitly.
- Prefer smallest viable implementation over ideal architecture.
- Do not suggest new product behavior outside this slice.
- If you mention a risk, cite the file that shows it.
- Be concise and concrete.
```

## Agent Response

```text
1. Current Reusable Save Paths
Existing image-save/upload paths already in the repo:

imagesApi.upload({ entityType, entityId, file }) — uploads a File to R2, inserts DB row, returns ImageAsset. Accepts any ImageEntityType. images.ts lines 38–57
imagesApi.setCrop(imageId, CropParams) — PATCH crop_x/y/width/height (percentages, 0..1) on an existing image asset. images.ts lines 91–97
plansApi.downloadContent(projectId, planId) — returns the protected Measured Plan source image as a Blob. plans.ts line 226
useUploadImage(entityType, entityId) — TanStack useMutation wrapping imagesApi.upload; onSuccess auto-updates imageKeys.forEntity cache. useImages.ts line 45
useUpdateImageCrop(entityType, entityId) — TanStack mutation wrapping imagesApi.setCrop. useImages.ts (imported in ImageFrame)
ImageFrame — full upload/crop/delete UI atom; accepts any ImageEntityType, disabled prop for read-only. ImageFrame.tsx
Exact repo-relative files:

images.ts
useImages.ts
plans.ts (downloadContent)
ImageFrame.tsx
Which are directly reusable for derived Plan Image save:

plansApi.downloadContent — get the source bytes
imagesApi.upload with entityType='proposal_plan' and entityId=measurement.targetItemId — stores the image for Proposal items (R2 key + DB row already handled by existing Worker route)
imagesApi.setCrop — apply the display crop params (percentage-converted) after upload
imageKeys.forEntity — cache key for query invalidation after save; already used in useUploadImage.onSuccess
Which are similar but should NOT be reused:

CropModal (src/components/shared/CropModal.tsx) — this is a UI picker for display crop params; it stores 0..1 percentages intended for setCrop. Not relevant for deriving a plan image from measurement crop geometry.
imagesApi.setCrop for setting crop on an 'item' entity — not applicable since FF&E items have no plan image entity type.
2. Best Next Slice
Recommended next implementation slice:
Save a derived plan image for Proposal items only: from the Plans canvas, when selectedMeasurement.targetKind === 'proposal' and all four crop fields are non-null, add a "Save as plan image" button that downloads the plan blob, uploads it as entityType='proposal_plan' for the proposal item, and calls setCrop with percentage-converted crop params. Defer FF&E items entirely.

Why this is the highest-value next step now:
The 'proposal_plan' entity type already exists end-to-end: DB schema, R2 key builder, Worker ownership/upload routes, imageKeys.forEntity cache, and ImageFrame/PanZoomFrame rendering in ProposalTable and ProposalItemDetailPanel. The crop coords and the source image are already available in context. No new API surface is needed. Completing this makes the Plans workspace produce a visible, persisted artifact in the existing Proposal view with zero new rendering work.

Must-do-now files:

PlanCanvasPage.tsx — add onNaturalSizeChange callback prop to PlanViewport, lift plan image natural dimensions to outer scope (required for percentage conversion), add handler + button in crop sidebar panel
Same-pass files:

useImages.ts — may need useDeleteImage called before re-upload if plan image already exists (unique constraint), or use useUploadImage with delete-first logic in the handler
Can-defer files:

FfeItemDetailPanel.tsx — no plan image surface for FF&E items; requires a new entity type
ItemsTable.tsx — same
images.ts — no changes needed for Proposal items; FF&E plan images would need a new entity type + R2 key path
image.ts — adding 'item_plan' entity type is a defer
3. Derived Plan Image Readiness
What already exists for crop data persistence:

measurements DB table: crop_x, crop_y, crop_width, crop_height (nullable double precision, raw pixel coords in plan image space). 0015_plans_tool.sql
Measurement type: cropX/Y/Width/Height: number | null. plan.ts
handleSaveCrop in PlanCanvasPage saves all four via updateMeasurement.mutateAsync. PlanCanvasPage.tsx lines 400–430
What already exists for item/plan image persistence:

image_assets DB table with entity_type = 'proposal_plan', proposal_item_id FK
Worker: POST /api/v1/images?entity_type=proposal_plan&entity_id={proposalItemId} — routes through getOwnedProposalItemContext, writes to R2 at users/{uid}/projects/{projectId}/proposal/items/{proposalItemId}/plan/{imageId}.{ext}, inserts DB row. images.ts lines 127–140, 265
ImageFrame entityType="proposal_plan" fully rendered in ProposalTable (line 721) with upload+crop UI and in ProposalItemDetailPanel (line 69) as read-only PanZoomFrame. src/components/proposal/table/ProposalTable.tsx, ProposalItemDetailPanel.tsx
CROPPABLE_ENTITY_TYPES includes 'proposal_plan'. image.ts line 41
CROP_ASPECT['proposal_plan'] = 103/75. image.ts line 50
Exact repo-relative files:

src/types/image.ts, plan.ts
images.ts (lines 127–140, 265)
ProposalItemDetailPanel.tsx (line 69)
ProposalTable.tsx (line 721)
Missing pieces required to turn saved crop data into a stored item Plan Image:

A way to pass plan image natural dimensions (naturalSize.width/height) from PlanViewport to PlanCanvasPage — currently naturalSize is local state inside PlanViewport (src/pages/PlanCanvasPage.tsx line 1200); not accessible in the outer scope where handleSaveCrop lives
A "Save as plan image" button + handler in the Crop sidebar panel (gated on targetKind === 'proposal' AND all four crop fields non-null)
Percentage conversion: cropXPercent = cropX / naturalSize.width (0..1) before calling imagesApi.setCrop
Delete-then-replace logic: proposal_plan has a unique constraint per item (api/src/routes/images.ts line 72: "This row already has a plan image"); a second save attempt will 400 without first deleting the existing image
Whether new API surface is required or an existing path can be reused:
No new API surface required for Proposal items. POST /api/v1/images with entity_type=proposal_plan and PATCH /api/v1/images/:id/crop are already in place.

4. Source Image → Cropped Artifact Path
Best current code path for reading protected Measured Plan image bytes:
plansApi.downloadContent(projectId, planId) → returns Blob via apiFetchResponse(...).blob(). plans.ts line 226. The plan image is in a private R2 bucket; this is the only client-accessible path.

Best current code path for creating/storing image artifacts:
imagesApi.upload({ entityType: 'proposal_plan', entityId: proposalItemId, file }) where file = new File([blob], 'plan.png', { type: blob.type }). images.ts lines 38–57. This goes through compressImage before upload — be aware the plan image will be recompressed; consider skipping compression by uploading the raw blob directly if fidelity matters (would require a bypass option or calling the Worker route directly without compressImage).

Best current code path for creating/storing image artifacts (crop display):
imagesApi.setCrop(imageId, { cropX, cropY, cropWidth, cropHeight }) where all values are 0..1 fractions. images.ts lines 91–97. The Worker stores these on the DB row; ImageFrame reads them for visual display.

Where client-side crop/export logic already exists, if anywhere:
None. The existing crop system stores display percentages only — no canvas pixel extraction, no OffscreenCanvas, no server-side image crop. CropModal (src/components/shared/CropModal.tsx) uses react-easy-crop to select a region but only returns percentage params, not cropped image bytes.

Exact repo-relative files:

plans.ts (line 226, downloadContent)
images.ts (upload, setCrop)
CropModal.tsx (display-only crop modal — NOT for pixel extraction)
Smallest viable implementation path for this repo:

Add onNaturalSizeChange prop to PlanViewport, call it in the onLoad handler alongside setNaturalSize
Lift planNaturalSize as state to PlanCanvasPage
In handleSavePlanImage (new): download plan blob → new File([blob], ...) → imagesApi.upload → imagesApi.setCrop with cropX / planNaturalSize.width etc.
Gate the button on selectedMeasurement.targetKind === 'proposal' and all four crop fields non-null
5. Item Attachment Surface
Existing FF&E item image/plan image surfaces:

FfeItemDetailPanel.tsx: shows "Rendering" (entityType='item') and "Options" (ItemOptionImagesPanel). No plan image section. FfeItemDetailPanel.tsx lines 57–64
ItemsTable.tsx: ImageFrame entityType="item" in row cell (line 496) and item drawer (line 982). No plan image surface.
CatalogView.tsx: ImageFrame entityType="item" with fallbackUrl={item.imageUrl} (line 397). No plan image surface.
'item_plan' entity type does NOT exist in ImageEntityType union. image.ts lines 1–8
Existing Proposal item image/plan image surfaces:

ProposalTable.tsx line 721: ImageFrame entityType="proposal_plan" entityId={item.id} — full upload/crop/delete UI, renders the plan image cell in the table. ProposalTable.tsx
ProposalItemDetailPanel.tsx line 69: PanZoomFrame entityType="proposal_plan" — fetches and renders as pan-zoom read-only view. Already calls useImages('proposal_plan', item.id). ProposalItemDetailPanel.tsx
Exact repo-relative files:

ProposalTable.tsx (line 721)
ProposalItemDetailPanel.tsx (line 69)
FfeItemDetailPanel.tsx
image.ts
What minimum UI change is needed so the new derived Plan Image is visible after save:
None for Proposal items. useUploadImage.onSuccess already calls queryClient.setQueryData(imageKeys.forEntity('proposal_plan', proposalItemId), ...) which triggers re-render in both ProposalTable and ProposalItemDetailPanel with no further changes.

What should explicitly be deferred:

FF&E item plan image: requires adding 'item_plan' to ImageEntityType, a new R2 key path and Worker ownership resolver, and a new UI section in FfeItemDetailPanel/ItemsTable
Upload button inside PanZoomFrame in ProposalItemDetailPanel: currently read-only by design; ProposalTable.ImageFrame already handles upload for the same entity
6. Risks / Traps
Nullability / state-shape traps:

measurement.cropX/Y/Width/Height are each number | null. Must check all four are !== null (not just truthy — 0 is falsy but valid). canSaveCrop already guards on normalizedCropDraft, but the "Save as plan image" button must separately check the saved crop fields on selectedMeasurement. PlanCanvasPage.tsx canSaveCrop area, plan.ts
Image-type / entity-type traps:

proposal_plan upload routes through getOwnedProposalItemContext — it expects a proposalItemId. For measurement.targetKind === 'ffe', the targetItemId is an FF&E item ID, which would fail the ownership check. Must gate on targetKind === 'proposal'. images.ts lines 127–140
compressImage is called inside imagesApi.upload before PUT. Plan images can be high-resolution source images; compression may reduce fidelity noticeably. Watch for quality loss. images.ts line 43
Client-vs-worker boundary traps:

plansApi.downloadContent uses apiFetchResponse (authenticated). After downloading, the Blob must be converted to a File before calling imagesApi.upload. The Worker re-verifies auth on the upload call independently — two round trips, both authenticated.
The proposal_plan unique constraint (api/src/routes/images.ts line 72) means the second "Save as plan image" for the same proposal item will 400. The handler must either list existing images and delete first, or catch the error and surface it. api.images.list({ entityType: 'proposal_plan', entityId: proposalItemId }) + api.images.delete(existingImage.id) is the safe path.
Likely duplicate-render or stale-cache risks:

useUploadImage.onSuccess calls queryClient.setQueryData (optimistic set), then the query may refetch if enabled: true. If the delete-before-upload step invalidates the imageKeys.forEntity cache, a brief empty-state flash is possible in ProposalTable. Prefer setQueryData over invalidateQueries to avoid the flash. useImages.ts useDeleteImage.onSuccess calls both setQueryData AND invalidateQueries — the invalidation refetch may cause a race if upload follows immediately.
Exact repo-relative files:

PlanCanvasPage.tsx (nullability guard, targetKind check)
images.ts (line 72, unique constraint message; lines 127–140, ownership routing)
images.ts (line 43, compressImage call)
useImages.ts (useDeleteImage.onSuccess with both setQueryData + invalidateQueries)
7. Tests To Extend
Best existing tests to extend first:

PlanCanvasPage.test.tsx — already mocks useUpdatePlanMeasurement, usePlanMeasurements (with crop fields); has 3 tests including the new crop guidance test. Best base for a "Save as plan image" button visibility test.
plans.test.ts — 15 tests; has updateMeasurement with crop fields. No plan image tests yet. Extend for any new plansApi helpers if added.
useImages.test.tsx — 4 tests for useImages and useUploadImage; the proposal_plan scenario is not covered. Best for testing the upload + setCrop sequence.
Exact repo-relative files:

PlanCanvasPage.test.tsx
useImages.test.tsx
plans.test.ts (only if new plansApi functions are added)
What they already cover:

PlanCanvasPage.test.tsx: crop guidance panel render, "Save crop" button disabled-until-draft, measurement hooks mocked with null crop fields, useUpdatePlanMeasurement mock
useImages.test.tsx: useUploadImage mutation success and cache update for generic entity; useImages query with enabled guard
plans.test.ts: updateMeasurement with non-null crop fields, deleteMeasurement DELETE call
What new tests should be added in this slice only:

PlanCanvasPage.test.tsx: "Save as plan image" button visible when targetKind === 'proposal' and saved crop is non-null; button absent or disabled when targetKind === 'ffe'
PlanCanvasPage.test.tsx: on "Save as plan image" click, plansApi.downloadContent and imagesApi.upload are called with correct args (mock both)
No new useImages test needed unless the delete-before-replace logic lives in a new hook
8. Recommended Working Order
Step 1: Add onNaturalSizeChange: (size: { width: number; height: number }) => void prop to PlanViewport, call it in the onLoad handler (src/pages/PlanCanvasPage.tsx line 1600). Lift planNaturalSize as state to PlanCanvasPage. This unblocks percentage conversion without any architectural risk.

Step 2: Add handleSavePlanImage in PlanCanvasPage outer scope: check selectedMeasurement.targetKind === 'proposal' and all four crop fields non-null → list existing proposal_plan images for the item → delete if present → download plan blob → imagesApi.upload → imagesApi.setCrop with (cropX / planNaturalSize.width) etc. Add a "Save as plan image" button to the Crop sidebar panel gated on those conditions. Add a canSavePlanImage boolean alongside canSaveCrop.

Step 3: Extend tests: add PlanCanvasPage tests for button visibility/disable conditions (mock api.plans.downloadContent and api.images); confirm the existing ProposalTable and ProposalItemDetailPanel render the image via cache without UI changes.

9. Reuse vs Missing Summary
Reuse directly:

plansApi.downloadContent (plan source blob)
imagesApi.upload with entityType='proposal_plan'
imagesApi.setCrop (percentage crop params)
api.images.list + api.images.delete (delete-before-replace)
imageKeys.forEntity('proposal_plan', ...) (cache key)
useUploadImage.onSuccess cache update (no extra invalidation needed)
ImageFrame entityType="proposal_plan" in ProposalTable (already renders, no UI change)
PanZoomFrame entityType="proposal_plan" in ProposalItemDetailPanel (already renders, no UI change)
Reuse with adaptation:

imagesApi.setCrop — needs raw pixel → 0..1 percentage conversion (cropX / planNaturalSize.width); requires lifting naturalSize out of PlanViewport
imagesApi.upload — passes through compressImage; may want to bypass for plan source images to avoid fidelity loss (optional, can defer)
Missing and must be built:

onNaturalSizeChange prop on PlanViewport + planNaturalSize state in PlanCanvasPage
handleSavePlanImage handler with delete-then-upload-then-setCrop sequence
"Save as plan image" button in crop sidebar panel with canSavePlanImage guard
Percentage conversion inline: cropX / planNaturalSize.width etc.
Guard: selectedMeasurement.targetKind === 'proposal' (FF&E path is not supported)
Explicitly defer:

FF&E item plan image ('item_plan' entity type, new R2 key, Worker ownership, FfeItemDetailPanel UI section)
Upload capability inside PanZoomFrame in ProposalItemDetailPanel (currently read-only)
compressImage bypass for plan source fidelity
Plan image versioning / audit trail (crop updates silently replace)
```

## What Was Very Helpful

- It clearly identified the smallest viable slice: proposal-only `proposal_plan` saves, with FF&E explicitly deferred.
- It separated direct reuse from adapted reuse and missing work, which made implementation planning much lighter.
- It correctly recognized that no new API surface was required for the first version.
- It called out the need to lift natural image dimensions from `PlanViewport`, which was the one real missing input for percentage conversion.
- It surfaced the unique-constraint / replace-existing-image issue early, which avoided a predictable second-save bug.
- It explicitly warned about null checks on crop fields needing `!== null` rather than truthiness.

## What Was Helpful But Could Have Been Better

- It mentioned `useUploadImage` / `useDeleteImage` patterns, but the best path in this slice ended up being direct `api.images.*` calls from the Plans page. That distinction could have been stronger up front.
- It suggested `useImages.ts` as a same-pass file, but in practice it was more reference material than an edit target.
- It correctly flagged `compressImage` fidelity risk, but it would have helped to label that as “do not solve in this slice” more forcefully so it didn’t tempt over-design.
- The path references to `ProposalItemDetailPanel.tsx` were slightly inconsistent with the actual folder layout, even though the overall conclusion was correct.

## What Was Not Helpful

- The suggestion to extend `plans.test.ts` “if new plansApi helpers are added” wasn’t especially useful because it was already clear from the reuse summary that no new plans API helpers should be added.
- Mentioning `CropModal.tsx` was technically relevant, but mostly served as negative confirmation rather than actionable reuse.

## What Was Missing And Would Have Helped

- A direct recommendation on whether to prefer `queryClient.setQueryData` only, or whether the follow-up refetch from existing image hooks would be acceptable in practice.
- A note that the current Plans page tests would need a real `QueryClientProvider` once `useQueryClient` was introduced in the component.
- A stronger callout that `selectedPlan` nullability would need to be guarded explicitly inside the derived-image handler, even if the button is unreachable at runtime without a selected plan.
- A more explicit “must mock these exact API methods” list for the new test: `api.images.list`, `api.images.delete`, `api.images.upload`, `api.images.setCrop`, and `api.plans.downloadContent`.

## Generic Instructions / Terms / Keywords For This Use Case

- “Prefer existing storage entities over inventing a new entity type.”
- “State whether the first viable slice should be scoped to one supported target kind only.”
- “Separate direct reuse, adapted reuse, and missing work.”
- “Call out runtime-unreachable but type-relevant nullability guards.”
- “Flag unique-constraint replacement behavior explicitly.”
- “Name the exact API methods that must be mocked in tests.”
- “If a referenced file is only contextual, label it as reference-only rather than same-pass.”
- “When image crops change coordinate spaces, state both source and destination spaces explicitly.”
- “If a hook pattern is optional, say whether direct API calls are lower-friction for the slice.”

## Anything Else Helpful For Next Time

- This prompt benefited from the handoff-analysis improvements: the “Reuse vs Missing Summary” section was especially high leverage and should stay in future prompts.
- For incremental slices, asking the cheap model to classify files as `must-do-now`, `same-pass`, and `can-defer` materially reduces heavy-model decision work.
- The most useful cheap-agent outputs are the ones that:
  - narrow scope aggressively
  - confirm existing reuse paths
  - point out one or two latent traps that will create follow-up fixes if missed

## Summary

This was a strong handoff. It kept the slice intentionally small, validated that `proposal_plan` already provides the right persistence surface, and identified the exact missing seam: converting saved raw-pixel crop geometry into percentage crop params after uploading the protected plan image. The biggest opportunities to improve it further are sharper guidance around test mocking/setup and explicit warnings for compile-time nullability guards that are easy to miss in otherwise sound runtime logic.
