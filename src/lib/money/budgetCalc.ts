import type { Item } from '../../types/item';
import type { ProposalCategoryWithItems, ProposalItem } from '../../types/proposal';

/** Total cost for a line (unit cost × qty). */
export const lineTotalCents = (unitCostCents: number, qty: number): number => unitCostCents * qty;

/** Sum of all line totals in a room. */
export const roomSubtotalCents = (items: Item[]): number =>
  items.reduce((sum, i) => sum + lineTotalCents(i.unitCostCents, i.qty), 0);

/** Sum of all room subtotals across a project. */
export const projectTotalCents = (roomsWithItems: { items: Item[] }[]): number =>
  roomsWithItems.reduce((sum, r) => sum + roomSubtotalCents(r.items), 0);

export const proposalLineTotalCents = (item: ProposalItem): number =>
  Math.round(item.unitCostCents * item.quantity);

export const proposalCategorySubtotalCents = (items: ProposalItem[]): number =>
  items.reduce((sum, item) => sum + proposalLineTotalCents(item), 0);

export const proposalProjectTotalCents = (categories: ProposalCategoryWithItems[]): number =>
  categories.reduce((sum, category) => sum + proposalCategorySubtotalCents(category.items), 0);
