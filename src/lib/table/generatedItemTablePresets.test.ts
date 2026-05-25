import { describe, expect, it } from 'vitest';
import { PROPOSAL_GENERATED_ITEM_TABLE_PRESET } from './generatedItemTablePresets';

describe('PROPOSAL_GENERATED_ITEM_TABLE_PRESET', () => {
  it('keeps productTag out of hideable columns after left-rail migration', () => {
    expect(PROPOSAL_GENERATED_ITEM_TABLE_PRESET.hideableColumnIds).not.toContain('productTag');
    expect(PROPOSAL_GENERATED_ITEM_TABLE_PRESET.columnMeta).not.toHaveProperty('productTag');
  });
});
