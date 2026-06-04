import type { MouseEvent } from 'react';
import { Badge } from '../../../primitives';
import { MobileField } from '../../../shared/table/TableViewWrappers';
import { ImageFrame } from '../../../shared/image/ImageFrame';
import { ProposalItemActionsMenu } from '../row/ProposalItemActionsMenu';
import { proposalLineTotalCents } from '../../../../lib/money';
import {
  cents,
  formatMoney,
  type ProposalItem,
  type RevisionCostStatus,
  type RevisionSnapshot,
} from '../../../../types';

type ProposalCategoryMobileCardsProps = {
  items: ProposalItem[];
  otherCategories: { id: string; name: string }[];
  compactMode?: 'mobile' | 'tablet';
  snapshotsByItem: Map<string, RevisionSnapshot>;
  onDelete: (item: ProposalItem) => void;
  onDuplicate: (item: ProposalItem) => void;
  onAddToFfe: (item: ProposalItem) => void;
  onMove: (item: ProposalItem, toCategoryId: string) => void;
  onItemClick: (item: ProposalItem) => void;
};

export function ProposalCategoryMobileCards({
  items,
  otherCategories,
  compactMode = 'mobile',
  snapshotsByItem,
  onDelete,
  onDuplicate,
  onAddToFfe,
  onMove,
  onItemClick,
}: ProposalCategoryMobileCardsProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-neutral-300 px-4 py-6 text-center text-sm text-neutral-500">
        Tap "+ Add item" above to add the first item.
      </div>
    );
  }

  const stopProp = (event: MouseEvent) => event.stopPropagation();

  return (
    <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-1">
      {items.map((item) => {
        const lineTotal = proposalLineTotalCents(item);
        const snapshot = snapshotsByItem.get(item.id);
        const materialSummary =
          item.materials.length > 0
            ? `${item.materials.length} ${item.materials.length === 1 ? 'material' : 'materials'}`
            : 'N/A';
        const cardLabel = [
          item.itemName || item.productTag || 'item',
          item.productTag,
          item.location,
        ]
          .filter(Boolean)
          .join(', ');
        return (
          <article
            key={item.id}
            role="button"
            tabIndex={0}
            aria-label={`Open details for ${cardLabel}`}
            aria-haspopup="dialog"
            aria-keyshortcuts="Enter Space"
            onClick={() => onItemClick(item)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' && event.key !== ' ') return;
              if (event.target !== event.currentTarget) return;
              event.preventDefault();
              onItemClick(item);
            }}
            className="cursor-pointer rounded-[12px] border border-neutral-200 bg-white p-4 shadow-sm transition-colors hover:border-brand-300 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-500 sm:p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <ImageFrame
                  entityType="proposal_item"
                  entityId={item.id}
                  alt={item.productTag || 'item'}
                  fallbackUrl={null}
                  className="h-16 aspect-[117/75] shrink-0 sm:h-20"
                  compact
                  eager
                />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-base font-semibold text-neutral-950">
                      {item.itemName || item.productTag || item.description || 'Unnamed item'}
                    </p>
                    <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500">
                      {item.productTag}
                    </span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2">
                    {item.location ? (
                      <span className="truncate text-sm text-neutral-500">{item.location}</span>
                    ) : null}
                    {snapshot ? <RevisionCardBadge status={snapshot.costStatus} /> : null}
                  </div>
                  <p className="mt-1 text-sm text-neutral-500">
                    {compactMode === 'tablet'
                      ? item.drawings || 'No drawing reference'
                      : materialSummary}
                  </p>
                </div>
              </div>
              <div onClick={stopProp}>
                <ProposalItemActionsMenu
                  itemName={item.itemName || item.productTag || item.description || 'item'}
                  otherCategories={otherCategories}
                  onViewDetails={() => onItemClick(item)}
                  onDuplicate={() => onDuplicate(item)}
                  onAddToFfe={() => onAddToFfe(item)}
                  onMove={(toCategoryId) => onMove(item, toCategoryId)}
                  onDelete={() => onDelete(item)}
                />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              <MobileField label="Quantity">
                <span>
                  {item.quantity} {item.quantityUnit}
                </span>
              </MobileField>
              <MobileField label="Unit Cost">
                <span>{formatMoney(cents(item.unitCostCents))}</span>
              </MobileField>
              <MobileField label="Total">
                <span className="font-semibold tabular-nums">{formatMoney(cents(lineTotal))}</span>
              </MobileField>
              <MobileField label="Size">
                <span>{item.sizeLabel || 'N/A'}</span>
              </MobileField>
              <MobileField label="Drawing">
                <span>{item.drawings || 'N/A'}</span>
              </MobileField>
              <MobileField label="Materials">
                <span>{materialSummary}</span>
              </MobileField>
              {compactMode === 'tablet' ? (
                <MobileField label="Footprint">
                  <span>{item.footprintLabel || 'N/A'}</span>
                </MobileField>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function RevisionCardBadge({ status }: { status: RevisionCostStatus }) {
  if (status === 'flagged') {
    return (
      <Badge variant="warning" size="sm" uppercase>
        Flagged
      </Badge>
    );
  }
  if (status === 'resolved') {
    return (
      <Badge variant="success" size="sm" uppercase>
        Resolved
      </Badge>
    );
  }
  return null;
}
