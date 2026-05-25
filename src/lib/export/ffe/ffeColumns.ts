import { lineTotalCents } from '../../money';
import type { CustomColumnDef, Item } from '../../../types';
import { fmtMoney } from '../shared';

/**
 * Browser-side column id → export-side column key. The browser table uses
 * `unitCostCents`; the export uses `unitCost`. Most ids map 1:1. Browser-only
 * ids (drag, actions) and export-only ids (category, materials) are absent
 * from this map.
 */
const BROWSER_TO_EXPORT_KEY: Record<string, FfeExportKey | undefined> = {
  itemIdTag: 'itemIdTag',
  itemName: 'itemName',
  drawings: 'drawings',
  image: 'image',
  description: 'description',
  dimensions: 'dimensions',
  qty: 'qty',
  unitCostCents: 'unitCost',
  lineTotal: 'lineTotal',
  status: 'status',
  leadTime: 'leadTime',
  notes: 'notes',
  materials: 'materials',
};

export type FfeExportKey =
  | 'image'
  | 'itemIdTag'
  | 'itemName'
  | 'drawings'
  | 'description'
  | 'category'
  | 'dimensions'
  | 'qty'
  | 'unitCost'
  | 'lineTotal'
  | 'status'
  | 'leadTime'
  | 'notes'
  | 'materials';

export type FfeExportColumn = {
  key: string;
  label: string;
  excelWidth: number;
  isImage?: boolean;
  isNumeric?: boolean;
  isCustom?: boolean;
  value: (item: Item) => string;
};

const FFE_DEFAULT_EXPORT_COLUMNS: FfeExportColumn[] = [
  { key: 'image', label: 'Image', excelWidth: 16, isImage: true, value: () => '' },
  { key: 'itemIdTag', label: 'Item ID', excelWidth: 14, value: (i) => i.itemIdTag ?? '' },
  { key: 'itemName', label: 'Item Name', excelWidth: 24, value: (i) => i.itemName },
  { key: 'drawings', label: 'Drawings', excelWidth: 16, value: (i) => i.drawings ?? '' },
  { key: 'description', label: 'Description', excelWidth: 24, value: (i) => i.description ?? '' },
  { key: 'category', label: 'Category', excelWidth: 16, value: (i) => i.category ?? '' },
  { key: 'dimensions', label: 'Dimensions', excelWidth: 16, value: (i) => i.dimensions ?? '' },
  { key: 'qty', label: 'Qty', excelWidth: 8, isNumeric: true, value: (i) => String(i.qty) },
  {
    key: 'unitCost',
    label: 'Unit Cost',
    excelWidth: 13,
    isNumeric: true,
    value: (i) => fmtMoney(i.unitCostCents),
  },
  {
    key: 'lineTotal',
    label: 'Line Total',
    excelWidth: 13,
    isNumeric: true,
    value: (i) => fmtMoney(lineTotalCents(i.unitCostCents, i.qty)),
  },
  { key: 'status', label: 'Status', excelWidth: 14, value: (i) => i.status },
  { key: 'leadTime', label: 'Lead Time', excelWidth: 12, value: (i) => i.leadTime ?? '' },
  { key: 'notes', label: 'Notes', excelWidth: 24, value: (i) => i.notes ?? '' },
  {
    key: 'materials',
    label: 'Materials',
    excelWidth: 24,
    value: (i) =>
      i.materials.map((m) => (m.materialId ? `${m.name} (${m.materialId})` : m.name)).join('; '),
  },
];

/**
 * Build the ordered export-column list for an FFE export, honoring the user's
 * active table column order/visibility from `useColumnConfig`. When no order
 * is given, falls back to the default order plus active custom columns.
 *
 * Browser-only ids (drag, actions) are skipped automatically.
 */
export function buildFfeExportColumns(
  items: readonly Item[],
  customColumnDefs: readonly CustomColumnDef[],
  visibleColumnOrder?: readonly string[],
): FfeExportColumn[] {
  const defaultsByKey = new Map(FFE_DEFAULT_EXPORT_COLUMNS.map((c) => [c.key, c]));
  const customColumns: FfeExportColumn[] = customColumnDefs
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .filter((def) => items.some((item) => (item.customData[def.id] ?? '').trim() !== ''))
    .map((def) => ({
      key: def.id,
      label: def.label,
      excelWidth: 18,
      isCustom: true,
      value: (item) => item.customData[def.id] ?? '',
    }));
  const customByKey = new Map(customColumns.map((c) => [c.key, c]));

  if (!visibleColumnOrder || visibleColumnOrder.length === 0) {
    return [...FFE_DEFAULT_EXPORT_COLUMNS, ...customColumns];
  }

  const seen = new Set<string>();
  const ordered: FfeExportColumn[] = [];
  for (const browserId of visibleColumnOrder) {
    const key = BROWSER_TO_EXPORT_KEY[browserId] ?? browserId;
    if (seen.has(key)) continue;
    seen.add(key);
    const def = defaultsByKey.get(key);
    if (def) {
      ordered.push(def);
      continue;
    }
    const custom = customByKey.get(key);
    if (custom) ordered.push(custom);
  }
  return ordered;
}
