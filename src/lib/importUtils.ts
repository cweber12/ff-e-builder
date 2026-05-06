import * as XLSX from 'xlsx';
import type { CreateItemInput } from './api';
import { itemStatuses } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ColumnMap = {
  itemName: string | null;
  category: string | null;
  itemIdTag: string | null;
  dimensions: string | null;
  qty: string | null;
  unitCostDollars: string | null;
  status: string | null;
  leadTime: string | null;
  notes: string | null;
  room: string | null;
  materials: string | null;
};

export type ParsedSpreadsheet = {
  headers: string[];
  rows: Record<string, string>[];
};

export type ImportedItem = CreateItemInput & { roomName: string | null; materialsRaw: string };

function spreadsheetValueToString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString();
  return '';
}

// ─── Field aliases for auto-mapping ──────────────────────────────────────────

const FIELD_ALIASES: Record<keyof ColumnMap, string[]> = {
  itemName: [
    'item',
    'item name',
    'name',
    'description',
    'item description',
    'product',
    'product name',
    'title',
  ],
  category: ['category', 'type', 'item type', 'product type', 'classification'],
  itemIdTag: [
    'id',
    'item id',
    'tag',
    'item tag',
    'reference',
    'ref',
    'code',
    'item code',
    'item #',
  ],
  dimensions: ['dimensions', 'size', 'dim', 'dims', 'dimension'],
  qty: ['qty', 'quantity', 'units', 'count', 'amount', 'number', 'num', 'unit count'],
  unitCostDollars: [
    'cost',
    'unit cost',
    'price',
    'unit price',
    'list price',
    'net price',
    'cost per unit',
    'cost ($)',
    'price ($)',
    'unit cost ($)',
  ],
  status: ['status', 'order status', 'procurement status', 'state'],
  leadTime: ['lead time', 'delivery', 'delivery time', 'lead', 'lead time (weeks)', 'weeks'],
  notes: ['notes', 'note', 'comments', 'comment', 'description', 'remarks', 'memo'],
  room: ['room', 'space', 'area', 'location', 'zone', 'room name'],
  materials: [
    'material',
    'materials',
    'finish',
    'finishes',
    'swatch',
    'swatches',
    'finish library',
  ],
};

// ─── Parsing ──────────────────────────────────────────────────────────────────

export async function parseExcelFile(file: File): Promise<ParsedSpreadsheet> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return { headers: [], rows: [] };

  const sheet = wb.Sheets[sheetName];
  if (!sheet) return { headers: [], rows: [] };
  const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });

  if (raw.length === 0) return { headers: [], rows: [] };

  const headers = (raw[0] as unknown[]).map((h) => spreadsheetValueToString(h).trim());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < raw.length; i++) {
    const rowArray = raw[i] as unknown[];
    const record: Record<string, string> = {};
    let hasContent = false;
    for (let j = 0; j < headers.length; j++) {
      const header = headers[j];
      if (!header) continue;
      const cell = spreadsheetValueToString(rowArray[j]).trim();
      record[header] = cell;
      if (cell) hasContent = true;
    }
    if (hasContent) rows.push(record);
  }

  return { headers, rows };
}

// ─── Auto-mapping ─────────────────────────────────────────────────────────────

export function autoMapColumns(headers: string[]): Partial<ColumnMap> {
  const normalized = headers.map((h) => h.toLowerCase().trim());
  const result: Partial<ColumnMap> = {};

  for (const [field, aliases] of Object.entries(FIELD_ALIASES) as [keyof ColumnMap, string[]][]) {
    const match = normalized.findIndex((h) => aliases.includes(h));
    if (match !== -1) {
      const header = headers[match];
      if (header !== undefined) result[field] = header;
    }
  }

  return result;
}

// ─── Row transformation ───────────────────────────────────────────────────────

function parseMoneyString(raw: string): number {
  const cleaned = raw.replace(/[$,\s]/g, '');
  const parsed = parseFloat(cleaned);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) : 0;
}

function parseIntString(raw: string): number {
  const parsed = parseInt(raw.replace(/[,\s]/g, ''), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 1;
}

function normalizeStatus(raw: string): (typeof itemStatuses)[number] | null {
  const lower = raw.toLowerCase().trim();
  for (const status of itemStatuses) {
    if (lower === status || lower.startsWith(status)) return status;
  }
  if (lower.includes('order')) return 'ordered';
  if (lower.includes('approv') || lower.includes('confirm')) return 'approved';
  if (lower.includes('receiv') || lower.includes('arriv') || lower.includes('deliver'))
    return 'received';
  return null;
}

export function transformRow(row: Record<string, string>, mapping: ColumnMap): ImportedItem | null {
  const get = (field: keyof ColumnMap): string => {
    const col = mapping[field];
    return col ? (row[col] ?? '').trim() : '';
  };

  const itemName = get('itemName');
  if (!itemName) return null;

  const unitCostRaw = get('unitCostDollars');
  const qtyRaw = get('qty');
  const statusRaw = get('status');
  const roomName = get('room') || null;

  return {
    itemName,
    category: get('category') || null,
    itemIdTag: get('itemIdTag') || null,
    dimensions: get('dimensions') || null,
    qty: qtyRaw ? parseIntString(qtyRaw) : 1,
    unitCostCents: unitCostRaw ? parseMoneyString(unitCostRaw) : 0,
    status: statusRaw ? (normalizeStatus(statusRaw) ?? 'pending') : 'pending',
    leadTime: get('leadTime') || null,
    notes: get('notes') || null,
    roomName,
    materialsRaw: get('materials'),
  };
}

export function transformRows(rows: Record<string, string>[], mapping: ColumnMap): ImportedItem[] {
  return rows.flatMap((row) => {
    const result = transformRow(row, mapping);
    return result ? [result] : [];
  });
}
