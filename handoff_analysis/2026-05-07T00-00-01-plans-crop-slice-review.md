# Plans Crop Slice Handoff Review

Date: `2026-05-07`

## Initial Prompt

```text
TASK FOR CHEAP MODEL:
Scope:
- src/pages/PlanCanvasPage.tsx
- src/App.tsx
- src/hooks/plans/usePlans.ts
- src/hooks/queryKeys.ts
- src/lib/api/plans.ts
- src/lib/api/mappers.ts
- api/src/routes/plans.ts
- api/src/types.ts
- src/pages/PlanCanvasPage.test.tsx
- src/lib/api/plans.test.ts
- AGENTS.md
- docs/architecture.md
- README.md
- docs/changelog.md

Goal:
Gather exact current-state context for the next Plans slice after the recent full-window, length-line, and rectangle-measurement changes.

Return format:

## 1. Current Plans Capabilities
- What the current workspace already supports:
- What is still incomplete:
- Exact files that prove this:

## 2. Highest-Value Next Slice
- Recommended next step:
- Why this is the best next step now:
- Main files likely involved:

## 3. Crop Flow Readiness
- What crop-related domain fields/routes/types already exist:
- What is missing for item plan-image crop/save:
- Exact files:

## 4. Measurement Editing Gaps
- Any obvious gaps or inconsistencies in the current rectangle/item measurement flow:
- Exact files:
- Whether each gap should be fixed before the next slice:

## 5. UI/Architecture Risks To Watch
- Current risks in PlanCanvasPage specifically:
- Any components/helpers that should probably be extracted next:
- Exact files:

## 6. Tests To Extend Next
- Existing tests that are the best base for the next slice:
- Exact files:
- What they already cover:

## 7. Recommended Working Order
- Step 1:
- Step 2:
- Step 3:

Rules:
- Be concise.
- Use exact repo-relative file paths.
- Do not suggest product changes outside the current Plans direction.
- Do not do repo-wide search outside the listed files.
- If you say something is incomplete, cite the file that shows it.
```

## Agent Response

```text
1. Current Plans Capabilities
What the current workspace already supports:

Full-window, fixed-height, non-scrolling canvas shell with isPlanCanvasRoute escape hatch in App.tsx (line 200) — renders <Outlet> in min-h-0 flex-1 overflow-hidden div bypassing the max-w-7xl section
Three-column layout (84px icon rail / viewport / 380px sidebar) with overflow-y-auto sidebars (src/pages/PlanCanvasPage.tsx line 436, 490)
Icon-only tool buttons (h-14 w-14, aria-label, native title tooltip) for Calibrate, Length Line, Rectangle, Crop (PlanCanvasPage.tsx lines 449–464)
Calibration: draw, save, display saved scale (lines 577–680)
Length Lines: draw, save, update, delete, sidebar list with selection/highlight overlay (lines 681–800)
Rectangle measurements: draw, normalize, associate with FF&E or Proposal item via <select>, save, update, delete (lines 335–384, 811–906)
Collapsible "Measured Items" sidebar section with measuredItemsOpen toggle (lines 800–906)
Rectangle highlight via RectOverlay (SVG <polygon>, all 4 corners through viewportPointFromImage) — rotation-correct (lines 1425–1440)
isInteracting state drives transition: 'none' during active pointer/wheel gestures — image shift fix applied (lines 1030, 1255, 1280, 1318)
Full measurement CRUD: API routes GET/POST/PATCH/DELETE /measurements in plans.ts (lines 446, 465, 522, 563); client functions in src/lib/api/plans.ts; hooks in usePlans.ts
What is still incomplete:

Crop tool (activeTool === 'crop') has no draw interaction, no sidebar panel, and no save logic — it is listed in TOOL_DEFINITIONS and routes include crop_x/y/width/height fields in the DB and API, but the crop UI is entirely a stub (PlanCanvasPage.tsx line 100–104; no case for 'crop' in handlePointerDown)
buildRectPolygonPoints accepts both {rectX,rectY,rectWidth,rectHeight} and {x,y,width,height} via dual-path optional fields — a fragile pattern that could silently produce zero-size polygons if the wrong shape is passed (PlanCanvasPage.tsx lines 1548–1565)
The "Active Tool" info section at the bottom of the right sidebar (lines 907–916) is low-value placeholder content
Exact files that prove this:

PlanCanvasPage.tsx (lines 100–104 for crop stub, 1240–1260 for handlePointerDown missing crop case, 1548–1565 for dual-shape polygon helper)
plans.ts (lines 494–514 for crop fields stored but unused from UI)
2. Highest-Value Next Slice
Recommended next step: Implement the Crop tool — draw a crop rectangle on a saved measurement's rect area, save cropX/Y/Width/Height to the existing measurements row via updateMeasurement, and display the crop bounds as a secondary dashed overlay inside the rect overlay.

Why this is the best next step now:

All the infrastructure is already there: the DB schema stores crop fields, the API PATCH /measurements/:id already writes them, the client updateMeasurement already sends them, and UpsertPlanMeasurementInput already includes cropX/Y/Width/Height as optional fields. The only missing piece is the draw interaction and sidebar panel — exactly the same pattern as the Rectangle tool.
The crop flow is the last unimplemented tool in an otherwise complete tool rail; leaving it as a disabled stub blocks the logical next user workflow (export a cropped plan image section per item).
Main files likely involved:

PlanCanvasPage.tsx — add crop draw branch in handlePointerDown/handlePointerMove, add crop draft state, add crop sidebar panel, add crop overlay inside the measurement SVG
plans.ts — UpsertPlanMeasurementInput.cropX/Y/Width/Height already present; no changes needed
plans.ts — crop fields already stored; no changes needed
PlanCanvasPage.test.tsx — extend existing canvas test for crop tool state
3. Crop Flow Readiness
What crop-related domain fields/routes/types already exist:

DB columns: crop_x, crop_y, crop_width, crop_height (nullable double precision) on measurements table — migration 0015_plans_tool.sql
API: PATCH /measurements/:measurementId writes all four fields (api/src/routes/plans.ts lines 550–553)
UpsertMeasurementSchema in types.ts validates them as optional nullable numbers
Client type UpsertPlanMeasurementInput in plans.ts (lines 55–58) includes them as number | null | undefined
Measurement domain type in plan.ts includes cropX/Y/Width/Height: number | null
mapMeasurement in mappers.ts maps crop_x/y/width/height → camelCase
What is missing for item plan-image crop/save:

cropDraft state in PlanCanvasPage (analogous to measurementDraft) — not yet present
Crop draw case in handlePointerDown (no activeTool === 'crop' branch) — PlanCanvasPage.tsx lines 1240–1260
Crop sidebar panel: requires a selected measurement to crop into; the crop rect must be constrained to fit inside the parent measurement rect
Secondary dashed overlay showing the crop rect inside the measurement rect (can reuse RectOverlay with dashed prop)
Crop saving passes cropX/Y/Width/Height through the existing updateMeasurement call — no new API needed
Exact files:

PlanCanvasPage.tsx — all missing UI
plan.ts — types already present, no changes needed
plans.ts — client input type already present, no changes needed
plans.ts — routes already present, no changes needed
4. Measurement Editing Gaps
Any obvious gaps or inconsistencies:

buildRectPolygonPoints (PlanCanvasPage.tsx lines 1548–1565) accepts both {rectX,rectY,rectWidth,rectHeight} (Measurement) and {x,y,width,height} (normalizedMeasurementDraft result). If a caller accidentally passes a Measurement where x/y are expected, all four corners silently collapse to {0,0}. This is currently safe because both call sites are in the same file, but it is a latent bug that will matter the moment crop overlay needs a slightly different input shape.
Selecting a measurement in the sidebar always switches activeTool to 'rectangle' (line 895). If the user was on the Crop tool when they click a measurement, they're silently switched away. For the Crop slice, the selection click should preserve 'crop' if it was already active.
The item <select> in the rectangle draft panel shows all items from both FF&E and Proposal as a flat sorted list. With large item counts this will be unwieldy — no grouping by room/category. Not a bug, but a near-term UX debt.
Exact files: PlanCanvasPage.tsx lines 891–897, 1548–1565

Whether each gap should be fixed before the next slice:

Gap 1 (dual-shape helper): fix or strongly type before crop overlay work — the crop draw will produce yet another rect shape and the helper will need to handle it.
Gap 2 (tool switch on selection): fix during crop slice implementation.
Gap 3 (flat item select): defer — not blocking.
5. UI/Architecture Risks To Watch
Current risks in PlanCanvasPage specifically:

The file is ~1,700 lines, monolithic. PlanViewport is a large internal component (lines ~990–1490) with its own full pan/zoom/pointer state machine that is entirely co-located with the page. As the crop draw interaction and its overlay are added, this function will exceed reasonable cognitive bounds.
PlanCanvasPage and PlanViewport both close over activeTool directly; adding crop draw state means yet more parallel draft/save/overlay state branches in both. The pattern is clear and consistent but will become harder to follow past ~5 tools.
Any components/helpers that should probably be extracted next:

PlanViewport → src/components/plans/PlanViewport.tsx (extract the internal component to its own file now, before crop adds another 150+ lines to it)
LineOverlay and RectOverlay → src/components/plans/overlays.tsx (two SVG helpers with no external deps — trivial to extract, would clean up the page file significantly)
buildMeasurementItems, normalizeRectDraft, buildRectPolygonPoints → src/lib/plans/geometry.ts (pure functions with no React deps)
Exact files: PlanCanvasPage.tsx (all of it)

6. Tests To Extend Next
Existing tests that are the best base for the next slice:

PlanCanvasPage.test.tsx — 2 tests covering uncalibrated tool disabling and calibrated plan display; fixture data already includes a measurement with cropX: null. Add a third test: "when crop tool is active and a measurement is selected, crop draft controls are rendered".
plans.test.ts — tests for listMeasurements and createMeasurement already exist (lines 300–390+). Add: updateMeasurement with non-null crop fields to confirm the body serializes crop_x/y/width/height correctly.
Exact files:

PlanCanvasPage.test.tsx
plans.test.ts
What they already cover:

PlanCanvasPage.test.tsx: tool disabled state for uncalibrated plan; calibration display; hooks mocked for measurements including crop fields as null; usePlanMeasurements and all CRUD mutation hooks mocked.
plans.test.ts: listMeasurements round-trip with crop fields; createMeasurement POST body serialization; updateLengthLine PATCH body; 14 total passing tests covering the full existing API surface.
7. Recommended Working Order
Step 1: Extract PlanViewport, LineOverlay, RectOverlay, and geometry helpers out of PlanCanvasPage.tsx into separate files under src/components/plans/ and src/lib/plans/. This reduces the file to a manageable size before crop adds another pass of state.

Step 2: Implement the Crop tool — add cropDraft state, constrained-to-measurement-rect draw interaction in PlanViewport, crop sidebar panel that requires a selected measurement, save via existing updateMeasurement with crop coords, and a secondary dashed RectOverlay inside the measurement polygon. Fix the tool-switch-on-selection gap and strongly type buildRectPolygonPoints in the same pass.

Step 3: Extend tests — add crop tool render test to PlanCanvasPage.test.tsx; add updateMeasurement with non-null crop fields to plans.test.ts; update changelog and docs.
```

## What Was Very Helpful

- It correctly identified that `Crop` was the highest-value next slice instead of sending the work back into another round of exploratory architecture changes.
- It separated “already implemented” from “still incomplete,” which made the next step easy to scope.
- It recognized that the existing measurement PATCH path already supports crop fields, which prevented unnecessary API churn.
- It called out the dual-shape `buildRectPolygonPoints` helper as a real risk before the crop pass.
- It correctly identified the “selection flips back to rectangle” behavior as something to fix during the crop slice.
- The recommended working order was strong and directly actionable.

## What Was Helpful But Could Have Been Better

- It recommended extracting `PlanViewport`, `LineOverlay`, `RectOverlay`, and geometry helpers, but it would have been more useful if it had separated “must extract now” from “nice to extract if time allows.”
- It cited some files as `plans.ts` and `plan.ts` without consistently distinguishing client vs worker paths in the summary bullets, even though the earlier sections were mostly clear.
- The crop recommendation was good, but it could have been sharper about whether the first version should save only crop geometry or also attempt derived Plan Image persistence in the same pass.
- It flagged the “Active Tool” card as low value, but that wasn’t important to the next implementation and added a little noise.

## What Was Not Helpful

- The suggestion to extract `PlanViewport` into `src/components/plans/PlanViewport.tsx` was directionally good, but it didn’t help much unless paired with a recommended props boundary. On its own, it still left a lot of interpretation work.
- Calling out the flat item `<select>` as a near-term UX debt was accurate but not relevant to the crop slice and didn’t improve execution.

## What Was Missing And Would Have Helped

- A stricter recommendation on whether to fully extract `PlanViewport` now or keep the extraction smaller by only moving overlays and geometry helpers first.
- A note about saved-crop overlay duplication risk once both the general measurement map and selected-measurement state start rendering crop polygons.
- A direct warning that `cropWidth` / `cropHeight` checks should use explicit `null` handling rather than truthiness, since zero-like values can lead to accidental UI-state bugs.
- A cleaner suggested split between:
  - canvas interaction state
  - measurement editing panel state
  - pure geometry helpers
    That would have made the refactor boundary even easier.

## Generic Instructions / Terms / Keywords For This Use Case

- “Return implemented vs missing behavior separately.”
- “Use exact repo-relative file paths for every referenced file.”
- “Mark each recommendation as `must do now`, `do in same pass`, or `can defer`.”
- “Prefer smallest viable implementation over ideal architecture.”
- “Reuse existing persistence paths before suggesting new API surface.”
- “Call out nullability traps explicitly.”
- “Distinguish UI state, domain state, and pure helper seams.”
- “For geometry tools, state the coordinate space explicitly.”
- “For overlays under rotation, specify polygon vs rect behavior directly.”
- “If suggesting an extraction, propose the target file and the minimum props boundary.”

## Anything Else Helpful For Next Time

- This prompt was stronger than the previous handoff because it constrained scope to a specific file set and asked for “current capabilities” first. That reduced speculative advice.
- Cheap-model handoffs for incremental slices work best when they are anchored to:
  - one concrete next feature
  - a known set of files
  - explicit “what already exists vs what is missing”
- For UI feature slices like this, the highest leverage additions to the prompt are:
  - “what can stay in place”
  - “what must be changed in the same pass to avoid a follow-up bug”
  - “what should explicitly be deferred”

## Summary

This handoff was high value. It narrowed the next move correctly, avoided unnecessary new API work, and identified two real implementation hazards before coding started: the dual-shape rectangle helper and the tool-switch-on-selection behavior. The biggest opportunity to make it even better would be stronger guidance on extraction boundaries and a more explicit treatment of overlay duplication and nullability risks during the crop pass.
