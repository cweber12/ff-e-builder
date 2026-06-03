import { MemoryRouter } from 'react-router-dom';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CatalogView, CATALOG_ACTIONS_SLOT_ID, CATALOG_PICKER_SLOT_ID } from './CatalogView';
import { catalogProjectFixture, catalogRoomsFixture } from '../../../data/catalogFixture';
import type { ProposalCategoryWithItems } from '../../../types';

vi.mock('../../../hooks', async () => {
  const React = await vi.importActual<typeof import('react')>('react');
  return {
    useCatalogPreference: <T,>(_key: string, defaultValue: T) => React.useState(defaultValue),
    useCatalogSessionPreference: <T,>(defaultValue: T) => React.useState(defaultValue),
    useFfeItemSort: () => ({ sortMode: 'manual' }),
    useCompany: () => ({ data: null, isError: false }),
    useImages: () => ({ data: [], isLoading: false }),
    useDeleteImage: () => ({ mutate: vi.fn(), isPending: false }),
    useMaterialCellPaste: () => ({
      isPasting: false,
      pasteFromClipboard: vi.fn(),
    }),
    useUpdateImageCrop: () => ({ mutate: vi.fn(), isPending: false }),
    useUpdateItem: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useUploadImage: () => ({ mutate: vi.fn(), isPending: false }),
  };
});

vi.mock('../../../lib/export', () => ({
  exportCatalogPdf: vi.fn(),
  exportCatalogItemPdf: vi.fn(),
}));

vi.mock('../../../lib/export/imageHelpers', () => ({
  imageAssetToPngDataUrl: vi.fn(),
}));

vi.mock('../../shared/image/ImageFrame', () => ({
  ImageFrame: ({ alt, className }: { alt: string; className?: string }) => (
    <div role="img" aria-label={alt} className={className} />
  ),
}));

vi.mock('../../primitives/toastApi', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

function renderCatalog(
  proposalCategoriesWithItems: ProposalCategoryWithItems[] = [],
  handlers: {
    onAddToFfeItems?: (proposalItemIds: string[]) => Promise<void>;
    onRemoveFromFfe?: (ffeItemId: string) => Promise<void>;
  } = {},
) {
  return render(
    <MemoryRouter initialEntries={[`/projects/${catalogProjectFixture.id}/ffe/catalog`]}>
      <div id={CATALOG_ACTIONS_SLOT_ID} />
      <div id={CATALOG_PICKER_SLOT_ID} />
      <CatalogView
        project={catalogProjectFixture}
        rooms={catalogRoomsFixture}
        proposalCategoriesWithItems={proposalCategoriesWithItems}
        onAddToFfeItems={handlers.onAddToFfeItems}
        onRemoveFromFfe={handlers.onRemoveFromFfe}
      />
    </MemoryRouter>,
  );
}

describe('Catalog navigator', () => {
  it('opens a thumbnail-first navigator and jumps to the selected catalog page', async () => {
    const user = userEvent.setup();
    renderCatalog();

    await user.click(screen.getByRole('button', { name: 'Open catalog navigator' }));

    const dialog = screen.getByRole('dialog', { name: 'Catalog Navigator' });
    expect(within(dialog).getByRole('img', { name: 'Channel Lounge Chair' })).toBeInTheDocument();
    expect(within(dialog).getByText('LR-CH-01')).toBeInTheDocument();

    await user.click(
      within(dialog).getByRole('button', { name: 'Open catalog page for Arc Floor Lamp' }),
    );

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Catalog Navigator' })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: 'Open catalog navigator' })).toHaveTextContent(
      'Arc Floor Lamp',
    );
    expect(screen.getByRole('button', { name: 'Open catalog navigator' })).toHaveTextContent(
      'Page 2 of 3',
    );
  });

  it('keeps Add to FF&E as a secondary navigator mode', async () => {
    const user = userEvent.setup();
    const onAddToFfeItems = vi.fn().mockResolvedValue(undefined);
    const proposalCategoriesWithItems: ProposalCategoryWithItems[] = [
      {
        id: 'proposal-category-1',
        projectId: catalogProjectFixture.id,
        name: 'Lighting',
        sortOrder: 0,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        items: [
          {
            id: 'proposal-item-1',
            categoryId: 'proposal-category-1',
            productTag: 'LT-03',
            itemName: 'Gallery Picture Light',
            plan: '',
            drawings: '',
            location: 'Hall',
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
          },
        ],
      },
    ];

    renderCatalog(proposalCategoriesWithItems, { onAddToFfeItems });

    await user.click(screen.getByRole('button', { name: 'Open catalog navigator' }));
    const dialog = screen.getByRole('dialog', { name: 'Catalog Navigator' });
    await user.click(within(dialog).getByRole('button', { name: 'Add items' }));
    await user.click(within(dialog).getByRole('checkbox', { name: /Gallery Picture Light/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Add selected (1)' }));

    await waitFor(() => expect(onAddToFfeItems).toHaveBeenCalledWith(['proposal-item-1']));
  });
});
