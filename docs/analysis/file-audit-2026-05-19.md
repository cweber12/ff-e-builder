# File Audit: Unused and Outdated Files

> Repository: ChillDesignStudio (ffe-builder)  
> Date: 2026-05-19  
> Scope: Repo root and `/docs/` directory

---

## Summary

**5 files are recommended for deletion** (demo/stray data and outdated prompts).  
**4 documentation issues require updates** (missing index entries, broken references, policy contradictions).  
**2 folder structures need clarification** (`.claude/` vs `.agents/` duplication and `.gitignore` rules).

---

## Files Recommended for Deletion

### 1. `items.csv` — Demo/export data (ROOT)

**Status:** DELETE  
**Rationale:**

- Contains hardcoded test data (e.g. "Coffee Table", "Floor Lamp") from 2026-05-07
- No code references this file (grep search found zero references in src/)
- Appears to be a data export snapshot or demo fixture, not source-controlled data
- Not listed in `.gitignore`, suggesting it's a stray file rather than intentional demo data
- The app dynamically generates CSV exports via `src/lib/export/csv.ts`; no reason to version-control sample data

**Action:** Delete `items.csv`

---

### 2. `projects.csv` — Demo/export data (ROOT)

**Status:** DELETE  
**Rationale:**

- Contains hardcoded project fixtures (e.g. "Cork & Batter", "EARLS Renovation") dated 2026-05-04 to 2026-05-07
- No code references this file
- Same reasoning as `items.csv`: this is demo data that shouldn't be in version control
- Database migrations handle actual schema; this file serves no development or build purpose

**Action:** Delete `projects.csv`

---

### 3. `layout - letter size (1).pdf` — Stray design artifact (ROOT)

**Status:** DELETE  
**Rationale:**

- Filename suggests a layout design mockup or print template export
- No references in code, documentation, or build pipeline
- Not mentioned anywhere in the codebase
- Appears to be leftover design work or a forgotten attachment
- Not listed in `.gitignore`, indicating it's a stray file rather than intentional binary asset

**Action:** Delete `layout - letter size (1).pdf`

---

### 4. `revision-flow-implementation-prompt-updated.md` — Outdated implementation prompt (ROOT)

**Status:** LIKELY DELETE (verify with team first)  
**Rationale:**

- Dated content from May 19, 2026 (today—or very recently)
- References `@handoff_analysis/2026-05-15-revision-implementation-state.md`, suggesting this was a task briefing
- Contains implementation instructions for proposal revision flow changes
- If implementation is already done, this is an obsolete prompt artifact
- If implementation is in progress, the context should move to a GitHub issue or handoff analysis file, not the repo root

**Recommended action:**

- If the revision flow work is **complete**, delete this file
- If the revision flow work is **in progress or pending**, move content to `handoff_analysis/<timestamp>-revision-flow-update.md` and delete the root file
- In either case, do **not** keep implementation prompts in the repo root; they clutter navigation and become stale

---

## Documentation Issues Requiring Updates

### Issue 1: Missing file in index — `agent-setup-handoff.md`

**Location:** `docs/README.md` line 9  
**Problem:**

```markdown
| [agent-setup-handoff.md](agent-setup-handoff.md) | Current agent setup handoff: …
```

File is referenced in the index but **does not exist** in `/docs/`.

**Impact:**

- Readers following the index table will encounter a broken link
- Unclear whether this file was deleted, renamed, or never created

**Recommended action:**

- **If the file should exist:** create it at `docs/agent-setup-handoff.md` with content covering agent setup context, strengths, gaps, and improvement plan (as described in the index)
- **If the file is no longer needed:** remove the row from `docs/README.md` index

---

### Issue 2: Stale and contradictory policy on check-run commands

**Location:**

- `AGENTS.md` (authoritative, operating rules) — line ~22
- `.github/copilot-instructions.md` — guardrail #5
- `/.cursorrules` — references AGENTS.md correctly

**Problem (from docs/agent-file-audit.md):**

`AGENTS.md` states:

> "Never run `pnpm typecheck && pnpm lint && pnpm test && pnpm build` yourself. Provide the command as a prompt."

`.github/copilot-instructions.md` and `CLAUDE.md` (if it exists) state:

> "Run checks before every commit. `pnpm typecheck && pnpm lint && pnpm test && pnpm build` must all pass before drafting a commit message."

**These are directly contradictory.**

**Impact:**

- GitHub Copilot (and any agent using copilot-instructions.md) will run heavy build/test commands automatically
- Other agents reading AGENTS.md will refuse to run them
- Causes confusion and inconsistent behavior across agents

**Recommended action:**

- Update `.github/copilot-instructions.md` to state: "Provide `pnpm typecheck && pnpm lint && pnpm test && pnpm build` as a prompt for the user to run; do not execute it yourself."
- Ensure all agent-specific files (`.agents/`, `.claude/`, `.github/`) defer to AGENTS.md rather than override it
- Add a note in AGENTS.md clarifying that agent-specific overrides are **not** permitted for operating rules (only allowed for non-conflicting, tool-specific guidance)

---

### Issue 3: `docs/agent-file-audit.md` is a stale snapshot

**Location:** `docs/agent-file-audit.md`  
**Problem:**

- Dated 2026-05-07 (12 days old)
- Documents specific issues that may or may not have been fixed
- Issue #2 and #3 from that audit are still visible in the codebase (contradictory policies and missing CONTEXT.md in read-first lists)
- Having a stale audit file in docs/ suggests ongoing problems were not resolved

**Recommended action:**

- Move `docs/agent-file-audit.md` to `handoff_analysis/2026-05-07-agent-file-audit.md` (archive it with timestamp)
- Create a new action item in the codebase to resolve the three issues identified:
  1. ✅ or ❌ Fix check-run policy contradiction (see Issue 2 above)
  2. ✅ or ❌ Add CONTEXT.md to AGENTS.md read-first list
  3. ✅ or ❌ Update docs/README.md to list all 14 docs files (currently lists only 7)
- Once resolved, update the archived audit file with resolution status

---

### Issue 4: Incomplete docs index

**Location:** `docs/README.md` (Reference section)  
**Problem:**

- Index lists 7 reference files
- `/docs/` actually contains 14 files (accounting for subdirectories)
- Missing entries (not indexed):
  - `accessibility.md`
  - `design-system.md`
  - `images.md`
  - `materials.md`
  - `privacy.md`
  - `roadmap.md`
  - `troubleshooting.md`
  - `plans-context.md`

**Impact:**

- Agents or new developers reading `docs/README.md` will miss critical reference docs
- `images.md` and `materials.md` are core to FF&E/Proposal architecture
- `troubleshooting.md` is not discoverable, making debugging harder

**Recommended action:**
Add all 8 missing files to the "Reference" section of `docs/README.md`, grouped logically:

```markdown
## Reference — load when relevant

### Implementation & Architecture

| File                                                           | Description                                                        |
| -------------------------------------------------------------- | ------------------------------------------------------------------ |
| [architecture.md](architecture.md)                             | System context, component, sequence, and ER diagrams; decision log |
| [images.md](images.md)                                         | Image entity model, upload flow, R2 storage, and crop docs         |
| [materials.md](materials.md)                                   | Finish Library and material entity docs                            |
| [generated-item-table-state.md](generated-item-table-state.md) | FF&E/Proposal Generated Item table state and implementation plan   |
| [plans-context.md](plans-context.md)                           | Plans workspace context; calibration, measurements, derived images |

### Design & UI

| File                                 | Description                                           |
| ------------------------------------ | ----------------------------------------------------- |
| [design-system.md](design-system.md) | Design tokens, component conventions, Tailwind config |
| [accessibility.md](accessibility.md) | Accessibility guidelines and ARIA conventions         |

### Operations & Support

| File                                     | Description                                                             |
| ---------------------------------------- | ----------------------------------------------------------------------- |
| [money.md](money.md)                     | Integer-minor-units convention; which fields are cents; display helpers |
| [contributing.md](contributing.md)       | Branching, PR conventions, commit format, migrations, ADRs              |
| [runbook.md](runbook.md)                 | Deployment, rollback, log access, secret rotation, DB migrations        |
| [troubleshooting.md](troubleshooting.md) | Debugging guide and runbook for common issues                           |

### Project Context

| File                     | Description                                                           |
| ------------------------ | --------------------------------------------------------------------- |
| [roadmap.md](roadmap.md) | Feature roadmap — not needed for implementation work                  |
| [privacy.md](privacy.md) | Privacy policy and data handling — not needed for implementation work |
```

---

## Folder Structure Issues

### Issue 5: Duplication and unclear purpose of `.claude/` vs `.agents/`

**Location:** `.claude/` and `.agents/` directories  
**Problem:**

- Both directories exist and contain similar skill/agent structures
- `.claude/settings.local.json` suggests `.claude/` is for local Claude Code user data
- `.agents/` contains checked-in agent customization files
- `.gitignore` line 41 ignores `.claude/worktrees/` but not all of `.claude/`
- Unclear which is source-of-truth for agent skills and configurations

**Recommended action:**

- Clarify in `README.md` or `AGENTS.md` that:
  - `.agents/` is the **authoritative, version-controlled** agent configuration directory (skills, ADRs, etc.)
  - `.claude/` is **local machine state** only (settings, worktrees, local user preferences)
  - Never commit to `.claude/` except for intentional global settings that must be shared (if any)
  - Update `.gitignore` to exclude all `.claude/` except explicit approved global configs (if any)

---

### Issue 6: `handoff_analysis/` folder is well-organized but underutilized

**Location:** `handoff_analysis/`  
**Observation (not a problem):**

- Contains 9 timestamped handoff reviews (2026-05-07 through 2026-05-15)
- README explains the purpose clearly
- Folder is well-managed and should continue

**Recommendation:**

- Keep this pattern; move stale audit/analysis files here when they're no longer active
- Consider adding a `handoff_analysis/INDEX.md` that summarizes key findings from recent reviews, with links to the full timestamped files

---

## Summary: Recommended Actions

### Delete (High Priority)

- [ ] `items.csv`
- [ ] `projects.csv`
- [ ] `layout - letter size (1).pdf`

### Delete or Archive (Medium Priority)

- [ ] `revision-flow-implementation-prompt-updated.md` → move to handoff_analysis/ if in-progress, or delete if complete

### Update Documentation (High Priority)

- [ ] Fix check-run policy contradiction in `.github/copilot-instructions.md`
- [ ] Update `docs/README.md` to list all 14 docs files

### Create or Update Files (Medium Priority)

- [ ] Create `docs/agent-setup-handoff.md` if the handoff guidance is still relevant, or remove from index
- [ ] Archive `docs/agent-file-audit.md` → `handoff_analysis/2026-05-07-agent-file-audit.md`
- [ ] Clarify `.claude/` vs `.agents/` in README.md or AGENTS.md

### Verify (Low Priority)

- [ ] Ensure CONTEXT.md is in AGENTS.md "Files to read first" list (mentioned in agent-file-audit.md)

---

## Files That Are Okay

- ✅ `skills-lock.json` — active, necessary for skill version management
- ✅ `handoff_analysis/` — well-structured handoff notes, keep as-is
- ✅ `.agents/` and `.claude/` — need clarity (see Issue 5), but not "bad"
- ✅ `dist/`, `node_modules/`, `test-results/` — build/runtime artifacts, handled by `.gitignore`
- ✅ All `.ts`, `.tsx`, `.css` source files — active code
- ✅ `docs/adr/`, `docs/design/`, `docs/instructions/`, `docs/generated/` — subdirectories are organized and populated appropriately
