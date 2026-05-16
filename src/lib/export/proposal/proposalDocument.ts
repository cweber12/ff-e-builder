import {
  proposalCategorySubtotalCents,
  proposalLineTotalCents,
  proposalProjectTotalCents,
} from '../../money';
import type {
  CustomColumnDef,
  Project,
  ProposalCategoryWithItems,
  ProposalItem,
  ProposalItemChangelogEntry,
  ProposalRevision,
  RevisionSnapshot,
  UserProfile,
} from '../../../types';
import { fmtMoney } from '../shared';

export type ProposalExportColumnKey =
  | 'rendering'
  | 'productTag'
  | 'plan'
  | 'drawingsLocation'
  | 'description'
  | 'notes'
  | 'size'
  | 'swatch'
  | 'cbm'
  | 'quantity'
  | 'unit'
  | 'unitCost'
  | 'totalCost'
  | 'revisionNotes'
  | 'revQty'
  | 'revUnitCost'
  | 'revTotalCost';

export type ProposalExportColumn = {
  key: string;
  label: string;
  pdfWidth: number;
  excelWidth: number;
  alwaysVisible?: boolean;
  isCustom?: boolean;
  /** Column belongs to the revision snapshot block — used for conditional formatting. */
  isRevision?: boolean;
};

/** Revision data passed through to the export functions when a revision exists. */
export type RevisionExportData = {
  revisions: ProposalRevision[];
  snapshots: RevisionSnapshot[];
  changelog: ProposalItemChangelogEntry[];
};

/** Drives the red-below-original rich-text annotation in Excel for a single cell. */
export type RevAnnotation = {
  /** Revised value to display in red beneath the original. */
  revisedValue: string;
  /** True when cost_status='flagged' — drives amber cell highlighting. */
  flagged: boolean;
};

export type ProposalAssetBundle = {
  projectImages: string[];
  renderingByItemId: Map<string, string>;
  planByItemId: Map<string, string>;
  swatchesByItemId: Map<string, string[]>;
};

export type ProposalExportRow = {
  item: ProposalItem;
  values: Record<string, string>;
  rendering: string | null;
  planImage: string | null;
  swatches: string[];
  /** Pre-cropped to exact PDF cell dimensions - populated by prepareProposalPdfImages */
  pdfRendering: string | null;
  pdfPlanImage: string | null;
  pdfSwatches: string[];
  /** Per-cell revision annotations keyed by column key — original in black, revised in red below.
   *  Cost columns are excluded: their changes surface only in the Rev block columns. */
  revAnnotations: Record<string, RevAnnotation>;
  /** True when the snapshot has cost_status='flagged' — drives amber fill on rev cost cells. */
  revCostFlagged: boolean;
};

export type ProposalExportCategorySection = {
  category: ProposalCategoryWithItems;
  rows: ProposalExportRow[];
  subtotalCents: number;
  quantityTotal: number;
};

export type ProposalExportDocument = {
  companyName: string;
  projectLine: string;
  preparedByLine: string;
  compactIdentityLine: string;
  projectImages: string[];
  columns: ProposalExportColumn[];
  categories: ProposalExportCategorySection[];
  grandTotalCents: number;
  budgetTargetCents: number | null;
  /** True when revision columns are included in this export. */
  hasRevisionData: boolean;
};

const PROPOSAL_EXPORT_COLUMNS: ProposalExportColumn[] = [
  { key: 'rendering', label: 'Rendering', pdfWidth: 28, excelWidth: 24 },
  { key: 'productTag', label: 'Product Tag', pdfWidth: 18, excelWidth: 14, alwaysVisible: true },
  { key: 'plan', label: 'Plan', pdfWidth: 18, excelWidth: 24 },
  { key: 'drawingsLocation', label: 'Drawings / Location', pdfWidth: 24, excelWidth: 20 },
  {
    key: 'description',
    label: 'Product Description',
    pdfWidth: 40,
    excelWidth: 30,
    alwaysVisible: true,
  },
  { key: 'notes', label: 'Notes', pdfWidth: 28, excelWidth: 22 },
  { key: 'size', label: 'Size', pdfWidth: 22, excelWidth: 18 },
  { key: 'swatch', label: 'Swatch', pdfWidth: 16, excelWidth: 12 },
  { key: 'cbm', label: 'CBM', pdfWidth: 10, excelWidth: 9 },
  { key: 'quantity', label: 'Quantity', pdfWidth: 12, excelWidth: 10, alwaysVisible: true },
  { key: 'unit', label: 'Unit', pdfWidth: 12, excelWidth: 10, alwaysVisible: true },
  { key: 'unitCost', label: 'Unit Cost', pdfWidth: 15, excelWidth: 13, alwaysVisible: true },
  { key: 'totalCost', label: 'Total Cost', pdfWidth: 16, excelWidth: 14, alwaysVisible: true },
];

export function filteredProposalCategories(categories: ProposalCategoryWithItems[]) {
  return categories.filter((category) => category.items.length > 0);
}

export function proposalCompactIdentityLine(project: Project) {
  return [proposalDocumentCompany(project), project.name, project.projectLocation?.trim()]
    .filter(Boolean)
    .join(' | ');
}

export function proposalSubtotalLabelColumnIndex(columns: ProposalExportColumn[]) {
  const preferredKeys: string[] = ['description', 'drawingsLocation', 'productTag'];
  for (const key of preferredKeys) {
    const index = columns.findIndex((column) => column.key === key);
    if (index >= 0) return index;
  }
  return Math.max(0, columns.length - 2);
}

export function buildProposalExportDocument(
  project: Project,
  categories: ProposalCategoryWithItems[],
  assets: ProposalAssetBundle,
  userProfile?: UserProfile | null,
  customColumnDefs: CustomColumnDef[] = [],
  revisionData?: RevisionExportData,
  columnOrder?: string[],
): ProposalExportDocument {
  const openRev = revisionData?.revisions.find((r) => r.closedAt === null) ?? null;

  // Build per-item maps for the open revision.
  const snapshotMap = new Map<string, RevisionSnapshot>();
  const changelogMap = new Map<string, ProposalItemChangelogEntry[]>();
  if (openRev && revisionData) {
    for (const snap of revisionData.snapshots) {
      if (snap.revisionId === openRev.id) snapshotMap.set(snap.itemId, snap);
    }
    for (const entry of revisionData.changelog) {
      if (entry.revisionId !== openRev.id) continue;
      if (!changelogMap.has(entry.proposalItemId)) changelogMap.set(entry.proposalItemId, []);
      changelogMap.get(entry.proposalItemId)!.push(entry);
    }
  }

  const columns = buildProposalVisibleColumns(
    categories,
    assets,
    customColumnDefs,
    openRev !== null,
    columnOrder,
  );
  const categorySections = categories.map((category) => ({
    category,
    subtotalCents: proposalCategorySubtotalCents(category.items),
    quantityTotal: category.items.reduce((sum, item) => sum + item.quantity, 0),
    rows: category.items.map((item) => {
      const snap = snapshotMap.get(item.id);
      const isFlagged = snap?.costStatus === 'flagged';
      const changelogEntries = changelogMap.get(item.id) ?? [];

      // Compute per-cell annotations: only non-cost fields get the inline overlay.
      // Cost changes are surfaced exclusively through the Rev Unit Cost / Rev Total columns.
      const revAnnotations: Record<string, RevAnnotation> = {};
      if (openRev && snap && snap.quantity != null && snap.quantity !== item.quantity) {
        revAnnotations.quantity = { revisedValue: String(snap.quantity), flagged: isFlagged };
      }

      return {
        item,
        rendering: assets.renderingByItemId.get(item.id) ?? null,
        planImage: assets.planByItemId.get(item.id) ?? null,
        swatches: assets.swatchesByItemId.get(item.id) ?? [],
        pdfRendering: null,
        pdfPlanImage: null,
        pdfSwatches: [] as string[],
        revAnnotations,
        revCostFlagged: isFlagged,
        values: {
          ...Object.fromEntries(
            PROPOSAL_EXPORT_COLUMNS.map((column) => [
              column.key,
              buildProposalRowValue(item, column.key as ProposalExportColumnKey),
            ]),
          ),
          ...Object.fromEntries(
            customColumnDefs.map((def) => [def.id, item.customData[def.id] ?? '']),
          ),
          ...(openRev
            ? {
                revisionNotes: changelogEntries
                  .map((e) => e.notes)
                  .filter((n): n is string => Boolean(n))
                  .join('\n'),
                revQty: snap?.quantity != null ? String(snap.quantity) : '',
                revUnitCost:
                  !snap || snap.costStatus === 'none'
                    ? fmtMoney(item.unitCostCents || 0)
                    : snap.unitCostCents == null
                      ? ''
                      : fmtMoney(snap.unitCostCents),
                revTotalCost:
                  !snap || snap.costStatus === 'none'
                    ? fmtMoney(proposalLineTotalCents(item))
                    : snap.unitCostCents == null
                      ? ''
                      : fmtMoney(Math.round((snap.quantity ?? item.quantity) * snap.unitCostCents)),
              }
            : {}),
        },
      };
    }),
  }));

  return {
    companyName: proposalDocumentCompany(project),
    projectLine: proposalProjectLine(project),
    preparedByLine: proposalPreparedBy(userProfile),
    compactIdentityLine: proposalCompactIdentityLine(project),
    projectImages: assets.projectImages,
    columns,
    categories: categorySections,
    grandTotalCents: proposalProjectTotalCents(categories),
    budgetTargetCents: getProposalBudgetTarget(project),
    hasRevisionData: openRev !== null,
  };
}

function proposalPreparedBy(profile?: UserProfile | null) {
  return [profile?.name?.trim(), profile?.email?.trim()].filter(Boolean).join(' | ');
}

function proposalProjectLine(project: Project) {
  return [project.name, project.projectLocation?.trim()].filter(Boolean).join(' | ');
}

function proposalDocumentCompany(project: Project) {
  return project.companyName?.trim() || 'ChillDesignStudio';
}

function getProposalBudgetTarget(project: Project) {
  const relevant =
    project.budgetMode === 'individual'
      ? (project.proposalBudgetCents ?? 0)
      : (project.budgetCents ?? 0);
  return relevant > 0 ? relevant : null;
}

function buildProposalVisibleColumns(
  categories: ProposalCategoryWithItems[],
  assets: ProposalAssetBundle,
  customColumnDefs: CustomColumnDef[] = [],
  hasRevision: boolean = false,
  columnOrder?: string[],
): ProposalExportColumn[] {
  const items = categories.flatMap((category) => category.items);
  const hasRendering = items.some((item) => assets.renderingByItemId.has(item.id));
  const hasPlanImages = items.some((item) => assets.planByItemId.has(item.id));
  const hasSwatches = items.some((item) => (assets.swatchesByItemId.get(item.id)?.length ?? 0) > 0);

  const passesDataFilter = (column: ProposalExportColumn): boolean => {
    if (column.key === 'rendering') return hasRendering;
    if (column.key === 'plan')
      return (
        hasPlanImages ||
        items.some((item) => proposalColumnHasData(item, column.key as ProposalExportColumnKey))
      );
    if (column.key === 'swatch') return hasSwatches;
    if (column.alwaysVisible) return true;
    return items.some((item) => proposalColumnHasData(item, column.key as ProposalExportColumnKey));
  };

  const fixedColMap = new Map(PROPOSAL_EXPORT_COLUMNS.map((c) => [c.key, c]));

  const activeCustomColumns: ProposalExportColumn[] = customColumnDefs
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .filter((def) => items.some((item) => (item.customData[def.id] ?? '').trim() !== ''))
    .map((def) => ({
      key: def.id,
      label: def.label,
      pdfWidth: 20,
      excelWidth: 18,
      isCustom: true,
    }));

  const revisionColumns: ProposalExportColumn[] = hasRevision
    ? [
        {
          key: 'revisionNotes',
          label: 'Rev Notes',
          pdfWidth: 28,
          excelWidth: 26,
          isRevision: true,
        },
        { key: 'revQty', label: 'Rev Qty', pdfWidth: 12, excelWidth: 10, isRevision: true },
        {
          key: 'revUnitCost',
          label: 'Rev Unit Cost',
          pdfWidth: 15,
          excelWidth: 13,
          isRevision: true,
        },
        { key: 'revTotalCost', label: 'Rev Total', pdfWidth: 16, excelWidth: 14, isRevision: true },
      ]
    : [];

  if (columnOrder && columnOrder.length > 0) {
    const activeCustomColMap = new Map(activeCustomColumns.map((c) => [c.key, c]));
    const seen = new Set<string>();
    const orderedCols: ProposalExportColumn[] = [];

    for (const browserId of columnOrder) {
      // 'drawings' and 'location' are separate browser columns merged into one export column.
      const exportKey =
        browserId === 'drawings' || browserId === 'location' ? 'drawingsLocation' : browserId;

      // quantity and unitCost are always appended at the end of the standard block.
      if (exportKey === 'quantity' || exportKey === 'unitCost') continue;

      if (seen.has(exportKey)) continue;
      seen.add(exportKey);

      const fixedCol = fixedColMap.get(exportKey);
      if (fixedCol) {
        if (passesDataFilter(fixedCol)) orderedCols.push(fixedCol);
        continue;
      }

      const customCol = activeCustomColMap.get(exportKey);
      if (customCol) orderedCols.push(customCol);
    }

    // quantity, unit, unitCost, totalCost always appear at the end of the standard block.
    for (const key of ['quantity', 'unit', 'unitCost', 'totalCost'] as const) {
      const col = fixedColMap.get(key);
      if (col) orderedCols.push(col);
    }

    return [...orderedCols, ...revisionColumns];
  }

  // Fallback: original fixed order.
  const fixedColumns = PROPOSAL_EXPORT_COLUMNS.filter(passesDataFilter);
  return [...fixedColumns, ...activeCustomColumns, ...revisionColumns];
}

function buildProposalRowValue(item: ProposalItem, key: ProposalExportColumnKey) {
  switch (key) {
    case 'drawingsLocation': {
      const parts = [item.drawings.trim(), item.location.trim()].filter(Boolean);
      if (parts.length === 2) return `${parts[0]}\n${parts[1]}`;
      return parts[0] ?? '';
    }
    default:
      return proposalWrappedCellValue(item, key);
  }
}

function proposalColumnHasData(item: ProposalItem, key: ProposalExportColumnKey) {
  switch (key) {
    case 'plan':
      return Boolean(item.plan.trim());
    case 'drawingsLocation':
      return Boolean(item.drawings.trim() || item.location.trim());
    case 'description':
      return Boolean(item.description.trim());
    case 'notes':
      return Boolean(item.notes.trim());
    case 'size':
      return Boolean(item.sizeLabel.trim());
    case 'cbm':
      return item.cbm > 0;
    case 'quantity':
      return true;
    case 'unit':
      return true;
    case 'unitCost':
      return true;
    case 'totalCost':
      return true;
    case 'productTag':
      return true;
    case 'rendering':
    case 'swatch':
      return false;
  }
}

function proposalCellValue(item: ProposalItem, key: ProposalExportColumnKey) {
  switch (key) {
    case 'productTag':
      return item.productTag || '';
    case 'plan':
      return item.plan || '';
    case 'drawingsLocation':
      return [item.drawings, item.location].filter(Boolean).join(' / ');
    case 'description':
      return item.description || '';
    case 'notes':
      return item.notes || '';
    case 'size':
      return item.sizeLabel || '';
    case 'cbm':
      return item.cbm > 0 ? String(item.cbm) : '';
    case 'quantity':
      return String(item.quantity);
    case 'unit':
      return item.quantityUnit || '';
    case 'unitCost':
      return fmtMoney(item.unitCostCents || 0);
    case 'totalCost':
      return fmtMoney(proposalLineTotalCents(item));
    case 'rendering':
    case 'swatch':
      return '';
    default:
      return '';
  }
}

function truncateProposalText(value: string, maxChars: number) {
  const normalized = value.trim();
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, Math.max(0, maxChars - 3)).trimEnd()}...`;
}

function proposalWrappedCellValue(item: ProposalItem, key: ProposalExportColumnKey) {
  const value = proposalCellValue(item, key);
  if (key === 'description') return truncateProposalText(value, 96);
  if (key === 'notes') return truncateProposalText(value, 72);
  if (key === 'drawingsLocation') return truncateProposalText(value, 48);
  if (key === 'size') return truncateProposalText(value, 30);
  if (key === 'plan') return truncateProposalText(value, 24);
  return value;
}
