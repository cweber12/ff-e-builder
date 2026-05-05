import type { Item } from '../types/item';
import type { ProposalCategoryWithItems, ProposalItem } from '../types/proposal';

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

export const proposalLineTotalCents = (item: ProposalItem): number =>
  Math.round(item.unitCostCents * item.quantity);

export const proposalCategorySubtotalCents = (items: ProposalItem[]): number =>
  items.reduce((sum, item) => sum + proposalLineTotalCents(item), 0);

export const proposalProjectTotalCents = (categories: ProposalCategoryWithItems[]): number =>
  categories.reduce((sum, category) => sum + proposalCategorySubtotalCents(category.items), 0);
