import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { projectTotalCents, roomSubtotalCents } from '../budgetCalc';
import { BRAND_RGB } from '../constants';
import type { CustomColumnDef, Item, Project, RoomWithItems } from '../../types';
import { cropDataUrlToCover } from './imageHelpers';
import { buildFfeItemImages } from './ffeAssets';
import { TABLE_HEADERS, buildStatusBreakdown, itemToRow, sortedItems } from './ffeRows';
import { fmtMoney, safeName } from './shared';

const BRAND = BRAND_RGB;
const FFE_PDF_IMAGE_COL_WIDTH = 18; // mm
const FFE_PDF_IMAGE_COL_HEIGHT = 18; // mm minCellHeight
const FFE_PDF_MM_TO_PX = 3.7795;

export async function exportTablePdf(
  project: Project,
  rooms: RoomWithItems[],
  filterRoom?: RoomWithItems,
  customColumnDefs: CustomColumnDef[] = [],
): Promise<void> {
  const targetRooms = filterRoom ? [filterRoom] : rooms;
  const allSortedItems = targetRooms.flatMap((r) => sortedItems(r));
  const imageMap = await buildFfeItemImages(targetRooms);

  const activeCustomCols = customColumnDefs
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .filter((def) => allSortedItems.some((item) => (item.customData[def.id] ?? '').trim() !== ''));

  const headers = ['Image', ...TABLE_HEADERS, ...activeCustomCols.map((c) => c.label)];

  // Pre-crop images to PDF cell dimensions
  const cellWPx = Math.round((FFE_PDF_IMAGE_COL_WIDTH - 2) * FFE_PDF_MM_TO_PX);
  const cellHPx = Math.round((FFE_PDF_IMAGE_COL_HEIGHT - 2) * FFE_PDF_MM_TO_PX);
  const pdfImageMap = new Map<string, string>();
  await Promise.all(
    [...imageMap.entries()].map(async ([id, dataUrl]) => {
      if (dataUrl) {
        pdfImageMap.set(id, await cropDataUrlToCover(dataUrl, cellWPx, cellHPx));
      }
    }),
  );

  // Build ordered item list matching autotable row order
  const allItems: Item[] = [];
  for (const room of targetRooms) {
    allItems.push(...sortedItems(room));
  }
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const title = filterRoom ? `${project.name} — ${filterRoom.name}` : project.name;

  doc.setFontSize(14);
  doc.setTextColor(BRAND[0], BRAND[1], BRAND[2]);
  doc.text(title, 14, 14);
  if (project.clientName) {
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(project.clientName, 14, 20);
  }

  let startY = 26;
  let firstRoom = true;
  let rowOffset = 0; // tracks absolute item index across rooms for didDrawCell lookup

  for (const room of targetRooms) {
    if (!firstRoom) {
      doc.addPage();
      startY = 14;
    }
    firstRoom = false;

    const items = sortedItems(room);
    // row 0 = 'image' column (empty string) + rest of item data + custom col values
    const rows = items.map((item) => [
      '',
      ...itemToRow(item),
      ...activeCustomCols.map((def) => item.customData[def.id] ?? ''),
    ]);
    const subtotal = roomSubtotalCents(room.items);
    const roomItemOffset = rowOffset;
    rowOffset += items.length;

    autoTable(doc, {
      startY,
      head: [headers],
      body: [
        ...rows,
        [
          '',
          '',
          { content: room.name + ' subtotal', colSpan: 3, styles: { fontStyle: 'bold' as const } },
          '',
          '',
          {
            content: fmtMoney(subtotal),
            styles: {
              fontStyle: 'bold' as const,
              textColor: [...BRAND] as [number, number, number],
            },
          },
          '',
          '',
          '',
          '',
          ...activeCustomCols.map(() => ''),
        ],
      ],
      headStyles: { fillColor: [...BRAND] as [number, number, number], fontSize: 7 },
      bodyStyles: { fontSize: 7, minCellHeight: FFE_PDF_IMAGE_COL_HEIGHT },
      columnStyles: {
        0: { cellWidth: FFE_PDF_IMAGE_COL_WIDTH },
        2: { cellWidth: 30 }, // Item Name
      },
      didDrawPage: () => {
        doc.setFontSize(7);
        doc.setTextColor(150, 150, 150);
        const pageSize = doc.internal.pageSize;
        doc.text(
          `Page ${String(doc.getNumberOfPages())}`,
          pageSize.getWidth() - 14,
          pageSize.getHeight() - 8,
          { align: 'right' },
        );
      },
      didDrawCell: (hook) => {
        if (hook.section !== 'body' || hook.column.index !== 0) return;
        if (hook.row.index >= items.length) return;
        const item = allItems[roomItemOffset + hook.row.index];
        if (!item) return;
        const img = pdfImageMap.get(item.id);
        if (!img) return;
        const pad = 1;
        doc.addImage(
          img,
          'PNG',
          hook.cell.x + pad,
          hook.cell.y + pad,
          hook.cell.width - pad * 2,
          hook.cell.height - pad * 2,
        );
      },
      margin: { top: 14 },
    });

    startY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  }

  if (!filterRoom) {
    const grandTotal = projectTotalCents(rooms);
    doc.setFontSize(9);
    doc.setTextColor(BRAND[0], BRAND[1], BRAND[2]);
    doc.text(`Grand total: ${fmtMoney(grandTotal)}`, 14, startY + 6);
  }

  const suffix = filterRoom ? `-${safeName(filterRoom.name)}` : '';
  doc.save(`${safeName(project.name)}${suffix}-items.pdf`);
}

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
