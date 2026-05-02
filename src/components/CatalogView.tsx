import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { sellPriceCents } from '../lib/calc';
import { cents, formatMoney, type Item, type Project } from '../types';
import { exportCatalogPdf, exportCatalogItemPdf } from '../lib/exportUtils';
import { useUpdateItem } from '../hooks/useItems';
import type { RoomWithItems } from '../types';
import { Button } from './primitives';
import { ImageFrame } from './ImageFrame';

type CatalogEntry = {
  item: Item & { color?: string | null; designer?: string | null };
  room: RoomWithItems;
};

type CatalogViewProps = {
  project: Project;
  rooms: RoomWithItems[];
};

export function CatalogView({ project, rooms }: CatalogViewProps) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const entries = useMemo(() => flattenCatalogEntries(rooms), [rooms]);
  const requestedPage = Number(searchParams.get('page') ?? '1');
  const pageIndex = clampPageIndex(requestedPage - 1, entries.length);
  const entry = entries[pageIndex];
  const [slideDirection, setSlideDirection] = useState<'next' | 'previous'>('next');

  const setPage = (nextIndex: number) => {
    const clampedIndex = clampPageIndex(nextIndex, entries.length);
    setSlideDirection(clampedIndex >= pageIndex ? 'next' : 'previous');
    const nextPage = clampedIndex + 1;
    navigate({ search: `?page=${nextPage}` });
  };

  if (!entry) {
    return (
      <div className="min-h-screen bg-surface-muted px-6 py-12">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 rounded-lg border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
          <h1 className="text-2xl font-semibold text-gray-950">No catalog items yet</h1>
          <p className="text-sm text-gray-600">
            Add FF&amp;E items to rooms before creating a printable catalog.
          </p>
          <Button type="button" variant="secondary" onClick={() => navigate(-1)}>
            Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-muted">
      <CatalogNav
        project={project}
        rooms={rooms}
        currentIndex={pageIndex}
        total={entries.length}
        currentEntry={entry}
        currentItemId={entry?.item.id}
        onPageChange={setPage}
      />

      <div className="screen-only catalog-stage">
        <div
          key={entry.item.id}
          className={slideDirection === 'next' ? 'catalog-page-next' : 'catalog-page-previous'}
        >
          <CatalogPage
            project={project}
            entry={entry}
            pageNumber={pageIndex + 1}
            pageCount={entries.length}
          />
        </div>
      </div>

      <div className="print-only">
        {entries.map((catalogEntry, index) => (
          <CatalogPage
            key={catalogEntry.item.id}
            project={project}
            entry={catalogEntry}
            pageNumber={index + 1}
            pageCount={entries.length}
          />
        ))}
      </div>
    </div>
  );
}

function CatalogNav({
  project,
  rooms,
  currentIndex,
  total,
  currentEntry,
  currentItemId,
  onPageChange,
}: {
  project: Project;
  rooms: RoomWithItems[];
  currentIndex: number;
  total: number;
  currentEntry: CatalogEntry | undefined;
  currentItemId: string | undefined;
  onPageChange: (index: number) => void;
}) {
  let itemIndex = 0;

  return (
    <nav className="no-print sticky top-0 z-20 mx-auto mb-6 max-w-5xl border-b border-gray-200 bg-surface-muted/95 px-4 py-3 backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <Link
            to="/"
            className="text-xs font-semibold uppercase tracking-wide text-brand-600 hover:text-brand-700"
          >
            FF&amp;E Builder
          </Link>
          <p className="mt-1 truncate text-sm font-semibold text-gray-950">
            {currentEntry?.item.itemName ?? 'Catalog'}
          </p>
          <p className="text-xs text-gray-500">{currentEntry?.room.name}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={currentIndex === 0}
            aria-label="Previous catalog item"
            onClick={() => onPageChange(currentIndex - 1)}
          >
            <span aria-hidden="true">&lt;</span>
            <span className="sr-only">Previous</span>
          </Button>
          <label className="sr-only" htmlFor="catalog-jump">
            Jump to catalog item
          </label>
          <select
            id="catalog-jump"
            value={currentIndex}
            onChange={(event) => onPageChange(Number(event.target.value))}
            className="min-w-56 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none"
          >
            {rooms.map((room) => (
              <optgroup key={room.id} label={room.name}>
                {room.items.map((item) => {
                  const optionIndex = itemIndex;
                  itemIndex += 1;
                  return (
                    <option key={item.id} value={optionIndex}>
                      {item.itemName}
                    </option>
                  );
                })}
              </optgroup>
            ))}
          </select>
          <Button
            type="button"
            variant="secondary"
            disabled={currentIndex === total - 1}
            aria-label="Next catalog item"
            onClick={() => onPageChange(currentIndex + 1)}
          >
            <span aria-hidden="true">&gt;</span>
            <span className="sr-only">Next</span>
          </Button>
          <CatalogActionsMenu project={project} rooms={rooms} currentItemId={currentItemId} />
        </div>
        <div className="flex min-w-24 flex-col items-end gap-1">
          <span className="text-sm font-semibold tabular-nums text-gray-700">
            {currentIndex + 1} / {total}
          </span>
          <div className="h-1.5 w-24 overflow-hidden rounded-pill bg-gray-200">
            <div
              className="h-full rounded-pill bg-brand-500 transition-all"
              style={{ width: `${total > 0 ? ((currentIndex + 1) / total) * 100 : 0}%` }}
            />
          </div>
        </div>
      </div>
      <span className="sr-only">{project.name}</span>
    </nav>
  );
}

function CatalogActionsMenu({
  project,
  rooms,
  currentItemId,
}: {
  project: Project;
  rooms: RoomWithItems[];
  currentItemId: string | undefined;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const runAction = (action: () => void) => {
    setOpen(false);
    action();
  };

  return (
    <div ref={ref} className="relative inline-flex">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Open catalog options"
        onClick={() => setOpen((current) => !current)}
        className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-600 shadow-sm hover:border-brand-500 hover:text-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
      >
        <MoreIcon />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-1 min-w-48 rounded-md border border-gray-200 bg-white p-1 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            className={catalogMenuItemClassName}
            onClick={() => runAction(() => window.print())}
          >
            Print
          </button>
          <button
            type="button"
            role="menuitem"
            className={catalogMenuItemClassName}
            onClick={() => runAction(() => exportCatalogPdf(project, rooms))}
          >
            Export PDF
          </button>
          {currentItemId && (
            <button
              type="button"
              role="menuitem"
              className={catalogMenuItemClassName}
              onClick={() => runAction(() => exportCatalogItemPdf(project, rooms, currentItemId))}
            >
              Export this item
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const catalogMenuItemClassName =
  'flex w-full items-center rounded px-3 py-2 text-left text-sm text-gray-700 hover:bg-brand-50 hover:text-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500';

function MoreIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="h-4 w-4">
      <circle cx="5" cy="10" r="1.5" />
      <circle cx="10" cy="10" r="1.5" />
      <circle cx="15" cy="10" r="1.5" />
    </svg>
  );
}

export function CatalogPage({
  project,
  entry,
  pageNumber,
  pageCount,
}: {
  project: Project;
  entry: CatalogEntry;
  pageNumber: number;
  pageCount: number;
}) {
  const { item, room } = entry;
  const updateItem = useUpdateItem(item.roomId);
  const sellPrice = sellPriceCents(item.unitCostCents, item.markupPct);
  const projectSlug = slugify(project.name);

  return (
    <article
      className="catalog-page mx-auto grid bg-white text-gray-950 shadow-xl"
      aria-label={`${item.itemName} catalog page`}
    >
      <header className="catalog-header">
        <span>{project.name}</span>
        <span>{project.clientName}</span>
      </header>

      <section className="catalog-body">
        <div className="catalog-image-wrap">
          <ImageFrame
            entityType="item"
            entityId={item.id}
            alt={item.itemName}
            fallbackUrl={item.imageUrl}
            onFallbackDelete={async () => {
              await updateItem.mutateAsync({
                id: item.id,
                patch: { imageUrl: null, version: item.version },
              });
            }}
            className="h-full w-full border-0 shadow-none"
            imageClassName="catalog-image"
            placeholderClassName="catalog-placeholder"
            placeholderContent={<span>{initials(item.itemName)}</span>}
          />
        </div>

        <div className="catalog-details">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600">
              {room.name}
            </p>
            <h1 className="mt-3 text-[28px] font-semibold leading-tight text-gray-950">
              {item.itemName}
            </h1>
            <span className="mt-4 inline-flex rounded-pill bg-brand-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-700">
              {item.category ?? 'Uncategorized'}
            </span>
          </div>

          <div className="h-px bg-brand-500/40" />

          <dl className="catalog-data-grid">
            <DataPoint label="Vendor" value={item.vendor} />
            <DataPoint label="Dimensions" value={item.dimensions} />
            <DataPoint label="Materials" value={item.finishes} />
            <DataPoint label="Color" value={item.color ?? null} />
            <DataPoint label="Designer" value={item.designer ?? null} />
          </dl>

          <div className="catalog-price-block">
            <div>
              <span>Unit cost</span>
              <strong>{formatMoney(cents(item.unitCostCents))}</strong>
            </div>
            <div>
              <span>Markup</span>
              <strong>{formatPercent(item.markupPct)}</strong>
            </div>
            <div className="sell-price">
              <span>Sell price</span>
              <strong>{formatMoney(cents(sellPrice))}</strong>
            </div>
          </div>

          {item.notes && <p className="catalog-notes">{item.notes}</p>}
        </div>
      </section>

      <footer className="catalog-footer">
        <span>
          {pageNumber} of {pageCount}
        </span>
        <span>{projectSlug}</span>
        <span className="font-mono text-xs text-gray-500">{item.itemIdTag}</span>
      </footer>
    </article>
  );
}

function DataPoint({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value?.trim() || '-'}</dd>
    </div>
  );
}

function flattenCatalogEntries(rooms: RoomWithItems[]): CatalogEntry[] {
  return [...rooms]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
    .flatMap((room) =>
      [...room.items]
        .sort((a, b) => a.sortOrder - b.sortOrder || a.itemName.localeCompare(b.itemName))
        .map((item) => ({ item, room })),
    );
}

function clampPageIndex(index: number, total: number) {
  if (total <= 0) return 0;
  if (!Number.isFinite(index)) return 0;
  return Math.min(Math.max(index, 0), total - 1);
}

function initials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function formatPercent(value: number) {
  return `${new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
  }).format(value)}%`;
}
