import * as XLSX from 'xlsx';
import {
  buildColumns,
  columnsToRecord,
  detectTableHeader,
  extractTableRows,
  findRepeatHeaderIndices,
  findSectionTitle,
  isRepeatHeader,
  normalizeLabel,
  type ImportColumn,
} from './engine';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ParsedSection = {
  title: string;
  rows: Record<string, string>[];
};

export type ParsedSections = {
  columns: ImportColumn[];
  sections: ParsedSection[];
};

// ─── Utilities ────────────────────────────────────────────────────────────────

export function spreadsheetStringify(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString();
  return '';
}

// ─── Core extraction ──────────────────────────────────────────────────────────

export function parseRawRowsToSections(
  rawRows: string[][],
  options?: {
    skipColumns?: Set<number>;
    fallbackTitle?: (sectionIndex: number) => string;
  },
): ParsedSections {
  const { skipColumns, fallbackTitle = (i) => `Section ${i + 1}` } = options ?? {};

  const firstHeaderIndex = detectTableHeader(rawRows, 25, skipColumns);
  if (firstHeaderIndex === null) return { columns: [], sections: [] };

  const columns = buildColumns(rawRows[firstHeaderIndex] ?? []);
  const columnAliases = columns.map((c) => normalizeLabel(c.label));
  const allHeaderIndices = [
    firstHeaderIndex,
    ...findRepeatHeaderIndices(rawRows, firstHeaderIndex + 1, columnAliases),
  ];

  const sections: ParsedSection[] = allHeaderIndices.map((headerIndex, sectionIndex) => {
    const nextHeaderIndex = allHeaderIndices[sectionIndex + 1] ?? rawRows.length;
    const title = findSectionTitle(rawRows, headerIndex) || fallbackTitle(sectionIndex);
    const dataRows = extractTableRows(rawRows, headerIndex + 1, nextHeaderIndex);
    const rows = dataRows
      .filter((row) => !isRepeatHeader(row, columnAliases))
      .map((row) => columnsToRecord(columns, row))
      .filter((record) => Object.values(record).some((v) => v.trim().length > 0));
    return { title, rows };
  });

  return { columns, sections };
}

// ─── File reading ─────────────────────────────────────────────────────────────

export async function parseFileToRawRows(
  file: File,
): Promise<{ sheetName: string; rawRows: string[][] }> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });
  const sheetName = wb.SheetNames[0] ?? '';
  if (!sheetName) return { sheetName: '', rawRows: [] };
  const sheet = wb.Sheets[sheetName];
  if (!sheet) return { sheetName: '', rawRows: [] };
  const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
  const rawRows: string[][] = raw.map((row) => row.map(spreadsheetStringify));
  return { sheetName, rawRows };
}
