import { normalizeLabel, type ImportColumn } from './engine';
import { parseFileToRawRows, parseRawRowsToSections } from './parser';
import type { CreateItemInput } from '../api';
import { itemStatuses } from '../../types';

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

export type ParsedFFESpreadsheet = {
  filename: string;
  sheetName: string;
  fileType: 'xlsx' | 'xls' | 'csv';
  columns: ImportColumn[];
  sections: Array<{ title: string; rows: Record<string, string>[] }>;
  warnings: string[];
};

export type ImportedItem = CreateItemInput & { roomName: string | null; materialsRaw: string };

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
    'model no. / description',
    'model no description',
    'model description',
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

export async function parseFFESpreadsheet(file: File): Promise<ParsedFFESpreadsheet> {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  const fileType: ParsedFFESpreadsheet['fileType'] =
    extension === 'xlsx' ? 'xlsx' : extension === 'csv' ? 'csv' : 'xls';

  const { sheetName, rawRows } = await parseFileToRawRows(file);

  const warnings: string[] = [];
  const { columns, sections } = parseRawRowsToSections(rawRows, {
    fallbackTitle: (i) => (i === 0 ? sheetName || 'Sheet 1' : `Section ${i + 1}`),
  });

  if (sections.length === 0) warnings.push('No table header was detected in this file.');

  return { filename: file.name, sheetName, fileType, columns, sections, warnings };
}

// ─── Column auto-mapping ──────────────────────────────────────────────────────

export function autoMapColumns(columns: ImportColumn[]): Partial<ColumnMap> {
  const result: Partial<ColumnMap> = {};

  for (const [field, aliases] of Object.entries(FIELD_ALIASES) as [keyof ColumnMap, string[]][]) {
    const match = columns.find((col) =>
      aliases.some((alias) => normalizeLabel(alias) === normalizeLabel(col.label)),
    );
    if (match) result[field] = match.key;
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

export function transformRow(
  row: Record<string, string>,
  mapping: ColumnMap,
  columns?: ImportColumn[],
  customDataKeyMap?: Map<string, string>,
): ImportedItem | null {
  const get = (field: keyof ColumnMap): string => {
    const col = mapping[field];
    return col ? (row[col] ?? '').trim() : '';
  };

  const itemName = get('itemName');
  if (!itemName) return null;

  const recognizedKeys = new Set(Object.values(mapping).filter(Boolean) as string[]);
  const customData: Record<string, string> = {};
  if (columns) {
    for (const col of columns) {
      if (!recognizedKeys.has(col.key)) {
        const val = (row[col.key] ?? '').trim();
        if (val) {
          const key = customDataKeyMap?.get(col.key) ?? col.label;
          customData[key] = val;
        }
      }
    }
  }

  const unitCostRaw = get('unitCostDollars');
  const qtyRaw = get('qty');
  const statusRaw = get('status');

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
    ...(Object.keys(customData).length > 0 && { customData }),
    roomName: get('room') || null,
    materialsRaw: get('materials'),
  };
}

export function transformRows(
  rows: Record<string, string>[],
  mapping: ColumnMap,
  columns?: ImportColumn[],
  customDataKeyMap?: Map<string, string>,
): ImportedItem[] {
  return rows.flatMap((row) => {
    const result = transformRow(row, mapping, columns, customDataKeyMap);
    return result ? [result] : [];
  });
}
