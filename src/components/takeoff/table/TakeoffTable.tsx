import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Button, Modal } from '../../primitives';
import { ImageFrame } from '../../shared/ImageFrame';
import {
  useCreateTakeoffCategory,
  useCreateTakeoffItem,
  useDeleteTakeoffCategory,
  useDeleteTakeoffItem,
  useDeleteImage,
  useImages,
  useTakeoffWithItems,
  useUploadImage,
  useUpdateTakeoffCategory,
  useUpdateTakeoffItem,
} from '../../../hooks';
import {
  dollarsToCents,
  cents,
  formatMoney,
  parseUnitCostDollarsInput,
  type TakeoffItem,
} from '../../../types';
import { ApiError } from '../../../lib/api';
import { api } from '../../../lib/api';
import {
  takeoffCategorySubtotalCents,
  takeoffLineTotalCents,
  takeoffProjectTotalCents,
} from '../../../lib/calc';
import type { UpdateTakeoffItemInput } from '../../../lib/api';
import { DimensionEditorModal } from '../../shared/DimensionEditorModal';
import {
  GroupedTableHeader,
  GroupedTableSection,
  StickyGrandTotal,
  TableViewStack,
} from '../../shared/TableViewWrappers';
import { AddGroupModal } from '../../shared/AddGroupModal';
import { InlineTextEdit } from '../../primitives/InlineTextEdit';
import { cn } from '../../../lib/cn';

const quantityUnits = ['unit', 'sq ft', 'ln ft', 'sq yd', 'cu yd', 'each'] as const;
const editInputClassName =
  'rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-700 focus:border-brand-500 focus:outline-none';

type TakeoffTableProps = {
  projectId: string;
};

export function TakeoffTable({ projectId }: TakeoffTableProps) {
  const { categoriesWithItems, isLoading } = useTakeoffWithItems(projectId);
  const createCategory = useCreateTakeoffCategory(projectId);
  const updateCategory = useUpdateTakeoffCategory(projectId);
  const deleteCategory = useDeleteTakeoffCategory(projectId);
  const updateItem = useUpdateTakeoffItem();
  const [addCategoryOpen, setAddCategoryOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const grandTotal = takeoffProjectTotalCents(categoriesWithItems);

  const toggleCollapsed = (id: string) => {
    setCollapsed((current) => ({ ...current, [id]: !current[id] }));
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <TableViewStack>
      <div className="flex justify-center">
        <Button type="button" variant="secondary" onClick={() => setAddCategoryOpen(true)}>
          Add category
        </Button>
      </div>

      {categoriesWithItems.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white px-4 py-8 text-center">
          <p className="text-sm font-semibold text-gray-900">No Take-Off Categories yet</p>
          <p className="mt-1 text-sm text-gray-500">
            Create a category to start your Take-Off Table.
          </p>
        </div>
      ) : null}

      {categoriesWithItems.map((category) => (
        <TakeoffCategorySection
          key={category.id}
          categoryId={category.id}
          categoryName={category.name}
          items={category.items}
          subtotalCents={takeoffCategorySubtotalCents(category.items)}
          collapsed={collapsed[category.id] ?? false}
          onToggle={() => toggleCollapsed(category.id)}
          onCategoryNameSave={(name) =>
            updateCategory.mutate({ id: category.id, patch: { name: name.trim() } })
          }
          onCategoryDelete={() => deleteCategory.mutate(category.id)}
          onItemSave={(item, patch) => updateItem.mutate({ id: item.id, patch })}
        />
      ))}

      <StickyGrandTotal value={formatMoney(cents(grandTotal))} />

      <AddGroupModal
        groupLabel="Category"
        open={addCategoryOpen}
        onClose={() => setAddCategoryOpen(false)}
        onSubmit={async (name) => {
          await createCategory.mutateAsync({ name, sortOrder: categoriesWithItems.length });
        }}
      />
    </TableViewStack>
  );
}

function ChevronIcon({ direction = 'down' }: { direction?: 'down' | 'left' | 'right' }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      className={cn(
        'h-4 w-4 transition-transform',
        direction === 'left' && 'rotate-90',
        direction === 'right' && '-rotate-90',
      )}
    >
      <path
        d="m5.5 8 4.5 4.5L14.5 8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="h-4 w-4">
      <circle cx="5" cy="10" r="1.5" />
      <circle cx="10" cy="10" r="1.5" />
      <circle cx="15" cy="10" r="1.5" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
      <path
        d="M10 4.5v11M4.5 10h11"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ExpandIcon({ expanded }: { expanded?: boolean }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
      {expanded ? (
        <path
          d="M7.5 4.5v4h-4m9 7v-4h4M7.5 8.5 3.5 4.5m9 7 4 4"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <path
          d="M8 4H4v4m8-4h4v4M8 16H4v-4m8 4h4v-4M4.5 4.5 8 8m7.5-3.5L12 8m-7.5 7.5L8 12m7.5 3.5L12 12"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

const menuItemClassName =
  'flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500';

function CategoryActionsMenu({
  categoryName,
  onCategoryDelete,
}: {
  categoryName: string;
  onCategoryDelete: () => void;
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
        aria-label={`Open options for ${categoryName}`}
        title={`Open options for ${categoryName}`}
        onClick={() => setOpen((current) => !current)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-white hover:text-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
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
            className={cn(menuItemClassName, 'text-danger-600')}
            onClick={() => runAction(onCategoryDelete)}
          >
            Delete category
          </button>
        </div>
      )}
    </div>
  );
}

function TakeoffCategorySection({
  categoryId,
  categoryName,
  items,
  subtotalCents,
  collapsed,
  onToggle,
  onCategoryNameSave,
  onCategoryDelete,
  onItemSave,
}: {
  categoryId: string;
  categoryName: string;
  items: TakeoffItem[];
  subtotalCents: number;
  collapsed: boolean;
  onToggle: () => void;
  onCategoryNameSave: (name: string) => void;
  onCategoryDelete: () => void;
  onItemSave: (item: TakeoffItem, patch: UpdateTakeoffItemInput) => void;
}) {
  const createItem = useCreateTakeoffItem(categoryId);
  const deleteItem = useDeleteTakeoffItem(categoryId);
  const [isExpanded, setIsExpanded] = useState(false);

  const itemCount = items.length;

  return (
    <GroupedTableSection>
      <GroupedTableHeader className="flex-wrap gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={!collapsed}
            aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${categoryName}`}
            title={`${collapsed ? 'Expand' : 'Collapse'} ${categoryName}`}
            className="shrink-0 rounded px-1 text-xs text-gray-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
          >
            <ChevronIcon direction={collapsed ? 'right' : 'down'} />
          </button>
          <InlineTextEdit
            value={categoryName}
            onSave={(name) => {
              onCategoryNameSave(name);
            }}
            aria-label="Category name"
            renderDisplay={(v) => (
              <span className="truncate text-sm font-semibold text-gray-950">{v}</span>
            )}
            inputClassName="text-sm font-semibold text-gray-950 border-gray-300 bg-white"
          />
          <span className="shrink-0 rounded-pill bg-white px-2 py-0.5 text-xs text-gray-600">
            {itemCount} {itemCount === 1 ? 'item' : 'items'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-sm font-semibold tabular-nums text-brand-700">
            {formatMoney(cents(subtotalCents))}
          </span>
          <button
            type="button"
            aria-label={`Add item to ${categoryName}`}
            title={`Add item to ${categoryName}`}
            onClick={() =>
              createItem.mutate({
                sortOrder: items.length,
                productTag: `${categoryName.slice(0, 2).toUpperCase()}-${items.length + 1}`,
              })
            }
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-white hover:text-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
          >
            <PlusIcon />
          </button>
          <CategoryActionsMenu categoryName={categoryName} onCategoryDelete={onCategoryDelete} />
          {!collapsed && (
            <button
              type="button"
              aria-label="Expand table view"
              title="Expand table view"
              onClick={() => setIsExpanded(true)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-white hover:text-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
            >
              <ExpandIcon />
            </button>
          )}
        </div>
      </GroupedTableHeader>

      {!collapsed && (
        <div className="overflow-x-auto">
          <table className="min-w-[1320px] w-full border-collapse text-left text-sm">
            <thead className="bg-white text-xs uppercase tracking-wide text-gray-500">
              <tr>
                {[
                  'Rendering',
                  'Product Tag',
                  'Plan',
                  'Drawings',
                  'Location',
                  'Product Description',
                  'Size',
                  'Swatch',
                  'CBM',
                  'Quantity',
                  'Unit Cost',
                  'Total Cost',
                  '',
                ].map((heading) => (
                  <th key={heading} className="border-b border-gray-200 px-3 py-2 font-semibold">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <TakeoffRow
                  key={item.id}
                  item={item}
                  onSave={(patch) => onItemSave(item, { ...patch, version: item.version })}
                  onDelete={() => deleteItem.mutate(item.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isExpanded && (
        <div className="fixed inset-0 z-50 bg-gray-950/35 p-4 backdrop-blur-sm">
          <div className="flex h-full flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-4 border-b border-gray-100 bg-surface px-4 py-3">
              <div className="min-w-0">
                <h2 className="truncate text-base font-semibold text-gray-950">{categoryName}</h2>
                <p className="text-xs text-gray-500">
                  {itemCount} {itemCount === 1 ? 'item' : 'items'} -{' '}
                  {formatMoney(cents(subtotalCents))}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label="Minimize table view"
                title="Minimize table view"
                onClick={() => setIsExpanded(false)}
              >
                <ExpandIcon expanded />
                Minimize
              </Button>
            </div>
            <div
              tabIndex={0}
              aria-label={`${categoryName} expanded items table`}
              className="min-w-0 overflow-auto flex-1"
            >
              <table className="min-w-[1320px] w-full border-collapse text-left text-sm">
                <thead className="sticky top-0 z-10 bg-white text-xs uppercase tracking-wide text-gray-500 shadow-[0_1px_0_rgb(243_244_246)]">
                  <tr>
                    {[
                      'Rendering',
                      'Product Tag',
                      'Plan',
                      'Drawings',
                      'Location',
                      'Product Description',
                      'Size',
                      'Swatch',
                      'CBM',
                      'Quantity',
                      'Unit Cost',
                      'Total Cost',
                      '',
                    ].map((heading) => (
                      <th
                        key={heading}
                        className="border-b border-gray-100 px-3 py-3 font-semibold"
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <TakeoffRow
                      key={item.id}
                      item={item}
                      onSave={(patch) => onItemSave(item, { ...patch, version: item.version })}
                      onDelete={() => deleteItem.mutate(item.id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </GroupedTableSection>
  );
}

function TakeoffRow({
  item,
  onSave,
  onDelete,
}: {
  item: TakeoffItem;
  onSave: (patch: Omit<UpdateTakeoffItemInput, 'version'>) => void;
  onDelete: () => void;
}) {
  const [sizeOpen, setSizeOpen] = useState(false);
  const lineTotal = takeoffLineTotalCents(item);

  return (
    <tr className="border-b border-gray-100 align-top last:border-b-0">
      <td className="w-28 px-3 py-2">
        <ImageFrame
          entityType="takeoff_item"
          entityId={item.id}
          alt={`${item.productTag || 'Take-off'} rendering`}
          className="h-20 w-24"
          compact
        />
      </td>
      <EditableCell value={item.productTag} onSave={(productTag) => onSave({ productTag })} />
      <td className="w-28 px-3 py-2">
        <ImageFrame
          entityType="takeoff_plan"
          entityId={item.id}
          alt={`${item.productTag || 'Take-off'} plan`}
          className="h-20 w-24"
          compact
        />
      </td>
      <EditableCell value={item.drawings} onSave={(drawings) => onSave({ drawings })} />
      <EditableCell value={item.location} onSave={(location) => onSave({ location })} />
      <EditableCell
        value={item.description}
        onSave={(description) => onSave({ description })}
        className="min-w-64"
      />
      <td className="px-3 py-2">
        <button
          type="button"
          onClick={() => setSizeOpen(true)}
          className={cn(
            'min-h-9 w-40 rounded text-left text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500',
            item.sizeLabel
              ? 'px-2 py-1 text-gray-700 hover:bg-brand-50'
              : 'border border-gray-300 px-2 py-1 text-gray-400 hover:border-brand-500',
          )}
        >
          {item.sizeLabel || 'Set size'}
        </button>
        <SizeModal
          item={item}
          open={sizeOpen}
          onClose={() => setSizeOpen(false)}
          onSave={(patch) => {
            onSave(patch);
            setSizeOpen(false);
          }}
        />
      </td>
      <td className="min-w-36 px-3 py-2">
        <TakeoffSwatchCell item={item} />
      </td>
      <NumberCell
        value={item.cbm}
        step="0.001"
        onSave={(cbm) => onSave({ cbm })}
        className="w-24"
      />
      <QuantityCell
        quantity={item.quantity}
        quantityUnit={item.quantityUnit}
        onSaveQuantity={(quantity) => onSave({ quantity })}
        onSaveUnit={(quantityUnit) => onSave({ quantityUnit })}
      />
      <MoneyCell
        valueCents={item.unitCostCents}
        onSave={(unitCostCents) => onSave({ unitCostCents })}
      />
      <td className="px-3 py-2 font-semibold text-gray-900">{formatMoney(cents(lineTotal))}</td>
      <td className="px-3 py-2">
        <Button type="button" variant="ghost" size="sm" onClick={onDelete}>
          Delete
        </Button>
      </td>
    </tr>
  );
}

function EditableCell({
  value,
  onSave,
  className,
}: {
  value: string;
  onSave: (value: string) => void;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const commit = () => {
    if (draft !== value) onSave(draft);
    setEditing(false);
  };

  const cancel = () => {
    setDraft(value);
    setEditing(false);
  };

  if (!editing) {
    const isEmpty = !value;
    return (
      <td className={cn('px-3 py-2', className)}>
        <span
          role="button"
          tabIndex={0}
          onClick={() => setEditing(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setEditing(true);
            }
          }}
          className={cn(
            'block w-full cursor-pointer rounded px-2 py-1 text-sm',
            isEmpty
              ? 'border border-gray-300 text-gray-400 hover:border-brand-500'
              : 'text-gray-700 hover:bg-brand-50',
          )}
        >
          {isEmpty ? '-' : value}
        </span>
      </td>
    );
  }

  return (
    <td className={cn('px-3 py-2', className)}>
      <input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            cancel();
          }
        }}
        className={cn('w-full', editInputClassName)}
      />
    </td>
  );
}

function NumberCell({
  value,
  onSave,
  step,
  className,
}: {
  value: number;
  onSave: (value: number) => void;
  step: string;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(String(value));
  }, [value, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const commit = () => {
    const n = Number(draft);
    if (Number.isFinite(n) && n >= 0 && n !== value) onSave(n);
    setEditing(false);
  };

  if (!editing) {
    return (
      <td className="px-3 py-2">
        <span
          role="button"
          tabIndex={0}
          onClick={() => setEditing(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setEditing(true);
            }
          }}
          className={cn(
            'block cursor-pointer rounded px-2 py-1 text-sm tabular-nums text-gray-700 hover:bg-brand-50',
            className,
          )}
        >
          {value}
        </span>
      </td>
    );
  }

  return (
    <td className="px-3 py-2">
      <input
        ref={inputRef}
        type="number"
        min="0"
        step={step}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            setDraft(String(value));
            setEditing(false);
          }
        }}
        className={cn(editInputClassName, className)}
      />
    </td>
  );
}

function MoneyCell({
  valueCents,
  onSave,
}: {
  valueCents: number;
  onSave: (value: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState((valueCents / 100).toString());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft((valueCents / 100).toString());
  }, [valueCents, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const commit = () => {
    const dollars = parseUnitCostDollarsInput(draft);
    if (dollars !== undefined) {
      const newCents = dollarsToCents(dollars);
      if (newCents !== valueCents) onSave(newCents);
    }
    setEditing(false);
  };

  if (!editing) {
    return (
      <td className="px-3 py-2">
        <span
          role="button"
          tabIndex={0}
          onClick={() => setEditing(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setEditing(true);
            }
          }}
          className="block cursor-pointer rounded px-2 py-1 text-sm tabular-nums text-gray-700 hover:bg-brand-50"
        >
          {formatMoney(cents(valueCents))}
        </span>
      </td>
    );
  }

  return (
    <td className="px-3 py-2">
      <div className="relative w-28">
        <span className="pointer-events-none absolute inset-y-0 left-2 flex items-center text-sm text-gray-400">
          $
        </span>
        <input
          ref={inputRef}
          type="number"
          min="0"
          step="0.01"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              setDraft((valueCents / 100).toString());
              setEditing(false);
            }
          }}
          className={cn('w-full py-1 pl-5 pr-2', editInputClassName)}
        />
      </div>
    </td>
  );
}

function QuantityCell({
  quantity,
  quantityUnit,
  onSaveQuantity,
  onSaveUnit,
}: {
  quantity: number;
  quantityUnit: string;
  onSaveQuantity: (value: number) => void;
  onSaveUnit: (value: string) => void;
}) {
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <td className="px-3 py-2">
        <span
          role="button"
          tabIndex={0}
          onClick={() => setEditing(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setEditing(true);
            }
          }}
          className="block w-40 cursor-pointer rounded px-2 py-1 text-sm tabular-nums text-gray-700 hover:bg-brand-50"
        >
          {quantity} {quantityUnit}
        </span>
      </td>
    );
  }

  return (
    <td className="px-3 py-2">
      <div
        className="flex w-40 gap-2"
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) {
            setEditing(false);
          }
        }}
      >
        <input
          type="number"
          min="0"
          step="0.01"
          defaultValue={quantity}
          autoFocus
          onChange={(event) => onNumberChange(event, onSaveQuantity)}
          className={cn('w-20', editInputClassName)}
          aria-label="Quantity"
        />
        <select
          value={quantityUnit}
          onChange={(event) => onSaveUnit(event.target.value)}
          className={cn('w-20', editInputClassName)}
          aria-label="Quantity unit"
        >
          {quantityUnits.map((unit) => (
            <option key={unit} value={unit}>
              {unit}
            </option>
          ))}
        </select>
      </div>
    </td>
  );
}

function TakeoffSwatchCell({ item }: { item: TakeoffItem }) {
  const [open, setOpen] = useState(false);
  const images = useImages('takeoff_swatch', item.id);
  const swatches = (images.data ?? []).slice(0, 4);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-24 w-20 items-center justify-center rounded-md border border-dashed border-gray-300 bg-white p-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
        aria-label="Edit take-off swatches"
      >
        {swatches.length > 0 ? (
          <div className="grid w-full gap-2">
            {swatches.map((image) => (
              <TakeoffSwatchThumbnail
                key={image.id}
                imageId={image.id}
                alt={image.altText || `${item.productTag || 'Take-Off'} swatch`}
                className="aspect-square w-full"
              />
            ))}
          </div>
        ) : (
          <span className="text-center text-xs font-medium text-gray-400">Add swatches</span>
        )}
      </button>
      <TakeoffSwatchModal
        open={open}
        item={item}
        onClose={() => setOpen(false)}
        legacySwatchCount={item.swatches.length}
      />
    </>
  );
}

function TakeoffSwatchModal({
  open,
  item,
  onClose,
  legacySwatchCount,
}: {
  open: boolean;
  item: TakeoffItem;
  onClose: () => void;
  legacySwatchCount: number;
}) {
  const images = useImages('takeoff_swatch', item.id);
  const upload = useUploadImage('takeoff_swatch', item.id);
  const deleteImage = useDeleteImage('takeoff_swatch', item.id);
  const slots = [...(images.data ?? [])].slice(0, 4);
  const [slotErrors, setSlotErrors] = useState<Record<number, string>>({});

  return (
    <Modal open={open} onClose={onClose} title="Take-Off swatches" className="max-w-3xl">
      <div className="grid gap-4">
        <p className="text-sm text-gray-600">
          Add up to four direct swatch images for this Take-Off item.
        </p>
        {legacySwatchCount > 0 && slots.length === 0 ? (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            This row still has legacy text swatches. Upload images here to replace them in the new
            export layout.
          </p>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((slot) => (
            <TakeoffSwatchSlot
              key={slot}
              image={slots[slot] ?? null}
              error={slotErrors[slot] ?? null}
              disabled={upload.isPending || deleteImage.isPending}
              onUpload={async (file, existingImageId) => {
                setSlotErrors((current) => ({ ...current, [slot]: '' }));
                try {
                  if (existingImageId) {
                    await deleteImage.mutateAsync(existingImageId);
                  }
                  await upload.mutateAsync({
                    file,
                    altText: `${item.productTag || 'Take-Off'} swatch ${slot + 1}`,
                  });
                } catch (err) {
                  const message =
                    err instanceof ApiError
                      ? ((err.body as { error?: string } | undefined)?.error ??
                        err.message ??
                        'Swatch upload failed')
                      : err instanceof Error
                        ? err.message
                        : 'Swatch upload failed';
                  setSlotErrors((current) => ({ ...current, [slot]: message }));
                }
              }}
              onDelete={(imageId) => void deleteImage.mutateAsync(imageId)}
            />
          ))}
        </div>
      </div>
    </Modal>
  );
}

function TakeoffSwatchSlot({
  image,
  error,
  disabled,
  onUpload,
  onDelete,
}: {
  image: { id: string; altText: string } | null;
  error: string | null;
  disabled: boolean;
  onUpload: (file: File, existingImageId: string | null) => void | Promise<void>;
  onDelete: (imageId: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="grid gap-2 rounded-lg border border-gray-200 bg-white p-3">
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className="flex aspect-square items-center justify-center overflow-hidden rounded-md border border-dashed border-gray-300 bg-surface-muted text-sm font-medium text-gray-500 hover:border-brand-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500 disabled:cursor-wait disabled:opacity-70"
        aria-label={image ? 'Update swatch image' : 'Upload swatch image'}
      >
        {image ? (
          <TakeoffSwatchThumbnail
            imageId={image.id}
            alt={image.altText || 'Take-Off swatch'}
            className="h-full w-full"
          />
        ) : (
          'Upload'
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void onUpload(file, image?.id ?? null);
          event.currentTarget.value = '';
        }}
      />
      {image ? (
        <div className="flex justify-end">
          <Button type="button" variant="ghost" size="sm" onClick={() => onDelete(image.id)}>
            Remove
          </Button>
        </div>
      ) : null}
      {error ? <p className="text-xs text-danger-600">{error}</p> : null}
    </div>
  );
}

function TakeoffSwatchThumbnail({
  imageId,
  alt,
  className,
}: {
  imageId: string;
  alt: string;
  className?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    let nextUrl: string | null = null;
    setUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });

    void api.images
      .getContentBlob(imageId)
      .then((blob: Blob) => {
        if (ignore) return;
        nextUrl = URL.createObjectURL(blob);
        setUrl(nextUrl);
      })
      .catch(() => {
        if (!ignore) setUrl(null);
      });

    return () => {
      ignore = true;
      if (nextUrl) URL.revokeObjectURL(nextUrl);
    };
  }, [imageId]);

  return url ? (
    <img
      src={url}
      alt={alt}
      className={cn('rounded-sm bg-[#f5f5f2] object-cover object-center', className)}
    />
  ) : (
    <div
      className={cn(
        'flex items-center justify-center rounded-sm bg-[#f5f5f2] text-[10px] font-semibold text-gray-400',
        className,
      )}
    >
      IMG
    </div>
  );
}

function SizeModal({
  item,
  open,
  onClose,
  onSave,
}: {
  item: TakeoffItem;
  open: boolean;
  onClose: () => void;
  onSave: (patch: Omit<UpdateTakeoffItemInput, 'version'>) => void;
}) {
  return (
    <DimensionEditorModal
      open={open}
      title="Set size"
      initial={{
        mode: item.sizeMode,
        unit: item.sizeUnit,
        w: item.sizeW,
        d: item.sizeD,
        h: item.sizeH,
      }}
      onClose={onClose}
      onSave={({ label, mode, unit, w, d, h }) =>
        onSave({
          sizeMode: mode,
          sizeUnit: unit,
          sizeW: w,
          sizeD: d,
          sizeH: h,
          sizeLabel: label,
        })
      }
    />
  );
}

function onNumberChange(event: ChangeEvent<HTMLInputElement>, onSave: (value: number) => void) {
  const value = Number(event.target.value);
  if (Number.isFinite(value) && value >= 0) onSave(value);
}
