import jsPDF from 'jspdf';
import { sellPriceCents } from '../calc';
import { BRAND_RGB } from '../constants';
import type { Item, Project, RoomWithItems } from '../../types';
import { fmtMoney, fmtPct, safeName } from './shared';

const BRAND = BRAND_RGB;
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
