// ─── Types ────────────────────────────────────────────────────────────────────

export type ImportColumn = {
  key: string;
  label: string;
  columnNumber: number; // 1-based
};

export type DetectedTable = {
  headerRowIndex: number; // 0-based index into the rows array passed in
  columns: ImportColumn[];
  rows: Record<string, string>[];
};

// ─── Constants ────────────────────────────────────────────────────────────────

const SCAN_LIMIT = 25;
const MIN_HEADER_CELLS = 3;

export const SUMMARY_ROW_PATTERNS = [
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

// ─── Shared utilities ─────────────────────────────────────────────────────────

export function normalizeLabel(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Synonym groups for custom column labels.
// First entry in each group is the canonical label used when creating column defs.
const COLUMN_LABEL_SYNONYMS: string[][] = [
  ['Vendor', 'manufacturer', 'mfr', 'mfg', 'brand', 'make', 'supplier'],
  ['Model', 'model number', 'model no', 'model no.', 'model #', 'part number', 'part no'],
];

/**
 * Returns the canonical label for a column, resolving known synonyms.
 * e.g. "MANUFACTURER" → "Vendor", "Model No." → "Model"
 */
export function canonicalColumnLabel(label: string): string {
  const normalized = normalizeLabel(label);
  for (const group of COLUMN_LABEL_SYNONYMS) {
    if (group.some((syn) => normalizeLabel(syn) === normalized)) {
      return group[0]!;
    }
  }
  return label;
}

export function isSummaryRow(values: string[]): boolean {
  const nonEmpty = values.map((v) => v.trim()).filter(Boolean);
  if (nonEmpty.length === 0) return false;
  return (
    nonEmpty.some((cell) => SUMMARY_ROW_PATTERNS.some((p) => p.test(cell))) ||
    SUMMARY_ROW_PATTERNS.some((p) => p.test(nonEmpty.join(' ')))
  );
}

function isEmptyRow(row: string[]): boolean {
  return row.every((cell) => !cell?.trim());
}

function isPurelyNumeric(value: string): boolean {
  const cleaned = value.replace(/[$,\s%]/g, '');
  return cleaned.length > 0 && isFinite(Number(cleaned));
}

// ─── Column building ──────────────────────────────────────────────────────────

export function buildColumns(headerValues: string[]): ImportColumn[] {
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

export function columnsToRecord(columns: ImportColumn[], values: string[]): Record<string, string> {
  const record: Record<string, string> = {};
  for (const column of columns) {
    record[column.key] = values[column.columnNumber - 1]?.trim() ?? '';
  }
  return record;
}

// ─── Header detection ─────────────────────────────────────────────────────────

// Returns the index of the first row in the top `scanLimit` rows that has
// at least MIN_HEADER_CELLS non-empty, non-numeric cells (excluding skipColumns)
// and is immediately followed by a non-empty row.
export function detectTableHeader(
  rows: string[][],
  scanLimit = SCAN_LIMIT,
  skipColumns?: Set<number>,
): number | null {
  const limit = Math.min(rows.length, scanLimit);
  for (let i = 0; i < limit; i++) {
    const row = rows[i] ?? [];
    let labelCols = 0;
    for (let j = 0; j < row.length; j++) {
      if (skipColumns?.has(j)) continue;
      const cell = row[j]?.trim() ?? '';
      if (cell && !isPurelyNumeric(cell)) labelCols++;
    }
    if (labelCols < MIN_HEADER_CELLS) continue;
    const nextRow = rows[i + 1] ?? [];
    if (nextRow.some((cell) => cell?.trim())) return i;
  }
  return null;
}

// ─── Row extraction ───────────────────────────────────────────────────────────

// Extracts data rows starting at startIndex, skipping empty rows and stopping
// at the first summary row or stopIndex (exclusive). Empty rows within the
// data block are skipped rather than treated as end-of-table.
export function extractTableRows(
  rows: string[][],
  startIndex: number,
  stopIndex?: number,
): string[][] {
  const result: string[][] = [];
  const limit = stopIndex ?? rows.length;
  for (let i = startIndex; i < limit; i++) {
    const row = rows[i] ?? [];
    if (isSummaryRow(row)) break;
    if (!isEmptyRow(row)) result.push(row);
  }
  return result;
}

// ─── Section utilities ────────────────────────────────────────────────────────

// Returns the text of a single-cell row found within 4 rows above headerIndex,
// used as the Table Group name (Room for FF&E, Proposal Category for Proposal).
export function findSectionTitle(rows: string[][], headerIndex: number): string {
  for (let i = headerIndex - 1; i >= Math.max(0, headerIndex - 4); i--) {
    const values = (rows[i] ?? []).map((v) => v.trim()).filter(Boolean);
    if (values.length === 1) return values[0]!;
  }
  return '';
}

// Returns 0-based indices of rows (starting at startIndex) that look like a
// repeat of the column header row — at least `threshold` of their cells match
// known column aliases. Used to detect section boundaries in multi-section sheets.
export function findRepeatHeaderIndices(
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

export function isRepeatHeader(
  row: string[],
  columnAliases: string[],
  threshold = Math.min(3, columnAliases.length),
): boolean {
  const matchCount = row.filter((v) => columnAliases.includes(normalizeLabel(v))).length;
  return matchCount >= threshold;
}

// ─── High-level convenience ───────────────────────────────────────────────────

export function detectTable(rows: string[][], scanLimit = SCAN_LIMIT): DetectedTable | null {
  const headerRowIndex = detectTableHeader(rows, scanLimit);
  if (headerRowIndex === null) return null;

  const columns = buildColumns(rows[headerRowIndex] ?? []);
  const dataRows = extractTableRows(rows, headerRowIndex + 1);
  const records = dataRows.map((row) => columnsToRecord(columns, row));

  return { headerRowIndex, columns, rows: records };
}
