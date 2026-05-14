import { useEffect, useMemo, useRef, useState } from 'react';
import { cn, emptyToNull } from '../../../lib/utils';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { cents, formatMoney, type Item, type Project } from '../../../types';
import { exportCatalogPdf, exportCatalogItemPdf } from '../../../lib/export';
import { useDeleteImage, useImages, useUpdateItem, useUploadImage } from '../../../hooks';
import type { RoomWithItems } from '../../../types';
import { Button } from '../../primitives';
import { InlineTextEdit } from '../../primitives/InlineTextEdit';
import { ImageFrame } from '../../shared/image/ImageFrame';
import { ImageOptionsMenu } from '../../shared/image/ImageOptionsMenu';
import { MaterialSwatchImage } from '../../materials/MaterialLibraryModal';
import { api } from '../../../lib/api';
import type { ImageAsset } from '../../../types';

type CatalogEntry = {
  item: Item;
  room: RoomWithItems;
};

type EditableCatalogField =
  | 'itemName'
  | 'description'
  | 'category'
  | 'dimensions'
  | 'leadTime'
  | 'notes'
  | 'itemIdTag';

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
            onClick={() => runAction(() => void exportCatalogPdf(project, rooms))}
          >
            Export PDF
          </button>
          {currentItemId && (
            <button
              type="button"
              role="menuitem"
              className={catalogMenuItemClassName}
              onClick={() =>
                runAction(() => void exportCatalogItemPdf(project, rooms, currentItemId))
              }
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

  const optionImagesQuery = useImages('item_option', item.id);
  const optionImages = useMemo(
    () =>
      [...(optionImagesQuery.data ?? [])]
        .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary))
        .slice(0, 2),
    [optionImagesQuery.data],
  );
  const upload = useUploadImage('item_option', item.id);
  const deleteImage = useDeleteImage('item_option', item.id);
  const optionCount = optionImages.length;
  const isBusy = upload.isPending || deleteImage.isPending;

  const saveField = (field: EditableCatalogField, value: string, required = false) =>
    updateItem
      .mutateAsync({
        id: item.id,
        patch: {
          [field]: required ? value.trim() : emptyToNull(value),
          version: item.version,
        },
      })
      .then(() => undefined);

  // TODO: persist vendor + vendorUrl as Item columns in a follow-up iteration.
  // For now these are stored in localStorage keyed by item id so authors can preview the layout.
  const [vendor, setVendor] = useCatalogPlaceholder(`ffe-catalog-vendor:${item.id}`);
  const [vendorUrl, setVendorUrl] = useCatalogPlaceholder(`ffe-catalog-vendor-url:${item.id}`);
  const [approvalHidden, setApprovalHidden] = useCatalogPlaceholder(
    `ffe-catalog-approval-hidden:${item.id}`,
  );

  const lineTotalCents = item.unitCostCents * item.qty;

  return (
    <article
      className="catalog-page mx-auto bg-white text-gray-950 shadow-xl"
      aria-label={`${item.itemName} catalog page`}
    >
      <header className="catalog-header">
        <div className="catalog-header-left">
          <h1 className="catalog-header-title">
            {item.itemIdTag ? <span className="catalog-header-id">{item.itemIdTag}</span> : null}
            <InlineTextEdit
              value={item.itemName}
              aria-label={`Item name for ${item.itemName}`}
              className="min-w-0 inline-block"
              inputClassName="w-full text-[22px] font-bold uppercase tracking-wide text-brand-700"
              onSave={(value) => saveField('itemName', value, true)}
              renderDisplay={(value) => (
                <span className="catalog-header-name">{value.toUpperCase()}</span>
              )}
            />
          </h1>
        </div>
        <div className="catalog-header-right">
          <p className="catalog-header-project">{project.name.toUpperCase()}</p>
          <p
            className={cn(
              'catalog-header-subtitle',
              !project.projectLocation && 'catalog-header-subtitle-empty',
            )}
          >
            {project.projectLocation
              ? project.projectLocation.toUpperCase()
              : 'PROJECT DETAILS - OPTIONAL'}
          </p>
        </div>
      </header>

      <section className="catalog-main">
        <div className="catalog-main-left">
          <div className="catalog-image-block">
            <div className="catalog-rendering-square">
              <ImageFrame
                entityType="item"
                entityId={item.id}
                alt={item.itemName}
                fallbackUrl={null}
                className="border-0 shadow-none h-full w-full rounded-none"
                imageClassName="catalog-image"
                placeholderClassName="catalog-placeholder"
                placeholderContent={<span>{initials(item.itemName)}</span>}
              />
            </div>

            <div className="catalog-qty-band">
              <div className="catalog-qty-cell">
                <span className="catalog-qty-label">PRODUCT QTY</span>
                <span className="catalog-qty-rule" />
                <span className="catalog-qty-value">{item.qty}</span>
              </div>
              <div className="catalog-qty-cell">
                <span className="catalog-qty-label">PRICE PER ITEM</span>
                <span className="catalog-qty-rule" />
                <span className="catalog-qty-value">
                  {item.unitCostCents > 0 ? formatMoney(cents(item.unitCostCents)) : '—'}
                </span>
              </div>
              <div className="catalog-qty-cell">
                <span className="catalog-qty-label">TOTAL</span>
                <span className="catalog-qty-rule" />
                <span className="catalog-qty-value">
                  {lineTotalCents > 0 ? formatMoney(cents(lineTotalCents)) : '—'}
                </span>
              </div>
            </div>
          </div>

          <div className="catalog-option-row">
            <CatalogOptionRenderings
              optionImages={optionImages}
              itemName={item.itemName}
              isBusy={isBusy}
              onUpload={(file, index) =>
                upload.mutate({ file, altText: `${item.itemName} option ${index + 1}` })
              }
              onDelete={(imageId) => deleteImage.mutate(imageId)}
              onAdd={(file) =>
                upload.mutate({ file, altText: `${item.itemName} option ${optionCount + 1}` })
              }
            />
          </div>
        </div>

        <div className="catalog-main-right">
          <h2 className="catalog-spec-heading">PRODUCT SPECIFICATIONS</h2>

          <div className="catalog-spec-dim">
            <InlineTextEdit
              value={item.dimensions ?? ''}
              aria-label={`Dimensions for ${item.itemName}`}
              inputClassName="w-full text-sm text-gray-700"
              onSave={(value) => saveField('dimensions', value)}
              renderDisplay={(value) =>
                value.trim() ? (
                  <span className="catalog-spec-dim-text">{value}</span>
                ) : (
                  <span className="catalog-spec-dim-text catalog-placeholder-text">
                    W __&quot; x D __&quot; x H __&quot;
                  </span>
                )
              }
            />
          </div>

          <div className="catalog-spec-desc">
            <InlineTextEdit
              value={item.description ?? ''}
              aria-label={`Description for ${item.itemName}`}
              className="block"
              multiline
              rows={3}
              inputClassName="w-full text-sm text-gray-700 leading-snug resize-none"
              onSave={(value) => saveField('description', value)}
              renderDisplay={(value) =>
                value.trim() ? (
                  <p className="catalog-spec-desc-text">{value}</p>
                ) : (
                  <p className="catalog-spec-desc-text catalog-placeholder-text">
                    Click to add a description.
                  </p>
                )
              }
            />
          </div>

          <div className="catalog-vendor-block">
            <div className="catalog-vendor-line">
              <InlineTextEdit
                value={vendor}
                aria-label="Vendor"
                className="min-w-0 flex-1"
                inputClassName="w-full text-sm uppercase tracking-wide text-gray-500"
                onSave={(value) => setVendor(value.trim())}
                renderDisplay={(value) =>
                  value.trim() ? (
                    <span className="catalog-vendor-text">{value}</span>
                  ) : (
                    <span className="catalog-vendor-text catalog-placeholder-text">
                      VENDOR IF ANY
                    </span>
                  )
                }
              />
            </div>
            <div className="catalog-vendor-line">
              <InlineTextEdit
                value={vendorUrl}
                aria-label="Vendor link"
                className="min-w-0 flex-1"
                inputClassName="w-full text-sm uppercase tracking-wide text-gray-500"
                onSave={(value) => setVendorUrl(value.trim())}
                renderDisplay={(value) =>
                  value.trim() ? (
                    <span className="catalog-vendor-text">{value}</span>
                  ) : (
                    <span className="catalog-vendor-text catalog-placeholder-text">
                      LINK IF ANY
                    </span>
                  )
                }
              />
              {vendorUrl.trim() ? (
                <a
                  href={vendorUrl.trim()}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="catalog-vendor-link"
                  aria-label="Open vendor link"
                >
                  <LinkIcon />
                </a>
              ) : (
                <span className="catalog-vendor-link catalog-vendor-link-empty" aria-hidden="true">
                  <LinkIcon />
                </span>
              )}
            </div>
          </div>

          <p className="catalog-section-subhead">SPACE FOR ADDITIONAL NOTES OR FIELDS</p>
          <div className="catalog-notes-block">
            <InlineTextEdit
              value={item.notes ?? ''}
              aria-label={`Notes for ${item.itemName}`}
              className="block w-full"
              multiline
              rows={3}
              inputClassName="w-full min-h-16 resize-none text-sm leading-snug text-gray-700"
              onSave={(value) => saveField('notes', value)}
              renderDisplay={(value) =>
                value.trim() ? (
                  <p className="catalog-notes-text">{value}</p>
                ) : (
                  <p className="catalog-notes-text catalog-placeholder-text">NOTES</p>
                )
              }
            />
          </div>

          <h2 className="catalog-spec-heading catalog-finish-heading">FINISH SCHEDULE</h2>
          <div className="catalog-materials-row">
            {item.materials.length > 0
              ? item.materials.slice(0, 4).map((material) => (
                  <div key={material.id} className="catalog-material-cell">
                    <span className="catalog-material-id">{material.materialId || 'ID'}</span>
                    <div className="catalog-material-swatch">
                      <MaterialSwatchImage material={material} size="lg" />
                    </div>
                    <span className="catalog-material-name">{material.name || 'MATERIAL'}</span>
                  </div>
                ))
              : Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="catalog-material-cell catalog-material-cell-empty">
                    <span className="catalog-material-id">ID</span>
                    <div className="catalog-material-swatch catalog-material-swatch-placeholder" />
                    <span className="catalog-material-name">MATERIAL</span>
                    <span className="catalog-material-color">COLOR</span>
                  </div>
                ))}
          </div>

          <div className="catalog-location-block">
            <p className="catalog-location-label">
              <span className="catalog-location-key">LOCATION:</span>{' '}
              <span className="catalog-location-value">{room.name}</span>
            </p>
            <p className="catalog-location-sub">LOCATION AND SNIPPET ARE OPTIONAL</p>
            <div className="catalog-plan-frame">
              <ImageFrame
                entityType="item_plan"
                entityId={item.id}
                alt={`${item.itemName} plan`}
                fallbackUrl={null}
                className="border-0 shadow-none h-full w-full rounded-none"
                placeholderClassName="catalog-plan-placeholder"
                placeholderContent={
                  <span className="catalog-plan-placeholder-text">
                    LOCATION
                    <br />
                    SNIPPET
                  </span>
                }
                disabled
              />
            </div>
          </div>
        </div>
      </section>

      <CatalogApprovalSection
        shown={approvalHidden !== 'hidden'}
        onToggle={() => setApprovalHidden(approvalHidden === 'hidden' ? '' : 'hidden')}
      />

      <footer className="catalog-footer">
        <span />
        <span className="catalog-footer-center">contact email or company logo - optional</span>
        <span className="catalog-footer-page">
          PAGE {pageNumber} of {pageCount}
        </span>
      </footer>
    </article>
  );
}

function LinkIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
      <path
        d="M11.5 8.5l-3 3M8.5 6l1.4-1.4a3 3 0 014.24 4.24L12.74 10.3M11.5 14l-1.4 1.4a3 3 0 01-4.24-4.24L7.26 9.7"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Persistent localStorage-backed placeholder for the vendor / vendor link fields.
// TODO: Replace with a real Item column (and migration) in a follow-up iteration.
function useCatalogPlaceholder(key: string): [string, (value: string) => void] {
  const [value, setValue] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    try {
      return window.localStorage.getItem(key) ?? '';
    } catch {
      return '';
    }
  });
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (value) window.localStorage.setItem(key, value);
      else window.localStorage.removeItem(key);
    } catch {
      /* storage unavailable — silently ignore */
    }
  }, [key, value]);
  return [value, setValue];
}

function CatalogOptionRenderings({
  optionImages,
  itemName,
  isBusy,
  onUpload,
  onDelete,
  onAdd,
}: {
  optionImages: ImageAsset[];
  itemName: string;
  isBusy: boolean;
  onUpload: (file: File, index: number) => void;
  onDelete: (imageId: string) => void;
  onAdd: (file: File) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const slot0 = optionImages[0] ?? null;
  const slot1 = optionImages[1] ?? null;
  const canAddMore = optionImages.length < 2;

  return (
    <div className="catalog-options-strip">
      <div className="catalog-option-grid">
        {/* Slot 0: image card, or big upload area when no options yet (spans both cols via :only-child CSS) */}
        <div className="catalog-option-slot">
          {slot0 ? (
            <>
              <CatalogOptionCard
                image={slot0}
                itemName={itemName}
                index={0}
                disabled={isBusy}
                checked={selectedId === slot0.id}
                onSelect={(id) => setSelectedId(id)}
                onUpload={(file) => onUpload(file, 0)}
                onDelete={onDelete}
              />
              <p className="catalog-option-label">Option 1</p>
            </>
          ) : (
            <CatalogUploadSlot label="Add option" disabled={isBusy} onFile={onAdd} />
          )}
        </div>

        {/* Slot 1: only added to the grid when it actually has an image.
            When absent, slot 0 is :only-child and expands to fill both columns. */}
        {slot1 && (
          <div className="catalog-option-slot">
            <CatalogOptionCard
              image={slot1}
              itemName={itemName}
              index={1}
              disabled={isBusy}
              checked={selectedId === slot1.id}
              onSelect={(id) => setSelectedId(id)}
              onUpload={(file) => onUpload(file, 1)}
              onDelete={onDelete}
            />
            <p className="catalog-option-label">Option 2</p>
          </div>
        )}
      </div>

      {/* Compact "Add option 2" button shown below the full-width option 1 image */}
      {slot0 && canAddMore && (
        <CatalogUploadSlot label="Add option 2" compact disabled={isBusy} onFile={onAdd} />
      )}
    </div>
  );
}

function CatalogUploadSlot({
  label,
  disabled,
  onFile,
  compact = false,
}: {
  label: string;
  disabled?: boolean;
  onFile: (file: File) => void;
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const pasteHandlerRef = useRef<((event: ClipboardEvent) => void) | null>(null);

  useEffect(
    () => () => {
      const handler = pasteHandlerRef.current;
      if (handler) document.removeEventListener('paste', handler);
    },
    [],
  );

  const enablePaste = () => {
    if (disabled || pasteHandlerRef.current) return;
    const handler = (event: ClipboardEvent) => {
      const file = Array.from(event.clipboardData?.items ?? [])
        .find((item) => item.kind === 'file' && item.type.startsWith('image/'))
        ?.getAsFile();
      if (!file) return;
      event.preventDefault();
      onFile(file);
    };
    pasteHandlerRef.current = handler;
    document.addEventListener('paste', handler);
  };

  const disablePaste = () => {
    const handler = pasteHandlerRef.current;
    if (!handler) return;
    document.removeEventListener('paste', handler);
    pasteHandlerRef.current = null;
  };

  return (
    <>
      <button
        type="button"
        className={compact ? 'no-print catalog-add-option-btn' : 'no-print catalog-upload-slot'}
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        onMouseEnter={enablePaste}
        onMouseLeave={disablePaste}
        aria-label={label}
      >
        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="h-4 w-4">
          <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        <span>{label}</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file && !disabled) onFile(file);
          event.currentTarget.value = '';
        }}
      />
    </>
  );
}

function CatalogOptionCard({
  image,
  itemName,
  index,
  disabled,
  checked,
  onSelect,
  onUpload,
  onDelete,
}: {
  image: ImageAsset;
  itemName: string;
  index: number;
  disabled?: boolean;
  checked: boolean;
  onSelect: (imageId: string) => void;
  onUpload: (file: File) => void;
  onDelete: (imageId: string) => void;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuAnchorRef = useRef<HTMLButtonElement | null>(null);
  const documentPasteHandlerRef = useRef<((event: ClipboardEvent) => void) | null>(null);

  useEffect(() => {
    let ignore = false;
    let nextUrl: string | null = null;

    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });

    void api.images
      .getContentBlob(image.id)
      .then((blob) => {
        if (ignore) return;
        nextUrl = URL.createObjectURL(blob);
        setPreviewUrl(nextUrl);
      })
      .catch(() => {
        if (!ignore) setPreviewUrl(null);
      });

    return () => {
      ignore = true;
      if (nextUrl) URL.revokeObjectURL(nextUrl);
    };
  }, [image.id]);

  useEffect(
    () => () => {
      const handler = documentPasteHandlerRef.current;
      if (handler) document.removeEventListener('paste', handler);
    },
    [],
  );

  const handleFile = (file: File | null | undefined) => {
    if (!file || disabled) return;
    onUpload(file);
  };

  const enablePaste = () => {
    if (disabled || documentPasteHandlerRef.current) return;
    const handler = (event: ClipboardEvent) => {
      const file = Array.from(event.clipboardData?.items ?? [])
        .find((item) => item.kind === 'file' && item.type.startsWith('image/'))
        ?.getAsFile();
      if (!file) return;
      event.preventDefault();
      handleFile(file);
    };
    documentPasteHandlerRef.current = handler;
    document.addEventListener('paste', handler);
  };

  const disablePaste = () => {
    const handler = documentPasteHandlerRef.current;
    if (!handler) return;
    document.removeEventListener('paste', handler);
    documentPasteHandlerRef.current = null;
  };

  return (
    <div className="catalog-option-card" onMouseEnter={enablePaste} onMouseLeave={disablePaste}>
      <label className="catalog-option-check">
        <input
          type="checkbox"
          checked={checked}
          onChange={() => {
            if (!checked) onSelect(image.id);
          }}
        />
      </label>
      {previewUrl ? (
        <button
          ref={menuAnchorRef}
          type="button"
          disabled={disabled}
          aria-label={`Image options for ${itemName} option ${index + 1}`}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((o) => !o)}
          className="block h-full w-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
        >
          <img
            src={previewUrl}
            alt={`${itemName} option ${index + 1}`}
            className="h-full w-full object-contain object-center"
          />
        </button>
      ) : (
        <div className="catalog-option-empty">
          <span className="text-xs text-gray-300">Loading…</span>
        </div>
      )}

      <ImageOptionsMenu
        anchorRef={menuAnchorRef}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        canUpdate={!disabled}
        canDelete={!disabled}
        onUpdate={() => {
          setMenuOpen(false);
          inputRef.current?.click();
        }}
        onDelete={() => {
          setMenuOpen(false);
          onDelete(image.id);
        }}
      />

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="sr-only"
        onChange={(event) => {
          handleFile(event.target.files?.[0]);
          event.currentTarget.value = '';
        }}
      />
    </div>
  );
}

function CatalogApprovalSection({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  if (!shown) {
    return (
      <div className="no-print flex">
        <button type="button" className="catalog-add-approval-btn" onClick={onToggle}>
          <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="h-4 w-4">
            <path
              d="M8 3v10M3 8h10"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
          <span>Add client approval</span>
        </button>
      </div>
    );
  }

  return (
    <section className="catalog-approval-band">
      <button
        type="button"
        className="no-print catalog-approval-remove"
        aria-label="Remove client approval section"
        onClick={onToggle}
      >
        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="h-3.5 w-3.5">
          <path
            d="M3 3l10 10M13 3L3 13"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </button>
      <div className="catalog-section-label catalog-approval-label">Client Approval</div>
      <div className="catalog-approval-row">
        <div className="catalog-approval-field">
          <div className="catalog-approval-line" />
          <span>Authorized Signature</span>
        </div>
        <div className="catalog-approval-field catalog-approval-date">
          <div className="catalog-approval-line" />
          <span>Date</span>
        </div>
        <div className="catalog-approval-checks">
          <label>
            <input type="checkbox" className="catalog-approval-check-input" />
            Approved with revisions
          </label>
          <label>
            <input type="checkbox" className="catalog-approval-check-input" />
            Approved as presented
          </label>
        </div>
      </div>
    </section>
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
