import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Button, Modal } from '../../primitives';
import { ImageFrame } from '../../shared/ImageFrame';
import {
  useCreateTakeoffCategory,
  useCreateTakeoffItem,
  useDeleteTakeoffCategory,
  useDeleteTakeoffItem,
  useTakeoffWithItems,
  useUpdateTakeoffCategory,
  useUpdateTakeoffItem,
  useMaterials,
} from '../../../hooks';
import {
  dollarsToCents,
  cents,
  formatMoney,
  parseUnitCostDollarsInput,
  type TakeoffItem,
  type Material,
} from '../../../types';
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
import { MaterialSwatchImage } from '../../materials/MaterialLibraryModal';
import { AddGroupModal } from '../../shared/AddGroupModal';
import { InlineTextEdit } from '../../primitives/InlineTextEdit';
import { cn } from '../../../lib/cn';

const quantityUnits = ['unit', 'sq ft', 'ln ft', 'sq yd', 'cu yd', 'each'] as const;

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
      <div className="flex justify-start">
        <Button type="button" variant="secondary" onClick={() => setAddCategoryOpen(true)}>
          Add category
        </Button>
      </div>

      {categoriesWithItems.map((category) => (
        <TakeoffCategorySection
          key={category.id}
          projectId={projectId}
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
  projectId,
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
  projectId: string;
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
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() =>
              createItem.mutate({
                sortOrder: items.length,
                productTag: `${categoryName.slice(0, 2).toUpperCase()}-${items.length + 1}`,
              })
            }
          >
            Add item
          </Button>
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
                  projectId={projectId}
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
                      projectId={projectId}
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
  projectId,
  onSave,
  onDelete,
}: {
  item: TakeoffItem;
  projectId: string;
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
      <EditableCell value={item.plan} onSave={(plan) => onSave({ plan })} />
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
          className="min-h-9 w-40 rounded-md border border-gray-200 px-2 py-1 text-left text-sm text-gray-700 hover:border-brand-500 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
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
      <td className="min-w-48 px-3 py-2">
        <TakeoffMaterialCell
          projectId={projectId}
          item={item}
          onSave={(swatches) => onSave({ swatches })}
        />
      </td>
      <NumberCell
        value={item.cbm}
        step="0.001"
        onSave={(cbm) => onSave({ cbm })}
        className="w-24"
      />
      <td className="px-3 py-2">
        <div className="flex w-40 gap-2">
          <input
            type="number"
            min="0"
            step="0.01"
            value={item.quantity}
            onChange={(event) => onNumberChange(event, (quantity) => onSave({ quantity }))}
            className="w-20 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-brand-500 focus:outline-none"
            aria-label="Quantity"
          />
          <select
            value={item.quantityUnit}
            onChange={(event) => onSave({ quantityUnit: event.target.value })}
            className="w-20 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-brand-500 focus:outline-none"
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
  const [draft, setDraft] = useState(value);
  return (
    <td className={`px-3 py-2 ${className ?? ''}`}>
      <input
        type="text"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          if (draft !== value) onSave(draft);
        }}
        className="w-full rounded-md border border-transparent px-2 py-1 text-sm text-gray-700 focus:border-brand-500 focus:bg-white focus:outline-none"
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
  return (
    <td className="px-3 py-2">
      <input
        type="number"
        min="0"
        step={step}
        value={value}
        onChange={(event) => onNumberChange(event, onSave)}
        className={`rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-brand-500 focus:outline-none ${className ?? ''}`}
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
  const [draft, setDraft] = useState((valueCents / 100).toString());
  return (
    <td className="px-3 py-2">
      <div className="relative w-28">
        <span className="pointer-events-none absolute inset-y-0 left-2 flex items-center text-sm text-gray-400">
          $
        </span>
        <input
          type="number"
          min="0"
          step="0.01"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => {
            const dollars = parseUnitCostDollarsInput(draft);
            if (dollars !== undefined) onSave(dollarsToCents(dollars));
          }}
          className="w-full rounded-md border border-gray-300 py-1 pl-5 pr-2 text-sm focus:border-brand-500 focus:outline-none"
        />
      </div>
    </td>
  );
}

function TakeoffMaterialCell({
  projectId,
  item,
  onSave,
}: {
  projectId: string;
  item: TakeoffItem;
  onSave: (swatches: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const materials = useMaterials(projectId);
  const assignedMaterials = useMemo(
    () =>
      (materials.data ?? []).filter((material) =>
        item.swatches.some(
          (swatch) =>
            swatch.toLowerCase() === material.name.toLowerCase() ||
            swatch.toLowerCase() === material.materialId.toLowerCase(),
        ),
      ),
    [item.swatches, materials.data],
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex max-w-60 flex-wrap gap-1 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
        aria-label="Edit take-off materials"
      >
        {assignedMaterials.length > 0 ? (
          assignedMaterials.map((material) => (
            <span
              key={material.id}
              className="inline-flex max-w-full items-center gap-1 rounded-pill border border-gray-200 bg-white px-2 py-0.5 text-xs font-medium text-gray-700"
            >
              <MaterialSwatchImage material={material} size="sm" />
              <span className="truncate">{material.name}</span>
            </span>
          ))
        ) : item.swatches.length ? (
          item.swatches.map((swatch) => (
            <span
              key={swatch}
              className="rounded-pill border border-gray-200 bg-white px-2 py-0.5 text-xs font-medium text-gray-700"
            >
              {swatch}
            </span>
          ))
        ) : (
          <span className="text-gray-400">Add materials</span>
        )}
      </button>
      <TakeoffMaterialModal
        open={open}
        materials={materials.data ?? []}
        selected={item.swatches}
        onClose={() => setOpen(false)}
        onSave={(swatches) => {
          setOpen(false);
          onSave(swatches);
        }}
      />
    </>
  );
}

function TakeoffMaterialModal({
  open,
  materials,
  selected,
  onClose,
  onSave,
}: {
  open: boolean;
  materials: Material[];
  selected: string[];
  onClose: () => void;
  onSave: (swatches: string[]) => void;
}) {
  const [draft, setDraft] = useState<string[]>(selected);

  const toggle = (material: Material) => {
    setDraft((current) =>
      current.some((name) => name.toLowerCase() === material.name.toLowerCase())
        ? current.filter((name) => name.toLowerCase() !== material.name.toLowerCase())
        : [...current, material.name],
    );
  };

  return (
    <Modal open={open} onClose={onClose} title="Take-off materials" className="max-w-3xl">
      <div className="grid gap-4">
        <p className="text-sm text-gray-600">
          Select from the shared project material library. Materials remain accessible from both
          FF&E and Take-Off.
        </p>
        <div className="grid max-h-[28rem] gap-3 overflow-y-auto sm:grid-cols-2 md:grid-cols-3">
          {materials.map((material) => {
            const checked = draft.some(
              (name) => name.toLowerCase() === material.name.toLowerCase(),
            );
            return (
              <button
                key={material.id}
                type="button"
                onClick={() => toggle(material)}
                className={`grid gap-2 rounded-lg border p-3 text-left transition ${
                  checked
                    ? 'border-brand-500 bg-brand-50'
                    : 'border-gray-200 bg-white hover:border-brand-400'
                }`}
              >
                <ImageFrame
                  entityType="material"
                  entityId={material.id}
                  alt={material.name}
                  className="h-24 w-full rounded-md border-gray-200 shadow-none"
                  compact
                  disabled
                />
                <span className="text-sm font-semibold text-gray-950">{material.name}</span>
                <span className="text-xs text-gray-500">
                  {material.materialId || 'No material ID'}
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={() => onSave(draft)}>
            Save materials
          </Button>
        </div>
      </div>
    </Modal>
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
