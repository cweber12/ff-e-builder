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

### File read (partial)

- Intent: read a bounded section of a file for targeted inspection
- Shell/context: powershell, repo root
- Command template: `Get-Content -Path <path> | Select-Object -First <n>`
- Escalation: retry with escalation only if process creation/sandbox fails before execution
- Output expectation: first `<n>` lines from target file
- Last verified: 2026-05-29

### Git status (short)

- Intent: inspect working tree state quickly
- Shell/context: powershell, repo root
- Command template: `git status --short`
- Escalation: retry with escalation only if process creation/sandbox fails before execution
- Output expectation: concise modified/untracked file list
- Last verified: 2026-05-29

### Git path-scoped stage

- Intent: stage only approved-scope files in a dirty worktree
- Shell/context: powershell, repo root
- Command template: `git add <path> [<path> ...]`
- Escalation: retry with escalation only if process creation/sandbox fails before execution
- Output expectation: selected files staged without broad staging
- Last verified: 2026-05-29

### Git commit (conventional)

- Intent: commit scoped changes with conventional commit subject and why-body
- Shell/context: powershell, repo root
- Command template: `git commit -m "<type>(<scope>): <subject>" -m "<why>"`
- Escalation: retry with escalation only if process creation/sandbox fails before execution
- Output expectation: commit hash and file summary
- Last verified: 2026-05-29

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

### Issue completion state check

- Intent: fetch current issue state before completion operations
- Shell/context: powershell, repo root with `gh` auth configured
- Command template: `gh issue view <number> --json number,title,state,labels,url`
- Escalation: if process launch fails with `CreateProcessAsUserW failed: 1312`, retry once immediately with escalation
- Output expectation: single JSON object showing current state and labels
- Last verified: 2026-05-28

### Issue completion label/state update

- Intent: move issue from triage/in-progress labels into completed state labels
- Shell/context: powershell, repo root with `gh` auth configured
- Command template: `gh issue edit <number> --add-label <completed-label> --remove-label <from-label>`
- Escalation: if process launch fails with `CreateProcessAsUserW failed: 1312`, retry once immediately with escalation
- Output expectation: issue updated with completion label/state mapping
- Last verified: 2026-05-28

### Issue completion comment post

- Intent: publish structured completion note after commit
- Shell/context: powershell, repo root with `gh` auth configured
- Command template: `gh issue comment <number> --body-file <completion-comment-file>`
- Escalation: if process launch fails with `CreateProcessAsUserW failed: 1312`, retry once immediately with escalation
- Output expectation: comment URL returned
- Last verified: 2026-05-28

### Issue close

- Intent: close issue after completion comment is posted
- Shell/context: powershell, repo root with `gh` auth configured
- Command template: `gh issue close <number>`
- Escalation: if process launch fails with `CreateProcessAsUserW failed: 1312`, retry once immediately with escalation
- Output expectation: issue state changes to closed/completed
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

## Troubleshooting

### Sandbox launcher failure pattern

- Symptom: command fails before execution with `CreateProcessAsUserW failed: 1312`.
- Action: retry once immediately with escalation for the same command intent.
- Do not do: repeated non-escalated retries of the same command intent.
- Keep scope fixed: do not broaden command scope while performing fallback.

### Session fallback mode after first `1312`

- Trigger: first confirmed launcher failure with `CreateProcessAsUserW failed: 1312`.
- Action: for the rest of the current task/session, default recurring command categories to escalated execution:
  - `gh issue view/comment/close`
  - `rg --files`, `rg -n`
  - `Get-Content`
  - `pnpm exec vitest run <path-to-test>`
  - `pnpm exec eslint <path-to-file>`
  - `git status`, `git add <paths>`, `git commit`
- Guardrail: keep command intent and scope unchanged; escalation is reliability fallback, not privilege expansion.
