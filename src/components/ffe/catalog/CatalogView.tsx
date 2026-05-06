import { useEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from 'react';
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
  const projectSlug = slugify(project.name);
  const catalogBodyRef = useRef<HTMLElement>(null);
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

  return (
    <article
      className="catalog-page mx-auto grid bg-white text-gray-950 shadow-xl"
      aria-label={`${item.itemName} catalog page`}
    >
      <header className="catalog-header">
        <span>{project.name}</span>
        <span>{project.clientName}</span>
      </header>

      <section ref={catalogBodyRef} className="catalog-body">
        <CatalogLeftColumn
          item={item}
          bodyRef={catalogBodyRef}
          updateItem={updateItem.mutateAsync}
        />

        <div className="catalog-details">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600">
              {room.name}
            </p>
            <div className="mt-3 flex items-baseline gap-2">
              {item.itemIdTag ? (
                <span className="shrink-0 font-mono text-xl font-bold tracking-wide text-gray-900">
                  {item.itemIdTag}
                </span>
              ) : (
                <span className="shrink-0 font-mono text-sm font-semibold tracking-wide text-gray-400">
                  No ID
                </span>
              )}
              <InlineTextEdit
                value={item.itemName}
                aria-label={`Item name for ${item.itemName}`}
                className="min-w-0 flex-1"
                inputClassName="w-full text-xl font-medium leading-tight text-gray-700"
                onSave={(value) => saveField('itemName', value, true)}
                renderDisplay={(value) => (
                  <h1 className="text-xl font-medium leading-tight text-gray-700">{value}</h1>
                )}
              />
            </div>
            <div className="mt-2">
              <InlineTextEdit
                value={item.dimensions ?? ''}
                aria-label={`Dimensions for ${item.itemName}`}
                inputClassName="text-sm text-gray-600"
                onSave={(value) => saveField('dimensions', value)}
                renderDisplay={(value) =>
                  value.trim() ? (
                    <span className="text-sm text-gray-600">{value}</span>
                  ) : (
                    <span className="text-sm italic text-gray-400">Click to add dimensions</span>
                  )
                }
              />
            </div>
            <div className="mt-4">
              <InlineTextEdit
                value={item.description ?? ''}
                aria-label={`Description for ${item.itemName}`}
                className="block"
                inputClassName="w-full text-sm text-gray-600"
                onSave={(value) => saveField('description', value)}
                renderDisplay={(value) =>
                  value.trim() ? (
                    <p className="text-sm leading-6 text-gray-600">{value}</p>
                  ) : (
                    <p className="text-sm italic text-gray-400">Click to add a description</p>
                  )
                }
              />
            </div>
          </div>

          <div className="h-px bg-brand-500/40" />

          {item.unitCostCents > 0 && (
            <div className="catalog-price-block">
              <div>
                <span>Unit cost</span>
                <strong>{formatMoney(cents(item.unitCostCents))}</strong>
              </div>
            </div>
          )}

          <div className="flex-1 min-h-0">
            <InlineTextEdit
              value={item.notes ?? ''}
              aria-label={`Notes for ${item.itemName}`}
              className="block h-full w-full"
              multiline
              rows={5}
              inputClassName="h-full min-h-24 w-full resize-none overflow-y-auto text-sm leading-6 text-gray-600"
              onSave={(value) => saveField('notes', value)}
              renderDisplay={(value) =>
                value.trim() ? (
                  <p className="catalog-notes h-full overflow-y-auto whitespace-pre-wrap">
                    {value}
                  </p>
                ) : (
                  <p className="catalog-notes italic text-gray-400">Click to add notes</p>
                )
              }
            />
          </div>

          <CatalogApprovalSection />
        </div>
      </section>

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

type CatalogOptionLayout = 'stacked' | 'row';

const CATALOG_LEFT_COLUMN_GAP_PX = 16;
const CATALOG_OPTION_CARD_GAP_PX = 12;
const CATALOG_OPTION_ROW_MIN_HEIGHT_PX = 118;
const CATALOG_OPTION_STACKED_MIN_HEIGHT_PX = 248;
const CATALOG_MATERIAL_SECTION_MIN_HEIGHT_PX = 72;
const CATALOG_MATERIAL_SECTION_PREFERRED_HEIGHT_PX = 112;

type CatalogLeftLayoutState = {
  optionLayout: CatalogOptionLayout;
  optionHeight: number | null;
  materialHeight: number | null;
  materialSwatchSize: number | null;
  compactMaterials: boolean;
};

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function containedImageArea(
  wrapperWidth: number,
  wrapperHeight: number,
  aspectRatio: number | null | undefined,
) {
  if (!aspectRatio || wrapperWidth <= 0 || wrapperHeight <= 0) return 0;
  const imageWidthFromHeight = wrapperHeight * aspectRatio;
  if (imageWidthFromHeight <= wrapperWidth) {
    return imageWidthFromHeight * wrapperHeight;
  }
  const imageHeightFromWidth = wrapperWidth / aspectRatio;
  return wrapperWidth * imageHeightFromWidth;
}

function optionAreaScore(
  layout: CatalogOptionLayout,
  optionHeight: number,
  optionCount: number,
  optionAspectRatios: Array<number | null>,
) {
  if (optionCount <= 0 || optionHeight <= 0) return 0;

  if (layout === 'stacked') {
    const cardHeight = Math.max(0, (optionHeight - CATALOG_OPTION_CARD_GAP_PX) / 2);
    let total = 0;
    for (const ratio of optionAspectRatios.slice(0, optionCount)) {
      total += containedImageArea(1, cardHeight / CATALOG_OPTION_STACKED_MIN_HEIGHT_PX, ratio);
    }
    return total;
  }

  const cardWidth = (1 - 0.12) / 2;
  let total = 0;
  for (const ratio of optionAspectRatios.slice(0, optionCount)) {
    total += containedImageArea(cardWidth, optionHeight / CATALOG_OPTION_ROW_MIN_HEIGHT_PX, ratio);
  }
  return total;
}

function computeCatalogLeftLayout(
  supportHeight: number,
  optionCount: number,
  materialCount: number,
  optionAspectRatios: Array<number | null>,
): CatalogLeftLayoutState {
  if (supportHeight <= 0) {
    return {
      optionLayout: 'stacked',
      optionHeight: null,
      materialHeight: null,
      materialSwatchSize: null,
      compactMaterials: false,
    };
  }

  const hasOptions = optionCount > 0;
  const hasMaterials = materialCount > 0;
  const materialsGap = hasOptions && hasMaterials ? CATALOG_LEFT_COLUMN_GAP_PX : 0;
  const minMaterialsHeight = hasMaterials ? CATALOG_MATERIAL_SECTION_MIN_HEIGHT_PX : 0;
  const preferredMaterialsHeight = hasMaterials ? CATALOG_MATERIAL_SECTION_PREFERRED_HEIGHT_PX : 0;
  const evaluateLayout = (layout: CatalogOptionLayout) => {
    let materialHeight = hasMaterials
      ? clampNumber(
          Math.round(supportHeight * (layout === 'stacked' ? 0.34 : 0.42)),
          minMaterialsHeight,
          preferredMaterialsHeight,
        )
      : 0;
    let optionHeight = hasOptions ? supportHeight - materialHeight - materialsGap : 0;
    const optionMinHeight =
      layout === 'stacked'
        ? CATALOG_OPTION_STACKED_MIN_HEIGHT_PX
        : CATALOG_OPTION_ROW_MIN_HEIGHT_PX;

    if (hasOptions && optionHeight < optionMinHeight) {
      optionHeight = optionMinHeight;
      materialHeight = hasMaterials ? Math.max(0, supportHeight - optionHeight - materialsGap) : 0;
    }

    return {
      layout,
      optionHeight: hasOptions ? Math.max(0, optionHeight) : 0,
      materialHeight: hasMaterials ? Math.max(0, materialHeight) : 0,
    };
  };

  const stacked = evaluateLayout('stacked');
  const row = evaluateLayout('row');
  const stackedFitsMaterials = !hasMaterials || stacked.materialHeight >= minMaterialsHeight;
  const rowFitsMaterials = !hasMaterials || row.materialHeight >= minMaterialsHeight;
  const stackedScore = optionAreaScore(
    'stacked',
    stacked.optionHeight,
    optionCount,
    optionAspectRatios,
  );
  const rowScore = optionAreaScore('row', row.optionHeight, optionCount, optionAspectRatios);
  const shouldPreferRow =
    optionCount > 1 &&
    rowFitsMaterials &&
    (!stackedFitsMaterials || rowScore > stackedScore * 1.08);
  const chosen = shouldPreferRow ? row : stackedFitsMaterials ? stacked : row;

  let materialHeight = chosen.materialHeight;
  let optionHeight = chosen.optionHeight;
  const optionLayout = chosen.layout;

  if (!hasMaterials) {
    materialHeight = 0;
  }

  if (!hasOptions) {
    materialHeight = supportHeight;
  }

  const materialRows = Math.max(1, Math.ceil(materialCount / 4));
  const materialInnerHeight = Math.max(0, materialHeight - 34 - (materialRows - 1) * 10);
  const materialSwatchSize = hasMaterials
    ? clampNumber(Math.floor(materialInnerHeight / materialRows) - 22, 28, 72)
    : null;

  return {
    optionLayout,
    optionHeight: hasOptions ? Math.max(0, optionHeight) : null,
    materialHeight: hasMaterials ? Math.max(0, materialHeight) : null,
    materialSwatchSize,
    compactMaterials:
      hasMaterials &&
      (materialHeight < preferredMaterialsHeight ||
        (materialSwatchSize !== null && materialSwatchSize < 64)),
  };
}

function CatalogLeftColumn({
  item,
  bodyRef,
  updateItem,
}: {
  item: Item;
  bodyRef: RefObject<HTMLElement>;
  updateItem: ReturnType<typeof useUpdateItem>['mutateAsync'];
}) {
  const leftColumnRef = useRef<HTMLDivElement>(null);
  const imageWrapRef = useRef<HTMLDivElement>(null);
  const supportRef = useRef<HTMLDivElement>(null);
  const optionImagesQuery = useImages('item_option', item.id);
  const optionImages = useMemo(
    () =>
      [...(optionImagesQuery.data ?? [])]
        .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary))
        .slice(0, 2),
    [optionImagesQuery.data],
  );
  const [layoutState, setLayoutState] = useState<CatalogLeftLayoutState>({
    optionLayout: 'stacked',
    optionHeight: null,
    materialHeight: null,
    materialSwatchSize: null,
    compactMaterials: false,
  });
  const [optionAspectRatios, setOptionAspectRatios] = useState<Array<number | null>>([null, null]);

  useEffect(() => {
    const updateLayout = () => {
      const leftColumn = leftColumnRef.current;
      const imageWrap = imageWrapRef.current;
      const body = bodyRef.current;
      const support = supportRef.current;

      if (!leftColumn || !imageWrap || !body || !support) return;
      if (body.clientHeight === 0 || imageWrap.offsetHeight === 0 || support.clientHeight === 0) {
        setLayoutState((current) => ({ ...current, optionLayout: 'stacked' }));
        return;
      }

      const optionCount = optionImages.length;
      const nextState = computeCatalogLeftLayout(
        support.clientHeight,
        optionCount,
        item.materials.length,
        optionAspectRatios,
      );
      setLayoutState(nextState);
    };

    updateLayout();

    if (typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(() => updateLayout());
    if (leftColumnRef.current) observer.observe(leftColumnRef.current);
    if (bodyRef.current) observer.observe(bodyRef.current);
    if (imageWrapRef.current) observer.observe(imageWrapRef.current);
    if (supportRef.current) observer.observe(supportRef.current);

    return () => observer.disconnect();
  }, [bodyRef, item.materials.length, optionAspectRatios, optionImages.length]);

  return (
    <div ref={leftColumnRef} className="catalog-left-column">
      <div ref={imageWrapRef} className="catalog-image-wrap">
        <ImageFrame
          entityType="item"
          entityId={item.id}
          alt={item.itemName}
          fallbackUrl={item.imageUrl}
          onFallbackDelete={async () => {
            await updateItem({
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

      <div ref={supportRef} className="catalog-left-support">
        <CatalogOptionRenderings
          itemId={item.id}
          itemName={item.itemName}
          layout={layoutState.optionLayout}
          sectionHeight={layoutState.optionHeight}
          optionImages={optionImages}
          onAspectRatioChange={(index, ratio) =>
            setOptionAspectRatios((current) => {
              if (current[index] === ratio) return current;
              const next = [...current];
              next[index] = ratio;
              return next;
            })
          }
        />

        {item.materials.length > 0 && (
          <div
            className={`catalog-materials-block ${layoutState.compactMaterials ? 'catalog-materials-block-compact' : ''}`}
            style={
              {
                height:
                  layoutState.materialHeight !== null
                    ? `${layoutState.materialHeight}px`
                    : undefined,
                '--catalog-material-swatch-size':
                  layoutState.materialSwatchSize !== null
                    ? `${layoutState.materialSwatchSize}px`
                    : undefined,
              } as CSSProperties
            }
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-gray-500">
              Materials
            </p>
            <div className="catalog-materials-grid">
              {item.materials.map((material) => (
                <div key={material.id} className="catalog-material-card">
                  <MaterialSwatchImage material={material} size="lg" />
                  <span className="max-w-[80px] text-center text-[10px] font-medium leading-tight text-gray-600">
                    {material.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CatalogOptionRenderings({
  itemId,
  itemName,
  layout,
  sectionHeight,
  optionImages,
  onAspectRatioChange,
}: {
  itemId: string;
  itemName: string;
  layout: CatalogOptionLayout;
  sectionHeight: number | null;
  optionImages: ImageAsset[];
  onAspectRatioChange: (index: number, ratio: number | null) => void;
}) {
  const setPrimary = useSetPrimaryImage('item_option', itemId);
  const upload = useUploadImage('item_option', itemId);
  const deleteImage = useDeleteImage('item_option', itemId);
  const slots = Array.from({ length: 2 }, (_, index) => optionImages[index] ?? null);
  const isBusy = upload.isPending || deleteImage.isPending;

  return (
    <div
      className="catalog-option-section"
      style={{ height: sectionHeight !== null ? `${sectionHeight}px` : undefined }}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-gray-500">Options</p>
      <div
        className={`catalog-option-grid ${
          layout === 'stacked' ? 'catalog-option-grid-stacked' : 'catalog-option-grid-row'
        }`}
      >
        {slots.map((image, index) => (
          <CatalogOptionCard
            key={image?.id ?? `catalog-option-${index}`}
            image={image}
            itemName={itemName}
            index={index}
            disabled={isBusy}
            onSelect={(imageId) => setPrimary.mutate(imageId)}
            onUpload={(file) => upload.mutate({ file, altText: `${itemName} option ${index + 1}` })}
            onDelete={(imageId) => deleteImage.mutate(imageId)}
            onAspectRatioChange={onAspectRatioChange}
          />
        ))}
      </div>
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
  onAspectRatioChange,
}: {
  image: ImageAsset | null;
  itemName: string;
  index: number;
  disabled?: boolean;
  onSelect: (imageId: string) => void;
  onUpload: (file: File) => void;
  onDelete: (imageId: string) => void;
  onAspectRatioChange: (index: number, ratio: number | null) => void;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuAnchorRef = useRef<HTMLButtonElement | null>(null);
  const documentPasteHandlerRef = useRef<((event: ClipboardEvent) => void) | null>(null);

  useEffect(() => {
    if (!image) {
      onAspectRatioChange(index, null);
    }
  }, [image, index, onAspectRatioChange]);

  useEffect(() => {
    let ignore = false;
    let nextUrl: string | null = null;

    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });

    if (!image) return undefined;

    void api.images
      .getContentBlob(image.id)
      .then((blob) => {
        if (ignore) return;
        nextUrl = URL.createObjectURL(blob);
        const previewImage = new Image();
        previewImage.onload = () => {
          if (ignore) return;
          const width = previewImage.naturalWidth || previewImage.width || 1;
          const height = previewImage.naturalHeight || previewImage.height || 1;
          onAspectRatioChange(index, height > 0 ? width / height : null);
          setPreviewUrl(nextUrl);
        };
        previewImage.onerror = () => {
          if (ignore) return;
          onAspectRatioChange(index, null);
          setPreviewUrl(nextUrl);
        };
        previewImage.src = nextUrl;
      })
      .catch(() => {
        if (!ignore) {
          onAspectRatioChange(index, null);
          setPreviewUrl(null);
        }
      });

    return () => {
      ignore = true;
      if (nextUrl) URL.revokeObjectURL(nextUrl);
    };
  }, [image, index, onAspectRatioChange]);

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
      {image && (
        <label className="catalog-option-check">
          <input
            type="checkbox"
            checked={Boolean(image.isPrimary)}
            onChange={() => {
              if (!image.isPrimary) onSelect(image.id);
            }}
          />
        </label>
      )}
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
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className="catalog-option-empty w-full cursor-pointer hover:bg-brand-100 disabled:cursor-wait"
        >
          Option {index + 1}
        </button>
      )}

      {image && (
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
      )}

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
    <section className="catalog-approval">
      <p className="catalog-approval-title">Customer approval</p>
      <div className="catalog-approval-grid">
        <div>
          <span>Signature</span>
          <div className="catalog-approval-line" />
        </div>
        <div>
          <span>Date</span>
          <div className="catalog-approval-line" />
        </div>
      </div>
      <div className="catalog-approval-checks">
        <label>
          <input type="checkbox" />
          Approved w/ changes
        </label>
        <label>
          <input type="checkbox" />
          Approved w/o changes
        </label>
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
