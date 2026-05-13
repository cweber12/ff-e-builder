export { formatDuration, describeImportError } from './utils';
export type { ImportProgress } from './utils';

export {
  buildColumns,
  canonicalColumnLabel,
  columnsToRecord,
  detectTable,
  detectTableHeader,
  extractTableRows,
  findRepeatHeaderIndices,
  findSectionTitle,
  isRepeatHeader,
  isSummaryRow,
  normalizeLabel,
  SUMMARY_ROW_PATTERNS,
} from './engine';
export type { DetectedTable, ImportColumn } from './engine';

export { parseFileToRawRows, parseRawRowsToSections, spreadsheetStringify } from './parser';
export type { ParsedSection, ParsedSections } from './parser';

export { autoMapColumns, parseFFESpreadsheet, transformRow, transformRows } from './formats/ffe';
export type { ColumnMap, ImportedItem, ParsedFFESpreadsheet } from './formats/ffe';

export {
  PROPOSAL_IMPORT_EMPTY_MAP,
  autoMapProposalColumns,
  imageToFile,
  isSummaryProposalRow,
  parseProposalSpreadsheet,
  rowHasImportableContent,
} from './formats/proposal';
export type {
  ParsedProposalSpreadsheet,
  ProposalImportColumn,
  ProposalImportColumnMap,
  ProposalImportField,
  ProposalImportImage,
  ProposalImportSection,
  ProposalParsedRow,
} from './formats/proposal';
