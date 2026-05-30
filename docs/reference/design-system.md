# FF&E Builder — Design System

This document is the **source of truth** for all visual and interaction decisions in FF&E Builder. UI code must conform to these rules; deviations require an ADR.

---

## Table of Contents

1. [Tokens](#tokens)
2. [Typography](#typography)
3. [Inline Editing UX Rules](#inline-editing-ux-rules)
4. [Status Badge Spec](#status-badge-spec)
5. [Primitives Reference](#primitives-reference)
6. [Composite Surfaces](#composite-surfaces)

---

## Tokens

All colors are defined in `src/index.css` `:root` as space-separated RGB
channels (e.g. `--color-brand-500: 31 88 145`) so Tailwind's opacity modifier
works: `bg-brand-500/20` → `rgb(var(--color-brand-500) / 0.2)`. To retheme the
app, override the variables in `:root` — no component edits required.

### Brand — steel / Prussian blue

Dark, saturated steel blue. Carries primary actions, totals, active states, and
focus rings. (Replaced the earlier green brand.)

| Class       | RGB           | Hex       | Usage                                |
| ----------- | ------------- | --------- | ------------------------------------ |
| `brand-50`  | `232 240 248` | `#E8F0F8` | Tinted hover / selected backgrounds  |
| `brand-100` | `200 219 237` | `#C8DBED` | Stronger tint (e.g. `ordered` badge) |
| `brand-200` | `148 187 220` | `#94BBDC` | Badge rings, subtle borders          |
| `brand-300` | `92 149 198`  | `#5C95C6` | Hover borders                        |
| `brand-400` | `52 114 174`  | `#3472AE` | Hover borders on controls            |
| `brand-500` | `31 88 145`   | `#1F5891` | **Primary** — focus rings, accents   |
| `brand-600` | `22 69 117`   | `#164575` | Primary button fill                  |
| `brand-700` | `16 52 92`    | `#10345C` | Hover / active, link text            |
| `brand-800` | `11 38 68`    | `#0B2644` | Deep accents                         |
| `brand-900` | `7 26 47`     | `#071A2F` | Deepest accent                       |

### Neutral — cool slate gray

No warm beige bias. `200`/`300` are intentionally dark enough to read as ruled
architectural lines rather than disappearing into the page.

| Class         | RGB           | Hex       | Usage                                  |
| ------------- | ------------- | --------- | -------------------------------------- |
| `neutral-50`  | `246 248 251` | `#F6F8FB` | Subtle fills, skeletons                |
| `neutral-100` | `236 240 245` | `#ECF0F5` | Hover fills, segmented track           |
| `neutral-200` | `211 219 230` | `#D3DBE6` | Card / table borders (= `border`)      |
| `neutral-300` | `174 186 201` | `#AEBAC9` | Strong dividers (= `border-strong`)    |
| `neutral-400` | `130 145 163` | `#8291A3` | Disabled / decorative text only (~3:1) |
| `neutral-500` | `92 106 124`  | `#5C6A7C` | Secondary text, labels (~5.5:1)        |
| `neutral-600` | `62 76 94`    | `#3E4C5E` | Eyebrows, metadata (~8.7:1)            |
| `neutral-700` | `41 53 69`    | `#293545` | Body text, control text                |
| `neutral-800` | `25 35 49`    | `#192331` | Strong body                            |
| `neutral-900` | `14 22 34`    | `#0E1622` | Default text color                     |
| `neutral-950` | `8 14 22`     | `#080E16` | Headings                               |

> **Contrast rule:** body and meaningful small text must sit at `neutral-500`
> or darker on white. `neutral-400` is reserved for disabled states,
> placeholders, dashes, and icons — never meaningful small copy.

### Surface & canvas

Three-layer surface hierarchy plus the near-white paper canvas family.

| Class             | Hex       | Usage                                          |
| ----------------- | --------- | ---------------------------------------------- |
| `surface`         | `#FFFFFF` | Cards, tables, modals                          |
| `surface-muted`   | `#E7EBF0` | The visible "gray panel" behind white cards    |
| `surface-raised`  | `#FFFFFF` | Elevated overlays                              |
| `surface-inverse` | `#0E1622` | Inverted strips                                |
| `canvas` (bg)     | `#F9FAFC` | App page background (paper-textured)           |
| `canvas-shell`    | `#F4F6FA` | Hover / inset on the canvas                    |
| `canvas-chrome`   | `#FFFFFF` | Toolbars, headers, popovers                    |
| `paper`           | `#FCFCFD` | Printable artifacts (proposal totals, catalog) |

`border` = `#D3DBE6` (neutral-200); `border-strong` = `#AEBAC9` (neutral-300).

### Semantic

| Class                | Hex                           | Usage                  |
| -------------------- | ----------------------------- | ---------------------- |
| `danger-50/500/600`  | `#FEF2F2 / #DC2626 / #B91C1C` | Errors, destructive    |
| `success-50/500/700` | `#ECFDF5 / #059669 / #046C4E` | Success, positive      |
| `warning-50/500/700` | `#FFF7ED / #D97706 / #9A5406` | Warnings, amber budget |

### Type scale

Body anchors at **14px** (the data-dense default); the display serif steps up
for page authority. Canonical role tokens live in `:root` as `--text-*`; the
matching Tailwind size classes remain available for everyday use.

| Role    | Token (`--text-*`) | Size | Tailwind   | Usage                         |
| ------- | ------------------ | ---- | ---------- | ----------------------------- |
| display | `--text-display`   | 32px | `text-3xl` | Page hero (Fraunces serif)    |
| title   | `--text-title`     | 24px | `text-2xl` | Page / section h1             |
| section | `--text-section`   | 17px | `text-lg`  | Card + panel headings         |
| body    | `--text-body`      | 14px | `text-sm`  | Default reading + controls    |
| caption | `--text-caption`   | 13px | —          | Secondary descriptive text    |
| meta    | `--text-meta`      | 11px | —          | Eyebrows, labels, table heads |

Body letter-spacing `-0.005em`; headings `-0.015em`. Tabular numerals apply by
default to `table` and `[data-tabular]`.

### Spacing

The standard Tailwind spacing scale applies. A canonical numeric vocabulary is
also documented in `:root` as `--space-1`…`--space-10` (4 / 8 / 12 / 16 / 20 /
24 / 32 / 40px). Custom Tailwind additions:

| Token         | Value     | Usage         |
| ------------- | --------- | ------------- |
| `spacing.13`  | `3.25rem` | —             |
| `spacing.18`  | `4.5rem`  | Navbar height |
| `spacing.112` | `28rem`   | Wide panels   |
| `spacing.128` | `32rem`   | Wide panels   |

### Radii

Architectural / spec-sheet — deliberately tight. The design system standardizes
on `sm` and `md`; avoid larger Tailwind radii on app chrome.

| Token  | Class          | Value    | Usage                              |
| ------ | -------------- | -------- | ---------------------------------- |
| `sm`   | `rounded-sm`   | `4px`    | Buttons, inputs, segmented control |
| `md`   | `rounded-md`   | `6px`    | Cards, modals, drawers, popovers   |
| `pill` | `rounded-pill` | `9999px` | Badges, status chips               |
| `flat` | `rounded-flat` | `0`      | Full-bleed paper surfaces          |

### Shadows

Custom, cool-tinted (`rgb(15 23 42)` base, not black), restrained. Pair with
hairline borders rather than carrying elevation alone.

| Class          | Usage                                     |
| -------------- | ----------------------------------------- |
| `shadow-sm`    | Resting cards, inputs, primary buttons    |
| `shadow-md`    | Dropdowns, hover lift on tiles            |
| `shadow-lg`    | Menus / popovers                          |
| `shadow-xl`    | Modals, drawers                           |
| `shadow-paper` | Plan viewport "sheet on a drafting table" |

### Transitions

Canonical timings in `:root`; reach for these instead of ad-hoc durations.

| Token               | Value                                 | Usage                        |
| ------------------- | ------------------------------------- | ---------------------------- |
| `--transition-fast` | `100ms ease`                          | Hover / active state changes |
| `--transition-base` | `150ms ease`                          | Most color / border changes  |
| `--transition-slow` | `250ms cubic-bezier(0.16, 1, 0.3, 1)` | Entrance reveals, lifts      |

### Focus

One affordance app-wide: a brand ring — `focus-visible:ring-2
ring-brand-500/30 ring-offset-1` (the `.focus-ring` utility; `ring-inset` for
flush items like menu rows). Never rely on color alone for state.

---

## Typography

### Font Families

| Role                | Family                  | Source                                              |
| ------------------- | ----------------------- | --------------------------------------------------- |
| UI / body (sans)    | Manrope Variable        | `@fontsource-variable/manrope` (self-hosted)        |
| Page heroes (serif) | Fraunces Variable       | `@fontsource-variable/fraunces` (self-hosted)       |
| Monospace           | JetBrains Mono Variable | `@fontsource-variable/jetbrains-mono` (self-hosted) |

DM Sans Variable is retained only as a sans fallback in the font stack; it is
not used as a primary face.

**Why self-hosted?** No Google CDN calls = no external network dependency (works behind firewalls), no privacy concern for GDPR, no FOUC risk in strict Content-Security-Policy environments.

Fonts are imported in `src/index.css`:

```css
@import '@fontsource-variable/manrope';
@import '@fontsource-variable/jetbrains-mono';
@import '@fontsource-variable/fraunces/full.css';
```

### Type Pairings

- **Page heroes** — Fraunces Variable via the `.page-title` utility (opsz 40,
  SOFT 0, WONK 0 — a crisp, non-quirky cut), 600 weight, 24–32px. Reserved for
  page-level h1s (Dashboard welcome, sign-in, company profile, error pages).
  Never used for panel/modal titles, card numbers, or dense UI.
- **Section / panel headings** — Manrope Variable (`font-display`), 600 weight, 16–20px
- **Body / labels** — Manrope Variable, 400–600 weight, 13–14px
- **Currency / measurements** — JetBrains Mono Variable, tabular nums (`font-variant-numeric: tabular-nums`)
- **IDs / model numbers** — JetBrains Mono Variable, 400 weight, 11–13px

---

## Inline Editing UX Rules

These rules apply to every inline-editable field in the app. **Deviating from these rules requires an explicit product decision.**

### Activation

| Field type                        | Activation gesture                             | Rationale                                                                          |
| --------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------- |
| Text (name, label)                | Single click                                   | Low risk — mistyping a name is easily reversed                                     |
| **Numeric (money, qty, percent)** | **Double-click OR explicit pencil icon click** | **An accidental single-click on a budget field must never risk committing a typo** |

### Keyboard Interaction

| Key                    | Behavior                                                             |
| ---------------------- | -------------------------------------------------------------------- |
| `Enter`                | Save the current value and exit edit mode                            |
| `Esc`                  | Cancel — discard changes and exit edit mode                          |
| `Blur` (click outside) | Save the current value                                               |
| `Tab`                  | Save the current value and move focus to the next editable field     |
| `Shift+Tab`            | Save the current value and move focus to the previous editable field |

### Saving Indicator

While an API mutation is in-flight, the field shows a **subtle pulsing left-border** in `brand-500`. The input remains interactive — the user can keep typing. This is implemented via the CSS class `animate-pulse border-l-2 border-brand-500`.

### Error State

When a save mutation fails:

1. The field border turns red (`border-danger-500`)
2. An error tooltip appears below the field with the error message
3. The **displayed value reverts** to the last known-good value
4. **The input stays open** with the user's typed value preserved — they can correct and retry without re-entering everything

### Validation (client-side)

- Numeric fields reject non-numeric input and show inline validation before even calling the API.
- Empty values are treated as 0 for numeric fields unless the field explicitly allows null.

---

## Status Badge Spec

Status badges are **pill-shaped** (`rounded-pill`), always pair an inline SVG
icon with a label, and use semantic surface tints. Icons are hand-drawn SVGs in
`StatusBadge.tsx` (not emoji), stroked with `currentColor`.

### Item Status Values

| Status     | Background      | Text               | Icon  | Label    |
| ---------- | --------------- | ------------------ | ----- | -------- |
| `pending`  | `bg-warning-50` | `text-warning-700` | clock | Pending  |
| `approved` | `bg-brand-50`   | `text-brand-700`   | check | Approved |
| `ordered`  | `bg-brand-100`  | `text-brand-700`   | truck | Ordered  |
| `received` | `bg-success-50` | `text-success-700` | box   | Received |

### Structure

```tsx
<StatusBadge status="pending" />
// → <span role="status" aria-label="Status: Pending"
//         class="... rounded-pill ..."><svg.../> Pending</span>
```

`StatusBadge` does **not** carry onClick — it is a display-only primitive that
sets `role="status"` and an `aria-label`. Interaction for changing status lives
in the parent (e.g. the table's status editor).

> Distinct from the generic `Badge` primitive, whose variants (`neutral`,
> `brand`, `danger`, `warning`, `success`) all use a tinted fill + inset ring
> drawn from the semantic tokens above.

---

## Primitives Reference

All primitives live in `src/components/primitives/` and are re-exported from its
barrel (`index.ts`).

| Component                                                                 | Description                                                                                                                                                                     |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Button` / `ButtonLink`                                                   | Variants: `primary`, `secondary`, `ghost`, `danger`, `toolbar`, `toolbarPrimary`. Sizes `sm/md/lg`. `asChild` for link composition; subtle `active:scale-[0.98]` press feedback |
| `Badge`                                                                   | Display chip. Variants `neutral`, `brand`, `danger`, `warning`, `success`; sizes `sm/md`; optional `uppercase`                                                                  |
| `StatusBadge`                                                             | Read-only item-status pill (`pending`/`approved`/`ordered`/`received`) with SVG icon + `role="status"`                                                                          |
| `SegmentedControl`                                                        | Mutually-exclusive toggle. Variants `segmented`/`toolbar`; tones `default`/`quiet`/`rail`/`status`                                                                              |
| `InlineTextEdit`                                                          | Single-click edit, text fields                                                                                                                                                  |
| `InlineNumberEdit`                                                        | Double-click (or pencil) edit, numeric fields with formatter prop                                                                                                               |
| `Modal`                                                                   | Centered `<dialog>`, focus-trapped, Esc to close                                                                                                                                |
| `Drawer`                                                                  | Right-side slide-in panel, focus-trapped                                                                                                                                        |
| `DropdownMenu`                                                            | Portal-positioned menu with submenu support                                                                                                                                     |
| `MenuPanel` + `MenuItem` / `MenuSeparator` / `MenuSubTrigger` / `MenuSub` | Composable floating menu surface                                                                                                                                                |
| `LayoutSection`                                                           | Collapsible titled section                                                                                                                                                      |
| `CompactRowGrid` / `GridCell`                                             | Two-column compact field grid                                                                                                                                                   |
| `ColorChipGroup`                                                          | Radio-style color swatch picker                                                                                                                                                 |
| `ToastProvider` / `toast`                                                 | Thin wrapper around `sonner`                                                                                                                                                    |

See the source files in `src/components/primitives/` for full prop documentation.

### Design-system utility classes

Shared class utilities live in `src/index.css` `@layer components` — prefer
these over re-deriving inline class strings.

| Class                                                                     | Purpose                                                                   |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `.page-title`                                                             | Fraunces display serif for page-level heroes only                         |
| `.eyebrow` / `.eyebrow-mono`                                              | Uppercase metadata label (11/10px, `neutral-600`, tracked)                |
| `.card` + `.card-section[-lg]`                                            | White panel with hairline border + padding                                |
| `.surface-flat` / `.surface-paper` / `.section-rule`                      | Section surface vocabulary (transparent vs. contained chrome vs. divider) |
| `.input-base` / `.input-compact`                                          | Standard / compact text input                                             |
| `.select-base`                                                            | Native `<select>` with painted chevron + consistent focus                 |
| `.toolbar-select` / `.toolbar-input` / `.toolbar-label` / `.toolbar-stat` | Toolbar control vocabulary                                                |
| `.toolbar-segmented` / `.segmented`                                       | Segmented toggles (toolbar vs. tracked variants)                          |
| `.icon-btn`                                                               | Square 32px icon button                                                   |
| `.menu-panel` / `.menu-item`                                              | Floating menu surface + row                                               |
| `.focus-ring`                                                             | The canonical brand keyboard focus ring                                   |
| `.metric-row` / `.metric-card` / `.status-chip` / `.num`                  | Plan-inspector readout primitives                                         |
| `.table-head-cell`                                                        | Sticky table header cell (uppercase, hairline)                            |

Native `<input type="checkbox">` / `type="radio"` inherit a brand
`accent-color` globally.

---

## Composite Surfaces

| Component    | Description                                                                        |
| ------------ | ---------------------------------------------------------------------------------- |
| `ItemsTable` | FF&E item schedule grouped by room with inline editing, subtotals, and grand total |

`ItemsTable` uses `@tanstack/react-table` for column rendering. Money must be formatted through `formatMoney()` and totals must match the shared `roomSubtotalCents()` and `projectTotalCents()` helpers.

Editable item cells use the Phase 4 inline-editing primitives:

- Text fields use `InlineTextEdit` and save on blur or Enter.
- Numeric fields use `InlineNumberEdit`; quantity, unit cost, and markup validate through `zod` schemas before any mutation is sent.
- Unit cost is edited as dollars and submitted as integer cents.
- Line total remains read-only because it is derived from quantity, unit cost, and markup.
- Status uses the display-only `StatusBadge` primitive inside an editor that supports left-click cycling and an explicit menu with every status option.
- Each room exposes an `Add item` drawer. The form uses the shared item schema, category supports existing values plus free input, and money input is collected as dollars before converting to cents.
- Room deletion always uses a confirmation modal. Rooms with items require a target room before deletion so items are moved deliberately.
- Per-item actions live behind a row menu for duplicate, move to room, and delete. Sort order is changed with drag handles and saved optimistically.
