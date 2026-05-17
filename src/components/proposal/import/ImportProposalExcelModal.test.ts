import { describe, expect, it } from 'vitest';
import { buildProposalItem, isComputedProposalTotalColumn } from './ImportProposalExcelModal';
import type {
  ProposalImportColumn,
  ProposalImportColumnMap,
  ProposalParsedRow,
} from '../../../lib/import';

const BASE_ROW: ProposalParsedRow = {
  id: '0:9',
  rowNumber: 9,
  categoryName: 'Millwork',
  values: {},
  imagesByColumn: {},
  images: { rendering: [], plan: [], swatches: [] },
  sourceSectionIndex: 0,
};

const EMPTY_MAP: ProposalImportColumnMap = {
  category: null,
  rendering: null,
  productTag: null,
  itemName: null,
  plan: null,
  drawings: null,
  location: null,
  description: null,
  notes: null,
  sizeLabel: null,
  swatches: null,
  cbm: null,
  quantity: null,
  quantityUnit: null,
  unitCost: null,
};

describe('isComputedProposalTotalColumn', () => {
  it('detects computed total labels that should not become custom columns', () => {
    expect(isComputedProposalTotalColumn('TOTAL COST')).toBe(true);
    expect(isComputedProposalTotalColumn('Total')).toBe(true);
    expect(isComputedProposalTotalColumn('Line Total')).toBe(true);
  });
});

describe('buildProposalItem', () => {
  it('omits computed total columns from custom data', () => {
    const columns: ProposalImportColumn[] = [
      { key: 'product_tag__2', label: 'ID', columnNumber: 2 },
      { key: 'total_cost__11', label: 'TOTAL COST', columnNumber: 11 },
      { key: 'vendor__12', label: 'Vendor', columnNumber: 12 },
    ];
    const row: ProposalParsedRow = {
      ...BASE_ROW,
      values: {
        product_tag__2: 'M1',
        total_cost__11: '4700',
        vendor__12: 'Millworker',
      },
    };

    const item = buildProposalItem(
      row,
      { ...EMPTY_MAP, productTag: 'product_tag__2' },
      columns,
      new Map([['vendor__12', 'vendor-def-id']]),
    );

    expect(item.customData).toEqual({ 'vendor-def-id': 'Millworker' });
  });
});
