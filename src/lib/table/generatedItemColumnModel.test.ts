import { describe, expect, it } from 'vitest';
import {
  FFE_GENERATED_ITEM_TABLE_PRESET,
  PROPOSAL_GENERATED_ITEM_TABLE_PRESET,
} from './generatedItemTablePresets';
import { resolveGeneratedItemColumns } from './generatedItemColumnModel';
import type { Item, ProposalItem } from '../../types';

const baseFfeItem: Item = {
  id: 'ffe-1',
  roomId: 'room-1',
  itemName: 'Chair',
  description: null,
  category: null,
  itemIdTag: null,
  dimensions: null,
  notes: null,
  qty: 1,
  unitCostCents: 5000,
  leadTime: null,
  status: 'pending',
  customData: {},
  sortOrder: 0,
  version: 1,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  materials: [],
};

const baseProposalItem: ProposalItem = {
  id: 'proposal-1',
  categoryId: 'cat-1',
  productTag: 'A-01',
  itemName: '',
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
  sizeUnit: 'mm',
  materials: [],
  cbm: 0,
  quantity: 1,
  quantityUnit: 'each',
  unitCostCents: 8000,
  sortOrder: 0,
  customData: {},
  version: 1,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

describe('resolveGeneratedItemColumns', () => {
  it('returns FF&E columns in preset order', () => {
    const resolved = resolveGeneratedItemColumns(FFE_GENERATED_ITEM_TABLE_PRESET, [], {});
    expect(resolved.map((column) => column.id)).toEqual([
      ...FFE_GENERATED_ITEM_TABLE_PRESET.defaultColumnIds,
    ]);
  });

  it('returns Proposal columns in preset order plus fixed sticky columns', () => {
    const resolved = resolveGeneratedItemColumns(PROPOSAL_GENERATED_ITEM_TABLE_PRESET, [], {});
    expect(resolved.map((column) => column.id)).toEqual([
      ...PROPOSAL_GENERATED_ITEM_TABLE_PRESET.hideableColumnIds,
      ...PROPOSAL_GENERATED_ITEM_TABLE_PRESET.fixedColumnIds,
      'total',
      'actions',
    ]);
  });

  it('resolves group assignment from preset column groups', () => {
    const ffe = resolveGeneratedItemColumns(FFE_GENERATED_ITEM_TABLE_PRESET, [], {});
    expect(ffe.find((column) => column.id === 'itemIdTag')?.group).toBe('product');
    expect(ffe.find((column) => column.id === 'dimensions')?.group).toBe('specs');
    expect(ffe.find((column) => column.id === 'qty')?.group).toBe('pricing');
    expect(ffe.find((column) => column.id === 'drag')?.group).toBeNull();
  });

  it('resolves sticky designation by table preset', () => {
    const ffe = resolveGeneratedItemColumns(FFE_GENERATED_ITEM_TABLE_PRESET, [], {});
    expect(ffe.find((column) => column.id === 'lineTotal')?.sticky).toBe('edge');
    expect(ffe.find((column) => column.id === 'actions')?.sticky).toBe('edge');
    expect(ffe.find((column) => column.id === 'qty')?.sticky).toBeNull();

    const proposal = resolveGeneratedItemColumns(PROPOSAL_GENERATED_ITEM_TABLE_PRESET, [], {});
    expect(proposal.find((column) => column.id === 'quantity')?.sticky).toBe('value');
    expect(proposal.find((column) => column.id === 'unitCost')?.sticky).toBe('value');
    expect(proposal.find((column) => column.id === 'total')?.sticky).toBe('edge');
    expect(proposal.find((column) => column.id === 'actions')?.sticky).toBe('edge');
  });

  it('omits FF&E empty columns and keeps populated columns', () => {
    const ffe = resolveGeneratedItemColumns(FFE_GENERATED_ITEM_TABLE_PRESET, [baseFfeItem], {});
    expect(ffe.find((column) => column.id === 'description')?.omitWhenEmpty).toBe(true);
    expect(ffe.find((column) => column.id === 'qty')?.omitWhenEmpty).toBe(false);

    const populated = resolveGeneratedItemColumns(
      FFE_GENERATED_ITEM_TABLE_PRESET,
      [{ ...baseFfeItem, description: 'Wood chair' }],
      {},
    );
    expect(populated.find((column) => column.id === 'description')?.omitWhenEmpty).toBe(false);
  });

  it('omits Proposal empty columns and keeps populated columns', () => {
    const proposal = resolveGeneratedItemColumns(
      PROPOSAL_GENERATED_ITEM_TABLE_PRESET,
      [baseProposalItem],
      {},
    );
    expect(proposal.find((column) => column.id === 'description')?.omitWhenEmpty).toBe(true);
    expect(proposal.find((column) => column.id === 'quantity')?.omitWhenEmpty).toBe(false);

    const populated = resolveGeneratedItemColumns(
      PROPOSAL_GENERATED_ITEM_TABLE_PRESET,
      [{ ...baseProposalItem, description: 'Linen sofa' }],
      {},
    );
    expect(populated.find((column) => column.id === 'description')?.omitWhenEmpty).toBe(false);
  });
});
