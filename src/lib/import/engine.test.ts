import { describe, expect, it } from 'vitest';
import {
  buildColumns,
  columnsToRecord,
  detectTable,
  detectTableHeader,
  extractTableRows,
  findRepeatHeaderIndices,
  findSectionTitle,
  isSummaryRow,
  isRepeatHeader,
  normalizeLabel,
} from './engine';

// ─── normalizeLabel ───────────────────────────────────────────────────────────

describe('normalizeLabel', () => {
  it('lowercases and trims', () => {
    expect(normalizeLabel('  Item Name  ')).toBe('item name');
  });

  it('replaces & with and', () => {
    expect(normalizeLabel('Drawings & Location')).toBe('drawings and location');
  });

  it('collapses non-alphanumeric runs to spaces', () => {
    expect(normalizeLabel('Unit Cost ($)')).toBe('unit cost');
    expect(normalizeLabel('Lead Time (Weeks)')).toBe('lead time weeks');
  });

  it('returns empty string for blank input', () => {
    expect(normalizeLabel('')).toBe('');
    expect(normalizeLabel('   ')).toBe('');
  });
});

// ─── isSummaryRow ─────────────────────────────────────────────────────────────

describe('isSummaryRow', () => {
  it('detects total rows', () => {
    expect(isSummaryRow(['Total', '', '4500'])).toBe(true);
    expect(isSummaryRow(['Grand Total', '', '9000'])).toBe(true);
    expect(isSummaryRow(['All Total', '', '100'])).toBe(true);
  });

  it('detects financial line items', () => {
    expect(isSummaryRow(['Shipping', '', '250'])).toBe(true);
    expect(isSummaryRow(['Sales Tax', '', '320'])).toBe(true);
    expect(isSummaryRow(['Duty', '', '80'])).toBe(true);
    expect(isSummaryRow(['Assembly', '', '500'])).toBe(true);
    expect(isSummaryRow(['Installation', '', '400'])).toBe(true);
  });

  it('does not flag normal data rows', () => {
    expect(isSummaryRow(['Lounge Chair', 'Seating', '2', '1200'])).toBe(false);
    expect(isSummaryRow(['Desk', 'Office', '1', '800'])).toBe(false);
  });

  it('returns false for empty rows', () => {
    expect(isSummaryRow([])).toBe(false);
    expect(isSummaryRow(['', '', ''])).toBe(false);
  });
});

// ─── buildColumns ─────────────────────────────────────────────────────────────

describe('buildColumns', () => {
  it('builds columns with 1-based columnNumber', () => {
    const cols = buildColumns(['Item', 'Qty', 'Cost']);
    expect(cols).toHaveLength(3);
    expect(cols[0]).toMatchObject({ label: 'Item', columnNumber: 1 });
    expect(cols[1]).toMatchObject({ label: 'Qty', columnNumber: 2 });
    expect(cols[2]).toMatchObject({ label: 'Cost', columnNumber: 3 });
  });

  it('skips empty header cells', () => {
    const cols = buildColumns(['Item', '', 'Cost']);
    expect(cols).toHaveLength(2);
    expect(cols[0]!.columnNumber).toBe(1);
    expect(cols[1]!.columnNumber).toBe(3);
  });

  it('deduplicates identical labels', () => {
    const cols = buildColumns(['Description', 'Description', 'Description']);
    expect(cols).toHaveLength(3);
    expect(cols[0]!.label).toBe('Description');
    expect(cols[1]!.label).toBe('Description (2)');
    expect(cols[2]!.label).toBe('Description (3)');
  });

  it('produces unique keys that include column position', () => {
    const cols = buildColumns(['Item', 'Qty']);
    expect(cols[0]!.key).toBe('Item__1');
    expect(cols[1]!.key).toBe('Qty__2');
  });
});

// ─── columnsToRecord ──────────────────────────────────────────────────────────

describe('columnsToRecord', () => {
  it('maps values by 1-based columnNumber', () => {
    const cols = buildColumns(['Item', 'Qty', 'Cost']);
    const record = columnsToRecord(cols, ['Chair', '2', '1200']);
    expect(record['Item__1']).toBe('Chair');
    expect(record['Qty__2']).toBe('2');
    expect(record['Cost__3']).toBe('1200');
  });

  it('trims cell values', () => {
    const cols = buildColumns(['Item']);
    const record = columnsToRecord(cols, ['  Sofa  ']);
    expect(record['Item__1']).toBe('Sofa');
  });

  it('returns empty string for missing cells', () => {
    const cols = buildColumns(['Item', 'Qty']);
    const record = columnsToRecord(cols, ['Chair']);
    expect(record['Qty__2']).toBe('');
  });
});

// ─── detectTableHeader ────────────────────────────────────────────────────────

describe('detectTableHeader', () => {
  it('detects header at row 0', () => {
    const rows = [
      ['Item', 'Qty', 'Cost', 'Description'],
      ['Chair', '2', '1200', 'Lounge chair'],
      ['Table', '1', '800', 'Dining table'],
    ];
    expect(detectTableHeader(rows)).toBe(0);
  });

  it('skips single-cell title rows and finds header further down', () => {
    const rows = [
      ['Acme Furniture — 2024 Product List'],
      [''],
      ['Item', 'Qty', 'Cost', 'Description'],
      ['Chair', '2', '1200', 'Lounge chair'],
      ['Table', '1', '800', 'Dining table'],
    ];
    expect(detectTableHeader(rows)).toBe(2);
  });

  it('skips two-cell key-value metadata rows and finds the real header', () => {
    const rows = [
      ['Project Name', 'Spring Hotel FF&E'],
      ['Client', 'Acme Corp'],
      ['Date', '2024-01-15'],
      ['Item Name', 'Category', 'Qty', 'Unit Cost', 'Notes'],
      ['Sofa', 'Seating', '4', '2500', 'COM fabric'],
      ['Desk', 'Office', '10', '900', ''],
    ];
    expect(detectTableHeader(rows)).toBe(3);
  });

  it('returns null when no header row exists', () => {
    const rows = [
      ['1200', '3', '4500'],
      ['800', '2', '1600'],
      ['500', '1', '500'],
    ];
    expect(detectTableHeader(rows)).toBeNull();
  });

  it('returns null for empty input', () => {
    expect(detectTableHeader([])).toBeNull();
  });

  it('returns null when all data is numbers (no label-like row)', () => {
    const rows = [
      ['100', '200', '300'],
      ['400', '500', '600'],
    ];
    expect(detectTableHeader(rows)).toBeNull();
  });

  it('respects scanLimit', () => {
    const rows = [
      ['title only'],
      ['title only'],
      ['title only'],
      ['Item', 'Qty', 'Cost', 'Description'],
      ['Chair', '2', '1200', 'note'],
    ];
    expect(detectTableHeader(rows, 2)).toBeNull();
    expect(detectTableHeader(rows, 5)).toBe(3);
  });

  it('excludes skipColumns from the qualifying-cell count', () => {
    // Row 0 is the real header; cols 0 and 3 are image-only columns with no text.
    // With skipColumns={0,3} the remaining 5 text cells still qualify.
    const rows = [
      ['', 'ID', 'Manufacturer', 'IMAGE', 'Type', 'Description', 'Location'],
      ['', 'PL-1', 'Herman Miller', '', 'Chair', 'Aeron', 'Office'],
      ['', 'PL-2', 'Knoll', '', 'Table', 'Saarinen', 'Dining'],
    ];
    expect(detectTableHeader(rows, 25, new Set([0, 3]))).toBe(0);
  });

  it('requires the next row to be non-empty', () => {
    const rows = [
      ['Item', 'Qty', 'Cost', 'Description'],
      // no next row
    ];
    expect(detectTableHeader(rows)).toBeNull();
  });
});

// ─── extractTableRows ─────────────────────────────────────────────────────────

describe('extractTableRows', () => {
  it('skips empty rows rather than stopping at them', () => {
    const rows = [
      ['Chair', '2', '1200'],
      ['Table', '1', '800'],
      ['', '', ''],
      ['Lamp', '4', '200'],
    ];
    const result = extractTableRows(rows, 0);
    expect(result).toHaveLength(3);
    expect(result[0]![0]).toBe('Chair');
    expect(result[1]![0]).toBe('Table');
    expect(result[2]![0]).toBe('Lamp');
  });

  it('stops at a summary row', () => {
    const rows = [
      ['Chair', '2', '1200'],
      ['Table', '1', '800'],
      ['Total', '', '2000'],
      ['Lamp', '4', '200'],
    ];
    const result = extractTableRows(rows, 0);
    expect(result).toHaveLength(2);
  });

  it('returns empty array when start index is at end', () => {
    const rows = [['Chair', '2']];
    expect(extractTableRows(rows, 1)).toHaveLength(0);
  });

  it('returns all rows when no stop condition is met', () => {
    const rows = [
      ['Chair', '2', '1200'],
      ['Table', '1', '800'],
      ['Lamp', '4', '200'],
    ];
    expect(extractTableRows(rows, 0)).toHaveLength(3);
  });

  it('starts from the given index', () => {
    const rows = [['header row — skip'], ['Chair', '2', '1200'], ['Table', '1', '800']];
    const result = extractTableRows(rows, 1);
    expect(result).toHaveLength(2);
    expect(result[0]![0]).toBe('Chair');
  });

  it('respects stopIndex and does not read past it', () => {
    const rows = [
      ['Chair', '2', '1200'],
      ['Table', '1', '800'],
      ['Lamp', '4', '200'],
    ];
    const result = extractTableRows(rows, 0, 2);
    expect(result).toHaveLength(2);
    expect(result[1]![0]).toBe('Table');
  });
});

// ─── findSectionTitle ─────────────────────────────────────────────────────────

describe('findSectionTitle', () => {
  it('returns the single-cell row immediately above the header', () => {
    const rows = [
      ['Master Bedroom'],
      ['Item', 'Qty', 'Cost', 'Description'],
      ['Chair', '2', '1200', ''],
    ];
    expect(findSectionTitle(rows, 1)).toBe('Master Bedroom');
  });

  it('returns the single-cell row up to 4 rows above', () => {
    const rows = [
      ['Living Room'],
      [''],
      [''],
      [''],
      ['Item', 'Qty', 'Cost', 'Description'],
      ['Sofa', '1', '3000', ''],
    ];
    expect(findSectionTitle(rows, 4)).toBe('Living Room');
  });

  it('returns empty string when no single-cell row is found', () => {
    const rows = [
      ['Project Name', 'Spring Hotel'],
      ['Item', 'Qty', 'Cost', 'Description'],
    ];
    expect(findSectionTitle(rows, 1)).toBe('');
  });

  it('returns empty string when header is at row 0', () => {
    const rows = [
      ['Item', 'Qty', 'Cost', 'Description'],
      ['Chair', '2', '1200', ''],
    ];
    expect(findSectionTitle(rows, 0)).toBe('');
  });

  it('ignores rows more than 4 rows above', () => {
    const rows = [['Too Far Away'], [''], [''], [''], [''], ['Item', 'Qty', 'Cost', 'Description']];
    expect(findSectionTitle(rows, 5)).toBe('');
  });
});

// ─── findRepeatHeaderIndices / isRepeatHeader ─────────────────────────────────

describe('findRepeatHeaderIndices', () => {
  const aliases = ['item name', 'qty', 'cost', 'description'];

  it('finds a single repeat header row', () => {
    const rows = [
      ['Chair', '2', '1200', 'Lounge'],
      ['Item Name', 'Qty', 'Cost', 'Description'],
      ['Table', '1', '800', 'Dining'],
    ];
    expect(findRepeatHeaderIndices(rows, 0, aliases)).toEqual([1]);
  });

  it('finds multiple repeat header rows', () => {
    const rows = [
      ['Chair', '2', '1200', 'Lounge'],
      ['Item Name', 'Qty', 'Cost', 'Description'],
      ['Table', '1', '800', 'Dining'],
      ['Item Name', 'Qty', 'Cost', 'Description'],
      ['Lamp', '4', '200', 'Task'],
    ];
    expect(findRepeatHeaderIndices(rows, 0, aliases)).toEqual([1, 3]);
  });

  it('respects startIndex', () => {
    const rows = [
      ['Item Name', 'Qty', 'Cost', 'Description'],
      ['Chair', '2', '1200', 'Lounge'],
      ['Item Name', 'Qty', 'Cost', 'Description'],
    ];
    expect(findRepeatHeaderIndices(rows, 1, aliases)).toEqual([2]);
  });

  it('returns empty array when no repeat headers exist', () => {
    const rows = [
      ['Chair', '2', '1200', 'Lounge'],
      ['Table', '1', '800', 'Dining'],
    ];
    expect(findRepeatHeaderIndices(rows, 0, aliases)).toEqual([]);
  });
});

describe('isRepeatHeader', () => {
  const aliases = ['item name', 'qty', 'cost', 'description'];

  it('returns true when enough cells match aliases', () => {
    expect(isRepeatHeader(['Item Name', 'Qty', 'Cost', 'Description'], aliases)).toBe(true);
  });

  it('returns false when too few cells match', () => {
    expect(isRepeatHeader(['Item Name', 'Qty'], aliases)).toBe(false);
  });

  it('is case-insensitive via normalizeLabel', () => {
    expect(isRepeatHeader(['ITEM NAME', 'QTY', 'COST', 'DESCRIPTION'], aliases)).toBe(true);
  });
});

// ─── detectTable ─────────────────────────────────────────────────────────────

describe('detectTable', () => {
  it('returns full table with columns and records', () => {
    const rows = [
      ['Item', 'Qty', 'Cost'],
      ['Chair', '2', '1200'],
      ['Table', '1', '800'],
    ];
    const result = detectTable(rows);
    expect(result).not.toBeNull();
    expect(result!.headerRowIndex).toBe(0);
    expect(result!.columns).toHaveLength(3);
    expect(result!.rows).toHaveLength(2);
    expect(result!.rows[0]!['Item__1']).toBe('Chair');
    expect(result!.rows[1]!['Item__1']).toBe('Table');
  });

  it('skips title rows before the header', () => {
    const rows = [
      ['Acme Product Catalog'],
      ['Item', 'Qty', 'Cost', 'Notes'],
      ['Chair', '2', '1200', ''],
    ];
    const result = detectTable(rows);
    expect(result!.headerRowIndex).toBe(1);
    expect(result!.rows).toHaveLength(1);
    expect(result!.rows[0]!['Item__1']).toBe('Chair');
  });

  it('returns null when no header is detectable', () => {
    expect(
      detectTable([
        ['100', '200'],
        ['300', '400'],
      ]),
    ).toBeNull();
    expect(detectTable([])).toBeNull();
  });

  it('skips empty rows within data', () => {
    const rows = [
      ['Item', 'Qty', 'Cost'],
      ['Chair', '2', '1200'],
      ['', '', ''],
      ['Lamp', '4', '200'],
    ];
    const result = detectTable(rows);
    expect(result!.rows).toHaveLength(2);
  });

  it('stops data extraction at summary row', () => {
    const rows = [
      ['Item', 'Qty', 'Cost'],
      ['Chair', '2', '1200'],
      ['Total', '', '1200'],
    ];
    const result = detectTable(rows);
    expect(result!.rows).toHaveLength(1);
  });
});
