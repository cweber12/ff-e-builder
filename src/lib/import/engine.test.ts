import { describe, expect, it } from 'vitest';
import {
  buildColumns,
  columnsToRecord,
  detectIdColumn,
  detectTable,
  detectTableHeader,
  extractTableRows,
  groupRowsById,
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

  it('skips columns in skipColumns when scoring', () => {
    // Row 0: real header with an IMAGE col (col index 2) that has no data below
    // Row 1: first data row — without skip, IMAGE penalty could make row 1 win
    const rows = [
      ['', 'ID', 'Manufacturer', 'IMAGE', 'Type', 'Description', 'Location'],
      ['', 'PL-1', 'Herman Miller', '', 'Chair', 'Aeron', 'Office'],
      ['', 'PL-2', 'Knoll', '', 'Table', 'Saarinen', 'Dining'],
      ['', 'PL-3', 'Herman Miller', '', 'Sofa', 'Eames', 'Lounge'],
    ];
    // Without skipColumns, IMAGE col (index 3) in row 0 has no data below → possible score dip
    // With skipColumns={3}, row 0 should reliably win
    expect(detectTableHeader(rows, 25, new Set([0, 3]))).toBe(0);
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

// ─── detectIdColumn ───────────────────────────────────────────────────────────

describe('detectIdColumn', () => {
  const cols = buildColumns(['ID', 'Manufacturer', 'Description', 'Location']);
  const dataRows = [
    ['PL-1', 'Herman Miller', 'Aeron Chair', 'Office'],
    ['PL-2', 'Knoll', 'Barcelona Chair', 'Lounge'],
    ['PL-3', 'Vitra', 'Eames Lounge', 'Living Room'],
  ];

  it('finds ID column by alias match', () => {
    expect(detectIdColumn(cols, dataRows)).toBe('ID__1');
  });

  it('alias match is case-insensitive', () => {
    const cols2 = buildColumns(['Item ID', 'Manufacturer']);
    expect(detectIdColumn(cols2, dataRows)).toBe('Item ID__1');
  });

  it('falls back to pattern scan when header alias not found', () => {
    const cols2 = buildColumns(['Reference', 'Make', 'Model']);
    // 'reference' is in the alias list, so this tests that path too
    expect(detectIdColumn(cols2, dataRows)).toBe('Reference__1');
  });

  it('uses pattern scan when alias does not match', () => {
    const cols2 = buildColumns(['Tag No.', 'Make', 'Model']);
    const rows = [
      ['FF-1', 'Knoll', 'Saarinen'],
      ['FF-2', 'Herman Miller', 'Aeron'],
      ['FF-3', 'Vitra', 'Panton'],
      ['FF-4', 'Cassina', 'LC2'],
    ];
    expect(detectIdColumn(cols2, rows)).toBe('Tag No.__1');
  });

  it('returns null when fewer than 3 pattern matches are found', () => {
    const cols2 = buildColumns(['Code', 'Make', 'Model']);
    const sparseRows = [
      ['FF-1', 'Knoll', 'Saarinen'],
      ['not an id', 'Herman Miller', 'Aeron'],
      ['also not', 'Vitra', 'Panton'],
    ];
    expect(detectIdColumn(cols2, sparseRows)).toBeNull();
  });
});

// ─── groupRowsById ────────────────────────────────────────────────────────────

describe('groupRowsById', () => {
  // Columns: 0=ID, 1=Manufacturer, 2=Description, 3=Location
  // idColumnIndex = 0

  it('groups a simple two-item table', () => {
    const rows = [
      ['PL-1', 'Herman Miller', 'Aeron', 'Office'],
      ['PL-2', 'Knoll', 'Barcelona', 'Lounge'],
    ];
    const grouped = groupRowsById(rows, 0, 0);
    expect(grouped).toHaveLength(2);
    expect(grouped[0]!.values[0]).toBe('PL-1');
    expect(grouped[1]!.values[0]).toBe('PL-2');
  });

  it('merges sub-rows into parent with newline separator', () => {
    const rows = [
      ['PL-1', 'Herman Miller', 'Aeron Chair', 'Office'],
      ['', '', 'Task chair, adjustable arms', ''],
      ['', '', 'Lead time: 12 weeks', ''],
      ['PL-2', 'Knoll', 'Barcelona Chair', 'Lounge'],
    ];
    const grouped = groupRowsById(rows, 0, 0);
    expect(grouped).toHaveLength(2);
    expect(grouped[0]!.values[2]).toBe(
      'Aeron Chair\nTask chair, adjustable arms\nLead time: 12 weeks',
    );
    expect(grouped[0]!.rowStart).toBe(1);
    expect(grouped[0]!.rowEnd).toBe(3);
  });

  it('skips empty rows without stopping', () => {
    const rows = [
      ['PL-1', 'Herman Miller', 'Aeron', 'Office'],
      ['', '', '', ''],
      ['', '', '', ''],
      ['PL-2', 'Knoll', 'Barcelona', 'Lounge'],
    ];
    const grouped = groupRowsById(rows, 0, 0);
    expect(grouped).toHaveLength(2);
  });

  it('stops at a summary row', () => {
    const rows = [
      ['PL-1', 'Herman Miller', 'Aeron', 'Office'],
      ['PL-2', 'Knoll', 'Barcelona', 'Lounge'],
      ['Total', '', '', ''],
      ['PL-3', 'Vitra', 'Panton', 'Dining'],
    ];
    const grouped = groupRowsById(rows, 0, 0);
    expect(grouped).toHaveLength(2);
  });

  it('respects stopIndex boundary', () => {
    const rows = [
      ['PL-1', 'Herman Miller', 'Aeron', 'Office'],
      ['PL-2', 'Knoll', 'Barcelona', 'Lounge'],
      ['PL-3', 'Vitra', 'Panton', 'Dining'],
    ];
    const grouped = groupRowsById(rows, 0, 0, 2); // stop before row index 2
    expect(grouped).toHaveLength(2);
    expect(grouped[1]!.values[0]).toBe('PL-2');
  });

  it('discards orphan sub-rows before the first ID', () => {
    const rows = [
      ['', 'orphan sub-row', '', ''],
      ['PL-1', 'Herman Miller', 'Aeron', 'Office'],
    ];
    const grouped = groupRowsById(rows, 0, 0);
    expect(grouped).toHaveLength(1);
    expect(grouped[0]!.values[0]).toBe('PL-1');
  });

  it('returns empty array when no ID rows are found', () => {
    const rows = [
      ['', 'no id', '', ''],
      ['', 'no id', '', ''],
    ];
    expect(groupRowsById(rows, 0, 0)).toHaveLength(0);
  });

  it('uses 1-based row numbers in GroupedRow', () => {
    const rows = [
      ['PL-1', 'Knoll', 'Chair', 'Office'], // startIndex=0 → rowStart=1
      ['', '', 'Sub-row detail', ''], // rowEnd=2
      ['PL-2', 'Vitra', 'Table', 'Dining'], // rowStart=3
    ];
    const grouped = groupRowsById(rows, 0, 0);
    expect(grouped[0]!.rowStart).toBe(1);
    expect(grouped[0]!.rowEnd).toBe(2);
    expect(grouped[1]!.rowStart).toBe(3);
    expect(grouped[1]!.rowEnd).toBe(3);
  });
});
