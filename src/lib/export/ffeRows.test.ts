import { describe, expect, it } from 'vitest';
import { buildStatusBreakdown, itemToRow, sortedItems } from './ffeRows';
import type { Item, RoomWithItems } from '../../types';

const makeItem = (overrides: Partial<Item> = {}): Item => ({
  id: 'i1',
  roomId: 'r1',
  itemName: 'Lounge Chair',
  description: null,
  category: 'Seating',
  itemIdTag: 'LC-001',
  dimensions: '30"W x 32"D',
  notes: 'Install carefully',
  qty: 2,
  unitCostCents: 50000,
  leadTime: '8 weeks',
  status: 'pending',
  customData: {},
  sortOrder: 0,
  version: 1,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  materials: [
    {
      id: 'm1',
      projectId: 'p1',
      name: 'Walnut',
      materialId: 'MAT-001',
      description: '',
      swatchHex: '#5c3a21',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
  ],
  ...overrides,
});

const makeRoom = (items: Item[]): RoomWithItems => ({
  id: 'r1',
  projectId: 'p1',
  name: 'Living Room',
  sortOrder: 0,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  items,
});

describe('FF&E export row helpers', () => {
  it('maps an item to the exported table row format', () => {
    expect(itemToRow(makeItem())).toEqual([
      'LC-001',
      'Lounge Chair',
      'Seating',
      '30"W x 32"D',
      '2',
      '$500.00',
      '$1,000.00',
      'pending',
      '8 weeks',
      'Install carefully',
      'Walnut (MAT-001)',
    ]);
  });

  it('sorts room items by sort order and then item name', () => {
    const beta = makeItem({ id: 'b', itemName: 'Beta', sortOrder: 2 });
    const alpha = makeItem({ id: 'a', itemName: 'Alpha', sortOrder: 2 });
    const first = makeItem({ id: 'first', itemName: 'Zulu', sortOrder: 1 });

    expect(sortedItems(makeRoom([beta, first, alpha])).map((item) => item.id)).toEqual([
      'first',
      'a',
      'b',
    ]);
  });

  it('builds status totals', () => {
    const breakdown = buildStatusBreakdown([
      makeItem({ status: 'pending', qty: 2, unitCostCents: 50000 }),
      makeItem({ id: 'i2', status: 'pending', qty: 1, unitCostCents: 10000 }),
    ]);

    expect(breakdown.get('pending')).toEqual({ count: 2, total: 110000 });
  });
});
