import { describe, expect, it } from 'vitest';
import { lineTotalCents, projectTotalCents, roomSubtotalCents, sellPriceCents } from './calc';
import type { Item } from '../types/item';

const makeItem = (overrides: Partial<Item> = {}): Item => ({
  id: 'i1',
  roomId: 'r1',
  itemName: 'Chair',
  category: null,
  vendor: null,
  model: null,
  itemIdTag: null,
  dimensions: null,
  seatHeight: null,
  finishes: null,
  notes: null,
  qty: 1,
  unitCostCents: 10000,
  markupPct: 0,
  leadTime: null,
  status: 'pending',
  imageUrl: null,
  linkUrl: null,
  sortOrder: 0,
  version: 1,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  ...overrides,
});

describe('sellPriceCents', () => {
  it('returns unitCostCents unchanged at zero markup', () => {
    expect(sellPriceCents(10000, 0)).toBe(10000);
  });

  it('doubles the cost at 100% markup', () => {
    expect(sellPriceCents(10000, 100)).toBe(20000);
  });

  it('rounds correctly for non-integer markup (33.33%)', () => {
    // 10000 * 1.3333 = 13333.0 → 13333
    expect(sellPriceCents(10000, 33.33)).toBe(13333);
  });

  it('returns 0 when unit cost is 0', () => {
    expect(sellPriceCents(0, 50)).toBe(0);
  });
});

describe('lineTotalCents', () => {
  it('returns sellPrice × qty', () => {
    expect(lineTotalCents(10000, 50, 3)).toBe(45000);
  });

  it('returns 0 when qty is 0', () => {
    expect(lineTotalCents(10000, 50, 0)).toBe(0);
  });

  it('handles large numbers without precision loss', () => {
    // $9999.99 unit cost, 200% markup, qty 100
    // sellPrice = round(999999 * 3) = 2999997
    // lineTotal = 2999997 * 100 = 299999700
    expect(lineTotalCents(999999, 200, 100)).toBe(299999700);
  });
});

describe('roomSubtotalCents', () => {
  it('sums all line totals', () => {
    const items = [
      makeItem({ unitCostCents: 10000, markupPct: 0, qty: 2 }), // 20000
      makeItem({ unitCostCents: 5000, markupPct: 100, qty: 1 }), // 10000
    ];
    expect(roomSubtotalCents(items)).toBe(30000);
  });

  it('returns 0 for an empty room', () => {
    expect(roomSubtotalCents([])).toBe(0);
  });
});

describe('projectTotalCents', () => {
  it('sums room subtotals', () => {
    const rooms = [
      { items: [makeItem({ unitCostCents: 10000, markupPct: 0, qty: 1 })] }, // 10000
      { items: [makeItem({ unitCostCents: 20000, markupPct: 50, qty: 2 })] }, // 60000
    ];
    expect(projectTotalCents(rooms)).toBe(70000);
  });

  it('returns 0 for a project with no rooms', () => {
    expect(projectTotalCents([])).toBe(0);
  });
});
