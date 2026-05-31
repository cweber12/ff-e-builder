import { proposalLineTotalCents, projectTotalCents, roomSubtotalCents } from '../money';
import type {
  CustomColumnDef,
  Project,
  ProposalCategoryWithItems,
  ProposalItem,
  RoomWithItems,
} from '../../types';
import { buildStatusBreakdown } from './ffe/statusBreakdown';
import { csvCell, fmtMoney, safeName, triggerDownload } from './shared';

type ProposalCsvColumn = {
  key: string;
  label: string;
  value: (item: ProposalItem) => string;
};

function proposalDefaultCsvColumns(): ProposalCsvColumn[] {
  return [
    { key: 'rendering', label: 'Rendering', value: () => '' },
    { key: 'productTag', label: 'Product Tag', value: (i) => i.productTag },
    { key: 'plan', label: 'Plan', value: (i) => i.plan },
    {
      key: 'drawingsLocation',
      label: 'Drawings / Location',
      value: (i) => [i.drawings, i.location].filter(Boolean).join(' / '),
    },
    { key: 'description', label: 'Product Description', value: (i) => i.description },
    { key: 'notes', label: 'Notes', value: (i) => i.notes },
    { key: 'size', label: 'Size', value: (i) => i.sizeLabel },
    {
      key: 'swatch',
      label: 'Swatch',
      value: (i) => i.materials.map((m) => m.name).join('; '),
    },
    { key: 'cbm', label: 'CBM', value: (i) => String(i.cbm) },
    { key: 'quantity', label: 'Quantity', value: (i) => String(i.quantity) },
    { key: 'unit', label: 'Unit', value: (i) => i.quantityUnit },
    { key: 'unitCost', label: 'Unit Cost', value: (i) => fmtMoney(i.unitCostCents) },
    { key: 'totalCost', label: 'Total Cost', value: (i) => fmtMoney(proposalLineTotalCents(i)) },
  ];
}

function buildProposalCsvColumns(
  customColumnDefs: CustomColumnDef[],
  columnOrder: string[] | undefined,
): ProposalCsvColumn[] {
  const defaults = proposalDefaultCsvColumns();
  const defaultsByKey = new Map(defaults.map((c) => [c.key, c]));
  const customColumns: ProposalCsvColumn[] = customColumnDefs
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((def) => ({
      key: def.id,
      label: def.label,
      value: (item: ProposalItem) => item.customData[def.id] ?? '',
    }));
  const customByKey = new Map(customColumns.map((c) => [c.key, c]));

  if (!columnOrder || columnOrder.length === 0) {
    return [...defaults, ...customColumns];
  }

  const seen = new Set<string>();
  const ordered: ProposalCsvColumn[] = [];
  for (const browserId of columnOrder) {
    // Browser-side ids 'drawings' / 'location' are merged for export.
    const key =
      browserId === 'drawings' || browserId === 'location' ? 'drawingsLocation' : browserId;
    if (key === 'quantity' || key === 'unitCost') continue; // appended at the end
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
  // Always append the cost block at the end of the standard block.
  for (const key of ['quantity', 'unit', 'unitCost', 'totalCost'] as const) {
    const def = defaultsByKey.get(key);
    if (def && !seen.has(key)) ordered.push(def);
  }
  return ordered;
}

export function exportSummaryCsv(project: Project, rooms: RoomWithItems[]): void {
  const allItems = rooms.flatMap((r) => r.items);
  const total = projectTotalCents(rooms);

  const roomRows = rooms.map((r) => [
    r.name,
    String(r.items.length),
    fmtMoney(roomSubtotalCents(r.items)),
  ]);

  const statusMap = buildStatusBreakdown(allItems);

  const sections: string[][] = [
    ['Summary:', project.name],
    [],
    ['Budget', fmtMoney(project.budgetCents)],
    ['Actual', fmtMoney(total)],
    [],
    ['Rooms', 'Items', 'Subtotal'],
    ...roomRows,
    [],
    ['Status', 'Items', 'Total'],
    ...[...statusMap.entries()].map(([status, { count, total: t }]) => [
      status,
      String(count),
      fmtMoney(t),
    ]),
  ];

  const csv = sections.map((row) => row.map(csvCell).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  triggerDownload(blob, `${safeName(project.name)}-summary.csv`);
}

export function exportProposalCsv(
  project: Project,
  categories: ProposalCategoryWithItems[],
  customColumnDefs: CustomColumnDef[] = [],
  columnOrder?: string[],
): void {
  const columns = buildProposalCsvColumns(customColumnDefs, columnOrder);
  const rows = [
    ['Project', 'Category', ...columns.map((c) => c.label)],
    ...categories.flatMap((category) =>
      category.items.map((item) => [
        project.name,
        category.name,
        ...columns.map((c) => c.value(item)),
      ]),
    ),
  ];
  const csv = rows.map((row) => row.map(csvCell).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  triggerDownload(blob, `${safeName(project.name)}-proposal.csv`);
}
