export {
  buildColumns,
  columnsToRecord,
  detectTable,
  detectTableHeader,
  extractTableRows,
  isSummaryRow,
  normalizeLabel,
  scanForExactHeaders,
  SUMMARY_ROW_PATTERNS,
} from './engine';
export type { DetectedTable, ImportColumn, SecondPassResult } from './engine';

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
