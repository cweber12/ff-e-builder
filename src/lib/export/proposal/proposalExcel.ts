import { buildProposalAssetBundle } from './proposalAssets';
import {
  buildProposalExportDocument,
  filteredProposalCategories,
  proposalSubtotalLabelColumnIndex,
} from './proposalDocument';
import type { RevisionExportData } from './proposalDocument';
import type { Project, ProposalCategoryWithItems, UserProfile } from '../../../types';
import {
  addExcelCircularCoverImage,
  addExcelContainImage,
  addExcelCoverImage,
  excelEqualWidthSlotPlacement,
  excelPaddedCellPlacement,
} from '../imageHelpers';
import { fmtMoney, safeName, triggerDownload } from '../shared';
import { thinBorder } from '../excelStyles';

const PROPOSAL_EXCEL_ROW_HEIGHT = 56;
const PROPOSAL_SWATCH_LIMIT = 4;
export async function exportProposalExcel(
  project: Project,
  categories: ProposalCategoryWithItems[],
  userProfile?: UserProfile | null,
  customColumnDefs: import('../../../types').CustomColumnDef[] = [],
  revisionData?: RevisionExportData,
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
  );
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
        fgColor: { argb: column.isRevision ? 'FFFEF3C7' : 'FFECEFEA' },
      };
      cell.border = thinBorder();
    });
    headerRow.height = 24;
    currentRow += 1;

    for (const rowData of section.rows) {
      const row = worksheet.getRow(currentRow);
      row.height = PROPOSAL_EXCEL_ROW_HEIGHT;
      columns.forEach((column, index) => {
        const cell = row.getCell(index + 1);

        // Revision annotation: original value in black, revised in red below.
        const annotationKey =
          column.key === 'quantity'
            ? 'quantity'
            : column.key === 'unitCost'
              ? 'unitCost'
              : column.key === 'totalCost'
                ? 'totalCost'
                : null;
        const annotation = annotationKey ? rowData.revAnnotations[annotationKey] : undefined;
        if (annotation) {
          const originalText = rowData.values[column.key] ?? '';
          cell.value = {
            richText: [
              {
                text: originalText,
                font: { name: 'Helvetica', size: 9, color: { argb: 'FF374151' } },
              },
              {
                text: '\n' + annotation.revisedValue,
                font: { name: 'Helvetica', size: 9, color: { argb: 'FFDC2626' } },
              },
            ],
          };
        } else {
          cell.value = rowData.values[column.key];
        }

        cell.font = { name: 'Helvetica', size: 9, color: { argb: 'FF374151' } };
        cell.alignment = {
          vertical: column.key === 'rendering' || column.key === 'swatch' ? 'middle' : 'top',
          horizontal:
            column.key === 'quantity' ||
            column.key === 'unit' ||
            column.key === 'unitCost' ||
            column.key === 'totalCost' ||
            column.key === 'revQty' ||
            column.key === 'revUnitCost' ||
            column.key === 'revTotalCost' ||
            column.key === 'cbm'
              ? 'center'
              : 'left',
          wrapText: column.key !== 'rendering' && column.key !== 'swatch',
          shrinkToFit: false,
        };
        cell.border = thinBorder();
        // Amber highlight for flagged cost cells: both the original columns and the rev block.
        const isCostFlagged =
          rowData.revAnnotations.unitCost?.flagged === true ||
          rowData.revAnnotations.totalCost?.flagged === true;
        if (
          isCostFlagged &&
          (column.key === 'unitCost' ||
            column.key === 'totalCost' ||
            column.key === 'revUnitCost' ||
            column.key === 'revTotalCost')
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
          const placement = excelPaddedCellPlacement(
            renderingColumn,
            currentRow,
            renderingExportColumn.excelWidth,
            PROPOSAL_EXCEL_ROW_HEIGHT,
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
            PROPOSAL_EXCEL_ROW_HEIGHT,
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
            PROPOSAL_EXCEL_ROW_HEIGHT,
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
