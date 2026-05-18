type StickyColumnStyle = {
  rightClassName: string;
  widthClassName: string;
  cellZClassName?: string | undefined;
  hoverClassName?: string | undefined;
};

type StickyEdgeColumnStyles = {
  total: StickyColumnStyle;
  actions: StickyColumnStyle;
};

function headerClassName(style: StickyColumnStyle) {
  return `sticky ${style.rightClassName} z-40 bg-surface ${style.widthClassName}`;
}

function expandedHeaderClassName(style: StickyColumnStyle) {
  return `sticky top-0 ${style.rightClassName} z-50 bg-surface ${style.widthClassName}`;
}

function actionsExpandedHeaderClassName(style: StickyColumnStyle) {
  return `sticky top-0 ${style.rightClassName} z-[60] bg-surface ${style.widthClassName}`;
}

function cellClassName(style: StickyColumnStyle) {
  const zClassName = style.cellZClassName ?? 'z-20';
  return `sticky ${style.rightClassName} ${zClassName} bg-surface ${style.widthClassName}${
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
    hoverClassName: 'group-hover:bg-neutral-50/60',
  },
  actions: {
    rightClassName: 'right-0',
    widthClassName: 'w-10 min-w-10',
    hoverClassName: 'group-hover:bg-neutral-50/60',
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
  }),
  unitCost: createStickyColumnClassNames({
    rightClassName: 'right-[136px]',
    widthClassName: 'w-24 min-w-[96px]',
    cellZClassName: 'z-10',
    hoverClassName: 'group-hover:bg-neutral-50',
  }),
};
