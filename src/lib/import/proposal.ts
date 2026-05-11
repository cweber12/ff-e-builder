import type { Workbook as ExcelWorkbook, Worksheet } from 'exceljs';
import * as XLSX from 'xlsx';
import {
  buildColumns,
  columnsToRecord,
  detectTableHeader,
  isSummaryRow,
  normalizeLabel,
  type ImportColumn,
} from './engine';

export type ProposalImportField =
  | 'category'
  | 'rendering'
  | 'productTag'
  | 'plan'
  | 'drawings'
  | 'location'
  | 'description'
  | 'sizeLabel'
  | 'swatches'
  | 'cbm'
  | 'quantity'
  | 'quantityUnit'
  | 'unitCost';

// Same shape as ImportColumn — re-exported for backward compatibility
export type ProposalImportColumn = ImportColumn;

export type ProposalImportColumnMap = Record<ProposalImportField, string | null>;

export type ProposalImportImage = {
  id: string;
  filename: string;
  contentType: string;
  bytes: Uint8Array;
  row: number;
  column: number;
  rowEnd: number;
  columnEnd: number;
};

export type ProposalParsedRow = {
  id: string;
  rowNumber: number;
  categoryName: string;
  values: Record<string, string>;
  imagesByColumn: Record<string, ProposalImportImage[]>;
  images: {
    rendering: ProposalImportImage[];
    plan: ProposalImportImage[];
    swatches: ProposalImportImage[];
  };
  sourceSectionIndex: number;
  skippedReason?: string;
};

export type ProposalImportSection = {
  index: number;
  categoryName: string;
  headerRowNumber: number;
  rowCount: number;
};

export type ParsedProposalSpreadsheet = {
  filename: string;
  sheetName: string;
  fileType: 'xlsx' | 'csv' | 'xls';
  columns: ProposalImportColumn[];
  rows: ProposalParsedRow[];
  sections: ProposalImportSection[];
  projectImages: ProposalImportImage[];
  warnings: string[];
};

const FIELD_ALIASES: Record<ProposalImportField, string[]> = {
  category: ['category', 'table category', 'section'],
  rendering: ['rendering', 'render', 'image', 'product image'],
  productTag: ['product tag', 'tag', 'product', 'item tag', 'product id'],
  plan: ['plan', 'plan image'],
  drawings: ['drawings', 'drawing', 'drawings / location', 'drawings location'],
  location: ['location', 'area', 'room', 'space'],
  description: ['product description', 'description', 'desc'],
  sizeLabel: ['size', 'dimensions', 'dimension', 'dims'],
  swatches: ['swatch', 'swatches', 'material', 'finish', 'finishes'],
  cbm: ['cbm'],
  quantity: ['quantity', 'qty', 'count'],
  quantityUnit: ['unit', 'uom', 'quantity unit', 'measure'],
  unitCost: ['unit cost', 'cost', 'price', 'unit price'],
};

export const PROPOSAL_IMPORT_EMPTY_MAP: ProposalImportColumnMap = {
  category: null,
  rendering: null,
  productTag: null,
  plan: null,
  drawings: null,
  location: null,
  description: null,
  sizeLabel: null,
  swatches: null,
  cbm: null,
  quantity: null,
  quantityUnit: null,
  unitCost: null,
};

export function autoMapProposalColumns(columns: ProposalImportColumn[]): ProposalImportColumnMap {
  const result: ProposalImportColumnMap = { ...PROPOSAL_IMPORT_EMPTY_MAP };
  const unused = new Set(columns.map((column) => column.key));

  for (const field of Object.keys(FIELD_ALIASES) as ProposalImportField[]) {
    const match = columns.find((column) => {
      if (!unused.has(column.key)) return false;
      return FIELD_ALIASES[field].some(
        (alias) => normalizeLabel(alias) === normalizeLabel(column.label),
      );
    });
    if (match) {
      result[field] = match.key;
      unused.delete(match.key);
    }
  }

  return result;
}

export async function parseProposalSpreadsheet(file: File): Promise<ParsedProposalSpreadsheet> {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (extension === 'xlsx') return parseXlsxProposalSpreadsheet(file);
  return parseFlatProposalSpreadsheet(file, extension === 'csv' ? 'csv' : 'xls');
}

export function rowHasImportableContent(
  row: ProposalParsedRow,
  mapping: ProposalImportColumnMap,
): boolean {
  const hasMappedValue = (Object.keys(mapping) as ProposalImportField[]).some((field) => {
    const columnKey = mapping[field];
    if (!columnKey) return false;
    return (row.values[columnKey] ?? '').trim().length > 0;
  });
  const hasMappedImage = (['rendering', 'plan', 'swatches'] as ProposalImportField[]).some(
    (field) => {
      const columnKey = mapping[field];
      if (!columnKey) return false;
      return (row.imagesByColumn[columnKey] ?? []).length > 0;
    },
  );

  return hasMappedValue || hasMappedImage;
}

export function isSummaryProposalRow(row: ProposalParsedRow): boolean {
  return isSummaryRow(Object.values(row.values));
}

export function imageToFile(image: ProposalImportImage, fallbackName: string): File {
  const bytes = new Uint8Array(image.bytes);
  // Use the exact byte view; using bytes.buffer can include unrelated bytes
  // when the source Uint8Array is a sliced view.
  const blob = new Blob([bytes], { type: image.contentType });
  return new File([blob], image.filename || fallbackName, { type: image.contentType });
}

// ─── XLSX parsing ─────────────────────────────────────────────────────────────

async function parseXlsxProposalSpreadsheet(file: File): Promise<ParsedProposalSpreadsheet> {
  const buffer = await file.arrayBuffer();
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    return emptyParsedProposal(file, 'xlsx');
  }

  const warnings: string[] = [];
  const rawRows = readWorksheetRowsDense(worksheet);
  const images = extractWorksheetImages(workbook, worksheet);

  const firstHeaderIndex = detectTableHeader(rawRows, 25);
  if (firstHeaderIndex === null) {
    warnings.push('No Proposal header row was detected.');
    return { ...emptyParsedProposal(file, 'xlsx'), sheetName: worksheet.name, warnings };
  }

  const sharedColumns = buildColumns(rawRows[firstHeaderIndex] ?? []);
  const columnAliases = sharedColumns.map((c) => normalizeLabel(c.label));
  const allHeaderIndices = [
    firstHeaderIndex,
    ...findRepeatHeaderIndices(rawRows, firstHeaderIndex + 1, columnAliases),
  ];

  const sections: ProposalImportSection[] = [];
  const rows: ProposalParsedRow[] = [];

  for (let sectionIndex = 0; sectionIndex < allHeaderIndices.length; sectionIndex++) {
    const headerIndex = allHeaderIndices[sectionIndex]!;
    const nextHeaderIndex = allHeaderIndices[sectionIndex + 1] ?? rawRows.length;
    const headerRowNumber = headerIndex + 1; // 1-based for display and ExcelJS image coordinates
    const categoryName = findCategoryName(rawRows, headerIndex) || `Category ${sectionIndex + 1}`;
    const sectionRows: ProposalParsedRow[] = [];

    for (let i = headerIndex + 1; i < nextHeaderIndex; i++) {
      const rowArray = rawRows[i] ?? [];
      if (isRepeatHeader(rowArray, columnAliases)) continue;

      const record = columnsToRecord(sharedColumns, rowArray);
      const rowNumber = i + 1; // 1-based to match ExcelJS image coordinates
      const imagesByColumn = assignImagesByColumn(images, rowNumber, sharedColumns);
      const rowImages = assignRowImages(imagesByColumn, sharedColumns);

      const hasRawContent = Object.values(record).some((v) => v.trim().length > 0);
      const hasImages =
        rowImages.rendering.length > 0 ||
        rowImages.plan.length > 0 ||
        rowImages.swatches.length > 0;
      if (!hasRawContent && !hasImages) continue;

      const parsedRow: ProposalParsedRow = {
        id: `${sectionIndex}:${rowNumber}`,
        rowNumber,
        categoryName,
        values: record,
        imagesByColumn,
        images: rowImages,
        sourceSectionIndex: sectionIndex,
      };

      if (isSummaryProposalRow(parsedRow)) {
        parsedRow.skippedReason = 'Summary row';
      }

      sectionRows.push(parsedRow);
      rows.push(parsedRow);
    }

    sections.push({
      index: sectionIndex,
      categoryName,
      headerRowNumber,
      rowCount: sectionRows.filter((r) => !r.skippedReason).length,
    });
  }

  return {
    filename: file.name,
    sheetName: worksheet.name,
    fileType: 'xlsx',
    columns: sharedColumns,
    rows,
    sections,
    projectImages: extractProjectImages(images, firstHeaderIndex + 1),
    warnings,
  };
}

// ─── Flat file parsing (CSV / XLS) ───────────────────────────────────────────

async function parseFlatProposalSpreadsheet(
  file: File,
  fileType: 'csv' | 'xls',
): Promise<ParsedProposalSpreadsheet> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return emptyParsedProposal(file, fileType);

  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return emptyParsedProposal(file, fileType);

  const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
  const rawRows: string[][] = raw.map((row) => row.map(spreadsheetValueToString));

  const firstHeaderIndex = detectTableHeader(rawRows, 25);
  if (firstHeaderIndex === null) {
    return {
      ...emptyParsedProposal(file, fileType),
      sheetName,
      warnings: ['No Proposal header row was detected.'],
    };
  }

  const sharedColumns = buildColumns(rawRows[firstHeaderIndex] ?? []);
  const columnAliases = sharedColumns.map((c) => normalizeLabel(c.label));
  const allHeaderIndices = [
    firstHeaderIndex,
    ...findRepeatHeaderIndices(rawRows, firstHeaderIndex + 1, columnAliases),
  ];

  const sections: ProposalImportSection[] = [];
  const rows: ProposalParsedRow[] = [];

  for (let sectionIndex = 0; sectionIndex < allHeaderIndices.length; sectionIndex++) {
    const headerIndex = allHeaderIndices[sectionIndex]!;
    const nextHeaderIndex = allHeaderIndices[sectionIndex + 1] ?? rawRows.length;
    const headerRowNumber = headerIndex + 1;
    const categoryName = findCategoryName(rawRows, headerIndex) || `Category ${sectionIndex + 1}`;
    const sectionRows: ProposalParsedRow[] = [];

    for (let i = headerIndex + 1; i < nextHeaderIndex; i++) {
      const rowArray = rawRows[i] ?? [];
      if (isRepeatHeader(rowArray, columnAliases)) continue;

      const record = columnsToRecord(sharedColumns, rowArray);
      if (!Object.values(record).some((v) => v.trim().length > 0)) continue;

      const rowNumber = i + 1;
      const parsedRow: ProposalParsedRow = {
        id: `${sectionIndex}:${rowNumber}`,
        rowNumber,
        categoryName,
        values: record,
        imagesByColumn: {},
        images: { rendering: [], plan: [], swatches: [] },
        sourceSectionIndex: sectionIndex,
      };

      if (isSummaryProposalRow(parsedRow)) parsedRow.skippedReason = 'Summary row';
      sectionRows.push(parsedRow);
      rows.push(parsedRow);
    }

    sections.push({
      index: sectionIndex,
      categoryName,
      headerRowNumber,
      rowCount: sectionRows.filter((r) => !r.skippedReason).length,
    });
  }

  return {
    filename: file.name,
    sheetName,
    fileType,
    columns: sharedColumns,
    rows,
    sections,
    projectImages: [],
    warnings: fileType === 'csv' ? ['CSV imports support image URLs only.'] : [],
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function emptyParsedProposal(
  file: File,
  fileType: 'xlsx' | 'csv' | 'xls',
): ParsedProposalSpreadsheet {
  return {
    filename: file.name,
    sheetName: '',
    fileType,
    columns: [],
    rows: [],
    sections: [],
    projectImages: [],
    warnings: [],
  };
}

// Returns a 0-based dense array; rowNumber from eachRow is 1-based so we subtract 1
function readWorksheetRowsDense(worksheet: Worksheet): string[][] {
  const rows: string[][] = [];
  worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    const values: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
      values[columnNumber - 1] = spreadsheetValueToString(cell.value);
    });
    rows[rowNumber - 1] = values;
  });
  return rows;
}

function spreadsheetValueToString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (Array.isArray(record['richText'])) {
      return (record['richText'] as Array<{ text?: string }>)
        .map((part) => part.text ?? '')
        .join('')
        .trim();
    }
    if (typeof record['text'] === 'string') return record['text'].trim();
    if (typeof record['result'] === 'string' || typeof record['result'] === 'number') {
      return String(record['result']).trim();
    }
    if (typeof record['hyperlink'] === 'string') return record['hyperlink'].trim();
  }
  return '';
}

// Find all rows whose cell values match ≥ threshold of the shared column aliases
function findRepeatHeaderIndices(
  rows: string[][],
  startIndex: number,
  columnAliases: string[],
): number[] {
  const threshold = Math.min(3, columnAliases.length);
  const result: number[] = [];
  for (let i = startIndex; i < rows.length; i++) {
    if (isRepeatHeader(rows[i] ?? [], columnAliases, threshold)) result.push(i);
  }
  return result;
}

function isRepeatHeader(
  row: string[],
  columnAliases: string[],
  threshold = Math.min(3, columnAliases.length),
): boolean {
  const matchCount = row.filter((v) => columnAliases.includes(normalizeLabel(v))).length;
  return matchCount >= threshold;
}

// Look backward from headerIndex for a row with exactly one non-empty cell (category name)
function findCategoryName(rows: string[][], headerIndex: number): string {
  for (let i = headerIndex - 1; i >= Math.max(0, headerIndex - 4); i--) {
    const values = (rows[i] ?? []).map((v) => v.trim()).filter(Boolean);
    if (values.length === 1) return values[0]!;
  }
  return '';
}

// ─── Image handling ───────────────────────────────────────────────────────────

function extractWorksheetImages(
  workbook: ExcelWorkbook,
  worksheet: Worksheet,
): ProposalImportImage[] {
  const media = (workbook as unknown as { model?: { media?: unknown[] } }).model?.media ?? [];
  return worksheet.getImages().flatMap((image, index) => {
    const mediaEntry = media[Number(image.imageId)] as
      | { buffer?: Uint8Array; extension?: string; type?: string }
      | undefined;
    if (!mediaEntry?.buffer) return [];

    const range = image.range as unknown as {
      tl?: { nativeRow?: number; nativeCol?: number };
      br?: { nativeRow?: number; nativeCol?: number };
      ext?: { width?: number; height?: number };
    };
    const row = (range.tl?.nativeRow ?? 0) + 1;
    const column = (range.tl?.nativeCol ?? 0) + 1;
    const rowEnd = (range.br?.nativeRow ?? range.tl?.nativeRow ?? 0) + 1;
    const columnEnd = (range.br?.nativeCol ?? range.tl?.nativeCol ?? 0) + 1;
    const extension = mediaEntry.extension ?? 'png';

    return [
      {
        id: `${image.imageId}:${index}`,
        filename: `imported-image-${index + 1}.${extension}`,
        contentType: contentTypeForExtension(extension),
        bytes: mediaEntry.buffer,
        row,
        column,
        rowEnd: Math.max(row, rowEnd),
        columnEnd: Math.max(column, columnEnd),
      },
    ];
  });
}

function contentTypeForExtension(extension: string): string {
  const normalized = extension.toLowerCase();
  if (normalized === 'jpg' || normalized === 'jpeg') return 'image/jpeg';
  if (normalized === 'webp') return 'image/webp';
  if (normalized === 'gif') return 'image/gif';
  return 'image/png';
}

function assignImagesByColumn(
  images: ProposalImportImage[],
  rowNumber: number,
  columns: ProposalImportColumn[],
): Record<string, ProposalImportImage[]> {
  const rowImages = images.filter((image) => image.row <= rowNumber && image.rowEnd >= rowNumber);
  const result: Record<string, ProposalImportImage[]> = {};
  for (const column of columns) {
    result[column.key] = largestColumnOverlap(rowImages, column);
  }
  return result;
}

function assignRowImages(
  imagesByColumn: Record<string, ProposalImportImage[]>,
  columns: ProposalImportColumn[],
): ProposalParsedRow['images'] {
  const renderingColumn = findColumnByAliases(columns, FIELD_ALIASES.rendering);
  const planColumn = findColumnByAliases(columns, FIELD_ALIASES.plan);
  const swatchColumn = findColumnByAliases(columns, FIELD_ALIASES.swatches);

  return {
    rendering: (renderingColumn ? (imagesByColumn[renderingColumn.key] ?? []) : []).slice(0, 1),
    plan: (planColumn ? (imagesByColumn[planColumn.key] ?? []) : []).slice(0, 1),
    swatches: (swatchColumn ? (imagesByColumn[swatchColumn.key] ?? []) : []).slice(0, 4),
  };
}

function findColumnByAliases(
  columns: ProposalImportColumn[],
  aliases: readonly string[],
): ProposalImportColumn | undefined {
  return columns.find((column) =>
    aliases.some((alias) => normalizeLabel(alias) === normalizeLabel(column.label)),
  );
}

function largestColumnOverlap(
  images: ProposalImportImage[],
  column: ProposalImportColumn,
): ProposalImportImage[] {
  return images
    .map((image) => ({
      image,
      overlap: getColumnOverlap(image, column.columnNumber),
    }))
    .filter((entry) => entry.overlap > 0)
    .sort(
      (a, b) =>
        b.overlap - a.overlap || a.image.row - b.image.row || a.image.column - b.image.column,
    )
    .map((entry) => entry.image);
}

function getColumnOverlap(image: ProposalImportImage, columnNumber: number): number {
  const start = image.column;
  const end = Math.max(image.columnEnd, image.column + 1);
  const overlapStart = Math.max(start, columnNumber);
  const overlapEnd = Math.min(end, columnNumber + 1);
  return Math.max(0, overlapEnd - overlapStart);
}

// firstHeaderRowNumber is 1-based (matching ExcelJS image coordinates)
function extractProjectImages(
  images: ProposalImportImage[],
  firstHeaderRowNumber: number,
): ProposalImportImage[] {
  return images
    .filter((image) => image.rowEnd < firstHeaderRowNumber || image.row < firstHeaderRowNumber)
    .sort((a, b) => a.row - b.row || a.column - b.column)
    .slice(0, 3);
}
