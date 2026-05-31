# Claude Session Insights

A running log of agent friction points — context bloat, wasted actions, tooling
friction, instruction conflicts, and verification gaps — captured per session so
they can be reviewed in bulk to derive durable improvements to agent rules,
instructions, context, and references.

This file holds issues that **should be analyzed across multiple sessions before
acting**. Quick, obviously-actionable fixes are handled in-session and do not
belong here.

## How to add an entry

Append under a dated session heading. Use one `###` block per distinct insight,
in the uniform format below. Do not edit or delete prior entries — set their
**Status** instead (`logged` → `under-analysis` → `resolved`/`wontfix`) so the
history stays intact for pattern-finding.

```
## YYYY-MM-DD — Session: <short title>

### <Insight title>
- **Category:** context-bloat | wasted-action | tooling-friction | instruction-conflict | verification-gap
- **What happened:** <factual description, cite the concrete event>
- **Impact:** <qualitative token/time/quality cost>
- **Hypothesis / candidate fix:** <what might address it; mark if it needs more data>
- **Frequency seen:** <this session only | recurring — note other dates as observed>
- **Status:** logged
```

Categories:

- **context-bloat** — large content pulled into the window with low value-per-token.
- **wasted-action** — work done then abandoned, or redone due to a mistake.
- **tooling-friction** — tool/harness mechanics that added steps or noise.
- **instruction-conflict** — two rules/skills/modes pulling in opposite directions.
- **verification-gap** — code or output shipped without a confirming check.

---

## 2026-05-30 — Session: FF&E catalog-first refactor (grill → plan → Slice 1 → issues)

### Lint-staged commit hook re-dumped a modified file into context

- **Category:** context-bloat
- **What happened:** The single `git commit` for Slice 1 ran `eslint --fix` + `prettier --write` via lint-staged, which reformatted files. The harness then injected a "file was modified by a linter" system note that echoed ~576 lines of `CatalogView.tsx` back into context.
- **Impact:** One commit added a large, mostly-redundant block to the window; the content was already known from prior reads/edits.
- **Hypothesis / candidate fix:** When a post-edit/commit hook reformats a file the agent already holds, a diff-only (or suppressed) re-injection would avoid re-dumping the whole file. Needs data on how often formatting-on-commit triggers full re-dumps.
- **Frequency seen:** this session only (one commit).
- **Status:** logged

### Explore sub-agent reports far exceeded the information actually used

- **Category:** context-bloat
- **What happened:** Three parallel Explore agents each returned multi-hundred-line reports (exhaustive prop/type signatures, summary tables, full route lists). Only a fraction informed the grill or plan.
- **Impact:** Large standing context cost early in the session; the grill-with-docs skill assumes scout output is consumed silently, but the tokens are spent regardless of how it's used downstream.
- **Hypothesis / candidate fix:** Add an output-budget convention to scout/Explore prompts (word cap, "signatures only when they change the plan"). Measure whether capped scouts reduce tokens without hurting plan quality across sessions.
- **Frequency seen:** this session only — but likely recurring for any multi-area task.
- **Status:** resolved — AGENTS.md Operating rules now require an output budget on scout/Explore sub-agent prompts. Keep watching whether the cap holds in practice.

### Stale IDE diagnostics surfaced for errors already fixed in the same edit

- **Category:** tooling-friction
- **What happened:** PostToolUse diagnostics reported "Cannot find name 'selectFfeCatalogItems'" / "has no exported member 'FfeCatalogGroup'" immediately after the edit that added the import/type/export, because analysis lagged the edit.
- **Impact:** Risk of chasing phantom errors; needed judgment to recognize them as stale, which costs attention and can trigger unnecessary re-reads.
- **Hypothesis / candidate fix:** Debounce or re-validate diagnostics against the just-applied edit before surfacing, or label them as possibly-stale. Needs frequency data to judge severity.
- **Frequency seen:** recurring within this session (multiple edits).
- **Status:** logged

### Repeated "TodoWrite hasn't been used recently" nudges during active implementation

- **Category:** tooling-friction
- **What happened:** The harness injected TodoWrite reminders repeatedly even while a todo list existed and work was visibly progressing under one in-progress item.
- **Impact:** Low per-instance, but repeated injection adds noise and tokens across a long session.
- **Hypothesis / candidate fix:** Suppress the nudge when an in-progress todo already exists and edits are flowing. Needs data on nudge frequency vs. usefulness.
- **Frequency seen:** recurring within this session.
- **Status:** logged

### Deferred-tool round-trips for common workflow tools

- **Category:** tooling-friction
- **What happened:** `ExitPlanMode` and `TodoWrite` were deferred tools requiring a `ToolSearch` load before first use.
- **Impact:** Minor extra steps for tools that are near-universal in plan/implement workflows.
- **Hypothesis / candidate fix:** Pre-load high-frequency workflow tools (TodoWrite, ExitPlanMode) when entering plan mode. Needs data on whether the deferral meaningfully costs more than it saves.
- **Frequency seen:** this session.
- **Status:** logged

### Plan-mode edit restriction conflicts with grill-with-docs inline-doc updates

- **Category:** instruction-conflict
- **What happened:** grill-with-docs instructs updating `CONTEXT.md` and creating ADRs **inline as decisions crystallize**, but plan mode forbids editing any file except the plan. Decisions (FF&E groups by Category; ADR-0012) had to be deferred to a later slice instead of captured live.
- **Impact:** Documentation lagged the decision; risk of losing nuance between grilling and a later docs slice.
- **Hypothesis / candidate fix:** Either allow grill-with-docs to write CONTEXT/ADR files during plan mode, or have the skill explicitly stage doc changes inside the plan file when plan mode is active. Needs a decision on precedence between skill and mode.
- **Frequency seen:** this session.
- **Status:** logged

### "Implement everything inline" default after plan approval vs. converting to issues

- **Category:** wasted-action
- **What happened:** After ExitPlanMode approval of a 6-slice plan, the default path was to implement all slices inline. Implementation began (Slice 1 done, Slice 2 reads underway) before the user redirected to "publish remaining slices as issues," abandoning the Slice 2 reads.
- **Impact:** Reads of Slice 2 files were discarded; some rework of mental model.
- **Hypothesis / candidate fix:** For large multi-slice plans, prompt the user to choose implement-inline vs. ticket-the-rest before starting execution. Needs data on how often large plans are meant to be ticketed rather than executed.
- **Frequency seen:** this session.
- **Status:** resolved — AGENTS.md Operating rules now require confirming execution mode (inline vs. `to-issues`) for large multi-slice plans before reading ahead. Revisit if the prompt proves unnecessary friction for plans the user clearly wants executed.

---

## 2026-05-30 — Session: Global style refresh (design-brief → plan → implement)

### Grep `content` output did not satisfy the Edit read-precondition; a batched multi-file edit half-failed

- **Category:** wasted-action
- **What happened:** Issued 11 parallel `Edit` calls to swap `hover:underline` → `.text-link` across 9 files, using line context obtained from a `Grep` content search. 10 of 11 failed with "File has not been read yet" because Grep output does not count as a Read for the Edit precondition; had to `Read` each file and re-issue every edit.
- **Impact:** One wasted batch of ~10 tool calls plus a full re-read round — roughly doubled the tool calls for that step.
- **Hypothesis / candidate fix:** Either let a `Grep` content match satisfy the Edit read-precondition for that file, or (agent-side habit) `Read` — not just `Grep` — before batching blind multi-file edits. Needs data on how often Grep-then-Edit is attempted.
- **Frequency seen:** this session.
- **Status:** logged

### PowerShell here-string syntax used inside the Bash tool broke the commit message

- **Category:** tooling-friction
- **What happened:** The environment guidance prominently documents PowerShell `@'...'@` here-strings for multiline commit messages; I applied that syntax inside the **Bash** tool, so `@'` was passed literally and the commit-msg hook rejected a malformed first line. Compounded by using type `style`, which the repo's Conventional-Commits hook disallows (only feat|fix|chore|docs|refactor|test|perf|build|ci). Took two failed commits before switching to a bash heredoc + `refactor` type.
- **Impact:** Two aborted commits; each still ran lint-staged (eslint/prettier) and stashed/restored, adding latency.
- **Hypothesis / candidate fix:** Match shell syntax to the tool actually invoked (bash heredoc for the Bash tool, here-string only for the PowerShell tool); read the repo's allowed commit types before composing. The harness could surface allowed types when a commit-msg hook is present.
- **Frequency seen:** this session.
- **Status:** logged

### Lint-staged commit reformat re-dumped a file into context (recurrence)

- **Category:** context-bloat
- **What happened:** As logged in the catalog-first session, the commit's lint-staged `prettier`/`eslint --fix` reformatted a staged file and the harness re-injected it via a "file modified by linter" note — this time `ProposalExportModal.tsx` (~full component echoed back).
- **Impact:** Repeat of the earlier cost; confirms the pattern spans sessions.
- **Hypothesis / candidate fix:** Diff-only (or suppressed) re-injection when a post-commit hook reformats a file the agent already holds — same fix as the prior entry.
- **Frequency seen:** recurring — also 2026-05-30 catalog-first session.
- **Status:** logged
