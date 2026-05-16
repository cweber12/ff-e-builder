import {
  cents,
  formatMoney,
  type CustomColumnDef,
  type Item,
  type ProposalItem,
} from '../../types';
import type { UpdateItemInput, UpdateProposalItemInput } from '../api';
import { GENERATED_ITEM_CHANGE_FIELDS } from './generatedItemChangeFields';

export type GeneratedItemChangeInfo = {
  columnKey: string;
  columnLabel: string;
  previousValue: string;
  newValue: string;
  isPriceAffecting: boolean;
};

export type FfeGeneratedItemPatch = Omit<UpdateItemInput, 'version'>;
export type ProposalGeneratedItemPatch = Omit<UpdateProposalItemInput, 'version'>;

export function ffePatchToGeneratedItemChangeInfo(
  patch: FfeGeneratedItemPatch,
  item: Item,
): GeneratedItemChangeInfo | null {
  const changeFields = GENERATED_ITEM_CHANGE_FIELDS.ffe;
  if ('itemName' in patch && patch.itemName != null) {
    return {
      ...changeFields.itemName,
      previousValue: item.itemName,
      newValue: patch.itemName,
    };
  }
  if ('itemIdTag' in patch) {
    return {
      ...changeFields.itemIdTag,
      previousValue: item.itemIdTag ?? '',
      newValue: patch.itemIdTag ?? '',
    };
  }
  if ('notes' in patch) {
    return {
      ...changeFields.notes,
      previousValue: item.notes ?? '',
      newValue: patch.notes ?? '',
    };
  }
  if ('dimensions' in patch) {
    return {
      ...changeFields.dimensions,
      previousValue: item.dimensions ?? '',
      newValue: patch.dimensions ?? '',
    };
  }
  if ('qty' in patch && patch.qty != null) {
    return {
      ...changeFields.qty,
      previousValue: String(item.qty),
      newValue: String(patch.qty),
    };
  }
  if ('unitCostCents' in patch && patch.unitCostCents != null) {
    return {
      ...changeFields.unitCostCents,
      previousValue: formatMoney(cents(item.unitCostCents)),
      newValue: formatMoney(cents(patch.unitCostCents)),
    };
  }
  return null;
}

function formatProposalSizeDisplay(item: {
  sizeW?: string;
  sizeD?: string;
  sizeH?: string;
  sizeUnit?: string;
}): string {
  const parts = [
    item.sizeW && `${item.sizeW}W`,
    item.sizeD && `${item.sizeD}D`,
    item.sizeH && `${item.sizeH}H`,
  ].filter(Boolean);
  return parts.length ? `${parts.join(' × ')} ${item.sizeUnit ?? ''}`.trim() : '';
}

export function proposalPatchToGeneratedItemChangeInfo(
  patch: ProposalGeneratedItemPatch,
  item: ProposalItem,
  customColumnDefs: CustomColumnDef[],
): GeneratedItemChangeInfo | null {
  const changeFields = GENERATED_ITEM_CHANGE_FIELDS.proposal;
  const sizeFields = ['sizeW', 'sizeD', 'sizeH', 'sizeLabel', 'sizeMode', 'sizeUnit'] as const;
  if (sizeFields.some((field) => field in patch)) {
    return {
      ...changeFields.size,
      previousValue: formatProposalSizeDisplay(item),
      newValue: formatProposalSizeDisplay({ ...item, ...patch }),
    };
  }
  if ('quantity' in patch) {
    return {
      ...changeFields.quantity,
      previousValue: `${item.quantity} ${item.quantityUnit}`,
      newValue: `${patch.quantity ?? ''} ${item.quantityUnit}`,
    };
  }
  if ('cbm' in patch) {
    return {
      ...changeFields.cbm,
      previousValue: String(item.cbm),
      newValue: String(patch.cbm ?? ''),
    };
  }
  if ('unitCostCents' in patch) {
    return {
      ...changeFields.unitCostCents,
      previousValue: formatMoney(cents(item.unitCostCents)),
      newValue: formatMoney(cents(patch.unitCostCents ?? 0)),
    };
  }
  const textFields = [
    { key: 'productTag', meta: changeFields.productTag },
    { key: 'plan', meta: changeFields.plan },
    { key: 'drawings', meta: changeFields.drawings },
    { key: 'location', meta: changeFields.location },
    { key: 'description', meta: changeFields.description },
    { key: 'notes', meta: changeFields.notes },
    { key: 'quantityUnit', meta: changeFields.quantityUnit },
  ];
  for (const { key, meta } of textFields) {
    if (key in patch) {
      const prevVal = item[key as keyof ProposalItem];
      const newVal = (patch as Record<string, unknown>)[key];
      return {
        ...meta,
        previousValue: typeof prevVal === 'string' ? prevVal : '',
        newValue: typeof newVal === 'string' ? newVal : '',
      };
    }
  }
  if ('customData' in patch && patch.customData) {
    const changedKey = Object.keys(patch.customData)[0];
    if (changedKey) {
      const def = customColumnDefs.find((columnDef) => columnDef.id === changedKey);
      return {
        columnKey: changedKey,
        columnLabel: def?.label ?? changeFields.customData.columnLabel,
        previousValue: item.customData[changedKey] ?? '',
        newValue: patch.customData[changedKey] ?? '',
        isPriceAffecting: changeFields.customData.isPriceAffecting,
      };
    }
  }
  return null;
}
