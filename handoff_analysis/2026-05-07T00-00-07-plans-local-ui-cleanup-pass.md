# Handoff Analysis

## Update type

Local UI/interaction cleanup on an existing feature.

This was a narrow implementation pass on the Plans workspace after several larger feature slices had already landed. It was not a new backend feature, schema change, or hook architecture task. The goal was to implement a few clearly local UX/layout fixes while explicitly deferring anything that crossed the `PlanCanvasPage` / `PlanViewport` boundary or changed canvas selection flow.

## Initial prompt

```text
TASK FOR CHEAP MODEL:
Repo root:
c:\Projects\_current-projects\ffe-builder

Update type:
local UI/interaction cleanup on an existing feature

Primary goal:
Implement only the clearly safe/local Plans workspace fixes that we agreed should land now, and do not attempt the broader deferred changes.

Primary files to inspect first:
- src/pages/PlanCanvasPage.tsx
- src/pages/PlanCanvasPage.test.tsx
- docs/changelog.md

Inspect only if needed for a direct local fix:
- src/components/plans/overlays.tsx
- src/lib/plans/geometry.ts

Approved fixes to implement now:
1. Add an explicit `Pan` tool to the Plans toolbar.
2. Remove the separate top viewport toolbar row so the canvas regains that vertical space.
3. Limit the visible document title to 20 characters with CSS truncation and show the full filename on hover.
4. Remove “cards within cards” styling in the sidebar list rows so nested content does not look double-boxed.
5. If needed for the new Pan tool, update the on-canvas hint text and the changelog.

Explicitly DO NOT implement in this pass:
- A true unified left-rail toolbar for zoom/rotate/reset
- A `Select` tool
- Canvas-click measurement selection
- State lifting/refactoring between PlanCanvasPage and PlanViewport
- Any API, DB, hook, or domain-model changes
- Any broad component extraction/reorganization

Important decision:
- Treat moving zoom/rotate/reset into floating in-canvas controls as an acceptable local fix for now, but do not claim it fully solves the “one unified toolbar” request.
- If you touch these controls, preserve existing behavior and keep changes local to PlanCanvasPage.tsx.

What you ARE allowed to change directly:
- Local tool definitions/state in PlanCanvasPage.tsx
- Local JSX/layout in PlanCanvasPage.tsx
- Tailwind classes
- Local cursor/hint behavior
- Small related test updates only if required
- docs/changelog.md only

What you should NOT change:
- Any public API or backend file
- Any cross-component architecture
- Any docs besides changelog unless absolutely required
- Anything that needs verification to prove safety

Return your response in EXACTLY this format:

## 1. Direct Fixes Applied
- Files changed:
- What changed:
- Which approved fixes were completed:
- Whether each one fully or partially satisfies the original request:

## 2. Requested Issues Explicitly Deferred
- Issue:
- Why it remains deferred:
- Exact file/architecture seam blocking it:
- Whether it should be addressed before the next major feature slice:

## 3. Additional Fragility Noted
- Issue:
- Why it matters:
- Exact files:
- Should it be fixed soon or can it wait:

## 4. Tests/Docs Updated
- Tests updated:
- Docs updated:
- Why:

## 5. Notes For Handoff
- Important implementation details:
- Behavior changes introduced:
- Anything the main agent should sanity-check next:

Rules:
- Be concise.
- Use exact repo-relative file paths.
- Only implement the approved local fixes.
- Do not run verification.
- Do not widen scope.
- If something turns out not to be local, stop and report it as deferred instead of improvising a larger refactor.
```

## Cheap agent response

```text
1. Direct Fixes Applied
Files changed: PlanCanvasPage.tsx, changelog.md

What changed:

Pan tool — 'pan' added to ToolId, TOOL_DEFINITIONS, and the left icon rail. PanIcon (four-arrow SVG) added as a file-local component. Pan is enabled without calibration. handlePointerDown now only starts panDragStart when activeTool === 'pan'; other tool modes no longer pan on drag.
Viewport toolbar removal / floating controls — PlanViewport return changed from grid-rows-[auto_1fr] (toolbar row + canvas row) to h-full min-h-0 (canvas only). Zoom-in, zoom-out, rotate-90°, and reset-view are now 32×32 pointer-events-auto icon buttons floating top-right inside the canvas. A zoom%/rotation chip floats bottom-right. ViewControlIcon renders each icon inline. Canvas gains the full toolbar height back.
Title truncation — <h1> for selectedPlan.name gains max-w-[20ch] truncate and title={selectedPlan.name}. No JS slicing; CSS only. Accessible name unchanged.
Cards-within-cards cleanup — Plan Selector <Link>, Length Line <button>, and Measured Items <button> list rows changed from rounded-2xl border px-3 py-3 (full bordered card) to rounded-xl px-3 py-2 (hover row). Active state uses ring-1 ring-inset ring-brand-300 bg-brand-50 instead of a border, removing the double-bordered nesting.
Hint text + changelog — Canvas overlay hint updated: 'pan' tool shows 'Drag to pan • scroll to zoom • double-click to reset'. changelog.md entry added under Unreleased.
Which approved fixes were completed:

✅ #1 Pan tool — fully satisfied
✅ #2 Separate toolbar row removed — fully satisfied (viewport controls moved to floating overlay; canvas regains space)
✅ #3 Title truncation — fully satisfied
✅ #4 Cards-within-cards — fully satisfied for list items (outer section cards untouched)
✅ #5 Hint text + changelog — fully satisfied
2. Requested Issues Explicitly Deferred
Issue: True unified left-rail toolbar (zoom/rotate/reset in the same <aside> icon rail as Calibrate/Length/Rectangle/Crop/Pan)
Why deferred: zoom, rotation, offset, fitScale, clampOffset, naturalSize, containerSize all live inside PlanViewport. To put controls in the parent rail they'd need to be lifted or exposed via useImperativeHandle. The floating-overlay approach applied here achieves the visual goal without that refactor.
Exact seam: PlanCanvasPage / PlanViewport boundary in PlanCanvasPage.tsx (~line 1350+)
Should address before next feature slice: No — floating controls are functional and the canvas regains space.

Issue: Select tool (click measurement on canvas to select it)
Why deferred: Requires SVG elements to lose pointer-events-none and a new onMeasurementClick callback prop on PlanViewport. Changes the component interface.
Exact seam: PlanCanvasPage.tsx (PlanViewport props), overlays.tsx
Should address before next feature slice: No — sidebar selection works.

3. Additional Fragility Noted
Issue: isCalibrated dual-signal — calibration !== null || selectedPlan?.calibrationStatus === 'calibrated'. If calibrationStatus is stale after a new calibration is saved, tools can be incorrectly enabled/disabled until the next plan refetch.
Why it matters: Could allow users to think they're on a calibrated plan when the fresh calibration hasn't returned yet.
Exact files: PlanCanvasPage.tsx (~line 195)
Should fix soon or wait: Can wait — it's a brief race window and calibration saves are synchronous mutations that invalidate the query.

Issue: panDragStart is a useRef (not state) but its .current being null/non-null is read in the cursor style expression. Cursor won't update on grab because ref changes don't trigger re-renders.
Why it matters: The grabbing cursor during pan may not appear — cosmetic issue only.
Exact files: PlanCanvasPage.tsx (PlanViewport cursor style)
Should fix soon or wait: Wait — pre-existing, cosmetic only.

4. Tests / Docs Updated
Tests updated: None. Existing 5 PlanCanvasPage tests pass without changes:

Removed toolbar buttons (Zoom in, Zoom out, Rotate 90°, Reset view) were not queried by any test.
New Pan button is not queried by existing tests.
h1 accessible name unchanged; getByRole('heading', { name: ... }) still resolves.
Docs updated: changelog.md — one-line Unreleased entry added.

Why: Behavior change (pan is now explicit, not implicit in drawing tools) warrants changelog. No test assertions broke or needed updating.

5. Notes For Handoff
Important implementation details:

sectionForTool('pan') returns 'tool' which opens the "Active Tool" accordion in the right sidebar. That section just echoes the tool name and description. It's low-value now that the left-rail icon title tooltip carries the same info — consider removing or repurposing this section before the next major slice.
PlanViewport returns <div className="h-full min-h-0"> → inner <div ref={containerRef} className="relative h-full overflow-hidden ...">. The outer div is a passthrough; containerRef is on the inner canvas div exactly as before. ResizeObserver and pointer handlers are unchanged.
ViewControlIcon and PanIcon are file-local; no export, no extraction needed.
Skeleton updated from 4 to 5 left-rail placeholder blocks.
Behavior changes introduced:

Dragging while in Calibrate, Length, Rectangle, or Crop tool modes no longer pans. Users must switch to Pan explicitly.
Zoom/rotate/reset are no longer reachable via a persistent top toolbar — only via floating canvas buttons or scroll/double-click.
Anything the main agent should sanity-check next:

Confirm the "Active Tool" sidebar section is acceptable for pan, or decide to hide it.
Confirm the panDragStart cursor cosmetic issue is acceptable to defer.
Proceed to FF&E item_plan DB migration + API + client slice as outlined in the prior agent plan.
```

## What was very helpful

- The cheap agent stayed tightly within the approved locality boundary. That is the most important success criterion for this kind of cleanup pass.
- It explicitly marked which requests were fully satisfied versus deferred, which made the result easy to accept without rereading all code.
- It correctly treated `Pan` as a behavioral change rather than a cosmetic one.
- It gave a clear architectural reason for deferring the true unified toolbar request instead of hand-waving it.
- The fragility notes were concise and mostly high-signal, especially the `isCalibrated` dual-source observation.

## What was helpful but could have been better

- It labeled the separate-toolbar-row removal as “fully satisfied,” but in product terms that only fully satisfies the space problem, not the original “one unified toolbar” idea. The main agent still needed to reinterpret that.
- The deferral notes were good, but a little more prioritization would have helped. For example, `isCalibrated` was the main technical-debt follow-up, and that could have been stated more strongly.
- It could have been more explicit that the new floating controls are a local substitute, not the final structure.
- It said tests did not require updates, which was fine, but it would have been even better to say “no test file edits required for this pass; verification still required later.”

## What was not helpful

- The exact line references like `(~line 1350+)` were less useful than exact semantic anchors because this file is moving quickly between passes.
- The note to “Proceed to FF&E item_plan DB migration + API + client slice” was stale relative to the actual project state by the time we reviewed it. For review-pass prompts, advice should stay constrained to the current pass unless explicitly asked for next-feature planning.

## What was missing that would have helped

- A short “accept / partially accept / defer” summary at the top would have made decision-making even faster.
- It could have explicitly said whether the “Active Tool” section should be removed now or only noted for later.
- It would have helped to call out whether the floating controls introduced any accessibility concerns beyond pointer-event behavior, even if the answer was “none obvious.”

## Generic instructions / terms / keywords for this use case

- “Implement only the approved local fixes.”
- “If a request crosses a component boundary, defer it and name the seam.”
- “Mark each requested issue as fully satisfied, partially satisfied, or deferred.”
- “Distinguish behavior changes from visual changes.”
- “Do not confuse a local mitigation with full completion of the original UX request.”
- “Surface the single highest-priority fragility item.”
- “For cleanup passes, keep next-feature advice minimal unless requested.”

## Anything else that may help next time

- For UI cleanup handoffs, asking the cheap agent to classify each requested issue as `full / partial / deferred` is especially effective.
- For fast-moving files like `PlanCanvasPage.tsx`, exact semantic block names are often more useful than approximate line numbers.
- The next prompt should focus on the small technical-debt cleanup only, not reopen broader toolbar or selection redesign questions.
