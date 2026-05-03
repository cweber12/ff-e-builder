import type { Item } from '../types/item';
import type { TakeoffCategoryWithItems, TakeoffItem } from '../types/takeoff';

/**
 * Sell price for a single unit after markup.
 * Rounds to the nearest cent using integer math.
 */
export const sellPriceCents = (unitCostCents: number, markupPct: number): number =>
  Math.round(unitCostCents * (1 + markupPct / 100));

/** Total sell price for a line (sell price × qty). */
export const lineTotalCents = (unitCostCents: number, markupPct: number, qty: number): number =>
  sellPriceCents(unitCostCents, markupPct) * qty;

/** Sum of all line totals in a room. */
export const roomSubtotalCents = (items: Item[]): number =>
  items.reduce((sum, i) => sum + lineTotalCents(i.unitCostCents, i.markupPct, i.qty), 0);

/** Sum of all room subtotals across a project. */
export const projectTotalCents = (roomsWithItems: { items: Item[] }[]): number =>
  roomsWithItems.reduce((sum, r) => sum + roomSubtotalCents(r.items), 0);

export const takeoffLineTotalCents = (item: TakeoffItem): number =>
  Math.round(item.unitCostCents * item.quantity);

export const takeoffCategorySubtotalCents = (items: TakeoffItem[]): number =>
  items.reduce((sum, item) => sum + takeoffLineTotalCents(item), 0);

export const takeoffProjectTotalCents = (categories: TakeoffCategoryWithItems[]): number =>
  categories.reduce((sum, category) => sum + takeoffCategorySubtotalCents(category.items), 0);
