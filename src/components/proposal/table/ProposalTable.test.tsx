import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { Project } from '../../../types';

const mockState = vi.hoisted(() => ({
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
  ] as Array<{
    id: string;
    name: string;
    items: Array<{
      id: string;
      quantity: number;
      unitCostCents: number;
      materials: [];
      cbm: number;
    }>;
  }>,
  isLoading: false,
}));

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
      categoriesWithItems: mockState.categoriesWithItems,
      isLoading: mockState.isLoading,
    }),
    useUpdateColumnDef: () => ({ mutateAsync: vi.fn() }),
    useUpdateProposalCategory: () => ({ mutate: vi.fn() }),
    useUpdateProposalItem: () => ({ mutate: vi.fn() }),
  };
});

vi.mock('./category/ProposalCategorySection', () => ({
  ProposalCategorySection: ({
    categoryName,
    spreadsheetRequest,
    onSpreadsheetRequestHandled,
  }: {
    categoryName: string;
    spreadsheetRequest?: { categoryId: string; filter: 'all' | 'flagged' } | null;
    onSpreadsheetRequestHandled?: () => void;
  }) => {
    React.useEffect(() => {
      if (spreadsheetRequest) onSpreadsheetRequestHandled?.();
    }, [onSpreadsheetRequestHandled, spreadsheetRequest]);

    return (
      <div data-testid="schedule-section" data-filter={spreadsheetRequest?.filter ?? 'none'}>
        {categoryName}
      </div>
    );
  },
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

  it('shows a dedicated loading state while schedule data is loading', () => {
    mockState.isLoading = true;

    render(<ProposalTable projectId={project.id} project={project} />);

    expect(screen.getByLabelText('Loading Item Library')).toBeInTheDocument();
    expect(screen.queryByTestId('schedule-section')).not.toBeInTheDocument();

    mockState.isLoading = false;
  });

  it('shows the empty library state without schedule totals when no schedules exist', () => {
    mockState.categoriesWithItems = [];

    render(<ProposalTable projectId={project.id} project={project} />);

    expect(screen.getByText('No schedules yet')).toBeInTheDocument();
    expect(screen.queryByText(/Library total/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Grand total/i)).not.toBeInTheDocument();

    mockState.categoriesWithItems = [
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
    ];
  });

  it('switches to the requested schedule when opening flagged-only Spreadsheet View', () => {
    const onSpreadsheetRequestHandled = vi.fn();

    render(
      <ProposalTable
        projectId={project.id}
        project={project}
        spreadsheetRequest={{ categoryId: 'lighting', filter: 'flagged' }}
        onSpreadsheetRequestHandled={onSpreadsheetRequestHandled}
      />,
    );

    expect(screen.getByTestId('schedule-section')).toHaveTextContent('Lighting');
    expect(screen.getByTestId('schedule-section')).toHaveAttribute('data-filter', 'flagged');
    expect(onSpreadsheetRequestHandled).toHaveBeenCalled();
  });
});
