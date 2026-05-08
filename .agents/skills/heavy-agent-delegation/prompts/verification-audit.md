# Verification / Audit Light-Agent Prompt

TASK FOR LIGHT AGENT

Update type:
verification / final audit

Primary goal:
Verify the latest changes and identify only mechanical failures.

Run these commands in order:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Allowed fixes:

- missing imports
- stale references
- TypeScript errors
- ESLint errors
- test fixture updates
- expected snapshot updates
- obvious command failures caused by the latest change

Forbidden fixes:

- architecture changes
- UX redesigns
- schema changes
- new features
- broad refactors
- unrelated cleanup
- product behavior changes

Failure vs warning:

- Failure: a command exits non-zero, a test fails, TypeScript reports an error, ESLint reports an error, or build fails.
- Warning: suspicious output that does not fail the command, such as deprecation warnings, flaky-test hints, or unrelated console noise.
- Do not fix warnings unless they are directly caused by the latest change and the fix is mechanical.

Return your response in EXACTLY this format:

1. Commands Run

- Command:
- Result: pass/fail/not run
- Notes:

2. Failures Found

- Failure:
- Root cause:
- Files involved:
- Mechanical fix available: yes/no

3. Mechanical Fixes Applied

- Files changed:
- What changed:
- Why safe/mechanical:

4. Warnings / Non-Blocking Issues

- Warning:
- Why non-blocking:
- Should heavy agent care: yes/no

5. Deferred Failures

- Failure:
- Why not mechanical:
- Heavy-agent decision needed:

6. Final Status

- typecheck:
- lint:
- test:
- build:
- Verification still required: yes/no

Rules:

- Do not widen scope.
- Fix only mechanical failures caused by the latest changes.
- If a failure requires design/product/architecture judgment, stop and defer it.
- Use exact repo-relative paths.
- Do not summarize unrelated repo issues unless they block verification.
