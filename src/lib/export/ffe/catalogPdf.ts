import jsPDF, { AcroFormCheckBox, AcroFormTextField, GState } from 'jspdf';
import { api } from '../../api';
import type { ImageAsset, Item, Material, Project, RoomWithItems } from '../../../types';
import { imageAssetToPngDataUrl } from '../imageHelpers';
import { fmtMoney, safeName } from '../shared';
import { registerCatalogFonts } from './catalogFonts';

// ── Page geometry (Letter, millimetres) ───────────────────────────────────────
const PAGE_W = 215.9;
const PAGE_H = 279.4;
const PAGE_PADDING_X = 13;
const PAGE_PADDING_Y = 12;
const CONTENT_W = PAGE_W - PAGE_PADDING_X * 2;

const HEADER_TITLE_Y = PAGE_PADDING_Y + 6.5;
const HEADER_SUBTITLE_Y = HEADER_TITLE_Y + 4;
const HEADER_RULE_Y = HEADER_SUBTITLE_Y + 3;
const BODY_START_Y = HEADER_RULE_Y + 5;
const SECTION_GAP = 6;

const FOOTER_Y = PAGE_H - PAGE_PADDING_Y;

const MAIN_GAP = 8;
const LEFT_COL_W = (CONTENT_W - MAIN_GAP) * (1.35 / 2.35);
const RIGHT_COL_W = CONTENT_W - MAIN_GAP - LEFT_COL_W;
const RIGHT_COL_X = PAGE_PADDING_X + LEFT_COL_W + MAIN_GAP;

const RENDER_SIZE = LEFT_COL_W; // square rendering matches left column width
const QTY_BAND_H = 13;
const QTY_LABEL_ROW_H = 5;

const OPTION_CARD_GAP = 4;
const OPTION_CARD_SIZE = (LEFT_COL_W - OPTION_CARD_GAP) / 2;

const PLAN_FRAME_W = 56;
const PLAN_FRAME_H = PLAN_FRAME_W * (3 / 4);

const APPROVAL_H = 26;
const APPROVAL_RADIUS = 6;

const MAX_OPTION_IMAGES = 2;
const MAX_MATERIALS = 4;

// ── Palette (matches src/index.css brand + gray tokens) ───────────────────────
const BRAND_500: RGB = [75, 127, 171];
const BRAND_600: RGB = [58, 100, 138];
const BRAND_700: RGB = [40, 71, 101];
const BRAND_200: RGB = [158, 192, 220];
const BRAND_50: RGB = [236, 243, 249];
const GRAY_800: RGB = [31, 41, 55];
const GRAY_700: RGB = [55, 65, 81];
const GRAY_600: RGB = [75, 85, 99];
const GRAY_500: RGB = [107, 114, 128];
const GRAY_400: RGB = [156, 163, 175];
const GRAY_300: RGB = [209, 213, 219];
const GRAY_200: RGB = [229, 231, 235];
const GRAY_100: RGB = [243, 244, 246];
const WHITE: RGB = [255, 255, 255];

type RGB = [number, number, number];

type CatalogItemEntry = { item: Item; roomName: string };

type CatalogOptionAsset = {
  id: string;
  dataUrl: string | null;
  isPrimary: boolean;
};

type CatalogItemAssets = {
  rendering: string | null;
  plan: string | null;
  options: CatalogOptionAsset[];
  materialImages: Map<string, string | null>;
};

export type CatalogPdfImageAlignment = 'center' | 'top';

type ContainedImageBox = {
  drawW: number;
  drawH: number;
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

export type CatalogWatermarkPdfOptions = {
  /** Base64 data URL of the company logo image. */
  logoDataUrl: string;
  /** Company name to render next to the logo, or null for logo-only. */
  companyName: string | null;
  placementH: 'left' | 'center' | 'right';
  placementV: 'header' | 'footer';
  /** Opacity as a 0–100 integer; 100 = fully opaque. */
  opacity: number;
};

export type CatalogPdfOptions = {
  /** When false, the finish-schedule swatches are drawn without their ID and name labels. */
  showSwatchLabels?: boolean;
  /** When false, the rendering section shows only a compact quantity callout under the image. */
  showCostInfo?: boolean;
  /** When false, the approval band is omitted from each catalog page. */
  showApproval?: boolean;
  /** Vertical alignment for the main rendering image inside its square frame. */
  mainImageAlignment?: CatalogPdfImageAlignment;
  /**
   * Item ordering within each room.
   * - 'manual' (default): respects each item's `sortOrder`.
   * - 'idTag': alphanumeric sort by `itemIdTag` (untagged items fall to the bottom).
   */
  sortMode?: 'manual' | 'idTag';
  watermark?: CatalogWatermarkPdfOptions | null;
};

// ── Pure helpers used by tests ────────────────────────────────────────────────
function compactText(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
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

export function resolveCatalogPdfImageAlignment(
  alignment: CatalogPdfImageAlignment | null | undefined,
): CatalogPdfImageAlignment {
  return alignment === 'top' ? 'top' : 'center';
}

// ── Asset loading ─────────────────────────────────────────────────────────────
function sortedEntries(
  rooms: RoomWithItems[],
  sortMode: 'manual' | 'idTag' = 'manual',
): CatalogItemEntry[] {
  const itemCompare =
    sortMode === 'idTag'
      ? (() => {
          const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
          return (a: Item, b: Item) => {
            const aId = a.itemIdTag?.trim() ?? '';
            const bId = b.itemIdTag?.trim() ?? '';
            if (aId && bId) {
              return collator.compare(aId, bId) || a.itemName.localeCompare(b.itemName);
            }
            if (aId) return -1;
            if (bId) return 1;
            return a.itemName.localeCompare(b.itemName);
          };
        })()
      : (a: Item, b: Item) => a.sortOrder - b.sortOrder || a.itemName.localeCompare(b.itemName);
  return [...rooms]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
    .flatMap((room) =>
      [...room.items].sort(itemCompare).map((item) => ({ item, roomName: room.name })),
    );
}

function primaryImage(images: ImageAsset[]): ImageAsset | null {
  return images.find((image) => image.isPrimary) ?? images[0] ?? null;
}

async function buildCatalogAssets(
  entries: CatalogItemEntry[],
): Promise<Map<string, CatalogItemAssets>> {
  const pairs = await Promise.all(
    entries.map(async ({ item }) => {
      const [renderingImages, planImages, optionImages] = await Promise.all([
        api.images.list({ entityType: 'item', entityId: item.id }),
        api.images.list({ entityType: 'item_plan', entityId: item.id }),
        api.images.list({ entityType: 'item_option', entityId: item.id }),
      ]);

      const renderingAsset = primaryImage(renderingImages);
      const planAsset = primaryImage(planImages);
      const rendering = renderingAsset ? await imageAssetToPngDataUrl(renderingAsset) : null;
      const plan = planAsset ? await imageAssetToPngDataUrl(planAsset) : null;

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

      return [item.id, { rendering, plan, options, materialImages }] as const;
    }),
  );

  return new Map(pairs);
}

// ── Low-level drawing primitives ──────────────────────────────────────────────
function setFill(doc: jsPDF, color: RGB) {
  doc.setFillColor(color[0], color[1], color[2]);
}
function setStroke(doc: jsPDF, color: RGB) {
  doc.setDrawColor(color[0], color[1], color[2]);
}
function setText(doc: jsPDF, color: RGB) {
  doc.setTextColor(color[0], color[1], color[2]);
}

function applyFont(doc: jsPDF, font: string, weight: 'normal' | 'bold', size: number) {
  doc.setFont(font, weight);
  doc.setFontSize(size);
}

function lineHeightMm(fontSize: number, multiplier = 1.4): number {
  // jsPDF font size is in pt; 1pt = 0.3528mm.
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
  verticalAlign: CatalogPdfImageAlignment = 'center',
) {
  const props = doc.getImageProperties(dataUrl);
  const innerW = Math.max(1, width - padding * 2);
  const innerH = Math.max(1, height - padding * 2);
  const scale = Math.min(innerW / props.width, innerH / props.height);
  const drawW = props.width * scale;
  const drawH = props.height * scale;
  const drawX = x + padding + (innerW - drawW) / 2;
  const drawY = verticalAlign === 'top' ? y + padding : y + padding + (innerH - drawH) / 2;
  doc.addImage(dataUrl, 'PNG', drawX, drawY, drawW, drawH);
}

function measureContainedImage(
  doc: jsPDF,
  dataUrl: string,
  width: number,
  height: number,
  padding = 0,
): ContainedImageBox {
  const props = doc.getImageProperties(dataUrl);
  const innerW = Math.max(1, width - padding * 2);
  const innerH = Math.max(1, height - padding * 2);
  const scale = Math.min(innerW / props.width, innerH / props.height);
  return {
    drawW: props.width * scale,
    drawH: props.height * scale,
  };
}

function drawWrappedText(
  doc: jsPDF,
  font: string,
  weight: 'normal' | 'bold',
  size: number,
  color: RGB,
  value: string,
  x: number,
  y: number,
  width: number,
  options: { maxLines?: number; align?: 'left' | 'center' | 'right'; lineMultiplier?: number } = {},
) {
  applyFont(doc, font, weight, size);
  setText(doc, color);
  const lines = doc.splitTextToSize(value, width) as string[];
  const limited = options.maxLines ? lines.slice(0, options.maxLines) : lines;
  doc.text(limited, x, y, { align: options.align ?? 'left', maxWidth: width });
  return {
    lines: limited,
    height: limited.length * lineHeightMm(size, options.lineMultiplier ?? 1.4),
  };
}

function initials(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function hexToRgb(hex: string): RGB {
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

function drawImagePlaceholder(
  doc: jsPDF,
  font: string,
  label: string,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  setFill(doc, BRAND_50);
  doc.rect(x, y, width, height, 'F');
  const cx = x + width / 2;
  const cy = y + height / 2;
  const radius = Math.min(width * 0.16, height * 0.18);
  setFill(doc, [BRAND_500[0], BRAND_500[1], BRAND_500[2]]);
  doc.circle(cx, cy, radius, 'F');
  applyFont(doc, font, 'bold', 22);
  setText(doc, WHITE);
  doc.text(label || '·', cx, cy + 2.4, { align: 'center' });
}

// ── AcroForm fields (approval band) ───────────────────────────────────────────
function addTextField(
  doc: jsPDF,
  fieldName: string,
  x: number,
  y: number,
  width: number,
  height: number,
  font: string,
) {
  const field = new AcroFormTextField();
  field.fieldName = fieldName;
  field.x = x;
  field.y = y;
  field.width = width;
  field.height = height;
  field.fontName = font;
  field.fontSize = 9;
  field.textAlign = 'left';
  field.showWhenPrinted = true;
  doc.addField(field);
}

function addCheckboxField(doc: jsPDF, fieldName: string, x: number, y: number, size: number) {
  const field = new AcroFormCheckBox();
  field.fieldName = fieldName;
  field.x = x;
  field.y = y;
  field.width = size;
  field.height = size;
  field.showWhenPrinted = true;
  field.appearanceState = 'Off';
  doc.addField(field);
}

// ── Section drawers ───────────────────────────────────────────────────────────
function drawHeader(
  doc: jsPDF,
  font: string,
  project: Project,
  entry: CatalogItemEntry,
  item: Item,
  watermark?: CatalogWatermarkPdfOptions | null,
) {
  const leftX = PAGE_PADDING_X;
  const rightX = PAGE_W - PAGE_PADDING_X;

  // LEFT: ID tag (brand-700, bold) sets the line; the item name follows in a
  // lighter weight + neutral gray so it reads as the descriptor, not a second
  // emphasis. Matches the on-screen catalog header treatment.
  const idTag = compactText(item.itemIdTag);
  let cursorX = leftX;
  if (idTag) {
    applyFont(doc, font, 'bold', 13);
    setText(doc, BRAND_700);
    doc.text(idTag.toUpperCase(), cursorX, HEADER_TITLE_Y);
    cursorX += doc.getTextWidth(idTag.toUpperCase()) + 4;
  }
  applyFont(doc, font, 'normal', 13);
  setText(doc, GRAY_800);
  const itemName = item.itemName.toUpperCase();
  const nameMaxW = rightX - cursorX - 70; // leave room for project text on right
  const nameLines = (doc.splitTextToSize(itemName, Math.max(40, nameMaxW)) as string[]).slice(0, 1);
  doc.text(nameLines, cursorX, HEADER_TITLE_Y);

  // RIGHT: project name (top) + location/room subtitle
  applyFont(doc, font, 'bold', 13);
  setText(doc, BRAND_700);
  doc.text(project.name.toUpperCase(), rightX, HEADER_TITLE_Y, { align: 'right' });

  const locationText = compactText(project.projectLocation) ?? entry.roomName;
  applyFont(doc, font, 'normal', 7.5);
  setText(doc, BRAND_500);
  doc.text(locationText.toUpperCase(), rightX, HEADER_SUBTITLE_Y, { align: 'right' });

  // Bottom rule (brand-500, 0.6pt)
  setStroke(doc, BRAND_500);
  doc.setLineWidth(0.4);
  doc.line(leftX, HEADER_RULE_Y, rightX, HEADER_RULE_Y);
  doc.setLineWidth(0.2);

  if (watermark && watermark.placementV === 'header') {
    drawWatermarkInZone(doc, font, watermark, 'header');
  }
}

function drawRendering(
  doc: jsPDF,
  font: string,
  rendering: string | null,
  item: Item,
  x: number,
  y: number,
): { width: number; height: number } {
  if (rendering) {
    const measured = measureContainedImage(doc, rendering, LEFT_COL_W, RENDER_SIZE, 0);
    const frameX = x + (LEFT_COL_W - measured.drawW) / 2;
    setFill(doc, WHITE);
    doc.rect(frameX, y, measured.drawW, measured.drawH, 'F');
    doc.addImage(rendering, 'PNG', frameX, y, measured.drawW, measured.drawH);
    return { width: measured.drawW, height: measured.drawH };
  } else {
    const fallbackSize = Math.min(LEFT_COL_W, RENDER_SIZE * 0.8);
    const frameX = x + (LEFT_COL_W - fallbackSize) / 2;
    drawImagePlaceholder(doc, font, initials(item.itemName), frameX, y, fallbackSize, fallbackSize);
    return { width: fallbackSize, height: fallbackSize };
  }
}

function drawQtyBand(
  doc: jsPDF,
  font: string,
  item: Item,
  x: number,
  y: number,
  width: number,
  showCostInfo: boolean,
) {
  if (!showCostInfo) {
    applyFont(doc, font, 'bold', 8.5);
    setText(doc, GRAY_800);
    doc.text('Qty', x, y + 6.2);
    applyFont(doc, font, 'bold', 14);
    setText(doc, GRAY_800);
    doc.text(String(item.qty), x + doc.getTextWidth('Qty') + 3, y + 6.2);
    return;
  }

  // Header strip (brand-600 background, white uppercase labels)
  setFill(doc, BRAND_600);
  doc.rect(x, y, width, QTY_LABEL_ROW_H, 'F');

  const cellW = width / 3;
  applyFont(doc, font, 'bold', 6.5);
  setText(doc, WHITE);
  doc.text('PRODUCT QTY', x + cellW / 2, y + 3.5, { align: 'center' });
  doc.text('PRICE PER ITEM', x + cellW + cellW / 2, y + 3.5, { align: 'center' });
  doc.text('TOTAL', x + 2 * cellW + cellW / 2, y + 3.5, { align: 'center' });

  // Value row (white bg, neutral-700 values)
  const valueY = y + QTY_LABEL_ROW_H;
  const valueH = QTY_BAND_H - QTY_LABEL_ROW_H;
  setFill(doc, WHITE);
  doc.rect(x, valueY, width, valueH, 'F');
  setStroke(doc, BRAND_200);
  doc.rect(x, y, width, QTY_BAND_H);

  applyFont(doc, font, 'normal', 10);
  setText(doc, GRAY_700);
  const valTextY = valueY + valueH / 2 + 1.6;
  const unitText = item.unitCostCents > 0 ? fmtMoney(item.unitCostCents) : '—';
  const totalCents = item.unitCostCents * item.qty;
  const totalText = totalCents > 0 ? fmtMoney(totalCents) : '—';
  doc.text(String(item.qty), x + cellW / 2, valTextY, { align: 'center' });
  doc.text(unitText, x + cellW + cellW / 2, valTextY, { align: 'center' });
  doc.text(totalText, x + 2 * cellW + cellW / 2, valTextY, { align: 'center' });
}

function drawSpecColumn(
  doc: jsPDF,
  font: string,
  model: CatalogPdfPageModel,
  materials: Material[],
  materialImages: Map<string, string | null>,
  x: number,
  y: number,
  width: number,
  maxBottomY: number,
  showSwatchLabels: boolean,
) {
  let cursorY = y + 4;

  // "PRODUCT SPECIFICATIONS" heading (neutral-700, 11pt, light tracking)
  applyFont(doc, font, 'bold', 9.5);
  setText(doc, GRAY_700);
  doc.text('PRODUCT SPECIFICATIONS', x, cursorY);
  cursorY += 5;

  // Dimensions (small neutral-700)
  const dim = model.dimensions ?? 'W __" x D __" x H __"';
  const dimColor: RGB = model.dimensions ? GRAY_700 : GRAY_400;
  const dimResult = drawWrappedText(doc, font, 'normal', 9, dimColor, dim, x, cursorY, width, {
    maxLines: 1,
  });
  cursorY += dimResult.height + 2;

  // Description (neutral-700, 9pt, up to 4 lines, italic-ish leading)
  if (model.description) {
    const desc = drawWrappedText(
      doc,
      font,
      'normal',
      8.5,
      GRAY_700,
      model.description,
      x,
      cursorY,
      width,
      { maxLines: 4, lineMultiplier: 1.4 },
    );
    cursorY += desc.height + 3;
  }

  // Notes block — only render when present (per spec)
  if (model.notes) {
    const notesAvailable = Math.max(0, maxBottomY - cursorY - 35); // reserve room for finish schedule
    const maxLines = Math.max(1, Math.floor(notesAvailable / lineHeightMm(8, 1.5)));
    const notesResult = drawWrappedText(
      doc,
      font,
      'normal',
      8,
      GRAY_600,
      model.notes,
      x,
      cursorY,
      width,
      { maxLines, lineMultiplier: 1.5 },
    );
    cursorY += notesResult.height + 4;
  }

  // FINISH SCHEDULE — bottom-aligned within the right column.
  // Hidden entirely when the item has no materials (per export spec).
  if (materials.length === 0) return;

  const fsHeight = showSwatchLabels ? 36 : 26; // sub-heading + materials row
  const fsTop = Math.max(cursorY, maxBottomY - fsHeight);

  applyFont(doc, font, 'bold', 8.5);
  setText(doc, GRAY_600);
  doc.text('FINISH SCHEDULE', x, fsTop);

  drawMaterialsRow(doc, font, materials, materialImages, x, fsTop + 4, width, showSwatchLabels);
}

function drawMaterialsRow(
  doc: jsPDF,
  font: string,
  materials: Material[],
  materialImages: Map<string, string | null>,
  x: number,
  y: number,
  width: number,
  showSwatchLabels: boolean,
) {
  // Caller is responsible for skipping the section when materials.length === 0.
  // We always render only real material cells in a 4-column grid so a single
  // material lands in the leftmost slot (per CSS grid-template-columns).
  const slotCount = MAX_MATERIALS;
  const cellCount = Math.min(materials.length, MAX_MATERIALS);
  const cells = materials.slice(0, MAX_MATERIALS);
  const cellW = width / slotCount;
  // 1.5x larger than the previous 10mm swatch per export spec.
  const swatchSize = 15;
  const idGap = showSwatchLabels ? 4.4 : 0;

  for (let index = 0; index < cellCount; index++) {
    const cellX = x + index * cellW;
    const centerX = cellX + cellW / 2;
    const material = cells[index]!;

    if (showSwatchLabels) {
      // ID label (top)
      applyFont(doc, font, 'bold', 6.5);
      setText(doc, GRAY_500);
      const idLabel = compactText(material.materialId) ?? 'ID';
      doc.text(idLabel.toUpperCase(), centerX, y + 2.6, { align: 'center' });
    }

    // Swatch (square with image, or circle filled with hex when no image)
    const swatchY = y + idGap;
    const swatchCx = centerX;
    const swatchCy = swatchY + swatchSize / 2;
    const image = materialImages.get(material.id);
    if (image) {
      // White backing fill, no border (per export spec).
      setFill(doc, WHITE);
      doc.rect(swatchCx - swatchSize / 2, swatchY, swatchSize, swatchSize, 'F');
      addContainedImage(doc, image, swatchCx - swatchSize / 2, swatchY, swatchSize, swatchSize, 0);
    } else {
      const fill = hexToRgb(material.swatchHex);
      setFill(doc, fill);
      setStroke(doc, GRAY_200);
      doc.circle(swatchCx, swatchCy, swatchSize / 2, 'FD');
    }

    if (showSwatchLabels) {
      // Name (single word, uppercase)
      const nameRaw = compactText(material.name);
      const nameLabel = nameRaw ? nameRaw.split(/\s+/)[0]! : 'MATERIAL';
      applyFont(doc, font, 'bold', 6);
      setText(doc, GRAY_500);
      doc.text(nameLabel.toUpperCase(), centerX, swatchY + swatchSize + 2.4, {
        align: 'center',
        maxWidth: cellW - 1,
      });
    }
  }
}

function drawOptionStrip(
  doc: jsPDF,
  font: string,
  options: CatalogOptionAsset[],
  x: number,
  y: number,
) {
  const visible = options.filter((option) => option.dataUrl).slice(0, MAX_OPTION_IMAGES);
  if (visible.length === 0) return;

  const layout = pickCatalogPdfOptionLayout(visible.length, [], 0);

  if (layout === 'stacked') {
    const size = Math.min(OPTION_CARD_SIZE * 1.4, LEFT_COL_W * 0.8);
    const cardX = x + (LEFT_COL_W - size) / 2;
    setFill(doc, GRAY_100);
    doc.rect(cardX, y, size, size, 'F');
    if (visible[0]?.dataUrl) {
      addContainedImage(doc, visible[0].dataUrl, cardX, y, size, size, 0);
    }
    drawOptionCheckmark(doc, cardX + size - 5.5, y + 5.5, visible[0]?.isPrimary ?? false);
    applyFont(doc, font, 'bold', 6);
    setText(doc, GRAY_400);
    doc.text('OPTION 1', cardX + size / 2, y + size + 3, { align: 'center' });
    return;
  }

  visible.forEach((option, index) => {
    const cardX = x + index * (OPTION_CARD_SIZE + OPTION_CARD_GAP);
    setFill(doc, GRAY_100);
    doc.rect(cardX, y, OPTION_CARD_SIZE, OPTION_CARD_SIZE, 'F');
    if (option.dataUrl) {
      addContainedImage(doc, option.dataUrl, cardX, y, OPTION_CARD_SIZE, OPTION_CARD_SIZE, 0);
    }
    drawOptionCheckmark(doc, cardX + OPTION_CARD_SIZE - 5.5, y + 5.5, option.isPrimary);
    applyFont(doc, font, 'bold', 6);
    setText(doc, GRAY_400);
    doc.text(`OPTION ${index + 1}`, cardX + OPTION_CARD_SIZE / 2, y + OPTION_CARD_SIZE + 3, {
      align: 'center',
    });
  });
}

function drawOptionCheckmark(doc: jsPDF, x: number, y: number, isSelected: boolean) {
  setFill(doc, WHITE);
  setStroke(doc, GRAY_300);
  doc.circle(x, y, 2.4, 'FD');
  if (!isSelected) return;
  setStroke(doc, BRAND_500);
  doc.setLineWidth(0.55);
  doc.line(x - 1.1, y, x - 0.25, y + 0.9);
  doc.line(x - 0.25, y + 0.9, x + 1.3, y - 1.05);
  doc.setLineWidth(0.2);
}

function drawLocationBlock(
  doc: jsPDF,
  font: string,
  roomName: string,
  plan: string | null,
  x: number,
  y: number,
) {
  // "LOCATION: <room>"
  applyFont(doc, font, 'bold', 8);
  setText(doc, GRAY_600);
  doc.text('LOCATION:', x, y + 3);
  const keyWidth = doc.getTextWidth('LOCATION:') + 1.5;
  applyFont(doc, font, 'normal', 8);
  setText(doc, GRAY_700);
  doc.text(roomName, x + keyWidth, y + 3);

  // Plan frame
  const frameY = y + 7;
  setFill(doc, GRAY_100);
  doc.rect(x, frameY, PLAN_FRAME_W, PLAN_FRAME_H, 'F');
  if (plan) {
    addContainedImage(doc, plan, x, frameY, PLAN_FRAME_W, PLAN_FRAME_H, 0);
  } else {
    applyFont(doc, font, 'bold', 7);
    setText(doc, GRAY_400);
    doc.text('LOCATION', x + PLAN_FRAME_W / 2, frameY + PLAN_FRAME_H / 2 - 1, { align: 'center' });
    doc.text('SNIPPET', x + PLAN_FRAME_W / 2, frameY + PLAN_FRAME_H / 2 + 3, { align: 'center' });
  }
}

function drawRoundedRect(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  style: 'F' | 'S' | 'FD',
) {
  doc.roundedRect(x, y, width, height, radius, radius, style);
}

function drawApprovalBand(
  doc: jsPDF,
  font: string,
  itemId: string,
  x: number,
  y: number,
  width: number,
) {
  setFill(doc, BRAND_50);
  setStroke(doc, BRAND_200);
  drawRoundedRect(doc, x, y, width, APPROVAL_H, APPROVAL_RADIUS, 'FD');

  const innerX = x + 7;
  const innerRight = x + width - 7;

  // Title: "CLIENT APPROVAL" — uppercase, bold, top-left of band
  applyFont(doc, font, 'bold', 10);
  setText(doc, GRAY_700);
  doc.text('CLIENT APPROVAL', innerX, y + 7);

  // Signature line + label (left, below title)
  const sigX = innerX;
  const sigW = width * 0.46;
  const lineY = y + APPROVAL_H - 7;
  setStroke(doc, GRAY_400);
  doc.setLineWidth(0.3);
  doc.line(sigX, lineY, sigX + sigW, lineY);
  doc.setLineWidth(0.2);
  applyFont(doc, font, 'normal', 6.5);
  setText(doc, GRAY_500);
  doc.text('AUTHORIZED SIGNATURE', sigX, lineY + 3);
  addTextField(doc, `${itemId}-approval-signature`, sigX, lineY - 5, sigW, 5, font);

  // Date line + label (middle)
  const dateX = sigX + sigW + 6;
  const dateW = 28;
  setStroke(doc, GRAY_400);
  doc.setLineWidth(0.3);
  doc.line(dateX, lineY, dateX + dateW, lineY);
  doc.setLineWidth(0.2);
  applyFont(doc, font, 'normal', 6.5);
  setText(doc, GRAY_500);
  doc.text('DATE', dateX, lineY + 3);
  addTextField(doc, `${itemId}-approval-date`, dateX, lineY - 5, dateW, 5, font);

  // Checkboxes (right side, vertically centered on the line area)
  const checkBoxSize = 3;
  const checkLabel1 = 'Approved with revisions';
  const checkLabel2 = 'Approved as presented';
  applyFont(doc, font, 'normal', 7.5);
  const checkLabelW = Math.max(doc.getTextWidth(checkLabel1), doc.getTextWidth(checkLabel2));
  const checksLabelX = innerRight - checkLabelW;
  const checksBoxX = checksLabelX - checkBoxSize - 2;
  const check1Y = y + 9.5;
  const check2Y = check1Y + 6;
  addCheckboxField(doc, `${itemId}-approval-with-revisions`, checksBoxX, check1Y, checkBoxSize);
  addCheckboxField(doc, `${itemId}-approval-as-presented`, checksBoxX, check2Y, checkBoxSize);
  setText(doc, GRAY_700);
  doc.text(checkLabel1, checksLabelX, check1Y + checkBoxSize - 0.4);
  doc.text(checkLabel2, checksLabelX, check2Y + checkBoxSize - 0.4);
}

function drawFooter(
  doc: jsPDF,
  font: string,
  project: Project,
  pageNum: number,
  total: number,
  watermark?: CatalogWatermarkPdfOptions | null,
) {
  const leftX = PAGE_PADDING_X;
  const rightX = PAGE_W - PAGE_PADDING_X;
  // Page number — always on the right
  applyFont(doc, font, 'bold', 7);
  setText(doc, GRAY_500);
  doc.text(`PAGE ${pageNum} of ${total}`, rightX, FOOTER_Y, { align: 'right' });
  // Project name in center, skipped when the center slot is taken by the watermark
  if (!watermark || watermark.placementV !== 'footer' || watermark.placementH !== 'center') {
    applyFont(doc, font, 'normal', 7);
    setText(doc, GRAY_400);
    doc.text(safeName(project.name), (leftX + rightX) / 2, FOOTER_Y, { align: 'center' });
  }
  if (watermark && watermark.placementV === 'footer') {
    drawWatermarkInZone(doc, font, watermark, 'footer');
  }
}

function drawWatermarkInZone(
  doc: jsPDF,
  font: string,
  watermark: CatalogWatermarkPdfOptions,
  zone: 'header' | 'footer',
): void {
  const logoH = 5; // mm — constrained height for the mark
  const logoMaxW = 24; // mm — maximum width
  const leftX = PAGE_PADDING_X;
  const rightX = PAGE_W - PAGE_PADDING_X;
  // Baseline Y: bottom of the logo / text alignment in each zone
  const baseY = zone === 'footer' ? FOOTER_Y : PAGE_PADDING_Y - 1;

  let drawW: number;
  let drawH: number;
  try {
    const props = doc.getImageProperties(watermark.logoDataUrl);
    const scale = Math.min(logoMaxW / props.width, logoH / props.height);
    drawW = props.width * scale;
    drawH = props.height * scale;
  } catch {
    return; // skip if image can't be parsed
  }

  // Measure text width before applying opacity (font state is separate from GState)
  const nameText = watermark.companyName ? watermark.companyName.toUpperCase() : null;
  let nameW = 0;
  if (nameText) {
    applyFont(doc, font, 'normal', 6.5);
    nameW = doc.getTextWidth(nameText);
  }

  // Horizontal positioning
  const nameGap = 2; // mm gap between logo and name
  const totalW = drawW + (nameText ? nameGap + nameW : 0);
  let imgX: number;
  let nameX: number;
  if (watermark.placementH === 'left') {
    imgX = leftX;
    nameX = leftX + drawW + nameGap;
  } else if (watermark.placementH === 'center') {
    imgX = (leftX + rightX) / 2 - totalW / 2;
    nameX = imgX + drawW + nameGap;
  } else {
    // right — reserve ~38mm for "PAGE X of Y" bold text
    imgX = rightX - 38 - totalW;
    nameX = imgX + drawW + nameGap;
  }

  const imgY = baseY - drawH;
  const textY = baseY - drawH / 2 + 1; // vertically centred with the logo

  doc.saveGraphicsState();
  doc.setGState(new GState({ opacity: watermark.opacity / 100 }));

  doc.addImage(watermark.logoDataUrl, 'PNG', imgX, imgY, drawW, drawH);

  if (nameText) {
    applyFont(doc, font, 'normal', 6.5);
    setText(doc, GRAY_500);
    doc.text(nameText, nameX, textY);
  }

  doc.restoreGraphicsState();
}

// ── Page composition ──────────────────────────────────────────────────────────
function drawCatalogPage(
  doc: jsPDF,
  font: string,
  project: Project,
  entry: CatalogItemEntry,
  assets: CatalogItemAssets,
  pageNum: number,
  total: number,
  options: Required<CatalogPdfOptions>,
): void {
  const model = buildCatalogPdfPageModel(entry.item, assets.options);

  drawHeader(doc, font, project, entry, entry.item, options.watermark);

  // ── Main two-column section ─────────────────────────────────────────────────
  const mainY = BODY_START_Y;
  const leftSectionHeight = RENDER_SIZE + 3 + QTY_BAND_H;
  const renderingMeasure = assets.rendering
    ? measureContainedImage(doc, assets.rendering, LEFT_COL_W, RENDER_SIZE, 0)
    : {
        drawW: Math.min(LEFT_COL_W, RENDER_SIZE * 0.8),
        drawH: Math.min(LEFT_COL_W, RENDER_SIZE * 0.8),
      };
  const leftContentHeight = renderingMeasure.drawH + 3 + QTY_BAND_H;
  const leftOffsetY =
    options.mainImageAlignment === 'top'
      ? 0
      : Math.max(0, (leftSectionHeight - leftContentHeight) / 2);
  const renderingY = mainY + leftOffsetY;
  const renderingFrame = drawRendering(
    doc,
    font,
    assets.rendering,
    entry.item,
    PAGE_PADDING_X,
    renderingY,
  );
  const qtyX = PAGE_PADDING_X + (LEFT_COL_W - renderingFrame.width) / 2;
  const qtyY = renderingY + renderingFrame.height + 3;
  drawQtyBand(doc, font, entry.item, qtyX, qtyY, renderingFrame.width, options.showCostInfo);

  // Right column: specifications, dims, description, notes, finish schedule
  const mainBottomY = mainY + leftSectionHeight;
  drawSpecColumn(
    doc,
    font,
    model,
    model.materials,
    assets.materialImages,
    RIGHT_COL_X,
    mainY,
    RIGHT_COL_W,
    mainBottomY,
    options.showSwatchLabels,
  );

  // ── Bottom row: options + location/plan ─────────────────────────────────────
  const bottomY = mainBottomY + SECTION_GAP;
  drawOptionStrip(doc, font, assets.options, PAGE_PADDING_X, bottomY);
  drawLocationBlock(doc, font, entry.roomName, assets.plan, RIGHT_COL_X, bottomY);

  // ── Approval band ───────────────────────────────────────────────────────────
  if (options.showApproval) {
    const approvalY = FOOTER_Y - APPROVAL_H - 6;
    drawApprovalBand(doc, font, entry.item.id, PAGE_PADDING_X, approvalY, CONTENT_W);
  }

  // ── Footer ──────────────────────────────────────────────────────────────────
  drawFooter(doc, font, project, pageNum, total, options.watermark);
}

// ── Public exports ────────────────────────────────────────────────────────────
function createDoc(): jsPDF {
  return new jsPDF({ unit: 'mm', format: 'letter' });
}

const EMPTY_ASSETS: CatalogItemAssets = {
  rendering: null,
  plan: null,
  options: [],
  materialImages: new Map(),
};

function resolveOptions(options: CatalogPdfOptions | undefined): Required<CatalogPdfOptions> {
  return {
    showSwatchLabels: options?.showSwatchLabels ?? true,
    showCostInfo: options?.showCostInfo ?? true,
    showApproval: options?.showApproval ?? true,
    mainImageAlignment: resolveCatalogPdfImageAlignment(options?.mainImageAlignment),
    sortMode: options?.sortMode ?? 'manual',
    watermark: options?.watermark ?? null,
  };
}

export async function exportCatalogPdf(
  project: Project,
  rooms: RoomWithItems[],
  options?: CatalogPdfOptions,
): Promise<void> {
  const resolved = resolveOptions(options);
  const entries = sortedEntries(rooms, resolved.sortMode);
  if (entries.length === 0) return;

  const assets = await buildCatalogAssets(entries);
  const doc = createDoc();
  const font = await registerCatalogFonts(doc);

  for (const [index, entry] of entries.entries()) {
    if (index > 0) doc.addPage();
    drawCatalogPage(
      doc,
      font,
      project,
      entry,
      assets.get(entry.item.id) ?? EMPTY_ASSETS,
      index + 1,
      entries.length,
      resolved,
    );
  }

  doc.save(`${safeName(project.name)}-catalog.pdf`);
}

export async function exportCatalogItemPdf(
  project: Project,
  rooms: RoomWithItems[],
  itemId: string,
  options?: CatalogPdfOptions,
): Promise<void> {
  const resolved = resolveOptions(options);
  const entries = sortedEntries(rooms, resolved.sortMode);
  const entryIndex = entries.findIndex((entry) => entry.item.id === itemId);
  if (entryIndex === -1) return;

  const entry = entries[entryIndex]!;
  const assets = await buildCatalogAssets([entry]);
  const doc = createDoc();
  const font = await registerCatalogFonts(doc);
  drawCatalogPage(
    doc,
    font,
    project,
    entry,
    assets.get(entry.item.id) ?? EMPTY_ASSETS,
    entryIndex + 1,
    entries.length,
    resolved,
  );
  doc.save(`${safeName(project.name)}-${safeName(entry.item.itemName)}.pdf`);
}
