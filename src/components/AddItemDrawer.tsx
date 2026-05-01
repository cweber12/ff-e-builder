import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import type { CreateItemInput } from '../lib/api';
import {
  itemFormSchema,
  parseMarkupPctInput,
  parseQtyInput,
  parseUnitCostDollarsInput,
  unitCostDollarsToCents,
  type ItemFormValues,
} from '../types';
import { emptyToNull } from '../lib/textUtils';
import { Button, Drawer } from './primitives';

interface AddItemDrawerProps {
  open: boolean;
  roomName: string;
  existingCategories: string[];
  onClose: () => void;
  onSubmit: (input: CreateItemInput) => Promise<void> | void;
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

export function AddItemDrawer({
  open,
  roomName,
  existingCategories,
  onClose,
  onSubmit,
}: AddItemDrawerProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ItemFormValues>({
    resolver: zodResolver(itemFormSchema),
    defaultValues,
  });

  useEffect(() => {
    if (open) reset(defaultValues);
  }, [open, reset]);

  const submit = handleSubmit(async (values) => {
    const qty = parseQtyInput(values.qty) ?? 1;
    const unitCostDollars = parseUnitCostDollarsInput(values.unitCost) ?? 0;
    const markupPct = parseMarkupPctInput(values.markupPct) ?? 0;

    await onSubmit({
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
    });
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
            {existingCategories.map((category) => (
              <option key={category} value={category} />
            ))}
          </datalist>
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
            <input {...register('qty')} inputMode="numeric" className={inputClassName} />
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
