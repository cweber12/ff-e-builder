import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { BRAND_RGB } from '../constants';
import type { Material, Project } from '../../types';
import { csvCell, safeName, triggerDownload } from './shared';
import { MATERIAL_TYPE_LABELS } from '../../components/materials/MaterialLibraryModal';

const BRAND = BRAND_RGB;
const MATERIAL_HEADERS = ['Code', 'Name', 'Type', 'Manufacturer Ref', 'Description'];

function materialToRow(material: Material): string[] {
  return [
    material.code,
    material.name,
    material.materialType ? MATERIAL_TYPE_LABELS[material.materialType] : '',
    material.materialId,
    material.description,
  ];
}

export function exportMaterialsExcel(
  project: Project,
  materials: Material[],
  format: 'xlsx' | 'csv' = 'xlsx',
): void {
  const rows = materials.map((material) => materialToRow(material));
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

export function exportMaterialsPdf(project: Project, materials: Material[]): void {
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
    body: materials.map((material) => materialToRow(material)),
    headStyles: { fillColor: [...BRAND] as [number, number, number] },
    bodyStyles: { fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 24 },
      1: { cellWidth: 50 },
      2: { cellWidth: 30 },
      3: { cellWidth: 30 },
    },
  });

  doc.save(`${safeName(project.name)}-materials.pdf`);
}
