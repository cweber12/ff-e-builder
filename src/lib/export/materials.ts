import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { api } from '../api';
import { BRAND_RGB } from '../theme/constants';
import type { Material, Project } from '../../types';
import { csvCell, safeName, triggerDownload } from './shared';

const BRAND = BRAND_RGB;
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
