import type { ReactNode } from 'react';
import { CSS } from '@dnd-kit/utilities';
import { useSortable } from '@dnd-kit/sortable';
import { cents, formatMoney, type Material, type ProposalItem } from '../../../../types';
import { proposalLineTotalCents } from '../../../../lib/money';
import { cn } from '../../../../lib/utils';
import { GeneratedItemDragHandle } from '../../../shared/table/GeneratedItemDragHandle';
import { GeneratedItemImageControl } from '../../../shared/table/GeneratedItemImageCell';
import { GeneratedItemMaterialsControl } from '../../../shared/table/GeneratedItemMaterialsCell';
import { ProposalItemActionsMenu } from './ProposalItemActionsMenu';

const descriptionClampStyle = {
  display: '-webkit-box',
  WebkitBoxOrient: 'vertical' as const,
  WebkitLineClamp: 2,
  overflow: 'hidden',
};

type ProposalRecordRowProps = {
  item: ProposalItem;
  otherCategories: { id: string; name: string }[];
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
        'group rounded-md border border-neutral-200 bg-white shadow-sm transition',
        'motion-reduce:transition-none motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-md',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500',
        'hover:border-brand-200 hover:bg-brand-50/10',
        isDragging && 'border-brand-300 bg-brand-50/60 shadow-md opacity-80',
      )}
    >
      <div className="flex items-center gap-2 border-b border-neutral-200/80 px-4 py-3">
        <div className="flex shrink-0 items-center" onClick={(event) => event.stopPropagation()}>
          <GeneratedItemDragHandle
            ariaLabel={`Drag ${item.productTag || 'item'}`}
            {...attributes}
            {...listeners}
          />
        </div>
        <span className="inline-flex shrink-0 rounded-pill bg-brand-100 px-2.5 py-1 text-[11px] font-semibold tracking-[0.12em] text-brand-700">
          {item.productTag || 'UNNAMED'}
        </span>
        <div className="ml-auto" onClick={(event) => event.stopPropagation()}>
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

      <div className="grid gap-4 px-4 py-4 2xl:grid-cols-[minmax(0,2.35fr)_minmax(280px,1.4fr)_minmax(0,2.15fr)_minmax(220px,1.2fr)_220px]">
        <RecordBlock label="Item">
          <div className="flex gap-4">
            <GeneratedItemImageControl
              view="proposal"
              kind="rendering"
              entityId={item.id}
              alt={`${item.productTag || 'Proposal'} rendering`}
            />
            <div className="min-w-0 flex-1">
              <p className="text-[1.05rem] font-semibold leading-6 tracking-tight text-neutral-950">
                {item.itemName || 'Untitled item'}
              </p>
              <p className="mt-1 text-xs uppercase tracking-[0.14em] text-neutral-500">
                Item ID {item.productTag || 'Pending'}
              </p>
              <div className="mt-3 rounded-sm border border-neutral-200 bg-canvas-chrome px-3 py-2">
                <p className="eyebrow text-neutral-500">Location</p>
                <p className="mt-1 text-sm leading-5 text-neutral-800">
                  {item.location || 'No location assigned'}
                </p>
              </div>
            </div>
          </div>
        </RecordBlock>

        <RecordBlock label="Plan">
          <div className="grid gap-4 xl:grid-cols-[128px_minmax(0,1fr)] xl:items-start">
            <GeneratedItemImageControl
              view="proposal"
              kind="plan"
              entityId={item.id}
              alt={`${item.productTag || 'Proposal'} plan`}
            />
            <div className="min-w-0 flex-1">
              <p className="eyebrow text-neutral-500">Drawing</p>
              <p className="mt-1 text-sm leading-6 text-neutral-800">
                {item.drawings || 'No drawing reference'}
              </p>
            </div>
          </div>
        </RecordBlock>

        <RecordBlock label="Specs">
          <div className="grid gap-3">
            <div className="grid gap-3 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,0.9fr)]">
              <Metric className="xl:row-span-2" label="Size" value={item.sizeLabel || '—'} />
              <Metric label="Footprint" value={item.footprintLabel || '—'} />
              <Metric label="CBM" value={item.cbm > 0 ? item.cbm.toFixed(3) : '—'} />
            </div>
            <div>
              <p className="eyebrow text-neutral-500">Description</p>
              <p className="mt-1 text-sm leading-6 text-neutral-700" style={descriptionClampStyle}>
                {item.description || 'No product description yet.'}
              </p>
            </div>
          </div>
        </RecordBlock>

        <RecordBlock label="Materials">
          <div onClick={(event) => event.stopPropagation()}>
            <GeneratedItemMaterialsControl
              materials={item.materials}
              onOpen={() => onSwatchOpen(item.id)}
              onPasteImage={onSwatchPaste ? (file) => onSwatchPaste(item, file) : undefined}
              isPasting={isSwatchPasting}
              getFinishName={getMaterialFinishName}
            />
          </div>
        </RecordBlock>

        <RecordBlock label="Pricing">
          <div className="grid gap-3">
            <Metric
              label="Quantity"
              value={`${item.quantity} ${item.quantityUnit || 'unit'}`}
              emphasis
            />
            <Metric label="Unit Cost" value={formatMoney(cents(item.unitCostCents))} />
            <Metric label="Total" value={formatMoney(cents(lineTotal))} emphasis />
          </div>
        </RecordBlock>
      </div>
    </article>
  );
}

function RecordBlock({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="min-w-0 rounded-sm border border-neutral-200 bg-canvas-chrome/60 px-4 py-4">
      <p className="eyebrow text-neutral-500">{label}</p>
      <div className="mt-3 min-w-0">{children}</div>
    </section>
  );
}

function Metric({
  label,
  value,
  emphasis = false,
  className,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('rounded-sm border border-neutral-200 bg-white px-3 py-2', className)}>
      <p className="eyebrow text-neutral-500">{label}</p>
      <p
        className={cn(
          'mt-1 text-sm leading-6 text-neutral-800 break-normal',
          emphasis && 'font-semibold text-neutral-950',
        )}
      >
        {value}
      </p>
    </div>
  );
}
