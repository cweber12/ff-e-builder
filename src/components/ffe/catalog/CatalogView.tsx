import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '../../../lib/cn';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { cents, formatMoney, type Item, type Project } from '../../../types';
import { exportCatalogPdf, exportCatalogItemPdf } from '../../../lib/export';
import {
  useDeleteImage,
  useImages,
  useSetPrimaryImage,
  useUpdateItem,
  useUploadImage,
} from '../../../hooks';
import type { RoomWithItems } from '../../../types';
import { Button } from '../../primitives';
import { InlineTextEdit } from '../../primitives/InlineTextEdit';
import { ImageFrame } from '../../shared/ImageFrame';
import { ImageOptionsMenu } from '../../shared/ImageOptionsMenu';
import { MaterialSwatchImage } from '../../materials/MaterialLibraryModal';
import { api } from '../../../lib/api';
import { emptyToNull } from '../../../lib/textUtils';
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
  const setPrimary = useSetPrimaryImage('item_option', item.id);
  const upload = useUploadImage('item_option', item.id);
  const deleteImage = useDeleteImage('item_option', item.id);
  const optionCount = optionImages.length;
  const isBusy = upload.isPending || deleteImage.isPending;

  const projectSlug = slugify(project.name);
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

  const hasMaterials = item.materials.length > 0;
  const hasThirdSection = optionCount > 0 || hasMaterials;

  return (
    <article
      className={cn(
        'catalog-page mx-auto grid bg-white text-gray-950 shadow-xl',
        optionCount === 2 && 'catalog-page--two-options',
      )}
      aria-label={`${item.itemName} catalog page`}
    >
      <header className="catalog-header">
        <div className="min-w-0">
          <p>{project.name}</p>
          {project.clientName ? <p className="catalog-client-line">{project.clientName}</p> : null}
        </div>
        <span>{room.name}</span>
      </header>

      <section className="catalog-top-section">
        <div className="catalog-title-row">
          {item.itemIdTag ? (
            <span className="catalog-item-id">{item.itemIdTag}</span>
          ) : (
            <span className="catalog-item-id catalog-item-id-empty">No ID</span>
          )}
          <InlineTextEdit
            value={item.itemName}
            aria-label={`Item name for ${item.itemName}`}
            className="min-w-0 flex-1"
            inputClassName="w-full text-[30px] font-semibold leading-tight text-gray-900"
            onSave={(value) => saveField('itemName', value, true)}
            renderDisplay={(value) => <h1 className="catalog-item-name">{value}</h1>}
          />
        </div>

        <div className="catalog-dimensions-row">
          <InlineTextEdit
            value={item.dimensions ?? ''}
            aria-label={`Dimensions for ${item.itemName}`}
            inputClassName="text-sm text-gray-600"
            onSave={(value) => saveField('dimensions', value)}
            renderDisplay={(value) =>
              value.trim() ? (
                <span className="catalog-dimensions-text">{value}</span>
              ) : (
                <span className="catalog-dimensions-text text-gray-400 italic">
                  Click to add dimensions
                </span>
              )
            }
          />
        </div>
      </section>

      <section className="catalog-second-section">
        <div className="catalog-rendering-panel">
          <div className="catalog-rendering-frame">
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
              className="border-0 shadow-none"
              imageClassName="catalog-image"
              placeholderClassName="catalog-placeholder"
              placeholderContent={<span>{initials(item.itemName)}</span>}
            />
          </div>
        </div>

        <div className="catalog-notes-panel">
          <div className="catalog-description-row">
            <InlineTextEdit
              value={item.description ?? ''}
              aria-label={`Description for ${item.itemName}`}
              className="block"
              inputClassName="w-full text-sm text-gray-600"
              onSave={(value) => saveField('description', value)}
              renderDisplay={(value) =>
                value.trim() ? (
                  <p className="catalog-description-summary">{value}</p>
                ) : (
                  <p className="catalog-description-summary text-gray-400 italic">
                    Click to add a description
                  </p>
                )
              }
            />
          </div>
          <div className="catalog-section-label">Notes</div>
          <div className="catalog-notes-content">
            <InlineTextEdit
              value={item.notes ?? ''}
              aria-label={`Notes for ${item.itemName}`}
              className="block h-full w-full"
              multiline
              rows={7}
              inputClassName="h-full min-h-24 w-full resize-none overflow-y-auto text-sm leading-6 text-gray-600"
              onSave={(value) => saveField('notes', value)}
              renderDisplay={(value) =>
                value.trim() ? (
                  <p className="catalog-notes h-full overflow-y-auto whitespace-pre-wrap">
                    {value}
                  </p>
                ) : (
                  <span className="no-print catalog-add-notes-btn">
                    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="h-3.5 w-3.5">
                      <path
                        d="M8 3v10M3 8h10"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                    </svg>
                    Add notes
                  </span>
                )
              }
            />
          </div>
          {item.unitCostCents > 0 ? (
            <div className="catalog-cost-row">
              <span>Unit cost</span>
              <strong>{formatMoney(cents(item.unitCostCents))}</strong>
            </div>
          ) : null}
        </div>
      </section>

      <section className={cn('catalog-third-section', !hasThirdSection && 'no-print')}>
        <CatalogOptionRenderings
          optionImages={optionImages}
          itemName={item.itemName}
          isBusy={isBusy}
          onSelect={(imageId) => setPrimary.mutate(imageId)}
          onUpload={(file, index) =>
            upload.mutate({ file, altText: `${item.itemName} option ${index + 1}` })
          }
          onDelete={(imageId) => deleteImage.mutate(imageId)}
          onAdd={(file) =>
            upload.mutate({ file, altText: `${item.itemName} option ${optionCount + 1}` })
          }
        />
        {hasMaterials && (
          <div className="catalog-materials-strip">
            <div className="catalog-section-label">Materials</div>
            <div className="catalog-materials-grid">
              {item.materials.map((material) => (
                <div key={material.id} className="catalog-material-card">
                  <MaterialSwatchImage material={material} size="lg" />
                  <span className="catalog-material-label">{material.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <CatalogApprovalSection />

      <footer className="catalog-footer">
        <span>
          {pageNumber} of {pageCount}
        </span>
        <span>{projectSlug}</span>
        <InlineTextEdit
          value={item.itemIdTag ?? ''}
          aria-label={`Item ID for ${item.itemName}`}
          className="justify-self-end"
          inputClassName="w-28 text-right font-mono text-xs text-gray-500"
          onSave={(value) => saveField('itemIdTag', value)}
          renderDisplay={(value) => (
            <span className="font-mono text-xs text-gray-500">{value.trim() || '-'}</span>
          )}
        />
      </footer>
    </article>
  );
}

function CatalogOptionRenderings({
  optionImages,
  itemName,
  isBusy,
  onSelect,
  onUpload,
  onDelete,
  onAdd,
}: {
  optionImages: ImageAsset[];
  itemName: string;
  isBusy: boolean;
  onSelect: (imageId: string) => void;
  onUpload: (file: File, index: number) => void;
  onDelete: (imageId: string) => void;
  onAdd: (file: File) => void;
}) {
  const addInputRef = useRef<HTMLInputElement>(null);
  const addPasteHandlerRef = useRef<((event: ClipboardEvent) => void) | null>(null);
  const canAddMore = optionImages.length < 2;

  useEffect(
    () => () => {
      const handler = addPasteHandlerRef.current;
      if (handler) document.removeEventListener('paste', handler);
    },
    [],
  );

  const enableAddPaste = () => {
    if (!canAddMore || isBusy || addPasteHandlerRef.current) return;
    const handler = (event: ClipboardEvent) => {
      const file = Array.from(event.clipboardData?.items ?? [])
        .find((item) => item.kind === 'file' && item.type.startsWith('image/'))
        ?.getAsFile();
      if (!file) return;
      event.preventDefault();
      onAdd(file);
    };
    addPasteHandlerRef.current = handler;
    document.addEventListener('paste', handler);
  };

  const disableAddPaste = () => {
    const handler = addPasteHandlerRef.current;
    if (!handler) return;
    document.removeEventListener('paste', handler);
    addPasteHandlerRef.current = null;
  };

  return (
    <div className="catalog-options-strip">
      {optionImages.length > 0 && (
        <div className="catalog-option-grid">
          {optionImages.map((image, index) => (
            <div key={image.id} className="catalog-option-slot">
              <CatalogOptionCard
                image={image}
                itemName={itemName}
                index={index}
                disabled={isBusy}
                onSelect={onSelect}
                onUpload={(file) => onUpload(file, index)}
                onDelete={onDelete}
              />
              <p className="catalog-option-label">Option {index + 1}</p>
            </div>
          ))}
        </div>
      )}
      {canAddMore && (
        <>
          <button
            type="button"
            className="no-print catalog-add-option-btn"
            disabled={isBusy}
            onClick={() => addInputRef.current?.click()}
            onMouseEnter={enableAddPaste}
            onMouseLeave={disableAddPaste}
          >
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="h-3.5 w-3.5">
              <path
                d="M8 3v10M3 8h10"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
            Add option
          </button>
          <input
            ref={addInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file && !isBusy) onAdd(file);
              event.currentTarget.value = '';
            }}
          />
        </>
      )}
    </div>
  );
}

function CatalogOptionCard({
  image,
  itemName,
  index,
  disabled,
  onSelect,
  onUpload,
  onDelete,
}: {
  image: ImageAsset;
  itemName: string;
  index: number;
  disabled?: boolean;
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
          checked={Boolean(image.isPrimary)}
          onChange={() => {
            if (!image.isPrimary) onSelect(image.id);
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

function CatalogApprovalSection() {
  return (
    <section className="catalog-approval-band">
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

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
