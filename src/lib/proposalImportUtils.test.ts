import { describe, expect, it } from 'vitest';
import {
  PROPOSAL_IMPORT_EMPTY_MAP,
  autoMapProposalColumns,
  imageToFile,
  isSummaryProposalRow,
  rowHasImportableContent,
  type ProposalParsedRow,
} from './proposalImportUtils';

const BASE_ROW: ProposalParsedRow = {
  id: '0:9',
  rowNumber: 9,
  categoryName: 'Millwork',
  values: {},
  imagesByColumn: {},
  images: { rendering: [], plan: [], swatches: [] },
  sourceSectionIndex: 0,
};

describe('imageToFile', () => {
  it('converts image bytes to file without including extra buffer bytes', () => {
    const source = new Uint8Array([255, 216, 255, 224, 1, 2, 3, 4]);
    const sliced = source.subarray(0, 4);

    const file = imageToFile(
      {
        id: 'img-1',
        filename: 'test.jpg',
        contentType: 'image/jpeg',
        bytes: sliced,
        row: 1,
        column: 1,
        rowEnd: 1,
        columnEnd: 1,
      },
      'fallback.jpg',
    );

    expect(file.size).toBe(4);
    expect(file.type).toBe('image/jpeg');
    expect(file.name).toBe('test.jpg');
  });
});

describe('autoMapProposalColumns', () => {
  it('maps proposal aliases from spreadsheet headers', () => {
    const mapping = autoMapProposalColumns([
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

    expect(rowHasImportableContent(row, { ...PROPOSAL_IMPORT_EMPTY_MAP, productTag: 'tag' })).toBe(
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
      rowHasImportableContent(row, { ...PROPOSAL_IMPORT_EMPTY_MAP, rendering: 'rendering' }),
    ).toBe(true);
  });
});

describe('isSummaryProposalRow', () => {
  it('skips subtotal and grand total rows', () => {
    expect(isSummaryProposalRow({ ...BASE_ROW, values: { label: 'TOTAL' } })).toBe(true);
    expect(isSummaryProposalRow({ ...BASE_ROW, values: { label: 'GRAND TOTAL' } })).toBe(true);
  });

  it('keeps normal item rows', () => {
    expect(
      isSummaryProposalRow({ ...BASE_ROW, values: { tag: 'RECEPTION', desc: 'Millwork' } }),
    ).toBe(false);
  });
});
