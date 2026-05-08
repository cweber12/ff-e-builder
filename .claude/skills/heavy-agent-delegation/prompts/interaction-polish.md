# Interaction Polish Light-Agent Prompt

TASK FOR LIGHT AGENT

Update type:
local interaction / UX polish review

Primary goal:
[Describe the interaction or UX area to review.]

Specific issues to evaluate:

1. [issue]
2. [issue]
3. [issue]

Allowed files:

- [exact repo-relative path]
- [exact repo-relative path]

Inspect only if needed:

- [fallback path]

What you may do:

- Read and analyze the allowed files.
- Apply direct local fixes only if they are clearly safe and low-risk.
- Make Tailwind/class changes.
- Make local JSX/layout changes.
- Make local state changes inside the allowed component.
- Update small tests only if your direct fix requires it.
- Update changelog only if user-visible behavior changes.

What you must not do:

- Do not change API/backend/database.
- Do not change shared domain types.
- Do not redesign the feature.
- Do not introduce new product behavior beyond the listed issues.
- Do not lift state across component boundaries.
- Do not perform broad component extraction.
- Do not run verification.
- Do not make speculative cleanup changes.

Decision boundary:

- If the fix is local, low-risk, and clearly improves one of the listed issues, apply it.
- If the fix crosses a component boundary, changes public props, changes data flow, or requires product judgment, defer it and name the exact seam.

Return your response in EXACTLY this format:

## 1. Direct Fixes Applied

- Files changed:
- Issues fixed directly:
- What changed:
- Why each fix was safe/local:

## 2. Issues Reviewed But Not Fixed

- Issue:
- Why it was not safe/local:
- Exact files involved:
- Exact seam blocking it:
- Recommended next step:
- Whether it should block the next feature slice:

## 3. Overall Review

- What is solid:
- What is fragile:
- What should be addressed before the next major slice:
- What can wait:

## 4. Risks Introduced By Direct Fixes

- Risk:
- Why it matters:
- Exact files:

## 5. Tests / Verification

- Test files changed:
- Verification run: yes/no
- Verification still required: yes/no
- Suggested command:
  pnpm typecheck && pnpm lint && pnpm test && pnpm build

## 6. Handoff Notes For Heavy Agent

- Accept as-is:
- Partially accept:
- Needs heavy-agent review:
- Do not spend time on:

Rules:

- Be concise but specific.
