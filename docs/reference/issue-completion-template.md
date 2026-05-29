# Issue Completion Template

Use this template for the **Post-Implementation Completion Gate** comment on GitHub issues.

## Completion comment template

```md
Implemented issue #<number>.

## Implementation summary

- <concise change 1>
- <concise change 2>

## Changed files

- <path/to/file-1>
- <path/to/file-2>

## Checks run

- `<command 1>` (pass/fail)
- `<command 2>` (pass/fail)
- If delegated by approved sliced-work plan: `Verification delegated to user per approved sliced-work plan.`

## Commit

- <commit-hash>
```

## Close checklist (same turn, required)

1. Post completion comment using `gh issue comment <number> --body-file <file>`.
2. Confirm the returned comment URL.
3. Close the issue using `gh issue close <number>` or move it to the repo-defined completed state.

## Notes

- Keep this comment concise and implementation-specific.
- Do not include secrets, local absolute paths, or unrelated changes.
- If pre-existing unrelated worktree changes exist, list only files that were part of the issue scope.
