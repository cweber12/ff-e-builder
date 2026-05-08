# Route Shell / Layout Light-Agent Prompt

TASK FOR LIGHT AGENT

Update type:
route-shell / layout review

Primary goal:
[Describe shell/layout behavior.]

Required behavior:

- [behavior]
- [behavior]

Primary files:

- [exact repo-relative path]
- [exact repo-relative path]

Inspect only if needed:

- [fallback path]

What you may do:

- Read and analyze.
- Apply direct local fixes only if the shell/layout issue can be solved with a small route/layout/container change.
- Do not run verification.
- Do not add backend/API/database changes.

What you must not do:

- Do not redesign the feature.
- Do not add new domain model changes.
- Do not perform speculative component extraction.
- Do not change unrelated toolbar, feature, or interaction behavior.
- Do not widen scope beyond the shell/layout problem.

Return your response in EXACTLY this format:

## 1. Structure Assessment

- Correct route/location/component for this behavior:
- Current shell/container causing the issue:
- Exact files:
- Local route/layout fix or broader structural change:

## 2. Direct Fixes Applied

- Files changed:
- What changed:
- Why safe/local:
- Whether it fully satisfies required behavior:

## 3. If Not Fully Fixed

- What remains:
- Exact seam involved:
- Smallest next adjustment:
- Blocks further work: yes/no

## 4. Navigation / Exit Behavior

- Is navigation away/exit/minimize relevant to this shell problem: yes/no
- Existing behavior:
- Smallest viable behavior if needed:
- Exact UI location if applicable:
- Can implement now safely: yes/no/N/A
- If not implemented, why:

## 5. Parent vs Child Route Split

- Parent/overview route remains unchanged: yes/no/N/A
- Child/workspace route behavior:
- Risks/caveats:

## 6. Tests / Verification

- Test files changed:
- Verification run: yes/no
- Verification still required: yes/no
- Suggested command:
  pnpm typecheck && pnpm lint && pnpm test && pnpm build

## 7. Handoff Notes For Heavy Agent

- Accept as-is:
- Partially accept:
- Needs heavy-agent review:
- Do not spend time on:

Rules:

- Prefer smallest viable route/layout fix.
- Separate fixed directly from needs broader follow-up.
- Use exact repo-relative paths.
- Do not widen scope.
