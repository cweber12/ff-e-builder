import { useState, type ChangeEvent } from 'react';
import { Button, Modal } from './primitives';
import { ImageFrame } from './ImageFrame';
import {
  useCreateTakeoffCategory,
  useCreateTakeoffItem,
  useDeleteTakeoffCategory,
  useDeleteTakeoffItem,
  useTakeoffWithItems,
  useUpdateTakeoffCategory,
  useUpdateTakeoffItem,
} from '../hooks';
import {
  dollarsToCents,
  cents,
  formatMoney,
  parseUnitCostDollarsInput,
  type TakeoffItem,
  type SizeMode,
} from '../types';
import { takeoffCategorySubtotalCents, takeoffLineTotalCents } from '../lib/calc';
import type { UpdateTakeoffItemInput } from '../lib/api';

const quantityUnits = ['unit', 'sq ft', 'ln ft', 'sq yd', 'cu yd', 'each'] as const;
const metricUnits = ['mm', 'cm', 'm'] as const;

type TakeoffTableProps = {
  projectId: string;
};

type SizeDraft = {
  mode: SizeMode;
  w: string;
  d: string;
  h: string;
  unit: string;
};

export function TakeoffTable({ projectId }: TakeoffTableProps) {
  const { categoriesWithItems, isLoading } = useTakeoffWithItems(projectId);
  const createCategory = useCreateTakeoffCategory(projectId);
  const updateCategory = useUpdateTakeoffCategory(projectId);
  const deleteCategory = useDeleteTakeoffCategory(projectId);
  const updateItem = useUpdateTakeoffItem();
  const [newCategoryName, setNewCategoryName] = useState('');

  const addCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) return;
    await createCategory.mutateAsync({
      name,
      sortOrder: categoriesWithItems.length,
    });
    setNewCategoryName('');
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-gray-950">Take-Off Table</h2>
          <p className="mt-1 text-sm text-gray-600">
            Track quantities, sizes, swatches, drawings, and costs by take-off category.
          </p>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newCategoryName}
            onChange={(event) => setNewCategoryName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void addCategory();
            }}
            className="w-52 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            placeholder="Custom category"
            aria-label="Custom take-off category"
          />
          <Button type="button" variant="primary" onClick={() => void addCategory()}>
            Add category
          </Button>
        </div>
      </div>

      {categoriesWithItems.map((category) => (
        <TakeoffCategorySection
          key={category.id}
          projectId={projectId}
          categoryId={category.id}
          categoryName={category.name}
          items={category.items}
          subtotalCents={takeoffCategorySubtotalCents(category.items)}
          onCategoryNameSave={(name) =>
            updateCategory.mutate({ id: category.id, patch: { name: name.trim() } })
          }
          onCategoryDelete={() => deleteCategory.mutate(category.id)}
          onItemSave={(item, patch) => updateItem.mutate({ id: item.id, patch })}
        />
      ))}
    </div>
  );
}

function TakeoffCategorySection({
  categoryId,
  categoryName,
  items,
  subtotalCents,
  onCategoryNameSave,
  onCategoryDelete,
  onItemSave,
}: {
  projectId: string;
  categoryId: string;
  categoryName: string;
  items: TakeoffItem[];
  subtotalCents: number;
  onCategoryNameSave: (name: string) => void;
  onCategoryDelete: () => void;
  onItemSave: (item: TakeoffItem, patch: UpdateTakeoffItemInput) => void;
}) {
  const createItem = useCreateTakeoffItem(categoryId);
  const deleteItem = useDeleteTakeoffItem(categoryId);
  const [categoryDraft, setCategoryDraft] = useState(categoryName);

  return (
    <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-surface-muted px-4 py-3">
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={categoryDraft}
            onChange={(event) => setCategoryDraft(event.target.value)}
            onBlur={() => {
              if (categoryDraft.trim() && categoryDraft.trim() !== categoryName) {
                onCategoryNameSave(categoryDraft);
              }
            }}
            className="rounded-md border border-transparent bg-transparent px-2 py-1 text-lg font-semibold text-gray-950 focus:border-brand-500 focus:bg-white focus:outline-none"
            aria-label={`${categoryName} category name`}
          />
          <span className="text-sm font-medium text-gray-500">{items.length} rows</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-700">
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
            Add row
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onCategoryDelete}>
            Delete
          </Button>
        </div>
      </div>
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
    </section>
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
        <SwatchEditor item={item} onSave={(swatches) => onSave({ swatches })} />
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

function SwatchEditor({
  item,
  onSave,
}: {
  item: TakeoffItem;
  onSave: (swatches: string[]) => void;
}) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const next = draft.trim();
    if (!next) return;
    onSave([...item.swatches, next]);
    setDraft('');
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {item.swatches.map((swatch) => (
        <button
          key={swatch}
          type="button"
          title={`Remove ${swatch}`}
          onClick={() => onSave(item.swatches.filter((candidate) => candidate !== swatch))}
          className="rounded border border-gray-200 bg-surface-muted px-2 py-1 text-xs text-gray-700"
        >
          {swatch}
        </button>
      ))}
      <input
        type="text"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            add();
          }
        }}
        onBlur={add}
        className="w-24 rounded-md border border-gray-300 px-2 py-1 text-xs focus:border-brand-500 focus:outline-none"
        placeholder="Add"
        aria-label="Add swatch"
      />
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
  const [draft, setDraft] = useState<SizeDraft>({
    mode: item.sizeMode,
    w: item.sizeW,
    d: item.sizeD,
    h: item.sizeH,
    unit: item.sizeUnit,
  });

  const save = () => {
    const unit = draft.mode === 'imperial' ? 'ft/in' : draft.unit;
    const sizeLabel = [
      draft.w && `W ${draft.w}`,
      draft.d && `D ${draft.d}`,
      draft.h && `H ${draft.h}`,
    ]
      .filter(Boolean)
      .join(' x ');
    onSave({
      sizeMode: draft.mode,
      sizeW: draft.w,
      sizeD: draft.d,
      sizeH: draft.h,
      sizeUnit: unit,
      sizeLabel: sizeLabel ? `${sizeLabel} ${unit}` : '',
    });
  };

  return (
    <Modal open={open} onClose={onClose} title="Set size">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2 rounded-md bg-surface-muted p-1">
          {(['imperial', 'metric'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() =>
                setDraft((current) => ({
                  ...current,
                  mode,
                  unit: mode === 'imperial' ? 'ft/in' : 'mm',
                }))
              }
              className={`rounded px-3 py-2 text-sm font-medium ${
                draft.mode === mode ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-600'
              }`}
            >
              {mode === 'imperial' ? 'Imperial' : 'Metric'}
            </button>
          ))}
        </div>
        {draft.mode === 'metric' && (
          <select
            value={draft.unit}
            onChange={(event) => setDraft((current) => ({ ...current, unit: event.target.value }))}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            aria-label="Metric unit"
          >
            {metricUnits.map((unit) => (
              <option key={unit} value={unit}>
                {unit}
              </option>
            ))}
          </select>
        )}
        <div className="grid gap-3 sm:grid-cols-3">
          {(['w', 'd', 'h'] as const).map((field) => (
            <label key={field} className="flex flex-col gap-1 text-sm font-medium text-gray-700">
              {field.toUpperCase()}
              <input
                type="text"
                value={draft[field]}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, [field]: event.target.value }))
                }
                className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                placeholder={draft.mode === 'imperial' ? '4 ft 6 1/2 in' : '1200'}
              />
            </label>
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" variant="primary" onClick={save}>
            Save size
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function onNumberChange(event: ChangeEvent<HTMLInputElement>, onSave: (value: number) => void) {
  const value = Number(event.target.value);
  if (Number.isFinite(value) && value >= 0) onSave(value);
}
