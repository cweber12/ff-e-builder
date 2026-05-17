import type { CreateProposalItemInput } from '../../../lib/api';
import type {
  ProposalImportColumn,
  ProposalImportColumnMap,
  ProposalParsedRow,
} from '../../../lib/import';

export function buildProposalItem(
  row: ProposalParsedRow,
  mapping: ProposalImportColumnMap,
  allColumns: ProposalImportColumn[],
  customDataKeyMap?: Map<string, string>,
): CreateProposalItemInput {
  const usedKeys = new Set(Object.values(mapping).filter((v): v is string => v !== null));
  const customData: Record<string, string> = {};
  for (const col of allColumns) {
    if (!usedKeys.has(col.key) && !isComputedProposalTotalColumn(col.label)) {
      const val = (row.values[col.key] ?? '').trim();
      if (val) {
        const key = customDataKeyMap?.get(col.key) ?? col.label;
        customData[key] = val;
      }
    }
  }

  return {
    productTag: getValue(row, mapping.productTag),
    itemName: getValue(row, mapping.itemName),
    plan: getValue(row, mapping.plan),
    drawings: getValue(row, mapping.drawings),
    location: getValue(row, mapping.location),
    description: getValue(row, mapping.description),
    notes: getValue(row, mapping.notes),
    sizeLabel: getValue(row, mapping.sizeLabel),
    cbm: parseNumber(getValue(row, mapping.cbm)),
    quantity: parseNumber(getValue(row, mapping.quantity), 1),
    quantityUnit: getValue(row, mapping.quantityUnit) || 'unit',
    unitCostCents: parseMoney(getValue(row, mapping.unitCost)),
    ...(Object.keys(customData).length > 0 && { customData }),
  };
}

function getValue(row: ProposalParsedRow, columnKey: string | null): string {
  if (!columnKey) return '';
  return (row.values[columnKey] ?? '').trim();
}

export function isComputedProposalTotalColumn(label: string) {
  const normalized = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  return normalized === 'total' || normalized === 'total cost' || normalized === 'line total';
}

function parseNumber(value: string, fallback = 0) {
  const parsed = Number(value.replace(/[,\s]/g, ''));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function parseMoney(value: string) {
  const parsed = Number(value.replace(/[$,\s]/g, ''));
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) : 0;
}
