import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { projectTotalCents, roomSubtotalCents } from '../../money';
import { BRAND_RGB } from '../../constants';
import type { Project, RoomWithItems } from '../../../types';
import { buildStatusBreakdown } from './statusBreakdown';
import { fmtMoney, safeName } from '../shared';

const BRAND = BRAND_RGB;

export function exportSummaryPdf(project: Project, rooms: RoomWithItems[]): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const total = projectTotalCents(rooms);
  const allItems = rooms.flatMap((r) => r.items);
  let y = 14;

  doc.setFontSize(14);
  doc.setTextColor(BRAND[0], BRAND[1], BRAND[2]);
  doc.text(project.name, 14, y);
  y += 7;
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text('Summary', 14, y);
  y += 10;

  const brandFill = [...BRAND] as [number, number, number];
  const brandText = [...BRAND] as [number, number, number];

  autoTable(doc, {
    startY: y,
    head: [['', '']],
    body: [
      ['Budget', fmtMoney(project.budgetCents)],
      ['Actual', fmtMoney(total)],
      [
        'Variance',
        fmtMoney(Math.abs(project.budgetCents - total)) +
          (total > project.budgetCents ? ' over' : ' under'),
      ],
    ],
    headStyles: { fillColor: brandFill },
    showHead: false,
    theme: 'striped',
    margin: { left: 14 },
    tableWidth: 80,
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  autoTable(doc, {
    startY: y,
    head: [['Room', 'Items', 'Subtotal']],
    body: [
      ...rooms.map((r) => [r.name, String(r.items.length), fmtMoney(roomSubtotalCents(r.items))]),
      [
        { content: 'Grand total', colSpan: 2, styles: { fontStyle: 'bold' as const } },
        { content: fmtMoney(total), styles: { fontStyle: 'bold' as const, textColor: brandText } },
      ],
    ],
    headStyles: { fillColor: brandFill },
    margin: { left: 14 },
    tableWidth: 120,
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  const statusMap = buildStatusBreakdown(allItems);

  autoTable(doc, {
    startY: y,
    head: [['Status', 'Items', 'Total']],
    body: [...statusMap.entries()].map(([status, { count, total: t }]) => [
      status,
      String(count),
      fmtMoney(t),
    ]),
    headStyles: { fillColor: brandFill },
    margin: { left: 14 },
    tableWidth: 120,
  });

  doc.save(`${safeName(project.name)}-summary.pdf`);
}
