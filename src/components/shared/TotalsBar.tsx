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
    <div className="flex h-10 shrink-0 items-center border-t border-neutral-200 bg-surface px-4">
      <span className="text-xs text-neutral-500">
        {itemCount} {itemCount === 1 ? 'item' : 'items'} in {groupCount}{' '}
        {groupCount === 1 ? groupLabel.replace(/s$/, '') : groupLabel}
      </span>
      <div className="ml-auto flex items-center gap-1.5">
        <span className="text-xs text-neutral-500">Grand total</span>
        <span className="text-sm font-medium tabular-nums text-neutral-900">{grandTotal}</span>
      </div>
    </div>
  );
}
