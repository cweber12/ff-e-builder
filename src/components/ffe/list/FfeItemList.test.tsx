import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { FfeItemList } from './FfeItemList';
import type {
  FfeCatalogGroup,
  Item,
  ProposalCategoryWithItems,
  ProposalItem,
} from '../../../types';

vi.mock('../../shared/image/ImageFrame', () => ({
  ImageFrame: ({ alt }: { alt: string }) => <div>{alt}</div>,
}));

function makeItem(overrides: Partial<Item>): Item {
  return {
    id: 'item-1',
    roomId: 'room-1',
    itemName: 'Item',
    description: null,
    category: null,
    itemIdTag: null,
    dimensions: null,
    notes: null,
    qty: 1,
    unitCostCents: 0,
    leadTime: null,
    status: 'pending',
    customData: {},
    sortOrder: 0,
    version: 1,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    materials: [],
    ...overrides,
  };
}

function makeGroup(overrides: Partial<FfeCatalogGroup>): FfeCatalogGroup {
  return {
    id: 'group-1',
    projectId: 'project-1',
    name: 'Group',
    sortOrder: 0,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    items: [],
    ...overrides,
  };
}

function makeProposalItem(overrides: Partial<ProposalItem>): ProposalItem {
  return {
    id: 'proposal-item-1',
    categoryId: 'category-1',
    productTag: 'FR-01',
    itemName: 'Proposal Item',
    plan: '',
    drawings: '',
    location: '',
    description: '',
    notes: '',
    sizeLabel: '',
    sizeMode: 'imperial',
    sizeW: '',
    sizeD: '',
    sizeH: '',
    sizeUnit: 'ft/in',
    footprintLabel: '',
    footprintW: '',
    footprintD: '',
    footprintUnit: '',
    footprintArea: null,
    materials: [],
    cbm: 0,
    quantity: 1,
    quantityUnit: 'unit',
    unitCostCents: 0,
    sortOrder: 0,
    customData: {},
    version: 1,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    linkedFfeItemId: null,
    ...overrides,
  };
}

function makeProposalCategory(
  overrides: Partial<ProposalCategoryWithItems>,
): ProposalCategoryWithItems {
  return {
    id: 'category-1',
    projectId: 'project-1',
    name: 'Furniture',
    sortOrder: 0,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    items: [],
    ...overrides,
  };
}

describe('FfeItemList', () => {
  it('orders groups by sortOrder and cards by ID tag', () => {
    const groups: FfeCatalogGroup[] = [
      makeGroup({
        id: 'group-b',
        name: 'Lighting',
        sortOrder: 2,
        items: [makeItem({ id: 'item-c', itemName: 'Pendant', itemIdTag: 'LT-03' })],
      }),
      makeGroup({
        id: 'group-a',
        name: 'Furniture',
        sortOrder: 1,
        items: [
          makeItem({ id: 'item-b', itemName: 'Sofa', itemIdTag: 'FR-20' }),
          makeItem({ id: 'item-a', itemName: 'Chair', itemIdTag: 'FR-02' }),
          makeItem({ id: 'item-z', itemName: 'No Tag', itemIdTag: null }),
        ],
      }),
    ];

    render(
      <MemoryRouter>
        <FfeItemList projectId="project-1" groups={groups} proposalCategoriesWithItems={[]} />
      </MemoryRouter>,
    );

    const groupHeadings = screen
      .getAllByRole('heading', { level: 3 })
      .map((node) => node.textContent);
    expect(groupHeadings).toEqual(['Furniture', 'Lighting']);

    const furnitureCardLinks = screen
      .getAllByRole('link')
      .filter((link) =>
        link.getAttribute('href')?.includes('/projects/project-1/ffe/catalog?item='),
      );
    expect(furnitureCardLinks[0]).toHaveAttribute(
      'href',
      '/projects/project-1/ffe/catalog?item=item-a',
    );
    expect(furnitureCardLinks[1]).toHaveAttribute(
      'href',
      '/projects/project-1/ffe/catalog?item=item-b',
    );
    expect(furnitureCardLinks[2]).toHaveAttribute(
      'href',
      '/projects/project-1/ffe/catalog?item=item-z',
    );
  });

  it('disables Add and Remove when no handlers/candidates are available', () => {
    const groups: FfeCatalogGroup[] = [
      makeGroup({
        items: [makeItem({ id: 'item-1', itemName: 'Desk', itemIdTag: 'FR-01' })],
      }),
    ];

    render(
      <MemoryRouter>
        <FfeItemList projectId="project-1" groups={groups} proposalCategoriesWithItems={[]} />
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: 'Add FF&E item' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Remove Desk from FF&E' })).toBeDisabled();
  });

  it('shows Add+ picker with only not-yet-added proposal items and submits selected items', async () => {
    const user = userEvent.setup();
    const onAddToFfeItems = vi.fn().mockResolvedValue(undefined);
    const proposalCategoriesWithItems: ProposalCategoryWithItems[] = [
      makeProposalCategory({
        id: 'category-1',
        name: 'Furniture',
        sortOrder: 1,
        items: [
          makeProposalItem({
            id: 'proposal-item-1',
            productTag: 'FR-10',
            itemName: 'Sofa',
            linkedFfeItemId: null,
          }),
          makeProposalItem({
            id: 'proposal-item-2',
            productTag: 'FR-20',
            itemName: 'Already Added',
            linkedFfeItemId: 'ffe-item-2',
          }),
        ],
      }),
    ];

    render(
      <MemoryRouter>
        <FfeItemList
          projectId="project-1"
          groups={[]}
          proposalCategoriesWithItems={proposalCategoriesWithItems}
          onAddToFfeItems={onAddToFfeItems}
        />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'Add FF&E item' }));
    expect(screen.getByText('Add to FF&E')).toBeInTheDocument();
    expect(screen.getByText('Sofa')).toBeInTheDocument();
    expect(screen.queryByText('Already Added')).not.toBeInTheDocument();

    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Add selected (1)' }));

    expect(onAddToFfeItems).toHaveBeenCalledWith(['proposal-item-1']);
  });
});
