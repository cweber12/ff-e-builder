# Money — Integer Minor Units

## Convention

All monetary values in the database, API payloads, and application state are
**integer cents** (minor units). One US dollar = `100`.

**Never use floats for price fields.**

---

## Which fields are cents

| Table   | Column            | Notes                |
| ------- | ----------------- | -------------------- |
| `items` | `unit_cost_cents` | Cost per single unit |

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

Use the shared `formatMoney()` utility from `src/types/project.ts`:

```ts
import { cents, formatMoney } from '../types';

// Example
formatMoney(cents(12500)); // "$125.00"
formatMoney(cents(99)); // "$0.99"
```

## How to parse user input

```ts
import { parseUnitCostDollarsInput, unitCostDollarsToCents } from '../types';

const dollars = parseUnitCostDollarsInput('1234.56');
if (dollars === undefined) throw new Error('Invalid price input');

const unitCostCents = unitCostDollarsToCents(dollars);
```

Use `Math.round`, never `Math.floor` or `Math.ceil`, when converting to cents.

---

## Rules

- DB columns storing money MUST be `integer` (not `numeric`, not `real`).
- API response bodies send cents as plain integers, never formatted strings.
- Do not call `toFixed`, `parseFloat`, or `Number()` on raw price fields.
- Divide by 100 **only** at the display layer.
