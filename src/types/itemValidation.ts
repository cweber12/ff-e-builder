import { z } from 'zod';
import { dollarsToCents } from './project';

export const itemStatuses = ['pending', 'ordered', 'approved', 'received'] as const;

export const ItemStatusSchema = z.enum(itemStatuses);
export type ItemStatus = z.infer<typeof ItemStatusSchema>;

const nullableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value.length > 0 ? value : null));

export const itemNameSchema = z.string().trim().min(1, 'Name is required').max(255);
export const itemQtySchema = z
  .number()
  .int('Quantity must be a whole number')
  .min(0, 'Quantity must be 0 or greater');
export const itemUnitCostCentsSchema = z
  .number()
  .int('Unit cost must resolve to whole cents')
  .min(0, 'Unit cost must be 0 or greater');

export const editableItemPatchSchema = z.object({
  roomId: z.string().min(1).optional(),
  itemName: itemNameSchema.optional(),
  description: nullableText(4000).optional(),
  category: nullableText(100).optional(),
  itemIdTag: nullableText(100).optional(),
  dimensions: nullableText(100).optional(),
  notes: nullableText(2000).optional(),
  qty: itemQtySchema.optional(),
  unitCostCents: itemUnitCostCentsSchema.optional(),
  leadTime: nullableText(100).optional(),
  status: ItemStatusSchema.optional(),
  customData: z.record(z.string().uuid(), z.string().max(2000)).optional(),
});

export const itemFormSchema = z.object({
  itemName: itemNameSchema,
  description: z.string().trim().max(4000).default(''),
  category: z.string().trim().max(100).default(''),
  itemIdTag: z.string().trim().max(100).default(''),
  dimensions: z.string().trim().max(100).default(''),
  qty: z.string().refine((value) => parseQtyInput(value) !== undefined, {
    message: 'Quantity must be a whole number 0 or greater',
  }),
  unitCost: z.string().refine((value) => parseUnitCostDollarsInput(value) !== undefined, {
    message: 'Unit cost must be 0 or greater with max 2 decimals',
  }),
  notes: z.string().trim().default(''),
});

export type ItemFormValues = z.infer<typeof itemFormSchema>;

const normalizeDecimalInput = (raw: string) => raw.trim().replace(/[$,%\s,]/g, '');

export function parseQtyInput(raw: string): number | undefined {
  const normalized = normalizeDecimalInput(raw);
  if (!/^\d+$/.test(normalized)) return undefined;
  const parsed = Number(normalized);
  return itemQtySchema.safeParse(parsed).success ? parsed : undefined;
}

export function parseUnitCostDollarsInput(raw: string): number | undefined {
  const normalized = normalizeDecimalInput(raw);
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return undefined;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function unitCostDollarsToCents(dollars: number): number {
  return itemUnitCostCentsSchema.parse(dollarsToCents(dollars));
}
