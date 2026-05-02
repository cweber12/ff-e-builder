import { describe, expect, it } from 'vitest';
import { autoMapColumns, transformRow, transformRows } from './importUtils';
import type { ColumnMap } from './importUtils';

// ─── autoMapColumns ───────────────────────────────────────────────────────────

describe('autoMapColumns', () => {
  it('maps exact field names', () => {
    const result = autoMapColumns(['item name', 'category', 'vendor', 'qty', 'notes']);
    expect(result.itemName).toBe('item name');
    expect(result.category).toBe('category');
    expect(result.vendor).toBe('vendor');
    expect(result.qty).toBe('qty');
    expect(result.notes).toBe('notes');
  });

  it('maps common aliases', () => {
    const result = autoMapColumns(['name', 'type', 'manufacturer', 'units', 'comments']);
    expect(result.itemName).toBe('name');
    expect(result.category).toBe('type');
    expect(result.vendor).toBe('manufacturer');
    expect(result.qty).toBe('units');
    expect(result.notes).toBe('comments');
  });

  it('maps cost column', () => {
    const result = autoMapColumns(['cost', 'quantity', 'room']);
    expect(result.unitCostDollars).toBe('cost');
    expect(result.qty).toBe('quantity');
    expect(result.room).toBe('room');
  });

  it('maps markup column', () => {
    const result = autoMapColumns(['markup %', 'lead time']);
    expect(result.markupPct).toBe('markup %');
    expect(result.leadTime).toBe('lead time');
  });

  it('returns empty partial for unrecognized columns', () => {
    const result = autoMapColumns(['foo', 'bar', 'baz']);
    expect(Object.keys(result)).toHaveLength(0);
  });

  it('is case insensitive', () => {
    const result = autoMapColumns(['ITEM NAME', 'Category', 'VENDOR']);
    expect(result.itemName).toBe('ITEM NAME');
    expect(result.category).toBe('Category');
    expect(result.vendor).toBe('VENDOR');
  });

  it('maps room column', () => {
    const result = autoMapColumns(['item name', 'room', 'space']);
    expect(result.room).toBe('room');
  });
});

// ─── transformRow ─────────────────────────────────────────────────────────────

const FULL_MAP: ColumnMap = {
  itemName: 'Item',
  category: 'Category',
  vendor: 'Vendor',
  model: 'Model',
  itemIdTag: 'ID',
  dimensions: 'Dimensions',
  qty: 'Qty',
  unitCostDollars: 'Cost',
  markupPct: 'Markup',
  status: 'Status',
  leadTime: 'Lead',
  notes: 'Notes',
  room: 'Room',
};

describe('transformRow', () => {
  it('maps all fields correctly', () => {
    const row = {
      Item: 'Lounge Sofa',
      Category: 'Seating',
      Vendor: 'Herman Miller',
      Model: 'Striad',
      ID: 'LR-001',
      Dimensions: '96"W',
      Qty: '2',
      Cost: '$3,200.00',
      Markup: '30',
      Status: 'approved',
      Lead: '12 weeks',
      Notes: 'COM fabric',
      Room: 'Living Room',
    };
    const result = transformRow(row, FULL_MAP);
    expect(result).not.toBeNull();
    expect(result!.itemName).toBe('Lounge Sofa');
    expect(result!.category).toBe('Seating');
    expect(result!.vendor).toBe('Herman Miller');
    expect(result!.unitCostCents).toBe(320000);
    expect(result!.markupPct).toBe(30);
    expect(result!.qty).toBe(2);
    expect(result!.status).toBe('approved');
    expect(result!.roomName).toBe('Living Room');
  });

  it('returns null when itemName is empty', () => {
    const row = { Item: '', Category: 'Seating' };
    expect(transformRow(row, FULL_MAP)).toBeNull();
  });

  it('defaults status to pending for unrecognized status', () => {
    const row = { Item: 'Chair', Status: 'unknown_status' };
    const result = transformRow(row, FULL_MAP);
    expect(result!.status).toBe('pending');
  });

  it('normalizes status aliases', () => {
    const cases: [string, string][] = [
      ['ordered', 'ordered'],
      ['On Order', 'ordered'],
      ['approved by client', 'approved'],
      ['received/arrived', 'received'],
    ];
    for (const [input, expected] of cases) {
      const row = { Item: 'Chair', Status: input };
      expect(transformRow(row, FULL_MAP)!.status).toBe(expected);
    }
  });

  it('parses dollar amounts with symbols and commas', () => {
    const row = { Item: 'Chair', Cost: '$1,250.50' };
    const result = transformRow(row, FULL_MAP);
    expect(result!.unitCostCents).toBe(125050);
  });

  it('handles plain number cost', () => {
    const row = { Item: 'Chair', Cost: '500' };
    expect(transformRow(row, FULL_MAP)!.unitCostCents).toBe(50000);
  });

  it('defaults qty to 1 when not provided', () => {
    const row = { Item: 'Chair' };
    expect(transformRow(row, FULL_MAP)!.qty).toBe(1);
  });

  it('sets null for skipped optional fields', () => {
    const map: ColumnMap = { ...FULL_MAP, category: null, vendor: null };
    const row = { Item: 'Chair' };
    const result = transformRow(row, map);
    expect(result!.category).toBeNull();
    expect(result!.vendor).toBeNull();
  });

  it('sets roomName to null when room column not mapped', () => {
    const map: ColumnMap = { ...FULL_MAP, room: null };
    const row = { Item: 'Chair' };
    expect(transformRow(row, map)!.roomName).toBeNull();
  });
});

// ─── transformRows ────────────────────────────────────────────────────────────

describe('transformRows', () => {
  it('filters out rows with no item name', () => {
    const rows = [
      { Item: 'Chair', Category: 'Seating' },
      { Item: '', Category: 'Tables' },
      { Item: 'Table', Category: 'Tables' },
    ];
    const result = transformRows(rows, FULL_MAP);
    expect(result).toHaveLength(2);
    expect(result[0]!.itemName).toBe('Chair');
    expect(result[1]!.itemName).toBe('Table');
  });

  it('returns empty array for empty input', () => {
    expect(transformRows([], FULL_MAP)).toHaveLength(0);
  });
});
