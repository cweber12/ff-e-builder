import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { ImageFrame } from '../../shared/image/ImageFrame';
import { PanZoomFrame } from '../../shared/image/PanZoomFrame';
import { StatusBadge } from '../../primitives/StatusBadge';
import { cents, formatMoney } from '../../../types';
import { lineTotalCents } from '../../../lib/money';
import type { Item } from '../../../types';
import { ItemOptionImagesPanel } from './ItemOptionImagesPanel';

type Props = {
  item: Item;
  roomName?: string;
  onClose: () => void;
};

export function FfeItemDetailPanel({ item, roomName, onClose }: Props) {
  const total = lineTotalCents(item.unitCostCents, item.qty);

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
        className="mx-auto flex h-full max-w-4xl flex-col overflow-hidden rounded-sm border border-neutral-200 bg-canvas-chrome shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-neutral-200 px-5 py-3.5">
          <div className="min-w-0 flex-1">
            {roomName && <p className="eyebrow">{roomName}</p>}
            <h2 className="mt-0.5 truncate font-display text-base font-semibold text-neutral-950">
              {item.itemName}
            </h2>
          </div>
          <StatusBadge status={item.status} />
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
          <div className="flex w-full gap-5 justify-center overflow-y-auto border-b border-neutral-200 bg-canvas-shell p-5">
            <ImageSection label="Rendering">
              <ImageFrame
                entityType="item"
                entityId={item.id}
                alt={item.itemName}
                fallbackUrl={null}
                className="w-full aspect-[117/75]"
                disabled
              />
            </ImageSection>
            <ImageSection label="Plan">
              <PanZoomFrame
                entityType="item_plan"
                entityId={item.id}
                alt={`${item.itemName} plan`}
              />
            </ImageSection>
            <ImageSection label="Options">
              <ItemOptionImagesPanel itemId={item.id} itemName={item.itemName} />
            </ImageSection>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            <div className="space-y-5">
              <MetaField label="Description" value={item.description} />
              <MetaField label="ID" value={item.itemIdTag} numeric />
              <MetaField label="Category" value={item.category} />
              <MetaField label="Dimensions" value={item.dimensions} numeric />
              <MetaField label="Lead Time" value={item.leadTime} />
              <MetaField label="Notes" value={item.notes} />

              {item.materials.length > 0 && (
                <div>
                  <p className="eyebrow mb-2">Materials</p>
                  <div className="flex flex-wrap gap-1.5">
                    {item.materials.map((m) => (
                      <span
                        key={m.id}
                        className="inline-flex items-center gap-2 border border-neutral-200 bg-canvas-shell px-2.5 py-1 text-sm text-neutral-800"
                      >
                        {m.finish?.swatchHex && (
                          <span
                            className="h-3 w-3 flex-shrink-0 rounded-full border border-neutral-300"
                            style={{ background: m.finish.swatchHex }}
                          />
                        )}
                        {m.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="border-t border-neutral-200 pt-5">
                <dl className="grid grid-cols-2 gap-6">
                  <div className="border-l border-neutral-200 pl-3">
                    <dt className="eyebrow">Quantity</dt>
                    <dd className="num mt-1 text-sm font-medium text-neutral-950">{item.qty}</dd>
                  </div>
                  <div className="border-l border-neutral-200 pl-3">
                    <dt className="eyebrow">Unit Cost</dt>
                    <dd className="num mt-1 text-sm font-medium text-neutral-950">
                      {formatMoney(cents(item.unitCostCents))}
                    </dd>
                  </div>
                </dl>
                <div className="mt-5 flex items-baseline justify-between border-y border-brand-700/30 bg-brand-50/60 px-4 py-3">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-700">
                    Total
                  </span>
                  <p className="num text-2xl font-semibold tracking-tight text-brand-700">
                    {formatMoney(cents(total))}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ImageSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="w-full">
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
  value: string | null;
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
