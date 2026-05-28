# Testing Matrix

## Purpose

Define the minimum safe verification per change type for time and token efficiency.

## Verification levels

### Level A

Narrow targeted checks in changed modules only.

### Level B

Targeted checks plus one boundary-adjacent check.

### Level C

Full-suite gate for high-risk or release-significant changes.

## Change-type matrix

### Docs-only edits

- Required: none
- Optional: quick link sanity pass
- Level: A

### Styling or layout shell changes

- Required: targeted UI tests for impacted views
- Optional: one focused end-to-end route check
- Level: A to B

### Single feature module behavior

- Required: module unit and component tests
- Optional: one happy-path integration test
- Level: B

### Shared hook or shared utility

- Required: utility tests plus representative consumer tests
- Optional: one broader module check
- Level: B

### API route or validation logic

- Required: route-level API tests including auth and error paths
- Optional: one consumer-side contract check
- Level: B

### Migration or schema semantics

- Required: migration apply check plus impacted API tests
- Optional: one end-to-end flow if user-visible data behavior changes
- Level: C

### API contract change consumed by frontend

- Required: API tests plus affected frontend tests
- Optional: one end-to-end flow on a key user path
- Level: C

### Cross-boundary slice (UI + API + DB)

- Required: targeted checks per boundary
- Optional: one happy path and one edge path end-to-end check
- Level: C

## Full-suite gate triggers

1. Before merge to a protected branch.
2. After migration changes.
3. After API contract changes.
4. After high-blast-radius refactors.
5. When explicitly requested.

## When not to run the full suite

1. Pure docs changes.
2. Isolated presentational tweaks with no behavior impact.
3. Small internal refactors with unchanged behavior and passing targeted checks.

## Commit cadence

1. Keep slices small and reviewable.
2. Run targeted checks per slice.
3. Commit after slice checks pass.
4. Run full-suite checks at milestone gates, not every micro-commit.
5. Follow sliced-work policy in `AGENTS.md` when applicable.

## Command set

1. Type checks: `pnpm typecheck`
2. Lint: `pnpm lint`
3. Unit and integration: `pnpm test`
4. API-only tests: `pnpm test:api`
5. End-to-end tests: `pnpm test:e2e`
6. Build: `pnpm build`

## Risk-based escalation

1. If a targeted check fails in a shared boundary, escalate one verification level.
2. If one fix causes second-order failures, escalate to Level C.
3. If behavior is user-visible and data-integrity sensitive, include focused end-to-end checks even when unit tests pass.

## Pull request verification snippet

1. Change surface
   - list touched boundaries
2. Verification level
   - A, B, or C
3. Checks run
   - exact commands
4. Deferred checks
   - what is intentionally postponed and why
5. Residual risk
   - explicit statement
