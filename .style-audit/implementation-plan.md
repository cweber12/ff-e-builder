# Implementation Plan — Style Pass

Generated from: `.style-audit/audit-summary.md`

---

## Global token changes

### 1. Add component-layer utilities to `src/index.css`

Extract the three most-duplicated class strings into `@layer components`:

```css
.input-base {
  @apply w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-normal text-neutral-950
         focus:border-brand-500 focus:outline-none;
}

.icon-btn {
  @apply inline-flex h-8 w-8 items-center justify-center rounded-md
         text-neutral-500 hover:bg-white hover:text-brand-700
         focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500;
}

.focus-ring {
  @apply focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500;
}
```

### 2. Add plan canvas tokens to `:root` in `src/index.css`

```css
--color-canvas-bg: 227 222 210; /* #e3ded2 — viewport background */
--color-canvas-shell: 243 241 234; /* #f3f1ea — outer grid bg */
--color-canvas-chrome: 251 250 246; /* #fbfaf6 — header / rail / inspector */
--color-plan-line: 139 111 71; /* #8b6f47 — inactive SVG lines */
--color-plan-measure: 193 122 0; /* #c17a00 — measurement annotations */
--color-plan-active: 5 150 105; /* #059669 — active / snap indicator */
```

And register them in `tailwind.config.ts` (same pattern as existing tokens).

---

## Shared primitive changes

### 3. Unify `gray-*` → `neutral-*`

Files to update (all gray, safe to sweep):

- `src/components/materials/MaterialsView.tsx`
- `src/components/materials/MaterialLibraryModal.tsx`
- `src/components/ffe/summary/SummaryView.tsx`
- `src/components/proposal/ChangeConfirmModal.tsx`
- `src/components/shared/auth/AuthGate.tsx`
- `src/App.tsx`

Files with mixed gray/neutral (update gray usages only):

- `src/components/ffe/items/FfeTable.tsx`
- `src/components/shared/table/TableViewWrappers.tsx`

Mapping:
| gray class | neutral equivalent |
|---|---|
| `gray-50` | `neutral-50` |
| `gray-100` | `neutral-100` |
| `gray-200` | `neutral-200` |
| `gray-300` | `neutral-300` |
| `gray-400` | `neutral-400` |
| `gray-500` | `neutral-500` |
| `gray-600` | `neutral-600` |
| `gray-700` | `neutral-700` |
| `gray-800` | `neutral-800` |
| `gray-900` | `neutral-900` |
| `gray-950` | `neutral-950` |

**Exception:** `bg-gray-50` used as a distinct inset surface in `ChangeConfirmModal` — replace with `bg-surface-muted`.

### 4. Apply `.input-base` to all form inputs

Replace the repeated 8+ inline input class strings with `input-base` in:

- `src/components/materials/MaterialsView.tsx`
- `src/components/materials/MaterialLibraryModal.tsx`
- `src/components/ffe/items/AddItemDrawer.tsx`
- `src/components/project/modals/EditProjectModal.tsx`
- `src/components/project/modals/NewProjectModal.tsx`
- `src/components/ffe/catalog/CatalogView.tsx`
- `src/components/shared/auth/AuthGate.tsx`

### 5. Standardise focus ring on `ChangeConfirmModal` textarea

Change:

```
focus:outline-none focus:ring-2 focus:ring-brand-400
```

To:

```
focus:outline-none focus:border-brand-500
```

(matches every other input in the app)

---

## Page-specific polish changes

### 6. Replace plan canvas hardcoded hex with token classes

In `src/pages/PlanCanvasPage.tsx`:

- `bg-[#efede6]` → `bg-[rgb(var(--color-canvas-bg))]` (or new Tailwind alias)
- `bg-[#fbfaf6]/95` → `bg-canvas-chrome/95`
- `bg-[#f3f1ea]` → `bg-canvas-shell`

In `src/components/plans/canvas/PlanViewport.tsx`:

- `stroke-[#8b6f47]` / `fill-[#8b6f47]` → `stroke-plan-line` / `fill-plan-line`
- `stroke-[#c17a00]` / `fill-[#c17a00]` → `stroke-plan-measure` / `fill-plan-measure`
- Hard-coded `stroke="#059669"` → CSS variable
- Hard-coded `stroke="#c99723"` (in `PlanOverlays.tsx`, `PlanCanvasPage.tsx` canvas context) → keep as constant in one place

In `src/components/plans/canvas/PlanInspector.tsx` and `PlanToolRail.tsx`:

- `bg-[#fbfaf6]/92` / `bg-[#fbfaf6]/80` → `bg-canvas-chrome/92` etc.

### 7. Standardise `PlanInspector` input border radius

Change `rounded-2xl` → `rounded-lg` on all `<input>` / `<select>` elements in `PlanInspector.tsx` to match `PlanUploadPanel.tsx` and the rest of the plan canvas chrome.

---

## Risks / dynamic styling areas

| Risk                                                         | Files                                         | Mitigation                                                                |
| ------------------------------------------------------------ | --------------------------------------------- | ------------------------------------------------------------------------- |
| `cn(...)` callsites with conditional gray/neutral branches   | `FfeTable.tsx`, `ColumnVisibilityPopover.tsx` | Manually verify each cn() call after token replacement                    |
| `menuItemClassName` const in FfeTable composed with cn()     | `FfeTable.tsx` L530                           | Update const definition, all cn compositions pick up change automatically |
| Array-form `className` in DashboardPage                      | `DashboardPage.tsx`                           | Search for `className={[` specifically                                    |
| `shadow-2xl` (default Tailwind, not project token) in modals | `FfeTable.tsx`, `FfeItemDetailPanel.tsx`      | Leave as-is — the project custom shadows don't include a 2xl tier         |

---

## Verification commands to run after changes

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Visual spot-checks: Dashboard, FF&E table (desktop + mobile card view), Materials Finish Library, Add Item drawer, Plan canvas.
