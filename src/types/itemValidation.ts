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

export const itemNameSchema = z.string().trim().min(1, 'Item name is required').max(255);
export const itemQtySchema = z
  .number()
  .int('Quantity must be a whole number')
  .min(0, 'Quantity must be 0 or greater');
export const itemUnitCostCentsSchema = z
  .number()
  .int('Unit cost must resolve to whole cents')
  .min(0, 'Unit cost must be 0 or greater');
export const itemMarkupPctSchema = z
  .number()
  .min(0, 'Markup must be 0 or greater')
  .max(999.99, 'Markup must be 999.99 or less');

export const editableItemPatchSchema = z.object({
  itemName: itemNameSchema.optional(),
  category: nullableText(100).optional(),
  vendor: nullableText(255).optional(),
  model: nullableText(255).optional(),
  itemIdTag: nullableText(100).optional(),
  dimensions: nullableText(100).optional(),
  notes: z
    .string()
    .trim()
    .transform((value) => (value.length > 0 ? value : null))
    .optional(),
  qty: itemQtySchema.optional(),
  unitCostCents: itemUnitCostCentsSchema.optional(),
  markupPct: itemMarkupPctSchema.optional(),
  leadTime: nullableText(100).optional(),
  status: ItemStatusSchema.optional(),
});

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

export function parseMarkupPctInput(raw: string): number | undefined {
  const normalized = normalizeDecimalInput(raw);
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return undefined;
  const parsed = Number(normalized);
  return itemMarkupPctSchema.safeParse(parsed).success ? parsed : undefined;
}

export function unitCostDollarsToCents(dollars: number): number {
  return itemUnitCostCentsSchema.parse(dollarsToCents(dollars));
}
