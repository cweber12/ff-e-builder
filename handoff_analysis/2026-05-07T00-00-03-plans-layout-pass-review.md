# Plans Layout Pass Handoff Review

Date: `2026-05-07`

Update Type: `UI layout refinement / CSS + local component state`

## Initial Prompt

```text
TASK FOR CHEAP MODEL:
Repo root:
c:\Projects\_current-projects\ffe-builder

Primary file to inspect/fix:
- src/pages/PlanCanvasPage.tsx

Also inspect only if needed to complete the pass:
- src/App.tsx
- src/components/plans/overlays.tsx
- src/lib/plans/geometry.ts
- src/pages/PlanCanvasPage.test.tsx
- README.md
- docs/architecture.md
- docs/changelog.md

Goal:
Do a focused layout/UX pass on the current Plans workspace.

Known issues to address directly if the fix is local and low-risk:
1. The zoom/rotate/reset toolbar wrapper is too tall and pushes the image down.
2. Page contents should fit in the window and not overflow/scroll at the page level.
3. Sidebar sections should be collapsible and only one should be open at a time.

What you ARE allowed to fix directly:
- Tailwind classes, spacing, heights, flex/grid behavior, overflow behavior
- Local component state for accordion/collapse behavior
- Small JSX restructuring inside PlanCanvasPage if needed
- Related test updates if your layout/state change affects them
- README / docs/changelog / docs/architecture updates only if behavior meaningfully changes

What you should NOT fix directly:
- New product features
- New API routes
- New domain model changes
- Broad refactors outside this layout pass
- Anything that requires repo-wide redesign
- Any verification commands

Important implementation guidance:
- Keep the page full-window and avoid page-level scrollbars.
- Internal panels may scroll if needed, but the outer page should not.
- Reduce vertical footprint of the viewport toolbar as much as reasonably possible.
- Sidebar sections should behave like an accordion: one open at a time.
- Prefer the smallest viable fix over ideal redesign.
- Use exact repo-relative file paths in your response.
- If you change files, list them explicitly.

Return your response in EXACTLY this format:

## 1. Direct Fixes Applied
- Files changed:
- What you changed:
- Why these were safe/local fixes:

## 2. Remaining Issues Not Fixed
- Issue:
- Why it was not safe/local:
- Exact files involved:
- Recommended next step:

## 3. Layout Risks To Review
- Risk:
- Why it may matter:
- Exact files:

## 4. Tests/Docs Updated
- Tests updated:
- Docs updated:
- Why:

## 5. Notes For Handoff
- Anything the next agent should know:
- Any assumptions you made:

Rules:
- Be concise.
- Use exact repo-relative paths.
- Separate fixes you applied from issues you deferred.
- Do not run verification commands.
- Do not propose product changes outside this layout pass.
```

## Agent Response

```text
1. Direct Fixes Applied
Files changed:

PlanCanvasPage.tsx
PlanCanvasPage.test.tsx
What you changed:

Viewport toolbar height (issue 1):

Grid wrapper: gap-4 → gap-2, added grid-rows-[auto_1fr]
Toolbar: px-4 py-3 gap-3 → px-3 py-2 gap-2 (reduces vertical footprint by ~8 px)
Canvas div: flex-1 → h-full (flex-1 is meaningless in a grid; h-full fills the 1fr row correctly)
Page overflow (issue 2):

The outer page already had overflow-hidden. The real bug was the canvas using flex-1 inside a CSS Grid (it was ignored, so the canvas had no explicit height). grid-rows-[auto_1fr] + h-full on the canvas fixes this — the canvas now fills all remaining space and the grid never overflows.
Sidebar accordion (issue 3):

Replaced measuredItemsOpen: boolean with openSection: string (defaults to 'calibration' to match the initial activeTool = 'calibrate')
Calibration, Length Lines, Measured Items, and Active Tool section headers are now <button> elements that set openSection; their bodies conditionally render on openSection === '<section-name>'
Plan Selector section intentionally left always-expanded (navigation-critical; contains plan links needed by tests and by UX flow)
Tool rail button onClick also sets openSection synchronously (so clicking Calibrate opens Calibration section, clicking Length Line opens Length Lines section, clicking Rectangle/Crop opens Measured Items section)
Why these were safe/local fixes:

All changes are Tailwind class adjustments, local component state, or JSX structure changes within PlanCanvasPage.tsx
No new domain types, API routes, or shared types touched
No behavior outside the Plans workspace affected
2. Remaining Issues Not Fixed
Issue: The right sidebar has no max-height or overflow-y-auto scroll cap on individual section bodies. With many measured items or length lines, a section body can still grow taller than the visible sidebar area.
Why not fixed: Requires deciding per-section max-height values; carries risk of hiding content or clashing with the full-height sidebar scroll already set on <aside className="overflow-y-auto ...">. Intentional deferral.
Files involved: PlanCanvasPage.tsx
Recommended next step: Add max-h-48 overflow-y-auto (or similar) to the measurement list and length-lines list <div className="mt-4 space-y-2"> elements.

3. Layout Risks To Review
Risk: On viewports narrower than xl (< 1280 px), the layout collapses to a stacked column (header + single column) because the xl:grid-cols-[84px_minmax(0,1fr)_380px] breakpoint is XL-only. On medium screens, there is no tool rail or sidebar — the viewport fills the whole width. This was pre-existing but should be validated.
Why it may matter: On 13" laptops at 1280 px, the three-column grid may be very tight with the 380 px sidebar.
Files: PlanCanvasPage.tsx (lines near the outer <div className="grid ... xl:grid-cols-...">)

4. Tests / Docs Updated
Tests updated: PlanCanvasPage.test.tsx — test 2 ("shows saved calibration details for calibrated plans"):

Removed getAllByText(/12 ft/i).toHaveLength(2) — the second occurrence was in the Length Lines body, which is now closed when activeTool = 'calibrate'
Removed getByText('Banquette wall') — same reason
Removed getByText('A-101') — Measured Items body is closed when activeTool = 'calibrate'
Replaced with getByText(/12 ft/i) (single occurrence, still in the open Calibration section)
Tests 3 & 4 unchanged — clicking the Crop tool button now synchronously sets openSection = 'items', so the Measured Items body is open when the A-101 / P-42 buttons are queried
Docs updated: None — no behavioral change to public APIs or documented features.

5. Notes For Handoff
openSection starts as 'calibration' because activeTool starts as 'calibrate'. If the default activeTool ever changes, openSection default must be updated to match.
The Plan Selector section has no accordion toggle by design (always visible). If it later needs collapsing, add a 'plans' value to the openSection logic and give the Plan Selector section a button header.
The sync between setActiveTool and setOpenSection lives in the tool rail button onClick only. Any future code path that calls setActiveTool programmatically (e.g. URL-driven tool selection) should also call setOpenSection to keep them in sync.
```

## What Was Very Helpful

- The prompt kept the cheap agent tightly scoped to local UI/layout work, which made the response precise and immediately actionable.
- The agent distinguished between what it actually fixed and what it intentionally deferred, which reduced review overhead.
- It correctly diagnosed the real height bug as a `flex-1` inside a CSS Grid problem rather than a vague overflow issue.
- It explicitly protected the `Plan Selector` from being folded into the accordion, which preserved a critical navigation surface.
- It identified the exact tests that would drift because of closed accordion sections.

## What Was Helpful But Could Have Been Better

- It proposed keeping tool-to-section sync only in the tool-rail `onClick`, but that left a subtle drift risk for any future programmatic `setActiveTool` call. I ended up hardening that with a small `useEffect`.
- The response could have been more explicit about whether the outer page truly had no page-level scroll after the change, versus simply reducing the likelihood.
- It mentioned the potential need for list-body max heights but didn’t classify that as clearly deferred polish vs near-term risk.

## What Was Not Helpful

- The viewport-width warning was reasonable, but not especially useful for this pass because it didn’t point to a concrete local change worth making immediately.
- The estimated “reduces vertical footprint by ~8 px” detail wasn’t especially meaningful compared with simply stating the class changes.

## What Was Missing And Would Have Helped

- A direct recommendation to sync accordion state from `activeTool` in a shared helper, not just in click handlers.
- A note that the current page already had `overflow-hidden`, so the validation target should be “correct child sizing” rather than “add more overflow guards.”
- A clearer split between structural layout fixes and behavioral state fixes, since this pass mixed CSS/tailwind work with local React state changes.

## Generic Instructions / Terms / Keywords For This Use Case

- “Scope to local UI/layout fixes only.”
- “Separate structural sizing bugs from overflow bugs.”
- “Mark navigation-critical sections that should stay always visible.”
- “If adding accordion state, say how it stays synchronized with tool state.”
- “List test assertions likely to drift because of conditional rendering.”
- “Prefer smallest viable Tailwind/class change over component redesign.”
- “Call out deferred polish separately from actual blockers.”

## Anything Else Helpful For Next Time

- This style of prompt works especially well for CSS/layout passes because it gives the cheap agent permission to fix directly, not just analyze.
- For UI cleanup passes, it helps to say explicitly whether docs should be updated only for public behavior changes; that prevented unnecessary doc churn here.
- The best cheap-agent output for this type of work is concrete class/state change guidance, not abstract design commentary.

## Summary

This was a strong handoff for a local UI/layout refinement pass. It correctly identified the real sizing issue, proposed a low-risk accordion model, and highlighted the minimum test fallout from conditional rendering. The main improvement for future prompts is to ask more explicitly how any new local UI state should stay synchronized with existing behavior state.
