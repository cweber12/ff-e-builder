import { describe, expect, it } from 'vitest';
import type { ProposalItem } from '../../../types';
import {
  buildProposalItemDuplicateInput,
  proposalItemDisplayName,
  proposalItemLocationName,
} from './proposalTableItemHelpers';

const baseItem: ProposalItem = {
  id: 'item-1',
  categoryId: 'cat-1',
  productTag: 'A-01',
  itemName: 'Chair',
  plan: 'Plan A',
  drawings: 'Drawing 1',
  location: 'Living Room',
  description: 'Accent chair',
  notes: '',
  sizeLabel: '24W x 24D x 30H',
  sizeMode: 'imperial',
  sizeW: '24',
  sizeD: '24',
  sizeH: '30',
  sizeUnit: 'in',
  materials: [],
  cbm: 0.5,
  quantity: 2,
  quantityUnit: 'each',
  unitCostCents: 50000,
  sortOrder: 2,
  customData: {},
  version: 3,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

describe('proposalTableItemHelpers', () => {
  describe('buildProposalItemDuplicateInput', () => {
    it('builds duplicate payload without customData when empty', () => {
      expect(buildProposalItemDuplicateInput(baseItem)).toEqual({
        productTag: 'A-01',
        description: 'Accent chair',
        plan: 'Plan A',
        drawings: 'Drawing 1',
        location: 'Living Room',
        sizeLabel: '24W x 24D x 30H',
        sizeMode: 'imperial',
        sizeUnit: 'in',
        sizeW: '24',
        sizeD: '24',
        sizeH: '30',
        cbm: 0.5,
        quantity: 2,
        quantityUnit: 'each',
        unitCostCents: 50000,
        sortOrder: 2.5,
      });
    });

    it('includes customData when present', () => {
      const withCustomData: ProposalItem = {
        ...baseItem,
        customData: { vendor: 'Atlas' },
      };

      expect(buildProposalItemDuplicateInput(withCustomData)).toEqual({
        productTag: 'A-01',
        description: 'Accent chair',
        plan: 'Plan A',
        drawings: 'Drawing 1',
        location: 'Living Room',
        sizeLabel: '24W x 24D x 30H',
        sizeMode: 'imperial',
        sizeUnit: 'in',
        sizeW: '24',
        sizeD: '24',
        sizeH: '30',
        cbm: 0.5,
        quantity: 2,
        quantityUnit: 'each',
        unitCostCents: 50000,
        sortOrder: 2.5,
        customData: { vendor: 'Atlas' },
      });
    });
  });

  it('prefers itemName, then productTag, then description for display name', () => {
    expect(proposalItemDisplayName(baseItem)).toBe('Chair');
    expect(proposalItemDisplayName({ ...baseItem, itemName: '' })).toBe('A-01');
    expect(proposalItemDisplayName({ ...baseItem, itemName: '', productTag: '' })).toBe(
      'Accent chair',
    );
    expect(
      proposalItemDisplayName({ ...baseItem, itemName: '', productTag: '', description: '' }),
    ).toBe('Item');
  });

  it('uses fallback location when empty', () => {
    expect(proposalItemLocationName(baseItem)).toBe('Living Room');
    expect(proposalItemLocationName({ ...baseItem, location: '' })).toBe('Unassigned');
  });
});
