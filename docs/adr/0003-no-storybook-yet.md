# ADR 0003 — No Storybook in v1

**Date:** 2026-04-30  
**Status:** Accepted

---

## Context

Phase 4 introduces a set of UI primitives (`Button`, `InlineTextEdit`, `InlineNumberEdit`, `Drawer`, `Modal`, `StatusBadge`, `Toast`) and the first real UI surface (`ProjectHeader`). Storybook was considered as a way to document and visually test these components in isolation.

## Decision

We are **not adding Storybook in v1**. Instead:

- Each primitive has its own `*.test.tsx` covering keyboard interactions, ARIA attributes, and edge cases via Vitest + Testing Library.
- `/docs/design-system.md` is the written source of truth for visual rules, token values, and interaction patterns.
- Components are small and focused enough that visual review during development in the Vite dev server is sufficient.

## Rationale

1. **Tooling overhead** — Storybook requires a separate Webpack/Vite pipeline, its own config, and frequent version-compatibility work that doesn't add value when the component surface is still small.
2. **Team size** — At this stage there is no dedicated design handoff workflow that would benefit from a Storybook deploy.
3. **Test coverage is the real gate** — Keyboard accessibility and ARIA correctness are verified by unit tests, not visual regression. We would need Chromatic or similar for visual regression anyway, which is additional cost.

## Future

When the project reaches ~20+ primitive components or onboards a dedicated designer, we should revisit Storybook (or Histoire as a lighter Vite-native alternative). At that point a CI-deployed Storybook to GitHub Pages would be valuable.

A follow-up ADR should document that decision when it is made.
