import { CSS } from '@dnd-kit/utilities';
import { useSortable } from '@dnd-kit/sortable';
import {
  cents,
  formatMoney,
  type Material,
  type ProposalItem,
  type RevisionSnapshot,
} from '../../../../types';
import { proposalLineTotalCents } from '../../../../lib/money';
import { cn } from '../../../../lib/utils';
import { GeneratedItemDragHandle } from '../../../shared/table/GeneratedItemDragHandle';
import { GeneratedItemImageControl } from '../../../shared/table/GeneratedItemImageCell';
import { GeneratedItemMaterialsControl } from '../../../shared/table/GeneratedItemMaterialsCell';
import { ProposalItemActionsMenu } from './ProposalItemActionsMenu';

const valueClampStyle = {
  display: '-webkit-box',
  WebkitBoxOrient: 'vertical' as const,
  WebkitLineClamp: 2,
  overflow: 'hidden',
};

type ProposalRecordRowProps = {
  item: ProposalItem;
  otherCategories: { id: string; name: string }[];
  columnTemplate?: string | undefined;
  revisionMode?: boolean;
  revisionSnapshot?: RevisionSnapshot | undefined;
  openRevisionLabel?: string | undefined;
  onDelete: () => void;
  onDuplicate: () => void;
  onAddToFfe: () => void;
  onMove: (toCategoryId: string) => void;
  onRowClick: () => void;
  onSwatchOpen: (itemId: string) => void;
  onSwatchPaste?: ((item: ProposalItem, file: File) => Promise<void>) | undefined;
  isSwatchPasting?: boolean | undefined;
  getMaterialFinishName: (material: Material) => string | undefined;
};

export function ProposalRecordRow({
  item,
  otherCategories,
  columnTemplate,
  revisionMode = false,
  revisionSnapshot,
  openRevisionLabel,
  onDelete,
  onDuplicate,
  onAddToFfe,
  onMove,
  onRowClick,
  onSwatchOpen,
  onSwatchPaste,
  isSwatchPasting = false,
  getMaterialFinishName,
}: ProposalRecordRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  const lineTotal = proposalLineTotalCents(item);

  return (
    <article
      ref={setNodeRef}
      data-item-id={item.id}
      tabIndex={0}
      aria-label={`Open details for ${item.itemName || item.productTag || 'item'}`}
      onClick={onRowClick}
      onKeyDown={(event) => {
        if (event.key !== 'Enter') return;
        if (event.target !== event.currentTarget) return;
        event.preventDefault();
        onRowClick();
      }}
      style={{
        transform: CSS.Transform.toString(transform),
        transition: transition ?? undefined,
      }}
      className={cn(
        'project-row group rounded-[10px] border border-neutral-200 bg-white transition-colors',
        'hover:bg-canvas-shell focus-within:bg-canvas-shell',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500',
        isDragging && 'bg-brand-50/70 opacity-80 shadow-sm',
      )}
    >
      <div
        className="grid gap-0"
        style={columnTemplate ? { gridTemplateColumns: columnTemplate } : undefined}
      >
        <div
          data-record-cell="identity"
          className="flex flex-col items-center justify-center gap-3 px-3 py-4 xl:border-r xl:border-neutral-200"
        >
          <div className="flex shrink-0 items-center" onClick={(event) => event.stopPropagation()}>
            <GeneratedItemDragHandle
              ariaLabel={`Drag ${item.productTag || 'item'}`}
              {...attributes}
              {...listeners}
            />
          </div>
          <span className="num text-xs font-semibold uppercase tracking-[0.12em] text-neutral-700">
            {item.productTag || 'UNNAMED'}
          </span>
          <div onClick={(event) => event.stopPropagation()}>
            <ProposalItemActionsMenu
              itemName={item.itemName || item.productTag || item.description || 'item'}
              otherCategories={otherCategories}
              onViewDetails={onRowClick}
              onDuplicate={onDuplicate}
              onAddToFfe={onAddToFfe}
              onMove={onMove}
              onDelete={onDelete}
            />
          </div>
        </div>

        <div data-record-cell="item" className="px-5 py-5 xl:border-r xl:border-neutral-200">
          <div data-record-measure="item" className="w-[168px]">
            <p
              className="mb-3 w-[168px] text-[13px] font-semibold uppercase tracking-[0.04em] text-neutral-900"
              style={valueClampStyle}
            >
              {item.itemName || 'Untitled item'}
            </p>
            <GeneratedItemImageControl
              view="proposal"
              kind="rendering"
              entityId={item.id}
              alt={`${item.productTag || 'Proposal'} rendering`}
              className="h-28 w-[168px]"
            />
          </div>
        </div>

        <div data-record-cell="specs" className="px-5 py-5 xl:border-r xl:border-neutral-200">
          <div data-record-measure="specs" className="w-fit max-w-[16rem] space-y-3">
            <DetailField label="Size" value={displayValue(item.sizeLabel)} />
            <DetailField label="Footprint" value={displayValue(item.footprintLabel)} />
          </div>
        </div>

        <div data-record-cell="plan" className="px-5 py-5 xl:border-r xl:border-neutral-200">
          <div
            data-record-measure="plan"
            className="grid w-fit gap-4 xl:[grid-template-columns:148px_fit-content(9rem)] xl:items-start"
          >
            <div className="shrink-0 space-y-3">
              <DetailField label="Location" value={displayValue(item.location)} />
              <GeneratedItemImageControl
                view="proposal"
                kind="plan"
                entityId={item.id}
                alt={`${item.productTag || 'Proposal'} plan`}
                className="h-28 w-[148px]"
              />
            </div>
            <div className="space-y-3">
              <DetailField label="Drawing" value={displayValue(item.drawings)} />
            </div>
          </div>
        </div>

        <div data-record-cell="materials" className="px-5 py-5 xl:border-r xl:border-neutral-200">
          {item.materials.length > 0 ? (
            <div
              data-record-measure="materials"
              className="w-fit"
              onClick={(event) => event.stopPropagation()}
            >
              <GeneratedItemMaterialsControl
                materials={item.materials}
                onOpen={() => onSwatchOpen(item.id)}
                onPasteImage={onSwatchPaste ? (file) => onSwatchPaste(item, file) : undefined}
                isPasting={isSwatchPasting}
                getFinishName={getMaterialFinishName}
                columns={2}
              />
            </div>
          ) : (
            <div data-record-measure="materials" className="w-fit">
              <DetailField label="Materials" value="N/A" />
            </div>
          )}
        </div>

        <div data-record-cell="pricing" className="px-5 py-5">
          <div data-record-measure="pricing" className="w-fit max-w-[11rem] space-y-3">
            {revisionMode ? (
              <>
                {openRevisionLabel ? (
                  <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-brand-700">
                    Revision {openRevisionLabel}
                  </p>
                ) : null}
                <DetailField
                  label="Before qty"
                  value={`${item.quantity} ${item.quantityUnit || 'unit'}`}
                />
                <DetailField label="Before cost" value={formatMoney(cents(item.unitCostCents))} />
                <DetailField label="Before total" value={formatMoney(cents(lineTotal))} emphasis />
                <DetailField
                  label="After qty"
                  value={formatRevisionQuantity(revisionSnapshot, item.quantityUnit || 'unit')}
                  valueTone={revisionSnapshot?.quantity == null ? 'muted' : 'brand'}
                />
                <DetailField
                  label="After cost"
                  value={formatRevisionCost(revisionSnapshot)}
                  valueTone={getRevisionCostTone(revisionSnapshot)}
                />
                <DetailField
                  label="After total"
                  value={formatRevisionTotal(revisionSnapshot)}
                  emphasis
                  valueTone={
                    revisionSnapshot?.quantity != null && revisionSnapshot?.unitCostCents != null
                      ? 'brand'
                      : 'muted'
                  }
                />
              </>
            ) : (
              <>
                <DetailField
                  label="Quantity"
                  value={`${item.quantity} ${item.quantityUnit || 'unit'}`}
                />
                <DetailField label="Unit cost" value={formatMoney(cents(item.unitCostCents))} />
                <DetailField label="Total" value={formatMoney(cents(lineTotal))} emphasis />
              </>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

function displayValue(value: string | null | undefined) {
  if (typeof value !== 'string') return 'N/A';
  const trimmed = value.trim();
  return trimmed ? trimmed : 'N/A';
}

function DetailField({
  label,
  value,
  emphasis = false,
  valueTone = 'default',
}: {
  label: string;
  value: string;
  emphasis?: boolean;
  valueTone?: 'default' | 'muted' | 'brand' | 'warning' | 'success';
}) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-500">
        {label}
      </p>
      <p
        className={cn(
          'mt-1 text-[13px] font-semibold leading-5 text-neutral-900 break-normal',
          emphasis && 'text-neutral-950',
          valueTone === 'muted' && 'text-neutral-400',
          valueTone === 'brand' && 'text-brand-700',
          valueTone === 'warning' && 'text-amber-700',
          valueTone === 'success' && 'text-green-700',
        )}
        style={valueClampStyle}
      >
        {value}
      </p>
    </div>
  );
}

function formatRevisionQuantity(snapshot: RevisionSnapshot | undefined, currentUnit: string) {
  if (snapshot?.quantity == null) return '—';
  return `${snapshot.quantity} ${currentUnit}`;
}

function formatRevisionCost(snapshot: RevisionSnapshot | undefined) {
  if (snapshot?.unitCostCents == null) return '—';
  return formatMoney(cents(snapshot.unitCostCents));
}

function formatRevisionTotal(snapshot: RevisionSnapshot | undefined) {
  if (snapshot?.quantity == null || snapshot.unitCostCents == null) return '—';
  return formatMoney(cents(Math.round(snapshot.quantity * snapshot.unitCostCents)));
}

function getRevisionCostTone(
  snapshot: RevisionSnapshot | undefined,
): 'muted' | 'warning' | 'success' | 'brand' {
  if (snapshot?.unitCostCents == null) return 'muted';
  if (snapshot.costStatus === 'flagged') return 'warning';
  if (snapshot.costStatus === 'resolved') return 'success';
  return 'brand';
}
