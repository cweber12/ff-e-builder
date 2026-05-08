# Scout-Only Light-Agent Prompt

TASK FOR LIGHT AGENT

Update type:
scout-only context gathering

Primary goal:
[Describe the specific context needed.]

Allowed files:

- [exact repo-relative path]
- [exact repo-relative path]

Inspect only if needed:

- [fallback path]

What you may do:

- Read and analyze only.
- Search within the allowed files only.
- Use targeted search commands only when needed.
- Do not edit files.
- Do not run tests or verification.
- Do not do repo-wide search outside the allowed files.
- Do not propose product changes outside the stated task.

What I need from you:

- Identify relevant files.
- Identify existing patterns.
- Identify likely edit points.
- Identify missing pieces.
- Identify risks/traps.
- Recommend a working order.

Return your response in EXACTLY this format:

## 1. Current State

- Already exists:
- Still missing:
- Exact files:

## 2. Relevant Files

- Must edit:
- Probably edit:
- Reference only:
- Tests/docs likely involved:

## 3. Existing Patterns To Reuse

- Pattern:
- Exact files:
- How it applies:

## 4. Risks / Traps

- Type/nullability trap:
- Cache/render trap:
- Ownership/auth trap:
- UI/interaction trap:
- Test/setup trap:

## 5. Recommended Working Order

- Step 1:
- Step 2:
- Step 3:

## 6. Handoff Notes For Heavy Agent

- Accept as straightforward:
- Requires heavy-agent decision:
- Do not spend time on:
- Verification still required:

Rules:

- Use exact repo-relative paths.
- Prefer semantic anchors over approximate line numbers.
- Separate facts from inferences.
- Mark uncertainty explicitly.
- Do not include next-feature advice unless directly relevant.
- Keep the response concise.
