import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { BRAND_RGB } from '../constants';
import type { Finish, MaterialCategory, Project } from '../../types';
import { csvCell, safeName, triggerDownload } from './shared';

const BRAND = BRAND_RGB;
const FINISH_HEADERS = [
  'Code',
  'Name',
  'Category',
  'Sub-Category',
  'Manufacturer',
  'Source URL',
  'Swatch Color',
  'Description',
];

const CATEGORY_LABELS: Record<MaterialCategory, string> = {
  wood: 'Wood',
  metal: 'Metal',
  stone: 'Stone',
  glass: 'Glass',
  fabric: 'Fabric',
  solid_color: 'Solid Color',
};

function finishToRow(finish: Finish): string[] {
  return [
    finish.code,
    finish.name,
    finish.category ? CATEGORY_LABELS[finish.category] : '',
    finish.subCategory,
    finish.manufacturer,
    finish.sourceUrl,
    finish.swatchHex,
    finish.description,
  ];
}

export function exportFinishesExcel(
  project: Project,
  finishes: Finish[],
  format: 'xlsx' | 'csv' = 'xlsx',
): void {
  const rows = finishes.map((finish) => finishToRow(finish));
  if (format === 'csv') {
    const csv = [FINISH_HEADERS, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    triggerDownload(blob, `${safeName(project.name)}-finishes.csv`);
    return;
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([FINISH_HEADERS, ...rows]);
  XLSX.utils.book_append_sheet(wb, ws, 'Finishes');
  XLSX.writeFile(wb, `${safeName(project.name)}-finishes.xlsx`);
}

export function exportFinishesPdf(project: Project, finishes: Finish[]): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  doc.setFontSize(14);
  doc.setTextColor(BRAND[0], BRAND[1], BRAND[2]);
  doc.text(project.name, 14, 14);
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text('Finish Library', 14, 21);

  autoTable(doc, {
    startY: 28,
    head: [FINISH_HEADERS],
    body: finishes.map((finish) => finishToRow(finish)),
    headStyles: { fillColor: [...BRAND] as [number, number, number] },
    bodyStyles: { fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 28 },
      2: { cellWidth: 20 },
      3: { cellWidth: 20 },
      4: { cellWidth: 24 },
      5: { cellWidth: 30 },
      6: { cellWidth: 20 },
    },
  });

  doc.save(`${safeName(project.name)}-finishes.pdf`);
}
