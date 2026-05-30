import type { CreateProposalItemInput } from '../../../lib/api';
import type { ProposalItem } from '../../../types';

export function buildProposalItemDuplicateInput(item: ProposalItem): CreateProposalItemInput {
  const duplicate: CreateProposalItemInput = {
    productTag: item.productTag,
    description: item.description,
    plan: item.plan,
    drawings: item.drawings,
    location: item.location,
    sizeLabel: item.sizeLabel,
    sizeMode: item.sizeMode,
    sizeUnit: item.sizeUnit,
    sizeW: item.sizeW,
    sizeD: item.sizeD,
    sizeH: item.sizeH,
    footprintLabel: item.footprintLabel,
    footprintW: item.footprintW,
    footprintD: item.footprintD,
    footprintUnit: item.footprintUnit,
    footprintArea: item.footprintArea,
    cbm: item.cbm,
    quantity: item.quantity,
    quantityUnit: item.quantityUnit,
    unitCostCents: item.unitCostCents,
    sortOrder: item.sortOrder + 0.5,
  };

  if (Object.keys(item.customData).length > 0) {
    duplicate.customData = item.customData;
  }

  return duplicate;
}

export function proposalItemDisplayName(
  item: Pick<ProposalItem, 'itemName' | 'productTag' | 'description'>,
  fallback = 'Item',
): string {
  return item.itemName || item.productTag || item.description || fallback;
}

export function proposalItemLocationName(item: Pick<ProposalItem, 'location'>): string {
  return item.location || 'Unassigned';
}
