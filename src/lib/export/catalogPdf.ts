import jsPDF, { AcroFormCheckBox, AcroFormTextField } from 'jspdf';
import { api } from '../api';
import { BRAND_RGB } from '../constants';
import type { ImageAsset, Item, Material, Project, RoomWithItems } from '../../types';
import { blobToPngDataUrl, cropDataUrlToCover, imageAssetToPngDataUrl } from './imageHelpers';
import { fmtMoney, safeName } from './shared';

const BRAND = BRAND_RGB;
const TINT_LIGHT: [number, number, number] = [236, 243, 249];
const TINT_MID: [number, number, number] = [210, 225, 240];
const TINT_FOOTER: [number, number, number] = [230, 238, 246];

const MARGIN = 10;
const LEFT_X = MARGIN;
const LEFT_W = 108;
const SEP_X = 120;
const RIGHT_X = 124;
const FOOTER_H = 10;
const APPROVAL_H = 56;
const APPROVAL_GAP = 6;

type CatalogItemEntry = {
  item: Item;
  roomName: string;
};

type CatalogOptionAsset = {
  id: string;
  dataUrl: string | null;
  isPrimary: boolean;
};

type CatalogItemAssets = {
  rendering: string | null;
  options: CatalogOptionAsset[];
};

function sortedEntries(rooms: RoomWithItems[]): CatalogItemEntry[] {
  return [...rooms]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
    .flatMap((room) =>
      [...room.items]
        .sort((a, b) => a.sortOrder - b.sortOrder || a.itemName.localeCompare(b.itemName))
        .map((item) => ({ item, roomName: room.name })),
    );
}

async function fallbackUrlToPngDataUrl(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return await blobToPngDataUrl(await response.blob());
  } catch {
    return null;
  }
}

function primaryImage(images: ImageAsset[]): ImageAsset | null {
  return images.find((image) => image.isPrimary) ?? images[0] ?? null;
}

async function buildCatalogAssets(
  entries: CatalogItemEntry[],
): Promise<Map<string, CatalogItemAssets>> {
  const pairs = await Promise.all(
    entries.map(async ({ item }) => {
      const renderingImages = await api.images.list({ entityType: 'item', entityId: item.id });
      const renderingAsset = primaryImage(renderingImages);
      const rendering = renderingAsset
        ? await imageAssetToPngDataUrl(renderingAsset)
        : await fallbackUrlToPngDataUrl(item.imageUrl);

      const optionImages = await api.images.list({ entityType: 'item_option', entityId: item.id });
      const options = await Promise.all(
        optionImages
          .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary))
          .slice(0, 2)
          .map(async (image) => ({
            id: image.id,
            dataUrl: await imageAssetToPngDataUrl(image),
            isPrimary: image.isPrimary,
          })),
      );

      return [item.id, { rendering, options }] as const;
    }),
  );

  return new Map(pairs);
}

async function addCoverImage(
  doc: jsPDF,
  dataUrl: string | null,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  if (!dataUrl) return;
  const cropped = await cropDataUrlToCover(dataUrl, width * 12, height * 12);
  doc.addImage(cropped, 'PNG', x, y, width, height);
}

function addTextField(
  doc: jsPDF,
  fieldName: string,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const field = new AcroFormTextField();
  field.fieldName = fieldName;
  field.x = x;
  field.y = y;
  field.width = width;
  field.height = height;
  field.fontName = 'helvetica';
  field.fontSize = 10;
  field.textAlign = 'left';
  field.showWhenPrinted = true;
  doc.addField(field);
}

function addCheckboxField(
  doc: jsPDF,
  fieldName: string,
  x: number,
  y: number,
  size: number,
  checked = false,
) {
  const field = new AcroFormCheckBox();
  field.fieldName = fieldName;
  field.x = x;
  field.y = y;
  field.width = size;
  field.height = size;
  field.showWhenPrinted = true;
  field.appearanceState = checked ? 'On' : 'Off';
  doc.addField(field);
}

// Returns updated Y. Returns y unchanged when value is empty — zero phantom spacing.
function drawField(
  doc: jsPDF,
  label: string,
  value: string | null | undefined,
  x: number,
  y: number,
  width: number,
): number {
  if (!value?.trim()) return y;
  doc.setFontSize(6.5);
  doc.setTextColor(155, 155, 155);
  doc.setFont('helvetica', 'normal');
  doc.text(label.toUpperCase(), x, y);
  doc.setFontSize(8.5);
  doc.setTextColor(30, 30, 30);
  doc.setFont('helvetica', 'normal');
  const lines = doc.splitTextToSize(value, width) as string[];
  doc.text(lines.slice(0, 3), x, y + 4.5);
  return y + 4.5 + Math.min(lines.length, 3) * 3.8 + 4;
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return [Number.isNaN(r) ? 200 : r, Number.isNaN(g) ? 200 : g, Number.isNaN(b) ? 200 : b];
}

function drawSwatches(doc: jsPDF, materials: Material[], x: number, y: number): number {
  const size = 8;
  const gap = 5;
  const rowH = size + 7;
  const perRow = 5;
  materials.slice(0, 10).forEach((mat, i) => {
    const col = i % perRow;
    const row = Math.floor(i / perRow);
    const sx = x + col * (size + gap);
    const sy = y + row * rowH;
    const [r, g, b] = hexToRgb(mat.swatchHex);
    doc.setFillColor(r, g, b);
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.2);
    doc.roundedRect(sx, sy, size, size, 1.5, 1.5, 'FD');
    doc.setFontSize(5.5);
    doc.setTextColor(110, 110, 110);
    doc.setFont('helvetica', 'normal');
    doc.text(mat.name, sx + size / 2, sy + size + 4, {
      align: 'center',
      maxWidth: size + gap - 1,
    });
  });
  return y + Math.ceil(Math.min(materials.length, 10) / perRow) * rowH;
}

async function drawCatalogPage(
  doc: jsPDF,
  project: Project,
  entry: CatalogItemEntry,
  assets: CatalogItemAssets,
  pageNum: number,
  total: number,
): Promise<void> {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const { item, roomName } = entry;
  const rightW = W - RIGHT_X - MARGIN;
  const footerY = H - FOOTER_H;
  const approvalY = footerY - APPROVAL_GAP - APPROVAL_H;

  // Pricing: omit entire section when unit cost is 0
  const priceItems: [string, string][] = [];
  if (item.unitCostCents !== 0) priceItems.push(['UNIT COST', fmtMoney(item.unitCostCents)]);
  const hasPricing = priceItems.length > 0;
  const priceBlockH = 16;
  const priceSepH = 9;
  const priceTopY = hasPricing ? approvalY - priceSepH - priceBlockH : approvalY - priceSepH;

  // ── Header — no fill, text + thin rule ──────────────────────────────────────
  doc.setFontSize(9.5);
  doc.setTextColor(BRAND[0], BRAND[1], BRAND[2]);
  doc.setFont('helvetica', 'bold');
  doc.text(project.name, LEFT_X, 10);
  if (project.clientName) {
    doc.setFontSize(7.5);
    doc.setTextColor(150, 150, 150);
    doc.setFont('helvetica', 'normal');
    doc.text(project.clientName, W - MARGIN, 10, { align: 'right' });
  }
  doc.setDrawColor(218, 218, 218);
  doc.setLineWidth(0.3);
  doc.line(LEFT_X, 14, W - MARGIN, 14);
  doc.setLineWidth(0.2);

  // ── Title area ───────────────────────────────────────────────────────────────
  doc.setFontSize(6.5);
  doc.setTextColor(BRAND[0], BRAND[1], BRAND[2]);
  doc.setFont('helvetica', 'bold');
  doc.text(roomName.toUpperCase(), LEFT_X, 22);

  // Item name (left) + ID (right) on the same baseline
  const titleY = 32;
  let idWidth = 0;
  if (item.itemIdTag) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    idWidth = doc.getTextWidth(item.itemIdTag) + 4;
  }
  doc.setFontSize(17);
  doc.setFont('helvetica', 'bold');
  const nameMaxW = W - LEFT_X * 2 - idWidth;
  const nameLines = doc.splitTextToSize(item.itemName, nameMaxW) as string[];
  doc.setTextColor(20, 20, 20);
  doc.text(nameLines.slice(0, 2), LEFT_X, titleY);
  if (item.itemIdTag) {
    doc.setFontSize(9);
    doc.setTextColor(170, 170, 170);
    doc.setFont('helvetica', 'normal');
    doc.text(item.itemIdTag, W - MARGIN, titleY, { align: 'right' });
  }

  // Brand accent rule (dynamic: moves down if name wraps to 2 lines)
  const accentY = titleY + (nameLines.length > 1 ? 13 : 6);
  doc.setDrawColor(BRAND[0], BRAND[1], BRAND[2]);
  doc.setLineWidth(0.4);
  doc.line(LEFT_X, accentY, W - MARGIN, accentY);
  doc.setLineWidth(0.2);

  const contentY = accentY + 4;

  // ── Column separator ─────────────────────────────────────────────────────────
  doc.setDrawColor(218, 218, 218);
  doc.line(SEP_X, contentY, SEP_X, footerY);

  // ── Left column: rendering fills full column height ──────────────────────────
  const renderingH = footerY - contentY - 4;
  if (assets.rendering) {
    await addCoverImage(doc, assets.rendering, LEFT_X, contentY, LEFT_W, renderingH);
  } else {
    doc.setFillColor(244, 246, 249);
    doc.setDrawColor(218, 226, 234);
    doc.roundedRect(LEFT_X, contentY, LEFT_W, renderingH, 2, 2, 'FD');
  }

  // ── Right column: info wrapper — full right column width ──────────────────────
  let detailY = contentY;
  detailY = drawField(doc, 'Description', item.description, RIGHT_X, detailY, rightW);
  detailY = drawField(doc, 'Dimensions', item.dimensions, RIGHT_X, detailY, rightW);
  detailY = drawField(doc, 'Lead Time', item.leadTime, RIGHT_X, detailY, rightW);

  if (item.notes?.trim()) {
    detailY = drawField(doc, 'Notes', item.notes, RIGHT_X, detailY, rightW);
  }

  // Thin separator below info wrapper
  const infoEndY = detailY;
  if (infoEndY > contentY) {
    doc.setDrawColor(225, 225, 225);
    doc.setLineWidth(0.3);
    doc.line(RIGHT_X, infoEndY + 2, W - MARGIN, infoEndY + 2);
    doc.setLineWidth(0.2);
  }

  // ── Right column: options + materials — expand to fill available space ────────
  const realOptions = assets.options.filter((o) => o.dataUrl);
  const hasMaterials = item.materials.length > 0;

  const groupStartY = infoEndY > contentY ? infoEndY + 8 : contentY;
  const groupEndY = Math.max(groupStartY + 30, priceTopY - 5);

  // Estimate materials height to size option images dynamically
  const matRows = hasMaterials ? Math.ceil(Math.min(item.materials.length, 10) / 5) : 0;
  const matBlockH = hasMaterials ? 5 + matRows * 15 + 4 : 0; // label + rows + gap
  const optLabelH = realOptions.length > 0 ? 7 : 0; // label below each option image
  const optSectionH = groupEndY - groupStartY - matBlockH - (hasMaterials ? 6 : 0);
  const optH = realOptions.length > 0 ? Math.max(20, Math.min(60, optSectionH - optLabelH)) : 0;

  let groupY = groupStartY;

  if (realOptions.length > 0) {
    const optGap = 4;
    const optW = realOptions.length === 1 ? rightW : (rightW - optGap) / 2;

    for (let i = 0; i < realOptions.length; i++) {
      const opt = realOptions[i]!;
      const ox = RIGHT_X + i * (optW + optGap);
      await addCoverImage(doc, opt.dataUrl, ox, groupY, optW, optH);
      addCheckboxField(
        doc,
        `${safeName(project.name)}-${item.id}-option-${i + 1}`,
        ox + optW - 6,
        groupY + 2,
        4,
        opt.isPrimary,
      );
      doc.setFontSize(6);
      doc.setTextColor(140, 140, 140);
      doc.setFont('helvetica', 'normal');
      doc.text(`Option ${i + 1}`, ox + optW / 2, groupY + optH + 4, { align: 'center' });
    }
    groupY += optH + optLabelH;
  }

  if (hasMaterials) {
    if (realOptions.length > 0) groupY += 4;
    doc.setFontSize(6.5);
    doc.setTextColor(155, 155, 155);
    doc.setFont('helvetica', 'normal');
    doc.text('MATERIALS', RIGHT_X, groupY);
    groupY += 5;
    groupY = drawSwatches(doc, item.materials, RIGHT_X, groupY);
  }

  // ── Right column: pricing — omit entire section when all values are 0 ─────────
  if (hasPricing) {
    doc.setDrawColor(225, 225, 225);
    doc.setLineWidth(0.3);
    doc.line(RIGHT_X, priceTopY - 4, W - MARGIN, priceTopY - 4);
    doc.setLineWidth(0.2);

    const priceW = rightW / priceItems.length;
    priceItems.forEach(([label, value], idx) => {
      const x = RIGHT_X + idx * priceW;
      doc.setFontSize(6);
      doc.setTextColor(155, 155, 155);
      doc.setFont('helvetica', 'normal');
      doc.text(label, x, priceTopY + 2);
      doc.setFontSize(9);
      doc.setTextColor(35, 35, 35);
      doc.setFont('helvetica', 'normal');
      doc.text(value, x, priceTopY + 8.5);
    });
  }

  // ── Customer approval — always anchored above footer ──────────────────────────
  doc.setFillColor(TINT_LIGHT[0], TINT_LIGHT[1], TINT_LIGHT[2]);
  doc.setDrawColor(TINT_MID[0], TINT_MID[1], TINT_MID[2]);
  doc.setLineWidth(0.3);
  doc.roundedRect(RIGHT_X, approvalY, rightW, APPROVAL_H, 3, 3, 'FD');
  doc.setLineWidth(0.2);

  doc.setFontSize(7);
  doc.setTextColor(BRAND[0], BRAND[1], BRAND[2]);
  doc.setFont('helvetica', 'bold');
  doc.text('CUSTOMER APPROVAL', RIGHT_X + 4, approvalY + 8);

  doc.setDrawColor(TINT_MID[0], TINT_MID[1], TINT_MID[2]);
  doc.setLineWidth(0.3);
  doc.line(RIGHT_X + 4, approvalY + 11, RIGHT_X + rightW - 4, approvalY + 11);
  doc.setLineWidth(0.2);

  doc.setFontSize(6.5);
  doc.setTextColor(130, 130, 130);
  doc.setFont('helvetica', 'normal');
  doc.text('Signature', RIGHT_X + 4, approvalY + 18);
  addTextField(doc, `${item.id}-approval-signature`, RIGHT_X + 4, approvalY + 20, 36, 8);

  doc.text('Date', RIGHT_X + 44, approvalY + 18);
  addTextField(doc, `${item.id}-approval-date`, RIGHT_X + 44, approvalY + 20, rightW - 48, 8);

  addCheckboxField(doc, `${item.id}-approval-with-changes`, RIGHT_X + 4, approvalY + 34, 4, false);
  doc.setFontSize(7);
  doc.setTextColor(70, 70, 70);
  doc.setFont('helvetica', 'normal');
  doc.text('Approved with changes', RIGHT_X + 10, approvalY + 37);

  addCheckboxField(
    doc,
    `${item.id}-approval-without-changes`,
    RIGHT_X + 4,
    approvalY + 44,
    4,
    false,
  );
  doc.text('Approved without changes', RIGHT_X + 10, approvalY + 47);

  // ── Footer ───────────────────────────────────────────────────────────────────
  doc.setFillColor(TINT_FOOTER[0], TINT_FOOTER[1], TINT_FOOTER[2]);
  doc.rect(0, footerY, W, FOOTER_H, 'F');
  doc.setFontSize(6.5);
  doc.setTextColor(140, 140, 140);
  doc.setFont('helvetica', 'normal');
  doc.text(`${pageNum} / ${total}`, LEFT_X, footerY + 6);
  doc.text(safeName(project.name), W / 2, footerY + 6, { align: 'center' });
  if (item.itemIdTag) {
    doc.text(item.itemIdTag, W - MARGIN, footerY + 6, { align: 'right' });
  }
}

export async function exportCatalogPdf(project: Project, rooms: RoomWithItems[]): Promise<void> {
  const entries = sortedEntries(rooms);
  if (entries.length === 0) return;

  const assets = await buildCatalogAssets(entries);
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  for (const [index, entry] of entries.entries()) {
    if (index > 0) doc.addPage();
    await drawCatalogPage(
      doc,
      project,
      entry,
      assets.get(entry.item.id) ?? { rendering: null, options: [] },
      index + 1,
      entries.length,
    );
  }

  doc.save(`${safeName(project.name)}-catalog.pdf`);
}

export async function exportCatalogItemPdf(
  project: Project,
  rooms: RoomWithItems[],
  itemId: string,
): Promise<void> {
  const entries = sortedEntries(rooms);
  const entryIndex = entries.findIndex((entry) => entry.item.id === itemId);
  if (entryIndex === -1) return;

  const entry = entries[entryIndex]!;
  const assets = await buildCatalogAssets([entry]);
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  await drawCatalogPage(
    doc,
    project,
    entry,
    assets.get(entry.item.id) ?? { rendering: null, options: [] },
    entryIndex + 1,
    entries.length,
  );
  doc.save(`${safeName(project.name)}-${safeName(entry.item.itemName)}.pdf`);
}
