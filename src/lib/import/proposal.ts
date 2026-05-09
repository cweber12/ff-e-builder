import type { Workbook as ExcelWorkbook, Worksheet } from 'exceljs';
import * as XLSX from 'xlsx';

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

export type ProposalImportColumn = {
  key: string;
  label: string;
  columnNumber: number;
};

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

const HEADER_MATCH_THRESHOLD = 3;
const SUMMARY_ROW_PATTERNS = [
  /^total$/i,
  /^all total$/i,
  /^grand total$/i,
  /shipping/i,
  /dut(y|ies)/i,
  /assembly/i,
  /installation/i,
  /sales tax/i,
  /^tax$/i,
];

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
      return FIELD_ALIASES[field].includes(normalizeLabel(column.label));
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
  const content = Object.values(row.values).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();

  if (!content) return false;
  return SUMMARY_ROW_PATTERNS.some((pattern) => pattern.test(content));
}

export function imageToFile(image: ProposalImportImage, fallbackName: string): File {
  const bytes = new Uint8Array(image.bytes);
  // Use the exact byte view; using bytes.buffer can include unrelated bytes
  // when the source Uint8Array is a sliced view.
  const blob = new Blob([bytes], { type: image.contentType });
  return new File([blob], image.filename || fallbackName, { type: image.contentType });
}

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
  const rowValues = readWorksheetRows(worksheet);
  const headerRows = findHeaderRows(rowValues);
  if (headerRows.length === 0) {
    warnings.push('No Proposal header row was detected.');
    return {
      ...emptyParsedProposal(file, 'xlsx'),
      sheetName: worksheet.name,
      warnings,
    };
  }

  const firstHeader = headerRows[0]!;
  const columns = buildColumnsFromHeader(rowValues[firstHeader] ?? []);
  const images = extractWorksheetImages(workbook, worksheet);
  const sections: ProposalImportSection[] = [];
  const rows: ProposalParsedRow[] = [];

  for (let sectionIndex = 0; sectionIndex < headerRows.length; sectionIndex++) {
    const headerRowNumber = headerRows[sectionIndex]!;
    const nextHeaderRowNumber = headerRows[sectionIndex + 1] ?? worksheet.rowCount + 1;
    const categoryName =
      findCategoryName(rowValues, headerRowNumber) || `Category ${sectionIndex + 1}`;
    const startRow = headerRowNumber + 1;
    const sectionRows: ProposalParsedRow[] = [];

    for (let rowNumber = startRow; rowNumber < nextHeaderRowNumber; rowNumber++) {
      const values = rowValues[rowNumber] ?? [];
      if (isHeaderLikeRow(values)) continue;

      const record = columnsToRecord(columns, values);
      const imagesByColumn = assignImagesByColumn(images, rowNumber, columns);
      const rowImages = assignRowImages(imagesByColumn, columns);
      const parsedRow: ProposalParsedRow = {
        id: `${sectionIndex}:${rowNumber}`,
        rowNumber,
        categoryName,
        values: record,
        imagesByColumn,
        images: rowImages,
        sourceSectionIndex: sectionIndex,
      };

      const hasRawContent = Object.values(record).some((value) => value.trim().length > 0);
      const hasImages =
        rowImages.rendering.length > 0 ||
        rowImages.plan.length > 0 ||
        rowImages.swatches.length > 0;
      if (!hasRawContent && !hasImages) continue;

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
      rowCount: sectionRows.filter((row) => !row.skippedReason).length,
    });
  }

  return {
    filename: file.name,
    sheetName: worksheet.name,
    fileType: 'xlsx',
    columns,
    rows,
    sections,
    projectImages: extractProjectImages(images, headerRows[0]!),
    warnings,
  };
}

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
  const rowValues: string[][] = [];
  raw.forEach((row, index) => {
    rowValues[index + 1] = row.map(spreadsheetValueToString);
  });

  const headerRows = findHeaderRows(rowValues);
  if (headerRows.length === 0) {
    return {
      ...emptyParsedProposal(file, fileType),
      sheetName,
      warnings: ['No Proposal header row was detected.'],
    };
  }

  const columns = buildColumnsFromHeader(rowValues[headerRows[0]!] ?? []);
  const sections: ProposalImportSection[] = [];
  const rows: ProposalParsedRow[] = [];

  for (let sectionIndex = 0; sectionIndex < headerRows.length; sectionIndex++) {
    const headerRowNumber = headerRows[sectionIndex]!;
    const nextHeaderRowNumber = headerRows[sectionIndex + 1] ?? rowValues.length + 1;
    const categoryName =
      findCategoryName(rowValues, headerRowNumber) || `Category ${sectionIndex + 1}`;
    const sectionRows: ProposalParsedRow[] = [];

    for (let rowNumber = headerRowNumber + 1; rowNumber < nextHeaderRowNumber; rowNumber++) {
      const record = columnsToRecord(columns, rowValues[rowNumber] ?? []);
      const parsedRow: ProposalParsedRow = {
        id: `${sectionIndex}:${rowNumber}`,
        rowNumber,
        categoryName,
        values: record,
        imagesByColumn: {},
        images: { rendering: [], plan: [], swatches: [] },
        sourceSectionIndex: sectionIndex,
      };
      if (!Object.values(record).some((value) => value.trim().length > 0)) continue;
      if (isSummaryProposalRow(parsedRow)) parsedRow.skippedReason = 'Summary row';
      sectionRows.push(parsedRow);
      rows.push(parsedRow);
    }

    sections.push({
      index: sectionIndex,
      categoryName,
      headerRowNumber,
      rowCount: sectionRows.filter((row) => !row.skippedReason).length,
    });
  }

  return {
    filename: file.name,
    sheetName,
    fileType,
    columns,
    rows,
    sections,
    projectImages: [],
    warnings: fileType === 'csv' ? ['CSV imports support image URLs only.'] : [],
  };
}

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

function readWorksheetRows(worksheet: Worksheet): string[][] {
  const rows: string[][] = [];
  worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    const values: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
      values[columnNumber - 1] = spreadsheetValueToString(cell.value);
    });
    rows[rowNumber] = values;
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

function normalizeLabel(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function isHeaderLikeRow(values: string[]): boolean {
  let matches = 0;
  for (const value of values) {
    const normalized = normalizeLabel(value);
    if (!normalized) continue;
    if (Object.values(FIELD_ALIASES).some((aliases) => aliases.includes(normalized))) {
      matches += 1;
    }
  }
  return matches >= HEADER_MATCH_THRESHOLD;
}

function findHeaderRows(rowValues: string[][]): number[] {
  const rows: number[] = [];
  for (let rowNumber = 1; rowNumber < rowValues.length; rowNumber++) {
    if (isHeaderLikeRow(rowValues[rowNumber] ?? [])) rows.push(rowNumber);
  }
  return rows;
}

function buildColumnsFromHeader(headerValues: string[]): ProposalImportColumn[] {
  const used = new Map<string, number>();
  return headerValues.flatMap((rawLabel, index) => {
    const label = rawLabel.trim();
    if (!label) return [];
    const normalized = normalizeLabel(label) || `column ${index + 1}`;
    const count = used.get(normalized) ?? 0;
    used.set(normalized, count + 1);
    const suffix = count === 0 ? '' : ` ${count + 1}`;
    const key = `${label}${suffix}__${index + 1}`;
    const display = count === 0 ? label : `${label} (${count + 1})`;
    return [{ key, label: display, columnNumber: index + 1 }];
  });
}

function columnsToRecord(
  columns: ProposalImportColumn[],
  values: string[],
): Record<string, string> {
  const record: Record<string, string> = {};
  for (const column of columns) {
    record[column.key] = values[column.columnNumber - 1]?.trim() ?? '';
  }
  return record;
}

function findCategoryName(rowValues: string[][], headerRowNumber: number): string {
  for (
    let rowNumber = headerRowNumber - 1;
    rowNumber >= Math.max(1, headerRowNumber - 4);
    rowNumber--
  ) {
    const values = (rowValues[rowNumber] ?? []).map((value) => value.trim()).filter(Boolean);
    if (values.length === 1 && !isHeaderLikeRow(values)) return values[0]!;
  }
  return '';
}

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
  return columns.find((column) => aliases.includes(normalizeLabel(column.label)));
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

function extractProjectImages(
  images: ProposalImportImage[],
  firstHeaderRowNumber: number,
): ProposalImportImage[] {
  return images
    .filter((image) => image.rowEnd < firstHeaderRowNumber || image.row < firstHeaderRowNumber)
    .sort((a, b) => a.row - b.row || a.column - b.column)
    .slice(0, 3);
}
