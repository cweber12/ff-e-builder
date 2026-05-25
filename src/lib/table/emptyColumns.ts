import type { CustomColumnDef, Item, ProposalItem } from '../../types';

function isBlankString(value: string | null | undefined): boolean {
  return !value || value.trim() === '';
}

/**
 * IDs of proposal columns that have no data across any of the given items.
 * Image columns (rendering) are excluded because their data is loaded
 * asynchronously and isn't known at table-mount time.
 */
export function emptyProposalColumnIds(
  items: readonly ProposalItem[],
  customColumnDefs: readonly CustomColumnDef[] = [],
): string[] {
  if (items.length === 0) return [];
  const empty: string[] = [];
  const anyHas = (predicate: (item: ProposalItem) => boolean) => items.some(predicate);

  if (!anyHas((item) => !isBlankString(item.itemName))) empty.push('itemName');
  if (!anyHas((item) => !isBlankString(item.plan))) empty.push('plan');
  if (!anyHas((item) => !isBlankString(item.drawings))) empty.push('drawings');
  if (!anyHas((item) => !isBlankString(item.location))) empty.push('location');
  if (!anyHas((item) => !isBlankString(item.description))) empty.push('description');
  if (!anyHas((item) => !isBlankString(item.notes))) empty.push('notes');
  if (!anyHas((item) => !isBlankString(item.sizeLabel))) empty.push('size');
  if (!anyHas((item) => item.materials.length > 0)) empty.push('swatch');
  if (!anyHas((item) => item.cbm > 0)) empty.push('cbm');

  for (const def of customColumnDefs) {
    if (!anyHas((item) => !isBlankString(item.customData[def.id] ?? ''))) empty.push(def.id);
  }

  return empty;
}

/**
 * IDs of FFE columns that have no data across any of the given items.
 * Image columns (image, plan) are excluded for the same reason as proposal,
 * and required columns (itemName, qty, unitCostCents, lineTotal, status,
 * drag, actions) are never auto-hidden.
 */
export function emptyFfeColumnIds(
  items: readonly Item[],
  customColumnDefs: readonly CustomColumnDef[] = [],
): string[] {
  if (items.length === 0) return [];
  const empty: string[] = [];
  const anyHas = (predicate: (item: Item) => boolean) => items.some(predicate);

  if (!anyHas((item) => !isBlankString(item.itemIdTag))) empty.push('itemIdTag');
  if (!anyHas((item) => !isBlankString(item.drawings))) empty.push('drawings');
  if (!anyHas((item) => !isBlankString(item.description))) empty.push('description');
  if (!anyHas((item) => !isBlankString(item.dimensions))) empty.push('dimensions');
  if (!anyHas((item) => item.materials.length > 0)) empty.push('materials');
  if (!anyHas((item) => !isBlankString(item.category))) empty.push('category');
  if (!anyHas((item) => !isBlankString(item.leadTime))) empty.push('leadTime');
  if (!anyHas((item) => !isBlankString(item.notes))) empty.push('notes');

  for (const def of customColumnDefs) {
    if (!anyHas((item) => !isBlankString(item.customData[def.id] ?? ''))) empty.push(def.id);
  }

  return empty;
}
