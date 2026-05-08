# GitHub Copilot — Project Instructions for ChillDesignStudio

Authoritative project rules live in [/AGENTS.md](/AGENTS.md). Read that file first.

## Copilot-specific additions

These items are not in AGENTS.md and apply only to Copilot:

1. **Migrations are SQL-first.** Use `pnpm migrate` from repo root.
2. **Client/API boundary is strict.** Client talks to `/api/v1/*`; no Neon imports in `/src`.
3. **Deploy via script.** Use `pnpm --filter ffe-api deploy`.
4. **Keep secrets server-side.** `FIREBASE_ADMIN_*` never belongs in client code.

## Local agent skills

The following skills are defined locally in this repo and are not in `skills-lock.json`. Read them via `read_file` when the description matches your task.

| Skill                  | File                                             | Use when                                                                                               |
| ---------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| heavy-agent-delegation | `.agents/skills/heavy-agent-delegation/SKILL.md` | Acting as the heavy/reasoning agent and deciding whether and how to delegate a task to a cheaper model |
