import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { roomSubtotalCents, projectTotalCents, sellPriceCents } from './calc';
import { BRAND_RGB } from './constants';
import { api } from './api';
import { csvCell, fmtMoney, fmtPct, safeName, triggerDownload } from './export/shared';
import {
  addExcelCircularCoverImage,
  addExcelContainImage,
  addExcelCoverImage,
  cropDataUrlToCover,
  excelEqualWidthSlotPlacement,
  excelPaddedCellPlacement,
  imageAssetToPngDataUrl,
} from './export/imageHelpers';
import { buildProposalAssetBundle } from './export/proposalAssets';
import {
  TABLE_HEADERS,
  buildStatusBreakdown,
  buildVendorBreakdown,
  itemToRow,
  sortedItems,
} from './export/ffeRows';
import {
  buildProposalExportDocument,
  filteredProposalCategories,
  proposalCompactIdentityLine,
  type ProposalExportCategorySection,
  type ProposalExportColumn,
  type ProposalExportColumnKey,
  type ProposalExportDocument,
} from './export/proposalDocument';
import type { Item, Material, Project, ProposalCategoryWithItems, UserProfile } from '../types';
import type { RoomWithItems } from '../types';

export { safeName } from './export/shared';
export { exportProposalCsv, exportSummaryCsv, exportTableCsv } from './export/csv';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BRAND = BRAND_RGB;

// ─── CSV ──────────────────────────────────────────────────────────────────────

// ─── Excel ────────────────────────────────────────────────────────────────────

// Fetches the primary image data URL for each item in the given rooms.
async function buildFfeItemImages(rooms: RoomWithItems[]): Promise<Map<string, string | null>> {
  const items = rooms.flatMap((r) => r.items);
  const entries = await Promise.all(
    items.map(async (item) => {
      const images = await api.images.list({ entityType: 'item', entityId: item.id });
      const primary = images.find((img) => img.isPrimary) ?? images[0];
      if (!primary) return [item.id, null] as const;
      return [item.id, await imageAssetToPngDataUrl(primary)] as const;
    }),
  );
  return new Map(entries);
}

const FFE_EXCEL_COLS = [
  { key: 'image', label: 'Image', width: 16 },
  { key: 'itemIdTag', label: 'Item ID', width: 14 },
  { key: 'itemName', label: 'Item Name', width: 24 },
  { key: 'category', label: 'Category', width: 16 },
  { key: 'vendor', label: 'Vendor', width: 18 },
  { key: 'model', label: 'Model', width: 16 },
  { key: 'dimensions', label: 'Dimensions', width: 16 },
  { key: 'qty', label: 'Qty', width: 8 },
  { key: 'unitCost', label: 'Unit Cost', width: 13 },
  { key: 'markup', label: 'Markup', width: 10 },
  { key: 'sellPrice', label: 'Sell Price', width: 13 },
  { key: 'lineTotal', label: 'Line Total', width: 13 },
  { key: 'status', label: 'Status', width: 14 },
  { key: 'leadTime', label: 'Lead Time', width: 12 },
  { key: 'notes', label: 'Notes', width: 24 },
  { key: 'materials', label: 'Materials', width: 24 },
] as const;

type FfeExcelColKey = (typeof FFE_EXCEL_COLS)[number]['key'];

const FFE_EXCEL_NUMERIC_KEYS: Set<FfeExcelColKey> = new Set([
  'qty',
  'unitCost',
  'markup',
  'sellPrice',
  'lineTotal',
]);

const FFE_EXCEL_ROW_HEIGHT = 56;

export async function exportTableExcel(
  project: Project,
  rooms: RoomWithItems[],
  filterRoom?: RoomWithItems,
): Promise<void> {
  const { Workbook } = await import('exceljs');
  const targetRooms = filterRoom ? [filterRoom] : rooms;
  const imageMap = await buildFfeItemImages(targetRooms);

  const workbook = new Workbook();
  const worksheet = workbook.addWorksheet('FF&E');
  worksheet.views = [{ state: 'frozen', ySplit: 0 }];
  worksheet.pageSetup = {
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.3, right: 0.3, top: 0.45, bottom: 0.45, header: 0.15, footer: 0.2 },
  };

  const endColumn = FFE_EXCEL_COLS.length;
  FFE_EXCEL_COLS.forEach((col, i) => {
    worksheet.getColumn(i + 1).width = col.width;
  });

  let currentRow = 1;

  // ── Title rows ──
  worksheet.mergeCells(currentRow, 1, currentRow, endColumn);
  const companyCell = worksheet.getCell(currentRow, 1);
  companyCell.value = (project.companyName?.trim() || project.name).toUpperCase();
  companyCell.font = { name: 'Helvetica', size: 16, bold: true, color: { argb: 'FF1A6B4A' } };
  companyCell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(currentRow).height = 22;
  currentRow += 1;

  worksheet.mergeCells(currentRow, 1, currentRow, endColumn);
  const projectCell = worksheet.getCell(currentRow, 1);
  projectCell.value = [project.name, project.projectLocation?.trim()].filter(Boolean).join(' | ');
  projectCell.font = { name: 'Helvetica', size: 11, color: { argb: 'FF4B5563' } };
  projectCell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(currentRow).height = 18;
  currentRow += 2;

  const lineIndex = FFE_EXCEL_COLS.findIndex((c) => c.key === 'lineTotal');
  const nameIndex = FFE_EXCEL_COLS.findIndex((c) => c.key === 'itemName');

  for (const room of targetRooms) {
    // ── Room band ──
    worksheet.mergeCells(currentRow, 1, currentRow, endColumn);
    const roomCell = worksheet.getCell(currentRow, 1);
    roomCell.value = room.name.toUpperCase();
    roomCell.font = { name: 'Helvetica', size: 11, bold: true, color: { argb: 'FF1A6B4A' } };
    roomCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F2' } };
    roomCell.alignment = { vertical: 'middle' };
    worksheet.getRow(currentRow).height = 20;
    currentRow += 1;

    // ── Column headers ──
    const headerRow = worksheet.getRow(currentRow);
    FFE_EXCEL_COLS.forEach((col, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = col.label;
      cell.font = { name: 'Helvetica', size: 9, bold: true, color: { argb: 'FF374151' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECEFEA' } };
      cell.border = thinBorder();
    });
    headerRow.height = 24;
    currentRow += 1;

    // ── Item rows ──
    for (const item of sortedItems(room)) {
      const row = worksheet.getRow(currentRow);
      row.height = FFE_EXCEL_ROW_HEIGHT;

      const sellPrice = sellPriceCents(item.unitCostCents, item.markupPct);
      const values: Record<FfeExcelColKey, string> = {
        image: '',
        itemIdTag: item.itemIdTag ?? '',
        itemName: item.itemName,
        category: item.category ?? '',
        vendor: item.vendor ?? '',
        model: item.model ?? '',
        dimensions: item.dimensions ?? '',
        qty: String(item.qty),
        unitCost: fmtMoney(item.unitCostCents),
        markup: fmtPct(item.markupPct),
        sellPrice: fmtMoney(sellPrice),
        lineTotal: fmtMoney(sellPrice * item.qty),
        status: item.status,
        leadTime: item.leadTime ?? '',
        notes: item.notes ?? '',
        materials: item.materials
          .map((m) => (m.materialId ? `${m.name} (${m.materialId})` : m.name))
          .join('; '),
      };

      FFE_EXCEL_COLS.forEach((col, i) => {
        const cell = row.getCell(i + 1);
        cell.value = col.key === 'image' ? '' : values[col.key];
        cell.font = { name: 'Helvetica', size: 9, color: { argb: 'FF374151' } };
        cell.alignment = {
          vertical: col.key === 'image' ? 'middle' : 'top',
          horizontal: FFE_EXCEL_NUMERIC_KEYS.has(col.key) ? 'center' : 'left',
          wrapText: col.key !== 'image',
          shrinkToFit: false,
        };
        cell.border = thinBorder();
      });

      const imageDataUrl = imageMap.get(item.id);
      if (imageDataUrl) {
        const imageColIndex = 0; // 0-based index of 'image' column
        const placement = excelPaddedCellPlacement(
          imageColIndex,
          currentRow,
          FFE_EXCEL_COLS[imageColIndex].width,
          FFE_EXCEL_ROW_HEIGHT,
        );
        await addExcelContainImage(workbook, worksheet, imageDataUrl, placement);
      }

      currentRow += 1;
    }

    // ── Room subtotal ──
    const subtotal = roomSubtotalCents(room.items);
    const subtotalRow = worksheet.getRow(currentRow);
    FFE_EXCEL_COLS.forEach((_col, i) => {
      const cell = subtotalRow.getCell(i + 1);
      if (i === nameIndex) {
        cell.value = `${room.name} subtotal`;
      } else if (i === lineIndex) {
        cell.value = fmtMoney(subtotal);
      } else {
        cell.value = '';
      }
      cell.font = { name: 'Helvetica', size: 9, bold: true, color: { argb: 'FF1A6B4A' } };
      cell.alignment = { vertical: 'middle', horizontal: i === lineIndex ? 'center' : 'left' };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAF9' } };
      cell.border = thinBorder();
    });
    subtotalRow.height = 20;
    currentRow += 2;
  }

  // ── Grand total ──
  const grandTotal = projectTotalCents(rooms);
  const totalRow = worksheet.getRow(currentRow);
  FFE_EXCEL_COLS.forEach((_col, i) => {
    const cell = totalRow.getCell(i + 1);
    if (i === nameIndex) {
      cell.value = 'Grand Total';
    } else if (i === lineIndex) {
      cell.value = fmtMoney(grandTotal);
    } else {
      cell.value = '';
    }
    cell.font = { name: 'Helvetica', size: 10, bold: true, color: { argb: 'FF1A6B4A' } };
    cell.alignment = { vertical: 'middle', horizontal: i === lineIndex ? 'center' : 'left' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F2' } };
    cell.border = thinBorder();
  });
  totalRow.height = 22;

  const buffer = await workbook.xlsx.writeBuffer();
  const suffix = filterRoom ? `-${safeName(filterRoom.name)}` : '';
  triggerDownload(
    new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    `${safeName(project.name)}${suffix}-items.xlsx`,
  );
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

type ProposalPdfMode = 'continuous' | 'separated';

type ProposalPdfOptions = {
  mode?: ProposalPdfMode;
};

const TAKEOFF_PDF_ROW_HEIGHT = 34;
const TAKEOFF_EXCEL_ROW_HEIGHT = 56;
const TAKEOFF_PDF_CELL_PADDING = 1.6;
const TAKEOFF_SWATCH_LIMIT = 4;

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
  doc.text(proposalCompactIdentityLine(project), pageWidth / 2, 10, { align: 'center' });
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

async function addPdfCoverImage(
  doc: jsPDF,
  dataUrl: string,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  // Pre-crop on canvas so we can use a simple addImage call — no jsPDF clip() needed
  const MM_TO_PX = 3.7795;
  const cropped = await cropDataUrlToCover(
    dataUrl,
    Math.max(1, Math.round(width * MM_TO_PX)),
    Math.max(1, Math.round(height * MM_TO_PX)),
  );
  doc.addImage(cropped, 'PNG', x, y, width, height);
}

function drawPdfImageFrame(doc: jsPDF, x: number, y: number, width: number, height: number) {
  doc.setFillColor(245, 245, 242);
  doc.setDrawColor(220, 220, 220);
  doc.rect(x, y, width, height, 'FD');
}

async function drawPdfProjectImageBand(doc: jsPDF, projectImages: string[], y: number) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const bandWidth = pageWidth - 24;
  const gap = 3;
  const slotWidth = (bandWidth - gap * 2) / 3;
  const slotHeight = 42;
  const startX = 12;

  for (let slot = 0; slot < 3; slot++) {
    const x = startX + slot * (slotWidth + gap);
    const image = projectImages[slot];
    if (image) {
      drawPdfImageFrame(doc, x, y, slotWidth, slotHeight);
      await addPdfCoverImage(doc, image, x, y, slotWidth, slotHeight);
    }
  }
}

async function drawPdfProposalHeaderBlock(doc: jsPDF, exportDoc: ProposalExportDocument) {
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
    await drawPdfProjectImageBand(doc, exportDoc.projectImages, 38);
  }
}

// Pre-crops all row images to exact PDF cell pixel dimensions so didDrawCell
// can use a simple doc.addImage call with no jsPDF clip() state manipulation.
const TAKEOFF_PDF_MM_TO_PX = 3.7795;

async function prepareProposalPdfImages(
  exportDoc: ProposalExportDocument,
  columns: ProposalExportColumn[],
): Promise<void> {
  const renderingCol = columns.find((c) => c.key === 'rendering');
  const planCol = columns.find((c) => c.key === 'plan');
  const swatchCol = columns.find((c) => c.key === 'swatch');
  const cellHPx = Math.round(
    (TAKEOFF_PDF_ROW_HEIGHT - TAKEOFF_PDF_CELL_PADDING * 2) * TAKEOFF_PDF_MM_TO_PX,
  );

  await Promise.all(
    exportDoc.categories.flatMap((section) =>
      section.rows.map(async (row) => {
        if (renderingCol && row.rendering) {
          const w = Math.round(
            (renderingCol.pdfWidth - TAKEOFF_PDF_CELL_PADDING * 2) * TAKEOFF_PDF_MM_TO_PX,
          );
          row.pdfRendering = await cropDataUrlToCover(row.rendering, w, cellHPx);
        }
        if (planCol && row.planImage) {
          const w = Math.round(
            (planCol.pdfWidth - TAKEOFF_PDF_CELL_PADDING * 2) * TAKEOFF_PDF_MM_TO_PX,
          );
          row.pdfPlanImage = await cropDataUrlToCover(row.planImage, w, cellHPx);
        }
        if (swatchCol && row.swatches.length > 0) {
          const swW = Math.round(
            (swatchCol.pdfWidth - TAKEOFF_PDF_CELL_PADDING * 2) * TAKEOFF_PDF_MM_TO_PX,
          );
          const count = Math.min(row.swatches.length, TAKEOFF_SWATCH_LIMIT);
          const swH = Math.round(cellHPx / count);
          row.pdfSwatches = await Promise.all(
            row.swatches.slice(0, TAKEOFF_SWATCH_LIMIT).map((s) => cropDataUrlToCover(s, swW, swH)),
          );
        }
      }),
    ),
  );
}

function drawPdfBudgetSummaryPage(doc: jsPDF, project: Project, exportDoc: ProposalExportDocument) {
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

function proposalSubtotalLabelColumnIndex(columns: ProposalExportColumn[]) {
  const preferredKeys: ProposalExportColumnKey[] = [
    'description',
    'drawingsLocation',
    'productTag',
  ];
  for (const key of preferredKeys) {
    const index = columns.findIndex((column) => column.key === key);
    if (index >= 0) return index;
  }
  return Math.max(0, columns.length - 2);
}

function drawPdfProposalTable(
  doc: jsPDF,
  project: Project,
  section: ProposalExportCategorySection,
  columns: ProposalExportColumn[],
  startY: number,
  options: {
    drawOverflowHeader: boolean;
  },
) {
  const subtotalLabelIndex = proposalSubtotalLabelColumnIndex(columns);
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

      const pad = TAKEOFF_PDF_CELL_PADDING;

      if (column.key === 'rendering') {
        const fw = hook.cell.width - pad * 2;
        const fh = hook.cell.height - pad * 2;
        drawPdfImageFrame(doc, hook.cell.x + pad, hook.cell.y + pad, fw, fh);
        if (row.pdfRendering) {
          doc.addImage(row.pdfRendering, 'PNG', hook.cell.x + pad, hook.cell.y + pad, fw, fh);
        }
      }

      if (column.key === 'plan' && row.pdfPlanImage) {
        const fw = hook.cell.width - pad * 2;
        const fh = hook.cell.height - pad * 2;
        // White-out any text autotable may have drawn, then overlay the image
        doc.setFillColor(255, 255, 255);
        doc.rect(
          hook.cell.x + 0.2,
          hook.cell.y + 0.2,
          hook.cell.width - 0.4,
          hook.cell.height - 0.4,
          'F',
        );
        doc.addImage(row.pdfPlanImage, 'PNG', hook.cell.x + pad, hook.cell.y + pad, fw, fh);
      }

      if (column.key === 'swatch' && row.pdfSwatches.length > 0) {
        const fw = hook.cell.width - pad * 2;
        const fh = hook.cell.height - pad * 2;
        const gap = pad;
        const count = Math.min(row.pdfSwatches.length, TAKEOFF_SWATCH_LIMIT);
        const swH = Math.max(5, (fh - gap * (count - 1)) / count);
        row.pdfSwatches.forEach((swatch, i) => {
          const sy = hook.cell.y + pad + i * (swH + gap);
          drawPdfImageFrame(doc, hook.cell.x + pad, sy, fw, swH);
          doc.addImage(swatch, 'PNG', hook.cell.x + pad, sy, fw, swH);
        });
      }
    },
  });
}

export async function exportProposalExcel(
  project: Project,
  categories: ProposalCategoryWithItems[],
  userProfile?: UserProfile | null,
): Promise<void> {
  const { Workbook } = await import('exceljs');
  const exportCategories = filteredProposalCategories(categories);
  const assets = await buildProposalAssetBundle(project.id, exportCategories, TAKEOFF_SWATCH_LIMIT);
  const exportDoc = buildProposalExportDocument(project, exportCategories, assets, userProfile);
  const columns = exportDoc.columns;

  const workbook = new Workbook();
  const worksheet = workbook.addWorksheet('Proposal');
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
  const subtotalLabelIndex = proposalSubtotalLabelColumnIndex(columns);

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
    const imageBandRow = currentRow;
    const imageBandHeight = 112;
    worksheet.getRow(imageBandRow).height = imageBandHeight;
    const columnWidths = columns.map((column) => column.excelWidth);
    const slotRanges = [
      { start: 1, end: Math.max(1, Math.floor(endColumn / 3)) },
      {
        start: Math.max(1, Math.floor(endColumn / 3)) + 1,
        end: Math.max(2, Math.floor((endColumn * 2) / 3)),
      },
      { start: Math.max(3, Math.floor((endColumn * 2) / 3)) + 1, end: endColumn },
    ];
    slotRanges.forEach((range) => {
      worksheet.mergeCells(imageBandRow, range.start, imageBandRow, range.end);
      const slotCell = worksheet.getCell(imageBandRow, range.start);
      slotCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F2' } };
      slotCell.border = thinBorder();
    });
    await Promise.all(
      [0, 1, 2].map(async (slot) => {
        const image = exportDoc.projectImages[slot];
        if (!image) return;
        const placement = excelEqualWidthSlotPlacement(
          columnWidths,
          imageBandRow,
          imageBandHeight,
          slot,
          3,
        );
        await addExcelCoverImage(
          workbook,
          worksheet,
          image,
          placement,
          placement.widthPx,
          placement.heightPx,
        );
      }),
    );
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
      const planColumn = columns.findIndex((column) => column.key === 'plan');
      const swatchColumn = columns.findIndex((column) => column.key === 'swatch');
      if (renderingColumn >= 0) {
        const renderingExportColumn = columns[renderingColumn];
        if (rowData.rendering && renderingExportColumn) {
          const placement = excelPaddedCellPlacement(
            renderingColumn,
            currentRow,
            renderingExportColumn.excelWidth,
            TAKEOFF_EXCEL_ROW_HEIGHT,
          );
          await addExcelContainImage(workbook, worksheet, rowData.rendering, placement);
        }
      }

      if (planColumn >= 0 && rowData.planImage) {
        const planExportColumn = columns[planColumn];
        if (planExportColumn) {
          const planCell = row.getCell(planColumn + 1);
          planCell.value = '';
          const placement = excelPaddedCellPlacement(
            planColumn,
            currentRow,
            planExportColumn.excelWidth,
            TAKEOFF_EXCEL_ROW_HEIGHT,
          );
          await addExcelContainImage(workbook, worksheet, rowData.planImage, placement);
        }
      }

      if (swatchColumn >= 0) {
        const swatchExportColumn = columns[swatchColumn];
        const swatches = rowData.swatches;
        const swatchCell = row.getCell(swatchColumn + 1);
        swatchCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F2' } };
        const swatch = swatches[0];
        if (swatch && swatchExportColumn) {
          const placement = excelPaddedCellPlacement(
            swatchColumn,
            currentRow,
            swatchExportColumn.excelWidth,
            TAKEOFF_EXCEL_ROW_HEIGHT,
          );
          await addExcelCircularCoverImage(workbook, worksheet, swatch, placement);
        }
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
    `${safeName(project.name)}-proposal.xlsx`,
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

const FFE_PDF_HEADERS = ['Image', ...TABLE_HEADERS];
const FFE_PDF_IMAGE_COL_WIDTH = 18; // mm
const FFE_PDF_IMAGE_COL_HEIGHT = 18; // mm minCellHeight
const FFE_PDF_MM_TO_PX = 3.7795;

export async function exportTablePdf(
  project: Project,
  rooms: RoomWithItems[],
  filterRoom?: RoomWithItems,
): Promise<void> {
  const targetRooms = filterRoom ? [filterRoom] : rooms;
  const imageMap = await buildFfeItemImages(targetRooms);

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
    // row 0 = 'image' column (empty string) + rest of item data
    const rows = items.map((item) => ['', ...itemToRow(item)]);
    const subtotal = roomSubtotalCents(room.items);
    const roomItemOffset = rowOffset;
    rowOffset += items.length;

    autoTable(doc, {
      startY,
      head: [FFE_PDF_HEADERS],
      body: [
        ...rows,
        [
          '',
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

export async function exportProposalPdf(
  project: Project,
  categories: ProposalCategoryWithItems[],
  userProfile?: UserProfile | null,
  options: ProposalPdfOptions = {},
): Promise<void> {
  const mode = options.mode ?? 'continuous';
  const exportCategories = filteredProposalCategories(categories);
  const assets = await buildProposalAssetBundle(project.id, exportCategories, TAKEOFF_SWATCH_LIMIT);
  const exportDoc = buildProposalExportDocument(project, exportCategories, assets, userProfile);
  const columns = exportDoc.columns;

  // Scale column widths so the table fills the full A3 landscape printable width.
  // The header band already spans pageWidth − 24 mm; this makes the table match it.
  const PDF_PAGE_WIDTH = 420; // A3 landscape
  const PDF_MARGIN = 12;
  const pdfAvailableWidth = PDF_PAGE_WIDTH - PDF_MARGIN * 2;
  const pdfTotalWidth = columns.reduce((sum, col) => sum + col.pdfWidth, 0);
  const pdfWidthScale = pdfTotalWidth > 0 ? pdfAvailableWidth / pdfTotalWidth : 1;
  const scaledColumns = columns.map((col) => ({ ...col, pdfWidth: col.pdfWidth * pdfWidthScale }));

  // Pre-crop images using the scaled cell aspect ratios so didDrawCell dimensions match.
  await prepareProposalPdfImages(exportDoc, scaledColumns);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });

  if (mode === 'separated') {
    await drawPdfProposalHeaderBlock(doc, exportDoc);
    for (const [index, section] of exportDoc.categories.entries()) {
      if (index > 0 || doc.getNumberOfPages() > 0) doc.addPage();
      drawPdfSmallIdentityHeader(doc, project);
      drawPdfCategoryBand(doc, section.category.name, 18);
      drawPdfProposalTable(doc, project, section, scaledColumns, 24, {
        drawOverflowHeader: true,
      });
    }
    drawPdfBudgetSummaryPage(doc, project, exportDoc);
  } else {
    await drawPdfProposalHeaderBlock(doc, exportDoc);
    let startY = exportDoc.projectImages.length > 0 ? 82 : 40;
    exportDoc.categories.forEach((section, index) => {
      const pageHeight = doc.internal.pageSize.getHeight();
      if (startY + 18 > pageHeight - 18) {
        doc.addPage();
        drawPdfSmallIdentityHeader(doc, project);
        startY = 18;
      }
      drawPdfCategoryBand(doc, section.category.name, startY);
      drawPdfProposalTable(doc, project, section, scaledColumns, startY + 6, {
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

  doc.save(`${safeName(project.name)}-proposal.pdf`);
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
