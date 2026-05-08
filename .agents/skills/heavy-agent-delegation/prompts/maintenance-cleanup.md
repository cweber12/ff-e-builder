# Maintenance Cleanup Light-Agent Prompt

TASK FOR LIGHT AGENT

Update type:
small technical-debt cleanup

Primary goal:
[Describe approved cleanup only.]

Approved fixes:

1. [fix]
2. [fix]

Explicitly DO NOT implement:

- new features
- API/backend/database changes
- domain model changes
- broad refactors
- state lifting across component boundaries
- verification commands

Allowed files:

- [exact path]

What you may change:

- local derived state
- local JSX cleanup
- small local state fix
- changelog only if user-visible behavior changes

Return your response in EXACTLY this format:

## 1. Direct Fixes Applied

- Files changed:
- What changed:
- Which approved fixes were completed:
- Whether each fully or partially satisfies the cleanup:

## 2. Approved Fixes Deferred

- Issue:
- Why deferred:
- Exact seam blocking it:
- Should it block next feature slice: yes/no

## 3. Additional Fragility Still Present

- Issue:
- Why it matters:
- Exact files:
- Can wait or should be addressed soon:

## 4. Tests / Verification

- Test files changed:
- Verification run: yes/no
- Verification still required: yes/no
- Suggested command:

## 5. Notes For Handoff

- Important implementation details:
- Behavior changes introduced:
- Heavy-agent sanity-check needed:

Rules:

- Only implement approved small fixes.
- Do not widen scope.
- If something is not local, defer it.
