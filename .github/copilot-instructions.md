# GitHub Copilot — Project Instructions for ChillDesignStudio

Authoritative project rules live in [/AGENTS.md](/AGENTS.md). Read that file first.

## Copilot-specific additions

These items are not in AGENTS.md and apply only to Copilot:

1. **When work is planned in named slices, pause after each slice.** Output the commit message as a fenced code block and wait for the user to confirm before starting the next slice. Do not run multiple slices back-to-back without confirmation.
2. **Use native tools for search and verification.** Use `search_subagent`, `execution_subagent`, `grep_search`, `file_search`, and the `scout`/`Explore` agents for discovery, search, and running `pnpm typecheck && pnpm lint && pnpm test && pnpm build`. Do not pause and output a handoff prompt — run it directly.

## Local agent skills

The following skills are defined locally in this repo and are not in `skills-lock.json`. Read them via `read_file` when the description matches your task.

| Skill                  | File                                             | Use when                                                                                               |
| ---------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| heavy-agent-delegation | `.agents/skills/heavy-agent-delegation/SKILL.md` | Acting as the heavy/reasoning agent and deciding whether and how to delegate a task to a cheaper model |
