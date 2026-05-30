import { useMemo, useState } from 'react';
import type { MeasurementItemRef } from './types';

type MeasurementTargetPickerProps = {
  items: MeasurementItemRef[];
  value: string;
  onChange: (key: string) => void;
  /** targetItemIds that already have a saved measurement on this plan. */
  measuredTargetItemIds: Set<string>;
};

/**
 * Searchable, container-grouped picker for choosing the item a measurement
 * attaches to. Shows item ID + name and flags items that already carry a
 * measurement (re-measuring replaces the existing one).
 */
export function MeasurementTargetPicker({
  items,
  value,
  onChange,
  measuredTargetItemIds,
}: MeasurementTargetPickerProps) {
  const [query, setQuery] = useState('');

  const groups = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    const filtered = normalized
      ? items.filter(
          (item) =>
            item.primaryLabel.toLocaleLowerCase().includes(normalized) ||
            item.secondaryLabel.toLocaleLowerCase().includes(normalized) ||
            item.containerLabel.toLocaleLowerCase().includes(normalized),
        )
      : items;

    const byContainer = new Map<string, MeasurementItemRef[]>();
    for (const item of filtered) {
      const list = byContainer.get(item.containerLabel) ?? [];
      list.push(item);
      byContainer.set(item.containerLabel, list);
    }
    return Array.from(byContainer.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [items, query]);

  const selected = items.find((item) => item.key === value) ?? null;

  return (
    <div>
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">
        Associate with item
      </span>

      {items.length === 0 ? (
        <p className="rounded-lg border border-neutral-200 bg-white/80 px-3 py-2 text-xs text-neutral-500">
          No items yet. Create one from this measured area below.
        </p>
      ) : (
        <>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search items…"
            className="mb-2 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-brand-400"
          />

          <div className="max-h-56 overflow-y-auto rounded-lg border border-neutral-200 bg-white">
            {groups.length === 0 ? (
              <p className="px-3 py-3 text-xs text-neutral-500">No items match “{query}”.</p>
            ) : (
              groups.map(([containerLabel, groupItems]) => (
                <div key={containerLabel}>
                  <p className="sticky top-0 bg-neutral-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400">
                    {containerLabel}
                  </p>
                  {groupItems.map((item) => {
                    const active = item.key === value;
                    const hasMeasurement = measuredTargetItemIds.has(item.targetItemId);
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => onChange(item.key)}
                        className={[
                          'flex w-full items-center gap-2 px-3 py-2 text-left transition',
                          active
                            ? 'bg-brand-50 ring-1 ring-inset ring-brand-300'
                            : 'hover:bg-neutral-50',
                        ].join(' ')}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-neutral-900">
                            {item.primaryLabel}
                          </span>
                          {item.secondaryLabel && item.secondaryLabel !== item.primaryLabel ? (
                            <span className="block truncate text-xs text-neutral-500">
                              {item.secondaryLabel}
                            </span>
                          ) : null}
                        </span>
                        {hasMeasurement ? (
                          <span className="shrink-0 rounded-pill bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                            Measured
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          {selected ? (
            <p className="mt-1.5 text-xs text-neutral-500">
              Selected:{' '}
              <span className="font-medium text-neutral-700">{selected.primaryLabel}</span>
            </p>
          ) : (
            <p className="mt-1.5 text-xs text-neutral-400">
              Choose an item to attach this measurement.
            </p>
          )}
        </>
      )}
    </div>
  );
}
