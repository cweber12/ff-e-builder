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

### Color Palette

| Token             | Class             | Hex       | Usage                                 |
| ----------------- | ----------------- | --------- | ------------------------------------- |
| `brand.50`        | `brand-50`        | `#F1F5F2` | Tinted backgrounds, subtle hover      |
| `brand.500`       | `brand-500`       | `#1A6B4A` | Primary actions, headers, focus rings |
| `brand.600`       | `brand-600`       | `#155A3E` | Hover state for primary elements      |
| `brand.700`       | `brand-700`       | `#0F4631` | Active / pressed state                |
| `surface.DEFAULT` | `surface`         | `#FFFFFF` | Card / panel backgrounds              |
| `surface.muted`   | `surface-muted`   | `#F8F6F1` | Page background (warm off-white)      |
| `surface.inverse` | `surface-inverse` | `#1C1C1A` | Dark surfaces, tooltips               |
| `danger.500`      | `danger-500`      | `#DC2626` | Errors, destructive actions           |
| `danger.600`      | `danger-600`      | `#B91C1C` | Hover/active on danger                |
| `success.500`     | `success-500`     | `#059669` | Success states, positive budget       |
| `warning.500`     | `warning-500`     | `#D97706` | Warnings, amber budget                |

### Type Scale

| Step | Tailwind class | Size | Usage                  |
| ---- | -------------- | ---- | ---------------------- |
| xs   | `text-xs`      | 12px | Metadata, timestamps   |
| sm   | `text-sm`      | 14px | Secondary text, labels |
| base | `text-base`    | 16px | Body copy              |
| lg   | `text-lg`      | 18px | Sub-headings           |
| xl   | `text-xl`      | 20px | Section headings       |
| 2xl  | `text-2xl`     | 24px | Page headings          |
| 3xl  | `text-3xl`     | 30px | Hero/display           |

### Spacing Scale

The standard Tailwind spacing scale applies. Additional custom values:

| Token        | Value    | Usage         |
| ------------ | -------- | ------------- |
| `spacing.18` | `4.5rem` | Navbar height |

### Radii

| Token  | Class          | Value | Usage           |
| ------ | -------------- | ----- | --------------- |
| `sm`   | `rounded-sm`   | 2px   | Micro elements  |
| `md`   | `rounded-md`   | 6px   | Buttons, inputs |
| `lg`   | `rounded-lg`   | 8px   | Cards           |
| `xl`   | `rounded-xl`   | 12px  | Modals, drawers |
| `2xl`  | `rounded-2xl`  | 16px  | Large panels    |
| `pill` | `rounded-pill` | 999px | Status badges   |

### Shadows

Use Tailwind's default shadow scale. Pattern:

| Class       | Usage                           |
| ----------- | ------------------------------- |
| `shadow-sm` | Inline editable values on hover |
| `shadow-md` | Cards, dropdowns                |
| `shadow-xl` | Modals, drawers                 |

---

## Typography

### Font Families

| Role            | Family                  | Source                                              |
| --------------- | ----------------------- | --------------------------------------------------- |
| UI (sans-serif) | DM Sans Variable        | `@fontsource-variable/dm-sans` (self-hosted)        |
| Monospace       | JetBrains Mono Variable | `@fontsource-variable/jetbrains-mono` (self-hosted) |

**Why self-hosted?** No Google CDN calls = no external network dependency (works behind firewalls), no privacy concern for GDPR, no FOUC risk in strict Content-Security-Policy environments.

Both fonts are imported in `src/index.css`:

```css
@import '@fontsource-variable/dm-sans';
@import '@fontsource-variable/jetbrains-mono';
```

### Type Pairings

- **Project/page headings** — DM Sans Variable, 700 weight, 24–30px
- **Body / labels** — DM Sans Variable, 400–500 weight, 14–16px
- **Currency values** — DM Sans Variable, 500 weight, tabular nums (`font-variant-numeric: tabular-nums`)
- **IDs / model numbers** — JetBrains Mono Variable, 400 weight, 13px

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

Status badges are **pill-shaped** (`rounded-pill`), always contain an icon and a label, and use semantic colors.

### Item Status Values

| Status     | Color                 | Icon | Label    |
| ---------- | --------------------- | ---- | -------- |
| `pending`  | `warning-500` bg tint | ⏳   | Pending  |
| `approved` | `brand-500` bg tint   | ✓    | Approved |
| `ordered`  | Blue bg tint          | 📦   | Ordered  |
| `received` | `success-500` bg tint | ✓    | Received |

### Structure

```tsx
<StatusBadge status="pending" />
// → <span class="... rounded-pill ...">⏳ Pending</span>
```

Badge does **not** carry onClick — it is a display-only primitive. Interaction for changing status lives in the parent component.

---

## Primitives Reference

All primitives live in `src/components/primitives/`.

| Component                 | Description                                           |
| ------------------------- | ----------------------------------------------------- |
| `Button`                  | Variants: `primary`, `secondary`, `ghost`, `danger`   |
| `InlineTextEdit`          | Single-click edit, text fields                        |
| `InlineNumberEdit`        | Double-click edit, numeric fields with formatter prop |
| `StatusBadge`             | Read-only pill badge, semantic status colors          |
| `Drawer`                  | Right-side slide-in panel, focus-trapped              |
| `Modal`                   | Centered dialog, focus-trapped                        |
| `Toast` / `ToastProvider` | Thin wrapper around `sonner`                          |

See the source files in `src/components/primitives/` for full prop documentation.

---

## Composite Surfaces

| Component    | Description                                                                 |
| ------------ | --------------------------------------------------------------------------- |
| `ItemsTable` | Read-only FF&E item schedule grouped by room with subtotals and grand total |

`ItemsTable` uses `@tanstack/react-table` for column rendering. Money must be formatted through `formatMoney()` and totals must match the shared `roomSubtotalCents()` and `projectTotalCents()` helpers.
