# Plans FF&E Plan Image Search Review

Date: `2026-05-07`

Update Type: `new feature discovery / domain + API surface planning`

## Initial Prompt

```text
TASK FOR CHEAP MODEL:
Scope:
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
- api/src/routes/images.ts
- api/src/types.ts
- db/migrations/
- README.md
- docs/architecture.md
- docs/changelog.md

Goal:
Gather exact implementation context for the next Plans slice:
support FF&E plan-image publishing from saved Plans measurements by adding the missing image entity path.

Important:
Assume Proposal plan-image publishing is already done.
Do not redesign the feature.
The task is to identify the smallest viable path to support FF&E item plan images end-to-end.

Return findings in EXACTLY this format:

## 1. Missing Domain Surface
- What exact image entity/type is currently missing:
- Exact repo-relative files that prove it:
- What existing proposal_plan path is the closest model:

## 2. Best Next Slice
- Recommended next implementation slice:
- Why this is the right next step now:
- Must-do-now files:
- Same-pass files:
- Can-defer files:

## 3. Worker / DB Readiness
- What existing image route logic can be copied from proposal_plan:
- What DB/storage assumptions need to change:
- Exact repo-relative files:
- Whether a migration is required:
- Smallest viable backend change:

## 4. Client Readiness
- What existing client image APIs/hooks can already support a new entity type with no code changes:
- What client files would need explicit edits:
- Exact repo-relative files:
- Smallest viable frontend change:

## 5. FF&E Surface Targets
- Existing FF&E surfaces where a plan image could appear:
- Exact repo-relative files:
- Which one should be updated first:
- Which should be deferred:

## 6. Plans Integration Impact
- What exact change would be needed back in PlanCanvasPage after item_plan exists:
- Whether proposal-only logic can be generalized cleanly:
- Exact repo-relative files:

## 7. Risks / Traps
- Entity-type / ownership traps:
- Cache-key / invalidation traps:
- UI duplication traps:
- Nullability / type traps:
- Exact repo-relative files:

## 8. Tests To Extend
- Best existing tests to extend first:
- Exact repo-relative files:
- What they already cover:
- What new tests belong in this slice only:

## 9. Reuse vs Missing Summary
- Reuse directly:
- Reuse with adaptation:
- Missing and must be built:
- Explicitly defer:

## 10. Recommended Working Order
- Step 1:
- Step 2:
- Step 3:

Rules:
- Use exact repo-relative file paths everywhere.
- Separate already-existing support from missing support.
- Mark files/actions as must-do-now / same-pass / can-defer.
- Prefer smallest viable implementation over ideal architecture.
- If a suggested reuse path does NOT fully exist, say that explicitly.
- Be concise and concrete.
```

## Agent Response

```text
1. Missing Domain Surface
- What exact image entity/type is currently missing:
  - `item_plan` is missing from the client/server image entity system.
- Exact repo-relative files that prove it:
  - `src/types/image.ts` – `ImageEntityType` includes `project | room | item | item_option | material | proposal_item | proposal_swatch | proposal_plan`; no `item_plan`.
  - `api/src/types.ts` – server-side image entity validation mirrors the same supported set, with no `item_plan`.
  - `api/src/routes/images.ts` – upload routing/ownership branches include `proposal_plan` but no FF&E-plan equivalent branch.
- What existing `proposal_plan` path is the closest model:
  - `proposal_plan` is the exact end-to-end model to copy for storage, ownership, upload, crop, and display.

2. Best Next Slice
- Recommended next implementation slice:
  - Add `item_plan` end-to-end using `proposal_plan` as the model, then expose the first FF&E display surface and re-enable Plans publishing for FF&E measurements.
- Why this is the right next step now:
  - Proposal publishing proved the Plans → derived Plan Image path works.
  - The only real blocker for FF&E is the missing image entity path, not missing crop/measurement infrastructure.
- Must-do-now files:
  - `src/types/image.ts`
  - `api/src/types.ts`
  - `api/src/routes/images.ts`
  - `src/components/FfeItemDetailPanel.tsx`
  - `src/pages/PlanCanvasPage.tsx`
- Same-pass files:
  - `src/components/ItemsTable.tsx`
  - `src/lib/api/images.ts` (only if entity-type exhaustiveness needs touching)
  - `src/hooks/queryKeys.ts` (likely no logic changes, but verify no entity restrictions)
  - `README.md`
  - `docs/architecture.md`
  - `docs/changelog.md`
- Can-defer files:
  - `src/components/ffe/catalog/CatalogView.tsx`
  - Any FF&E export/PDF usage of the new plan image
  - Any dedicated plan-image section in table rows beyond one initial surface

3. Worker / DB Readiness
- What existing image route logic can be copied from `proposal_plan`:
  - Ownership resolution branch for `proposal_plan` in `api/src/routes/images.ts`
  - R2 key generation for the plan-specific path
  - Existing crop/primary/list/delete flows once the entity type is accepted
- What DB/storage assumptions need to change:
  - `image_assets.entity_type` must allow `item_plan`
  - R2 key builder needs a new FF&E plan-image path for item-owned plan artifacts
- Exact repo-relative files:
  - `api/src/routes/images.ts`
  - `api/src/types.ts`
  - `db/migrations/*` (new migration required)
- Whether a migration is required:
  - Yes, if `entity_type` is constrained in the database (which it is in this repo’s image schema pattern).
- Smallest viable backend change:
  - Add `item_plan` to server validation + DB enum/check path
  - Add an ownership/upload branch that resolves through the FF&E item’s room/project ownership
  - Add an R2 key path parallel to `proposal_plan`

4. Client Readiness
- What existing client image APIs/hooks can already support a new entity type with no code changes:
  - `src/lib/api/images.ts` upload/list/delete/setCrop/getContentBlob are generic by `ImageEntityType`
  - `src/hooks/useImages.ts` / upload/crop/delete hooks are generic by `ImageEntityType`
  - `src/hooks/queryKeys.ts` image cache keys are already generic by `ImageEntityType`
- What client files would need explicit edits:
  - `src/types/image.ts` to add `item_plan`
  - `src/components/FfeItemDetailPanel.tsx` to render it somewhere
  - `src/pages/PlanCanvasPage.tsx` to enable FF&E publishing once supported
  - Possibly `src/components/ItemsTable.tsx` if the first visible FF&E surface should be in the table instead of detail panel
- Exact repo-relative files:
  - `src/types/image.ts`
  - `src/components/FfeItemDetailPanel.tsx`
  - `src/components/ItemsTable.tsx`
  - `src/pages/PlanCanvasPage.tsx`
- Smallest viable frontend change:
  - Add `item_plan` to the type union
  - Show it first in `FfeItemDetailPanel.tsx`
  - Reuse existing `ImageFrame`/blob display patterns

5. FF&E Surface Targets
- Existing FF&E surfaces where a plan image could appear:
  - `src/components/FfeItemDetailPanel.tsx`
  - `src/components/ItemsTable.tsx`
  - `src/components/ffe/catalog/CatalogView.tsx`
- Exact repo-relative files:
  - Same as above
- Which one should be updated first:
  - `src/components/FfeItemDetailPanel.tsx`
- Which should be deferred:
  - `src/components/ItemsTable.tsx`
  - `src/components/ffe/catalog/CatalogView.tsx`

6. Plans Integration Impact
- What exact change would be needed back in `PlanCanvasPage` after `item_plan` exists:
  - Generalize the proposal-only gate so `Save as plan image` also works for `ffe`
  - Route upload through `entityType='item_plan'` for FF&E targets
- Whether proposal-only logic can be generalized cleanly:
  - Yes. The existing save handler is already entity-type driven enough to branch by target kind.
- Exact repo-relative files:
  - `src/pages/PlanCanvasPage.tsx`

7. Risks / Traps
- Entity-type / ownership traps:
  - FF&E items are owned through room/project context, not proposal-item context; copying `proposal_plan` routing blindly will break ownership checks.
- Cache-key / invalidation traps:
  - Generic image keys will work, but new `item_plan` displays must subscribe to the correct entity pair or uploads will appear stale.
- UI duplication traps:
  - Showing plan images in too many FF&E surfaces in the first pass will multiply layout work and test churn.
- Nullability / type traps:
  - Adding `item_plan` to the union may surface exhaustiveness issues in existing image helpers/components.
- Exact repo-relative files:
  - `api/src/routes/images.ts`
  - `src/types/image.ts`
  - `src/components/FfeItemDetailPanel.tsx`
  - `src/hooks/useImages.ts`

8. Tests To Extend
- Best existing tests to extend first:
  - Image API / image hook tests
  - FF&E detail-panel rendering test if one exists for rendering image sections
  - Plans page tests only for the FF&E publish button path
- Exact repo-relative files:
  - `src/lib/api/*.test.ts`
  - `src/hooks/*.test.tsx`
  - `src/pages/PlanCanvasPage.test.tsx`
  - any existing `FfeItemDetailPanel` test file if present
- What they already cover:
  - Generic image API behavior and Plans publishing behavior for proposal
- What new tests belong in this slice only:
  - `item_plan` upload/list/crop path
  - FF&E detail-panel display of `item_plan`
  - Plans save handler choosing `item_plan` for `ffe`

9. Reuse vs Missing Summary
- Reuse directly:
  - Generic client image API/hooks
  - `proposal_plan` route structure
  - `PlanCanvasPage` publish flow shape
- Reuse with adaptation:
  - Worker ownership/upload routing
  - FF&E display component choice
  - image crop/display surfaces
- Missing and must be built:
  - `item_plan` image entity type
  - server branch + storage path
  - first FF&E UI surface
  - Plans FF&E publish branch
- Explicitly defer:
  - catalog/export usage
  - broad FF&E table embedding
  - any redesign of plan-image UX

10. Recommended Working Order
- Step 1:
  - Add `item_plan` to types + server validation + DB migration + worker upload branch
- Step 2:
  - Add first FF&E rendering surface in `FfeItemDetailPanel.tsx`
- Step 3:
  - Generalize `PlanCanvasPage` save flow to publish FF&E plan images
```

## What Was Very Helpful

- It correctly identified that the missing work was a domain/entity-path gap, not a measurement/crop gap.
- It kept the slice intentionally small by recommending `FfeItemDetailPanel.tsx` as the first FF&E surface instead of trying to update every FF&E view at once.
- It clearly separated generic client-side image infrastructure that already works from the server-side entity support that still needs to be built.
- It correctly pointed back to `proposal_plan` as the model to copy, which is the most valuable simplification for this feature.

## What Was Helpful But Could Have Been Better

- The response would have been stronger with more exact file paths for the test suggestions instead of some wildcard-style references like `src/lib/api/*.test.ts`.
- It could have been clearer about whether a DB migration is definitely required vs highly likely, depending on the exact DB constraint shape.
- The `same-pass` file list could have better distinguished “verify only” files from files that would almost certainly need edits.

## What Was Not Helpful

- The test recommendations were a bit too generic to be directly actionable without another small local inspection pass.
- Mentioning `src/lib/api/images.ts` as “only if exhaustiveness needs touching” was not very useful; generic API modules are either fully reusable or not, and this one was effectively reusable.

## What Was Missing And Would Have Helped

- A more explicit note about whether FF&E should use `ImageFrame` directly or a read-only blob/pan-zoom frame first, mirroring how Proposal splits table vs detail.
- A stronger recommendation on whether the first FF&E UI surface should be editable or display-only.
- A clearer indication of whether any docs should be deferred until the feature becomes visible outside Plans.
- More exact guidance on the likely ownership helper/query pattern to reuse in `api/src/routes/images.ts`.

## Generic Instructions / Terms / Keywords For This Use Case

- “Identify whether the blocker is domain/entity support or UI wiring.”
- “Name the closest existing end-to-end model to copy.”
- “Separate generic reusable infrastructure from entity-specific missing support.”
- “Recommend one first visible surface, not every possible surface.”
- “When suggesting tests, use exact repo-relative file paths where possible.”
- “Mark whether a migration is definite, probable, or conditional.”
- “Prefer the smallest first visible surface for a new entity type.”

## Anything Else Helpful For Next Time

- This kind of prompt works well for new feature discovery because it asks for the missing domain surface first, which prevents unnecessary UI-first thrash.
- For entity-type work, cheap-agent prompts should continue emphasizing:
  - exact missing union/validation/storage points
  - the closest existing model to copy
  - the smallest first visible UI surface

## Summary

This was a useful search-context handoff for a new feature slice. It correctly framed the task as adding a missing `item_plan` entity path rather than revisiting measurement or crop logic, and it narrowed the first visible FF&E target to a single surface. The main improvement for future prompts is to require more exact test-file and ownership-helper pathing so the follow-up implementation pass starts even more directly.
