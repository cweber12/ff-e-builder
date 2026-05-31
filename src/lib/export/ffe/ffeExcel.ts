import * as XLSX from 'xlsx';
import { projectTotalCents, roomSubtotalCents } from '../../money';
import type { Project, RoomWithItems } from '../../../types';
import { buildStatusBreakdown } from './statusBreakdown';
import { fmtMoney, safeName } from '../shared';

export function exportSummaryExcel(project: Project, rooms: RoomWithItems[]): void {
  const wb = XLSX.utils.book_new();
  const total = projectTotalCents(rooms);
  const allItems = rooms.flatMap((r) => r.items);

  const budgetWs = XLSX.utils.aoa_to_sheet([
    ['Project', project.name],
    ['Budget', fmtMoney(project.budgetCents)],
    ['Actual', fmtMoney(total)],
  ]);
  XLSX.utils.book_append_sheet(wb, budgetWs, 'Budget');

  const roomRows = rooms.map((r) => [r.name, r.items.length, fmtMoney(roomSubtotalCents(r.items))]);
  const roomsWs = XLSX.utils.aoa_to_sheet([['Room', 'Items', 'Subtotal'], ...roomRows]);
  XLSX.utils.book_append_sheet(wb, roomsWs, 'Rooms');

  const statusMap = buildStatusBreakdown(allItems);
  const statusRows = [...statusMap.entries()].map(([status, { count, total: t }]) => [
    status,
    count,
    fmtMoney(t),
  ]);
  const statusWs = XLSX.utils.aoa_to_sheet([['Status', 'Items', 'Total'], ...statusRows]);
  XLSX.utils.book_append_sheet(wb, statusWs, 'Status');

  XLSX.writeFile(wb, `${safeName(project.name)}-summary.xlsx`);
}
