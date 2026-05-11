import { describe, expect, it } from 'vitest';
import {
  buildColumns,
  columnsToRecord,
  detectTable,
  detectTableHeader,
  extractTableRows,
  isSummaryRow,
  normalizeLabel,
  scanForExactHeaders,
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

  it('skips title rows and finds header further down', () => {
    const rows = [
      ['Acme Furniture — 2024 Product List'],
      [''],
      ['Item', 'Qty', 'Cost', 'Description'],
      ['Chair', '2', '1200', 'Lounge chair'],
      ['Table', '1', '800', 'Dining table'],
    ];
    expect(detectTableHeader(rows)).toBe(2);
  });

  it('skips company header row and finds data header', () => {
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
    // header is at index 3, scanLimit=2 should miss it
    expect(detectTableHeader(rows, 2)).toBeNull();
    expect(detectTableHeader(rows, 5)).toBe(3);
  });
});

// ─── extractTableRows ─────────────────────────────────────────────────────────

describe('extractTableRows', () => {
  it('extracts rows until empty row', () => {
    const rows = [
      ['Chair', '2', '1200'],
      ['Table', '1', '800'],
      ['', '', ''],
      ['Lamp', '4', '200'],
    ];
    const result = extractTableRows(rows, 0);
    expect(result).toHaveLength(2);
    expect(result[0]![0]).toBe('Chair');
    expect(result[1]![0]).toBe('Table');
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
});

// ─── scanForExactHeaders ──────────────────────────────────────────────────────

describe('scanForExactHeaders', () => {
  it('finds all target labels in the correct row', () => {
    const rows = [['Project Info'], ['Product Name', 'Qty', 'Unit Cost'], ['Chair', '2', '1200']];
    const result = scanForExactHeaders(rows, ['Product Name', 'Qty', 'Unit Cost']);
    expect(result).not.toBeNull();
    expect(result!.headerRowIndex).toBe(1);
    expect(result!.missingLabels).toHaveLength(0);
    expect(result!.foundColumns).toHaveLength(3);
  });

  it('is case-insensitive', () => {
    const rows = [
      ['PRODUCT NAME', 'QTY', 'UNIT COST'],
      ['Chair', '2', '1200'],
    ];
    const result = scanForExactHeaders(rows, ['product name', 'qty', 'unit cost']);
    expect(result).not.toBeNull();
    expect(result!.missingLabels).toHaveLength(0);
  });

  it('reports missing labels', () => {
    const rows = [
      ['Product Name', 'Qty'],
      ['Chair', '2'],
    ];
    const result = scanForExactHeaders(rows, ['Product Name', 'Qty', 'Unit Cost']);
    expect(result).not.toBeNull();
    expect(result!.missingLabels).toContain('Unit Cost');
    expect(result!.foundColumns).toHaveLength(2);
  });

  it('returns null for empty input', () => {
    expect(scanForExactHeaders([], ['Item'])).toBeNull();
    expect(scanForExactHeaders([['Item']], [])).toBeNull();
  });

  it('picks the row with the most matches when multiple rows partially match', () => {
    const rows = [
      ['Item', 'Cost'],
      ['Item', 'Cost', 'Qty', 'Description'],
      ['Chair', '1200', '2', 'lounge'],
    ];
    const result = scanForExactHeaders(rows, ['Item', 'Cost', 'Qty', 'Description']);
    expect(result!.headerRowIndex).toBe(1);
  });

  it('assigns correct columnNumbers to found columns', () => {
    const rows = [['', 'Product Name', '', 'Qty']];
    const result = scanForExactHeaders(rows, ['Product Name', 'Qty']);
    expect(result).not.toBeNull();
    const productCol = result!.foundColumns.find((c) => c.label === 'Product Name');
    const qtyCol = result!.foundColumns.find((c) => c.label === 'Qty');
    expect(productCol!.columnNumber).toBe(2);
    expect(qtyCol!.columnNumber).toBe(4);
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

  it('stops data extraction at empty row', () => {
    const rows = [
      ['Item', 'Qty', 'Cost'],
      ['Chair', '2', '1200'],
      ['', '', ''],
      ['Lamp', '4', '200'],
    ];
    const result = detectTable(rows);
    expect(result!.rows).toHaveLength(1);
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
