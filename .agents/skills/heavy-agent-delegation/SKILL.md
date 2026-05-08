---
name: heavy-agent-delegation
description: Guidance for heavy/reasoning agents to delegate bounded tasks to cheaper models using prompt templates, decision boundaries, and acceptance criteria.
---

# Heavy Agent Delegation Skill

Use this skill when acting as the heavy / high-reasoning agent.

When this skill is explicitly invoked by the user, the heavy agent must delegate all codebase
discovery, search, and verification work. The heavy agent may read only this `SKILL.md`, the
prompt templates in `.agents/skills/heavy-agent-delegation/prompts/`, and files explicitly named
by the user in the request. Any additional repo context must be requested through a light-agent
handoff first.

The heavy agent owns:

- architecture decisions
- implementation strategy
- cross-file coordination
- final acceptance of delegated work

The heavy agent should delegate:

- repo scouting
- file discovery
- current-state summaries
- local cleanup
- interaction polish review
- verification
- audit
- commit messages

## Prompt Library

Reusable light-agent handoff prompts are stored in:

```txt
.agents/skills/heavy-agent-delegation/prompts/
```

Available prompts:

| File                        | Use when                                                                                 |
| --------------------------- | ---------------------------------------------------------------------------------------- |
| `scout-only.md`             | You need to know what exists before deciding anything                                    |
| `feature-slice-planning.md` | You know the feature shape and need a detailed build plan                                |
| `route-shell-layout.md`     | You need to audit or fix a route shell, layout, or fullscreen workspace                  |
| `interaction-polish.md`     | You need an open-ended UX/interaction polish review in a specific component              |
| `local-cleanup.md`          | You have a specific, approved local fix that needs to be applied                         |
| `maintenance-cleanup.md`    | You want small technical-debt items cleaned up with low risk                             |
| `verification-audit.md`     | You need `pnpm typecheck ; pnpm lint ; pnpm test ; pnpm build` run and failures reported |

## When to invoke this skill

Delegate when:

- The task is read-only context gathering (repo scouting, pattern discovery, current-state summary)
- The fix is approved and mechanical — you have already decided what to change
- You need verification output (typecheck / lint / test / build) and do not want to run it yourself
- You need a commit message drafted from a diff

Mandatory delegation when this skill is explicitly invoked:

- any repo-wide or multi-file discovery beyond files explicitly named by the user
- any search command such as `rg`, `grep`, or "find all usages"
- any verification run such as `pnpm typecheck`, `pnpm lint`, `pnpm test`, or `pnpm build`
- any request for additional repo context needed to decide implementation details

Forbidden for the heavy agent while this skill is active:

- reading repo files not explicitly named by the user before a light-agent handoff returns
- running codebase inspection commands to discover structure or usage patterns
- running verification commands directly

Do it yourself when:

- The task requires architecture or product judgment
- The fix crosses multiple packages or changes public API boundaries
- The output of the delegated task will determine what to do next (i.e., you cannot write the handoff prompt without seeing the result first)

## How to use a prompt

1. Open the relevant prompt file from the `prompts/` directory above.
2. Copy the full contents.
3. Fill in every `[Placeholder]` field. Do not send a prompt with unfilled placeholders.
4. Prepend your filled prompt with: `TASK FOR LIGHT AGENT` (already included in each template).
5. Paste to the light/cheap model.
6. Evaluate the returned response using the criteria below.

Before taking any repo tool action, ask:

- Can I produce a light-agent prompt right now without reading more repo files?

If yes, do that instead.

### Filling placeholder fields

- `[Describe the X]` — write one clear, scoped sentence. If you cannot describe it in one sentence, the scope is too broad.
- `[exact repo-relative path]` — always use forward slashes from the repo root, e.g. `src/pages/PlanCanvasPage.tsx`.
- `[issue]` — be specific about the symptom, not the desired fix. Let the light agent diagnose.

## Evaluating a light-agent response

Accept the response when:

- Every section in the return format is present and non-empty
- File paths are repo-relative and point to real files
- Fixes applied are local and do not cross component or package boundaries
- `Verification still required: yes/no` is answered (if present)

Reject and re-delegate (or escalate) when:

- Sections are missing or say "N/A" without explanation
- File paths are invented or do not exist
- The fix crosses a boundary that was marked forbidden in the prompt
- The response contains speculation without evidence from the files

## Escalation

If the light agent returns an incomplete or out-of-scope response twice:

1. Do the task yourself using the same scoped boundaries from the prompt.
2. Note what caused the light agent to fail so the prompt can be improved.
3. Do not widen the scope to accommodate the light agent's drift.
