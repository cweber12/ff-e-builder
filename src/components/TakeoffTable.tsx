import { useMemo, useState, type ChangeEvent } from 'react';
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
  useMaterials,
} from '../hooks';
import {
  dollarsToCents,
  cents,
  formatMoney,
  parseUnitCostDollarsInput,
  type TakeoffItem,
  type Material,
} from '../types';
import {
  takeoffCategorySubtotalCents,
  takeoffLineTotalCents,
  takeoffProjectTotalCents,
} from '../lib/calc';
import type { UpdateTakeoffItemInput } from '../lib/api';
import { DimensionEditorModal } from './DimensionEditorModal';
import {
  GroupedTableHeader,
  GroupedTableSection,
  StickyGrandTotal,
  TableViewStack,
} from './TableViewWrappers';
import { MaterialSwatchImage } from './MaterialLibraryModal';

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
  const [newCategoryName, setNewCategoryName] = useState('');
  const grandTotal = takeoffProjectTotalCents(categoriesWithItems);

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
    <TableViewStack>
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

      <StickyGrandTotal value={formatMoney(cents(grandTotal))} />
    </TableViewStack>
  );
}

function TakeoffCategorySection({
  projectId,
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
    <GroupedTableSection>
      <GroupedTableHeader className="flex-wrap gap-3">
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
      </GroupedTableHeader>
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
