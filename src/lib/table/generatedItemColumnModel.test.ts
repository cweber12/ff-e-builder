import { describe, expect, it } from 'vitest';
import {
  FFE_GENERATED_ITEM_TABLE_PRESET,
  PROPOSAL_GENERATED_ITEM_TABLE_PRESET,
} from './generatedItemTablePresets';
import { resolveGeneratedItemColumns } from './generatedItemColumnModel';

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

  it('sets omitWhenEmpty flags for hideable empty-state columns', () => {
    const ffe = resolveGeneratedItemColumns(FFE_GENERATED_ITEM_TABLE_PRESET, [], {});
    expect(ffe.find((column) => column.id === 'description')?.omitWhenEmpty).toBe(true);
    expect(ffe.find((column) => column.id === 'qty')?.omitWhenEmpty).toBe(false);

    const proposal = resolveGeneratedItemColumns(PROPOSAL_GENERATED_ITEM_TABLE_PRESET, [], {});
    expect(proposal.find((column) => column.id === 'description')?.omitWhenEmpty).toBe(true);
    expect(proposal.find((column) => column.id === 'quantity')?.omitWhenEmpty).toBe(false);
  });
});
