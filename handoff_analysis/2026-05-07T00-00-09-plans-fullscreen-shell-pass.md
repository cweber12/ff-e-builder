# Handoff Analysis

## Update type

Route-shell / fullscreen workspace review and local layout fix for an existing feature.

This handoff was about workspace shell behavior, not feature logic. The goal was to determine whether the Plans measurement route needed a broader architectural split or just a tighter route/layout branch so the opened plan could behave like a true fullscreen editor.

## Initial prompt

```text
TASK FOR CHEAP MODEL:
Repo root:
c:\Projects\_current-projects\ffe-builder

Update type:
route-shell / fullscreen workspace review for an existing feature

Primary goal:
Review the current Plans measurement workspace and determine the smallest viable implementation path to make it a true fullscreen editor mode.

New required behavior:
- The measuring tool canvas should cover the entire browser window.
- It should NOT show the normal project header or project tabs while open.
- It should NOT participate in page-level scrolling.
- Users should be able to minimize or exit the tool.
- The Plans overview/library page should remain a normal project page.
- Selecting a plan from the library should open this fullscreen measurement mode.

Primary files to inspect first:
- src/App.tsx
- src/pages/PlansPage.tsx
- src/pages/PlanCanvasPage.tsx

Inspect only if needed:
- src/components/project/ProjectHeader.tsx
- src/components/project/ProjectOptionsMenu.tsx
- src/pages/PlanCanvasPage.test.tsx
- README.md
- docs/architecture.md
- docs/changelog.md

What you may do:
- Read and analyze
- Apply direct local fixes only if the fullscreen requirement can be met with a small route/layout change
- Update changelog/docs only if a direct fix changes user-visible behavior
- Do not run tests or verification
- Do not add backend/API/database changes

What you should NOT do directly:
- Broad feature redesign
- New data model/domain changes
- Large component extraction unless clearly necessary
- Speculative refactors outside the fullscreen-shell problem

Main questions to answer:
1. Is the current `plans/:planId` route already the right place for a fullscreen editor mode?
2. What exact shell currently causes the project header/tabs to remain visible?
3. Can fullscreen mode be achieved by routing/layout branching only, without changing the Plans library route?
4. What is the smallest way to provide minimize/exit controls?
5. What should be fixed directly now, and what should only be returned as context?

Decision boundary:
- If hiding the project header/tabs and locking the tool to the viewport can be solved with a small route/layout branch in existing files, you MAY fix it directly.
- If minimize/exit requires more than a local control/header addition inside PlanCanvasPage, do not invent a larger architecture; return context instead.

Assumptions to follow:
- `Plans` overview/library stays inside normal ProjectLayout.
- `plans/:planId` should become a fullscreen workspace mode.
- “Minimize” can be interpreted as returning to the Plans overview/library unless the codebase clearly supports something better already.

Return your response in EXACTLY this format:

## 1. Fullscreen Structure Assessment
- Is `plans/:planId` the correct fullscreen route:
- What currently keeps project header/tabs visible:
- Exact repo-relative files:
- Is this a local route-shell fix or a broader structural change:

## 2. Direct Fixes Applied
- Files changed:
- What changed:
- Why it was safe/local:
- Whether it fully satisfies fullscreen/no-header/no-scroll behavior:

## 3. If Not Fully Fixed
- What remains:
- Exact seam involved:
- Smallest next adjustment:
- Whether it blocks further interaction polish:

## 4. Minimize / Exit Recommendation
- Smallest viable behavior:
- Exact UI location to place controls:
- Whether it can be implemented now safely:
- If not implemented, why:

## 5. Library vs Workspace Split
- Whether the Plans overview page can remain unchanged:
- Whether selecting a plan should simply route into fullscreen `plans/:planId`:
- Any risks or caveats:

## 6. Tests/Docs Updated
- Tests updated:
- Docs updated:
- Why:

## 7. Notes For Handoff
- Important implementation details:
- Risks to sanity-check:
- Anything the main agent should verify next:

Rules:
- Be concise and concrete.
- Use exact repo-relative file paths.
- Prefer the smallest viable route/layout fix.
- Separate “fixed directly” from “needs broader follow-up”.
- Do not widen scope into toolbar/select-tool redesign.
- Do not run verification.
```

## Cheap agent response

```text
1. Fullscreen Structure Assessment
Is plans/:planId the correct fullscreen route: Yes. It already had its own <header> with plan name, calibration badge, and a "Plans Library" breadcrumb link back to /projects/:id/plans.
What currently keeps project header/tabs visible: ProjectLayout unconditionally rendered <ProjectHeader> and the <nav> tabs before any branch logic. The isPlanCanvasRoute check only gated the Outlet wrapper (scroll/height), not the chrome above it.
Exact files: App.tsx — ProjectLayout function
Local or structural: Purely local. isPlanCanvasRoute was already computed in scope; the fix just extends its use to the chrome above the Outlet.
2. Direct Fixes Applied
Files changed: App.tsx, changelog.md
What changed: ProjectLayout now branches on isPlanCanvasRoute at the top level of its return. On canvas routes: <main> is h-screen overflow-hidden, no <ProjectHeader>, no <nav> tabs, loading spinner centers in the full viewport, Outlet fills the remaining height in a min-h-0 flex-1 overflow-hidden wrapper. On all other routes: unchanged behavior.
Why safe/local: isPlanCanvasRoute was already computed. The modals (edit/delete/import) are in the non-canvas branch — they were only ever needed on non-canvas routes anyway.
Whether it fully satisfies all requirements: Yes — no header, no tabs, no page scroll, full viewport coverage.
3. Minimize / Exit
Already exists in PlanCanvasPage: The workspace <header> (line ~575) has a "Plans Library" link (to={/projects/${project.id}/plans}) styled as a breadcrumb. Clicking it routes back to the library. This is the minimize/exit control.
No additional implementation needed.
4. Library vs Workspace Split
Plans library (/projects/:id/plans) is unaffected — still renders inside normal ProjectLayout with header and tabs.
Selecting a plan routes to plans/:planId which now triggers fullscreen mode.
No risks; the regex isPlanCanvasRoute is precise (/^\/projects\/[^/]+\/plans\/[^/]+$/.test(...)).
```

## What was very helpful

- It answered the most important question directly: the route split was already correct.
- It identified the real culprit precisely: unconditional project chrome in `ProjectLayout`, not the Plans page itself.
- The fix recommendation was minimal and high-confidence.
- It correctly recognized the existing breadcrumb in `PlanCanvasPage` as sufficient minimize/exit behavior, avoiding unnecessary new controls.
- This was a strong example of a cheap agent distinguishing a shell bug from a structural product problem.

## What was helpful but could have been better

- The response was compact and accurate, but it could have included the exact existing branch location in `App.tsx` more concretely, since that was the only edit seam that mattered.
- It said “fully satisfies all requirements,” which is fair for the fullscreen shell behavior, but it might have noted that “minimize” is implemented as “return to library” rather than a separate minimized state.
- It did not explicitly say whether docs beyond changelog were unnecessary for this pass.

## What was not helpful

- There was no explicit “tests/docs updated” section in the returned content even though the prompt requested it. That omission was small here, but it weakens consistency.
- The regex precision note was fine but lower value than a brief note about ensuring nested routes would still behave correctly if introduced later.

## What was missing that would have helped

- A one-line “this unblocks interaction polish without further shell changes” conclusion would have been useful.
- It could have explicitly said that the library route should remain in the normal project shell as-is, which was implied but not stated as a recommendation.

## Generic instructions / terms / keywords for this use case

- “Determine whether this is a shell bug or a route-structure problem.”
- “Prefer extending existing route flags over introducing new routing layers.”
- “Identify the exact chrome/container that remains visible.”
- “Treat fullscreen editor mode as a shell concern first.”
- “Recognize existing breadcrumb/back-link behavior before inventing new minimize UI.”

## Anything else that may help next time

- This prompt worked well because it constrained the cheap agent to the route shell and explicitly prohibited unrelated toolbar/select-tool redesign.
- For future route-shell reviews, it may help to add:
  - “State whether the existing route is semantically correct before suggesting any new route.”
- This is a good template for distinguishing between “page within app chrome” and “editor mode outside app chrome.”
