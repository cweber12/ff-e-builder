export {
  buildColumns,
  columnsToRecord,
  detectIdColumn,
  detectTable,
  detectTableHeader,
  extractTableRows,
  groupRowsById,
  isSummaryRow,
  normalizeLabel,
  scanForExactHeaders,
  ITEM_ID_PATTERN,
  SUMMARY_ROW_PATTERNS,
} from './engine';
export type { DetectedTable, GroupedRow, ImportColumn, SecondPassResult } from './engine';

export {
  autoMapColumns,
  parseExcelFile,
  parseExcelFileWithLabels,
  transformRow,
  transformRows,
} from './ffe';
export type { ColumnMap, ImportedItem, ParsedSpreadsheet } from './ffe';

export {
  PROPOSAL_IMPORT_EMPTY_MAP,
  autoMapProposalColumns,
  imageToFile,
  isSummaryProposalRow,
  parseProposalSpreadsheet,
  parseProposalSpreadsheetWithLabels,
  rowHasImportableContent,
} from './proposal';
export type {
  ParsedProposalSpreadsheet,
  ProposalImportColumn,
  ProposalImportColumnMap,
  ProposalImportField,
  ProposalImportImage,
  ProposalImportSection,
  ProposalParsedRow,
} from './proposal';
