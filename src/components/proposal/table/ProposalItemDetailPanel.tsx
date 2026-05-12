import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { cn } from '../../../lib/utils';
import { api } from '../../../lib/api';
import { useImages } from '../../../hooks';
import { ImageFrame } from '../../shared/ImageFrame';
import { PanZoomFrame } from '../../shared/PanZoomFrame';
import { cents, formatMoney } from '../../../types';
import { proposalLineTotalCents } from '../../../lib/budgetCalc';
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
    <div className="fixed inset-0 z-50 bg-gray-950/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="mx-auto flex h-full max-w-4xl flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative z-10 flex flex-shrink-0 items-center gap-3 border-b border-gray-100 bg-surface px-5 py-3">
          <div className="min-w-0 flex-1">
            {categoryName && (
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                {categoryName}
              </p>
            )}
            <h2 className="truncate text-base font-semibold text-gray-900">
              {item.productTag || 'Unnamed item'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close detail panel"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="flex flex-col min-h-0 flex-1 overflow-hidden">
          <div className="flex w-full gap-5 justify-center overflow-y-auto border-b border-gray-100 p-4">
            <ImageSection label="Rendering" className="flex-1 min-w-0">
              <ImageFrame
                entityType="proposal_item"
                entityId={item.id}
                alt={`${item.productTag || 'Proposal'} rendering`}
                className="w-full aspect-[117/75] flex-shrink-0 rounded-lg"
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

          <div className="flex-1 overflow-y-auto p-5">
            <div className="space-y-4">
              <MetaField label="Product Description" value={item.description} />
              <MetaField label="Location" value={item.location} />
              <MetaField label="Drawings" value={item.drawings} />
              <MetaField label="Plan" value={item.plan} />
              <MetaField label="Size" value={item.sizeLabel} />

              {item.materials.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-gray-400">
                    Materials
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {item.materials.map((m) => (
                      <span
                        key={m.id}
                        className="inline-flex items-center gap-1.5 rounded-pill border border-gray-200 px-2.5 py-1 text-sm text-gray-700"
                      >
                        {m.swatchHex && (
                          <span
                            className="h-3 w-3 flex-shrink-0 rounded-full border border-gray-200"
                            style={{ background: m.swatchHex }}
                          />
                        )}
                        {m.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="border-t border-gray-100 pt-4">
                <dl className="grid grid-cols-3 gap-4">
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">
                      Quantity
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {item.quantity} {item.quantityUnit}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">
                      Unit Cost
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {formatMoney(cents(item.unitCostCents))}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">
                      Total
                    </dt>
                    <dd className="mt-1 text-sm font-semibold text-brand-700">
                      {formatMoney(cents(lineTotal))}
                    </dd>
                  </div>
                </dl>
                {item.cbm > 0 && <p className="mt-3 text-xs text-gray-400">CBM: {item.cbm}</p>}
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
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">{label}</p>
      {children}
    </div>
  );
}

function MetaField({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-0.5 text-sm text-gray-900">{value}</p>
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
          <BlobImage
            key={swatch.id}
            image={swatch}
            className="h-24 w-full rounded-lg object-cover"
          />
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
    return <div className={cn('animate-pulse rounded-lg bg-gray-100', className)} />;
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
