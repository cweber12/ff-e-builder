import jsPDF, { AcroFormCheckBox, AcroFormTextField } from 'jspdf';
import { api } from '../api';
import { BRAND_RGB } from '../constants';
import type { ImageAsset, Item, Material, Project, RoomWithItems } from '../../types';
import { blobToPngDataUrl, imageAssetToPngDataUrl } from './imageHelpers';
import { fmtMoney, safeName } from './shared';

const BRAND = BRAND_RGB;
const PAGE_PADDING = 13;
const HEADER_Y = PAGE_PADDING + 3;
const HEADER_RULE_Y = PAGE_PADDING + 9;
const BODY_TOP_Y = PAGE_PADDING + 22;
const FOOTER_RULE_Y_OFFSET = 10;
const BODY_BOTTOM_GAP = 4;
const COLUMN_GAP = 9;
const LEFT_COLUMN_W = 96;
const OPTION_GAP = 3.5;
const OPTION_CARD_ROW_H = 28;
const OPTION_CARD_STACKED_H = 28;
const MAIN_IMAGE_H = 76;
const MATERIAL_SWATCH_SIZE = 14;
const MATERIALS_PER_ROW = 4;
const MAX_OPTION_IMAGES = 2;
const MAX_MATERIALS = 8;
const APPROVAL_W = 76;
const APPROVAL_H = 34;
const APPROVAL_GAP = 7;

const LIGHT_BORDER: [number, number, number] = [229, 231, 235];
const LIGHT_TEXT: [number, number, number] = [107, 114, 128];
const MUTED_TEXT: [number, number, number] = [156, 163, 175];
const APPROVAL_BG: [number, number, number] = [249, 250, 251];
const IMAGE_BG: [number, number, number] = [245, 248, 252];

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

function optionLabelHeight() {
  return 4;
}

function containedImageArea(
  wrapperWidth: number,
  wrapperHeight: number,
  aspectRatio: number | null | undefined,
) {
  if (!aspectRatio || wrapperWidth <= 0 || wrapperHeight <= 0) return 0;
  const imageWidthFromHeight = wrapperHeight * aspectRatio;
  if (imageWidthFromHeight <= wrapperWidth) {
    return imageWidthFromHeight * wrapperHeight;
  }
  const imageHeightFromWidth = wrapperWidth / aspectRatio;
  return wrapperWidth * imageHeightFromWidth;
}

function optionAspectRatios(options: CatalogOptionAsset[]) {
  return options.map((option) => {
    if (!option.dataUrl) return null;
    const imageProperties = new jsPDF().getImageProperties(option.dataUrl);
    return imageProperties.height > 0 ? imageProperties.width / imageProperties.height : null;
  });
}

function optionCardsHeight(optionCount: number, layout: CatalogPdfOptionLayout) {
  if (optionCount <= 0) return 0;
  if (layout === 'stacked') {
    return (
      optionLabelHeight() + optionCount * OPTION_CARD_STACKED_H + (optionCount - 1) * OPTION_GAP
    );
  }
  return optionLabelHeight() + OPTION_CARD_ROW_H;
}

function materialsBlockHeight(materials: Material[]) {
  if (materials.length === 0) return 0;
  const visibleMaterials = materials.slice(0, MAX_MATERIALS);
  return 5 + Math.ceil(visibleMaterials.length / MATERIALS_PER_ROW) * 19 + 4;
}

export function pickCatalogPdfOptionLayout(
  optionCount: number,
  materials: Material[],
  availableHeight: number,
  aspectRatios: Array<number | null> = [],
) {
  if (optionCount <= 1) return 'stacked';
  const stackedHeight = optionCardsHeight(optionCount, 'stacked');
  const totalHeightWithMaterials =
    stackedHeight + (materials.length > 0 ? OPTION_GAP + materialsBlockHeight(materials) : 0);
  const fitsStacked = totalHeightWithMaterials <= availableHeight;
  const stackedWrapperHeight = Math.max(
    1,
    (OPTION_CARD_STACKED_H * optionCount + OPTION_GAP * (optionCount - 1)) / optionCount,
  );
  let stackedScore = 0;
  for (const ratio of aspectRatios.slice(0, optionCount)) {
    stackedScore += containedImageArea(LEFT_COLUMN_W, stackedWrapperHeight, ratio);
  }
  let rowScore = 0;
  for (const ratio of aspectRatios.slice(0, optionCount)) {
    rowScore += containedImageArea(
      (LEFT_COLUMN_W - OPTION_GAP * (optionCount - 1)) / optionCount,
      OPTION_CARD_ROW_H,
      ratio,
    );
  }
  if (rowScore > stackedScore * 1.08) return 'row';
  return fitsStacked ? 'stacked' : 'row';
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

      return [item.id, { rendering, options }] as const;
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
  field.fontSize = 9;
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

function drawWrappedText(
  doc: jsPDF,
  value: string,
  x: number,
  y: number,
  width: number,
  fontSize: number,
  color: [number, number, number],
  options?: { bold?: boolean; maxLines?: number },
) {
  doc.setFont('helvetica', options?.bold ? 'bold' : 'normal');
  doc.setFontSize(fontSize);
  doc.setTextColor(color[0], color[1], color[2]);
  const lines = doc.splitTextToSize(value, width) as string[];
  const limitedLines = options?.maxLines ? lines.slice(0, options.maxLines) : lines;
  doc.text(limitedLines, x, y);
  return {
    lines: limitedLines,
    height: limitedLines.length * lineHeight(fontSize),
  };
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

function drawImagePlaceholder(
  doc: jsPDF,
  label: string,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  doc.setFillColor(IMAGE_BG[0], IMAGE_BG[1], IMAGE_BG[2]);
  doc.setDrawColor(LIGHT_BORDER[0], LIGHT_BORDER[1], LIGHT_BORDER[2]);
  doc.roundedRect(x, y, width, height, 1.5, 1.5, 'FD');

  const circleSize = Math.min(30, width * 0.45, height * 0.45);
  const circleX = x + (width - circleSize) / 2;
  const circleY = y + (height - circleSize) / 2;
  doc.setFillColor(BRAND[0], BRAND[1], BRAND[2], 0.12);
  doc.circle(circleX + circleSize / 2, circleY + circleSize / 2, circleSize / 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(BRAND[0], BRAND[1], BRAND[2]);
  doc.text(label, x + width / 2, y + height / 2 + 2, { align: 'center' });
}

function drawSectionLabel(doc: jsPDF, label: string, x: number, y: number) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(LIGHT_TEXT[0], LIGHT_TEXT[1], LIGHT_TEXT[2]);
  doc.text(label.toUpperCase(), x, y);
}

function drawOptionSelectionMark(doc: jsPDF, x: number, y: number, isPrimary: boolean) {
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(209, 213, 219);
  doc.circle(x, y, 2.5, 'FD');
  if (!isPrimary) return;
  doc.setDrawColor(BRAND[0], BRAND[1], BRAND[2]);
  doc.setLineWidth(0.5);
  doc.line(x - 1, y, x - 0.2, y + 0.9);
  doc.line(x - 0.2, y + 0.9, x + 1.3, y - 1);
  doc.setLineWidth(0.2);
}

function drawOptionCards(
  doc: jsPDF,
  options: CatalogOptionAsset[],
  x: number,
  y: number,
  width: number,
  layout: CatalogPdfOptionLayout,
) {
  const visibleOptions = options.filter((option) => option.dataUrl).slice(0, MAX_OPTION_IMAGES);
  if (visibleOptions.length === 0) return y;

  drawSectionLabel(doc, 'Options', x, y);
  const cardsY = y + 4;

  if (layout === 'stacked' || visibleOptions.length === 1) {
    visibleOptions.forEach((option, index) => {
      const cardY = cardsY + index * (OPTION_CARD_STACKED_H + OPTION_GAP);
      doc.setFillColor(IMAGE_BG[0], IMAGE_BG[1], IMAGE_BG[2]);
      doc.setDrawColor(LIGHT_BORDER[0], LIGHT_BORDER[1], LIGHT_BORDER[2]);
      doc.rect(x, cardY, width, OPTION_CARD_STACKED_H, 'FD');
      if (option.dataUrl)
        addContainedImage(doc, option.dataUrl, x, cardY, width, OPTION_CARD_STACKED_H, 2);
      drawOptionSelectionMark(doc, x + width - 4, cardY + 4, option.isPrimary);
    });

    return (
      cardsY +
      visibleOptions.length * OPTION_CARD_STACKED_H +
      (visibleOptions.length - 1) * OPTION_GAP
    );
  }

  const cardWidth = (width - OPTION_GAP * (visibleOptions.length - 1)) / visibleOptions.length;

  visibleOptions.forEach((option, index) => {
    const cardX = x + index * (cardWidth + OPTION_GAP);
    doc.setFillColor(IMAGE_BG[0], IMAGE_BG[1], IMAGE_BG[2]);
    doc.setDrawColor(LIGHT_BORDER[0], LIGHT_BORDER[1], LIGHT_BORDER[2]);
    doc.rect(cardX, cardsY, cardWidth, OPTION_CARD_ROW_H, 'FD');
    if (option.dataUrl)
      addContainedImage(doc, option.dataUrl, cardX, cardsY, cardWidth, OPTION_CARD_ROW_H, 2);
    drawOptionSelectionMark(doc, cardX + cardWidth - 4, cardsY + 4, option.isPrimary);
  });

  return cardsY + OPTION_CARD_ROW_H;
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

function drawMaterials(doc: jsPDF, materials: Material[], x: number, y: number, width: number) {
  const visibleMaterials = materials.slice(0, MAX_MATERIALS);
  if (visibleMaterials.length === 0) return y;

  drawSectionLabel(doc, 'Materials', x, y);
  let currentY = y + 5;
  const itemWidth = width / Math.min(MATERIALS_PER_ROW, visibleMaterials.length);

  visibleMaterials.forEach((material, index) => {
    const column = index % MATERIALS_PER_ROW;
    const row = Math.floor(index / MATERIALS_PER_ROW);
    const centerX = x + column * itemWidth + itemWidth / 2;
    const circleY = currentY + row * 19;
    const [r, g, b] = hexToRgb(material.swatchHex);
    doc.setFillColor(r, g, b);
    doc.setDrawColor(LIGHT_BORDER[0], LIGHT_BORDER[1], LIGHT_BORDER[2]);
    doc.circle(centerX, circleY + MATERIAL_SWATCH_SIZE / 2, MATERIAL_SWATCH_SIZE / 2, 'FD');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(LIGHT_TEXT[0], LIGHT_TEXT[1], LIGHT_TEXT[2]);
    const label = compactText(material.name) ?? compactText(material.materialId) ?? 'Material';
    const labelLines = doc.splitTextToSize(label, itemWidth - 4) as string[];
    doc.text(labelLines.slice(0, 2), centerX, circleY + MATERIAL_SWATCH_SIZE + 4, {
      align: 'center',
      maxWidth: itemWidth - 4,
    });
  });

  return (
    currentY +
    Math.ceil(visibleMaterials.length / MATERIALS_PER_ROW) * 19 +
    (visibleMaterials.length > 0 ? 4 : 0)
  );
}

function initials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function drawApprovalSection(doc: jsPDF, itemId: string, x: number, y: number, width: number) {
  doc.setFillColor(APPROVAL_BG[0], APPROVAL_BG[1], APPROVAL_BG[2]);
  doc.setDrawColor(LIGHT_BORDER[0], LIGHT_BORDER[1], LIGHT_BORDER[2]);
  doc.roundedRect(x, y, width, APPROVAL_H, 4, 4, 'FD');

  drawSectionLabel(doc, 'Customer approval', x + 4, y + 5.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(LIGHT_TEXT[0], LIGHT_TEXT[1], LIGHT_TEXT[2]);
  doc.text('Signature', x + 4, y + 11.5);
  doc.text('Date', x + width - 26, y + 11.5);

  doc.setDrawColor(MUTED_TEXT[0], MUTED_TEXT[1], MUTED_TEXT[2]);
  doc.line(x + 4, y + 18, x + width - 30, y + 18);
  doc.line(x + width - 26, y + 18, x + width - 4, y + 18);

  addTextField(doc, `${itemId}-approval-signature`, x + 4, y + 12.5, width - 34, 5);
  addTextField(doc, `${itemId}-approval-date`, x + width - 26, y + 12.5, 22, 5);

  addCheckboxField(doc, `${itemId}-approval-with-changes`, x + 4, y + 24, 3.5, false);
  addCheckboxField(doc, `${itemId}-approval-without-changes`, x + 4, y + 29, 3.5, false);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(75, 85, 99);
  doc.text('Approved w/ changes', x + 9, y + 26.7);
  doc.text('Approved w/o changes', x + 9, y + 31.7);
}

function drawPriceBlock(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  unitCostCents: number | null,
) {
  if (unitCostCents === null) return y;

  doc.setDrawColor(LIGHT_BORDER[0], LIGHT_BORDER[1], LIGHT_BORDER[2]);
  doc.line(x, y, x + width, y);
  doc.line(x, y + 12, x + width, y + 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(LIGHT_TEXT[0], LIGHT_TEXT[1], LIGHT_TEXT[2]);
  doc.text('Unit cost', x, y + 7.2);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(17, 24, 39);
  doc.text(fmtMoney(unitCostCents), x + width, y + 7.2, { align: 'right' });

  return y + 12;
}

function drawNotesBlock(
  doc: jsPDF,
  notes: string | null,
  x: number,
  y: number,
  width: number,
  maxBottomY: number,
) {
  if (!notes) return y;

  const availableHeight = maxBottomY - y;
  if (availableHeight <= 0) return y;

  doc.setDrawColor(BRAND[0], BRAND[1], BRAND[2]);
  doc.setLineWidth(0.6);
  doc.line(x, y, x, Math.min(maxBottomY, y + availableHeight));
  doc.setLineWidth(0.2);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(10);
  doc.setTextColor(LIGHT_TEXT[0], LIGHT_TEXT[1], LIGHT_TEXT[2]);
  const maxLines = Math.max(1, Math.floor((availableHeight - 1) / lineHeight(10, 1.6)));
  const lines = (doc.splitTextToSize(notes, width - 5) as string[]).slice(0, maxLines);
  doc.text(lines, x + 5, y + 3.5);

  return y + Math.min(availableHeight, lines.length * lineHeight(10, 1.6));
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
  const pageHeight = doc.internal.pageSize.getHeight();
  const footerRuleY = pageHeight - FOOTER_RULE_Y_OFFSET;
  const footerTextY = footerRuleY + 5.2;
  const leftX = PAGE_PADDING;
  const rightX = leftX + LEFT_COLUMN_W + COLUMN_GAP;
  const rightWidth = pageWidth - PAGE_PADDING - rightX;
  const approvalX = rightX + Math.max(0, rightWidth - APPROVAL_W);
  const approvalY = footerRuleY - BODY_BOTTOM_GAP - APPROVAL_H;
  const leftWidth = LEFT_COLUMN_W;
  const model = buildCatalogPdfPageModel(entry.item, assets.options);
  const clientName = compactText(project.clientName);
  const leftAvailableHeight = footerRuleY - BODY_BOTTOM_GAP - (BODY_TOP_Y + MAIN_IMAGE_H + 7);
  const aspectRatios = optionAspectRatios(assets.options.filter((option) => option.dataUrl));
  const optionLayout = pickCatalogPdfOptionLayout(
    model.optionCount,
    model.materials,
    leftAvailableHeight,
    aspectRatios,
  );

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(BRAND[0], BRAND[1], BRAND[2]);
  doc.text(project.name.toUpperCase(), PAGE_PADDING, HEADER_Y);
  if (clientName) {
    doc.text(clientName.toUpperCase(), pageWidth - PAGE_PADDING, HEADER_Y, { align: 'right' });
  }
  doc.setDrawColor(BRAND[0], BRAND[1], BRAND[2]);
  doc.line(PAGE_PADDING, HEADER_RULE_Y, pageWidth - PAGE_PADDING, HEADER_RULE_Y);

  let leftY = BODY_TOP_Y;
  doc.setFillColor(IMAGE_BG[0], IMAGE_BG[1], IMAGE_BG[2]);
  doc.setDrawColor(255, 255, 255);
  doc.rect(leftX, leftY, leftWidth, MAIN_IMAGE_H, 'F');
  if (assets.rendering) {
    addContainedImage(doc, assets.rendering, leftX, leftY, leftWidth, MAIN_IMAGE_H, 2);
  } else {
    drawImagePlaceholder(doc, initials(entry.item.itemName), leftX, leftY, leftWidth, MAIN_IMAGE_H);
  }
  leftY += MAIN_IMAGE_H + 7;
  leftY = drawOptionCards(doc, assets.options, leftX, leftY, leftWidth, optionLayout);
  if (model.optionCount > 0) leftY += 7;
  drawMaterials(doc, model.materials, leftX, leftY, leftWidth);

  let rightY = BODY_TOP_Y + 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(BRAND[0], BRAND[1], BRAND[2]);
  doc.text(entry.roomName.toUpperCase(), rightX, rightY);
  rightY += 8;

  if (model.itemIdTag) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(17, 24, 39);
    doc.text(model.itemIdTag, rightX, rightY);
    const idWidth = doc.getTextWidth(model.itemIdTag);
    const nameX = rightX + idWidth + 4;
    drawWrappedText(
      doc,
      entry.item.itemName,
      nameX,
      rightY,
      rightWidth - idWidth - 4,
      15,
      [75, 85, 99],
      {
        maxLines: 3,
      },
    );
    rightY += 7;
  } else {
    const title = drawWrappedText(
      doc,
      entry.item.itemName,
      rightX,
      rightY,
      rightWidth,
      15,
      [75, 85, 99],
      {
        maxLines: 3,
      },
    );
    rightY += title.height;
  }

  if (model.dimensions) {
    rightY += 1;
    const dimensions = drawWrappedText(
      doc,
      model.dimensions,
      rightX,
      rightY,
      rightWidth,
      9,
      LIGHT_TEXT,
      { maxLines: 2 },
    );
    rightY += dimensions.height + 2;
  }

  if (model.description) {
    rightY += 3;
    const description = drawWrappedText(
      doc,
      model.description,
      rightX,
      rightY,
      rightWidth,
      9,
      LIGHT_TEXT,
      { maxLines: 6 },
    );
    rightY += description.height + 2;
  }

  rightY += 4;
  doc.setDrawColor(BRAND[0], BRAND[1], BRAND[2]);
  doc.line(rightX, rightY, rightX + rightWidth, rightY);
  rightY += 7;

  rightY = drawPriceBlock(doc, rightX, rightY, rightWidth, model.unitCostCents);
  if (model.unitCostCents !== null) rightY += 8;

  drawNotesBlock(doc, model.notes, rightX, rightY, rightWidth, approvalY - APPROVAL_GAP);
  drawApprovalSection(doc, entry.item.id, approvalX, approvalY, APPROVAL_W);

  doc.setDrawColor(LIGHT_BORDER[0], LIGHT_BORDER[1], LIGHT_BORDER[2]);
  doc.line(PAGE_PADDING, footerRuleY, pageWidth - PAGE_PADDING, footerRuleY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(LIGHT_TEXT[0], LIGHT_TEXT[1], LIGHT_TEXT[2]);
  doc.text(`${pageNum} of ${total}`, PAGE_PADDING, footerTextY);
  doc.text(safeName(project.name), pageWidth / 2, footerTextY, { align: 'center' });
  if (model.itemIdTag) {
    doc.text(model.itemIdTag, pageWidth - PAGE_PADDING, footerTextY, { align: 'right' });
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
  drawCatalogPage(
    doc,
    project,
    entry,
    assets.get(entry.item.id) ?? { rendering: null, options: [] },
    entryIndex + 1,
    entries.length,
  );
  doc.save(`${safeName(project.name)}-${safeName(entry.item.itemName)}.pdf`);
}
