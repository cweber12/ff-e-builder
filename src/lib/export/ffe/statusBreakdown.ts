import { lineTotalCents } from '../../money';
import type { Item } from '../../../types';

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
