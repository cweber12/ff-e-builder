# Local Cleanup Light-Agent Prompt

TASK FOR LIGHT AGENT

Update type:
local cleanup implementation

Primary goal:
[Describe the approved local cleanup.]

Approved fixes to implement now:

1. [fix]
2. [fix]
3. [fix]

Explicitly DO NOT implement:

- API/backend/database changes
- shared type changes
- new product features
- broad component extraction
- cross-component state lifting
- route architecture changes
- verification commands
- unrelated cleanup

Allowed files:

- [exact repo-relative path]
- [exact repo-relative path]

Inspect only if needed:

- [fallback path]

What you may change:

- local JSX/layout
- Tailwind classes
- local component state
- local icons/helpers
- small test updates if required
- changelog only if behavior changes

Decision boundary:

- If the issue is clearly local, low-risk, and solvable in the allowed files, fix it.
- If it crosses a component boundary, API/domain boundary, route architecture boundary, shared type boundary, or product decision, defer it and name the seam.

Return your response in EXACTLY this format:

## 1. Request Status Summary

For each requested fix:

- Item:
- Status: full / partial / deferred
- Why:
- Files changed:
- Heavy-agent decision needed: yes/no

## 2. Direct Fixes Applied

- Files changed:
- What changed:
- Why each fix was safe/local:
- Behavior changes introduced:

## 3. Deferred Items

- Issue:
- Why deferred:
- Exact seam blocking it:
- Recommended next step:
- Blocks next slice: yes/no

## 4. Additional Fragility Noted

- Issue:
- Why it matters:
- Exact files:
- Can wait or should be addressed soon:

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
