import { describe, expect, it } from 'vitest';
import {
  lineTotalCents,
  projectTotalCents,
  roomSubtotalCents,
  proposalLineTotalCents,
  proposalProjectTotalCents,
} from './budgetCalc';
import type { Item } from '../types/item';
import type { ProposalItem } from '../types/proposal';

const makeItem = (overrides: Partial<Item> = {}): Item => ({
  id: 'i1',
  roomId: 'r1',
  itemName: 'Chair',
  description: null,
  category: null,
  itemIdTag: null,
  dimensions: null,
  notes: null,
  qty: 1,
  unitCostCents: 10000,
  leadTime: null,
  status: 'pending',
  customData: {},
  sortOrder: 0,
  version: 1,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  materials: [],
  ...overrides,
});

const makeProposalItem = (overrides: Partial<ProposalItem> = {}): ProposalItem => ({
  id: 'to1',
  categoryId: 'cat1',
  productTag: 'MW-1',
  plan: '',
  drawings: '',
  location: '',
  description: '',
  notes: '',
  sizeLabel: '',
  sizeMode: 'imperial',
  sizeW: '',
  sizeD: '',
  sizeH: '',
  sizeUnit: 'ft/in',
  materials: [],
  cbm: 0,
  quantity: 1,
  quantityUnit: 'unit',
  unitCostCents: 10000,
  sortOrder: 0,
  version: 1,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  customData: {},
  ...overrides,
});

describe('proposal totals', () => {
  it('multiplies unit cost cents by decimal quantity', () => {
    expect(proposalLineTotalCents(makeProposalItem({ unitCostCents: 1250, quantity: 2.5 }))).toBe(
      3125,
    );
  });

  it('sums proposal categories into a project total', () => {
    expect(
      proposalProjectTotalCents([
        {
          id: 'cat1',
          projectId: 'p1',
          name: 'Millwork',
          sortOrder: 0,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          items: [makeProposalItem({ unitCostCents: 2000, quantity: 3 })],
        },
        {
          id: 'cat2',
          projectId: 'p1',
          name: 'Flooring',
          sortOrder: 1,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          items: [makeProposalItem({ unitCostCents: 500, quantity: 12 })],
        },
      ]),
    ).toBe(12000);
  });
});

describe('lineTotalCents', () => {
  it('returns unitCost × qty', () => {
    expect(lineTotalCents(10000, 3)).toBe(30000);
  });

  it('returns 0 when qty is 0', () => {
    expect(lineTotalCents(10000, 0)).toBe(0);
  });

  it('handles large numbers without precision loss', () => {
    expect(lineTotalCents(999999, 100)).toBe(99999900);
  });
});

describe('roomSubtotalCents', () => {
  it('sums all line totals', () => {
    const items = [
      makeItem({ unitCostCents: 10000, qty: 2 }), // 20000
      makeItem({ unitCostCents: 5000, qty: 1 }), // 5000
    ];
    expect(roomSubtotalCents(items)).toBe(25000);
  });

  it('returns 0 for an empty room', () => {
    expect(roomSubtotalCents([])).toBe(0);
  });
});

describe('projectTotalCents', () => {
  it('sums room subtotals', () => {
    const rooms = [
      { items: [makeItem({ unitCostCents: 10000, qty: 1 })] }, // 10000
      { items: [makeItem({ unitCostCents: 20000, qty: 2 })] }, // 40000
    ];
    expect(projectTotalCents(rooms)).toBe(50000);
  });

  it('returns 0 for a project with no rooms', () => {
    expect(projectTotalCents([])).toBe(0);
  });
});
