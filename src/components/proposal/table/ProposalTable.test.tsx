import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Project } from '../../../types';

vi.mock('../../../hooks', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('../../../hooks');

  return {
    ...actual,
    ALL_COLUMN_GROUP_ID: 'all',
    useColumnDefs: () => ({ data: [] }),
    useCreateColumnDef: () => ({ mutateAsync: vi.fn() }),
    useCreateProposalCategory: () => ({
      mutateAsync: vi.fn(({ name }: { name: string }) =>
        Promise.resolve({
          id: 'new-schedule',
          name,
          items: [],
        }),
      ),
    }),
    useDeleteColumnDef: () => ({ mutate: vi.fn() }),
    useDeleteProposalCategory: () => ({ mutateAsync: vi.fn() }),
    useGeneratedItemColumns: () => ({
      visibleColumns: ['itemName'],
      hiddenDefaults: [],
      columnConfig: {
        applyFirstLoadAutoHide: vi.fn(),
        moveColumn: vi.fn(),
        hideDefaultColumn: vi.fn(),
        restoreDefaultColumn: vi.fn(),
      },
    }),
    usePrefetchProposalItems: () => vi.fn(),
    useProposalWithItems: () => ({
      categoriesWithItems: [
        {
          id: 'furniture',
          name: 'Furniture',
          items: [
            { id: 'f-1', quantity: 1, unitCostCents: 65000, materials: [], cbm: 0 },
            { id: 'f-2', quantity: 2, unitCostCents: 28000, materials: [], cbm: 0 },
          ],
        },
        {
          id: 'lighting',
          name: 'Lighting',
          items: [{ id: 'l-1', quantity: 3, unitCostCents: 12000, materials: [], cbm: 0 }],
        },
      ],
      isLoading: false,
    }),
    useUpdateColumnDef: () => ({ mutateAsync: vi.fn() }),
    useUpdateProposalCategory: () => ({ mutate: vi.fn() }),
    useUpdateProposalItem: () => ({ mutate: vi.fn() }),
  };
});

vi.mock('./category/ProposalCategorySection', () => ({
  ProposalCategorySection: ({ categoryName }: { categoryName: string }) => (
    <div data-testid="schedule-section">{categoryName}</div>
  ),
}));

vi.mock('./detail/ProposalItemDetailPanel', () => ({
  ProposalItemDetailPanel: () => null,
}));

vi.mock('./dialogs/DeleteCategoryModal', () => ({
  DeleteCategoryModal: () => null,
}));

vi.mock('../../shared/modals/AddGroupModal', () => ({
  AddGroupModal: () => null,
}));

vi.mock('./ProposalEmptyState', () => ({
  ProposalEmptyState: () => null,
}));

import { ProposalTable } from './ProposalTable';

const project = {
  id: 'project-1',
  ownerUid: 'owner-1',
  name: 'Cork & Batter',
  clientName: 'Client',
  companyName: 'Studio',
  projectLocation: 'Los Angeles',
  budgetCents: 0,
  proposalStatus: 'in_progress',
  proposalStatusUpdatedAt: '2026-06-03T00:00:00Z',
  createdAt: '2026-06-03T00:00:00Z',
  updatedAt: '2026-06-03T00:00:00Z',
} satisfies Project;

describe('ProposalTable active schedule selection', () => {
  it('shows one schedule at a time in the default Item Library surface', () => {
    render(<ProposalTable projectId={project.id} project={project} />);

    expect(screen.getAllByTestId('schedule-section')).toHaveLength(1);
    expect(screen.getByTestId('schedule-section')).toHaveTextContent('Furniture');
    expect(screen.queryByTestId('schedule-section')).not.toHaveTextContent('Lighting');
    expect(screen.getByText(/Library total/i)).toBeInTheDocument();
  });
});
