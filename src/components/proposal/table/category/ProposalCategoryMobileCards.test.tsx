import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ProposalItem, RevisionSnapshot } from '../../../../types';
import { ProposalCategoryMobileCards } from './ProposalCategoryMobileCards';

vi.mock('../../../shared/image/ImageFrame', () => ({
  ImageFrame: ({ alt }: { alt: string }) => <div>{`Image ${alt}`}</div>,
}));

vi.mock('../row/ProposalItemActionsMenu', () => ({
  ProposalItemActionsMenu: () => <button type="button">Actions</button>,
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
  notes: '',
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
  materials: [{ id: 'mat-1', name: 'Walnut' } as ProposalItem['materials'][number]],
  cbm: 1.234,
  quantity: 2,
  quantityUnit: 'unit',
  unitCostCents: 65000,
  sortOrder: 0,
  customData: {},
  version: 1,
  createdAt: '2026-06-03T00:00:00Z',
  updatedAt: '2026-06-03T00:00:00Z',
  linkedFfeItemId: null,
};

describe('ProposalCategoryMobileCards', () => {
  it('shows the richer compact summary for tablet breakpoints', () => {
    const snapshotsByItem = new Map<string, RevisionSnapshot>([
      [
        item.id,
        {
          revisionId: 'rev-1',
          itemId: item.id,
          quantity: 3,
          unitCostCents: 70000,
          costStatus: 'flagged',
        },
      ],
    ]);

    render(
      <ProposalCategoryMobileCards
        items={[item]}
        otherCategories={[]}
        compactMode="tablet"
        snapshotsByItem={snapshotsByItem}
        onDelete={vi.fn()}
        onDuplicate={vi.fn()}
        onAddToFfe={vi.fn()}
        onMove={vi.fn()}
        onItemClick={vi.fn()}
      />,
    );

    expect(screen.getByText('Custom Table')).toBeInTheDocument();
    expect(screen.getByText('F-01')).toBeInTheDocument();
    expect(screen.getByText('Kitchen')).toBeInTheDocument();
    expect(screen.getByText('Flagged')).toBeInTheDocument();
    expect(screen.getAllByText('A1.03')).toHaveLength(2);
    expect(screen.getByText('1 material')).toBeInTheDocument();
    expect(screen.getByText('18 sq ft')).toBeInTheDocument();
    expect(screen.getByText('$1,300.00')).toBeInTheDocument();
  });

  it('opens the detail panel from keyboard Enter and Space interactions', () => {
    const onItemClick = vi.fn();

    render(
      <ProposalCategoryMobileCards
        items={[item]}
        otherCategories={[]}
        compactMode="mobile"
        snapshotsByItem={new Map()}
        onDelete={vi.fn()}
        onDuplicate={vi.fn()}
        onAddToFfe={vi.fn()}
        onMove={vi.fn()}
        onItemClick={onItemClick}
      />,
    );

    const card = screen.getByRole('button', {
      name: 'Open details for Custom Table, F-01, Kitchen',
    });
    fireEvent.keyDown(card, { key: 'Enter' });
    fireEvent.keyDown(card, { key: ' ' });

    expect(onItemClick).toHaveBeenCalledTimes(2);
  });
});
