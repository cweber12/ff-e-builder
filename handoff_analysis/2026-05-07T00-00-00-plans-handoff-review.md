# Plans Handoff Review

Date: `2026-05-07`

## Initial Prompt

```text
You are gathering implementation context for updates to the Plans workspace in this repo.

Repo root:
c:\Projects\_current-projects\ffe-builder

Goal:
Support the next implementation pass for the Plans canvas using the notes below.

Priority updates to support:
1. Make the opened plan workspace a true full-window, non-scrolling surface.
2. Replace the left-side tool text buttons with icon buttons + tooltips.
3. Add a collapsible list of all items associated with measurements for the current plan.
4. Selecting an item in that list should highlight its measured area on the image.
5. Investigate and explain the current “image shifts suddenly while measuring” bug.
6. Find where to add a new agent rule requiring a pause-and-prompt flow before testing or repo-search.

Known guidance from previous review:
- The current shift bug may be caused by the plan canvas container resizing while sidebar content grows, which recalculates fitScale/effectiveScale.
- The current image transition logic may also be re-enabling CSS transforms during active pointer gestures because it depends on ref values read during render.
- Rectangle measurement support is expected to build on the existing overlay/selection patterns used by Length Lines.
- The item-associated measurement list should likely live in the right sidebar and be collapsible.
- The plan canvas may need an escape hatch from the ProjectLayout section wrapper to become truly full-window.

Please inspect the codebase and return findings in EXACTLY this format:

## 1. Current Files To Edit
- Must edit:
- Probably edit:
- Might need tests/docs updates in:

## 2. Full-Window Layout Context
- Current route/layout wrapper path:
- Current scrolling/padding constraints:
- Best implementation point for full-window escape hatch:
- Relevant files:

## 3. Tool Rail To Icon Toolbar Context
- Current tool rail implementation:
- Existing icon/tooltip/button patterns to reuse:
- Relevant files:
- Recommendation:

## 4. Measurement Item List Context
- Current measurement data sources:
- Current item data sources for FF&E and Proposal:
- Best place to build the collapsible measured-item list:
- Relevant files:
- Missing APIs/hooks if any:

## 5. Highlighted Area / Rectangle Overlay Context
- Existing overlay transform pipeline:
- Best selection-state pattern to reuse:
- How rectangle geometry should be rendered under rotation:
- Relevant files:
- Main implementation risks:

## 6. Image Shift Bug Check
- Most likely root cause:
- Concrete evidence from code:
- Files/lines to inspect:
- Smallest safe fix:
- Any related risks if we do not fix it first:

## 7. Agent Rules Update
- Best file to update:
- Existing section where this rule belongs:
- Suggested wording for the new rule:
- Any nearby rules that should be kept consistent:

## 8. Recommended Order
- Step 1:
- Step 2:
- Step 3:
- Step 4:

Rules:
- Be concise and concrete.
- Include exact file paths.
- Prefer implementation reuse over redesign.
- Do not propose product changes beyond the notes above.
- If you mention a bug cause, cite the exact file and code area that supports it.
```

## Agent Response

```text
1. Current Files To Edit
Must edit:
PlanCanvasPage.tsx
App.tsx
Probably edit:
Button.tsx (for icon button reuse)
plan.ts (if measurement model tweaks needed)
usePlans.ts (if new measurement hooks needed)
plans.ts (if new measurement APIs needed)
Might need tests/docs updates in:
api/test/ (add/extend measurement tests)
docs/architecture.md, changelog.md
README.md (if public API or layout changes)
2. Full-Window Layout Context
Current route/layout wrapper path:
PlanCanvasPage is rendered via ProjectLayout in src/App.tsx, inside a <section className="project-content ..."> (adds padding/scroll).
Current scrolling/padding constraints:
The section wrapper adds unwanted padding and allows scrolling, breaking full-window intent.
Best implementation point for full-window escape hatch:
In src/App.tsx, detect the plan canvas route and render PlanCanvasPage outside the <section>, or add a prop to ProjectLayout/Outlet to suppress section padding/scroll for this route.
Relevant files:
src/App.tsx, PlanCanvasPage.tsx
3. Tool Rail To Icon Toolbar Context
Current tool rail implementation:
Left sidebar in PlanCanvasPage uses text buttons with tool descriptions.
Existing icon/tooltip/button patterns to reuse:
Button.tsx (icon button support)
Tooltip pattern from other sidebar or action buttons (e.g., ProjectHeader, nav)
Relevant files:
src/pages/PlanCanvasPage.tsx, Button.tsx
Recommendation:
Replace text buttons with icon-only buttons, each wrapped in a tooltip. Use shadcn/ui or existing primitives for consistency.
4. Measurement Item List Context
Current measurement data sources:
usePlanMeasurements (to be added) for all measurements on the plan.
Current item data sources for FF&E and Proposal:
useRoomsWithItems and useProposalWithItems (already loaded in ProjectLayout context).
Best place to build the collapsible measured-item list:
Right sidebar in PlanCanvasPage, below calibration/length lines, as a collapsible section.
Relevant files:
src/pages/PlanCanvasPage.tsx, src/hooks/plans/usePlans.ts, plan.ts
Missing APIs/hooks if any:
Measurement CRUD API in plans.ts and hooks in usePlans.ts
5. Highlighted Area / Rectangle Overlay Context
Existing overlay transform pipeline:
viewportPointFromImage in PlanCanvasPage.tsx (handles pan/zoom/rotation for overlays)
Best selection-state pattern to reuse:
selectedLengthLineId pattern; use selectedMeasurementId for rectangles.
How rectangle geometry should be rendered under rotation:
Transform all four corners through viewportPointFromImage, render as SVG polygon (not <rect>).
Relevant files:
PlanCanvasPage.tsx (SVG overlay, selection state)
Main implementation risks:
Incorrectly assuming axis-alignment after rotation; must transform all corners.
6. Image Shift Bug Check
Most likely root cause:
Container height changes (from sidebar content growth) trigger ResizeObserver, which recalculates fitScale/effectiveScale, shifting the image.
Concrete evidence from code:
PlanCanvasPage.tsx: containerRef + ResizeObserver, fitScale depends on containerSize, which is affected by sidebar content.
Files/lines to inspect:
PlanCanvasPage.tsx (containerRef, fitScale, sidebar content)
Smallest safe fix:
Set outer container to fixed height (h-[calc(100vh-185px)]), add overflow-hidden, and make sidebars scrollable (overflow-y-auto).
Any related risks if we do not fix it first:
Ongoing user confusion, broken measurement UX, overlays and image desync.
7. Agent Rules Update
Best file to update:
AGENTS.md (repo root)
Existing section where this rule belongs:
"Operating rules" or "Definition of done"
Suggested wording for the new rule:
"Before running any test, typecheck, or repo-wide search, always pause and prompt the user for confirmation or additional instructions."
Any nearby rules that should be kept consistent:
Rules about not running destructive commands, not committing automatically, and waiting for user confirmation after checks.
8. Recommended Order
Step 1: Fix full-window layout and image shift bug (src/App.tsx, PlanCanvasPage.tsx)
Step 2: Replace tool rail with icon buttons + tooltips (src/pages/PlanCanvasPage.tsx, primitives)
Step 3: Add collapsible measured-item list in right sidebar, with selection/highlight logic (src/pages/PlanCanvasPage.tsx, hooks, types)
Step 4: Update AGENTS.md with new agent rule for pause-and-prompt before tests/search
```

## Helpful Aspects

- It correctly identified the highest-value files to touch first: `src/pages/PlanCanvasPage.tsx` and `src/App.tsx`.
- It framed the layout issue at the right seam: the `ProjectLayout` section wrapper in `src/App.tsx`.
- It gave a good-enough root cause for the image-shift bug to justify fixing layout and overflow before continuing.
- It pointed to the correct overlay implementation pattern: transform all four rectangle corners and render a polygon, not a viewport-space `<rect>`.
- It correctly recognized that measurement CRUD was still missing and needed to be added before the measured-item list could be real.
- It provided a usable implementation order that reduced risk.

## Could Be Improved

- It should have been more explicit about the exact source files for measurement CRUD:
  `api/src/routes/plans.ts`, `api/src/types.ts`, `src/lib/api/plans.ts`, `src/lib/api/mappers.ts`, `src/hooks/plans/usePlans.ts`, and `src/hooks/queryKeys.ts`.
- It named `plan.ts`, `usePlans.ts`, and `plans.ts` without enough path specificity, which creates avoidable ambiguity in a repo with both client and worker code.
- The “icon toolbar” section was too generic. It should have stated whether an existing tooltip primitive actually exists in this repo or whether `title` would be the pragmatic fallback for this pass.
- It should have distinguished between “items associated with measurements” and “all available attachable items” because those drive two different sidebar/UI states.
- The agent-rules wording it suggested was too user-confirmation-oriented; the actual desired rule was a structured cheap-model handoff flow, not just “ask the user first.”

## Not Helpful At All

- `Button.tsx (for icon button reuse)` was only marginally useful. The button primitive mattered less than the fact that there was no established tooltip primitive surfaced in the response.
- `plan.ts (if measurement model tweaks needed)` was weakly useful; the real bottleneck was missing API/hook plumbing, not the client type file itself.
- `api/test/` as a target path was not useful because this repo’s relevant client tests were actually under `src/lib/api/*.test.ts`, and the response did not clarify worker-route test patterns.

## Missing And Would Have Been Helpful

- A concrete note that `PlanCanvasPage` was already carrying too many responsibilities and that the next pass might benefit from extracting local helper components such as:
  `ToolRail`, `MeasuredItemsPanel`, or overlay helpers.
- A direct callout that the plan viewport transition guard should be decoupled from render-time ref reads, with a recommendation to use explicit interaction state.
- An explicit distinction between:
  `selected measured item list` (existing measurements only)
  and
  `association picker` (all candidate FF&E / Proposal items)
- A clearer note that the rectangle measurement flow needed both:
  `selectedMeasurementId`
  and
  `selectedMeasurementTargetKey`
  or equivalent state to support editing/reassignment safely.
- A stronger prompt instruction to include exact file paths for every “probably edit” item, not just the top-level sections.
- A stronger prompt instruction to call out whether any requested change was blocked on missing primitives or whether a lightweight fallback would be appropriate.

## Additional Instructions I Wish I Had Provided

- “For every file you mention, return the exact repo-relative path.”
- “If a suggested reuse pattern does not actually exist in the repo, say that explicitly instead of implying it.”
- “Separate ‘items already measured on this plan’ from ‘all items that can be attached to a new measurement.’”
- “For the bug diagnosis, include whether the proposed fix is enough on its own or whether interaction-state handling must also change.”
- “If a recommendation depends on a missing primitive (tooltip, icon set, collapsible abstraction), state the lowest-friction fallback.”

## Prompt Framing Changes To Reduce Heavy-Model Work

- Ask for exact file paths in every section, not just some sections.
- Require the cheap agent to distinguish:
  `existing reusable implementation`
  vs
  `missing and must be built`
  This reduces follow-up interpretation work.
- Add a “Fallbacks” subsection:
  “If the requested UX primitive does not already exist, what is the smallest acceptable implementation for this pass?”
- Add a “Blocked / Not Actually Present” subsection so the cheap agent can explicitly say when it inferred too much.
- Ask for “one-sentence implementation consequences” for each main finding, which helps decide whether to batch or defer work.
- For bug diagnoses, ask for:
  `symptom -> triggering state change -> exact code path -> smallest fix`
  This would make the response more directly actionable.

## Summary

The handoff was helpful enough to unblock the implementation quickly. Its biggest strengths were correctly identifying the route/layout seam, the likely image-shift cause, and the rotated-rectangle overlay requirement. Its biggest weaknesses were path ambiguity, not separating measured-item state from attachable-item state, and implying reuse patterns without proving that the repo actually had them.

For future handoffs, the prompt should force exact paths, explicitly separate “reuse” from “missing,” and require fallback guidance when a requested UI primitive may not already exist.
