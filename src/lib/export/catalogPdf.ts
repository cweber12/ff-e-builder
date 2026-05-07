import jsPDF, { AcroFormCheckBox, AcroFormTextField } from 'jspdf';
import { api } from '../api';
import { BRAND_RGB } from '../constants';
import type { ImageAsset, Item, Material, Project, RoomWithItems } from '../../types';
import { blobToPngDataUrl, imageAssetToPngDataUrl } from './imageHelpers';
import { fmtMoney, safeName } from './shared';

const BRAND = BRAND_RGB;
const PAGE_PADDING = 13;
const CONTENT_W = 210 - PAGE_PADDING * 2;
const HEADER_TEXT_Y = PAGE_PADDING + 3.5;
const HEADER_RULE_Y = PAGE_PADDING + 9;
const TOP_SECTION_Y = HEADER_RULE_Y + 6;
const SECTION_GAP = 7;
const COLUMN_GAP = 8;
const FOOTER_RULE_Y = 287;
const FOOTER_TEXT_Y = FOOTER_RULE_Y + 5;
const MAX_OPTION_IMAGES = 2;
const MAX_MATERIALS = 8;
const APPROVAL_HEIGHT = 23;
const SECOND_SECTION_PANEL_HEIGHT = 74;
const OPTION_CARD_HEIGHT = 34;
const OPTION_CARD_GAP = 6;
const MATERIAL_SWATCH_SIZE = 10;
const MATERIALS_PER_ROW = 5;

const LIGHT_BORDER: [number, number, number] = [229, 231, 235];
const LIGHT_TEXT: [number, number, number] = [107, 114, 128];
const MUTED_TEXT: [number, number, number] = [156, 163, 175];
const PANEL_BG: [number, number, number] = [249, 250, 251];
const APPROVAL_BG: [number, number, number] = [248, 250, 252];

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
  materialImages: Map<string, string | null>;
};

export type CatalogPdfPageModel = {
  itemIdTag: string | null;
  dimensions: string | null;
  description: string | null;
  notes: string | null;
  unitCostCents: number | null;
  optionCount: number;
  materials: Material[];
};

type CatalogPdfOptionLayout = 'stacked' | 'row';

function sortedEntries(rooms: RoomWithItems[]): CatalogItemEntry[] {
  return [...rooms]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
    .flatMap((room) =>
      [...room.items]
        .sort((a, b) => a.sortOrder - b.sortOrder || a.itemName.localeCompare(b.itemName))
        .map((item) => ({ item, roomName: room.name })),
    );
}

function compactText(value: string | null | undefined): string | null {
  if (!value) return null;
  const compacted = value.trim();
  return compacted ? compacted : null;
}

export function buildCatalogPdfPageModel(
  item: Item,
  optionImages: Array<{ dataUrl: string | null }>,
): CatalogPdfPageModel {
  return {
    itemIdTag: compactText(item.itemIdTag),
    dimensions: compactText(item.dimensions),
    description: compactText(item.description),
    notes: compactText(item.notes),
    unitCostCents: item.unitCostCents > 0 ? item.unitCostCents : null,
    optionCount: optionImages.filter((image) => compactText(image.dataUrl)).length,
    materials: item.materials.filter(
      (material) =>
        compactText(material.name) !== null ||
        compactText(material.materialId) !== null ||
        compactText(material.description) !== null ||
        compactText(material.swatchHex) !== null,
    ),
  };
}

export function pickCatalogPdfOptionLayout(
  optionCount: number,
  materials: Material[],
  availableHeight: number,
): CatalogPdfOptionLayout {
  void materials;
  void availableHeight;
  return optionCount > 1 ? 'row' : 'stacked';
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
          .slice(0, MAX_OPTION_IMAGES)
          .map(async (image) => ({
            id: image.id,
            dataUrl: await imageAssetToPngDataUrl(image),
            isPrimary: image.isPrimary,
          })),
      );

      const materialImages = new Map<string, string | null>();
      for (const material of item.materials.slice(0, MAX_MATERIALS)) {
        const matImages = await api.images.list({ entityType: 'material', entityId: material.id });
        const matImage = matImages.find((img) => img.isPrimary) ?? matImages[0] ?? null;
        materialImages.set(material.id, matImage ? await imageAssetToPngDataUrl(matImage) : null);
      }

      return [item.id, { rendering, options, materialImages }] as const;
    }),
  );

  return new Map(pairs);
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
  field.fontSize = 8;
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

function lineHeight(fontSize: number, multiplier = 1.4) {
  return fontSize * 0.3528 * multiplier;
}

function addContainedImage(
  doc: jsPDF,
  dataUrl: string,
  x: number,
  y: number,
  width: number,
  height: number,
  padding = 0,
) {
  const imageProperties = doc.getImageProperties(dataUrl);
  const innerWidth = Math.max(1, width - padding * 2);
  const innerHeight = Math.max(1, height - padding * 2);
  const scale = Math.min(innerWidth / imageProperties.width, innerHeight / imageProperties.height);
  const drawWidth = imageProperties.width * scale;
  const drawHeight = imageProperties.height * scale;
  const drawX = x + padding + (innerWidth - drawWidth) / 2;
  const drawY = y + padding + (innerHeight - drawHeight) / 2;
  doc.addImage(dataUrl, 'PNG', drawX, drawY, drawWidth, drawHeight);
}

function initials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function drawSectionLabel(doc: jsPDF, label: string, x: number, y: number) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(LIGHT_TEXT[0], LIGHT_TEXT[1], LIGHT_TEXT[2]);
  doc.text(label.toUpperCase(), x, y);
}

function drawPanel(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  background: [number, number, number],
) {
  doc.setFillColor(background[0], background[1], background[2]);
  doc.setDrawColor(LIGHT_BORDER[0], LIGHT_BORDER[1], LIGHT_BORDER[2]);
  doc.roundedRect(x, y, width, height, 4, 4, 'FD');
}

function drawImagePlaceholder(
  doc: jsPDF,
  label: string,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  drawPanel(doc, x, y, width, height, PANEL_BG);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(BRAND[0], BRAND[1], BRAND[2]);
  doc.text(label, x + width / 2, y + height / 2 + 2, { align: 'center' });
}

function drawWrappedText(
  doc: jsPDF,
  value: string,
  x: number,
  y: number,
  width: number,
  fontSize: number,
  color: [number, number, number],
  options?: { bold?: boolean; maxLines?: number; align?: 'left' | 'center' | 'right' },
) {
  doc.setFont('helvetica', options?.bold ? 'bold' : 'normal');
  doc.setFontSize(fontSize);
  doc.setTextColor(color[0], color[1], color[2]);
  const lines = doc.splitTextToSize(value, width) as string[];
  const limitedLines = options?.maxLines ? lines.slice(0, options.maxLines) : lines;
  doc.text(limitedLines, x, y, { align: options?.align ?? 'left', maxWidth: width });
  return {
    lines: limitedLines,
    height: limitedLines.length * lineHeight(fontSize),
  };
}

function drawTopSection(
  doc: jsPDF,
  item: Item,
  model: CatalogPdfPageModel,
  x: number,
  y: number,
  width: number,
) {
  let currentY = y;
  const idText = model.itemIdTag;

  if (idText) {
    doc.setFont('courier', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(BRAND[0], BRAND[1], BRAND[2]);
    doc.text(idText, x, currentY);
  }

  const idWidth = idText ? doc.getTextWidth(idText) + 5 : 0;
  const title = drawWrappedText(
    doc,
    item.itemName,
    x + idWidth,
    currentY,
    width - idWidth,
    18,
    [17, 24, 39],
    { bold: true, maxLines: 2 },
  );
  currentY += Math.max(7.5, title.height) + 2;

  if (model.dimensions) {
    const dimensions = drawWrappedText(doc, model.dimensions, x, currentY, width, 9, LIGHT_TEXT, {
      maxLines: 2,
    });
    currentY += dimensions.height + 2;
  }

  if (model.description) {
    const description = drawWrappedText(doc, model.description, x, currentY, width, 9, LIGHT_TEXT, {
      maxLines: 4,
    });
    currentY += description.height;
  }

  return currentY;
}

function drawNotesAndCost(
  doc: jsPDF,
  model: CatalogPdfPageModel,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const innerX = x + 5;
  const innerY = y + 6;
  const innerWidth = width - 10;

  let reservedBottom = 0;
  if (model.unitCostCents !== null) {
    reservedBottom = 14;
    const dividerY = y + height - reservedBottom;
    doc.setDrawColor(LIGHT_BORDER[0], LIGHT_BORDER[1], LIGHT_BORDER[2]);
    doc.line(x + 4, dividerY, x + width - 4, dividerY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(LIGHT_TEXT[0], LIGHT_TEXT[1], LIGHT_TEXT[2]);
    doc.text('Unit cost', innerX, dividerY + 5.5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(BRAND[0], BRAND[1], BRAND[2]);
    doc.text(fmtMoney(model.unitCostCents), x + width - 5, dividerY + 5.5, { align: 'right' });
  }

  if (!model.notes) return;

  const maxLines = Math.max(1, Math.floor((height - reservedBottom - 10) / lineHeight(9, 1.55)));
  drawWrappedText(doc, model.notes, innerX, innerY, innerWidth, 9, LIGHT_TEXT, {
    maxLines,
  });
}

function drawOptionSelectionMark(doc: jsPDF, x: number, y: number, isPrimary: boolean) {
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(LIGHT_BORDER[0], LIGHT_BORDER[1], LIGHT_BORDER[2]);
  doc.circle(x, y, 2.4, 'FD');
  if (!isPrimary) return;
  doc.setDrawColor(BRAND[0], BRAND[1], BRAND[2]);
  doc.setLineWidth(0.5);
  doc.line(x - 0.9, y, x - 0.15, y + 0.8);
  doc.line(x - 0.15, y + 0.8, x + 1.2, y - 1);
  doc.setLineWidth(0.2);
}

function drawOptionsStrip(
  doc: jsPDF,
  options: CatalogOptionAsset[],
  x: number,
  y: number,
  width: number,
) {
  const visibleOptions = options.filter((option) => option.dataUrl).slice(0, MAX_OPTION_IMAGES);
  if (visibleOptions.length === 0) return y;

  drawSectionLabel(doc, 'Options', x, y);
  const cardsY = y + 4.5;
  const layout = pickCatalogPdfOptionLayout(visibleOptions.length, [], OPTION_CARD_HEIGHT);

  if (layout === 'stacked') {
    const cardWidth = Math.min(120, width * 0.72);
    const cardX = x + (width - cardWidth) / 2;
    if (visibleOptions[0]?.dataUrl) {
      addContainedImage(
        doc,
        visibleOptions[0].dataUrl,
        cardX,
        cardsY,
        cardWidth,
        OPTION_CARD_HEIGHT,
        0,
      );
    }
    drawOptionSelectionMark(
      doc,
      cardX + cardWidth - 4,
      cardsY + 4,
      visibleOptions[0]?.isPrimary ?? false,
    );
    return cardsY + OPTION_CARD_HEIGHT;
  }

  const cardWidth = (width - OPTION_CARD_GAP) / 2;
  visibleOptions.forEach((option, index) => {
    const cardX = x + index * (cardWidth + OPTION_CARD_GAP);
    if (option.dataUrl) {
      addContainedImage(doc, option.dataUrl, cardX, cardsY, cardWidth, OPTION_CARD_HEIGHT, 0);
    }
    drawOptionSelectionMark(doc, cardX + cardWidth - 4, cardsY + 4, option.isPrimary);
  });

  return cardsY + OPTION_CARD_HEIGHT;
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((char) => char + char)
          .join('')
      : clean;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return [Number.isNaN(r) ? 232 : r, Number.isNaN(g) ? 232 : g, Number.isNaN(b) ? 232 : b];
}

function drawMaterialsStrip(
  doc: jsPDF,
  materials: Material[],
  materialImages: Map<string, string | null>,
  x: number,
  y: number,
  width: number,
) {
  const visibleMaterials = materials.slice(0, MAX_MATERIALS);
  if (visibleMaterials.length === 0) return y;

  drawSectionLabel(doc, 'Materials', x, y);
  const startY = y + 5;
  const columns = Math.min(MATERIALS_PER_ROW, visibleMaterials.length);
  const itemWidth = width / columns;

  visibleMaterials.forEach((material, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const centerX = x + column * itemWidth + itemWidth / 2;
    const rowY = startY + row * 18;
    const swatchX = centerX - MATERIAL_SWATCH_SIZE / 2;
    const swatchY = rowY;

    const imageDataUrl = materialImages.get(material.id);
    if (imageDataUrl) {
      doc.setFillColor(PANEL_BG[0], PANEL_BG[1], PANEL_BG[2]);
      doc.setDrawColor(LIGHT_BORDER[0], LIGHT_BORDER[1], LIGHT_BORDER[2]);
      doc.roundedRect(swatchX, swatchY, MATERIAL_SWATCH_SIZE, MATERIAL_SWATCH_SIZE, 2, 2, 'FD');
      addContainedImage(
        doc,
        imageDataUrl,
        swatchX,
        swatchY,
        MATERIAL_SWATCH_SIZE,
        MATERIAL_SWATCH_SIZE,
        1,
      );
    } else {
      const [r, g, b] = hexToRgb(material.swatchHex);
      doc.setFillColor(r, g, b);
      doc.setDrawColor(LIGHT_BORDER[0], LIGHT_BORDER[1], LIGHT_BORDER[2]);
      doc.circle(centerX, rowY + MATERIAL_SWATCH_SIZE / 2, MATERIAL_SWATCH_SIZE / 2, 'FD');
    }

    const label = compactText(material.name) ?? compactText(material.materialId) ?? 'Material';
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.2);
    doc.setTextColor(LIGHT_TEXT[0], LIGHT_TEXT[1], LIGHT_TEXT[2]);
    const labelLines = (doc.splitTextToSize(label, itemWidth - 3) as string[]).slice(0, 2);
    doc.text(labelLines, centerX, rowY + MATERIAL_SWATCH_SIZE + 3.8, {
      align: 'center',
      maxWidth: itemWidth - 3,
    });
  });

  return startY + Math.ceil(visibleMaterials.length / columns) * 18;
}

function drawApprovalBand(doc: jsPDF, itemId: string, x: number, y: number, width: number) {
  drawPanel(doc, x, y, width, APPROVAL_HEIGHT, APPROVAL_BG);
  drawSectionLabel(doc, 'Client Approval', x + 4, y + 5.3);

  const signatureW = width * 0.5;
  const dateW = width * 0.16;
  const checksX = x + signatureW + dateW + 14;

  // Lines first, labels below
  const lineY = y + 14;
  doc.setDrawColor(MUTED_TEXT[0], MUTED_TEXT[1], MUTED_TEXT[2]);
  doc.line(x + 4, lineY, x + signatureW, lineY);
  doc.line(x + signatureW + 8, lineY, x + signatureW + dateW, lineY);

  const labelY = lineY + 3.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(LIGHT_TEXT[0], LIGHT_TEXT[1], LIGHT_TEXT[2]);
  doc.text('Authorized Signature', x + 4, labelY);
  doc.text('Date', x + signatureW + 8, labelY);

  addTextField(doc, `${itemId}-approval-signature`, x + 4, y + 8, signatureW - 4, 6);
  addTextField(doc, `${itemId}-approval-date`, x + signatureW + 8, y + 8, dateW - 8, 6);

  addCheckboxField(doc, `${itemId}-approval-with-revisions`, checksX, y + 8.5, 3.5, false);
  addCheckboxField(doc, `${itemId}-approval-as-presented`, checksX, y + 14.5, 3.5, false);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(75, 85, 99);
  doc.text('Approved with revisions', checksX + 5, y + 11.5);
  doc.text('Approved as presented', checksX + 5, y + 17.5);
}

function drawCatalogPage(
  doc: jsPDF,
  project: Project,
  entry: CatalogItemEntry,
  assets: CatalogItemAssets,
  pageNum: number,
  total: number,
): void {
  const pageWidth = doc.internal.pageSize.getWidth();
  const model = buildCatalogPdfPageModel(entry.item, assets.options);
  const clientName = compactText(project.clientName);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(BRAND[0], BRAND[1], BRAND[2]);
  doc.text(project.name.toUpperCase(), PAGE_PADDING, HEADER_TEXT_Y);
  doc.text(entry.roomName.toUpperCase(), pageWidth - PAGE_PADDING, HEADER_TEXT_Y, {
    align: 'right',
  });
  if (clientName) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(LIGHT_TEXT[0], LIGHT_TEXT[1], LIGHT_TEXT[2]);
    doc.text(clientName.toUpperCase(), PAGE_PADDING, HEADER_TEXT_Y + 4.4);
  }
  doc.setDrawColor(BRAND[0], BRAND[1], BRAND[2]);
  doc.line(PAGE_PADDING, HEADER_RULE_Y, pageWidth - PAGE_PADDING, HEADER_RULE_Y);

  const topSectionBottomY = drawTopSection(
    doc,
    entry.item,
    model,
    PAGE_PADDING,
    TOP_SECTION_Y,
    CONTENT_W,
  );
  const secondSectionY = topSectionBottomY + SECTION_GAP;
  const secondSectionLabelY = secondSectionY;
  const panelY = secondSectionLabelY + 4.5;
  const leftRatio = 0.42;
  const leftWidth = (CONTENT_W - COLUMN_GAP) * leftRatio;
  const rightWidth = CONTENT_W - COLUMN_GAP - leftWidth;
  const rightX = PAGE_PADDING + leftWidth + COLUMN_GAP;

  drawSectionLabel(doc, 'Rendering', PAGE_PADDING, secondSectionLabelY);
  if (assets.rendering) {
    addContainedImage(
      doc,
      assets.rendering,
      PAGE_PADDING,
      panelY,
      leftWidth,
      SECOND_SECTION_PANEL_HEIGHT,
      3,
    );
  } else {
    drawImagePlaceholder(
      doc,
      initials(entry.item.itemName),
      PAGE_PADDING,
      panelY,
      leftWidth,
      SECOND_SECTION_PANEL_HEIGHT,
    );
  }

  drawSectionLabel(doc, 'Notes', rightX, secondSectionLabelY);
  drawNotesAndCost(doc, model, rightX, panelY, rightWidth, SECOND_SECTION_PANEL_HEIGHT);

  const thirdSectionY = panelY + SECOND_SECTION_PANEL_HEIGHT + SECTION_GAP;
  let thirdSectionBottomY = thirdSectionY;
  if (model.optionCount > 0) {
    thirdSectionBottomY = drawOptionsStrip(
      doc,
      assets.options,
      PAGE_PADDING,
      thirdSectionY,
      CONTENT_W,
    );
  }
  if (model.materials.length > 0) {
    thirdSectionBottomY = drawMaterialsStrip(
      doc,
      model.materials,
      assets.materialImages,
      PAGE_PADDING,
      thirdSectionBottomY + (model.optionCount > 0 ? 6 : 0),
      CONTENT_W,
    );
  }

  const approvalY = Math.min(
    thirdSectionBottomY + SECTION_GAP,
    FOOTER_RULE_Y - APPROVAL_HEIGHT - 6,
  );
  drawApprovalBand(doc, entry.item.id, PAGE_PADDING, approvalY, CONTENT_W);

  doc.setDrawColor(LIGHT_BORDER[0], LIGHT_BORDER[1], LIGHT_BORDER[2]);
  doc.line(PAGE_PADDING, FOOTER_RULE_Y, pageWidth - PAGE_PADDING, FOOTER_RULE_Y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(LIGHT_TEXT[0], LIGHT_TEXT[1], LIGHT_TEXT[2]);
  doc.text(`${pageNum} of ${total}`, PAGE_PADDING, FOOTER_TEXT_Y);
  doc.text(safeName(project.name), pageWidth / 2, FOOTER_TEXT_Y, { align: 'center' });
  if (model.itemIdTag) {
    doc.text(model.itemIdTag, pageWidth - PAGE_PADDING, FOOTER_TEXT_Y, { align: 'right' });
  }
}

export async function exportCatalogPdf(project: Project, rooms: RoomWithItems[]): Promise<void> {
  const entries = sortedEntries(rooms);
  if (entries.length === 0) return;

  const assets = await buildCatalogAssets(entries);
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  for (const [index, entry] of entries.entries()) {
    if (index > 0) doc.addPage();
    drawCatalogPage(
      doc,
      project,
      entry,
      assets.get(entry.item.id) ?? { rendering: null, options: [], materialImages: new Map() },
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
  drawCatalogPage(
    doc,
    project,
    entry,
    assets.get(entry.item.id) ?? { rendering: null, options: [], materialImages: new Map() },
    entryIndex + 1,
    entries.length,
  );
  doc.save(`${safeName(project.name)}-${safeName(entry.item.itemName)}.pdf`);
}
