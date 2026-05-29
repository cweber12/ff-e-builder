import { describe, expect, it } from 'vitest';
import type { ProposalItem } from '../../../../types';
import {
  buildProposalCategoryConfirmedSave,
  prepareProposalCategoryItemSave,
} from './proposalTrackedEditFlow';

const baseItem: ProposalItem = {
  id: 'item-1',
  categoryId: 'cat-1',
  productTag: 'A-01',
  itemName: 'Chair',
  plan: '',
  drawings: '',
  location: 'Living Room',
  description: 'Upholstered armchair',
  notes: '',
  sizeLabel: '',
  sizeMode: 'imperial',
  sizeW: '',
  sizeD: '',
  sizeH: '',
  sizeUnit: 'mm',
  materials: [],
  cbm: 0.5,
  quantity: 2,
  quantityUnit: 'each',
  unitCostCents: 50000,
  sortOrder: 0,
  customData: {},
  version: 3,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

describe('proposalTrackedEditFlow', () => {
  describe('prepareProposalCategoryItemSave', () => {
    it('saves directly for in-progress projects with no open revision', () => {
      const decision = prepareProposalCategoryItemSave({
        item: baseItem,
        patch: { quantity: 7 },
        proposalStatus: 'in_progress',
        hasOpenRevision: false,
        customColumnDefs: [],
      });

      expect(decision).toEqual({
        kind: 'save',
        patch: { quantity: 7, version: 3 },
      });
    });

    it('saves directly for untracked patches even when revision flow is active', () => {
      const decision = prepareProposalCategoryItemSave({
        item: baseItem,
        patch: { sortOrder: 5 },
        proposalStatus: 'pricing_complete',
        hasOpenRevision: true,
        customColumnDefs: [],
      });

      expect(decision).toEqual({
        kind: 'save',
        patch: { sortOrder: 5, version: 3 },
      });
    });

    it('adds a non-price-affecting changelog for tracked non-price fields', () => {
      const decision = prepareProposalCategoryItemSave({
        item: baseItem,
        patch: { description: 'Updated description' },
        proposalStatus: 'pricing_complete',
        hasOpenRevision: true,
        customColumnDefs: [],
      });

      expect(decision).toEqual({
        kind: 'save',
        patch: {
          description: 'Updated description',
          version: 3,
          changeLog: {
            columnKey: 'description',
            previousValue: 'Upholstered armchair',
            newValue: 'Updated description',
            proposalStatus: 'pricing_complete',
            isPriceAffecting: false,
          },
        },
      });
    });

    it('returns confirmation state for tracked price-affecting edits', () => {
      const decision = prepareProposalCategoryItemSave({
        item: baseItem,
        patch: { quantity: 5 },
        proposalStatus: 'pricing_complete',
        hasOpenRevision: true,
        customColumnDefs: [],
      });

      expect(decision.kind).toBe('confirm');
      if (decision.kind !== 'confirm') return;

      expect(decision.pendingChange.item).toEqual(baseItem);
      expect(decision.pendingChange.patch).toEqual({ quantity: 5 });
      expect(decision.pendingChange.columnKey).toBe('quantity');
      expect(decision.pendingChange.previousValue).toBe('2 each');
      expect(decision.pendingChange.newValue).toBe('5 each');
      expect(decision.pendingChange.isPriceAffecting).toBe(true);
      expect(decision.pendingChange.lockPriceAffecting).toBe(true);
    });
  });

  describe('buildProposalCategoryConfirmedSave', () => {
    it('builds a confirmed patch with changelog fields and notes', () => {
      const decision = prepareProposalCategoryItemSave({
        item: baseItem,
        patch: { quantity: 6 },
        proposalStatus: 'pricing_complete',
        hasOpenRevision: true,
        customColumnDefs: [],
      });
      expect(decision.kind).toBe('confirm');
      if (decision.kind !== 'confirm') return;

      expect(
        buildProposalCategoryConfirmedSave({
          pendingChange: decision.pendingChange,
          result: { isPriceAffecting: true, notes: 'PM approved this revision delta' },
          proposalStatus: 'pricing_complete',
        }),
      ).toEqual({
        quantity: 6,
        version: 3,
        changeLog: {
          columnKey: 'quantity',
          previousValue: '2 each',
          newValue: '6 each',
          proposalStatus: 'pricing_complete',
          isPriceAffecting: true,
          notes: 'PM approved this revision delta',
        },
      });
    });

    it('supports toggling off price-affecting on confirm when unlocked', () => {
      const decision = prepareProposalCategoryItemSave({
        item: baseItem,
        patch: { itemName: 'Lounge Chair' },
        proposalStatus: 'pricing_complete',
        hasOpenRevision: true,
        customColumnDefs: [],
      });
      expect(decision.kind).toBe('save');
      if (decision.kind !== 'save') return;

      const priceChangeDecision = prepareProposalCategoryItemSave({
        item: baseItem,
        patch: { unitCostCents: 62000 },
        proposalStatus: 'submitted',
        hasOpenRevision: true,
        customColumnDefs: [],
      });
      expect(priceChangeDecision.kind).toBe('confirm');
      if (priceChangeDecision.kind !== 'confirm') return;

      expect(
        buildProposalCategoryConfirmedSave({
          pendingChange: priceChangeDecision.pendingChange,
          result: { isPriceAffecting: false },
          proposalStatus: 'submitted',
        }),
      ).toEqual({
        unitCostCents: 62000,
        version: 3,
        changeLog: {
          columnKey: 'unitCostCents',
          previousValue: '$500.00',
          newValue: '$620.00',
          proposalStatus: 'submitted',
          isPriceAffecting: false,
        },
      });
    });
  });
});
