import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import type { CreateItemInput, CreateMaterialInput } from '../lib/api';
import {
  itemFormSchema,
  parseMarkupPctInput,
  parseQtyInput,
  parseUnitCostDollarsInput,
  unitCostDollarsToCents,
  type ItemFormValues,
} from '../types';
import { emptyToNull } from '../lib/textUtils';
import type { Material } from '../types';
import { MaterialLibraryModal, MaterialSwatchImage } from './materials/MaterialLibraryModal';
import { Button, Drawer } from './primitives';

export type AddItemMaterialSelection =
  | { type: 'existing'; materialId: string }
  | { type: 'new'; input: CreateMaterialInput };

interface AddItemDrawerProps {
  open: boolean;
  projectId: string;
  roomId: string;
  roomName: string;
  existingCategories: string[];
  existingMaterials?: Material[];
  priorityMaterialIds?: string[] | undefined;
  onClose: () => void;
  onSubmit: (input: CreateItemInput, materials: AddItemMaterialSelection[]) => Promise<void> | void;
}

const defaultValues: ItemFormValues = {
  itemName: '',
  category: '',
  itemIdTag: '',
  vendor: '',
  dimensions: '',
  seatHeight: '',
  qty: '1',
  unitCost: '0',
  markupPct: '0',
  finishes: '',
  notes: '',
  imageUrl: '',
  linkUrl: '',
};

const typicalCategories = [
  'Seating',
  'Tables',
  'Lighting',
  'Casegoods',
  'Beds',
  'Rugs',
  'Window Treatments',
  'Artwork',
  'Accessories',
  'Plumbing',
  'Appliances',
  'Hardware',
];

export function AddItemDrawer({
  open,
  projectId,
  roomId,
  roomName,
  existingCategories,
  existingMaterials = [],
  priorityMaterialIds = [],
  onClose,
  onSubmit,
}: AddItemDrawerProps) {
  const [materialName, setMaterialName] = useState('');
  const [materialLibraryOpen, setMaterialLibraryOpen] = useState(false);
  const [selectedMaterials, setSelectedMaterials] = useState<AddItemMaterialSelection[]>([]);
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ItemFormValues>({
    resolver: zodResolver(itemFormSchema),
    defaultValues,
  });

  const categoryOptions = useMemo(
    () =>
      Array.from(new Set([...typicalCategories, ...existingCategories].filter(Boolean))).sort(
        (a, b) => a.localeCompare(b),
      ),
    [existingCategories],
  );

  useEffect(() => {
    if (open) {
      reset(defaultValues);
      setMaterialName('');
      setMaterialLibraryOpen(false);
      setSelectedMaterials([]);
    }
  }, [open, reset]);

  const selectedMaterialIds = useMemo(
    () =>
      new Set(
        selectedMaterials
          .filter(
            (material): material is { type: 'existing'; materialId: string } =>
              material.type === 'existing',
          )
          .map((material) => material.materialId),
      ),
    [selectedMaterials],
  );

  const addMaterial = () => {
    const name = materialName.trim();
    if (!name) return;

    const existing = existingMaterials.find(
      (material) => material.name.toLowerCase() === name.toLowerCase(),
    );
    if (existing) {
      if (!selectedMaterialIds.has(existing.id)) {
        setSelectedMaterials((current) => [
          ...current,
          { type: 'existing', materialId: existing.id },
        ]);
      }
    } else if (
      !selectedMaterials.some(
        (material) =>
          material.type === 'new' && material.input.name.toLowerCase() === name.toLowerCase(),
      )
    ) {
      setSelectedMaterials((current) => [
        ...current,
        {
          type: 'new',
          input: {
            name,
          },
        },
      ]);
    }
    setMaterialName('');
  };

  const removeMaterial = (index: number) => {
    setSelectedMaterials((current) =>
      current.filter((_material, materialIndex) => materialIndex !== index),
    );
  };

  const submit = handleSubmit(async (values) => {
    const qty = parseQtyInput(values.qty) ?? 1;
    const unitCostDollars = parseUnitCostDollarsInput(values.unitCost) ?? 0;
    const markupPct = parseMarkupPctInput(values.markupPct) ?? 0;

    await onSubmit(
      {
        itemName: values.itemName.trim(),
        category: emptyToNull(values.category),
        itemIdTag: emptyToNull(values.itemIdTag),
        vendor: emptyToNull(values.vendor),
        dimensions: emptyToNull(values.dimensions),
        seatHeight: emptyToNull(values.seatHeight),
        qty,
        unitCostCents: unitCostDollarsToCents(unitCostDollars),
        markupPct,
        finishes: emptyToNull(values.finishes),
        notes: emptyToNull(values.notes),
        imageUrl: emptyToNull(values.imageUrl),
        linkUrl: emptyToNull(values.linkUrl),
      },
      selectedMaterials,
    );
    onClose();
  });

  return (
    <Drawer open={open} onClose={onClose} title={`Add item to ${roomName}`} className="max-w-xl">
      <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
        <Field label="Item name" error={errors.itemName?.message}>
          <input {...register('itemName')} className={inputClassName} />
        </Field>

        <Field label="Category" error={errors.category?.message}>
          <input
            {...register('category')}
            list="item-category-options"
            className={inputClassName}
          />
          <datalist id="item-category-options">
            {categoryOptions.map((category) => (
              <option key={category} value={category} />
            ))}
          </datalist>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
            {categoryOptions.map((category) => (
              <button
                key={category}
                type="button"
                className="text-xs font-medium text-brand-700 underline-offset-2 hover:underline focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
                onClick={() => setValue('category', category, { shouldDirty: true })}
              >
                {category}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Item ID/tag" error={errors.itemIdTag?.message}>
          <input {...register('itemIdTag')} className={inputClassName} />
        </Field>

        <Field label="Vendor/manufacturer" error={errors.vendor?.message}>
          <input {...register('vendor')} className={inputClassName} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Dimensions" error={errors.dimensions?.message}>
            <input {...register('dimensions')} className={inputClassName} />
          </Field>
          <Field label="Seat height" error={errors.seatHeight?.message}>
            <input {...register('seatHeight')} className={inputClassName} />
          </Field>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Field label="Qty" error={errors.qty?.message}>
            <input
              {...register('qty')}
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              className={inputClassName}
            />
          </Field>
          <Field label="Unit cost" error={errors.unitCost?.message}>
            <input {...register('unitCost')} inputMode="decimal" className={inputClassName} />
          </Field>
          <Field label="Markup %" error={errors.markupPct?.message}>
            <input {...register('markupPct')} inputMode="decimal" className={inputClassName} />
          </Field>
        </div>

        <Field label="Finishes" error={errors.finishes?.message}>
          <textarea {...register('finishes')} rows={3} className={inputClassName} />
        </Field>

        <Field label="Materials">
          <div className="flex flex-wrap gap-2">
            <input
              value={materialName}
              list="item-material-options"
              onChange={(event) => setMaterialName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  addMaterial();
                }
              }}
              className={`${inputClassName} min-w-0 flex-1`}
            />
            <datalist id="item-material-options">
              {existingMaterials.map((material) => (
                <option key={material.id} value={material.name} />
              ))}
            </datalist>
            <Button type="button" variant="secondary" onClick={addMaterial}>
              Select
            </Button>
            <Button type="button" variant="ghost" onClick={() => setMaterialLibraryOpen(true)}>
              Add material
            </Button>
          </div>
          {selectedMaterials.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {selectedMaterials.map((selection, index) => {
                const material =
                  selection.type === 'existing'
                    ? existingMaterials.find((candidate) => candidate.id === selection.materialId)
                    : undefined;
                const name =
                  material?.name ?? (selection.type === 'new' ? selection.input.name : '');
                return (
                  <span
                    key={`${selection.type}-${name}-${index}`}
                    className="inline-flex items-center gap-1.5 rounded-pill border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-700"
                  >
                    {material ? (
                      <MaterialSwatchImage material={material} size="sm" />
                    ) : (
                      <span className="h-6 w-6 rounded-full border border-gray-200 bg-surface-muted" />
                    )}
                    <span>{name}</span>
                    {selection.type === 'new' && (
                      <span className="rounded-pill bg-brand-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-700">
                        New
                      </span>
                    )}
                    <button
                      type="button"
                      className="rounded-sm px-1 text-gray-400 hover:text-danger-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
                      onClick={() => removeMaterial(index)}
                      aria-label={`Remove ${name}`}
                    >
                      x
                    </button>
                  </span>
                );
              })}
            </div>
          )}
        </Field>

        <Field label="Notes" error={errors.notes?.message}>
          <textarea {...register('notes')} rows={4} className={inputClassName} />
        </Field>

        <Field label="Image URL" error={errors.imageUrl?.message}>
          <input {...register('imageUrl')} type="url" className={inputClassName} />
        </Field>

        <Field label="Link URL" error={errors.linkUrl?.message}>
          <input {...register('linkUrl')} type="url" className={inputClassName} />
        </Field>

        <div className="sticky bottom-0 -mx-6 mt-2 flex justify-end gap-2 border-t border-gray-100 bg-white px-6 py-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            Add item
          </Button>
        </div>
      </form>
      <MaterialLibraryModal
        open={materialLibraryOpen}
        projectId={projectId}
        roomId={roomId}
        priorityMaterialIds={priorityMaterialIds}
        onClose={() => setMaterialLibraryOpen(false)}
      />
    </Drawer>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string | undefined;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
      {label}
      {children}
      {error && <span className="text-xs font-normal text-danger-600">{error}</span>}
    </label>
  );
}

const inputClassName =
  'w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-normal text-gray-950 focus:border-brand-500 focus:outline-none';
