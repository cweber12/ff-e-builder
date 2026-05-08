# Feature Slice Planning Light-Agent Prompt

TASK FOR LIGHT AGENT

Update type:
feature-slice planning

Primary goal:
[Describe the feature slice.]

Current assumptions:

- [assumption]
- [assumption]

Allowed files:

- [exact repo-relative path]
- [exact repo-relative path]

Inspect only if needed:

- [fallback path]

What you may do:

- Read and analyze only.
- Do not edit files.
- Do not run verification.
- Do not redesign the product.

What I need from you:

- Confirm exact missing support.
- Identify the closest existing model to copy.
- Identify the smallest viable implementation path.
- Identify first visible UI surface, if applicable.
- Identify test targets.
- Identify risks/traps.

Return your response in EXACTLY this format:

## 1. Missing Surface

- Exact missing type/entity/path/behavior:
- Exact files that prove it:
- Closest existing model to copy:
- Why this is the real blocker:
- If no backend/domain surface is involved, state: N/A, frontend-only.

## 2. Smallest Viable Slice

- Recommended next slice:
- Why this is the right next step:
- Must-do-now files:
- Same-pass files:
- Can-defer files:

## 3. Backend / Storage / Domain Readiness

- Existing path to copy:
- Required DB/server/storage/domain changes:
- Exact files:
- Migration required: definitely / probably / conditional / no / N/A
- Ownership/authorization trap:
- If no server changes are needed, state: N/A, no backend/storage/domain changes required.

## 4. Frontend Readiness

- Existing generic client support:
- Required client changes:
- First UI surface to update:
- Surfaces to defer:
- Exact files:

## 5. Integration Follow-Up

- Exact change needed in the main workflow file:
- Can current logic be generalized:
- State/nullability traps:

## 6. Tests To Extend

- Best test files:
- What they already cover:
- What new tests belong in this slice:
- Test setup traps:

## 7. Reuse vs Missing

- Reuse directly:
- Reuse with adaptation:
- Missing and must be built:
- Explicitly defer:

## 8. Recommended Working Order

- Step 1:
- Step 2:
- Step 3:

## 9. Handoff Notes For Heavy Agent

- Accept as straightforward:
- Requires heavy-agent decision:
- Do not spend time on:
- Verification still required:

Rules:

- Use exact repo-relative paths.
- Separate already-existing support from missing support.
- Do not suggest broader UX/product redesign.
- Mark uncertainty explicitly.
- Use N/A for irrelevant backend/storage/domain sections instead of forcing fake findings.
