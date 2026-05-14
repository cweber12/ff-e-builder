# Table UI Redesign — Implementation Spec

## Overview

The FF&E and Proposal table views become a purpose-built professional tool, not a generic SaaS data grid. Visual reference: dense editorial publications (Programma, Linear, Arc) — hairline rules, tracked uppercase labels, restrained chrome, full-width data surface, brand color used as accent rather than band.

Design language pillars:

- **Neutral chrome, brand as accent.** Steel-blue (`brand-500`) appears only on active tab underlines, primary CTAs, focus rings, and selection highlights. Everything else is `neutral-*` and `surface-*`.
- **Editorial typography.** `font-display` (Lora) is used sparingly — only the project name in the app bar and empty-state headlines. `font-sans` (DM Sans) for chrome, body, headers. `font-mono` (JetBrains Mono) for keyboard hints and the saved-timestamp indicator. `tabular-nums` on numeric cells (cost, quantity, totals).
- **Hairline rules, not borders.** Row separators at `border-neutral-200` (or `/60` for further softness). No vertical column dividers. No zebra fill.
- **Restraint is the point.** When in doubt, remove the fill, drop the icon, soften the rule.

---

## Open prerequisites

These items affect scope or schema and should be resolved before or alongside the visual work:

1. **`CONTEXT.md` reconciliation for FF&E item status.** [CONTEXT.md:264](../../CONTEXT.md#L264) currently states "Per-item status is intentionally absent. Neither FF&E Items nor Proposal Items carry a `status` field." The schema and this redesign retain `status` on FF&E Items (values `pending | ordered | approved | received`). **Action:** update `CONTEXT.md` to reflect that FF&E Items carry per-item status; Proposal Items do not.
2. **New tabs `Materials` and `Budget` need routes.** Today only Snapshot / FF&E / Proposal / Plans are wired in [ProjectHeader.tsx:91–97](../../src/components/project/ProjectHeader.tsx#L91). The redesign drops Snapshot and adds Materials + Budget. Routes and page shells for those must exist before the chrome can link to them. If routing work is not in this pass, render Materials and Budget tabs as disabled with a tooltip "Coming soon."
3. **Row selection + bulk actions require a row-selection state hook.** New `useRowSelection(tableId)` hook is in scope for this pass — see §9.

---

## Design tokens (use these — do not invent new utilities)

From [tailwind.config.ts](../../tailwind.config.ts):

| Purpose                                   | Token                                                           |
| ----------------------------------------- | --------------------------------------------------------------- |
| Page background                           | `bg-neutral-50`                                                 |
| Surface (cards, table cells, chrome)      | `bg-surface` (resolves to white)                                |
| Surface (subtle fill, e.g. group headers) | `bg-neutral-50` or `bg-surface-muted`                           |
| Hairline                                  | `border-neutral-200`                                            |
| Soft hairline                             | `border-neutral-200/60`                                         |
| Body text                                 | `text-neutral-900`                                              |
| Secondary text                            | `text-neutral-600`                                              |
| Muted / metadata text                     | `text-neutral-500`                                              |
| Disabled / placeholder                    | `text-neutral-400`                                              |
| Brand accent                              | `bg-brand-500`, `text-brand-600`, `border-brand-500`            |
| Brand hover / active                      | `brand-600`, `brand-700`                                        |
| Success (terminal Approved state)         | `bg-success-500`, `text-success-500`                            |
| Warning (deferred cost)                   | `bg-warning-500/8`, `border-warning-500/30`, `text-warning-500` |
| Danger (destructive actions)              | `bg-danger-500`, `text-danger-600`                              |

Fonts:

- `font-sans` — DM Sans Variable (default body, chrome)
- `font-display` — Lora Variable (project name in app bar, empty-state headlines)
- `font-mono` — JetBrains Mono Variable (keyboard hints, saved indicator)

Use `tabular-nums` on all numeric cells (cost, quantity, totals).

---

## 1. Page geometry

The page has **zero horizontal padding** on the outer wrapper. The table edge sits flush against the viewport sides. Chrome (app bar) and content (table + bottom totals) form a single vertical stack:

```
┌─────────────────────────────────────────────────────────────┐
│ App bar — Row 1 (identity)                          40px    │
├─────────────────────────────────────────────────────────────┤
│ App bar — Row 2 (working bar)                       48px    │
├─────────────────────────────────────────────────────────────┤
│ Deferred-cost banner (proposal only, when present)  28px    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ Table (sticky header, sticky left col, sticky right col)    │  flex-1
│                                                              │
├─────────────────────────────────────────────────────────────┤
│ Sticky bottom totals bar OR bulk action bar         40px    │
└─────────────────────────────────────────────────────────────┘
```

Page wrapper:

```tsx
<div className="flex h-screen flex-col bg-neutral-50">
  <AppBar ... />
  <div className="flex flex-1 flex-col overflow-hidden bg-surface">
    {hasDeferredCost && <DeferredCostBanner ... />}
    <div className="relative flex-1 overflow-auto">
      <FfeTable ... />  {/* or ProposalTable */}
    </div>
    {selectedIds.length > 0 ? <BulkActionBar ... /> : <TotalsBar ... />}
  </div>
</div>
```

**No `mx-auto max-w-*` wrappers around the table.** Table is `w-full`, horizontal scroll lives inside the table region.

---

## 2. App bar — Row 1 (identity)

**Height:** 40px. **Background:** `bg-surface`. **Bottom rule:** `border-b border-neutral-200`.

Contents, left to right:

1. **Breadcrumb** — `Projects` link in `text-xs text-neutral-500 hover:text-neutral-900`, followed by a `/` separator in `text-neutral-300`.
2. **Project name** — `font-display` (Lora) at `text-[22px] leading-none font-normal text-neutral-900`. Links to the project root. Truncates with ellipsis at narrow widths.
3. **Spacer** (`ml-auto`).
4. **Project Options menu** (`⋯`) — 28×28 icon button at far right, `text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-md`. Opens the existing `ProjectOptionsMenu`.

```tsx
<div className="flex h-10 items-center gap-3 border-b border-neutral-200 bg-surface px-4">
  <Link to="/projects" className="text-xs text-neutral-500 hover:text-neutral-900">
    Projects
  </Link>
  <span className="text-xs text-neutral-300">/</span>
  <Link
    to={`/projects/${project.id}`}
    className="truncate font-display text-[22px] font-normal leading-none text-neutral-900 hover:text-brand-600"
  >
    {project.name}
  </Link>
  <div className="ml-auto" />
  <ProjectOptionsMenu ... />
</div>
```

No icons, no logo, no avatar in row 1. Identity should feel quiet — almost invisible.

---

## 3. App bar — Row 2 (working bar)

**Height:** 48px. **Background:** `bg-surface`. **Bottom rule:** `border-b border-neutral-200`.

Three regions, left → right:

| Region          | Contents                                                | Alignment                           |
| --------------- | ------------------------------------------------------- | ----------------------------------- |
| **Tabs**        | 5 tool tabs                                             | Left                                |
| **View toggle** | Table / Catalog (FF&E only)                             | Center-left, after tabs with `ml-6` |
| **Actions**     | Saved indicator → tool-specific actions → keyboard hint | Right (`ml-auto`)                   |

### 3.1 Tab navigation

**5 tabs** in this order:

1. FF&E → `/projects/:id/ffe/table`
2. Proposal → `/projects/:id/proposal/table`
3. Plans → `/projects/:id/plans`
4. Materials → `/projects/:id/materials` _(route may not exist; render disabled with tooltip if not)_
5. Budget → `/projects/:id/budget` _(route may not exist; render disabled with tooltip if not)_

Note: the existing **Snapshot** tab is removed from this navigation.

**Visual treatment** — underline-style, no pill:

```tsx
<NavLink
  to={to}
  className={({ isActive }) =>
    [
      'relative inline-flex h-12 items-center px-3 text-sm font-medium transition-colors',
      isActive ? 'text-neutral-900' : 'text-neutral-500 hover:text-neutral-900',
    ].join(' ')
  }
>
  {({ isActive }) => (
    <>
      {label}
      {isActive && <span className="absolute inset-x-3 -bottom-px h-0.5 bg-brand-500" />}
    </>
  )}
</NavLink>
```

The 2px active underline sits exactly over the row's bottom border, replacing it for that tab's width.

### 3.2 Table / Catalog view toggle (FF&E only)

Segmented control. Use a different visual register than tabs — filled pill background, not underline — so the hierarchy is unambiguous.

```tsx
<div className="ml-6 inline-flex rounded-md bg-neutral-100 p-0.5">
  <button
    className={cn(
      'inline-flex h-8 items-center px-3 text-xs font-medium rounded-[5px] transition',
      view === 'table'
        ? 'bg-surface text-neutral-900 shadow-sm'
        : 'text-neutral-500 hover:text-neutral-900',
    )}
  >
    Table
  </button>
  <button
    className={cn(
      'inline-flex h-8 items-center px-3 text-xs font-medium rounded-[5px] transition',
      view === 'catalog'
        ? 'bg-surface text-neutral-900 shadow-sm'
        : 'text-neutral-500 hover:text-neutral-900',
    )}
  >
    Catalog
  </button>
</div>
```

### 3.3 FF&E action cluster (right side)

Order, left → right (after the saved indicator from §10):

| Control                     | Type                    | Spec                                                                                                                                 |
| --------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Add Room                    | Primary button (filled) | `bg-brand-500 hover:bg-brand-600 text-white h-8 px-3 text-sm font-medium rounded-md`, leading `+` glyph. Opens `AddRoomModal`.       |
| Import                      | Icon + label (ghost)    | `h-8 px-2.5 text-sm text-neutral-700 hover:bg-neutral-100 rounded-md`. Icon: upload arrow, 14px. Opens import modal.                 |
| Export                      | Icon + label (ghost)    | Same shape. Icon: download arrow.                                                                                                    |
| Column visibility + density | Icon-only (ghost)       | 32×32 `text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-md`. Icon: `Columns3` (lucide). Opens popover from §6.1. |

At viewport width `< 1024px`, Import and Export collapse to icon-only with tooltip.

### 3.4 Proposal action cluster (right side)

Order, left → right (after the saved indicator from §10):

| Control                     | Type                    | Spec                                                             |
| --------------------------- | ----------------------- | ---------------------------------------------------------------- |
| Proposal Status             | Status dropdown         | See §4 — uses the new dot-progression visual.                    |
| Add Category                | Primary button (filled) | Same shape as FF&E "Add Room". Opens `AddProposalCategoryModal`. |
| Import                      | Ghost icon + label      | Same as FF&E.                                                    |
| Export                      | Ghost icon + label      | Same as FF&E.                                                    |
| Column visibility + density | Icon-only ghost         | Same as FF&E.                                                    |

---

## 4. Proposal Status — dot-progression indicator

Replaces the planned colored pill. Communicates pipeline (one project moving through stages), not unrelated semantic states.

### 4.1 Visual vocabulary

A four-dot track. The number of filled dots represents the current stage. Color progression stays in one hue family (`brand-*`) except the terminal Approved state (`success-500`):

| Status             | Dots      | Color         |
| ------------------ | --------- | ------------- |
| `in_progress`      | `○ ─ ─ ─` | `neutral-400` |
| `pricing_complete` | `● ◐ ─ ─` | `brand-400`   |
| `submitted`        | `● ● ◐ ─` | `brand-600`   |
| `approved`         | `● ● ● ●` | `success-500` |

Dots are SVG circles, 6px diameter, 4px gap. Rules between unfilled dots are 1px hairlines in `neutral-200`. The current-stage color is applied to all filled dots and to the half-filled dot of the current stage; preceding filled dots inherit a slightly desaturated version (use the same color at 70% opacity, OR step down one shade — implementer's choice but be consistent).

### 4.2 Trigger (in app bar)

```tsx
<button className="inline-flex h-8 items-center gap-2 rounded-md border border-neutral-200 bg-surface px-2.5 text-xs hover:border-neutral-300 hover:bg-neutral-50">
  <ProposalStatusDots status={status} />
  <span className="font-medium uppercase tracking-[0.08em] text-neutral-700">{label}</span>
  <ChevronDown className="h-3 w-3 text-neutral-400" />
</button>
```

The label is all-caps tracked: e.g. `PRICING COMPLETE`.

### 4.3 Dropdown options

```tsx
<DropdownMenu>
  <Option status="in_progress">
    {' '}
    <Dots /> In Progress{' '}
  </Option>
  <Option status="pricing_complete">
    {' '}
    <Dots /> Pricing Complete{' '}
  </Option>
  <Option status="submitted">
    {' '}
    <Dots /> Submitted{' '}
  </Option>
  <Option status="approved">
    {' '}
    <Dots /> Approved{' '}
  </Option>
</DropdownMenu>
```

- Width: 220px
- Option height: 36px
- Option layout: dots left (with their per-status colors), label DM Sans `text-sm`
- Active option: `bg-neutral-50` + 4px `bg-brand-500` left rule
- Hover: `bg-neutral-50`

### 4.4 Confirmation modal

**Every** transition (forward and backward) requires confirmation. Modal language names the destination and explains downstream effects in plain prose:

```
┌─ Mark proposal as Submitted? ─────────────────────────────────────────┐
│                                                                        │
│   Currently   ● ◐ ─ ─    PRICING COMPLETE                              │
│   Becomes     ● ● ◐ ─    SUBMITTED                                     │
│                                                                        │
│   Future edits to product tag, size, quantity, and unit cost will      │
│   create item change records.                                          │
│                                                                        │
│                                    [ Cancel ]   [ Mark as Submitted ]  │
└────────────────────────────────────────────────────────────────────────┘
```

Rules:

- **Title** uses the destination verb: "Mark proposal as Submitted?" / "Move proposal back to In Progress?" Never "Are you sure?"
- **Body** shows both the current and destination dots inline, side by side, using the same dot vocabulary as §4.1.
- **Body paragraph** is conditional:
  - Transitioning **out of** `in_progress` (i.e. to `pricing_complete`, `submitted`, or `approved`): `Future edits to product tag, size, quantity, and unit cost will create item change records.`
  - Transitioning **into** `in_progress` from a tracked state: `Item change records will no longer be created from edits.`
  - All other transitions between tracked states: no body paragraph.
- **CTA** repeats the destination: "Mark as Submitted", "Move to Pricing Complete", etc. Never "Confirm."
- Destructive backward transitions (any → `in_progress`) render the CTA as a ghost button with `text-warning-500`. Forward transitions use the `bg-brand-500` filled CTA.

### 4.5 New component folder

Create `src/components/shared/ProposalStatusSelect/`:

- `ProposalStatusSelect.tsx` — trigger + dropdown
- `ProposalStatusDots.tsx` — SVG dots track, reusable in modal and chip contexts
- `ProposalStatusConfirmModal.tsx` — confirmation modal
- `index.ts` — barrel exports

---

## 5. FF&E Item Status — typographic eyebrow

Per-item status stays on FF&E rows. To keep the visual language consistent with the new Proposal status, replace the existing colored `StatusBadge` with a typographic chip:

```tsx
<span className="inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.08em] text-neutral-600">
  <span className={cn('h-1.5 w-1.5 rounded-full', dotColor)} />
  {label}
</span>
```

| Status     | Dot color        | Label    |
| ---------- | ---------------- | -------- |
| `pending`  | `bg-neutral-400` | PENDING  |
| `ordered`  | `bg-brand-400`   | ORDERED  |
| `approved` | `bg-brand-600`   | APPROVED |
| `received` | `bg-success-500` | RECEIVED |

Cell width: 112px fixed. No pill background, no border.

The existing `StatusBadge` component (if standalone) should be replaced with a new `src/components/shared/ItemStatusChip.tsx`; if status currently lives inline in the table, extract it into the same new component.

---

## 6. Table interior

### 6.1 Density toggle

Three density levels, persisted per user in `localStorage` under key `table-density`:

| Level   | Row height    | Thumbnail           | When to use              |
| ------- | ------------- | ------------------- | ------------------------ |
| Compact | `h-10` (40px) | 32px image          | Power users, large rooms |
| Default | `h-13` (52px) | 40px image (`h-10`) | General use              |
| Tall    | `h-16` (64px) | 48px image (`h-12`) | Image-heavy review       |

Note: `h-13` (52px) requires a Tailwind config addition — extend `spacing` with `13: '3.25rem'` in [tailwind.config.ts](../../tailwind.config.ts).

Toggle location: inside the column-visibility popover, top section, above the column list.

```
┌─ View settings ─────────────────────┐
│                                     │
│   DENSITY                           │
│   [ Compact  ●Default  Tall ]       │
│                                     │
│   COLUMNS                           │
│   ☑ Product Tag                     │
│   ☑ Quantity                        │
│   ...                               │
└─────────────────────────────────────┘
```

The `DENSITY` heading uses the section eyebrow style (§6.2). The toggle is a small segmented control matching the Table/Catalog control in §3.2.

### 6.2 Column headers

- **Text:** all-caps, `tracking-[0.08em]`, `text-[10px]` (or `text-xs` for short labels — `≤ 8` characters), `font-medium`, `text-neutral-500`.
- **Background:** `bg-surface` — same as cells, no fill.
- **Top rule:** `border-t border-neutral-200`.
- **Bottom rule:** `border-b border-neutral-200`. The two rules give the editorial double-rule.
- **Height:** fixed at **40px regardless of density**. The chrome stays stable; only the body rows change with density.
- **Sort indicator:** only visible when the column is the active sort. A single 12px `↑` or `↓` glyph in `text-neutral-700`, right of the label with `ml-1.5`. No indicator on inactive columns.
- **No vertical column dividers.**

### 6.3 Row borders

- Horizontal hairline only: `border-b border-neutral-200/60`.
- No vertical dividers between cells.
- No alternating row backgrounds.
- **Hover state:** `bg-neutral-50/60`. Applied to the entire row including sticky cells — see §7.5 for the `group` / `group-hover:` pattern that makes this work across the sticky boundary.

### 6.4 Cell typography

- Body text: `text-sm text-neutral-900`.
- Numeric columns (`unit_cost`, `qty`, `total_cost`, dimensions): add `tabular-nums` for column alignment. `text-right`.
- Empty / null values: em dash `—` in `text-neutral-400`.
- Truncation: `truncate` with `title={value}` for full-text tooltip.

### 6.5 Editable cell affordance

Cells currently look identical whether editable or not. Add subtle signals:

- **Hover** (editable cell): 1px bottom rule in `border-neutral-300` (replaces the row's hairline for that cell width).
- **Focus / edit mode:** inset ring `ring-1 ring-brand-500 ring-inset` + `bg-surface` + an 8×8 `bg-brand-500` triangle in the top-right corner of the cell (clip-path triangle, position absolute).
- **Just-saved** (300ms after `onBlur`): briefly flash `bg-success-500/8`, fade over 600ms via CSS transition.

```tsx
<td
  className={cn(
    'relative px-3',
    isEditable && 'hover:border-b-neutral-300 cursor-text',
    isEditing && 'ring-1 ring-brand-500 ring-inset bg-surface',
    justSaved && 'animate-flash-success', // define keyframes in globals.css
  )}
>
```

### 6.6 Group headers (Room / Category)

Each Room (FF&E) or Proposal Category renders as a group header row:

- **Height:** 36px (independent of density).
- **Background:** `bg-neutral-50`.
- **Top + bottom rules:** `border-y border-neutral-200`.
- **Layout:** `flex items-center` with three regions.
  - **Left:** expand/collapse chevron (12px, `text-neutral-500`) → group name in `text-sm font-medium text-neutral-900` → item count in `text-xs text-neutral-500 ml-2` (e.g. `12 items`).
  - **Spacer.**
  - **Right:** subtotal in `text-sm tabular-nums font-medium text-neutral-900`, followed by group actions menu (`⋯`, visible on row hover only).
- **Full-row sticky-left content:** set `colSpan={totalColumns}` on the `<td>` and place the inner flex layout inside a `<div className="sticky left-0 w-[var(--viewport-width)]">` wrapper, so the label and chevron remain visible even when the table is scrolled horizontally. The subtotal/menu on the right side does **not** need to be sticky — it can scroll off and reappear in viewport when scroll returns to 0.
- **Empty group:** instead of a placeholder card, show one inline row with `text-sm text-neutral-400 italic` text `No items in this room` (or `… in this category`) and an inline `+ Add item` link button to its right. No background fill, no border. Row height matches density.

---

## 7. Sticky columns

When the table overflows horizontally, three column sets stick. **Headers of sticky columns stick with their columns; non-sticky headers scroll horizontally with the body.**

### 7.1 Sticky left — selection gutter + Product Tag / Item ID Tag

The leftmost identifier anchors the left side of the table. Stacked left-to-right:

| Column            | Width | `position: sticky` offset |
| ----------------- | ----- | ------------------------- |
| Selection gutter  | 32px  | `left: 0`                 |
| Product Tag / Tag | 120px | `left: 32px`              |

Per-table identifier column:

- **FF&E table:** `itemIdTag` column ([src/types/item.ts:12](../../src/types/item.ts#L12))
- **Proposal table:** `productTag` column ([src/components/proposal/table/ProposalTable.tsx:157](../../src/components/proposal/table/ProposalTable.tsx#L157))

Behavior:

- `position: sticky` on both header and body cells, with the offsets above.
- No static right border. A soft scroll-cue shadow appears when scrolled (see §7.4).
- The Rendering and Item Name columns are **not** sticky. They scroll with the body. (Explicit change from prior plans.)

### 7.2 Sticky right — Total Cost + Row Options

Two columns stick to the right edge. From outside (right edge) to inside:

| Column      | Width | `position: sticky` offset |
| ----------- | ----- | ------------------------- |
| Row options | 40px  | `right: 0`                |
| Total Cost  | 120px | `right: 40px`             |

- `total_cost` column body: `text-right tabular-nums font-medium`.
- Row options column: contains the `⋯` row-actions trigger. If the table does not currently have a dedicated options column, add one as the rightmost column; it renders empty until row hover.
- No static left border on `total_cost`. A soft scroll-cue shadow appears when there is content to the right that's been scrolled away (see §7.4).

### 7.3 Sticky header (entire header row) — z-index scheme

The header `<thead>` is `position: sticky; top: 0` within the scrolling table container. Combined with sticky columns, the layered z-index scheme is:

| Element                                                      | z-index         |
| ------------------------------------------------------------ | --------------- |
| Top-left intersection (gutter + Product Tag headers)         | `z-40`          |
| Top-right intersection (Total Cost + Options headers)        | `z-40`          |
| Other header cells                                           | `z-30`          |
| Sticky body cells (gutter, Product Tag, Total Cost, Options) | `z-20`          |
| Regular scrolling body cells                                 | `z-0` (default) |

The bulk action bar (§9.2) and totals bar (§8) sit in their own slot outside the scrolling region; they don't compete with the table's internal z-index stack.

### 7.4 Scroll cue shadows

When `scrollLeft > 0`, render a soft right-edge shadow on the rightmost sticky-left cell:

```css
box-shadow: 4px 0 8px -4px rgb(0 0 0 / 0.06);
```

Mirror behavior on the leftmost sticky-right cell when `scrollLeft + clientWidth < scrollWidth`:

```css
box-shadow: -4px 0 8px -4px rgb(0 0 0 / 0.06);
```

This is the "there is more content to scroll" affordance. Toggle the shadow class on/off via a `onScroll` listener; debouncing not required since the shadow is purely cosmetic.

### 7.5 Hover backgrounds across the sticky boundary

Sticky cells default to `bg-surface` so they opaquely occlude scrolling body content underneath. Without explicit hover styling, a row hover would tint only the scrolling middle and leave the sticky edges white — visually breaking the row.

Solution: apply Tailwind's `group` pattern.

```tsx
<tr className="group">
  <td className="sticky left-0 bg-surface group-hover:bg-neutral-50/60 ...">{...}</td>
  <td className="sticky left-8 bg-surface group-hover:bg-neutral-50/60 ...">{...}</td>
  <td className="group-hover:bg-neutral-50/60 ...">{...}</td>
  ...
  <td className="sticky right-[120px] bg-surface group-hover:bg-neutral-50/60 ...">{...}</td>
  <td className="sticky right-0 bg-surface group-hover:bg-neutral-50/60 ...">{...}</td>
</tr>
```

Selected rows replace `bg-surface` with `bg-brand-500/5` and `group-hover:bg-neutral-50/60` with `group-hover:bg-brand-500/8`.

---

## 8. Sticky bottom totals bar

Always present at the bottom of the table region when no rows are selected. Height: 40px. Background: `bg-surface`. Top rule: `border-t border-neutral-200`.

Layout, left → right:

```
[ N items in M rooms ]                                    [ Grand Total: $123,456.00 ]
```

- **Left** (`text-xs text-neutral-500`): visible item count and group count, e.g. `42 items in 5 rooms` / `42 items in 5 categories`.
- **Right** (`text-sm font-medium text-neutral-900 tabular-nums`): "Grand Total:" label in `text-xs text-neutral-500 mr-2`, value in tabular-nums.

The totals bar is **swapped out** (not stacked over) by the bulk action bar when `selectedIds.length > 0` — see §9.2.

Per-group subtotals stay inline in the group header row (§6.6) — no additional sticky group-subtotal bars.

---

## 9. Row selection + bulk action bar

New behavior for this pass.

### 9.1 Selection gutter column

Add a 32px-wide sticky-left gutter column **left of** the Product Tag column (see §7.1):

- Header cell: contains a checkbox that toggles "select all visible rows". When some-but-not-all rows are selected, render an indeterminate (`─`) glyph.
- Body cells: checkbox visible only when:
  - The row is hovered, OR
  - At least one row in the table is selected, OR
  - This row is selected.
- Checkbox style: 14px square, `border border-neutral-300 rounded-sm bg-surface`. Checked state: `bg-brand-500 border-brand-500` with a white check glyph.
- Click on the checkbox toggles selection. Shift-click extends range from the last-toggled row.

Selection state lives in a new hook `useRowSelection(tableId: 'ffe' | 'proposal')` that returns:

```ts
{
  selectedIds: string[];
  toggle: (id: string) => void;
  toggleRange: (id: string) => void;       // shift-click; uses last-toggled anchor
  selectAllVisible: () => void;
  clear: () => void;
}
```

State is session-only (not persisted).

### 9.2 Bulk action bar

When `selectedIds.length > 0`, the bottom totals bar (§8) is replaced **in the same 40px slot** by the bulk action bar (no stacking, no layout-height shift).

```
[ 3 selected ]   Duplicate · Move to room… · Edit field… · Delete            [ ✕ Clear ]
```

- **Left**: count in `text-sm font-medium text-neutral-900`, e.g. `3 selected`. Preceded by a 4px-wide `bg-brand-500` left rule (full bar height) as a brand-accent strip.
- **Actions** (`text-sm text-neutral-700 hover:text-neutral-900`): separated by middle dot `·` in `text-neutral-300`. Buttons are text-only, no pill, with `hover:underline`.
- **Right**: Clear selection — `text-xs text-neutral-500 hover:text-neutral-900` with leading `✕`.
- **Destructive action** (Delete): `text-danger-600 hover:text-danger-500` — clicking opens a confirmation modal using the §4.4-style language: "Delete 3 items?" / consequence paragraph / destructive CTA.
- Background: `bg-surface` with `border-t-2 border-brand-500/30` instead of the neutral 1px hairline — subtle brand presence signaling "you are in selection mode."

### 9.3 Action specifics

| Action                            | Behavior                                                                 |
| --------------------------------- | ------------------------------------------------------------------------ |
| Duplicate                         | Clones each selected row within its current group.                       |
| Move to room… / Move to category… | Opens a small popover with a list of target rooms/categories.            |
| Edit field…                       | Opens a popover: choose field → enter new value → apply to all selected. |
| Delete                            | Confirmation modal, then soft-delete via existing mutation.              |

If a particular action is out of scope to implement this pass, render it disabled with a tooltip "Coming soon" rather than omitting it — the visual completeness of the bar matters more than full functionality.

---

## 10. Saved indicator

In the **app bar row 2**, between the View toggle (or tabs, if no view toggle) and the action cluster, render a quiet save-state indicator:

```tsx
<div className="ml-4 inline-flex items-center text-[11px] text-neutral-400 font-mono">
  {state === 'saving' && 'saving…'}
  {state === 'saved' && `saved · ${relativeTime}`}
  {state === 'error' && (
    <button className="text-danger-600 hover:underline">save failed · retry</button>
  )}
</div>
```

Behavior:

- Appears 200ms after a mutation starts (`saving…`).
- Transitions to `saved · just now` on success, then ticks `2s ago`, `5s ago`, etc., up to 60s, then fades out (`opacity-0`) over 1s.
- On error: stays visible with a retry button that re-runs the last failed mutation.

Hook: `useSaveStatus()` — subscribes to React Query mutation state for the current table's mutations.

---

## 11. Deferred-cost banner (Proposal only)

When the proposal has items with `deferredCost = true`, a banner appears between the app bar and the table region.

- Height: 28px
- Background: `bg-warning-500/8`
- Top + bottom rules: `border-y border-warning-500/30`
- Layout: `text-xs text-neutral-700` left-aligned, "Review" link + "Dismiss" button right-aligned
- Text: `{n} items have deferred cost updates`
- Position: above the table, below the app bar; **not** sticky inside the scrolling region

No icon, no card, no shadow. Just a hairline-bounded typographic band.

---

## 12. Empty & loading states

### 12.1 Empty table

When a project has no rooms (FF&E) or no categories (Proposal):

- Centered single column at `max-w-md mx-auto py-24 text-center`.
- `font-display text-2xl text-neutral-900` headline: "No rooms yet." / "No categories yet."
- `text-sm text-neutral-500 mt-2` sub: "Add your first room to start building this FF&E specification." (Mirror text for proposal.)
- Primary CTA: filled `Add Room` / `Add Category` button (same style as §3.3).

No illustration. No image. Type and one button.

### 12.2 Empty group

See §6.6 — single inline row, no card, no border.

### 12.3 Loading skeleton

Static placeholders, **no shimmer animation**:

- Header skeleton: row of 4 `bg-neutral-200 h-3 w-16 rounded-sm` blocks, evenly spaced.
- Body skeleton: 8 rows of `bg-neutral-100 h-3 rounded-sm` at varying widths (40%, 60%, 30%, etc.), at the active density's row height.
- Group header skeletons interleaved every 4 rows.
- Opacity at 100%, no pulse.

The deliberate stillness reads more professional than a shimmer.

---

## 13. Keyboard hint strip

In the app bar row 2, far right (after the column-visibility icon), render a quiet keyboard hint:

```tsx
<div className="ml-3 hidden lg:inline-flex items-center gap-3 text-[10px] font-mono text-neutral-400">
  <span>
    <kbd>↑↓</kbd> nav
  </span>
  <span>
    <kbd>⏎</kbd> edit
  </span>
  <span>
    <kbd>⌘K</kbd> find
  </span>
</div>
```

`<kbd>` styling: `inline-block min-w-[14px] px-1 py-0.5 text-[9px] bg-neutral-100 border border-neutral-200 rounded-sm text-neutral-600`.

Hidden below the `lg` viewport breakpoint to avoid crowding the action cluster.

Note: `⌘K` is shown for affordance but the command palette is out of scope this pass (§16). Wire the keystroke to a no-op or a toast `Coming soon` until the palette ships.

---

## 14. Typography summary

| Element                | Font                     | Size  | Weight | Color                         | Tracking |
| ---------------------- | ------------------------ | ----- | ------ | ----------------------------- | -------- |
| Breadcrumb             | DM Sans                  | 12    | 400    | `neutral-500`                 | normal   |
| Project name           | Lora                     | 22    | 400    | `neutral-900`                 | normal   |
| Tab label              | DM Sans                  | 14    | 500    | `neutral-500` / `neutral-900` | normal   |
| View toggle            | DM Sans                  | 12    | 500    | varies                        | normal   |
| Proposal Status label  | DM Sans                  | 12    | 500    | `neutral-700`                 | `0.08em` |
| FF&E Item Status label | DM Sans                  | 10    | 500    | `neutral-600`                 | `0.08em` |
| Column header          | DM Sans                  | 10–12 | 500    | `neutral-500`                 | `0.08em` |
| Cell body              | DM Sans                  | 14    | 400    | `neutral-900`                 | normal   |
| Cell numeric           | DM Sans + `tabular-nums` | 14    | 400    | `neutral-900`                 | normal   |
| Group header           | DM Sans                  | 14    | 500    | `neutral-900`                 | normal   |
| Saved indicator        | JetBrains Mono           | 11    | 400    | `neutral-400`                 | normal   |
| Keyboard hint          | JetBrains Mono           | 10    | 400    | `neutral-400`                 | normal   |
| Empty headline         | Lora                     | 24    | 400    | `neutral-900`                 | normal   |

---

## 15. Files in scope (this pass)

| File                                                     | Change                                                                                                                                                                                                                                          |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/project/ProjectHeader.tsx`               | Rewrite as two-row app bar. Drop colored brand band. Drop Snapshot tab. Add Materials and Budget tabs. Integrate Saved indicator and keyboard hint strip.                                                                                       |
| `src/components/project/AppBarActions.tsx`               | **New.** Renders FF&E or Proposal action cluster based on context.                                                                                                                                                                              |
| `src/components/shared/ProposalStatusSelect/`            | **New folder.** Trigger, dots, dropdown, confirmation modal (§4.5).                                                                                                                                                                             |
| `src/components/shared/ItemStatusChip.tsx`               | **New.** Typographic eyebrow with leading dot (§5). Replaces existing colored `StatusBadge` usage.                                                                                                                                              |
| `src/components/shared/TotalsBar.tsx`                    | **New.** Sticky bottom totals; receives count + grand-total props.                                                                                                                                                                              |
| `src/components/shared/BulkActionBar.tsx`                | **New.** Replaces TotalsBar in the same slot when selection is active.                                                                                                                                                                          |
| `src/components/shared/DeferredCostBanner.tsx`           | **New** (or rewrite if exists). Hairline-bounded band, no card.                                                                                                                                                                                 |
| `src/components/shared/SaveStatusIndicator.tsx`          | **New.** Subscribes to mutation state.                                                                                                                                                                                                          |
| `src/components/shared/ColumnVisibilityMenu.tsx`         | Update to include Density section above column list (§6.1).                                                                                                                                                                                     |
| `src/hooks/useRowSelection.ts`                           | **New.** Session-only selection state per table id.                                                                                                                                                                                             |
| `src/hooks/useSaveStatus.ts`                             | **New.** Aggregates React Query mutation state for a tool.                                                                                                                                                                                      |
| `src/hooks/useTableDensity.ts`                           | **New.** Reads/writes `table-density` in localStorage.                                                                                                                                                                                          |
| FF&E page mount _(currently in routes; verify path)_     | Remove padding wrapper, mount new app bar + TotalsBar + selection gutter.                                                                                                                                                                       |
| Proposal page mount _(currently in routes; verify path)_ | Same as FF&E.                                                                                                                                                                                                                                   |
| `src/components/ffe/items/FfeTable.tsx`                  | Apply density-driven row height, header style, hairline rules. Add sticky-left gutter + sticky-left `itemIdTag` + sticky-right `total_cost` + sticky-right options column. Remove vertical column dividers. Remove zebra. Use `ItemStatusChip`. |
| `src/components/proposal/table/ProposalTable.tsx`        | Same as FF&E with `productTag` as sticky-left. Remove per-item status column entirely. Move Add Category trigger to app bar. Integrate deferred-cost banner above table.                                                                        |
| `src/components/ffe/FfeTableToolbar.tsx`                 | **Delete.** Actions absorbed into app bar.                                                                                                                                                                                                      |
| `tailwind.config.ts`                                     | Add `13: '3.25rem'` to `theme.extend.spacing`. Add `flash-success` keyframe + `animate-flash-success` utility (or define keyframes in `src/styles/globals.css`).                                                                                |
| `CONTEXT.md`                                             | Update §FF&E and §Flagged Ambiguities to reflect that FF&E items carry status; only Proposal items do not.                                                                                                                                      |

---

## 16. Explicitly out of scope (this pass)

These items are deferred:

- **Column resize.** No drag-to-resize column borders.
- **Column pin (user-driven).** Sticky columns are spec'd, not user-configurable.
- **Dark mode.** Light only this pass; token system supports dark, plan it for a future pass.
- **Quick-filter pill row** (filter chips under column headers).
- **`⌘K` command palette.** Keyboard hint strip mentions it; implementation is a separate task.
- **Per-group subtotal sticky bars.**
- **Cell-level change-history sparkline** (right-aligned mini-chart in `total_cost`). Existing change-history dots stay as they are.

---

## 17. What does not change

- Cell editor interactions (`CellEditor`) — only the visual affordance changes (§6.5); behavior is unchanged.
- Modal contents (`AddRoomModal`, `ExportModal`, `ImportModal`, etc.) — only the **status confirmation modal** is new in this pass.
- Image / finish cell rendering logic (`ImageFrame`, `FinishCell`).
- Drag-to-reorder column logic (DnD kit wiring) — still works on non-sticky columns. Sticky columns are non-reorderable.
- Data hooks and API calls.
- Route structure (except adding Materials and Budget routes — see prereq §2).
- Existing change-tracking logic (deferred-cost detection, item-change records). Only the banner presentation changes.

---

## 18. Acceptance — visual

A reviewer should be able to compare before/after and see:

1. **No saturated color band** at the top of the page. The chrome is white-on-neutral with hairlines.
2. **Serif is restrained**: only the project name and empty-state headlines use Lora. Everything else is DM Sans or JetBrains Mono.
3. **Tabs are underline-style**, with a 2px `brand-500` underline on the active tab.
4. **Status indicators (both Proposal and FF&E)** use dots — no colored pills anywhere.
5. **Table edges are flush** with the viewport sides — zero outer padding.
6. **Rows are 52px** by default. The density toggle is reachable from the column visibility popover.
7. **Horizontal scroll** keeps the selection gutter, Product Tag (or Item ID Tag), Total Cost, and row Options visible, with soft scroll-cue shadows on the inner edges.
8. **Bottom slot** shows the totals bar by default and the bulk action bar when rows are selected — same height, no layout shift.
9. **Row hover** tints the entire row across the sticky boundary (no white edges).
10. **Empty Room** shows one inline italic row, not a card.
11. **Loading** shows static neutral rectangles, not shimmer.
12. **Status change** always opens a confirmation modal whose title uses the destination verb and whose CTA repeats the destination — never "Confirm."

When all twelve are true, the table view has shipped.
