# Codex Session Insights

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

## 2026-05-30 — Session: Issue #102 import collision parity implementation

### Sandbox launcher failure forced repeated escalated retries

- **Category:** tooling-friction
- **What happened:** Multiple commands failed with `windows sandbox: spawn setup refresh` before execution, requiring immediate `require_escalated` retries for issue reads, file discovery, and verification.
- **Impact:** Added repeated command round-trips and justification overhead before productive work could continue.
- **Hypothesis / candidate fix:** Add a session-level fallback toggle after first launcher failure (auto-escalate for safe command categories already listed in AGENTS) and measure reduction in retry churn.
- **Frequency seen:** recurring within this session.
- **Status:** logged

### Issue brief path mismatch caused avoidable discovery churn

- **Category:** wasted-action
- **What happened:** The issue brief referenced `src/components/materials/import/*`, but that path did not exist; the implementation had to stop and re-discover actual import locations (`src/lib/import` plus modal-local logic).
- **Impact:** Extra search/read steps and brief context expansion before implementation could start.
- **Hypothesis / candidate fix:** Add a preflight path-validation check for Agent Briefs that quickly confirms proposed paths exist and flags mismatches up front.
- **Frequency seen:** this session only (first observed here).
- **Status:** logged

### Full-file reads for large component files inflated working context

- **Category:** context-bloat
- **What happened:** Large files (import modals and related view files) were read in full to locate collision behavior, even though only focused regions were ultimately needed.
- **Impact:** Increased token usage and reduced signal-to-noise during reasoning.
- **Hypothesis / candidate fix:** Enforce a stronger default of `rg -n` + targeted line-range reads first, with full-file reads only when broad edits are confirmed necessary.
- **Frequency seen:** recurring within this session.
- **Status:** logged

### Commit-hook auto-fixes introduced extra verification loop

- **Category:** tooling-friction
- **What happened:** `git commit` triggered lint-staged (`eslint --fix` and `prettier --write`), which modified staged content during commit and required a post-commit targeted test rerun to reconfirm final state.
- **Impact:** Added one additional verify pass and execution time after a "successful" commit.
- **Hypothesis / candidate fix:** Capture a documented expectation for post-commit re-check scope when lint-staged mutates files, and evaluate whether pre-commit targeted formatting/lint could reduce repeated loops.
- **Frequency seen:** this session only.
- **Status:** logged
