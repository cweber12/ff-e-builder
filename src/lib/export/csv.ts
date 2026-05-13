import { proposalLineTotalCents, projectTotalCents, roomSubtotalCents } from '../money';
import type {
  CustomColumnDef,
  Project,
  ProposalCategoryWithItems,
  ProposalItem,
  RoomWithItems,
} from '../../types';
import { TABLE_HEADERS, buildStatusBreakdown, itemToRow, sortedItems } from './ffeRows';
import { csvCell, fmtMoney, safeName, triggerDownload } from './shared';

const PROPOSAL_CSV_HEADERS = [
  'Rendering',
  'Product Tag',
  'Plan',
  'Drawings / Location',
  'Product Description',
  'Size',
  'Swatch',
  'CBM',
  'Quantity',
  'Unit',
  'Unit Cost',
  'Total Cost',
];

function proposalItemToRow(item: ProposalItem): string[] {
  return [
    '',
    item.productTag,
    item.plan,
    [item.drawings, item.location].filter(Boolean).join(' / '),
    item.description,
    item.sizeLabel,
    item.materials.map((m) => m.name).join('; '),
    String(item.cbm),
    String(item.quantity),
    item.quantityUnit,
    fmtMoney(item.unitCostCents),
    fmtMoney(proposalLineTotalCents(item)),
  ];
}

function buildCsvRows(
  project: Project,
  rooms: RoomWithItems[],
  filterRoom?: RoomWithItems,
  customCols: CustomColumnDef[] = [],
): string[][] {
  const targetRooms = filterRoom ? [filterRoom] : rooms;
  const dataRows = targetRooms.flatMap((room) =>
    sortedItems(room).map((item) => [
      project.name,
      room.name,
      ...itemToRow(item),
      ...customCols.map((def) => item.customData[def.id] ?? ''),
    ]),
  );
  return [['Project', 'Room', ...TABLE_HEADERS, ...customCols.map((d) => d.label)], ...dataRows];
}

export function exportTableCsv(
  project: Project,
  rooms: RoomWithItems[],
  filterRoom?: RoomWithItems,
  customColumnDefs: CustomColumnDef[] = [],
): void {
  const allItems = (filterRoom ? [filterRoom] : rooms).flatMap((r) => sortedItems(r));
  const activeCustomCols = customColumnDefs
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .filter((def) => allItems.some((item) => (item.customData[def.id] ?? '').trim() !== ''));
  const rows = buildCsvRows(project, rooms, filterRoom, activeCustomCols);
  const csv = rows.map((row) => row.map(csvCell).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const suffix = filterRoom ? `-${safeName(filterRoom.name)}` : '';
  triggerDownload(blob, `${safeName(project.name)}${suffix}-items.csv`);
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
): void {
  const allItems = categories.flatMap((c) => c.items);
  const activeCustomCols = customColumnDefs
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .filter((def) => allItems.some((item) => (item.customData[def.id] ?? '').trim() !== ''));
  const rows = [
    ['Project', 'Category', ...PROPOSAL_CSV_HEADERS, ...activeCustomCols.map((d) => d.label)],
    ...categories.flatMap((category) =>
      category.items.map((item) => [
        project.name,
        category.name,
        ...proposalItemToRow(item),
        ...activeCustomCols.map((def) => item.customData[def.id] ?? ''),
      ]),
    ),
  ];
  const csv = rows.map((row) => row.map(csvCell).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  triggerDownload(blob, `${safeName(project.name)}-proposal.csv`);
}
