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

export type SecondPassResult = {
  headerRowIndex: number;
  foundColumns: ImportColumn[];
  missingLabels: string[];
};

// ─── Constants ────────────────────────────────────────────────────────────────

const SCAN_LIMIT = 25;
const MIN_HEADER_CELLS = 2;
const CONSISTENCY_ROWS = 3;
const MIN_SCORE = 0.25;

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

function scoreHeaderCandidate(rows: string[][], rowIndex: number): number {
  const row = rows[rowIndex] ?? [];

  const labelCols: number[] = [];
  for (let i = 0; i < row.length; i++) {
    const cell = row[i]?.trim() ?? '';
    if (cell && !isPurelyNumeric(cell)) labelCols.push(i);
  }
  if (labelCols.length < MIN_HEADER_CELLS) return 0;

  let consistentCols = 0;
  for (const colIndex of labelCols) {
    let hits = 0;
    for (let r = rowIndex + 1; r <= rowIndex + CONSISTENCY_ROWS; r++) {
      if ((rows[r]?.[colIndex] ?? '').trim()) hits++;
    }
    if (hits >= 1) consistentCols++;
  }

  const labelScore = Math.min(1, labelCols.length / 5);
  const consistencyScore = consistentCols / labelCols.length;
  return labelScore * 0.4 + consistencyScore * 0.6;
}

export function detectTableHeader(rows: string[][], scanLimit = SCAN_LIMIT): number | null {
  let bestIndex = -1;
  let bestScore = 0;
  const limit = Math.min(rows.length, scanLimit);

  for (let i = 0; i < limit; i++) {
    const score = scoreHeaderCandidate(rows, i);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  return bestScore >= MIN_SCORE ? bestIndex : null;
}

// ─── Row extraction ───────────────────────────────────────────────────────────

export function extractTableRows(rows: string[][], startIndex: number): string[][] {
  const result: string[][] = [];
  for (let i = startIndex; i < rows.length; i++) {
    const row = rows[i] ?? [];
    if (isEmptyRow(row)) break;
    if (isSummaryRow(row)) break;
    result.push(row);
  }
  return result;
}

// ─── Second-pass scan (user-entered headers) ──────────────────────────────────

export function scanForExactHeaders(
  rows: string[][],
  targetLabels: string[],
): SecondPassResult | null {
  if (targetLabels.length === 0) return null;
  const normalizedTargets = targetLabels.map(normalizeLabel);

  let bestRowIndex = -1;
  let bestMatchCount = 0;
  let bestFoundColumns: ImportColumn[] = [];

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex] ?? [];
    const found: ImportColumn[] = [];
    const usedTargetIndices = new Set<number>();

    for (let colIndex = 0; colIndex < row.length; colIndex++) {
      const cellNorm = normalizeLabel(row[colIndex] ?? '');
      const matchIndex = normalizedTargets.indexOf(cellNorm);
      if (matchIndex !== -1 && !usedTargetIndices.has(matchIndex)) {
        usedTargetIndices.add(matchIndex);
        found.push({
          key: `${targetLabels[matchIndex]}__${colIndex + 1}`,
          label: targetLabels[matchIndex]!,
          columnNumber: colIndex + 1,
        });
      }
    }

    if (found.length > bestMatchCount) {
      bestMatchCount = found.length;
      bestRowIndex = rowIndex;
      bestFoundColumns = found;
    }
  }

  if (bestRowIndex === -1 || bestMatchCount === 0) return null;

  const foundNormalized = new Set(bestFoundColumns.map((c) => normalizeLabel(c.label)));
  const missingLabels = targetLabels.filter((l) => !foundNormalized.has(normalizeLabel(l)));

  return { headerRowIndex: bestRowIndex, foundColumns: bestFoundColumns, missingLabels };
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
