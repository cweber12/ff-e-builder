import { PROPOSAL_GENERATED_ITEM_TABLE_PRESET } from '../../../lib/table/generatedItemTablePresets';

const STICKY_RIGHT_COLUMN_IDS = new Set<string>(
  PROPOSAL_GENERATED_ITEM_TABLE_PRESET.fixedColumnIds,
);

const PROPOSAL_HIDEABLE_IDS = PROPOSAL_GENERATED_ITEM_TABLE_PRESET.hideableColumnIds;

type ProposalColumnId = (typeof PROPOSAL_HIDEABLE_IDS)[number];

const PROPOSAL_COLUMN_META = PROPOSAL_GENERATED_ITEM_TABLE_PRESET.columnMeta;

const quantityUnits = ['unit', 'sq ft', 'ln ft', 'sq yd', 'cu yd', 'each'] as const;

const editInputClassName =
  'rounded-sm border border-neutral-200 bg-canvas-chrome px-2 py-1 text-sm text-neutral-800 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500/30';

const stickyRevQtyHeaderClassName =
  'sticky right-[232px] z-40 bg-canvas-shell w-20 min-w-[80px] border-l-2 border-l-brand-400';
const stickyRevUnitCostHeaderClassName =
  'sticky right-[136px] z-40 bg-canvas-shell w-24 min-w-[96px]';
const stickyRevTotalHeaderClassName = 'sticky right-10 z-40 bg-canvas-shell w-24 min-w-[96px]';

const stickyRevQtyExpandedHeaderClassName =
  'sticky top-0 right-[232px] z-50 bg-canvas-shell w-20 min-w-[80px] border-l-2 border-l-brand-400';
const stickyRevUnitCostExpandedHeaderClassName =
  'sticky top-0 right-[136px] z-50 bg-canvas-shell w-24 min-w-[96px]';
const stickyRevTotalExpandedHeaderClassName =
  'sticky top-0 right-10 z-50 bg-canvas-shell w-24 min-w-[96px]';

const stickyRevQtyCellClassName =
  'sticky right-[232px] z-10 bg-canvas-chrome w-20 min-w-[80px] group-hover:bg-canvas-shell';
const stickyRevUnitCostCellClassName =
  'sticky right-[136px] z-10 bg-canvas-chrome w-24 min-w-[96px] group-hover:bg-canvas-shell';
const stickyRevTotalCellClassName =
  'sticky right-10 z-10 bg-canvas-chrome w-24 min-w-[96px] group-hover:bg-canvas-shell';

const baselineQtyColumnClassName = 'w-20 min-w-[80px]';
const baselineUnitCostColumnClassName = 'w-24 min-w-[96px]';
const baselineTotalColumnClassName = 'w-24 min-w-[96px]';
const revisionNotesColumnClassName = 'min-w-[160px]';

export {
  STICKY_RIGHT_COLUMN_IDS,
  PROPOSAL_HIDEABLE_IDS,
  PROPOSAL_COLUMN_META,
  quantityUnits,
  editInputClassName,
  stickyRevQtyHeaderClassName,
  stickyRevUnitCostHeaderClassName,
  stickyRevTotalHeaderClassName,
  stickyRevQtyExpandedHeaderClassName,
  stickyRevUnitCostExpandedHeaderClassName,
  stickyRevTotalExpandedHeaderClassName,
  stickyRevQtyCellClassName,
  stickyRevUnitCostCellClassName,
  stickyRevTotalCellClassName,
  baselineQtyColumnClassName,
  baselineUnitCostColumnClassName,
  baselineTotalColumnClassName,
  revisionNotesColumnClassName,
};

export type { ProposalColumnId };
