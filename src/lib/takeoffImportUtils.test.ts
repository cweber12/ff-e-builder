import { describe, expect, it } from 'vitest';
import {
  TAKEOFF_IMPORT_EMPTY_MAP,
  autoMapTakeoffColumns,
  isSummaryTakeoffRow,
  rowHasImportableContent,
  type TakeoffParsedRow,
} from './takeoffImportUtils';

const BASE_ROW: TakeoffParsedRow = {
  id: '0:9',
  rowNumber: 9,
  categoryName: 'Millwork',
  values: {},
  imagesByColumn: {},
  images: { rendering: [], plan: [], swatches: [] },
  sourceSectionIndex: 0,
};

describe('autoMapTakeoffColumns', () => {
  it('maps take-off aliases from spreadsheet headers', () => {
    const mapping = autoMapTakeoffColumns([
      { key: 'rendering__2', label: 'RENDERING', columnNumber: 2 },
      { key: 'tag__3', label: 'PRODUCT TAG', columnNumber: 3 },
      { key: 'plan__4', label: 'PLAN', columnNumber: 4 },
      { key: 'desc__7', label: 'PRODUCT DESCRIPTION', columnNumber: 7 },
      { key: 'qty__11', label: 'QUANTITY', columnNumber: 11 },
      { key: 'cost__12', label: 'UNIT COST', columnNumber: 12 },
    ]);

    expect(mapping.rendering).toBe('rendering__2');
    expect(mapping.productTag).toBe('tag__3');
    expect(mapping.plan).toBe('plan__4');
    expect(mapping.description).toBe('desc__7');
    expect(mapping.quantity).toBe('qty__11');
    expect(mapping.unitCost).toBe('cost__12');
  });
});

describe('rowHasImportableContent', () => {
  it('allows rows with any mapped value', () => {
    const row = {
      ...BASE_ROW,
      values: { tag: 'M-101' },
    };

    expect(rowHasImportableContent(row, { ...TAKEOFF_IMPORT_EMPTY_MAP, productTag: 'tag' })).toBe(
      true,
    );
  });

  it('allows rows with an assigned embedded image even when text is blank', () => {
    const row = {
      ...BASE_ROW,
      imagesByColumn: {
        rendering: [
          {
            id: 'image-1',
            filename: 'rendering.png',
            contentType: 'image/png',
            bytes: new Uint8Array([1]),
            row: 9,
            column: 2,
            rowEnd: 10,
            columnEnd: 3,
          },
        ],
      },
      images: { rendering: [], plan: [], swatches: [] },
    };

    expect(
      rowHasImportableContent(row, { ...TAKEOFF_IMPORT_EMPTY_MAP, rendering: 'rendering' }),
    ).toBe(true);
  });
});

describe('isSummaryTakeoffRow', () => {
  it('skips subtotal and grand total rows', () => {
    expect(isSummaryTakeoffRow({ ...BASE_ROW, values: { label: 'TOTAL' } })).toBe(true);
    expect(isSummaryTakeoffRow({ ...BASE_ROW, values: { label: 'GRAND TOTAL' } })).toBe(true);
  });

  it('keeps normal item rows', () => {
    expect(
      isSummaryTakeoffRow({ ...BASE_ROW, values: { tag: 'RECEPTION', desc: 'Millwork' } }),
    ).toBe(false);
  });
});
