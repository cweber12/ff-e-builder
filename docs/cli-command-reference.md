# CLI Command Reference

Reusable command templates for this repo's CLI agents.

## Purpose

- Reduce repeated command trial-and-error.
- Standardize known-good command formats by intent.
- Keep command guidance argument-free and safe to reuse.

## Usage rules

- Check this file before inventing a new command format.
- Copy a matching template, then fill in placeholders.
- If a command format fails and you find a working reusable variant, update this file after success.
- Do not store task-specific values or sensitive data.

Never include:

- secrets, tokens, passwords, API keys
- issue numbers, branch names, personal paths, IDs
- one-off arguments that are not generally reusable

## Entry template

Use this exact structure for new entries.

```md
### <Intent name>

- Intent: <what this command is for>
- Shell/context: <powershell | bash>, <repo root or subdir>
- Command template: `<template with placeholders like <path> <pattern>>`
- Escalation: <when to retry with escalation>
- Output expectation: <what success looks like>
- Last verified: <YYYY-MM-DD>
- Notes: <optional constraints or gotchas>
```

## Known-good templates

### File listing

- Intent: quickly list tracked files in target areas
- Shell/context: powershell, repo root
- Command template: `rg --files <paths>`
- Escalation: retry with escalation only if process creation/sandbox fails before execution
- Output expectation: newline-separated file paths
- Last verified: 2026-05-28

### Pattern search

- Intent: find references and usages by pattern
- Shell/context: powershell, repo root
- Command template: `rg -n "<pattern>" <paths>`
- Escalation: retry with escalation only if process creation/sandbox fails before execution
- Output expectation: `path:line:match`
- Last verified: 2026-05-28

### GitHub issue summary

- Intent: fetch issue metadata for triage
- Shell/context: powershell, repo root with `gh` auth configured
- Command template: `gh issue view <number> --json number,title,body,labels,state,author,createdAt,updatedAt,url`
- Escalation: retry with escalation only if sandbox/process launch blocks execution
- Output expectation: single JSON object with requested fields
- Last verified: 2026-05-28

### GitHub issue comments

- Intent: read full issue discussion context
- Shell/context: powershell, repo root with `gh` auth configured
- Command template: `gh issue view <number> --comments`
- Escalation: retry with escalation only if sandbox/process launch blocks execution
- Output expectation: issue details plus ordered comments
- Last verified: 2026-05-28

### GitHub issue label edit

- Intent: apply triage state/category labels
- Shell/context: powershell, repo root with `gh` auth configured
- Command template: `gh issue edit <number> --add-label <label> --remove-label <label>`
- Escalation: retry with escalation only if sandbox/process launch blocks execution
- Output expectation: issue URL returned and labels updated
- Last verified: 2026-05-28

### GitHub issue comment post

- Intent: post structured triage or handoff comments
- Shell/context: powershell, repo root with `gh` auth configured
- Command template: `gh issue comment <number> --body-file <file>`
- Escalation: retry with escalation only if sandbox/process launch blocks execution
- Output expectation: comment URL returned
- Last verified: 2026-05-28

### Targeted test run

- Intent: run narrow verification for a specific test file
- Shell/context: powershell, repo root
- Command template: `pnpm exec vitest run <path-to-test>`
- Escalation: retry with escalation when sandbox/network restrictions block dependency or process access
- Output expectation: targeted test output with pass/fail summary
- Last verified: 2026-05-28

### Targeted lint run

- Intent: lint specific changed files
- Shell/context: powershell, repo root
- Command template: `pnpm exec eslint <path-to-file>`
- Escalation: retry with escalation when sandbox/network restrictions block dependency or process access
- Output expectation: eslint report for target files
- Last verified: 2026-05-28

### Full verification suite

- Intent: validate repository health before or after risky changes
- Shell/context: powershell, repo root
- Command template: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
- Escalation: retry with escalation when sandbox/network restrictions block dependency or process access
- Output expectation: all steps exit 0
- Last verified: 2026-05-28
