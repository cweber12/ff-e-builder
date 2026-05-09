import * as XLSX from 'xlsx';
import { projectTotalCents, roomSubtotalCents } from '../budgetCalc';
import type { CustomColumnDef, Project, RoomWithItems } from '../../types';
import { addExcelContainImage, excelPaddedCellPlacement } from './imageHelpers';
import { buildFfeItemImages } from './ffeAssets';
import { buildStatusBreakdown, sortedItems } from './ffeRows';
import { fmtMoney, safeName, triggerDownload } from './shared';
import { thinBorder } from './excelStyles';

const BRAND_ARGB = 'FF4B7FAB';
const BRAND_FILL_ARGB = 'FFE8F0F7';
const BAND_FILL_ARGB = 'FFECF3F9';
const SUBTOTAL_FILL_ARGB = 'FFF5F9FC';

const FFE_EXCEL_COLS = [
  { key: 'image', label: 'Image', width: 16 },
  { key: 'itemIdTag', label: 'Item ID', width: 14 },
  { key: 'itemName', label: 'Item Name', width: 24 },
  { key: 'category', label: 'Category', width: 16 },
  { key: 'dimensions', label: 'Dimensions', width: 16 },
  { key: 'qty', label: 'Qty', width: 8 },
  { key: 'unitCost', label: 'Unit Cost', width: 13 },
  { key: 'lineTotal', label: 'Line Total', width: 13 },
  { key: 'status', label: 'Status', width: 14 },
  { key: 'leadTime', label: 'Lead Time', width: 12 },
  { key: 'notes', label: 'Notes', width: 24 },
  { key: 'materials', label: 'Materials', width: 24 },
] as const;

type FfeExcelColKey = (typeof FFE_EXCEL_COLS)[number]['key'];

const FFE_EXCEL_NUMERIC_KEYS: Set<FfeExcelColKey> = new Set(['qty', 'unitCost', 'lineTotal']);

const FFE_EXCEL_ROW_HEIGHT = 56;

export async function exportTableExcel(
  project: Project,
  rooms: RoomWithItems[],
  filterRoom?: RoomWithItems,
  customColumnDefs: CustomColumnDef[] = [],
): Promise<void> {
  const { Workbook } = await import('exceljs');
  const targetRooms = filterRoom ? [filterRoom] : rooms;
  const allSortedItems = targetRooms.flatMap((r) => sortedItems(r));
  const imageMap = await buildFfeItemImages(targetRooms);

  const activeCustomCols = customColumnDefs
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .filter((def) => allSortedItems.some((item) => (item.customData[def.id] ?? '').trim() !== ''));

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

  const endColumn = FFE_EXCEL_COLS.length + activeCustomCols.length;
  FFE_EXCEL_COLS.forEach((col, i) => {
    worksheet.getColumn(i + 1).width = col.width;
  });
  activeCustomCols.forEach((_def, i) => {
    worksheet.getColumn(FFE_EXCEL_COLS.length + i + 1).width = 18;
  });

  let currentRow = 1;

  // ── Title rows ──
  worksheet.mergeCells(currentRow, 1, currentRow, endColumn);
  const companyCell = worksheet.getCell(currentRow, 1);
  companyCell.value = (project.companyName?.trim() || project.name).toUpperCase();
  companyCell.font = { name: 'Helvetica', size: 16, bold: true, color: { argb: BRAND_ARGB } };
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
    roomCell.font = { name: 'Helvetica', size: 11, bold: true, color: { argb: BRAND_ARGB } };
    roomCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BAND_FILL_ARGB } };
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
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_FILL_ARGB } };
      cell.border = thinBorder();
    });
    activeCustomCols.forEach((def, i) => {
      const cell = headerRow.getCell(FFE_EXCEL_COLS.length + i + 1);
      cell.value = def.label;
      cell.font = { name: 'Helvetica', size: 9, bold: true, color: { argb: 'FF374151' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_FILL_ARGB } };
      cell.border = thinBorder();
    });
    headerRow.height = 24;
    currentRow += 1;

    // ── Item rows ──
    for (const item of sortedItems(room)) {
      const row = worksheet.getRow(currentRow);
      row.height = FFE_EXCEL_ROW_HEIGHT;

      const values: Record<FfeExcelColKey, string> = {
        image: '',
        itemIdTag: item.itemIdTag ?? '',
        itemName: item.itemName,
        category: item.category ?? '',
        dimensions: item.dimensions ?? '',
        qty: String(item.qty),
        unitCost: fmtMoney(item.unitCostCents),
        lineTotal: fmtMoney(item.unitCostCents * item.qty),
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

      // ── Custom column cells ──
      activeCustomCols.forEach((def, i) => {
        const cell = row.getCell(FFE_EXCEL_COLS.length + i + 1);
        cell.value = item.customData[def.id] ?? '';
        cell.font = { name: 'Helvetica', size: 9, color: { argb: 'FF374151' } };
        cell.alignment = {
          vertical: 'top',
          horizontal: 'left',
          wrapText: true,
          shrinkToFit: false,
        };
        cell.border = thinBorder();
      });

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
      cell.font = { name: 'Helvetica', size: 9, bold: true, color: { argb: BRAND_ARGB } };
      cell.alignment = { vertical: 'middle', horizontal: i === lineIndex ? 'center' : 'left' };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SUBTOTAL_FILL_ARGB } };
      cell.border = thinBorder();
    });
    activeCustomCols.forEach((_def, i) => {
      const cell = subtotalRow.getCell(FFE_EXCEL_COLS.length + i + 1);
      cell.value = '';
      cell.font = { name: 'Helvetica', size: 9, bold: true, color: { argb: BRAND_ARGB } };
      cell.alignment = { vertical: 'middle', horizontal: 'left' };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SUBTOTAL_FILL_ARGB } };
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
    cell.font = { name: 'Helvetica', size: 10, bold: true, color: { argb: BRAND_ARGB } };
    cell.alignment = { vertical: 'middle', horizontal: i === lineIndex ? 'center' : 'left' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BAND_FILL_ARGB } };
    cell.border = thinBorder();
  });
  activeCustomCols.forEach((_def, i) => {
    const cell = totalRow.getCell(FFE_EXCEL_COLS.length + i + 1);
    cell.value = '';
    cell.font = { name: 'Helvetica', size: 10, bold: true, color: { argb: BRAND_ARGB } };
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BAND_FILL_ARGB } };
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

  XLSX.writeFile(wb, `${safeName(project.name)}-summary.xlsx`);
}
