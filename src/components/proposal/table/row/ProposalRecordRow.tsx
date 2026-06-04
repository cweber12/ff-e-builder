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
        'project-row group bg-white transition-colors',
        'hover:bg-canvas-shell focus-within:bg-canvas-shell',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500',
        isDragging && 'bg-brand-50/70 opacity-80 shadow-sm',
      )}
    >
      <div className="grid gap-0 xl:grid-cols-[80px_minmax(0,2.2fr)_minmax(220px,1.25fr)_minmax(240px,1.3fr)_minmax(220px,1.1fr)_180px]">
        <div className="flex flex-col items-center justify-center gap-3 px-3 py-4 xl:border-r xl:border-neutral-200">
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

        <div className="px-4 py-4 xl:border-r xl:border-neutral-200">
          <div className="flex gap-4">
            <GeneratedItemImageControl
              view="proposal"
              kind="rendering"
              entityId={item.id}
              alt={`${item.productTag || 'Proposal'} rendering`}
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold leading-6 text-neutral-950">
                {item.itemName || 'Untitled item'}
              </p>
              <p className="mt-1 text-sm leading-6 text-neutral-700" style={descriptionClampStyle}>
                {item.description || 'No product description yet.'}
              </p>
              <div className="mt-3 grid gap-x-4 gap-y-2 sm:grid-cols-2">
                <DetailField label="Location" value={item.location || 'No location assigned'} />
                <DetailField
                  label="Quantity"
                  value={`${item.quantity} ${item.quantityUnit || 'unit'}`}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="px-4 py-4 xl:border-r xl:border-neutral-200">
          <div className="space-y-2">
            <DetailField label="Size" value={item.sizeLabel || '—'} />
            <DetailField label="Footprint" value={item.footprintLabel || '—'} />
            <DetailField label="CBM" value={item.cbm > 0 ? item.cbm.toFixed(3) : '—'} />
          </div>
        </div>

        <div className="px-4 py-4 xl:border-r xl:border-neutral-200">
          <div className="grid gap-4 xl:grid-cols-[120px_minmax(0,1fr)] xl:items-start">
            <div className="shrink-0">
              <GeneratedItemImageControl
                view="proposal"
                kind="plan"
                entityId={item.id}
                alt={`${item.productTag || 'Proposal'} plan`}
              />
            </div>
            <div className="space-y-2">
              <DetailField label="Drawing" value={item.drawings || 'No drawing reference'} />
              <DetailField label="Plan image" value={item.plan ? 'Attached' : 'Not attached'} />
            </div>
          </div>
        </div>

        <div className="px-4 py-4 xl:border-r xl:border-neutral-200">
          <div onClick={(event) => event.stopPropagation()}>
            <GeneratedItemMaterialsControl
              materials={item.materials}
              onOpen={() => onSwatchOpen(item.id)}
              onPasteImage={onSwatchPaste ? (file) => onSwatchPaste(item, file) : undefined}
              isPasting={isSwatchPasting}
              getFinishName={getMaterialFinishName}
            />
          </div>
        </div>

        <div className="px-4 py-4">
          <div className="space-y-2">
            <DetailField
              label="Quantity"
              value={`${item.quantity} ${item.quantityUnit || 'unit'}`}
            />
            <DetailField label="Unit cost" value={formatMoney(cents(item.unitCostCents))} />
            <DetailField label="Total" value={formatMoney(cents(lineTotal))} emphasis />
          </div>
        </div>
      </div>
    </article>
  );
}

function DetailField({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="min-w-0">
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
