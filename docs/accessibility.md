# Accessibility

FF&E Builder treats accessibility as a release gate. Playwright runs axe-core
against the primary routes and fails on violations above `minor`.

## Automated audit

Run:

```bash
pnpm exec playwright test tests/e2e/accessibility.spec.ts
```

Routes covered:

- `/signin`
- `/projects`
- `/projects/demo-project/table`
- `/projects/demo-project/catalog`
- `/projects/demo-project/summary`

## Manual checks

- Keyboard focus moves through project tabs, table controls, drawer controls, and modal controls in visual order.
- Drawer and modal Esc keys close the overlay and return focus to the trigger.
- Every button has an accessible name.
- Every form input is associated with a visible label.
- Status badges expose text via `role="status"` and `aria-label`, not color alone.
- Brand green `#1A6B4A` on white passes WCAG AA for normal text.

## Known notes

The catalog print view hides navigation and renders all catalog pages in a
print-only stack so browser PDF output matches item count.
