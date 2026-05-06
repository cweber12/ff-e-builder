import jsPDF, { AcroFormCheckBox, AcroFormTextField } from 'jspdf';
import { api } from '../api';
import { sellPriceCents } from '../calc';
import { BRAND_RGB } from '../constants';
import type { ImageAsset, Item, Project, RoomWithItems } from '../../types';
import { blobToPngDataUrl, cropDataUrlToCover, imageAssetToPngDataUrl } from './imageHelpers';
import { fmtMoney, fmtPct, safeName } from './shared';

const BRAND = BRAND_RGB;

type CatalogItemEntry = {
  item: Item & { color?: string | null; designer?: string | null };
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
          .slice(0, 3)
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

function drawImagePlaceholder(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
) {
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(x, y, width, height, 3, 3, 'FD');
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.setFont('helvetica', 'bold');
  doc.text(label.toUpperCase(), x + width / 2, y + height / 2, { align: 'center' });
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

function drawDetailValue(
  doc: jsPDF,
  label: string,
  value: string | null | undefined,
  x: number,
  y: number,
  width: number,
) {
  if (!value?.trim()) return y;
  doc.setFontSize(7);
  doc.setTextColor(130, 130, 130);
  doc.setFont('helvetica', 'normal');
  doc.text(label, x, y);
  doc.setFontSize(9);
  doc.setTextColor(20, 20, 20);
  doc.setFont('helvetica', 'bold');
  const lines = doc.splitTextToSize(value, width) as string[];
  doc.text(lines.slice(0, 3), x, y + 5);
  return y + 5 + lines.slice(0, 3).length * 4 + 3;
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
  const sellPrice = sellPriceCents(item.unitCostCents, item.markupPct);

  const leftX = 10;
  const leftW = 112;
  const rightX = 130;
  const rightW = W - rightX - 10;
  const renderingY = 48;
  const renderingH = 82;
  const optionY = 142;
  const optionGap = 4;
  const optionW = (leftW - optionGap * 2) / 3;
  const optionH = 30;

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

  doc.setFontSize(7);
  doc.setTextColor(BRAND[0], BRAND[1], BRAND[2]);
  doc.setFont('helvetica', 'bold');
  doc.text(roomName.toUpperCase(), 10, 27);

  doc.setFontSize(18);
  doc.setTextColor(20, 20, 20);
  doc.setFont('helvetica', 'bold');
  doc.text(item.itemName, 10, 35);

  if (item.category) {
    doc.setFillColor(241, 245, 242);
    doc.setTextColor(BRAND[0], BRAND[1], BRAND[2]);
    doc.setFontSize(7);
    doc.roundedRect(10, 38, doc.getTextWidth(item.category) + 6, 6, 2, 2, 'F');
    doc.text(item.category, 13, 43);
  }

  doc.setDrawColor(220, 220, 220);
  doc.line(10, 45, W - 10, 45);

  doc.setFontSize(7);
  doc.setTextColor(130, 130, 130);
  doc.setFont('helvetica', 'normal');
  doc.text('Rendering', leftX, renderingY - 4);
  if (assets.rendering) {
    await addCoverImage(doc, assets.rendering, leftX, renderingY, leftW, renderingH);
  } else {
    drawImagePlaceholder(doc, leftX, renderingY, leftW, renderingH, 'Rendering');
  }

  let detailY = 52;
  detailY = drawDetailValue(doc, 'Description', item.description, rightX, detailY, rightW);
  detailY = drawDetailValue(doc, 'Vendor', item.vendor, rightX, detailY, rightW);
  detailY = drawDetailValue(doc, 'Model', item.model, rightX, detailY, rightW);
  detailY = drawDetailValue(doc, 'Dimensions', item.dimensions, rightX, detailY, rightW);
  detailY = drawDetailValue(doc, 'Materials', item.finishes, rightX, detailY, rightW);
  detailY = drawDetailValue(doc, 'Lead Time', item.leadTime, rightX, detailY, rightW);
  detailY = drawDetailValue(doc, 'Color', item.color, rightX, detailY, rightW);
  detailY = drawDetailValue(doc, 'Designer', item.designer, rightX, detailY, rightW);

  doc.setDrawColor(220, 220, 220);
  doc.line(rightX, detailY + 2, W - 10, detailY + 2);

  const priceY = detailY + 11;
  const priceBlocks: [string, string][] = [
    ['Unit Cost', fmtMoney(item.unitCostCents)],
    ['Markup', fmtPct(item.markupPct)],
    ['Sell Price', fmtMoney(sellPrice)],
  ];
  const priceBlockW = rightW / 3;
  priceBlocks.forEach(([label, value], index) => {
    const x = rightX + index * priceBlockW;
    const isSellPrice = index === 2;
    if (isSellPrice) {
      doc.setFillColor(241, 245, 242);
      doc.roundedRect(x - 1.5, priceY - 8, priceBlockW - 1, 16, 2, 2, 'F');
    }
    doc.setFontSize(7);
    doc.setTextColor(130, 130, 130);
    doc.setFont('helvetica', 'normal');
    doc.text(label, x, priceY - 2);
    doc.setFontSize(isSellPrice ? 12 : 10);
    doc.setTextColor(
      isSellPrice ? BRAND[0] : 20,
      isSellPrice ? BRAND[1] : 20,
      isSellPrice ? BRAND[2] : 20,
    );
    doc.setFont('helvetica', 'bold');
    doc.text(value, x, priceY + 5);
  });

  doc.setFontSize(7);
  doc.setTextColor(130, 130, 130);
  doc.setFont('helvetica', 'normal');
  doc.text('Option renderings', leftX, optionY - 4);

  for (let index = 0; index < 3; index += 1) {
    const option = assets.options[index] ?? null;
    const x = leftX + index * (optionW + optionGap);
    if (option?.dataUrl) {
      await addCoverImage(doc, option.dataUrl, x, optionY, optionW, optionH);
    } else {
      drawImagePlaceholder(doc, x, optionY, optionW, optionH, `Option ${index + 1}`);
    }
    addCheckboxField(
      doc,
      `${safeName(project.name)}-${item.id}-option-${index + 1}`,
      x + optionW - 6,
      optionY + 2,
      4,
      Boolean(option?.isPrimary),
    );
  }

  doc.setFontSize(7);
  doc.setTextColor(130, 130, 130);
  doc.setFont('helvetica', 'normal');
  doc.text('Notes', leftX, 183);
  doc.setTextColor(60, 60, 60);
  doc.setFontSize(9);
  const noteLines = doc.splitTextToSize(item.notes ?? '', leftW) as string[];
  doc.text(noteLines.length > 0 ? noteLines.slice(0, 6) : ['-'], leftX, 189);

  const approvalX = rightX;
  const approvalY = 184;
  const approvalW = rightW;
  const approvalH = 58;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(approvalX, approvalY, approvalW, approvalH, 3, 3, 'FD');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'bold');
  doc.text('CUSTOMER APPROVAL', approvalX + 4, approvalY + 7);

  doc.setFontSize(7);
  doc.setTextColor(130, 130, 130);
  doc.setFont('helvetica', 'normal');
  doc.text('Signature', approvalX + 4, approvalY + 16);
  addTextField(doc, `${item.id}-approval-signature`, approvalX + 4, approvalY + 18, 40, 8);

  doc.text('Date', approvalX + 48, approvalY + 16);
  addTextField(doc, `${item.id}-approval-date`, approvalX + 48, approvalY + 18, approvalW - 52, 8);

  addCheckboxField(
    doc,
    `${item.id}-approval-with-changes`,
    approvalX + 4,
    approvalY + 33,
    4,
    false,
  );
  doc.text('Approved w/ changes', approvalX + 10, approvalY + 36);

  addCheckboxField(
    doc,
    `${item.id}-approval-without-changes`,
    approvalX + 4,
    approvalY + 44,
    4,
    false,
  );
  doc.text('Approved w/o changes', approvalX + 10, approvalY + 47);

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
