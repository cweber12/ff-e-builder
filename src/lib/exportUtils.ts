import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import {
  lineTotalCents,
  roomSubtotalCents,
  projectTotalCents,
  sellPriceCents,
  takeoffCategorySubtotalCents,
  takeoffLineTotalCents,
  takeoffProjectTotalCents,
} from './calc';
import { BRAND_RGB } from './constants';
import { api } from './api';
import { cents, formatMoney } from '../types';
import type {
  ImageAsset,
  Item,
  Material,
  Project,
  TakeoffCategoryWithItems,
  TakeoffItem,
  UserProfile,
} from '../types';
import type { RoomWithItems } from '../types';
import type { Worksheet } from 'exceljs';

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

const TAKEOFF_HEADERS = [
  'Rendering',
  'Product Tag',
  'Plan',
  'Drawings / Location',
  'Product Description',
  'Size',
  'Swatch',
  'CBM',
  'Quantity',
  'Unit',
  'Unit Cost',
  'Total Cost',
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

function takeoffItemToRow(item: TakeoffItem): string[] {
  return [
    '',
    item.productTag,
    item.plan,
    [item.drawings, item.location].filter(Boolean).join(' / '),
    item.description,
    item.sizeLabel,
    item.swatches.join('; '),
    String(item.cbm),
    String(item.quantity),
    item.quantityUnit,
    fmtMoney(item.unitCostCents),
    fmtMoney(takeoffLineTotalCents(item)),
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

export function exportTakeoffCsv(project: Project, categories: TakeoffCategoryWithItems[]): void {
  const rows = [
    ['Project', 'Category', ...TAKEOFF_HEADERS],
    ...categories.flatMap((category) =>
      category.items.map((item) => [project.name, category.name, ...takeoffItemToRow(item)]),
    ),
  ];
  const csv = rows.map((row) => row.map(csvCell).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  triggerDownload(blob, `${safeName(project.name)}-takeoff.csv`);
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

type TakeoffPdfMode = 'continuous' | 'separated';

type TakeoffPdfOptions = {
  mode?: TakeoffPdfMode;
};

type TakeoffExportColumnKey =
  | 'rendering'
  | 'productTag'
  | 'plan'
  | 'drawingsLocation'
  | 'description'
  | 'size'
  | 'swatch'
  | 'cbm'
  | 'quantity'
  | 'unit'
  | 'unitCost'
  | 'totalCost';

type TakeoffExportColumn = {
  key: TakeoffExportColumnKey;
  label: string;
  pdfWidth: number;
  excelWidth: number;
  alwaysVisible?: boolean;
};

type TakeoffAssetBundle = {
  projectImages: string[];
  renderingByItemId: Map<string, string>;
  swatchesByItemId: Map<string, string[]>;
};

type TakeoffExportRow = {
  item: TakeoffItem;
  values: Record<TakeoffExportColumnKey, string>;
  rendering: string | null;
  swatches: string[];
};

type TakeoffExportCategorySection = {
  category: TakeoffCategoryWithItems;
  rows: TakeoffExportRow[];
  subtotalCents: number;
  quantityTotal: number;
};

type TakeoffExportDocument = {
  companyName: string;
  projectLine: string;
  preparedByLine: string;
  compactIdentityLine: string;
  projectImages: string[];
  columns: TakeoffExportColumn[];
  categories: TakeoffExportCategorySection[];
  grandTotalCents: number;
  budgetTargetCents: number | null;
};

const TAKEOFF_EXPORT_COLUMNS: TakeoffExportColumn[] = [
  { key: 'rendering', label: 'Rendering', pdfWidth: 28, excelWidth: 16 },
  { key: 'productTag', label: 'Product Tag', pdfWidth: 18, excelWidth: 14, alwaysVisible: true },
  { key: 'plan', label: 'Plan', pdfWidth: 18, excelWidth: 14 },
  { key: 'drawingsLocation', label: 'Drawings / Location', pdfWidth: 24, excelWidth: 20 },
  {
    key: 'description',
    label: 'Product Description',
    pdfWidth: 40,
    excelWidth: 30,
    alwaysVisible: true,
  },
  { key: 'size', label: 'Size', pdfWidth: 22, excelWidth: 18 },
  { key: 'swatch', label: 'Swatch', pdfWidth: 16, excelWidth: 12 },
  { key: 'cbm', label: 'CBM', pdfWidth: 10, excelWidth: 9 },
  { key: 'quantity', label: 'Quantity', pdfWidth: 12, excelWidth: 10, alwaysVisible: true },
  { key: 'unit', label: 'Unit', pdfWidth: 12, excelWidth: 10, alwaysVisible: true },
  { key: 'unitCost', label: 'Unit Cost', pdfWidth: 15, excelWidth: 13, alwaysVisible: true },
  { key: 'totalCost', label: 'Total Cost', pdfWidth: 16, excelWidth: 14, alwaysVisible: true },
];

const TAKEOFF_PDF_ROW_HEIGHT = 34;
const TAKEOFF_EXCEL_ROW_HEIGHT = 56;
const TAKEOFF_PDF_CELL_PADDING = 1.6;
const TAKEOFF_SWATCH_LIMIT = 4;

function filteredTakeoffCategories(categories: TakeoffCategoryWithItems[]) {
  return categories.filter((category) => category.items.length > 0);
}

function takeoffPreparedBy(profile?: UserProfile | null) {
  return [profile?.name?.trim(), profile?.email?.trim()].filter(Boolean).join(' | ');
}

function takeoffProjectLine(project: Project) {
  return [project.name, project.projectLocation?.trim()].filter(Boolean).join(' | ');
}

function takeoffDocumentCompany(project: Project) {
  return project.companyName?.trim() || 'ChillDesignStudio';
}

function takeoffCompactIdentityLine(project: Project) {
  return [takeoffDocumentCompany(project), project.name, project.projectLocation?.trim()]
    .filter(Boolean)
    .join(' | ');
}

function getTakeoffBudgetTarget(project: Project) {
  const relevant =
    project.budgetMode === 'individual'
      ? (project.takeoffBudgetCents ?? 0)
      : (project.budgetCents ?? 0);
  return relevant > 0 ? relevant : null;
}

function buildTakeoffVisibleColumns(
  categories: TakeoffCategoryWithItems[],
  assets: TakeoffAssetBundle,
): TakeoffExportColumn[] {
  const items = categories.flatMap((category) => category.items);
  const hasRendering = items.some((item) => assets.renderingByItemId.has(item.id));
  const hasSwatches = items.some((item) => (assets.swatchesByItemId.get(item.id)?.length ?? 0) > 0);

  return TAKEOFF_EXPORT_COLUMNS.filter((column) => {
    if (column.key === 'rendering') return hasRendering;
    if (column.key === 'swatch') return hasSwatches;
    if (column.alwaysVisible) return true;
    return items.some((item) => takeoffColumnHasData(item, column.key));
  });
}

function buildTakeoffRowValue(item: TakeoffItem, key: TakeoffExportColumnKey) {
  switch (key) {
    case 'drawingsLocation': {
      const parts = [item.drawings.trim(), item.location.trim()].filter(Boolean);
      if (parts.length === 2) return `${parts[0]}\n${parts[1]}`;
      return parts[0] ?? '';
    }
    default:
      return takeoffWrappedCellValue(item, key);
  }
}

function buildTakeoffExportDocument(
  project: Project,
  categories: TakeoffCategoryWithItems[],
  assets: TakeoffAssetBundle,
  userProfile?: UserProfile | null,
): TakeoffExportDocument {
  const columns = buildTakeoffVisibleColumns(categories, assets);
  const categorySections = categories.map((category) => ({
    category,
    subtotalCents: takeoffCategorySubtotalCents(category.items),
    quantityTotal: category.items.reduce((sum, item) => sum + item.quantity, 0),
    rows: category.items.map((item) => ({
      item,
      rendering: assets.renderingByItemId.get(item.id) ?? null,
      swatches: assets.swatchesByItemId.get(item.id) ?? [],
      values: Object.fromEntries(
        TAKEOFF_EXPORT_COLUMNS.map((column) => [
          column.key,
          buildTakeoffRowValue(item, column.key),
        ]),
      ) as Record<TakeoffExportColumnKey, string>,
    })),
  }));

  return {
    companyName: takeoffDocumentCompany(project),
    projectLine: takeoffProjectLine(project),
    preparedByLine: takeoffPreparedBy(userProfile),
    compactIdentityLine: takeoffCompactIdentityLine(project),
    projectImages: assets.projectImages,
    columns,
    categories: categorySections,
    grandTotalCents: takeoffProjectTotalCents(categories),
    budgetTargetCents: getTakeoffBudgetTarget(project),
  };
}

function takeoffColumnHasData(item: TakeoffItem, key: TakeoffExportColumnKey) {
  switch (key) {
    case 'plan':
      return Boolean(item.plan.trim());
    case 'drawingsLocation':
      return Boolean(item.drawings.trim() || item.location.trim());
    case 'description':
      return Boolean(item.description.trim());
    case 'size':
      return Boolean(item.sizeLabel.trim());
    case 'cbm':
      return item.cbm > 0;
    case 'quantity':
      return true;
    case 'unit':
      return true;
    case 'unitCost':
      return true;
    case 'totalCost':
      return true;
    case 'productTag':
      return true;
    case 'rendering':
    case 'swatch':
      return false;
  }
}

function takeoffCellValue(item: TakeoffItem, key: TakeoffExportColumnKey) {
  switch (key) {
    case 'productTag':
      return item.productTag || '';
    case 'plan':
      return item.plan || '';
    case 'drawingsLocation':
      return [item.drawings, item.location].filter(Boolean).join(' / ');
    case 'description':
      return item.description || '';
    case 'size':
      return item.sizeLabel || '';
    case 'cbm':
      return item.cbm > 0 ? String(item.cbm) : '';
    case 'quantity':
      return String(item.quantity);
    case 'unit':
      return item.quantityUnit || '';
    case 'unitCost':
      return fmtMoney(item.unitCostCents || 0);
    case 'totalCost':
      return fmtMoney(takeoffLineTotalCents(item));
    case 'rendering':
    case 'swatch':
      return '';
  }
}

function truncateTakeoffText(value: string, maxChars: number) {
  const normalized = value.trim();
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, Math.max(0, maxChars - 1)).trimEnd()}…`;
}

function takeoffWrappedCellValue(item: TakeoffItem, key: TakeoffExportColumnKey) {
  const value = takeoffCellValue(item, key);
  if (key === 'description') return truncateTakeoffText(value, 96);
  if (key === 'drawingsLocation') return truncateTakeoffText(value, 48);
  if (key === 'size') return truncateTakeoffText(value, 30);
  if (key === 'plan') return truncateTakeoffText(value, 24);
  return value;
}

async function blobToPngDataUrl(blob: Blob): Promise<string> {
  const objectUrl = URL.createObjectURL(blob);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const nextImage = new Image();
      nextImage.onload = () => resolve(nextImage);
      nextImage.onerror = () => reject(new Error('Unable to load export image.'));
      nextImage.src = objectUrl;
    });

    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth || image.width || 1;
    canvas.height = image.naturalHeight || image.height || 1;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Unable to prepare export image.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function imageAssetToPngDataUrl(image: ImageAsset): Promise<string | null> {
  try {
    return await blobToPngDataUrl(await api.images.getContentBlob(image.id));
  } catch {
    return null;
  }
}

async function buildTakeoffAssetBundle(
  projectId: string,
  categories: TakeoffCategoryWithItems[],
): Promise<TakeoffAssetBundle> {
  const projectImages = await api.images.list({ entityType: 'project', entityId: projectId });
  const projectImageData = await Promise.all(
    projectImages.slice(0, 3).map(async (image) => imageAssetToPngDataUrl(image)),
  );

  const renderingByItemId = new Map<string, string>();
  const swatchesByItemId = new Map<string, string[]>();
  const items = categories.flatMap((category) => category.items);

  await Promise.all(
    items.map(async (item) => {
      const [renderingImages, swatchImages] = await Promise.all([
        api.images.list({ entityType: 'takeoff_item', entityId: item.id }),
        api.images.list({ entityType: 'takeoff_swatch', entityId: item.id }),
      ]);

      const rendering = renderingImages[0];
      if (rendering) {
        const dataUrl = await imageAssetToPngDataUrl(rendering);
        if (dataUrl) renderingByItemId.set(item.id, dataUrl);
      }

      const swatchData = await Promise.all(
        swatchImages
          .slice(0, TAKEOFF_SWATCH_LIMIT)
          .map(async (image) => imageAssetToPngDataUrl(image)),
      );
      const resolvedSwatches = swatchData.filter((value): value is string => Boolean(value));
      if (resolvedSwatches.length > 0) {
        swatchesByItemId.set(item.id, resolvedSwatches);
      }
    }),
  );

  return {
    projectImages: projectImageData.filter((value): value is string => Boolean(value)),
    renderingByItemId,
    swatchesByItemId,
  };
}

function drawPdfPageNumber(doc: jsPDF, pageNumber: number, totalPages: number) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(130, 130, 130);
  doc.text(`${pageNumber} / ${totalPages}`, pageWidth - 12, pageHeight - 6, { align: 'right' });
}

function drawPdfSmallIdentityHeader(doc: jsPDF, project: Project) {
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text(takeoffCompactIdentityLine(project), pageWidth / 2, 10, { align: 'center' });
}

function drawPdfCategoryBand(doc: jsPDF, label: string, y: number) {
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFillColor(243, 246, 244);
  doc.setDrawColor(225, 231, 228);
  doc.roundedRect(12, y - 6, pageWidth - 24, 10, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(BRAND[0], BRAND[1], BRAND[2]);
  doc.text(label.toUpperCase(), 16, y);
}

function addPdfCoverImage(
  doc: jsPDF,
  dataUrl: string,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const imageProps = doc.getImageProperties(dataUrl);
  const scale = Math.max(width / imageProps.width, height / imageProps.height);
  const drawWidth = imageProps.width * scale;
  const drawHeight = imageProps.height * scale;
  const offsetX = x - (drawWidth - width) / 2;
  const offsetY = y - (drawHeight - height) / 2;

  doc.saveGraphicsState();
  doc.rect(x, y, width, height);
  doc.clip();
  doc.addImage(dataUrl, 'PNG', offsetX, offsetY, drawWidth, drawHeight);
  doc.restoreGraphicsState();
}

function drawPdfImageFrame(doc: jsPDF, x: number, y: number, width: number, height: number) {
  doc.setFillColor(245, 245, 242);
  doc.setDrawColor(220, 220, 220);
  doc.rect(x, y, width, height, 'FD');
}

function drawPdfProjectImageBand(doc: jsPDF, projectImages: string[], y: number) {
  const bandWidth = 222;
  const slotWidth = 68;
  const slotHeight = 38;
  const gap = 9;
  const startX = (doc.internal.pageSize.getWidth() - bandWidth) / 2;

  [0, 1, 2].forEach((slot) => {
    const x = startX + slot * (slotWidth + gap);
    const image = projectImages[slot];
    if (image) {
      drawPdfImageFrame(doc, x, y, slotWidth, slotHeight);
      addPdfCoverImage(doc, image, x, y, slotWidth, slotHeight);
    }
  });
}

function drawPdfTakeoffHeaderBlock(doc: jsPDF, exportDoc: TakeoffExportDocument) {
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(BRAND[0], BRAND[1], BRAND[2]);
  doc.text(exportDoc.companyName.toUpperCase(), pageWidth / 2, 16, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  doc.text(exportDoc.projectLine, pageWidth / 2, 24, { align: 'center' });

  if (exportDoc.preparedByLine) {
    doc.setFontSize(9);
    doc.text(`Quote prepared by ${exportDoc.preparedByLine}`, pageWidth / 2, 31, {
      align: 'center',
    });
  }

  if (exportDoc.projectImages.length > 0) {
    drawPdfProjectImageBand(doc, exportDoc.projectImages, 38);
  }
}

function drawPdfBudgetSummaryPage(doc: jsPDF, project: Project, exportDoc: TakeoffExportDocument) {
  doc.addPage();
  drawPdfSmallIdentityHeader(doc, project);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(BRAND[0], BRAND[1], BRAND[2]);
  doc.text('Budget Summary', 14, 22);

  const body = exportDoc.categories.map((section) => [
    section.category.name,
    String(section.category.items.length),
    fmtMoney(section.subtotalCents),
  ]);
  body.push(['Grand Total', '', fmtMoney(exportDoc.grandTotalCents)]);
  if (exportDoc.budgetTargetCents !== null) {
    body.push(['Budget Target', '', fmtMoney(exportDoc.budgetTargetCents)]);
  }

  autoTable(doc, {
    startY: 28,
    head: [['Category', 'Rows', 'Total']],
    body,
    theme: 'grid',
    headStyles: {
      fillColor: [243, 246, 244],
      textColor: [...BRAND] as [number, number, number],
      fontStyle: 'bold',
    },
    bodyStyles: {
      fontSize: 9,
      textColor: [40, 40, 40],
    },
    didParseCell: (hook) => {
      if (hook.section === 'body' && hook.row.index >= exportDoc.categories.length) {
        hook.cell.styles.fontStyle = 'bold';
        hook.cell.styles.fillColor = [249, 250, 249];
      }
    },
    columnStyles: {
      1: { halign: 'center' },
      2: { halign: 'right' },
    },
  });
}

function takeoffSubtotalLabelColumnIndex(columns: TakeoffExportColumn[]) {
  const preferredKeys: TakeoffExportColumnKey[] = ['description', 'drawingsLocation', 'productTag'];
  for (const key of preferredKeys) {
    const index = columns.findIndex((column) => column.key === key);
    if (index >= 0) return index;
  }
  return Math.max(0, columns.length - 2);
}

function drawPdfTakeoffTable(
  doc: jsPDF,
  project: Project,
  section: TakeoffExportCategorySection,
  columns: TakeoffExportColumn[],
  startY: number,
  options: {
    drawOverflowHeader: boolean;
  },
) {
  const subtotalLabelIndex = takeoffSubtotalLabelColumnIndex(columns);
  const body = section.rows.map((row) => columns.map((column) => row.values[column.key]));
  body.push(
    columns.map((_column, index) => {
      if (index === subtotalLabelIndex) return `${section.category.name} subtotal`;
      if (index === columns.length - 1) return fmtMoney(section.subtotalCents);
      return '';
    }),
  );

  autoTable(doc, {
    startY,
    head: [columns.map((column) => column.label)],
    body,
    theme: 'grid',
    margin: { left: 12, right: 12, top: 24 },
    headStyles: {
      fillColor: [236, 239, 236],
      textColor: [50, 50, 50],
      fontSize: 7,
      fontStyle: 'bold',
      halign: 'center',
    },
    bodyStyles: {
      fontSize: 7.2,
      textColor: [55, 55, 55],
      valign: 'middle',
      cellPadding: TAKEOFF_PDF_CELL_PADDING,
      overflow: 'linebreak',
      minCellHeight: TAKEOFF_PDF_ROW_HEIGHT,
    },
    columnStyles: Object.fromEntries(
      columns.map((column, index) => [
        index,
        {
          cellWidth: column.pdfWidth,
          halign:
            column.key === 'quantity' ||
            column.key === 'unit' ||
            column.key === 'unitCost' ||
            column.key === 'totalCost' ||
            column.key === 'cbm'
              ? 'center'
              : 'left',
        },
      ]),
    ),
    didParseCell: (hook) => {
      if (hook.section === 'body' && hook.row.index === body.length - 1) {
        hook.cell.styles.fontStyle = 'bold';
        hook.cell.styles.fillColor = [249, 250, 249];
      }
    },
    didDrawPage: (hook) => {
      if (options.drawOverflowHeader && hook.pageNumber > 1) {
        drawPdfSmallIdentityHeader(doc, project);
        drawPdfCategoryBand(doc, section.category.name, 18);
      }
    },
    didDrawCell: (hook) => {
      if (hook.section !== 'body' || hook.row.index >= section.rows.length) return;
      const row = section.rows[hook.row.index];
      if (!row) return;
      const column = columns[hook.column.index];
      if (!column) return;

      if (column.key === 'rendering') {
        const frameX = hook.cell.x + TAKEOFF_PDF_CELL_PADDING;
        const frameY = hook.cell.y + TAKEOFF_PDF_CELL_PADDING;
        const frameWidth = hook.cell.width - TAKEOFF_PDF_CELL_PADDING * 2;
        const frameHeight = hook.cell.height - TAKEOFF_PDF_CELL_PADDING * 2;
        drawPdfImageFrame(doc, frameX, frameY, frameWidth, frameHeight);
        if (row.rendering) {
          addPdfCoverImage(doc, row.rendering, frameX, frameY, frameWidth, frameHeight);
        }
      }

      if (column.key === 'swatch') {
        const swatches = row.swatches;
        if (swatches.length === 0) return;
        const frameWidth = hook.cell.width - TAKEOFF_PDF_CELL_PADDING * 2;
        const frameHeight = hook.cell.height - TAKEOFF_PDF_CELL_PADDING * 2;
        const gap = TAKEOFF_PDF_CELL_PADDING;
        const swatchHeight = Math.max(
          5,
          Math.floor((frameHeight - gap * Math.max(0, swatches.length - 1)) / swatches.length),
        );
        swatches.slice(0, TAKEOFF_SWATCH_LIMIT).forEach((swatch, index) => {
          const y = hook.cell.y + TAKEOFF_PDF_CELL_PADDING + index * (swatchHeight + gap);
          drawPdfImageFrame(
            doc,
            hook.cell.x + TAKEOFF_PDF_CELL_PADDING,
            y,
            frameWidth,
            swatchHeight,
          );
          addPdfCoverImage(
            doc,
            swatch,
            hook.cell.x + TAKEOFF_PDF_CELL_PADDING,
            y,
            frameWidth,
            swatchHeight,
          );
        });
      }
    },
  });
}

function addExcelImage(
  worksheet: Worksheet,
  imageId: number,
  position: {
    tl: { col: number; row: number };
    br: { col: number; row: number };
  },
) {
  worksheet.addImage(imageId, {
    tl: position.tl as never,
    br: position.br as never,
    editAs: 'oneCell',
  });
}

export async function exportTakeoffExcel(
  project: Project,
  categories: TakeoffCategoryWithItems[],
  userProfile?: UserProfile | null,
): Promise<void> {
  const { Workbook } = await import('exceljs');
  const exportCategories = filteredTakeoffCategories(categories);
  const assets = await buildTakeoffAssetBundle(project.id, exportCategories);
  const exportDoc = buildTakeoffExportDocument(project, exportCategories, assets, userProfile);
  const columns = exportDoc.columns;

  const workbook = new Workbook();
  const worksheet = workbook.addWorksheet('Take-Off');
  worksheet.views = [{ state: 'frozen', ySplit: 0 }];
  worksheet.pageSetup = {
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: {
      left: 0.3,
      right: 0.3,
      top: 0.45,
      bottom: 0.45,
      header: 0.15,
      footer: 0.2,
    },
  };

  columns.forEach((column, index) => {
    worksheet.getColumn(index + 1).width = column.excelWidth;
  });

  let currentRow = 1;
  const endColumn = Math.max(columns.length, 1);
  const subtotalLabelIndex = takeoffSubtotalLabelColumnIndex(columns);

  worksheet.mergeCells(currentRow, 1, currentRow, endColumn);
  const companyCell = worksheet.getCell(currentRow, 1);
  companyCell.value = exportDoc.companyName.toUpperCase();
  companyCell.font = { name: 'Helvetica', size: 16, bold: true, color: { argb: 'FF1A6B4A' } };
  companyCell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(currentRow).height = 22;
  currentRow += 1;

  worksheet.mergeCells(currentRow, 1, currentRow, endColumn);
  const projectCell = worksheet.getCell(currentRow, 1);
  projectCell.value = exportDoc.projectLine;
  projectCell.font = { name: 'Helvetica', size: 11, color: { argb: 'FF4B5563' } };
  projectCell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(currentRow).height = 18;
  currentRow += 1;

  if (exportDoc.preparedByLine) {
    worksheet.mergeCells(currentRow, 1, currentRow, endColumn);
    const preparedCell = worksheet.getCell(currentRow, 1);
    preparedCell.value = `Quote prepared by ${exportDoc.preparedByLine}`;
    preparedCell.font = { name: 'Helvetica', size: 10, color: { argb: 'FF6B7280' } };
    preparedCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(currentRow).height = 16;
    currentRow += 1;
  }

  if (exportDoc.projectImages.length > 0) {
    const slotRanges = [
      { start: 1, end: Math.max(1, Math.floor(endColumn / 3)) },
      {
        start: Math.max(1, Math.floor(endColumn / 3)) + 1,
        end: Math.max(2, Math.floor((endColumn * 2) / 3)),
      },
      { start: Math.max(3, Math.floor((endColumn * 2) / 3)) + 1, end: endColumn },
    ].map((range) => ({
      start: Math.min(range.start, endColumn),
      end: Math.max(Math.min(range.end, endColumn), Math.min(range.start, endColumn)),
    }));
    const imageStartRow = currentRow;
    worksheet.getRow(imageStartRow).height = 96;
    [0, 1, 2].forEach((slot) => {
      const range = slotRanges[slot] ?? { start: 1, end: endColumn };
      const image = exportDoc.projectImages[slot];
      if (!image) return;
      const imageId = workbook.addImage({
        base64: image,
        extension: 'png',
      });
      addExcelImage(worksheet, imageId, {
        tl: { col: range.start - 1 + 0.1, row: imageStartRow - 1 + 0.08 },
        br: { col: range.end - 0.08, row: imageStartRow + 0.92 },
      });
    });
    currentRow += 2;
  } else {
    currentRow += 1;
  }

  for (const section of exportDoc.categories) {
    worksheet.mergeCells(currentRow, 1, currentRow, endColumn);
    const categoryCell = worksheet.getCell(currentRow, 1);
    categoryCell.value = section.category.name.toUpperCase();
    categoryCell.font = { name: 'Helvetica', size: 11, bold: true, color: { argb: 'FF1A6B4A' } };
    categoryCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF1F5F2' },
    };
    categoryCell.alignment = { vertical: 'middle' };
    worksheet.getRow(currentRow).height = 20;
    currentRow += 1;

    const headerRow = worksheet.getRow(currentRow);
    columns.forEach((column, index) => {
      const cell = headerRow.getCell(index + 1);
      cell.value = column.label;
      cell.font = { name: 'Helvetica', size: 9, bold: true, color: { argb: 'FF374151' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFECEFEA' },
      };
      cell.border = thinBorder();
    });
    headerRow.height = 24;
    currentRow += 1;

    for (const rowData of section.rows) {
      const row = worksheet.getRow(currentRow);
      row.height = TAKEOFF_EXCEL_ROW_HEIGHT;
      columns.forEach((column, index) => {
        const cell = row.getCell(index + 1);
        cell.value = rowData.values[column.key];
        cell.font = { name: 'Helvetica', size: 9, color: { argb: 'FF374151' } };
        cell.alignment = {
          vertical: column.key === 'rendering' || column.key === 'swatch' ? 'middle' : 'top',
          horizontal:
            column.key === 'quantity' ||
            column.key === 'unit' ||
            column.key === 'unitCost' ||
            column.key === 'totalCost' ||
            column.key === 'cbm'
              ? 'center'
              : 'left',
          wrapText: column.key !== 'rendering' && column.key !== 'swatch',
          shrinkToFit: false,
        };
        cell.border = thinBorder();
      });

      const renderingColumn = columns.findIndex((column) => column.key === 'rendering');
      const swatchColumn = columns.findIndex((column) => column.key === 'swatch');
      if (renderingColumn >= 0) {
        if (rowData.rendering) {
          const imageId = workbook.addImage({ base64: rowData.rendering, extension: 'png' });
          addExcelImage(worksheet, imageId, {
            tl: { col: renderingColumn + 0.08, row: currentRow - 1 + 0.08 },
            br: { col: renderingColumn + 0.92, row: currentRow - 1 + 0.92 },
          });
        }
        const cell = row.getCell(renderingColumn + 1);
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F2' } };
      }

      if (swatchColumn >= 0) {
        const swatches = rowData.swatches;
        const swatchCell = row.getCell(swatchColumn + 1);
        swatchCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F2' } };
        swatches.slice(0, TAKEOFF_SWATCH_LIMIT).forEach((swatch, index) => {
          const imageId = workbook.addImage({ base64: swatch, extension: 'png' });
          const gap = 0.035;
          const slotHeight = Math.max(0.12, (0.8 - gap * (swatches.length - 1)) / swatches.length);
          const top = currentRow - 1 + 0.08 + index * (slotHeight + gap);
          addExcelImage(worksheet, imageId, {
            tl: { col: swatchColumn + 0.16, row: top },
            br: { col: swatchColumn + 0.84, row: top + slotHeight },
          });
        });
      }

      currentRow += 1;
    }

    const subtotalRow = worksheet.getRow(currentRow);
    columns.forEach((_column, index) => {
      const cell = subtotalRow.getCell(index + 1);
      if (index === subtotalLabelIndex) {
        cell.value = `${section.category.name} subtotal`;
      } else if (index === columns.length - 1) {
        cell.value = fmtMoney(section.subtotalCents);
      } else {
        cell.value = '';
      }
      cell.font = { name: 'Helvetica', size: 9, bold: true, color: { argb: 'FF1A6B4A' } };
      cell.alignment = {
        vertical: 'middle',
        horizontal: index === columns.length - 1 ? 'center' : 'left',
      };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF9FAF9' },
      };
      cell.border = thinBorder();
    });
    subtotalRow.height = 20;
    currentRow += 2;
  }

  worksheet.mergeCells(currentRow, 1, currentRow, endColumn);
  const summaryTitle = worksheet.getCell(currentRow, 1);
  summaryTitle.value = 'BUDGET SUMMARY';
  summaryTitle.font = { name: 'Helvetica', size: 11, bold: true, color: { argb: 'FF1A6B4A' } };
  summaryTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F2' } };
  summaryTitle.alignment = { vertical: 'middle' };
  worksheet.getRow(currentRow).height = 20;
  currentRow += 1;

  worksheet.getCell(currentRow, 1).value = 'Category';
  worksheet.getCell(currentRow, 2).value = 'Rows';
  worksheet.getCell(currentRow, 3).value = 'Total';
  [1, 2, 3].forEach((columnIndex) => {
    const cell = worksheet.getCell(currentRow, columnIndex);
    cell.font = { name: 'Helvetica', size: 9, bold: true, color: { argb: 'FF374151' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECEFEA' } };
    cell.border = thinBorder();
    cell.alignment = {
      horizontal: columnIndex === 1 ? 'left' : 'center',
      vertical: 'middle',
    };
  });
  currentRow += 1;

  exportDoc.categories.forEach((section) => {
    worksheet.getCell(currentRow, 1).value = section.category.name;
    worksheet.getCell(currentRow, 2).value = section.category.items.length;
    worksheet.getCell(currentRow, 3).value = fmtMoney(section.subtotalCents);
    worksheet.getCell(currentRow, 1).border = thinBorder();
    worksheet.getCell(currentRow, 2).border = thinBorder();
    worksheet.getCell(currentRow, 3).border = thinBorder();
    currentRow += 1;
  });
  worksheet.getCell(currentRow, 1).value = 'Grand Total';
  worksheet.getCell(currentRow, 3).value = fmtMoney(exportDoc.grandTotalCents);
  worksheet.getCell(currentRow, 1).font = { name: 'Helvetica', size: 9, bold: true };
  worksheet.getCell(currentRow, 3).font = { name: 'Helvetica', size: 9, bold: true };
  worksheet.getCell(currentRow, 1).border = thinBorder();
  worksheet.getCell(currentRow, 2).border = thinBorder();
  worksheet.getCell(currentRow, 3).border = thinBorder();
  currentRow += 1;
  if (exportDoc.budgetTargetCents !== null) {
    worksheet.getCell(currentRow, 1).value = 'Budget Target';
    worksheet.getCell(currentRow, 3).value = fmtMoney(exportDoc.budgetTargetCents);
    worksheet.getCell(currentRow, 1).border = thinBorder();
    worksheet.getCell(currentRow, 2).border = thinBorder();
    worksheet.getCell(currentRow, 3).border = thinBorder();
  }

  const buffer = await workbook.xlsx.writeBuffer();
  triggerDownload(
    new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    `${safeName(project.name)}-takeoff.xlsx`,
  );
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

export async function exportTakeoffPdf(
  project: Project,
  categories: TakeoffCategoryWithItems[],
  userProfile?: UserProfile | null,
  options: TakeoffPdfOptions = {},
): Promise<void> {
  const mode = options.mode ?? 'continuous';
  const exportCategories = filteredTakeoffCategories(categories);
  const assets = await buildTakeoffAssetBundle(project.id, exportCategories);
  const exportDoc = buildTakeoffExportDocument(project, exportCategories, assets, userProfile);
  const columns = exportDoc.columns;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  if (mode === 'separated') {
    drawPdfTakeoffHeaderBlock(doc, exportDoc);
    for (const [index, section] of exportDoc.categories.entries()) {
      if (index > 0 || doc.getNumberOfPages() > 0) doc.addPage();
      drawPdfSmallIdentityHeader(doc, project);
      drawPdfCategoryBand(doc, section.category.name, 18);
      drawPdfTakeoffTable(doc, project, section, columns, 24, {
        drawOverflowHeader: true,
      });
    }
    drawPdfBudgetSummaryPage(doc, project, exportDoc);
  } else {
    drawPdfTakeoffHeaderBlock(doc, exportDoc);
    let startY = exportDoc.projectImages.length > 0 ? 82 : 40;
    exportDoc.categories.forEach((section, index) => {
      const pageHeight = doc.internal.pageSize.getHeight();
      if (startY + 18 > pageHeight - 18) {
        doc.addPage();
        drawPdfSmallIdentityHeader(doc, project);
        startY = 18;
      }
      drawPdfCategoryBand(doc, section.category.name, startY);
      drawPdfTakeoffTable(doc, project, section, columns, startY + 6, {
        drawOverflowHeader: index === 0 || doc.getCurrentPageInfo().pageNumber > 1,
      });
      startY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
    });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(BRAND[0], BRAND[1], BRAND[2]);
    doc.text(`Grand total: ${fmtMoney(exportDoc.grandTotalCents)}`, 14, startY);
  }

  const totalPages = doc.getNumberOfPages();
  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page);
    drawPdfPageNumber(doc, page, totalPages);
  }

  doc.save(`${safeName(project.name)}-takeoff.pdf`);
}

function thinBorder() {
  return {
    top: { style: 'thin' as const, color: { argb: 'FFE5E7EB' } },
    left: { style: 'thin' as const, color: { argb: 'FFE5E7EB' } },
    bottom: { style: 'thin' as const, color: { argb: 'FFE5E7EB' } },
    right: { style: 'thin' as const, color: { argb: 'FFE5E7EB' } },
  };
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
