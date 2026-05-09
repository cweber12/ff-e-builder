import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { ImageFrame } from '../../shared/ImageFrame';
import { StatusBadge } from '../../primitives/StatusBadge';
import { cents, formatMoney } from '../../../types';
import { lineTotalCents } from '../../../lib/budgetCalc';
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
    <div className="fixed inset-0 z-50 bg-gray-950/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="mx-auto flex h-full max-w-4xl flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-gray-100 bg-surface px-5 py-3">
          <div className="min-w-0 flex-1">
            {roomName && (
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                {roomName}
              </p>
            )}
            <h2 className="truncate text-base font-semibold text-gray-900">{item.itemName}</h2>
          </div>
          <StatusBadge status={item.status} />
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
            <ImageSection label="Rendering">
              <ImageFrame
                entityType="item"
                entityId={item.id}
                alt={item.itemName}
                fallbackUrl={null}
                className="w-full aspect-[117/75] rounded-lg"
                disabled
              />
            </ImageSection>
            <ImageSection label="Plan">
              <ImageFrame
                entityType="item_plan"
                entityId={item.id}
                alt={`${item.itemName} plan`}
                className="w-full aspect-[103/75] rounded-lg"
                disabled
              />
            </ImageSection>
            <ImageSection label="Options">
              <ItemOptionImagesPanel itemId={item.id} itemName={item.itemName} />
            </ImageSection>
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            <div className="space-y-4">
              <MetaField label="Description" value={item.description} />
              <MetaField label="Item ID" value={item.itemIdTag} />
              <MetaField label="Category" value={item.category} />
              <MetaField label="Dimensions" value={item.dimensions} />
              <MetaField label="Lead Time" value={item.leadTime} />
              <MetaField label="Notes" value={item.notes} />

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
                <dl className="grid grid-cols-2 gap-4">
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">
                      Quantity
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900">{item.qty}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">
                      Unit Cost
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {formatMoney(cents(item.unitCostCents))}
                    </dd>
                  </div>
                </dl>
                <div className="mt-4 rounded-lg bg-brand-50 px-4 py-3">
                  <span className="text-xs font-medium uppercase tracking-wide text-brand-600">
                    Total
                  </span>
                  <p className="mt-0.5 text-lg font-semibold text-brand-700">
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
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">{label}</p>
      {children}
    </div>
  );
}

function MetaField({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-0.5 text-sm text-gray-900">{value}</p>
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
