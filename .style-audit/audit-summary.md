# Style Audit — ChillDesignStudio

Generated: 2026-05-18

---

## 1. Shared primitives that control the most UI

| Primitive / Component                               | Scope       | Notes                                                                   |
| --------------------------------------------------- | ----------- | ----------------------------------------------------------------------- |
| `src/components/primitives/Button.tsx`              | Global      | CTA, secondary, danger variants                                         |
| `src/components/primitives/Modal.tsx`               | Global      | All confirmation dialogs                                                |
| `src/components/primitives/Drawer.tsx`              | Global      | AddItemDrawer, side panels                                              |
| `src/components/primitives/InlineTextEdit.tsx`      | Global      | Every editable cell in FfeTable, CatalogView                            |
| `src/components/primitives/InlineNumberEdit.tsx`    | Global      | Price / quantity cells                                                  |
| `src/components/primitives/StatusBadge.tsx`         | Global      | Item status across all table views                                      |
| `src/components/shared/table/TableViewWrappers.tsx` | Table views | TableViewStack, TableViewCard, TableField, TableStickyTotal, ViewToggle |
| `src/components/shared/BulkActionBar.tsx`           | Table views | Selection toolbar                                                       |
| `src/components/shared/TotalsBar.tsx`               | Table views | Grand-total footer bar                                                  |
| `src/components/shared/ColumnVisibilityPopover.tsx` | Table views | Column toggle control                                                   |

---

## 2. Pages with the most one-off styling

| File                                            | One-off patterns                                                                                          |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `src/pages/PlanCanvasPage.tsx`                  | `bg-[#efede6]`, `bg-[#fbfaf6]/95`, `bg-[#f3f1ea]` — canvas background colors not in token system          |
| `src/components/plans/canvas/PlanViewport.tsx`  | SVG stroke colors `#c99723`, `#8b6f47`, `#c17a00`, `#059669` hardcoded                                    |
| `src/components/plans/canvas/PlanInspector.tsx` | `rounded-2xl` for inputs (vs `rounded-md` everywhere else), `bg-[#fbfaf6]/92`                             |
| `src/components/plans/canvas/PlanToolRail.tsx`  | `bg-[#fbfaf6]/80`                                                                                         |
| `src/components/shared/auth/AuthGate.tsx`       | Standalone auth card, sign-in form layout not using shared primitives                                     |
| `src/components/ffe/items/FfeTable.tsx`         | Largest file; 30+ `cn(...)` callsites; inline `menuItemClassName` and `iconButton` patterns repeated 4–6× |

---

## 3. CSS selectors that appear unused or duplicated

### gray-_ vs neutral-_ split (HIGH PRIORITY)

The codebase uses **both** Tailwind's default `gray-*` palette and the custom `neutral-*` CSS-variable tokens:

- `gray-950 / gray-900` → primary text in most FF&E, materials, modals, App.tsx
- `neutral-900 / neutral-950` → BulkActionBar, FfeTable header, TotalsBar

These are **semantically the same scale** but routed through different Tailwind tokens. There is no `gray-*` token in `index.css`. All grays should be `neutral-*`.

Hotspots:

- `src/components/materials/MaterialsView.tsx` — all gray
- `src/components/materials/MaterialLibraryModal.tsx` — all gray
- `src/components/ffe/items/FfeTable.tsx` — mixed gray + neutral
- `src/components/ffe/summary/SummaryView.tsx` — all gray
- `src/components/proposal/ChangeConfirmModal.tsx` — all gray
- `src/components/shared/auth/AuthGate.tsx` — all gray

### Duplicated inline class strings

The following long class strings appear **verbatim** 4–8 times and should be extracted:

**Input field base** (8+ occurrences across MaterialsView, MaterialLibraryModal, EditProjectModal, NewProjectModal, AddItemDrawer, CatalogView):

```
rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-normal text-gray-950 focus:border-brand-500 focus:outline-none
```

**Menu popup panel** (5+ occurrences in FfeTable):

```
z-[100] min-w-48 rounded-md border border-gray-200 bg-white p-1 shadow-md
```

**Icon button** (4+ occurrences in FfeTable):

```
inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-white hover:text-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500
```

**Table header label** (duplicated in FfeTable, fullscreen variant):

```
h-10 border-y border-neutral-200 px-3 text-[10px] font-medium uppercase tracking-[0.08em] text-neutral-500 bg-surface
```

---

## 4. Styles that should become design tokens

| Value                                                                                       | Used for                                | Proposed token                               |
| ------------------------------------------------------------------------------------------- | --------------------------------------- | -------------------------------------------- |
| `#efede6`                                                                                   | Plan canvas page background             | `--color-canvas-bg`                          |
| `#fbfaf6`                                                                                   | Plan chrome header/rail/inspector       | `--color-canvas-chrome`                      |
| `#f3f1ea`                                                                                   | Plan canvas outer shell                 | `--color-canvas-shell`                       |
| `#c99723`, `#8b6f47`                                                                        | SVG line/annotation inactive colours    | `--color-plan-line`                          |
| `#c17a00`                                                                                   | SVG measurement annotation              | `--color-plan-measure`                       |
| `#059669`                                                                                   | SVG active measurement / snap indicator | `--color-plan-active`                        |
| Focus ring: `focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500` | Buttons, inline edits                   | `.focus-ring` utility or `@layer components` |
| Input field base (see above)                                                                | 8+ form inputs                          | `.input-base` CSS component class            |

---

## 5. Inconsistent styling patterns across pages

| Pattern                     | Inconsistency                                                                                                                                                                                                          |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Focus rings**             | 3 styles coexist: `focus-visible:outline outline-2 outline-brand-500` (buttons/edits), `focus:border-brand-500 focus:outline-none` (inputs), `focus:ring-2 focus:ring-brand-400` (ChangeConfirmModal, PlanUploadPanel) |
| **Surface backgrounds**     | `bg-white`, `bg-surface`, `bg-surface-muted`, `bg-gray-50`, `bg-gray-100` used for subtly-off-white areas with no clear semantic rule                                                                                  |
| **Gray palette**            | `gray-*` (default Tailwind) vs `neutral-*` (project token) mixed throughout — no gray tokens defined in `index.css`                                                                                                    |
| **Border radius on inputs** | `rounded-md` (most of app) vs `rounded-lg` (PlanUploadPanel) vs `rounded-2xl` (PlanInspector)                                                                                                                          |
| **Shadow naming**           | Custom shadow tokens defined in `index.css` and `tailwind.config.ts`, but `shadow-2xl` (default Tailwind) used in FfeTable fullscreen modal and FfeItemDetailPanel                                                     |

---

## 6. Dynamic className hotspots (manual review required)

| Location                              | Pattern                                                    | Risk                                    |
| ------------------------------------- | ---------------------------------------------------------- | --------------------------------------- |
| `FfeTable.tsx` (30+ callsites)        | `cn(...)` with conditional branches                        | Cannot statically determine all classes |
| `FfeTable.tsx` L530, CatalogView L286 | `menuItemClassName` const, composed with `cn()`            | Dynamic                                 |
| `DashboardPage.tsx` L110, L133, L265  | Array-based `className` prop (template literal equivalent) | Dynamic                                 |
| `MaterialsView.tsx` L278              | Template literal for grid column toggle                    | Dynamic                                 |
| `ColumnVisibilityPopover.tsx` L246    | `cn()` for toggle active state                             | Dynamic                                 |
| `BulkActionBar.tsx` L55, L67          | `cn()` for action variant                                  | Dynamic                                 |
| `ProjectHeader.tsx` L156, L167        | Array class strings for active tab                         | Dynamic                                 |

---

## 7. Which files should be changed first for maximum impact

1. **`src/index.css`** — add `.input-base`, `.focus-ring`, and `.icon-btn` to `@layer components`
2. **`src/components/materials/MaterialLibraryModal.tsx`** and **`MaterialsView.tsx`** — replace `gray-*` with `neutral-*`, apply `input-base`
3. **`src/components/ffe/items/FfeTable.tsx`** — replace `gray-*` with `neutral-*`; extract `menuItemClassName` to CSS component
4. **`src/components/shared/auth/AuthGate.tsx`** — replace `gray-*` with `neutral-*`
5. **`src/pages/PlanCanvasPage.tsx`** and plan canvas components — introduce canvas colour tokens

---

## 8. Which files should NOT be touched during this pass

- `src/lib/export/ffe/catalogPdf.ts` — PDF rendering, RGB values are intentional
- `src/data/sampleProject.ts` / `src/data/catalogFixture.ts` — hex values are material swatch data, not UI styling
- `api/**` — separate package, out of scope
- Any file in `src/test/` or `*.test.tsx` — test fixtures
