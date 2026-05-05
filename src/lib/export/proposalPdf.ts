import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { BRAND_RGB } from '../constants';
import type { Project, ProposalCategoryWithItems, UserProfile } from '../../types';
import { cropDataUrlToCover } from './imageHelpers';
import { buildProposalAssetBundle } from './proposalAssets';
import {
  buildProposalExportDocument,
  filteredProposalCategories,
  proposalCompactIdentityLine,
  proposalSubtotalLabelColumnIndex,
  type ProposalExportCategorySection,
  type ProposalExportColumn,
  type ProposalExportDocument,
} from './proposalDocument';
import { fmtMoney, safeName } from './shared';

const BRAND = BRAND_RGB;
type ProposalPdfMode = 'continuous' | 'separated';

type ProposalPdfOptions = {
  mode?: ProposalPdfMode;
};

const PROPOSAL_PDF_ROW_HEIGHT = 34;
const PROPOSAL_PDF_CELL_PADDING = 1.6;
const PROPOSAL_SWATCH_LIMIT = 4;

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
const PROPOSAL_PDF_MM_TO_PX = 3.7795;

async function prepareProposalPdfImages(
  exportDoc: ProposalExportDocument,
  columns: ProposalExportColumn[],
): Promise<void> {
  const renderingCol = columns.find((c) => c.key === 'rendering');
  const planCol = columns.find((c) => c.key === 'plan');
  const swatchCol = columns.find((c) => c.key === 'swatch');
  const cellHPx = Math.round(
    (PROPOSAL_PDF_ROW_HEIGHT - PROPOSAL_PDF_CELL_PADDING * 2) * PROPOSAL_PDF_MM_TO_PX,
  );

  await Promise.all(
    exportDoc.categories.flatMap((section) =>
      section.rows.map(async (row) => {
        if (renderingCol && row.rendering) {
          const w = Math.round(
            (renderingCol.pdfWidth - PROPOSAL_PDF_CELL_PADDING * 2) * PROPOSAL_PDF_MM_TO_PX,
          );
          row.pdfRendering = await cropDataUrlToCover(row.rendering, w, cellHPx);
        }
        if (planCol && row.planImage) {
          const w = Math.round(
            (planCol.pdfWidth - PROPOSAL_PDF_CELL_PADDING * 2) * PROPOSAL_PDF_MM_TO_PX,
          );
          row.pdfPlanImage = await cropDataUrlToCover(row.planImage, w, cellHPx);
        }
        if (swatchCol && row.swatches.length > 0) {
          const swW = Math.round(
            (swatchCol.pdfWidth - PROPOSAL_PDF_CELL_PADDING * 2) * PROPOSAL_PDF_MM_TO_PX,
          );
          const count = Math.min(row.swatches.length, PROPOSAL_SWATCH_LIMIT);
          const swH = Math.round(cellHPx / count);
          row.pdfSwatches = await Promise.all(
            row.swatches
              .slice(0, PROPOSAL_SWATCH_LIMIT)
              .map((s) => cropDataUrlToCover(s, swW, swH)),
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
      cellPadding: PROPOSAL_PDF_CELL_PADDING,
      overflow: 'linebreak',
      minCellHeight: PROPOSAL_PDF_ROW_HEIGHT,
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

      const pad = PROPOSAL_PDF_CELL_PADDING;

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
        const count = Math.min(row.pdfSwatches.length, PROPOSAL_SWATCH_LIMIT);
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

export async function exportProposalPdf(
  project: Project,
  categories: ProposalCategoryWithItems[],
  userProfile?: UserProfile | null,
  options: ProposalPdfOptions = {},
): Promise<void> {
  const mode = options.mode ?? 'continuous';
  const exportCategories = filteredProposalCategories(categories);
  const assets = await buildProposalAssetBundle(
    project.id,
    exportCategories,
    PROPOSAL_SWATCH_LIMIT,
  );
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
