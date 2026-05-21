import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { cn } from '../../../lib/utils';
import { api } from '../../../lib/api';
import { useImages } from '../../../hooks';
import { ImageFrame } from '../../shared/image/ImageFrame';
import { PanZoomFrame } from '../../shared/image/PanZoomFrame';
import { cents, formatMoney } from '../../../types';
import { proposalLineTotalCents } from '../../../lib/money';
import type { ImageAsset, ProposalItem } from '../../../types';

type Props = {
  item: ProposalItem;
  categoryName?: string | undefined;
  onClose: () => void;
};

export function ProposalItemDetailPanel({ item, categoryName, onClose }: Props) {
  const lineTotal = proposalLineTotalCents(item);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-neutral-950/45 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="mx-auto flex h-full max-w-4xl flex-col overflow-hidden rounded-sm border border-black/10 bg-canvas-chrome shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative z-10 flex flex-shrink-0 items-center gap-3 border-b border-black/10 px-5 py-3.5">
          <div className="min-w-0 flex-1">
            {categoryName && <p className="eyebrow">{categoryName}</p>}
            <h2 className="mt-0.5 truncate font-display text-base font-semibold text-neutral-950">
              {item.productTag || 'Unnamed item'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close detail panel"
            className="icon-btn"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="flex flex-col min-h-0 flex-1 overflow-hidden">
          <div className="flex w-full gap-5 justify-center overflow-y-auto border-b border-black/10 bg-canvas-shell p-5">
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

          <div className="flex-1 overflow-y-auto p-6">
            <div className="space-y-5">
              <MetaField label="Product Description" value={item.description} />
              <MetaField label="Location" value={item.location} />
              <MetaField label="Drawings" value={item.drawings} />
              <MetaField label="Plan" value={item.plan} />
              <MetaField label="Size" value={item.sizeLabel} numeric />

              {item.materials.length > 0 && (
                <div>
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

              <div className="border-t border-black/10 pt-5">
                <dl className="grid grid-cols-3 gap-6">
                  <div className="border-l border-black/10 pl-3">
                    <dt className="eyebrow">Quantity</dt>
                    <dd className="num mt-1 text-sm font-medium text-neutral-950">
                      {item.quantity} <span className="text-neutral-500">{item.quantityUnit}</span>
                    </dd>
                  </div>
                  <div className="border-l border-black/10 pl-3">
                    <dt className="eyebrow">Unit Cost</dt>
                    <dd className="num mt-1 text-sm font-medium text-neutral-950">
                      {formatMoney(cents(item.unitCostCents))}
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
        </div>
      </div>
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

function MetaField({
  label,
  value,
  numeric = false,
}: {
  label: string;
  value: string;
  numeric?: boolean;
}) {
  if (!value) return null;
  return (
    <div>
      <p className="eyebrow">{label}</p>
      <p className={['mt-1 text-sm text-neutral-950', numeric ? 'num' : ''].join(' ')}>{value}</p>
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
