import {
  FFE_GENERATED_ITEM_TABLE_PRESET,
  PROPOSAL_GENERATED_ITEM_TABLE_PRESET,
} from '../../../lib/table/generatedItemTablePresets';
import { resolveGeneratedItemColumns } from '../../../lib/table/generatedItemColumnModel';

type StickyColumnStyle = {
  rightClassName: string;
  widthClassName: string;
  cellZClassName?: string | undefined;
  hoverClassName?: string | undefined;
  leadingEdge?: boolean | undefined;
};

type StickyColumnClassNames = {
  header: string;
  expandedHeader: string;
  cell: string;
};

export type GeneratedItemStickyClassNames = {
  byColumnId: Record<string, StickyColumnClassNames>;
};

type StickyStyleConfig = {
  edge: Readonly<Record<string, StickyColumnStyle>>;
  value: Readonly<Record<string, StickyColumnStyle>>;
};

const HEADER_BG = 'bg-canvas-shell';
const CELL_BG = 'bg-surface';
const LEADING_EDGE = 'border-l border-neutral-300 shadow-[-6px_0_8px_-6px_rgb(15_23_42/0.12)]';

function edgeClassName(style: StickyColumnStyle) {
  return style.leadingEdge ? ` ${LEADING_EDGE}` : '';
}

function headerClassName(style: StickyColumnStyle) {
  return `sticky ${style.rightClassName} z-40 ${HEADER_BG} ${style.widthClassName}${edgeClassName(style)}`;
}

function expandedHeaderClassName(style: StickyColumnStyle) {
  return `sticky top-0 ${style.rightClassName} z-50 ${HEADER_BG} ${style.widthClassName}${edgeClassName(style)}`;
}

function cellClassName(style: StickyColumnStyle) {
  const zClassName = style.cellZClassName ?? 'z-20';
  return `sticky ${style.rightClassName} ${zClassName} ${CELL_BG} ${style.widthClassName}${edgeClassName(style)}${
    style.hoverClassName ? ` ${style.hoverClassName}` : ''
  }`;
}

function createStickyColumnClassNames(style: StickyColumnStyle): StickyColumnClassNames {
  return {
    header: headerClassName(style),
    expandedHeader: expandedHeaderClassName(style),
    cell: cellClassName(style),
  };
}

export function createGeneratedItemStickyClassNames(
  resolvedColumns: ReadonlyArray<{ id: string; sticky: 'edge' | 'value' | null }>,
  config: StickyStyleConfig,
): GeneratedItemStickyClassNames {
  const byColumnId: Record<string, StickyColumnClassNames> = {};
  for (const column of resolvedColumns) {
    if (column.sticky === null) continue;
    const style = column.sticky === 'edge' ? config.edge[column.id] : config.value[column.id];
    if (!style) continue;
    byColumnId[column.id] = createStickyColumnClassNames(style);
  }
  return { byColumnId };
}

const sharedStickyColumns = {
  ffe: resolveGeneratedItemColumns(FFE_GENERATED_ITEM_TABLE_PRESET, [], {}),
  proposal: resolveGeneratedItemColumns(PROPOSAL_GENERATED_ITEM_TABLE_PRESET, [], {}),
};

export const ffeGeneratedItemStickyClassNames = createGeneratedItemStickyClassNames(
  sharedStickyColumns.ffe,
  {
    edge: {
      lineTotal: {
        rightClassName: 'right-10',
        widthClassName: 'w-[120px] min-w-[120px]',
        hoverClassName: 'group-hover:bg-neutral-50',
      },
      actions: {
        rightClassName: 'right-0',
        widthClassName: 'w-10 min-w-10',
        hoverClassName: 'group-hover:bg-neutral-50',
      },
    },
    value: {
      qty: {
        rightClassName: 'right-[256px]',
        widthClassName: 'w-20 min-w-[80px]',
        cellZClassName: 'z-10',
        hoverClassName: 'group-hover:bg-neutral-50',
        leadingEdge: true,
      },
      unitCostCents: {
        rightClassName: 'right-[160px]',
        widthClassName: 'w-24 min-w-[96px]',
        cellZClassName: 'z-10',
        hoverClassName: 'group-hover:bg-neutral-50',
      },
    },
  },
);

export const proposalGeneratedItemStickyClassNames = createGeneratedItemStickyClassNames(
  sharedStickyColumns.proposal,
  {
    edge: {
      total: {
        rightClassName: 'right-10',
        widthClassName: 'w-24 min-w-[96px]',
        cellZClassName: 'z-10',
        hoverClassName: 'group-hover:bg-neutral-50',
      },
      actions: {
        rightClassName: 'right-0',
        widthClassName: 'w-10 min-w-10',
        cellZClassName: 'z-20',
        hoverClassName: 'group-hover:bg-neutral-50',
      },
    },
    value: {
      quantity: {
        rightClassName: 'right-[232px]',
        widthClassName: 'w-20 min-w-[80px]',
        cellZClassName: 'z-10',
        hoverClassName: 'group-hover:bg-neutral-50',
        leadingEdge: true,
      },
      unitCost: {
        rightClassName: 'right-[136px]',
        widthClassName: 'w-24 min-w-[96px]',
        cellZClassName: 'z-10',
        hoverClassName: 'group-hover:bg-neutral-50',
      },
    },
  },
);
