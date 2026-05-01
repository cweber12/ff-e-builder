import { useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { sellPriceCents } from '../lib/calc';
import { cents, formatMoney, type Item, type Project } from '../types';
import type { RoomWithItems } from './ItemsTable';
import { Button } from './primitives';

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

  const setPage = (nextIndex: number) => {
    const nextPage = clampPageIndex(nextIndex, entries.length) + 1;
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
    <div className="min-h-screen bg-surface-muted py-8">
      <CatalogNav
        project={project}
        rooms={rooms}
        currentIndex={pageIndex}
        total={entries.length}
        onPageChange={setPage}
      />

      <div className="screen-only">
        <CatalogPage
          project={project}
          entry={entry}
          pageNumber={pageIndex + 1}
          pageCount={entries.length}
        />
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
  onPageChange,
}: {
  project: Project;
  rooms: RoomWithItems[];
  currentIndex: number;
  total: number;
  onPageChange: (index: number) => void;
}) {
  let itemIndex = 0;

  return (
    <nav className="no-print sticky top-0 z-20 mx-auto mb-6 flex max-w-5xl items-center justify-between gap-3 border-b border-gray-200 bg-surface-muted/95 px-4 py-3 backdrop-blur">
      <Link to="/" className="text-sm font-medium text-brand-600 hover:text-brand-700">
        FF&amp;E Builder
      </Link>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          disabled={currentIndex === 0}
          aria-label="Previous catalog item"
          onClick={() => onPageChange(currentIndex - 1)}
        >
          Previous
        </Button>
        <label className="sr-only" htmlFor="catalog-jump">
          Jump to catalog item
        </label>
        <select
          id="catalog-jump"
          value={currentIndex}
          onChange={(event) => onPageChange(Number(event.target.value))}
          className="min-w-56 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
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
          Next
        </Button>
        <Button type="button" onClick={() => window.print()}>
          Print / Save as PDF
        </Button>
      </div>
      <span className="text-sm text-gray-700">
        {currentIndex + 1} of {total}
      </span>
      <span className="sr-only">{project.name}</span>
    </nav>
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
          {item.imageUrl ? (
            <img src={item.imageUrl} alt={item.itemName} className="catalog-image" />
          ) : (
            <div className="catalog-placeholder" aria-label="No item image">
              <span>{initials(item.itemName)}</span>
            </div>
          )}
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
