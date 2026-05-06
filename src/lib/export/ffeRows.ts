import { lineTotalCents } from '../calc';
import type { Item, RoomWithItems } from '../../types';
import { fmtMoney } from './shared';

export const TABLE_HEADERS = [
  'Item ID',
  'Item Name',
  'Category',
  'Dimensions',
  'Qty',
  'Unit Cost',
  'Line Total',
  'Status',
  'Lead Time',
  'Notes',
  'Materials',
];

export function itemToRow(item: Item): string[] {
  const lineTotal = lineTotalCents(item.unitCostCents, item.qty);
  return [
    item.itemIdTag ?? '',
    item.itemName,
    item.category ?? '',
    item.dimensions ?? '',
    String(item.qty),
    fmtMoney(item.unitCostCents),
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
    entry.total += lineTotalCents(item.unitCostCents, item.qty);
    map.set(item.status, entry);
  }
  return map;
}
