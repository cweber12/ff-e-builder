import { buildProposalAssetBundle } from './proposalAssets';
import {
  buildProposalExportDocument,
  filteredProposalCategories,
  proposalSubtotalLabelColumnIndex,
} from './proposalDocument';
import type { RevisionExportData } from './proposalDocument';
import type { Project, ProposalCategoryWithItems, UserProfile } from '../../../types';
import {
  type ExcelImagePlacement,
  addExcelCircularCoverImage,
  addExcelContainImage,
  addExcelCoverImage,
  excelCenteredFixedImagePlacement,
  excelEqualWidthSlotPlacement,
  excelPaddedCellPlacement,
} from '../imageHelpers';
import { safeName, triggerDownload } from '../shared';
import { headerRowBorder, subtotalTopBorder, thinBorder } from '../excelStyles';

// ── Styling constants ─────────────────────────────────────────────────────────
const PROPOSAL_FONT = 'Aptos';
const PROPOSAL_EXCEL_ROW_HEIGHT = 96; // ~128px — fits item renderings comfortably
const PROPOSAL_IMAGE_WIDTH_PX = 168;
const PROPOSAL_IMAGE_HEIGHT_PX = 126;
const TABLE_START_COLUMN = 2;
const TABLE_START_ROW = 2;
const SUMMARY_COLUMN_COUNT = 3;
const CURRENCY_FORMAT = '$#,##0.00';
const DECIMAL_FORMAT = '0.##';
type ExcelBorderSide = { style: 'thin' | 'medium'; color: { argb: string } };
type ExcelBorder = {
  top: ExcelBorderSide;
  left: ExcelBorderSide;
  bottom: ExcelBorderSide;
  right: ExcelBorderSide;
};
const REVISION_SEPARATOR: ExcelBorderSide = {
  style: 'medium',
  color: { argb: 'FFBFBFBF' },
};

/** Strip encoding replacement chars and non-printable control chars. */
function cleanText(value: string | null | undefined): string {
  if (value == null) return '';
  return Array.from(value.replace(/\uFFFD/g, ''))
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code === 9 || code === 10 || code === 13 || (code >= 32 && code !== 127);
    })
    .join('');
}

function excelColumnName(columnNumber: number) {
  let remaining = columnNumber;
  let name = '';
  while (remaining > 0) {
    const modulo = (remaining - 1) % 26;
    name = String.fromCharCode(65 + modulo) + name;
    remaining = Math.floor((remaining - modulo) / 26);
  }
  return name;
}

function cellAddress(columnNumber: number, rowNumber: number) {
  return `${excelColumnName(columnNumber)}${rowNumber}`;
}

function parseCurrency(value: string | null | undefined) {
  const cleaned = String(value ?? '').replace(/[$,\s]/g, '');
  if (!cleaned) return null;
  const amount = Number(cleaned);
  return Number.isFinite(amount) ? amount : null;
}

function parseDecimal(value: string | null | undefined) {
  const cleaned = String(value ?? '').replace(/,/g, '');
  if (!cleaned) return null;
  const amount = Number(cleaned);
  return Number.isFinite(amount) ? amount : null;
}

function offsetPlacement(
  placement: ExcelImagePlacement,
  columnOffset: number,
): ExcelImagePlacement {
  return {
    ...placement,
    box: {
      left: placement.box.left + columnOffset,
      top: placement.box.top,
      right: placement.box.right + columnOffset,
      bottom: placement.box.bottom,
    },
  };
}

function borderForColumn(
  baseBorder: ExcelBorder,
  column: { key: string; isRevision?: boolean },
  previousColumn: { isRevision?: boolean } | null,
  nextColumn: { isRevision?: boolean } | null,
): ExcelBorder {
  const border: ExcelBorder = { ...baseBorder };
  if (column.isRevision && !previousColumn?.isRevision) {
    border.left = REVISION_SEPARATOR;
  }
  if (column.key === 'totalCost' && nextColumn?.isRevision) {
    border.right = REVISION_SEPARATOR;
  }
  return border;
}

const PROPOSAL_SWATCH_LIMIT = 4;
export async function exportProposalExcel(
  project: Project,
  categories: ProposalCategoryWithItems[],
  userProfile?: UserProfile | null,
  customColumnDefs: import('../../../types').CustomColumnDef[] = [],
  revisionData?: RevisionExportData,
  columnOrder?: string[],
): Promise<void> {
  const { Workbook } = await import('exceljs');
  const exportCategories = filteredProposalCategories(categories);
  const assets = await buildProposalAssetBundle(
    project.id,
    exportCategories,
    PROPOSAL_SWATCH_LIMIT,
  );
  const exportDoc = buildProposalExportDocument(
    project,
    exportCategories,
    assets,
    userProfile,
    customColumnDefs,
    revisionData,
    columnOrder,
  );
  const columns = exportDoc.columns;

  const workbook = new Workbook();
  workbook.calcProperties.fullCalcOnLoad = true;
  const worksheet = workbook.addWorksheet('Proposal');
  worksheet.views = [{ showGridLines: false }];
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

  worksheet.getColumn(1).width = 3;
  worksheet.getRow(1).height = 8;
  columns.forEach((column, index) => {
    worksheet.getColumn(index + TABLE_START_COLUMN).width = column.excelWidth;
  });

  let currentRow = TABLE_START_ROW;
  const endColumn = TABLE_START_COLUMN + Math.max(columns.length, 1) - 1;
  const subtotalLabelColumn = TABLE_START_COLUMN + proposalSubtotalLabelColumnIndex(columns);
  const columnIndexByKey = new Map(
    columns.map((column, index) => [column.key, TABLE_START_COLUMN + index]),
  );
  const totalCostColumn = columnIndexByKey.get('totalCost');
  const revTotalCostColumn = columnIndexByKey.get('revTotalCost');
  const summaryRefs: { name: string; itemCount: number; subtotalAddress: string; total: number }[] =
    [];

  worksheet.mergeCells(currentRow, TABLE_START_COLUMN, currentRow, endColumn);
  const companyCell = worksheet.getCell(currentRow, TABLE_START_COLUMN);
  companyCell.value = exportDoc.companyName.toUpperCase();
  companyCell.font = { name: PROPOSAL_FONT, size: 15, bold: true, color: { argb: 'FF1A6B4A' } };
  companyCell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(currentRow).height = 26;
  currentRow += 1;

  worksheet.mergeCells(currentRow, TABLE_START_COLUMN, currentRow, endColumn);
  const projectCell = worksheet.getCell(currentRow, TABLE_START_COLUMN);
  projectCell.value = exportDoc.projectLine;
  projectCell.font = { name: PROPOSAL_FONT, size: 11, color: { argb: 'FF4B5563' } };
  projectCell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(currentRow).height = 20;
  currentRow += 1;

  if (exportDoc.preparedByLine) {
    worksheet.mergeCells(currentRow, TABLE_START_COLUMN, currentRow, endColumn);
    const preparedCell = worksheet.getCell(currentRow, TABLE_START_COLUMN);
    preparedCell.value = `Quote prepared by ${exportDoc.preparedByLine}`;
    preparedCell.font = { name: PROPOSAL_FONT, size: 10, color: { argb: 'FF6B7280' } };
    preparedCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(currentRow).height = 16;
    currentRow += 1;
  }

  if (exportDoc.projectImages.length > 0) {
    const imageBandRow = currentRow;
    const imageBandHeight = 92;
    worksheet.getRow(imageBandRow).height = imageBandHeight;
    const columnWidths = columns.map((column) => column.excelWidth);
    const dataColumnCount = Math.max(columns.length, 1);
    const slotRanges = [0, 1, 2].map((slot) => {
      const startOffset = Math.floor((slot * dataColumnCount) / 3);
      const endOffset =
        slot === 2 ? dataColumnCount - 1 : Math.floor(((slot + 1) * dataColumnCount) / 3) - 1;
      return {
        start: TABLE_START_COLUMN + startOffset,
        end: TABLE_START_COLUMN + Math.max(startOffset, endOffset),
      };
    });
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
        const placement = offsetPlacement(
          excelEqualWidthSlotPlacement(columnWidths, imageBandRow, imageBandHeight, slot, 3),
          TABLE_START_COLUMN - 1,
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
    currentRow += 1;
  } else {
    currentRow += 1;
  }

  for (const section of exportDoc.categories) {
    worksheet.mergeCells(currentRow, TABLE_START_COLUMN, currentRow, endColumn);
    const categoryCell = worksheet.getCell(currentRow, TABLE_START_COLUMN);
    categoryCell.value = section.category.name.toUpperCase();
    categoryCell.font = { name: PROPOSAL_FONT, size: 10, bold: true, color: { argb: 'FF1A6B4A' } };
    categoryCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF0F2F0' },
    };
    categoryCell.alignment = { vertical: 'middle', indent: 1 };
    categoryCell.border = { bottom: { style: 'thin' as const, color: { argb: 'FFBFBFBF' } } };
    worksheet.getRow(currentRow).height = 22;
    currentRow += 1;

    const headerRow = worksheet.getRow(currentRow);
    columns.forEach((column, index) => {
      const prevColumn = index > 0 ? (columns[index - 1] ?? null) : null;
      const nextColumn = index < columns.length - 1 ? (columns[index + 1] ?? null) : null;
      const cell = headerRow.getCell(index + TABLE_START_COLUMN);
      cell.value = column.label;
      cell.font = { name: PROPOSAL_FONT, size: 10, bold: true, color: { argb: 'FF1F2937' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: column.isRevision ? 'FFFEF3C7' : 'FFF3F2F0' },
      };
      cell.border = borderForColumn(headerRowBorder(), column, prevColumn, nextColumn);
    });
    headerRow.height = 30;
    currentRow += 1;

    const firstItemRow = currentRow;
    for (const rowData of section.rows) {
      const row = worksheet.getRow(currentRow);
      row.height = PROPOSAL_EXCEL_ROW_HEIGHT;
      columns.forEach((column, index) => {
        const cell = row.getCell(index + TABLE_START_COLUMN);
        const prevColumn = index > 0 ? (columns[index - 1] ?? null) : null;
        const nextColumn = index < columns.length - 1 ? (columns[index + 1] ?? null) : null;
        const isImage =
          column.key === 'rendering' || column.key === 'swatch' || column.key === 'plan';
        const isCurrency =
          column.key === 'unitCost' ||
          column.key === 'totalCost' ||
          column.key === 'revUnitCost' ||
          column.key === 'revTotalCost';
        const isCentered =
          column.key === 'quantity' ||
          column.key === 'unit' ||
          column.key === 'revQty' ||
          column.key === 'cbm';
        const isFormulaBacked =
          column.key === 'quantity' ||
          column.key === 'cbm' ||
          column.key === 'unitCost' ||
          column.key === 'totalCost' ||
          column.key === 'revQty' ||
          column.key === 'revUnitCost' ||
          column.key === 'revTotalCost';

        // Revision annotation: original value in black, revised in red below.
        const annotation = rowData.revAnnotations[column.key];
        if (annotation && !isFormulaBacked) {
          const originalText = cleanText(rowData.values[column.key] ?? '');
          cell.value = {
            richText: [
              {
                text: originalText,
                font: { name: PROPOSAL_FONT, size: 10, color: { argb: 'FF374151' } },
              },
              {
                text: '\n' + cleanText(annotation.revisedValue),
                font: { name: PROPOSAL_FONT, size: 10, color: { argb: 'FFDC2626' } },
              },
            ],
          };
        } else {
          switch (column.key) {
            case 'cbm':
              cell.value = rowData.item.cbm > 0 ? rowData.item.cbm : '';
              cell.numFmt = DECIMAL_FORMAT;
              break;
            case 'quantity':
              cell.value = rowData.item.quantity;
              cell.numFmt = DECIMAL_FORMAT;
              break;
            case 'unitCost':
              cell.value = (rowData.item.unitCostCents || 0) / 100;
              cell.numFmt = CURRENCY_FORMAT;
              break;
            case 'totalCost': {
              const quantityColumn = columnIndexByKey.get('quantity');
              const unitCostColumn = columnIndexByKey.get('unitCost');
              if (quantityColumn && unitCostColumn) {
                cell.value = {
                  formula: `${cellAddress(quantityColumn, currentRow)}*${cellAddress(
                    unitCostColumn,
                    currentRow,
                  )}`,
                  result: ((rowData.item.unitCostCents || 0) * rowData.item.quantity) / 100,
                };
              } else {
                cell.value = parseCurrency(rowData.values[column.key]) ?? '';
              }
              cell.numFmt = CURRENCY_FORMAT;
              break;
            }
            case 'revQty': {
              const revQty = parseDecimal(rowData.values.revQty);
              cell.value = revQty ?? '';
              cell.numFmt = DECIMAL_FORMAT;
              break;
            }
            case 'revUnitCost': {
              const revUnitCost = parseCurrency(rowData.values.revUnitCost);
              cell.value = revUnitCost ?? '';
              cell.numFmt = CURRENCY_FORMAT;
              break;
            }
            case 'revTotalCost': {
              const revQtyColumn = columnIndexByKey.get('revQty');
              const revUnitCostColumn = columnIndexByKey.get('revUnitCost');
              if (revQtyColumn && revUnitCostColumn) {
                cell.value = {
                  formula: `IF(OR(${cellAddress(revQtyColumn, currentRow)}="",${cellAddress(
                    revUnitCostColumn,
                    currentRow,
                  )}=""),"",${cellAddress(revQtyColumn, currentRow)}*${cellAddress(
                    revUnitCostColumn,
                    currentRow,
                  )})`,
                  result: parseCurrency(rowData.values.revTotalCost) ?? '',
                };
              } else {
                cell.value = parseCurrency(rowData.values[column.key]) ?? '';
              }
              cell.numFmt = CURRENCY_FORMAT;
              break;
            }
            default:
              cell.value = isImage ? '' : cleanText(rowData.values[column.key] ?? '');
              break;
          }
        }

        cell.font = { name: PROPOSAL_FONT, size: 10, color: { argb: 'FF374151' } };
        cell.alignment = {
          vertical: 'middle',
          horizontal: isCurrency ? 'right' : isCentered || isImage ? 'center' : 'left',
          wrapText: !isImage,
          shrinkToFit: false,
          ...(isCurrency || isCentered || isImage ? {} : { indent: 1 }),
        };
        cell.border = borderForColumn(thinBorder(), column, prevColumn, nextColumn);
        // Amber highlight on rev cost cells when PM action is required.
        if (
          rowData.revCostFlagged &&
          (column.key === 'revUnitCost' || column.key === 'revTotalCost')
        ) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF9C3' } };
        }
      });

      const renderingColumn = columns.findIndex((column) => column.key === 'rendering');
      const planColumn = columns.findIndex((column) => column.key === 'plan');
      const swatchColumn = columns.findIndex((column) => column.key === 'swatch');
      if (renderingColumn >= 0) {
        const renderingExportColumn = columns[renderingColumn];
        if (rowData.rendering && renderingExportColumn) {
          const placement = excelCenteredFixedImagePlacement(
            renderingColumn + TABLE_START_COLUMN - 1,
            currentRow,
            renderingExportColumn.excelWidth,
            PROPOSAL_EXCEL_ROW_HEIGHT,
            PROPOSAL_IMAGE_WIDTH_PX,
            PROPOSAL_IMAGE_HEIGHT_PX,
          );
          await addExcelContainImage(workbook, worksheet, rowData.rendering, placement);
        }
      }

      if (planColumn >= 0 && rowData.planImage) {
        const planExportColumn = columns[planColumn];
        if (planExportColumn) {
          const planCell = row.getCell(planColumn + TABLE_START_COLUMN);
          planCell.value = '';
          const placement = excelCenteredFixedImagePlacement(
            planColumn + TABLE_START_COLUMN - 1,
            currentRow,
            planExportColumn.excelWidth,
            PROPOSAL_EXCEL_ROW_HEIGHT,
            PROPOSAL_IMAGE_WIDTH_PX,
            PROPOSAL_IMAGE_HEIGHT_PX,
          );
          await addExcelContainImage(workbook, worksheet, rowData.planImage, placement);
        }
      }

      if (swatchColumn >= 0) {
        const swatchExportColumn = columns[swatchColumn];
        const swatches = rowData.swatches;
        const swatchCell = row.getCell(swatchColumn + TABLE_START_COLUMN);
        swatchCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F2' } };
        const swatch = swatches[0];
        if (swatch && swatchExportColumn) {
          const placement = excelPaddedCellPlacement(
            swatchColumn + TABLE_START_COLUMN - 1,
            currentRow,
            swatchExportColumn.excelWidth,
            PROPOSAL_EXCEL_ROW_HEIGHT,
          );
          await addExcelCircularCoverImage(workbook, worksheet, swatch, placement);
        }
      }

      currentRow += 1;
    }

    const lastItemRow = currentRow - 1;
    const subtotalRow = worksheet.getRow(currentRow);
    columns.forEach((column, index) => {
      const actualColumn = index + TABLE_START_COLUMN;
      const prevColumn = index > 0 ? (columns[index - 1] ?? null) : null;
      const nextColumn = index < columns.length - 1 ? (columns[index + 1] ?? null) : null;
      const cell = subtotalRow.getCell(actualColumn);
      if (actualColumn === subtotalLabelColumn) {
        cell.value = `${section.category.name} subtotal`;
      } else if (actualColumn === totalCostColumn && lastItemRow >= firstItemRow) {
        cell.value = {
          formula: `SUM(${cellAddress(actualColumn, firstItemRow)}:${cellAddress(
            actualColumn,
            lastItemRow,
          )})`,
          result: section.subtotalCents / 100,
        };
        cell.numFmt = CURRENCY_FORMAT;
      } else if (actualColumn === revTotalCostColumn && lastItemRow >= firstItemRow) {
        const revTotal = section.rows.reduce(
          (sum, row) => sum + (parseCurrency(row.values.revTotalCost) ?? 0),
          0,
        );
        cell.value = {
          formula: `SUM(${cellAddress(actualColumn, firstItemRow)}:${cellAddress(
            actualColumn,
            lastItemRow,
          )})`,
          result: revTotal,
        };
        cell.numFmt = CURRENCY_FORMAT;
      } else {
        cell.value = '';
      }
      cell.font = { name: PROPOSAL_FONT, size: 10, bold: true, color: { argb: 'FF374151' } };
      cell.alignment = {
        vertical: 'middle',
        horizontal:
          actualColumn === totalCostColumn || actualColumn === revTotalCostColumn
            ? 'right'
            : 'left',
        ...(actualColumn === totalCostColumn || actualColumn === revTotalCostColumn
          ? {}
          : { indent: 1 }),
      };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF7F7F5' },
      };
      cell.border = borderForColumn(subtotalTopBorder(), column, prevColumn, nextColumn);
    });
    if (totalCostColumn) {
      summaryRefs.push({
        name: section.category.name,
        itemCount: section.category.items.length,
        subtotalAddress: cellAddress(totalCostColumn, currentRow),
        total: section.subtotalCents / 100,
      });
    }
    subtotalRow.height = 20;
    currentRow += 2;
  }

  const summaryStartColumn = Math.max(TABLE_START_COLUMN, endColumn - SUMMARY_COLUMN_COUNT + 1);
  const summaryEndColumn = summaryStartColumn + SUMMARY_COLUMN_COUNT - 1;
  worksheet.mergeCells(currentRow, summaryStartColumn, currentRow, summaryEndColumn);
  const summaryTitle = worksheet.getCell(currentRow, summaryStartColumn);
  summaryTitle.value = 'BUDGET SUMMARY';
  summaryTitle.font = { name: PROPOSAL_FONT, size: 10, bold: true, color: { argb: 'FF1A6B4A' } };
  summaryTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F2F0' } };
  summaryTitle.alignment = { vertical: 'middle', indent: 1 };
  summaryTitle.border = { bottom: { style: 'thin' as const, color: { argb: 'FFBFBFBF' } } };
  worksheet.getRow(currentRow).height = 22;
  currentRow += 1;

  worksheet.getCell(currentRow, summaryStartColumn).value = 'Category';
  worksheet.getCell(currentRow, summaryStartColumn + 1).value = 'Rows';
  worksheet.getCell(currentRow, summaryStartColumn + 2).value = 'Total';
  [summaryStartColumn, summaryStartColumn + 1, summaryStartColumn + 2].forEach((columnIndex) => {
    const cell = worksheet.getCell(currentRow, columnIndex);
    cell.font = { name: PROPOSAL_FONT, size: 10, bold: true, color: { argb: 'FF1F2937' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F2F0' } };
    cell.border = headerRowBorder();
    cell.alignment = {
      horizontal:
        columnIndex === summaryStartColumn
          ? 'left'
          : columnIndex === summaryStartColumn + 2
            ? 'right'
            : 'center',
      vertical: 'middle',
      ...(columnIndex === summaryStartColumn ? { indent: 1 } : {}),
    };
  });
  worksheet.getRow(currentRow).height = 22;
  currentRow += 1;

  const firstSummaryTotalRow = currentRow;
  summaryRefs.forEach((section) => {
    worksheet.getCell(currentRow, summaryStartColumn).value = section.name;
    worksheet.getCell(currentRow, summaryStartColumn + 1).value = section.itemCount;
    const summaryTotalCell = worksheet.getCell(currentRow, summaryStartColumn + 2);
    summaryTotalCell.value = { formula: section.subtotalAddress, result: section.total };
    summaryTotalCell.numFmt = CURRENCY_FORMAT;
    [summaryStartColumn, summaryStartColumn + 1, summaryStartColumn + 2].forEach((col) => {
      const cell = worksheet.getCell(currentRow, col);
      cell.font = { name: PROPOSAL_FONT, size: 10, color: { argb: 'FF374151' } };
      cell.border = thinBorder();
      cell.alignment = {
        vertical: 'middle',
        horizontal:
          col === summaryStartColumn + 2
            ? 'right'
            : col === summaryStartColumn + 1
              ? 'center'
              : 'left',
        ...(col === summaryStartColumn ? { indent: 1 } : {}),
      };
    });
    currentRow += 1;
  });
  const lastSummaryTotalRow = currentRow - 1;

  const grandTotalCell = worksheet.getCell(currentRow, summaryStartColumn + 2);
  grandTotalCell.value =
    lastSummaryTotalRow >= firstSummaryTotalRow
      ? {
          formula: `SUM(${cellAddress(summaryStartColumn + 2, firstSummaryTotalRow)}:${cellAddress(
            summaryStartColumn + 2,
            lastSummaryTotalRow,
          )})`,
          result: exportDoc.grandTotalCents / 100,
        }
      : 0;
  grandTotalCell.numFmt = CURRENCY_FORMAT;
  worksheet.getCell(currentRow, summaryStartColumn).value = 'Grand Total';
  [summaryStartColumn, summaryStartColumn + 1, summaryStartColumn + 2].forEach((col) => {
    const cell = worksheet.getCell(currentRow, col);
    cell.font = { name: PROPOSAL_FONT, size: 10, bold: true, color: { argb: 'FF374151' } };
    cell.border = subtotalTopBorder();
    cell.alignment = {
      vertical: 'middle',
      horizontal:
        col === summaryStartColumn + 2
          ? 'right'
          : col === summaryStartColumn + 1
            ? 'center'
            : 'left',
      ...(col === summaryStartColumn ? { indent: 1 } : {}),
    };
  });
  currentRow += 1;
  if (exportDoc.budgetTargetCents !== null) {
    const budgetCell = worksheet.getCell(currentRow, summaryStartColumn + 2);
    budgetCell.value = exportDoc.budgetTargetCents / 100;
    budgetCell.numFmt = CURRENCY_FORMAT;
    worksheet.getCell(currentRow, summaryStartColumn).value = 'Budget Target';
    [summaryStartColumn, summaryStartColumn + 1, summaryStartColumn + 2].forEach((col) => {
      const cell = worksheet.getCell(currentRow, col);
      cell.font = { name: PROPOSAL_FONT, size: 10, color: { argb: 'FF374151' } };
      cell.border = thinBorder();
      cell.alignment = {
        vertical: 'middle',
        horizontal:
          col === summaryStartColumn + 2
            ? 'right'
            : col === summaryStartColumn + 1
              ? 'center'
              : 'left',
        ...(col === summaryStartColumn ? { indent: 1 } : {}),
      };
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  triggerDownload(
    new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    `${safeName(project.name)}-proposal.xlsx`,
  );
}
