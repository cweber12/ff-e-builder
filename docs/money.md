# Money — Integer Minor Units

## Convention

All monetary values in the database, API payloads, and application state are
**integer cents** (minor units). One US dollar = `100`.

**Never use floats for price fields.**

---

## Which fields are cents

| Table | Column | Notes |
|---|---|---|
| `items` | `unit_price_cents` | Price per single unit |

Derived values (line total, project total) are also computed in cents and only
converted to a display string at the UI boundary.

---

## Why not float?

IEEE 754 floating-point cannot represent many decimal fractions exactly.
`0.1 + 0.2 === 0.30000000000000004` in JavaScript. For financial data this
causes rounding drift that compounds across calculations.

Integer arithmetic is exact for all values that fit in a 53-bit mantissa
(safe up to ~$90 trillion, more than enough).

---

## How to format for display

Use the `formatCents` utility (to be added in `src/lib/money.ts`):

```ts
// src/lib/money.ts
export function formatCents(cents: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

// Example
formatCents(12500);  // "$125.00"
formatCents(99);     // "$0.99"
```

## How to parse user input

```ts
export function parseDollarsToCents(input: string): number {
  const dollars = parseFloat(input.replace(/[^0-9.]/g, ''));
  if (isNaN(dollars)) throw new Error('Invalid price input');
  return Math.round(dollars * 100);
}
```

Use `Math.round`, never `Math.floor` or `Math.ceil`, when converting to cents.

---

## Rules

- DB columns storing money MUST be `integer` (not `numeric`, not `real`).
- API response bodies send cents as plain integers, never formatted strings.
- Do not call `toFixed`, `parseFloat`, or `Number()` on raw price fields.
- Divide by 100 **only** at the display layer.
