# Scout / Sub-Agent Prompt & Response Review Guidelines

**Purpose:** Maintain a concise, reusable guide for evaluating scout-agent prompts and sub-agent responses.  
**Audience:** Coding agents, planning agents, and heavier review agents.  
**Use case:** Improve future prompt design, reduce noisy scout responses, and make sub-agent outputs easier to trust, compare, and reuse.

---

## 1. Core Principle

A scout/sub-agent should reduce uncertainty for the next agent.

A good scout response should answer:

- What is already true?
- What is missing?
- What is reusable?
- What is risky?
- What should be done now vs deferred?
- What evidence supports the finding?

A poor scout response creates more work by being broad, vague, overconfident, or hard to map back to files.

---

## 2. High-Value Prompt Patterns

Use these when writing prompts for scout agents.

| Prompt Pattern                                                | Why It Helps                                                                                               | Efficient Because                                      |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Define the update type upfront                                | Helps the scout choose the right lens: discovery, implementation review, UI cleanup, schema analysis, etc. | Prevents over-scoping and unrelated recommendations.   |
| Provide narrow file scope                                     | Keeps the scout from repo-wide wandering.                                                                  | Reduces file reads and token use.                      |
| Split files into “inspect first” and “inspect only if needed” | Gives the scout flexibility without encouraging broad search.                                              | Preserves focus while allowing necessary context.      |
| State what the scout may do / must not do                     | Avoids accidental implementation, testing, or redesign.                                                    | Prevents cleanup work after scope creep.               |
| Ask for “already exists / missing / reusable”                 | Separates facts from gaps.                                                                                 | Makes implementation planning faster.                  |
| Ask for “must-do-now / same-pass / can-defer”                 | Forces prioritization.                                                                                     | Keeps slices small and actionable.                     |
| Ask for exact repo-relative paths                             | Makes findings directly usable.                                                                            | Avoids follow-up search caused by ambiguous filenames. |
| Ask the scout to prove blockers                               | Prevents guessing based on symptoms.                                                                       | Reduces false-start implementation work.               |
| Ask for traps by category                                     | Surfaces issues that are easy to miss.                                                                     | Prevents cache, type, ownership, and nullability bugs. |
| Require certainty labels                                      | Separates confirmed facts from inference.                                                                  | Lets the next agent trust the response selectively.    |
| Request one first visible surface for UI feature slices       | Prevents broad UI rollout.                                                                                 | Keeps implementation vertical but small.               |
| Require direct fixes vs deferred issues to be separated       | Clarifies what changed and what remains.                                                                   | Speeds review and handoff.                             |

---

## 3. Low-Value / Noisy Prompt Patterns

Avoid these unless there is a specific reason.

| Prompt Pattern                                             | Why It Hurts                                                                          | Cost                                              |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Broad “inspect the repo” requests                          | Encourages unfocused context gathering.                                               | High token use, low signal.                       |
| Generic file suggestions like `images.ts` or `types.ts`    | Ambiguous when client/server files share names.                                       | Requires follow-up search.                        |
| Asking for ideal architecture when a small slice is needed | Invites redesign.                                                                     | Creates planning noise and delays implementation. |
| Combining unrelated goals in one scout prompt              | Makes response hard to prioritize.                                                    | Increases scope creep.                            |
| Asking for line numbers in fast-changing files             | Line references become stale quickly.                                                 | Adds low-trust detail.                            |
| Allowing verification claims when tests are not allowed    | Creates ambiguity about whether tests actually ran.                                   | Reduces trust.                                    |
| Asking for “all possible surfaces” without prioritization  | Leads to broad UI/export suggestions.                                                 | Inflates implementation scope.                    |
| Not defining “do not implement” vs “may fix locally”       | Scout may edit when only context was wanted, or refuse when a local fix was intended. | Causes workflow confusion.                        |

---

## 4. High-Value Response Patterns

A helpful scout/sub-agent response should include:

### Evidence

- Exact repo-relative paths.
- Function/component/helper names.
- Clear distinction between confirmed code facts and inferred behavior.
- Short explanation of why a blocker is real.

### Prioritization

- Must-do-now.
- Same-pass.
- Can-defer.
- Explicitly out-of-scope.

### Reuse Analysis

- Reuse directly.
- Reuse with adaptation.
- Similar but should not be reused.
- Missing and must be built.

### Risk Analysis

Call out risks by type:

- Type/union/exhaustiveness traps.
- Ownership/authorization traps.
- Cache invalidation traps.
- Nullability/state-shape traps.
- Storage/R2/path collision traps.
- Test fixture/setup traps.
- UI duplicate-render/stale-render traps.

### Handoff Value

The response should make the next agent faster, not merely describe the codebase.

---

## 5. Low-Value / Noisy Response Patterns

Watch for these during response review.

| Response Pattern                          | Why It Is Not Helpful              | Better Alternative                                                               |
| ----------------------------------------- | ---------------------------------- | -------------------------------------------------------------------------------- |
| Ambiguous filenames                       | Hard to know which file is meant.  | Use exact repo-relative paths.                                                   |
| Generic “probably edit” lists             | Inflates scope without evidence.   | Mark each file as edit / verify / no change with a reason.                       |
| Approximate line numbers only             | Stale and brittle.                 | Use semantic anchors like function/component/state names.                        |
| “Tests pass” when tests were not run      | Misleading verification claim.     | Say “No test edits appear required; verification still needs to be run.”         |
| Roadmap advice in cleanup reviews         | Distracts from the current pass.   | Only include next-feature advice when requested.                                 |
| Overconfident inferred claims             | Forces re-verification.            | Label as confirmed / likely / uncertain.                                         |
| Long pseudo-code snippets                 | Can be wrong or malformed.         | Prefer concise prose or small stable examples.                                   |
| “Fully satisfied” for partial local fixes | Hides product-level gaps.          | Say “fully satisfies local issue; partially satisfies original product request.” |
| Missing requested sections                | Breaks comparability.              | Preserve the requested response structure.                                       |
| Broad test path suggestions               | Pushes discovery back to reviewer. | Name exact test files or say no exact seam found.                                |

---

## 6. Scout Prompt Template

Use this as a starting point and trim aggressively.

```md
# Scout Task: [Update Type / Slice Name]

## Goal

Gather exact implementation context for [specific outcome]. Do not implement unless explicitly allowed below.

## Current Context / Assumptions

- [Known fact 1]
- [Known fact 2]
- [Known direction to preserve]
- [Known non-goal]

## Inspect First

- path/to/fileA.ts
- path/to/fileB.tsx

## Inspect Only If Needed

- path/to/optionalFile.ts
- docs/relevant-doc.md

## You May Do

- Read and analyze.
- [Optional] Apply only clearly safe/local fixes in [specific files].
- [Optional] Update docs/changelog only if behavior changes.

## Do Not Do

- Do not run verification commands.
- Do not redesign the product.
- Do not add API/DB/domain changes unless specifically requested.
- Do not inspect outside the listed scope unless required; if you do, label it.

## Questions To Answer

1. What already exists?
2. What is missing?
3. What can be reused directly?
4. What requires adaptation?
5. What is the smallest viable next slice?
6. What should be deferred?
7. What risks/traps matter?

## Required Output

## 1. Executive Summary

- Main finding:
- Confidence:
- Highest-value next step:

## 2. Existing Support

- Already exists:
- Exact files:

## 3. Missing Support

- Missing:
- Exact files:
- Why this is the real blocker:

## 4. Reuse vs Missing

- Reuse directly:
- Reuse with adaptation:
- Similar but should not be reused:
- Missing and must be built:

## 5. Recommended Slice

- Must-do-now:
- Same-pass:
- Can-defer:

## 6. Risks / Traps

- Type trap:
- Ownership trap:
- Cache trap:
- Nullability/state trap:
- Test trap:

## 7. Files Reviewed

- path: why it matters

## 8. Uncertainty

- Confirmed:
- Likely:
- Uncertain / verify before implementation:
```

---

## 7. Response Review Checklist

When reviewing a scout/sub-agent response, score each item as:

- `Good`
- `Partial`
- `Missing`
- `Noisy`

| Review Item                            | Score | Notes |
| -------------------------------------- | ----- | ----- |
| Answered the requested question        |       |       |
| Stayed within scope                    |       |       |
| Used exact repo-relative paths         |       |       |
| Separated existing vs missing          |       |       |
| Separated direct reuse vs adaptation   |       |       |
| Identified true blockers with evidence |       |       |
| Prioritized must-do vs defer           |       |       |
| Labeled uncertainty                    |       |       |
| Avoided unnecessary roadmap advice     |       |       |
| Avoided unverified test claims         |       |       |
| Included useful risks/traps            |       |       |
| Response reduces next-agent work       |       |       |

---

## 8. Suggested Review Output Format

Use this when compiling a review of a prompt + scout response.

```md
# Prompt / Scout Response Review

## 1. What Worked

| Prompt/Response Element | Result | Why Helpful | Efficiency Impact |
| ----------------------- | ------ | ----------- | ----------------- |

## 2. What Created Noise

| Prompt/Response Element | Result | Why Not Helpful | Efficiency Cost |
| ----------------------- | ------ | --------------- | --------------- |

## 3. Missing Context That Would Have Helped

- Missing:
- Why it mattered:
- How to ask for it next time:

## 4. Prompt Improvements

- Keep:
- Remove:
- Add:
- Reword:

## 5. Reusable Guideline Added

- New guideline:
- Applies when:
- Example:
```

---

## 9. Update Log

Append new lessons here. Keep entries short.

| Date       | Source / Slice              | New Insight                                                                                      | Guideline Change                                                                    |
| ---------- | --------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| 2026-05-19 | Plans scout/handoff reviews | Narrow scope + exact output format produced more useful scout responses.                         | Require update type, file scope, allowed/disallowed actions, and structured output. |
| 2026-05-19 | Plans image/entity reviews  | “Reuse directly / reuse with adaptation / missing” prevented rebuilding existing infrastructure. | Add reuse matrix to feature-discovery prompts.                                      |
| 2026-05-19 | UI cleanup reviews          | “Direct fixes vs deferred issues” reduced ambiguity after local changes.                         | Require direct/deferred separation for any implementation-capable scout.            |
| 2026-05-19 | Agent response reviews      | Ambiguous filenames and stale line numbers added review cost.                                    | Require exact repo-relative paths and semantic anchors.                             |
| 2026-05-19 | Test/verification notes     | Agents sometimes implied tests passed without running them.                                      | Require separate wording for test edits vs verification commands.                   |
