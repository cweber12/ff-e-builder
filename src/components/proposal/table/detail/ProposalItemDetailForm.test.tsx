import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CustomColumnDef, ProposalItem } from '../../../../types';
import { ProposalItemDetailForm } from './ProposalItemDetailForm';

vi.mock('../../../shared/table/GeneratedItemEditableTextCell', () => ({
  GeneratedItemEditableTextControl: ({
    value,
    ariaLabel,
  }: {
    value: string;
    ariaLabel: string;
  }) => <div aria-label={ariaLabel}>{value || 'empty'}</div>,
}));

vi.mock('../../../shared/table/GeneratedItemEditableNumberCell', () => ({
  GeneratedItemEditableMoneyControl: ({ valueCents }: { valueCents: number }) => (
    <div>{valueCents}</div>
  ),
  GeneratedItemEditableQuantityControl: ({ quantity }: { quantity: number }) => (
    <div>{quantity}</div>
  ),
}));

vi.mock('../../../shared/table/GeneratedItemSizeModal', () => ({
  GeneratedItemSizeControl: ({ value }: { value: string }) => <div>{value || '—'}</div>,
}));

vi.mock('../../../shared/table/GeneratedItemMaterialsCell', () => ({
  GeneratedItemMaterialsControl: () => <div>Materials control</div>,
}));

const item: ProposalItem = {
  id: 'item-1',
  categoryId: 'cat-1',
  productTag: 'F-01',
  itemName: 'Custom Table',
  plan: '',
  drawings: 'A1.03',
  location: 'Kitchen',
  description: 'Rectangular wood table with rounded corners and brushed brass base.',
  notes: 'Designer note',
  sizeLabel: '72" x 36" x 30"',
  sizeMode: 'imperial',
  sizeW: '72',
  sizeD: '36',
  sizeH: '30',
  sizeUnit: 'ft/in',
  footprintLabel: '18 sq ft',
  footprintW: '72',
  footprintD: '36',
  footprintUnit: 'ft/in',
  footprintArea: 18,
  materials: [],
  cbm: 1.234,
  quantity: 2,
  quantityUnit: 'unit',
  unitCostCents: 65000,
  sortOrder: 0,
  customData: {
    'custom-1': 'Atlas',
    'custom-2': 'Walnut veneer',
  },
  version: 1,
  createdAt: '2026-06-03T00:00:00Z',
  updatedAt: '2026-06-03T00:00:00Z',
  linkedFfeItemId: null,
};

const customColumnDefs: CustomColumnDef[] = [
  {
    id: 'custom-1',
    projectId: 'project-1',
    tableType: 'proposal',
    label: 'Vendor',
    sortOrder: 0,
    createdAt: '2026-06-03T00:00:00Z',
    updatedAt: '2026-06-03T00:00:00Z',
  },
  {
    id: 'custom-2',
    projectId: 'project-1',
    tableType: 'proposal',
    label: 'Finish',
    sortOrder: 1,
    createdAt: '2026-06-03T00:00:00Z',
    updatedAt: '2026-06-03T00:00:00Z',
  },
];

describe('ProposalItemDetailForm', () => {
  it('renders proposal custom data fields in the detail panel', () => {
    render(
      <ProposalItemDetailForm
        item={item}
        customColumnDefs={customColumnDefs}
        lineTotalCents={130000}
        onSave={vi.fn()}
        onOpenMaterials={vi.fn()}
      />,
    );

    expect(screen.getByText('Custom data')).toBeInTheDocument();
    expect(screen.getByText('Vendor')).toBeInTheDocument();
    expect(screen.getByText('Finish')).toBeInTheDocument();
    expect(screen.getByLabelText('Vendor')).toHaveTextContent('Atlas');
    expect(screen.getByLabelText('Finish')).toHaveTextContent('Walnut veneer');
  });
});
