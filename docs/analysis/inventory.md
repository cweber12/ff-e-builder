# Docs Directory Inventory

> **Date:** 2026-05-19  
> **Purpose:** Reference guide to all files in `/docs/` and repo root with status and purpose

---

## Docs Directory Files (`/docs/`)

| File                            | Status          | Purpose                             | Last Updated             | Notes                                                      |
| ------------------------------- | --------------- | ----------------------------------- | ------------------------ | ---------------------------------------------------------- |
| `README.md`                     | ⚠️ NEEDS UPDATE | Index of all docs                   | Recent                   | **Missing 8 entries** in Reference section                 |
| `CONTEXT.md`                    | ✅ CURRENT      | Canonical domain terminology        | Recent                   | Critical read-first file; not in AGENTS.md read-first list |
| `architecture.md`               | ✅ CURRENT      | System context, diagrams, ERD       | Recent                   | Read-first file; comprehensive                             |
| `changelog.md`                  | ✅ CURRENT      | Keep-a-Changelog format             | Recent                   | Read-first file; well-maintained                           |
| `contributing.md`               | ✅ CURRENT      | Git workflow, PR conventions, ADRs  | Recent                   | Referenced in index; active                                |
| `accessibility.md`              | ✅ CURRENT      | WCAG guidelines and ARIA            | Recent                   | **Missing from README index**                              |
| `design-system.md`              | ✅ CURRENT      | Design tokens, Tailwind config      | Recent                   | **Missing from README index**                              |
| `images.md`                     | ✅ CURRENT      | Image entity, upload, crop docs     | Recent                   | **Missing from README index**                              |
| `materials.md`                  | ✅ CURRENT      | Finish Library, material entity     | Recent                   | **Missing from README index**                              |
| `money.md`                      | ✅ CURRENT      | Integer-cents convention            | Recent                   | Referenced in README; active                               |
| `roadmap.md`                    | ✅ CURRENT      | Feature roadmap                     | Recent                   | **Missing from README index**                              |
| `privacy.md`                    | ✅ CURRENT      | Privacy policy, data handling       | Recent                   | **Missing from README index**                              |
| `troubleshooting.md`            | ✅ CURRENT      | Debugging, runbook support          | Recent                   | **Missing from README index**                              |
| `runbook.md`                    | ✅ CURRENT      | Deployment, rollback, DB migrations | Recent                   | Referenced in README; active                               |
| `plans-context.md`              | ✅ CURRENT      | Plans workspace implementation      | Recent                   | **Missing from README index**                              |
| `generated-item-table-state.md` | ✅ CURRENT      | FF&E/Proposal table consolidation   | Recent                   | Referenced in architecture.md; active                      |
| `agent-file-audit.md`           | ⚠️ STALE        | Snapshot of agent config issues     | 2026-05-07 (12 days old) | **Should be archived** to handoff_analysis/                |

---

## Docs Subdirectories

| Directory       | Status    | Purpose                       | Notes                                                                                                        |
| --------------- | --------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `adr/`          | ✅ ACTIVE | Architecture Decision Records | Well-organized; 9 decisions recorded                                                                         |
| `design/`       | ✅ ACTIVE | Design artifacts              | Contains `table-ui-redesign.md`                                                                              |
| `generated/`    | ✅ ACTIVE | Generated artifacts           | `architecture-map.*` and `database-map.*` (auto-generated, refresh with `pnpm arch:scan` and `pnpm db:scan`) |
| `instructions/` | ✅ ACTIVE | Task/workflow instructions    | Contains `style-audit-prompt.md`; appropriate location                                                       |
| `analysis/`     | ✅ NEW    | Audit reports and analysis    | Created 2026-05-19; this file and file-audit-2026-05-19.md                                                   |

---

## Repo Root Files

| File                                             | Status          | Location | Purpose                       | Recommendation                                           |
| ------------------------------------------------ | --------------- | -------- | ----------------------------- | -------------------------------------------------------- |
| `items.csv`                                      | 🗑️ DELETE       | Root     | Demo data export              | Remove — not referenced, no build value                  |
| `projects.csv`                                   | 🗑️ DELETE       | Root     | Demo data export              | Remove — not referenced, no build value                  |
| `layout - letter size (1).pdf`                   | 🗑️ DELETE       | Root     | Stray design artifact         | Remove — orphaned file, no references                    |
| `revision-flow-implementation-prompt-updated.md` | ⚠️ REVIEW       | Root     | Implementation briefing       | Delete if done; move to handoff_analysis/ if in-progress |
| `README.md`                                      | ✅ CURRENT      | Root     | Project overview              | Comprehensive; kept up-to-date                           |
| `AGENTS.md`                                      | ✅ CURRENT      | Root     | Authoritative operating rules | Check-run policy should match copilot-instructions.md    |
| `CONTEXT.md`                                     | ✅ CURRENT      | Root     | Domain terminology            | Should be in AGENTS.md read-first list                   |
| `.cursorrules`                                   | ✅ CURRENT      | Root     | Cursor editor rules           | Correctly references AGENTS.md                           |
| `.github/copilot-instructions.md`                | ⚠️ NEEDS UPDATE | .github/ | GitHub Copilot instructions   | **Contradicts AGENTS.md** on check-run policy            |
| `.env.example`                                   | ✅ CURRENT      | Root     | Environment template          | Maintained                                               |
| `.gitignore`                                     | ✅ CURRENT      | Root     | Exclude patterns              | Review: clarify `.claude/` handling                      |
| `package.json`                                   | ✅ CURRENT      | Root     | npm/pnpm config               | Active                                                   |
| `pnpm-workspace.yaml`                            | ✅ CURRENT      | Root     | Workspace config              | Active                                                   |
| `tsconfig.json`                                  | ✅ CURRENT      | Root     | TypeScript config             | Active                                                   |
| `vite.config.ts`                                 | ✅ CURRENT      | Root     | Vite build config             | Active                                                   |
| `tailwind.config.ts`                             | ✅ CURRENT      | Root     | Tailwind config               | Active                                                   |
| `postcss.config.js`                              | ✅ CURRENT      | Root     | PostCSS config                | Active                                                   |
| `eslint.config.js`                               | ✅ CURRENT      | Root     | ESLint config                 | Active                                                   |
| `.prettierrc`                                    | ✅ CURRENT      | Root     | Prettier config               | Active                                                   |
| `.npmrc`                                         | ✅ CURRENT      | Root     | npm config                    | Active                                                   |
| `playwright.config.ts`                           | ✅ CURRENT      | Root     | Playwright test config        | Active                                                   |
| `index.html`                                     | ✅ CURRENT      | Root     | Vite entry point              | Active                                                   |

---

## Hidden Folder Inventory

| Folder               | Status     | Purpose                             | Notes                                                                       |
| -------------------- | ---------- | ----------------------------------- | --------------------------------------------------------------------------- |
| `.git/`              | ✅ ACTIVE  | Git repo                            | Standard                                                                    |
| `.github/`           | ✅ ACTIVE  | GitHub workflows & agents           | Contains CI/CD (workflows/), Copilot instructions, agent configs (agents/)  |
| `.github/workflows/` | ✅ ACTIVE  | GitHub Actions                      | `ci.yml`, `deploy.yml`                                                      |
| `.github/agents/`    | ✅ ACTIVE  | GitHub agent configs                | `scout.agent.md`                                                            |
| `.agents/`           | ✅ ACTIVE  | **Checked-in** agent skills & rules | Source of truth for agent customization; contains local skills not in npm   |
| `.claude/`           | ⚠️ CLARIFY | **Local-only** Claude Code settings | Version-controlled parts unclear; `.claude/worktrees/` correctly gitignored |
| `.husky/`            | ✅ ACTIVE  | Git hooks config                    | Standard                                                                    |
| `node_modules/`      | ✅ ACTIVE  | npm packages                        | .gitignored                                                                 |
| `dist/`              | ✅ ACTIVE  | Build output                        | .gitignored                                                                 |
| `test-results/`      | ✅ ACTIVE  | Test artifacts                      | .gitignored                                                                 |

---

## Handoff Analysis Folder

| File                                                   | Date       | Status      | Purpose                                     |
| ------------------------------------------------------ | ---------- | ----------- | ------------------------------------------- |
| `README.md`                                            | —          | ✅ ACTIVE   | Guidelines for timestamped handoff reviews  |
| `2026-05-07T00-00-00-plans-handoff-review.md`          | 2026-05-07 | ✅ ARCHIVED | Plans tool handoff review                   |
| `2026-05-07T00-00-01-plans-crop-slice-review.md`       | 2026-05-07 | ✅ ARCHIVED | Crop functionality handoff                  |
| `2026-05-07T00-00-02-plans-plan-image-slice-review.md` | 2026-05-07 | ✅ ARCHIVED | Plan image handling handoff                 |
| `2026-05-07T00-00-03-plans-layout-pass-review.md`      | 2026-05-07 | ✅ ARCHIVED | Layout pass handoff                         |
| `2026-05-07T00-00-04-plans-item-plan-search-review.md` | 2026-05-07 | ✅ ARCHIVED | Item plan search handoff                    |
| `2026-05-07T00-00-05-plans-ffe-item-plan-review.md`    | 2026-05-07 | ✅ ARCHIVED | FF&E item plan handoff                      |
| `2026-05-07T00-00-06-plans-ui-review-pass.md`          | 2026-05-07 | ✅ ARCHIVED | UI review pass handoff                      |
| `2026-05-07T00-00-07-plans-local-ui-cleanup-pass.md`   | 2026-05-07 | ✅ ARCHIVED | Local UI cleanup handoff                    |
| `2026-05-07T00-00-08-plans-technical-debt-pass.md`     | 2026-05-07 | ✅ ARCHIVED | Technical debt pass handoff                 |
| `2026-05-07T00-00-09-plans-fullscreen-shell-pass.md`   | 2026-05-07 | ✅ ARCHIVED | Fullscreen shell pass handoff               |
| `2026-05-15-revision-implementation-state.md`          | 2026-05-15 | ✅ ARCHIVED | Proposal revision flow implementation state |

---

## Legend

| Symbol | Meaning                                |
| ------ | -------------------------------------- |
| ✅     | Good; no action needed                 |
| ⚠️     | Needs review, update, or clarification |
| 🗑️     | Delete/remove                          |

---

## Summary Statistics

| Category                      | Count | Status                                              |
| ----------------------------- | ----- | --------------------------------------------------- |
| Docs files (in `/docs/`)      | 16    | ✅ Active; 1 stale (agent-file-audit.md)            |
| Docs with missing index entry | 8     | ⚠️ Need README.md update                            |
| Root-level files to delete    | 3     | 🗑️ (CSV × 2, PDF × 1)                               |
| Root-level files to review    | 1     | ⚠️ (revision-flow-implementation-prompt-updated.md) |
| Contradictory policies        | 1     | ⚠️ (.github/copilot-instructions.md vs AGENTS.md)   |
| Stale/incomplete docs         | 1     | ⚠️ (agent-file-audit.md)                            |
| Handoff analysis files        | 11    | ✅ (well-organized, timestamped)                    |
