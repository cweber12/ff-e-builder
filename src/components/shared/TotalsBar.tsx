interface TotalsBarProps {
  itemCount: number;
  groupCount: number;
  groupLabel?: string;
  grandTotal: string;
}

export function TotalsBar({
  itemCount,
  groupCount,
  groupLabel = 'rooms',
  grandTotal,
}: TotalsBarProps) {
  return (
    <div className="sticky bottom-0 z-30 flex h-11 shrink-0 items-center border-t border-neutral-200 bg-surface/95 px-5 backdrop-blur">
      <span className="text-xs font-medium text-neutral-500">
        {itemCount} {itemCount === 1 ? 'item' : 'items'} in {groupCount}{' '}
        {groupCount === 1 ? groupLabel.replace(/s$/, '') : groupLabel}
      </span>
      <div className="ml-auto flex items-baseline gap-2.5">
        <span className="eyebrow">Grand total</span>
        <span className="font-mono text-base font-semibold tabular-nums text-neutral-950">
          {grandTotal}
        </span>
      </div>
    </div>
  );
}
