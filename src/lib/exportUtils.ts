import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { lineTotalCents, roomSubtotalCents, projectTotalCents, sellPriceCents } from './calc';
import { BRAND_RGB } from './constants';
import { api } from './api';
import { cents, formatMoney } from '../types';
import type { Item, Material, Project } from '../types';
import type { RoomWithItems } from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BRAND = BRAND_RGB;

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function safeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function fmtMoney(c: number): string {
  return formatMoney(cents(c));
}

function fmtPct(v: number): string {
  return `${v}%`;
}

const TABLE_HEADERS = [
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
];

function itemToRow(item: Item): string[] {
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
  ];
}

function sortedItems(room: RoomWithItems): Item[] {
  return [...room.items].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.itemName.localeCompare(b.itemName),
  );
}

function buildStatusBreakdown(items: Item[]): Map<string, { count: number; total: number }> {
  const map = new Map<string, { count: number; total: number }>();
  for (const item of items) {
    const entry = map.get(item.status) ?? { count: 0, total: 0 };
    entry.count += 1;
    entry.total += lineTotalCents(item.unitCostCents, item.markupPct, item.qty);
    map.set(item.status, entry);
  }
  return map;
}

function buildVendorBreakdown(items: Item[]): Map<string, { count: number; total: number }> {
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

// ─── CSV ──────────────────────────────────────────────────────────────────────

function csvCell(v: string): string {
  return `"${v.replace(/"/g, '""')}"`;
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

// ─── Excel ────────────────────────────────────────────────────────────────────

export function exportTableExcel(
  project: Project,
  rooms: RoomWithItems[],
  filterRoom?: RoomWithItems,
): void {
  const wb = XLSX.utils.book_new();
  const targetRooms = filterRoom ? [filterRoom] : rooms;

  if (!filterRoom) {
    const allRows = buildCsvRows(project, rooms);
    const ws = XLSX.utils.aoa_to_sheet(allRows);
    XLSX.utils.book_append_sheet(wb, ws, 'All Items');
  }

  for (const room of targetRooms) {
    const rows = sortedItems(room).map((item) => itemToRow(item));
    const ws = XLSX.utils.aoa_to_sheet([TABLE_HEADERS, ...rows]);
    const sheetName = room.name.slice(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }

  const suffix = filterRoom ? `-${safeName(filterRoom.name)}` : '';
  XLSX.writeFile(wb, `${safeName(project.name)}${suffix}-items.xlsx`);
}

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

  const vendorMap = buildVendorBreakdown(allItems);
  const vendorRows = [...vendorMap.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .map(([vendor, { count, total: t }]) => [vendor, count, fmtMoney(t)]);
  const vendorWs = XLSX.utils.aoa_to_sheet([['Vendor', 'Items', 'Total'], ...vendorRows]);
  XLSX.utils.book_append_sheet(wb, vendorWs, 'Vendors');

  XLSX.writeFile(wb, `${safeName(project.name)}-summary.xlsx`);
}

const MATERIAL_HEADERS = ['Name', 'Material ID', 'Swatch Image', 'Description'];

type MaterialExportImage = {
  materialId: string;
  filename: string;
  dataUrl: string | null;
};

function materialToRow(material: Material, image?: MaterialExportImage): string[] {
  return [material.name, material.materialId, image?.filename ?? '', material.description];
}

async function buildMaterialExportImages(
  materials: Material[],
): Promise<Map<string, MaterialExportImage>> {
  const entries = await Promise.all(
    materials.map(async (material) => {
      const images = await api.images.list({ entityType: 'material', entityId: material.id });
      const image = images.find((candidate) => candidate.isPrimary) ?? images[0];
      if (!image)
        return [material.id, { materialId: material.id, filename: '', dataUrl: null }] as const;
      let dataUrl: string | null = null;
      try {
        const blob = await api.images.getContentBlob(image.id);
        dataUrl = await blobToDataUrl(blob);
      } catch {
        dataUrl = null;
      }
      return [material.id, { materialId: material.id, filename: image.filename, dataUrl }] as const;
    }),
  );
  return new Map(entries);
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }
      reject(new Error('Unable to read material image export data.'));
    };
    reader.onerror = () => reject(reader.error ?? new Error('Unable to read material image.'));
    reader.readAsDataURL(blob);
  });
}

export async function exportMaterialsExcel(
  project: Project,
  materials: Material[],
  format: 'xlsx' | 'csv' = 'xlsx',
): Promise<void> {
  const imageMap = await buildMaterialExportImages(materials);
  const rows = materials.map((material) => materialToRow(material, imageMap.get(material.id)));
  if (format === 'csv') {
    const csv = [MATERIAL_HEADERS, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    triggerDownload(blob, `${safeName(project.name)}-materials.csv`);
    return;
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([MATERIAL_HEADERS, ...rows]);
  XLSX.utils.book_append_sheet(wb, ws, 'Materials');
  XLSX.writeFile(wb, `${safeName(project.name)}-materials.xlsx`);
}

// ─── PDF – Table ──────────────────────────────────────────────────────────────

export function exportTablePdf(
  project: Project,
  rooms: RoomWithItems[],
  filterRoom?: RoomWithItems,
): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const targetRooms = filterRoom ? [filterRoom] : rooms;
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

  for (const room of targetRooms) {
    if (!firstRoom) {
      doc.addPage();
      startY = 14;
    }
    firstRoom = false;

    const rows = sortedItems(room).map((item) => itemToRow(item));
    const subtotal = roomSubtotalCents(room.items);

    autoTable(doc, {
      startY,
      head: [TABLE_HEADERS],
      body: [
        ...rows,
        [
          '',
          { content: room.name + ' subtotal', colSpan: 5, styles: { fontStyle: 'bold' as const } },
          '',
          '',
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
        ],
      ],
      headStyles: { fillColor: [...BRAND] as [number, number, number], fontSize: 7 },
      bodyStyles: { fontSize: 7 },
      columnStyles: { 1: { cellWidth: 35 } },
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

// ─── PDF – Summary ────────────────────────────────────────────────────────────

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

export async function exportMaterialsPdf(project: Project, materials: Material[]): Promise<void> {
  const imageMap = await buildMaterialExportImages(materials);
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  doc.setFontSize(14);
  doc.setTextColor(BRAND[0], BRAND[1], BRAND[2]);
  doc.text(project.name, 14, 14);
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text('Materials', 14, 21);

  autoTable(doc, {
    startY: 28,
    head: [MATERIAL_HEADERS],
    body: materials.map((material) => materialToRow(material, imageMap.get(material.id))),
    headStyles: { fillColor: [...BRAND] as [number, number, number] },
    bodyStyles: { fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 42 },
      1: { cellWidth: 32 },
      2: { cellWidth: 24, minCellHeight: 16 },
    },
    didDrawCell: (data) => {
      if (data.section !== 'body' || data.column.index !== 2) return;
      const material = materials[data.row.index];
      if (!material) return;
      const image = imageMap.get(material.id);
      if (!image?.dataUrl) return;
      const size = 10;
      const format = image.dataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG';
      doc.addImage(image.dataUrl, format, data.cell.x + 2, data.cell.y + 2, size, size);
    },
  });

  doc.save(`${safeName(project.name)}-materials.pdf`);
}

// ─── PDF – Catalog ────────────────────────────────────────────────────────────

type CatalogItemEntry = {
  item: Item & { color?: string | null; designer?: string | null };
  roomName: string;
};

function drawCatalogPage(
  doc: jsPDF,
  project: Project,
  entry: CatalogItemEntry,
  pageNum: number,
  total: number,
): void {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const { item, roomName } = entry;
  const sellPrice = sellPriceCents(item.unitCostCents, item.markupPct);

  // Header band
  doc.setFillColor(BRAND[0], BRAND[1], BRAND[2]);
  doc.rect(0, 0, W, 18, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(project.name, 10, 11);
  if (project.clientName) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(project.clientName, W - 10, 11, { align: 'right' });
  }

  // Room name
  doc.setFontSize(7);
  doc.setTextColor(BRAND[0], BRAND[1], BRAND[2]);
  doc.setFont('helvetica', 'bold');
  doc.text(roomName.toUpperCase(), 10, 27);

  // Item name
  doc.setFontSize(18);
  doc.setTextColor(20, 20, 20);
  doc.setFont('helvetica', 'bold');
  doc.text(item.itemName, 10, 35);

  // Category badge
  if (item.category) {
    doc.setFillColor(241, 245, 242);
    doc.setTextColor(BRAND[0], BRAND[1], BRAND[2]);
    doc.setFontSize(7);
    doc.roundedRect(10, 38, doc.getTextWidth(item.category) + 6, 6, 2, 2, 'F');
    doc.text(item.category, 13, 43);
  }

  // Separator
  doc.setDrawColor(220, 220, 220);
  doc.line(10, 48, W - 10, 48);

  // Details grid (left column)
  const detailFields: [string, string | null | undefined][] = [
    ['Vendor', item.vendor],
    ['Model', item.model],
    ['Dimensions', item.dimensions],
    ['Materials', item.finishes],
    ['Color', item.color],
    ['Designer', item.designer],
    ['Lead Time', item.leadTime],
  ];

  let detailY = 57;
  for (const [label, value] of detailFields) {
    if (!value) continue;
    doc.setFontSize(7);
    doc.setTextColor(130, 130, 130);
    doc.setFont('helvetica', 'normal');
    doc.text(label, 10, detailY);
    doc.setTextColor(20, 20, 20);
    doc.setFont('helvetica', 'bold');
    doc.text(value, 50, detailY);
    detailY += 7;
  }

  // Separator before pricing
  doc.setDrawColor(220, 220, 220);
  doc.line(10, detailY + 2, W - 10, detailY + 2);

  // Pricing block
  const priceY = detailY + 12;
  const priceBlocks: [string, string][] = [
    ['Unit Cost', fmtMoney(item.unitCostCents)],
    ['Markup', fmtPct(item.markupPct)],
    ['Sell Price', fmtMoney(sellPrice)],
  ];
  const blockW = (W - 20) / 3;
  priceBlocks.forEach(([label, value], i) => {
    const x = 10 + i * blockW;
    const isSellPrice = i === 2;
    if (isSellPrice) {
      doc.setFillColor(241, 245, 242);
      doc.rect(x - 2, priceY - 8, blockW, 16, 'F');
    }
    doc.setFontSize(7);
    doc.setTextColor(130, 130, 130);
    doc.setFont('helvetica', 'normal');
    doc.text(label, x, priceY - 2);
    doc.setFontSize(11);
    doc.setTextColor(
      isSellPrice ? BRAND[0] : 20,
      isSellPrice ? BRAND[1] : 20,
      isSellPrice ? BRAND[2] : 20,
    );
    doc.setFont('helvetica', 'bold');
    doc.text(value, x, priceY + 5);
  });

  // Notes
  if (item.notes) {
    const notesY = priceY + 18;
    doc.setFontSize(7);
    doc.setTextColor(130, 130, 130);
    doc.setFont('helvetica', 'normal');
    doc.text('Notes', 10, notesY);
    doc.setTextColor(60, 60, 60);
    const lines = doc.splitTextToSize(item.notes, W - 20) as string[];
    doc.text(lines.slice(0, 3), 10, notesY + 6);
  }

  // Footer
  doc.setFillColor(248, 246, 241);
  doc.rect(0, H - 12, W, 12, 'F');
  doc.setFontSize(7);
  doc.setTextColor(130, 130, 130);
  doc.setFont('helvetica', 'normal');
  doc.text(`${pageNum} of ${total}`, 10, H - 5);
  doc.text(safeName(project.name), W / 2, H - 5, { align: 'center' });
  if (item.itemIdTag) {
    doc.text(item.itemIdTag, W - 10, H - 5, { align: 'right' });
  }
}

export function exportCatalogPdf(project: Project, rooms: RoomWithItems[]): void {
  const entries: CatalogItemEntry[] = rooms.flatMap((room) =>
    [...room.items]
      .sort((a, b) => a.sortOrder - b.sortOrder || a.itemName.localeCompare(b.itemName))
      .map((item) => ({ item, roomName: room.name })),
  );

  if (entries.length === 0) return;

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  entries.forEach((entry, i) => {
    if (i > 0) doc.addPage();
    drawCatalogPage(doc, project, entry, i + 1, entries.length);
  });

  doc.save(`${safeName(project.name)}-catalog.pdf`);
}

export function exportCatalogItemPdf(
  project: Project,
  rooms: RoomWithItems[],
  itemId: string,
): void {
  const allEntries: CatalogItemEntry[] = rooms.flatMap((room) =>
    room.items.map((item) => ({ item, roomName: room.name })),
  );
  const totalCount = allEntries.length;
  const entryIndex = allEntries.findIndex((e) => e.item.id === itemId);
  if (entryIndex === -1) return;

  const entry = allEntries[entryIndex]!;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  drawCatalogPage(doc, project, entry, entryIndex + 1, totalCount);
  doc.save(`${safeName(project.name)}-${safeName(entry.item.itemName)}.pdf`);
}
