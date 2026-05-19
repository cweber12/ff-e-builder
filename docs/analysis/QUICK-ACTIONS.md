# Quick Action Checklist

> **Repository:** ChillDesignStudio (ffe-builder)  
> **Audit Date:** 2026-05-19  
> **Full Report:** [file-audit-2026-05-19.md](file-audit-2026-05-19.md)

---

## 🚨 High Priority — Delete Stray Files

These files serve no purpose and clutter the repo root:

- [ ] **Delete `items.csv`** — Demo data export, not referenced anywhere
- [ ] **Delete `projects.csv`** — Demo data export, not referenced anywhere
- [ ] **Delete `layout - letter size (1).pdf`** — Stray design artifact, no references

---

## ⚠️ Medium Priority — Fix Documentation Contradictions

### 1. Check-Run Policy Conflict

**Files affected:** `.github/copilot-instructions.md` vs `AGENTS.md`

**Problem:** Copilot instructions say "run checks before commit" but AGENTS.md says "don't run them yourself."

**Fix:** Update `.github/copilot-instructions.md` guardrail #5 to match AGENTS.md:

> "Provide `pnpm typecheck && pnpm lint && pnpm test && pnpm build` as a prompt for the user to run; do not execute it yourself."

---

### 2. Update Docs Index

**File:** `docs/README.md`

**Problem:** Index lists only 7 docs, but `/docs/` has 14 files. Missing entries:

- accessibility.md
- design-system.md
- images.md
- materials.md
- privacy.md
- roadmap.md
- troubleshooting.md
- plans-context.md

**Fix:** Add all 8 missing files to the Reference section, grouped by category.

---

## 📋 Low Priority — Housekeeping

- [ ] **Clarify `.claude/` vs `.agents/`** — Document that `.agents/` is version-controlled; `.claude/` is local-only
- [ ] **Archive stale audit** — Move `docs/agent-file-audit.md` to `handoff_analysis/2026-05-07-agent-file-audit.md`
- [ ] **Verify CONTEXT.md** — Ensure it's listed in AGENTS.md "Files to read first"
- [ ] **Handle `revision-flow-implementation-prompt-updated.md`** — Delete if work is complete, or move to handoff_analysis/ if in-progress

---

## Why These Issues Matter

| Issue                   | Impact                                                                      | Effort to Fix |
| ----------------------- | --------------------------------------------------------------------------- | ------------- |
| Stray CSV/PDF files     | Confuses repo purpose; inflates clone size                                  | 2 minutes     |
| Check-run contradiction | Agents run different commands; inconsistent CI behavior                     | 5 minutes     |
| Incomplete docs index   | Developers miss critical docs (images.md, materials.md, troubleshooting.md) | 10 minutes    |
| `.claude/` ambiguity    | Unclear what's version-controlled vs. local                                 | 5 minutes     |

**Total effort:** ~22 minutes. **High impact:** Cleaner repo, consistent agent behavior, better discoverability.

---

## ✅ Files That Are Good

- `skills-lock.json` — active, necessary
- `handoff_analysis/` — well-structured
- All source files in `src/`, `api/`
- All docs in `docs/adr/`, `docs/design/`, `docs/generated/`, `docs/instructions/`
- `.gitignore` and build configs
