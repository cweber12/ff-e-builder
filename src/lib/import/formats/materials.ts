import type { Workbook as ExcelWorkbook, Worksheet } from 'exceljs';
import {
  buildColumns,
  columnsToRecord,
  detectTableHeader,
  extractTableRows,
  normalizeLabel,
  type ImportColumn,
} from '../engine';
import { parseFileToRawRows } from '../parser';

export type FinishImportField =
  | 'name'
  | 'code'
  | 'category'
  | 'subCategory'
  | 'manufacturer'
  | 'sourceUrl'
  | 'swatchHex'
  | 'description'
  | 'image';

export type MaterialImportField =
  | 'name'
  | 'code'
  | 'finish'
  | 'materialType'
  | 'manufacturerRef'
  | 'materialId'
  | 'description';

export type FinishImportColumn = ImportColumn;
export type MaterialImportColumn = ImportColumn;

export type FinishImportColumnMap = Record<FinishImportField, string | null>;
export type MaterialImportColumnMap = Record<MaterialImportField, string | null>;

export type FinishImportImage = {
  id: string;
  filename: string;
  contentType: string;
  bytes: Uint8Array;
  row: number;
  column: number;
  rowEnd: number;
  columnEnd: number;
};

export type FinishParsedRow = {
  id: string;
  rowNumber: number;
  values: Record<string, string>;
  imagesByColumn: Record<string, FinishImportImage[]>;
  images: {
    image: FinishImportImage[];
  };
};

export type MaterialParsedRow = {
  id: string;
  rowNumber: number;
  values: Record<string, string>;
};

export type ParsedFinishSpreadsheet = {
  filename: string;
  sheetName: string;
  fileType: 'xlsx' | 'csv' | 'xls';
  columns: FinishImportColumn[];
  rows: FinishParsedRow[];
  warnings: string[];
};

export type ParsedMaterialSpreadsheet = {
  filename: string;
  sheetName: string;
  fileType: 'xlsx' | 'csv' | 'xls';
  columns: MaterialImportColumn[];
  rows: MaterialParsedRow[];
  warnings: string[];
};

const FINISH_HEADER_WARNING =
  'No recognizable header row was detected (expected at least 3 column labels).';

const FINISH_FIELD_ALIASES: Record<FinishImportField, string[]> = {
  name: ['name', 'finish name', 'material name'],
  code: ['code', 'finish code', 'finish id', 'id', 'sku'],
  category: ['category', 'finish category', 'class'],
  subCategory: ['sub category', 'sub-category', 'subcategory', 'sub type', 'type detail'],
  manufacturer: ['manufacturer', 'mfr', 'mfg', 'brand', 'vendor', 'supplier'],
  sourceUrl: ['source url', 'url', 'source', 'link', 'product url', 'website'],
  swatchHex: ['swatch color', 'swatch hex', 'hex', 'hex color', 'hex code', 'color'],
  description: ['description', 'desc', 'notes', 'comments'],
  image: ['swatch', 'image', 'swatch image', 'finish image'],
};

const MATERIAL_FIELD_ALIASES: Record<MaterialImportField, string[]> = {
  name: ['name', 'material name'],
  code: ['code', 'material code', 'id'],
  finish: ['finish', 'base finish', 'finish name'],
  materialType: ['type', 'material type', 'finish type'],
  manufacturerRef: ['manufacturer ref', 'mfr ref', 'manufacturer reference', 'vendor ref'],
  materialId: ['material id', 'part #', 'part number', 'part no', 'part no.', 'manufacturer id'],
  description: ['description', 'desc', 'notes', 'comments'],
};

export const FINISH_IMPORT_EMPTY_MAP: FinishImportColumnMap = {
  name: null,
  code: null,
  category: null,
  subCategory: null,
  manufacturer: null,
  sourceUrl: null,
  swatchHex: null,
  description: null,
  image: null,
};

export const MATERIAL_IMPORT_EMPTY_MAP: MaterialImportColumnMap = {
  name: null,
  code: null,
  finish: null,
  materialType: null,
  manufacturerRef: null,
  materialId: null,
  description: null,
};

export function autoMapFinishColumns(columns: FinishImportColumn[]): FinishImportColumnMap {
  return autoMapColumnsByAliases(columns, FINISH_FIELD_ALIASES, FINISH_IMPORT_EMPTY_MAP);
}

export function autoMapMaterialColumns(columns: MaterialImportColumn[]): MaterialImportColumnMap {
  return autoMapColumnsByAliases(columns, MATERIAL_FIELD_ALIASES, MATERIAL_IMPORT_EMPTY_MAP);
}

export async function parseFinishSpreadsheet(file: File): Promise<ParsedFinishSpreadsheet> {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  const fileType: ParsedFinishSpreadsheet['fileType'] =
    extension === 'xlsx' ? 'xlsx' : extension === 'csv' ? 'csv' : 'xls';

  if (fileType !== 'xlsx') {
    const { sheetName, rawRows } = await parseFileToRawRows(file);
    return parseFlatFinishRows(file, fileType, sheetName, rawRows);
  }

  const buffer = await file.arrayBuffer();
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return emptyParsedFinish(file, 'xlsx');

  const rawRows = readWorksheetRowsDense(worksheet);
  const images = extractWorksheetImages(workbook, worksheet);
  const imageColumnIndices = new Set(images.map((image) => image.column - 1));
  const headerIndex = detectTableHeader(rawRows, 25, imageColumnIndices);

  if (headerIndex === null) {
    return {
      ...emptyParsedFinish(file, 'xlsx'),
      sheetName: worksheet.name,
      warnings: [FINISH_HEADER_WARNING],
    };
  }

  const columns = buildColumns(rawRows[headerIndex] ?? []);
  const rows = extractTableRows(rawRows, headerIndex + 1)
    .map((rowArray) => {
      const rowNumber = rawRows.indexOf(rowArray) + 1;
      const values = columnsToRecord(columns, rowArray);
      const imagesByColumn = assignImagesByColumnRange(images, rowNumber, rowNumber, columns);
      const imageColumn = findColumnByAliases(columns, FINISH_FIELD_ALIASES.image);
      const rowImages = {
        image: (imageColumn ? (imagesByColumn[imageColumn.key] ?? []) : []).slice(0, 1),
      };
      return {
        id: String(rowNumber),
        rowNumber,
        values,
        imagesByColumn,
        images: rowImages,
      };
    })
    .filter((row) => {
      const hasValue = Object.values(row.values).some((value) => value.trim().length > 0);
      const hasImage = row.images.image.length > 0;
      return hasValue || hasImage;
    });

  return {
    filename: file.name,
    sheetName: worksheet.name,
    fileType: 'xlsx',
    columns,
    rows,
    warnings: [],
  };
}

export async function parseMaterialSpreadsheet(file: File): Promise<ParsedMaterialSpreadsheet> {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  const fileType: ParsedMaterialSpreadsheet['fileType'] =
    extension === 'xlsx' ? 'xlsx' : extension === 'csv' ? 'csv' : 'xls';
  const { sheetName, rawRows } = await parseFileToRawRows(file);
  const headerIndex = detectTableHeader(rawRows, 25);

  if (headerIndex === null) {
    return {
      ...emptyParsedMaterial(file, fileType),
      sheetName,
      warnings: [FINISH_HEADER_WARNING],
    };
  }

  const columns = buildColumns(rawRows[headerIndex] ?? []);
  const rows = extractTableRows(rawRows, headerIndex + 1)
    .map((rowArray) => {
      const rowNumber = rawRows.indexOf(rowArray) + 1;
      const values = columnsToRecord(columns, rowArray);
      return { id: String(rowNumber), rowNumber, values };
    })
    .filter((row) => Object.values(row.values).some((value) => value.trim().length > 0));

  return {
    filename: file.name,
    sheetName,
    fileType,
    columns,
    rows,
    warnings: [],
  };
}

function parseFlatFinishRows(
  file: File,
  fileType: 'csv' | 'xls',
  sheetName: string,
  rawRows: string[][],
): ParsedFinishSpreadsheet {
  const headerIndex = detectTableHeader(rawRows, 25);
  if (headerIndex === null) {
    return {
      ...emptyParsedFinish(file, fileType),
      sheetName,
      warnings: [FINISH_HEADER_WARNING],
    };
  }

  const columns = buildColumns(rawRows[headerIndex] ?? []);
  const rows = extractTableRows(rawRows, headerIndex + 1)
    .map((rowArray) => {
      const rowNumber = rawRows.indexOf(rowArray) + 1;
      const values = columnsToRecord(columns, rowArray);
      return {
        id: String(rowNumber),
        rowNumber,
        values,
        imagesByColumn: {},
        images: { image: [] },
      };
    })
    .filter((row) => Object.values(row.values).some((value) => value.trim().length > 0));

  return {
    filename: file.name,
    sheetName,
    fileType,
    columns,
    rows,
    warnings: [],
  };
}

function emptyParsedFinish(file: File, fileType: 'xlsx' | 'csv' | 'xls'): ParsedFinishSpreadsheet {
  return {
    filename: file.name,
    sheetName: '',
    fileType,
    columns: [],
    rows: [],
    warnings: [],
  };
}

function emptyParsedMaterial(
  file: File,
  fileType: 'xlsx' | 'csv' | 'xls',
): ParsedMaterialSpreadsheet {
  return {
    filename: file.name,
    sheetName: '',
    fileType,
    columns: [],
    rows: [],
    warnings: [],
  };
}

function autoMapColumnsByAliases<TField extends string, TMap extends Record<TField, string | null>>(
  columns: ImportColumn[],
  aliasesByField: Record<TField, string[]>,
  emptyMap: TMap,
): TMap {
  const result = { ...emptyMap };
  const unused = new Set(columns.map((column) => column.key));

  for (const field of Object.keys(aliasesByField) as TField[]) {
    let match: ImportColumn | undefined;
    for (const alias of aliasesByField[field]) {
      match = columns.find(
        (column) =>
          unused.has(column.key) && normalizeLabel(alias) === normalizeLabel(column.label),
      );
      if (match) break;
    }
    if (match) {
      result[field] = match.key as TMap[TField];
      unused.delete(match.key);
    }
  }

  return result;
}

function readWorksheetRowsDense(worksheet: Worksheet): string[][] {
  const rows: string[][] = [];
  worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    const values: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
      const isMergeFollower = cell.isMerged && cell.master.address !== cell.address;
      values[columnNumber - 1] = isMergeFollower ? '' : spreadsheetValueToString(cell.value);
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

function extractWorksheetImages(
  workbook: ExcelWorkbook,
  worksheet: Worksheet,
): FinishImportImage[] {
  const media = (workbook as unknown as { model?: { media?: unknown[] } }).model?.media ?? [];
  return worksheet.getImages().flatMap((image, index) => {
    const mediaEntry = media[Number(image.imageId)] as
      | { buffer?: Uint8Array; extension?: string; type?: string }
      | undefined;
    if (!mediaEntry?.buffer) return [];

    const range = image.range as unknown as {
      tl?: { nativeRow?: number; nativeCol?: number };
      br?: { nativeRow?: number; nativeCol?: number };
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

function assignImagesByColumnRange(
  images: FinishImportImage[],
  rowStart: number,
  rowEnd: number,
  columns: FinishImportColumn[],
): Record<string, FinishImportImage[]> {
  const rowImages = images.filter((image) => image.row <= rowEnd && image.rowEnd >= rowStart);
  const result: Record<string, FinishImportImage[]> = {};
  for (const column of columns) {
    result[column.key] = largestColumnOverlap(rowImages, column);
  }
  return result;
}

function largestColumnOverlap(
  images: FinishImportImage[],
  column: FinishImportColumn,
): FinishImportImage[] {
  return images
    .map((image) => ({ image, overlap: getColumnOverlap(image, column.columnNumber) }))
    .filter((entry) => entry.overlap > 0)
    .sort(
      (a, b) =>
        b.overlap - a.overlap || a.image.row - b.image.row || a.image.column - b.image.column,
    )
    .map((entry) => entry.image);
}

function getColumnOverlap(image: FinishImportImage, columnNumber: number): number {
  const start = image.column;
  const end = Math.max(image.columnEnd, image.column + 1);
  const overlapStart = Math.max(start, columnNumber);
  const overlapEnd = Math.min(end, columnNumber + 1);
  return Math.max(0, overlapEnd - overlapStart);
}

function findColumnByAliases(
  columns: FinishImportColumn[],
  aliases: readonly string[],
): FinishImportColumn | undefined {
  return columns.find((column) =>
    aliases.some((alias) => normalizeLabel(alias) === normalizeLabel(column.label)),
  );
}
