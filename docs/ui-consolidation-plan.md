# UI Consolidation Plan — Visual Cohesion Across Pages

## CatalogView Editing Consolidation Audit and Plan

Date: 2026-05-26
Scope: Catalog editing flow in src/components/ffe/catalog/CatalogView.tsx and related CSS/export paths

### 1) Senior UX/UI review of current editing flow

#### What is working

- The toolbar already centralizes high-level actions (Edit, Print, Export, Layout).
- Page preview quality is strong and close to a production spec-sheet aesthetic.
- Inline text editing is fast and low-friction for expert users.

#### Primary usability issues

- Editing is split across too many interaction zones.
  - Top toolbar: Edit + Layout popover.
  - In-canvas controls: main-image alignment toggle.
  - Inline content areas: text edit triggers everywhere.
  - Page body action points: Add option slot and empty swatch slot behavior.
  - Result: users must scan multiple areas to complete one editing task.

- Edit mode is not truly enforcing editing boundaries.
  - Current InlineTextEdit fields remain clickable regardless of edit mode state.
  - The visual edit-mode outline communicates state, but behavior does not fully match it.
  - This weakens confidence and increases accidental edits.

- Browser typography and exported PDF typography can diverge.
  - Catalog browser typography inherits app fonts.
  - Catalog PDF uses SourceSans3 registration/fallback logic in src/lib/export/ffe/catalogFonts.ts and src/lib/export/ffe/catalogPdf.ts.
  - Without an explicit export-safe font selector and shared font mapping, users cannot trust WYSIWYG typography.

- Divider toggles are conceptually useful but visually inconsistent in alignment.
  - Vertical divider is applied only to the main section via border-right + padding-right + negative margin compensation.
  - Horizontal divider is applied to the bottom row with its own spacing offsets.
  - Because each divider is implemented in different structural contexts, lines can appear misaligned relative to the full page grid.

- Layout controls are not efficiently positioned for editing workflows.
  - Layout popover is in toolbar while related visual controls (image alignment) are in-page.
  - This forces repeated context switching and pointer travel.

#### User-centered assessment summary

- Current model is power-user capable but mentally expensive.
- The core issue is not missing controls alone, but control fragmentation.
- The product should move from distributed controls to one editor locus with clear state semantics.

### 2) Target model: one professional Editor window

Replace the current Layout concept with a unified Editor window that owns all page-editing capabilities.

#### Toolbar changes

- Rename Layout button to Editor.
- Keep Print and Export actions in toolbar.
- Keep page picker unchanged.
- Remove duplicated in-canvas layout controls (for example, image alignment mini-toggle).

#### Editing contract

- Text fields are editable only when Editor is open.
- When Editor is closed, catalog page behaves as a read-only preview surface.
- The only editable objects directly on the catalog page are text fields, and only in Editor-open state.
- All non-text editing actions are initiated from the Editor window.

#### Editor window information architecture

- Section A: Text and Content
  - Toggle editable mode for text fields (auto-enabled while window open).
  - Optional content visibility controls (approval, cost info, swatch labels).

- Section B: Media
  - Add option image controls moved here.
  - Add swatch control moved here as a single button: Open Finish Library.
  - Button opens existing MaterialsModal flow (MaterialLibraryModal) without requiring empty-slot interactions on the page.

- Section C: Typography and Color
  - Font family selector limited to export-safe fonts only.
  - Text color controls for key text zones (for example: headings, body copy, metadata).
  - Include Live Preview badge that indicates export-safe state.

- Section D: Layout
  - Main image alignment.
  - Plan image size.
  - Vertical and horizontal divider toggles with shared baseline alignment rules.

- Section E: Watermark
  - Preserve current watermark controls in this section.

### 3) Export-safe typography policy

To resolve browser-vs-PDF mismatch, use one typography registry consumed by both Catalog browser and PDF export.

#### Rules

- Only list fonts that are guaranteed in PDF export.
- Any font shown in Editor must be renderable in jsPDF export.
- If a font cannot be embedded or loaded, do not show it as selectable.

#### Practical first release

- Start with Source Sans 3 only (already registered for PDF export).
- Optionally add standard jsPDF built-ins later (Helvetica, Times, Courier) only if browser equivalents are intentionally mapped.
- Persist selected font as catalog editor preference and pass to PDF export options.

### 4) Divider alignment fix strategy

Normalize divider rendering to one shared page grid system.

#### Guidelines

- Vertical divider should anchor to consistent section top/bottom bounds.
- Horizontal divider should align to the same content width and rhythm tokens.
- Avoid negative margin compensation for structural separators when possible.
- Use a dedicated DividerLayer abstraction in CSS classes to keep geometry consistent.

### 5) Implementation plan (phased)

#### Phase 1: Editor shell and state model

- Rename CatalogLayoutPanelButton to CatalogEditorPanelButton.
- Replace Layout popover label/copy with Editor.
- Introduce editorOpen as the single gate for edit behavior.
- Add editable prop to InlineTextEdit and disable entry when editorOpen is false.

#### Phase 2: Move non-text actions into Editor

- Remove Add option upload entry points from in-page empty slot UI.
- Add Add option action controls inside Editor Media section.
- Remove empty swatch slot add interaction from page.
- Add Add swatch button in Editor that opens MaterialLibraryModal.

#### Phase 3: Typography and color controls

- Add CatalogTypographyConfig to shared catalog layout/editor state.
- Build export-safe font list from catalog font registry.
- Add text color controls with constrained, print-safe palette tokens.
- Apply typography config in both browser preview and catalogPdf export.

#### Phase 4: Divider and alignment cleanup

- Rebuild vertical/horizontal divider rendering around one shared geometry contract.
- Remove in-canvas image alignment micro-toggle and keep control in Editor only.
- Validate alignment in screen preview and exported PDF.

### 6) Definition of done for this consolidation

- All catalog editing capabilities are accessible in one Editor window.
- Layout button is fully replaced by Editor button.
- Add option image and Add swatch workflows are launched only from Editor.
- Text fields are editable only when Editor is open.
- Page surface outside text fields is non-editable on catalog page.
- Font picker contains only export-safe options.
- Divider toggles produce grid-aligned lines in both browser and PDF output.
- Editor window visual design is clean, organized, and professional.

### 7) UX quality notes for final visual design

- Keep Editor window width stable (avoid resizing jumps between sections).
- Use clear section labels with concise helper text; reduce microcopy noise.
- Prefer grouped controls with consistent left labels and right control alignment.
- Use one high-contrast primary action style and one neutral secondary style.
- Ensure keyboard accessibility: tab order by section, Esc to close, Enter applies text commits.

**Date:** 2026-05-26  
**Scope:** `src/components/` and `src/pages/`  
**Files audited:** 119 .tsx files (tests excluded)  
**Goal:** Eliminate the six independent sources of style drift so that a single class-string or component change propagates to every occurrence of a pattern.

---

## Why global style updates only apply to "some things"

Three root causes:

1. **Three parallel button systems.** `Button` primitive, `.btn-action` CSS utility class, and raw inline Tailwind live side-by-side. Editing one has no effect on the other two. `DashboardPage` does not use the primitive at all; `AppBarActions` uses only the CSS class.

2. **Six independent menu/dropdown implementations.** Each has its own state management, positioning logic, and hardcoded colour strings. There is no shared seam to update.

3. **CSS utilities exist but are bypassed.** `.eyebrow`, `.num`, `.menu-item`, `.menu-panel` are all defined in `index.css` but at least 60% of the places that express those patterns hardcode the classes inline instead — with slight variations in font size, tracking, and colour.

---

## Inventory of candidates

### A — High severity (all pages affected; each is a different drift source)

| #   | Pattern            | Files drifting                                      | Root cause                  |
| --- | ------------------ | --------------------------------------------------- | --------------------------- |
| A1  | Button/CTA styling | `DashboardPage`, `AppBarActions`, inline throughout | Three parallel systems      |
| A2  | Menu / dropdown    | 6 independent implementations                       | No shared Popover primitive |
| A3  | Eyebrow label      | ~60% of usages hardcoded                            | CSS utility bypassed        |

### B — Medium severity (section-level inconsistencies)

| #   | Pattern                    | Files drifting                                                 | Root cause                               |
| --- | -------------------------- | -------------------------------------------------------------- | ---------------------------------------- |
| B1  | Badge / pill chip          | 4+ separate inline implementations                             | `StatusBadge` too narrow for general use |
| B2  | Menu item hover state      | 4 variations across menus                                      | No shared menu-item style contract       |
| B3  | Segmented / toggle buttons | `DimensionEditorModal`, `PlanToolRail`, `ProposalStatusSelect` | No `SegmentedControl` primitive          |

### C — Low severity (typography clean-up)

| #   | Pattern                | Files drifting                                             | Root cause               |
| --- | ---------------------- | ---------------------------------------------------------- | ------------------------ |
| C1  | `.num` monospace class | `TotalsBar` and others use `font-mono tabular-nums` inline | Utility underused        |
| C2  | Heading text-case      | Mixed Title Case / Sentence Case for same heading level    | No convention documented |

---

## Slice plan

Work is ordered so that later slices depend on primitives introduced in earlier ones. Each slice is independently committable and leaves the app working.

---

### Slice 1 — Migrate `DashboardPage` buttons to `Button` primitive

**Problem.** `DashboardPage` contains two hardcoded button patterns that duplicate the `Button` primitive without using it:

- `"New Project"` CTA ([src/pages/DashboardPage.tsx](../src/pages/DashboardPage.tsx#L52)):

  ```
  inline-flex items-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold
  text-white shadow-sm transition hover:bg-brand-700 focus-visible:outline ...
  ```

  Replace with `<Button variant="primary" size="md">`.

- Company filter links ([src/pages/DashboardPage.tsx](../src/pages/DashboardPage.tsx#L70)):
  ```
  inline-flex items-center gap-2 border border-neutral-200 bg-canvas-chrome px-2.5 py-1
  text-sm text-neutral-800 transition hover:border-brand-500/40 hover:bg-brand-50 ...
  ```
  These are `<Link>` elements styled as secondary buttons. Use `<Button variant="secondary" size="sm" asChild>` or convert to `<ButtonLink>` (see note below).

**Files to change:**

- [`src/pages/DashboardPage.tsx`](../src/pages/DashboardPage.tsx)

**Note on `asChild` / link-buttons.** The `Button` primitive does not currently support `asChild`. Two options:

- (a) Add an `asChild` prop to `Button` that swaps `<button>` for a child `<a>` or `<Link>` (one-line change using `React.cloneElement` or slot pattern).
- (b) Add a `ButtonLink` export from `primitives/` that wraps `<Link>` with the same variant classes.

Option (a) is recommended; it keeps one interface and one set of classes. This also unblocks any other place where a styled anchor is needed.

---

### Slice 2 — Extend `Button` with `asChild` and sweep remaining inline button definitions

**Problem.** Several other files define `<button>` or `<a>` elements with full primary/secondary/ghost styling instead of using the primitive:

| File                                                                                                                      | Element                | Intended variant         |
| ------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ------------------------ |
| [`src/components/project/snapshot/BudgetSnapshotCard.tsx`](../src/components/project/snapshot/BudgetSnapshotCard.tsx#L21) | `<Link>` "View Budget" | `ghost`                  |
| [`src/components/shared/DeferredCostBanner.tsx`](../src/components/shared/DeferredCostBanner.tsx#L15)                     | `<button>` "Review"    | `ghost`                  |
| [`src/components/shared/SaveStatusIndicator.tsx`](../src/components/shared/SaveStatusIndicator.tsx#L20)                   | `<button>` "Retry"     | `ghost` size `sm`        |
| [`src/components/project/ProjectHeader.tsx`](../src/components/project/ProjectHeader.tsx#L105)                            | Tab nav links          | purpose-built (see note) |

**Files to change:**

- [`src/components/project/snapshot/BudgetSnapshotCard.tsx`](../src/components/project/snapshot/BudgetSnapshotCard.tsx)
- [`src/components/shared/DeferredCostBanner.tsx`](../src/components/shared/DeferredCostBanner.tsx)
- [`src/components/shared/SaveStatusIndicator.tsx`](../src/components/shared/SaveStatusIndicator.tsx)
- [`src/components/primitives/Button.tsx`](../src/components/primitives/Button.tsx) — add `asChild` support and export `ButtonLink`
- [`src/components/primitives/index.ts`](../src/components/primitives/index.ts) — re-export `ButtonLink`

**Note on `ProjectHeader` tab nav.** The tab links use a unique style (`h-11`, `text-[11px]`, `uppercase`, `tracking-[0.12em]`) that does not map cleanly to an existing `Button` variant. These should stay as-is for now and be addressed when a `TabNav` primitive is warranted (at least one other use case must exist first — one adapter = hypothetical seam).

---

### Slice 3 — Create a `MenuPanel` primitive and a `DropdownMenu` component

**Problem.** Six separate dropdown/menu implementations each own their own:

- open/close state
- portal positioning
- menu item hover style
- submenu logic (in two cases)

The `useActionsMenu` hook already centralizes state and positioning for four of the six. The remaining two (`ExportMenu` with manual `getBoundingClientRect` positioning, `ProjectOptionsMenu` with no portal) are outliers.

**Solution.** The interface surface to deepen is the menu item itself and the panel that wraps them.

**Step 3a.** Create `src/components/primitives/MenuPanel.tsx`:

```tsx
// Interface (callers only need to know this)
<MenuPanel>               // positions + animates the panel
  <MenuItem onSelect>     // styled row with icon slot; handles hover, focus, keyboard
  <MenuItem danger>       // red variant
  <MenuSeparator />       // visual divider
  <MenuSubTrigger>        // row that opens a submenu
  <MenuSub>               // nested panel
</MenuPanel>
```

This collapses the four different inline `optionBtn` class strings into a single `MenuItem` component. The `.menu-item` and `.menu-panel` CSS classes in `index.css` already define the correct styles — `MenuItem` should apply those, not re-specify them.

**Step 3b.** Create `src/components/primitives/DropdownMenu.tsx`:

```tsx
// Wraps useActionsMenu + MenuPanel + createPortal
<DropdownMenu trigger={<button>}>
  <MenuItem ...>
</DropdownMenu>
```

**Step 3c.** Migrate callers in priority order:

1. [`src/components/project/ProjectOptionsMenu.tsx`](../src/components/project/ProjectOptionsMenu.tsx) — simplest (no submenu, no portal today)
2. [`src/components/shared/ExportMenu.tsx`](../src/components/shared/ExportMenu.tsx) — manual portal; replace positioning logic
3. [`src/components/ffe/items/FfeTableView.tsx`](../src/components/ffe/items/FfeTableView.tsx) — two separate `useActionsMenu` instances
4. [`src/components/proposal/table/ProposalItemActionsMenu.tsx`](../src/components/proposal/table/ProposalItemActionsMenu.tsx) — submenu for "Move to…"
5. [`src/components/proposal/table/ProposalCategoryHeader.tsx`](../src/components/proposal/table/ProposalCategoryHeader.tsx) — submenu for category actions

**Files to create:**

- `src/components/primitives/MenuPanel.tsx`
- `src/components/primitives/DropdownMenu.tsx`

**Files to change:**

- [`src/components/project/ProjectOptionsMenu.tsx`](../src/components/project/ProjectOptionsMenu.tsx)
- [`src/components/shared/ExportMenu.tsx`](../src/components/shared/ExportMenu.tsx)
- [`src/components/ffe/items/FfeTableView.tsx`](../src/components/ffe/items/FfeTableView.tsx)
- [`src/components/proposal/table/ProposalItemActionsMenu.tsx`](../src/components/proposal/table/ProposalItemActionsMenu.tsx)
- [`src/components/proposal/table/ProposalCategoryHeader.tsx`](../src/components/proposal/table/ProposalCategoryHeader.tsx)
- [`src/components/primitives/index.ts`](../src/components/primitives/index.ts) — add exports

**Leverage.** After this slice: menu item hover colour, padding, font size, and focus ring all live in one place. Any future redesign of dropdown menus is a single-file change.

---

### Slice 4 — Add a `Badge` primitive; migrate inline pill/chip spans

**Problem.** `StatusBadge` is domain-specific (hardwired to `ItemStatus`). Four other badge patterns exist inline:

| File                                                                                                                              | Variant             | Classes                                                                                                        |
| --------------------------------------------------------------------------------------------------------------------------------- | ------------------- | -------------------------------------------------------------------------------------------------------------- |
| [`src/components/project/snapshot/BudgetSnapshotCard.tsx`](../src/components/project/snapshot/BudgetSnapshotCard.tsx#L35)         | danger alert        | `rounded-full bg-danger-500/10 px-2.5 py-1 text-xs font-semibold text-danger-600`                              |
| [`src/components/proposal/table/ProposalCategoryHeader.tsx`](../src/components/proposal/table/ProposalCategoryHeader.tsx#L84)     | neutral count       | `rounded-pill bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600 ring-1 ring-inset ring-black/10` |
| [`src/components/proposal/table/ProposalCategoryHeader.tsx`](../src/components/proposal/table/ProposalCategoryHeader.tsx#L88)     | brand revision flag | `bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700 ring-1 ring-inset ring-brand-200/50`               |
| [`src/components/proposal/table/ProposalItemDetailPanel.tsx`](../src/components/proposal/table/ProposalItemDetailPanel.tsx#L534)  | brand revision flag | `rounded-pill bg-brand-500/15 px-2 py-0.5 text-[11px] font-medium text-brand-700`                              |
| [`src/components/proposal/table/ProposalCategorySection.tsx`](../src/components/proposal/table/ProposalCategorySection.tsx#L1050) | warning audit       | `rounded-pill bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800`     |

**Solution.** Create `src/components/primitives/Badge.tsx`:

```tsx
type BadgeVariant = 'neutral' | 'brand' | 'danger' | 'warning' | 'success';
type BadgeSize = 'sm' | 'md';

<Badge variant="neutral" size="sm">4 items</Badge>
<Badge variant="danger">Over budget</Badge>
<Badge variant="warning" uppercase>Needs review</Badge>
```

Migrate all inline pill spans to `<Badge>`.

**Files to create:**

- `src/components/primitives/Badge.tsx`

**Files to change:**

- [`src/components/project/snapshot/BudgetSnapshotCard.tsx`](../src/components/project/snapshot/BudgetSnapshotCard.tsx)
- [`src/components/proposal/table/ProposalCategoryHeader.tsx`](../src/components/proposal/table/ProposalCategoryHeader.tsx)
- [`src/components/proposal/table/ProposalItemDetailPanel.tsx`](../src/components/proposal/table/ProposalItemDetailPanel.tsx)
- [`src/components/proposal/table/ProposalCategorySection.tsx`](../src/components/proposal/table/ProposalCategorySection.tsx)
- [`src/components/primitives/index.ts`](../src/components/primitives/index.ts) — add export

---

### Slice 5 — Create `SegmentedControl` primitive; replace inline toggles

**Problem.** Three components implement mode/option toggles with inline conditional classes:

| File                                                                                                                                                | Context                  | Pattern                                                                                                            |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| [`src/components/shared/modals/DimensionEditorModal.tsx`](../src/components/shared/modals/DimensionEditorModal.tsx#L113)                            | Imperial / metric toggle | `` `rounded px-3 py-2 text-sm font-medium ${active ? 'bg-white text-brand-700 shadow-sm' : 'text-neutral-600'}` `` |
| [`src/components/plans/canvas/PlanToolRail.tsx`](../src/components/plans/canvas/PlanToolRail.tsx#L42)                                               | Tool selection           | Array.join with active border/bg variants                                                                          |
| [`src/components/shared/ProposalStatusSelect/ProposalStatusSelect.tsx`](../src/components/shared/ProposalStatusSelect/ProposalStatusSelect.tsx#L60) | Stage selection          | Custom `StageButton` with inline ternary                                                                           |

`index.css` already defines `.segmented` and `.toolbar-segmented` — the CSS exists but nothing uses it.

**Solution.** Create `src/components/primitives/SegmentedControl.tsx`:

```tsx
<SegmentedControl value={mode} onChange={setMode} size="sm">
  <SegmentedControl.Option value="imperial">Imperial</SegmentedControl.Option>
  <SegmentedControl.Option value="metric">Metric</SegmentedControl.Option>
</SegmentedControl>
```

Wire it to the `.segmented` and `.toolbar-segmented` CSS classes already defined.

**Files to create:**

- `src/components/primitives/SegmentedControl.tsx`

**Files to change:**

- [`src/components/shared/modals/DimensionEditorModal.tsx`](../src/components/shared/modals/DimensionEditorModal.tsx)
- [`src/components/plans/canvas/PlanToolRail.tsx`](../src/components/plans/canvas/PlanToolRail.tsx)
- [`src/components/shared/ProposalStatusSelect/ProposalStatusSelect.tsx`](../src/components/shared/ProposalStatusSelect/ProposalStatusSelect.tsx)
- [`src/components/primitives/index.ts`](../src/components/primitives/index.ts) — add export

---

### Slice 6 — Typography clean-up: enforce `.eyebrow` and `.num` utilities

**Problem.** Both utilities exist and are correctly defined in `index.css` but ~60% of usages are hardcoded with slight variations that cause visual drift.

#### 6a — `.eyebrow` audit

The CSS definition:

```css
.eyebrow {
  @apply text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-600;
}
```

Files bypassing it (hardcoded alternatives):

| File                                                                                                                      | Hardcoded classes                                                        | Drift                                     |
| ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------- |
| [`src/pages/ProjectOverviewPage.tsx`](../src/pages/ProjectOverviewPage.tsx#L48)                                           | `text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500` | tracking 0.16em (not 0.12em), neutral-500 |
| [`src/pages/DashboardPage.tsx`](../src/pages/DashboardPage.tsx#L44)                                                       | `text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-600`   | 11px, tracking 0.18em, brand color        |
| [`src/components/project/snapshot/BudgetSnapshotCard.tsx`](../src/components/project/snapshot/BudgetSnapshotCard.tsx#L29) | `text-xs font-semibold uppercase tracking-widest text-neutral-400`       | 12px, tracking-widest                     |
| [`src/pages/DemoPage.tsx`](../src/pages/DemoPage.tsx#L175)                                                                | `text-xs font-semibold uppercase tracking-widest text-brand-500`         | 12px, tracking-widest, brand color        |

Replace all with `className="eyebrow"` (or `eyebrow text-brand-600` / `eyebrow text-danger-600` for coloured variants — colour overrides are acceptable; size/tracking variations are not).

#### 6b — `.num` audit

The CSS definition:

```css
.num {
  font-family: 'JetBrains Mono Variable', ui-monospace, monospace;
  font-variant-numeric: tabular-nums;
}
```

Files bypassing it:

| File                                                                                            | Hardcoded classes                                                                                                               |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| [`src/components/shared/table/TotalsBar.tsx`](../src/components/shared/table/TotalsBar.tsx#L20) | `font-mono text-base font-semibold tabular-nums text-neutral-950` — replace with `num text-base font-semibold text-neutral-950` |

**Files to change:**

- [`src/pages/ProjectOverviewPage.tsx`](../src/pages/ProjectOverviewPage.tsx)
- [`src/pages/DashboardPage.tsx`](../src/pages/DashboardPage.tsx)
- [`src/components/project/snapshot/BudgetSnapshotCard.tsx`](../src/components/project/snapshot/BudgetSnapshotCard.tsx)
- [`src/pages/DemoPage.tsx`](../src/pages/DemoPage.tsx)
- [`src/components/shared/table/TotalsBar.tsx`](../src/components/shared/table/TotalsBar.tsx)

---

### Slice 7 — Retire `.btn-action` CSS class; migrate callers to `Button` primitive

**Problem.** `.btn-action` and `.btn-action--primary` (defined in `index.css`) duplicate the `Button` `toolbar` and `toolbarPrimary` variants. Both exist and are nearly identical:

`Button` primitive `toolbar` variant:

```
border border-neutral-200 bg-canvas-chrome text-neutral-700 text-[11px] font-semibold
uppercase tracking-[0.10em] hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700
```

`.btn-action` CSS:

```css
display: inline-flex;
align-items: center;
gap: 6px;
height: 32px;
padding: 0 12px;
border: 1px solid neutral-200;
background: canvas-chrome;
color: neutral-700;
font-size: 11px;
font-weight: 600;
text-transform: uppercase;
```

The visual difference is negligible; the maintenance cost of two systems is high.

**Step 7a.** Audit all `.btn-action` usages and map to `Button variant="toolbar"` or `variant="toolbarPrimary"`.  
**Step 7b.** Once all callers are migrated, delete `.btn-action*` from `index.css`.

**Files to change:**

- [`src/components/project/AppBarActions.tsx`](../src/components/project/AppBarActions.tsx)
- [`src/components/shared/ExportMenu.tsx`](../src/components/shared/ExportMenu.tsx) (if not already migrated in Slice 3)
- Any other callers found by: `grep -r "btn-action" src/`
- [`src/index.css`](../src/index.css) — delete `.btn-action` block after migration

---

## File-level change summary

| File                                                                                                                                            | Slices     | Nature of change                              |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------- |
| [`src/pages/DashboardPage.tsx`](../src/pages/DashboardPage.tsx)                                                                                 | 1, 6       | Replace inline button + eyebrow               |
| [`src/components/primitives/Button.tsx`](../src/components/primitives/Button.tsx)                                                               | 2          | Add `asChild`; add `ButtonLink`               |
| [`src/components/primitives/index.ts`](../src/components/primitives/index.ts)                                                                   | 2, 3, 4, 5 | Re-export new primitives                      |
| `src/components/primitives/MenuPanel.tsx`                                                                                                       | 3          | **New file**                                  |
| `src/components/primitives/DropdownMenu.tsx`                                                                                                    | 3          | **New file**                                  |
| `src/components/primitives/Badge.tsx`                                                                                                           | 4          | **New file**                                  |
| `src/components/primitives/SegmentedControl.tsx`                                                                                                | 5          | **New file**                                  |
| [`src/components/project/ProjectOptionsMenu.tsx`](../src/components/project/ProjectOptionsMenu.tsx)                                             | 3, 7       | Migrate to DropdownMenu + Button              |
| [`src/components/shared/ExportMenu.tsx`](../src/components/shared/ExportMenu.tsx)                                                               | 3, 7       | Migrate to DropdownMenu; retire manual portal |
| [`src/components/ffe/items/FfeTableView.tsx`](../src/components/ffe/items/FfeTableView.tsx)                                                     | 3          | Replace useActionsMenu inline usage           |
| [`src/components/proposal/table/ProposalItemActionsMenu.tsx`](../src/components/proposal/table/ProposalItemActionsMenu.tsx)                     | 3          | Migrate to DropdownMenu                       |
| [`src/components/proposal/table/ProposalCategoryHeader.tsx`](../src/components/proposal/table/ProposalCategoryHeader.tsx)                       | 3, 4       | Migrate menu + Badge                          |
| [`src/components/proposal/table/ProposalItemDetailPanel.tsx`](../src/components/proposal/table/ProposalItemDetailPanel.tsx)                     | 4          | Badge                                         |
| [`src/components/proposal/table/ProposalCategorySection.tsx`](../src/components/proposal/table/ProposalCategorySection.tsx)                     | 4          | Badge                                         |
| [`src/components/project/snapshot/BudgetSnapshotCard.tsx`](../src/components/project/snapshot/BudgetSnapshotCard.tsx)                           | 2, 4, 6    | ButtonLink + Badge + eyebrow                  |
| [`src/components/shared/DeferredCostBanner.tsx`](../src/components/shared/DeferredCostBanner.tsx)                                               | 2          | Ghost button                                  |
| [`src/components/shared/SaveStatusIndicator.tsx`](../src/components/shared/SaveStatusIndicator.tsx)                                             | 2          | Ghost button                                  |
| [`src/components/shared/table/TotalsBar.tsx`](../src/components/shared/table/TotalsBar.tsx)                                                     | 6          | `.num` utility                                |
| [`src/components/shared/modals/DimensionEditorModal.tsx`](../src/components/shared/modals/DimensionEditorModal.tsx)                             | 5          | SegmentedControl                              |
| [`src/components/plans/canvas/PlanToolRail.tsx`](../src/components/plans/canvas/PlanToolRail.tsx)                                               | 5          | SegmentedControl                              |
| [`src/components/shared/ProposalStatusSelect/ProposalStatusSelect.tsx`](../src/components/shared/ProposalStatusSelect/ProposalStatusSelect.tsx) | 5          | SegmentedControl                              |
| [`src/pages/ProjectOverviewPage.tsx`](../src/pages/ProjectOverviewPage.tsx)                                                                     | 6          | `.eyebrow` utility                            |
| [`src/pages/DemoPage.tsx`](../src/pages/DemoPage.tsx)                                                                                           | 6          | `.eyebrow` utility                            |
| [`src/components/project/AppBarActions.tsx`](../src/components/project/AppBarActions.tsx)                                                       | 7          | `.btn-action` → Button                        |
| [`src/index.css`](../src/index.css)                                                                                                             | 7          | Delete `.btn-action` block                    |

---

## What this does NOT cover (intentional scope limit)

- **`ProjectHeader` tab nav.** Unique pattern with no second use case yet. One adapter = hypothetical seam. Revisit when a second tabbed context appears.
- **`ColumnVisibilityPopover` / `ColumnsPanel`.** This component combines a popover with drag-and-drop reordering — it is not a pure "menu" and should not be forced into the same `DropdownMenu` primitive. Revisit separately if a drag-sortable panel appears elsewhere.
- **shadcn/ui adoption.** The codebase deliberately chose custom primitives (well-documented by existing ADRs). This plan works within that choice and does not propose adopting Radix-based components. Any reconsidering of that decision warrants a new ADR.
- **Heading text-case normalisation.** Mixed Title Case / Sentence Case is a copywriting decision, not a component one. Flagged for a content style guide but out of scope here.

---

## Definition of done (per slice)

- [ ] All callers of the replaced pattern use the new primitive
- [ ] No file in the slice's scope retains the old inline class string
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` exits 0
- [ ] `pnpm test` green (snapshot tests may need updating for migrated components)
- [ ] `pnpm build` succeeds
