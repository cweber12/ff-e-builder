type StickyColumnStyle = {
  rightClassName: string;
  widthClassName: string;
  cellZClassName?: string | undefined;
  hoverClassName?: string | undefined;
  /**
   * When true, the column is the left-most pinned column and gets a hairline
   * left border + soft shadow so the sticky cluster reads as floating above
   * the horizontally-scrolled body data.
   */
  leadingEdge?: boolean | undefined;
};

type StickyEdgeColumnStyles = {
  total: StickyColumnStyle;
  actions: StickyColumnStyle;
};

/** Header cells carry the tinted band; body cells stay on the white surface. */
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

function actionsExpandedHeaderClassName(style: StickyColumnStyle) {
  return `sticky top-0 ${style.rightClassName} z-[60] ${HEADER_BG} ${style.widthClassName}${edgeClassName(style)}`;
}

function cellClassName(style: StickyColumnStyle) {
  const zClassName = style.cellZClassName ?? 'z-20';
  return `sticky ${style.rightClassName} ${zClassName} ${CELL_BG} ${style.widthClassName}${edgeClassName(style)}${
    style.hoverClassName ? ` ${style.hoverClassName}` : ''
  }`;
}

export function createStickyColumnClassNames(style: StickyColumnStyle) {
  return {
    header: headerClassName(style),
    expandedHeader: expandedHeaderClassName(style),
    cell: cellClassName(style),
  };
}

export function createStickyEdgeColumnClassNames(styles: StickyEdgeColumnStyles) {
  return {
    totalHeader: headerClassName(styles.total),
    actionsHeader: headerClassName(styles.actions),
    totalExpandedHeader: expandedHeaderClassName(styles.total),
    actionsExpandedHeader: actionsExpandedHeaderClassName(styles.actions),
    totalCell: cellClassName(styles.total),
    actionsCell: cellClassName(styles.actions),
  };
}

export const ffeStickyEdgeColumnClassNames = createStickyEdgeColumnClassNames({
  total: {
    rightClassName: 'right-10',
    widthClassName: 'w-[120px] min-w-[120px]',
    hoverClassName: 'group-hover:bg-neutral-50',
    leadingEdge: true,
  },
  actions: {
    rightClassName: 'right-0',
    widthClassName: 'w-10 min-w-10',
    hoverClassName: 'group-hover:bg-neutral-50',
  },
});

export const proposalStickyEdgeColumnClassNames = createStickyEdgeColumnClassNames({
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
});

export const proposalStickyValueColumnClassNames = {
  quantity: createStickyColumnClassNames({
    rightClassName: 'right-[232px]',
    widthClassName: 'w-20 min-w-[80px]',
    cellZClassName: 'z-10',
    hoverClassName: 'group-hover:bg-neutral-50',
    leadingEdge: true,
  }),
  unitCost: createStickyColumnClassNames({
    rightClassName: 'right-[136px]',
    widthClassName: 'w-24 min-w-[96px]',
    cellZClassName: 'z-10',
    hoverClassName: 'group-hover:bg-neutral-50',
  }),
};
