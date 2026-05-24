import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { cn } from '../../../lib/utils';
import { api } from '../../../lib/api';
import { useImages, useProposalWithItems, useUpdateProposalItem } from '../../../hooks';
import { ImageFrame } from '../../shared/image/ImageFrame';
import { PanZoomFrame } from '../../shared/image/PanZoomFrame';
import { cents, formatMoney } from '../../../types';
import { proposalLineTotalCents } from '../../../lib/money';
import type { ImageAsset } from '../../../types';
import { GeneratedItemEditableTextControl } from '../../shared/table/GeneratedItemEditableTextCell';
import {
  GeneratedItemEditableMoneyControl,
  GeneratedItemEditableQuantityControl,
} from '../../shared/table/GeneratedItemEditableNumberCell';
import { GeneratedItemSizeControl } from '../../shared/table/GeneratedItemSizeModal';
import type { UpdateProposalItemInput } from '../../../lib/api';

const PROPOSAL_QUANTITY_UNITS = ['unit', 'sq ft', 'ln ft', 'sq yd', 'cu yd', 'each'] as const;

type Props = {
  itemId: string;
  categoryId: string;
  projectId: string;
  onClose: () => void;
  onSelectItemId: (itemId: string) => void;
};

export function ProposalItemDetailPanel({
  itemId,
  categoryId,
  projectId,
  onClose,
  onSelectItemId,
}: Props) {
  const { categoriesWithItems } = useProposalWithItems(projectId);
  const updateItem = useUpdateProposalItem();

  const category = useMemo(
    () => categoriesWithItems.find((c) => c.id === categoryId),
    [categoriesWithItems, categoryId],
  );
  const sortedItems = useMemo(
    () => (category ? [...category.items].sort((a, b) => a.sortOrder - b.sortOrder) : []),
    [category],
  );
  const currentIndex = sortedItems.findIndex((i) => i.id === itemId);
  const item = currentIndex >= 0 ? sortedItems[currentIndex] : undefined;

  // Close if the item disappears (deleted, moved out of category, etc.).
  useEffect(() => {
    if (category && currentIndex < 0) onClose();
  }, [category, currentIndex, onClose]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  if (!item || !category) return null;

  const lineTotal = proposalLineTotalCents(item);

  const save = (patch: Omit<UpdateProposalItemInput, 'version'>) => {
    updateItem.mutate({
      id: item.id,
      patch: { ...patch, version: item.version },
      projectId,
    });
  };

  const goPrev = () => {
    if (sortedItems.length < 2) return;
    const prevIndex = (currentIndex - 1 + sortedItems.length) % sortedItems.length;
    const next = sortedItems[prevIndex];
    if (next) onSelectItemId(next.id);
  };
  const goNext = () => {
    if (sortedItems.length < 2) return;
    const nextIndex = (currentIndex + 1) % sortedItems.length;
    const next = sortedItems[nextIndex];
    if (next) onSelectItemId(next.id);
  };

  return (
    <aside
      role="dialog"
      aria-label={`Item details for ${item.productTag || 'item'}`}
      className="fixed inset-y-0 right-0 z-50 flex w-[clamp(420px,45vw,720px)] flex-col overflow-hidden border-l border-black/10 bg-canvas-chrome shadow-2xl"
    >
      <header className="flex flex-shrink-0 items-center gap-2 border-b border-black/10 px-5 py-3.5">
        <div className="min-w-0 flex-1">
          <p className="eyebrow">{category.name}</p>
          <h2 className="mt-0.5 truncate font-display text-base font-semibold text-neutral-950">
            {item.productTag || 'Unnamed item'}
          </h2>
        </div>
        <PrevNextButtons
          disabled={sortedItems.length < 2}
          position={`${currentIndex + 1} of ${sortedItems.length}`}
          onPrev={goPrev}
          onNext={goNext}
        />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close detail panel"
          className="icon-btn"
        >
          <CloseIcon />
        </button>
      </header>

      <div className="flex flex-1 flex-col min-h-0 overflow-y-auto">
        <div className="flex w-full gap-5 justify-center border-b border-black/10 bg-canvas-shell p-5">
          <ImageSection label="Rendering" className="flex-1 min-w-0">
            <ImageFrame
              entityType="proposal_item"
              entityId={item.id}
              alt={`${item.productTag || 'Proposal'} rendering`}
              className="w-full aspect-[117/75] flex-shrink-0"
              disabled
            />
          </ImageSection>

          <ImageSection label="Plan" className="flex-1 min-w-0">
            <PanZoomFrame
              entityType="proposal_plan"
              entityId={item.id}
              alt={`${item.productTag || 'Proposal'} plan`}
            />
          </ImageSection>

          <SwatchGallery itemId={item.id} />
        </div>

        <div className="flex-1 p-6">
          <div className="grid grid-cols-2 gap-x-5 gap-y-5">
            <FormField label="Product tag">
              <GeneratedItemEditableTextControl
                value={item.productTag}
                onSave={(productTag) => save({ productTag })}
                ariaLabel="Product tag"
              />
            </FormField>
            <FormField label="Item name">
              <GeneratedItemEditableTextControl
                value={item.itemName}
                onSave={(itemName) => save({ itemName })}
                ariaLabel="Item name"
              />
            </FormField>
            <FormField label="Location">
              <GeneratedItemEditableTextControl
                value={item.location}
                onSave={(location) => save({ location })}
                ariaLabel="Location"
              />
            </FormField>
            <FormField label="Drawings">
              <GeneratedItemEditableTextControl
                value={item.drawings}
                onSave={(drawings) => save({ drawings })}
                ariaLabel="Drawings"
              />
            </FormField>
            <FormField label="Plan reference">
              <GeneratedItemEditableTextControl
                value={item.plan}
                onSave={(plan) => save({ plan })}
                ariaLabel="Plan reference"
              />
            </FormField>
            <FormField label="Size">
              <GeneratedItemSizeControl
                value={item.sizeLabel}
                triggerVariant="inline"
                initial={{
                  mode: item.sizeMode,
                  unit: item.sizeUnit,
                  w: item.sizeW,
                  d: item.sizeD,
                  h: item.sizeH,
                }}
                onSave={({ label, mode, unit, w, d, h }) =>
                  save({
                    sizeMode: mode,
                    sizeUnit: unit,
                    sizeW: w,
                    sizeD: d,
                    sizeH: h,
                    sizeLabel: label,
                  })
                }
              />
            </FormField>
            <FormField label="Description" wide>
              <GeneratedItemEditableTextControl
                value={item.description}
                onSave={(description) => save({ description })}
                ariaLabel="Description"
              />
            </FormField>
            <FormField label="Notes" wide>
              <GeneratedItemEditableTextControl
                value={item.notes}
                onSave={(notes) => save({ notes })}
                ariaLabel="Notes"
              />
            </FormField>
          </div>

          {item.materials.length > 0 && (
            <div className="mt-6">
              <p className="eyebrow mb-2">Materials</p>
              <div className="flex flex-wrap gap-1.5">
                {item.materials.map((m) => (
                  <span
                    key={m.id}
                    className="inline-flex items-center gap-2 border border-black/10 bg-canvas-shell px-2.5 py-1 text-sm text-neutral-800"
                  >
                    {m.swatchHex && (
                      <span
                        className="h-3 w-3 flex-shrink-0 rounded-full border border-black/20"
                        style={{ background: m.swatchHex }}
                      />
                    )}
                    {m.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="mt-7 border-t border-black/10 pt-5">
            <dl className="grid grid-cols-3 gap-6">
              <div className="border-l border-black/10 pl-3">
                <dt className="eyebrow">Quantity</dt>
                <dd className="mt-1">
                  <GeneratedItemEditableQuantityControl
                    quantity={item.quantity}
                    quantityUnit={item.quantityUnit}
                    quantityUnits={PROPOSAL_QUANTITY_UNITS}
                    onSaveQuantity={(quantity) => save({ quantity })}
                    onSaveUnit={(quantityUnit) => save({ quantityUnit })}
                  />
                </dd>
              </div>
              <div className="border-l border-black/10 pl-3">
                <dt className="eyebrow">Unit cost</dt>
                <dd className="mt-1">
                  <GeneratedItemEditableMoneyControl
                    valueCents={item.unitCostCents}
                    onSave={(unitCostCents) => save({ unitCostCents })}
                    ariaLabel="Unit cost"
                  />
                </dd>
              </div>
              <div className="border-l border-brand-600/40 pl-3">
                <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-700">
                  Total
                </dt>
                <dd className="num mt-1 text-base font-semibold tracking-tight text-brand-700">
                  {formatMoney(cents(lineTotal))}
                </dd>
              </div>
            </dl>
            {item.cbm > 0 && (
              <p className="num mt-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
                CBM <span className="text-neutral-950">{item.cbm}</span>
              </p>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}

function PrevNextButtons({
  disabled,
  position,
  onPrev,
  onNext,
}: {
  disabled: boolean;
  position: string;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex items-center gap-1 mr-1 text-neutral-500">
      <button
        type="button"
        onClick={onPrev}
        disabled={disabled}
        aria-label="Previous item"
        className="icon-btn disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <ChevronIcon direction="left" />
      </button>
      <span className="text-[11px] font-medium uppercase tracking-[0.12em] tabular-nums">
        {position}
      </span>
      <button
        type="button"
        onClick={onNext}
        disabled={disabled}
        aria-label="Next item"
        className="icon-btn disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <ChevronIcon direction="right" />
      </button>
    </div>
  );
}

function FormField({
  label,
  wide,
  children,
}: {
  label: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', wide && 'col-span-2')}>
      <p className="eyebrow">{label}</p>
      {children}
    </div>
  );
}

function ImageSection({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="eyebrow mb-2">{label}</p>
      {children}
    </div>
  );
}

function SwatchGallery({ itemId }: { itemId: string }) {
  const { data: swatches } = useImages('proposal_swatch', itemId);
  if (!swatches?.length) return null;

  return (
    <ImageSection label="Swatches">
      <div className="grid grid-cols-2 gap-2">
        {swatches.map((swatch) => (
          <BlobImage key={swatch.id} image={swatch} className="h-24 w-full object-cover" />
        ))}
      </div>
    </ImageSection>
  );
}

function BlobImage({ image, className }: { image: ImageAsset; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    let objectUrl: string | null = null;

    void api.images
      .getContentBlob(image.id)
      .then((blob) => {
        if (ignore) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => {});

    return () => {
      ignore = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [image.id]);

  if (!url) {
    return <div className={cn('animate-pulse bg-canvas-shell', className)} />;
  }
  return <img src={url} alt={image.altText} className={className} />;
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
      <path
        d="M5 5l10 10M15 5L5 15"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ChevronIcon({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      className={cn('h-4 w-4', direction === 'right' && 'rotate-180')}
    >
      <path
        d="M12 5l-5 5 5 5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
