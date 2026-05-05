import { lineTotalCents, sellPriceCents } from '../calc';
import type { Item, RoomWithItems } from '../../types';
import { fmtMoney, fmtPct } from './shared';

export const TABLE_HEADERS = [
  'Item ID',
  'Item Name',
  'Category',
  'Vendor',
  'Model',
  'Dimensions',
  'Qty',
  'Unit Cost',
  'Markup',
  'Sell Price',
  'Line Total',
  'Status',
  'Lead Time',
  'Notes',
  'Materials',
];

export function itemToRow(item: Item): string[] {
  const sellPrice = sellPriceCents(item.unitCostCents, item.markupPct);
  const lineTotal = sellPrice * item.qty;
  return [
    item.itemIdTag ?? '',
    item.itemName,
    item.category ?? '',
    item.vendor ?? '',
    item.model ?? '',
    item.dimensions ?? '',
    String(item.qty),
    fmtMoney(item.unitCostCents),
    fmtPct(item.markupPct),
    fmtMoney(sellPrice),
    fmtMoney(lineTotal),
    item.status,
    item.leadTime ?? '',
    item.notes ?? '',
    item.materials.map((m) => (m.materialId ? `${m.name} (${m.materialId})` : m.name)).join('; '),
  ];
}

export function sortedItems(room: RoomWithItems): Item[] {
  return [...room.items].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.itemName.localeCompare(b.itemName),
  );
}

export function buildStatusBreakdown(items: Item[]): Map<string, { count: number; total: number }> {
  const map = new Map<string, { count: number; total: number }>();
  for (const item of items) {
    const entry = map.get(item.status) ?? { count: 0, total: 0 };
    entry.count += 1;
    entry.total += lineTotalCents(item.unitCostCents, item.markupPct, item.qty);
    map.set(item.status, entry);
  }
  return map;
}

export function buildVendorBreakdown(items: Item[]): Map<string, { count: number; total: number }> {
  const map = new Map<string, { count: number; total: number }>();
  for (const item of items) {
    const vendor = item.vendor?.trim() || 'Unassigned';
    const entry = map.get(vendor) ?? { count: 0, total: 0 };
    entry.count += 1;
    entry.total += lineTotalCents(item.unitCostCents, item.markupPct, item.qty);
    map.set(vendor, entry);
  }
  return map;
}
