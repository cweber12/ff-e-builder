import { proposalLineTotalCents, projectTotalCents, roomSubtotalCents } from '../calc';
import type { Project, ProposalCategoryWithItems, ProposalItem, RoomWithItems } from '../../types';
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
): string[][] {
  const targetRooms = filterRoom ? [filterRoom] : rooms;
  const dataRows = targetRooms.flatMap((room) =>
    sortedItems(room).map((item) => [project.name, room.name, ...itemToRow(item)]),
  );
  return [['Project', 'Room', ...TABLE_HEADERS], ...dataRows];
}

export function exportTableCsv(
  project: Project,
  rooms: RoomWithItems[],
  filterRoom?: RoomWithItems,
): void {
  const rows = buildCsvRows(project, rooms, filterRoom);
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

export function exportProposalCsv(project: Project, categories: ProposalCategoryWithItems[]): void {
  const rows = [
    ['Project', 'Category', ...PROPOSAL_CSV_HEADERS],
    ...categories.flatMap((category) =>
      category.items.map((item) => [project.name, category.name, ...proposalItemToRow(item)]),
    ),
  ];
  const csv = rows.map((row) => row.map(csvCell).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  triggerDownload(blob, `${safeName(project.name)}-proposal.csv`);
}
