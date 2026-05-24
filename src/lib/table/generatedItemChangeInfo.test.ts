import { describe, expect, it } from 'vitest';
import { proposalPatchToGeneratedItemChangeInfo } from './generatedItemChangeInfo';
import type { ProposalItem } from '../../types';

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
  version: 1,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

describe('proposalPatchToGeneratedItemChangeInfo', () => {
  describe('price-affecting columns', () => {
    it('returns isPriceAffecting:true for quantity', () => {
      const info = proposalPatchToGeneratedItemChangeInfo({ quantity: 5 }, baseItem, []);
      expect(info).not.toBeNull();
      expect(info!.isPriceAffecting).toBe(true);
    });

    it('returns isPriceAffecting:true for size fields', () => {
      const info = proposalPatchToGeneratedItemChangeInfo({ sizeW: '100' }, baseItem, []);
      expect(info).not.toBeNull();
      expect(info!.isPriceAffecting).toBe(true);
    });

    it('returns isPriceAffecting:true for cbm', () => {
      const info = proposalPatchToGeneratedItemChangeInfo({ cbm: 1.2 }, baseItem, []);
      expect(info).not.toBeNull();
      expect(info!.isPriceAffecting).toBe(true);
    });

    it('returns isPriceAffecting:true for unitCostCents', () => {
      const info = proposalPatchToGeneratedItemChangeInfo({ unitCostCents: 75000 }, baseItem, []);
      expect(info).not.toBeNull();
      expect(info!.isPriceAffecting).toBe(true);
    });
  });

  describe('non-price columns', () => {
    it('returns isPriceAffecting:false for description', () => {
      const info = proposalPatchToGeneratedItemChangeInfo(
        { description: 'Updated description' },
        baseItem,
        [],
      );
      expect(info).not.toBeNull();
      expect(info!.isPriceAffecting).toBe(false);
    });

    it('returns isPriceAffecting:false for notes', () => {
      const info = proposalPatchToGeneratedItemChangeInfo({ notes: 'New note' }, baseItem, []);
      expect(info).not.toBeNull();
      expect(info!.isPriceAffecting).toBe(false);
    });

    it('returns isPriceAffecting:false for drawings', () => {
      const info = proposalPatchToGeneratedItemChangeInfo({ drawings: 'DWG-01' }, baseItem, []);
      expect(info).not.toBeNull();
      expect(info!.isPriceAffecting).toBe(false);
    });

    it('returns isPriceAffecting:false for location', () => {
      const info = proposalPatchToGeneratedItemChangeInfo({ location: 'Bedroom' }, baseItem, []);
      expect(info).not.toBeNull();
      expect(info!.isPriceAffecting).toBe(false);
    });

    it('returns isPriceAffecting:false for productTag', () => {
      const info = proposalPatchToGeneratedItemChangeInfo({ productTag: 'B-02' }, baseItem, []);
      expect(info).not.toBeNull();
      expect(info!.isPriceAffecting).toBe(false);
    });

    it('returns isPriceAffecting:false for custom columns', () => {
      const info = proposalPatchToGeneratedItemChangeInfo(
        { customData: { 'col-1': 'value' } },
        baseItem,
        [
          {
            id: 'col-1',
            projectId: 'proj-1',
            label: 'Finish',
            tableType: 'proposal' as const,
            sortOrder: 0,
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-01T00:00:00Z',
          },
        ],
      );
      expect(info).not.toBeNull();
      expect(info!.isPriceAffecting).toBe(false);
    });
  });

  describe('untracked / passthrough patches', () => {
    it('returns null for patches with no tracked fields', () => {
      const info = proposalPatchToGeneratedItemChangeInfo({ sortOrder: 3 }, baseItem, []);
      expect(info).toBeNull();
    });
  });

  describe('previous and new values', () => {
    it('captures previous and new description', () => {
      const info = proposalPatchToGeneratedItemChangeInfo({ description: 'Updated' }, baseItem, []);
      expect(info!.previousValue).toBe('Upholstered armchair');
      expect(info!.newValue).toBe('Updated');
    });

    it('captures previous and new quantity', () => {
      const info = proposalPatchToGeneratedItemChangeInfo({ quantity: 5 }, baseItem, []);
      expect(info!.previousValue).toBe('2 each');
      expect(info!.newValue).toBe('5 each');
    });
  });
});
