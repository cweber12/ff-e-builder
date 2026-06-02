import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BudgetOptionsMenu, BudgetPageActions } from './App';
import type { Project, ProposalCategoryWithItems, RoomWithItems } from './types';

const mockState = vi.hoisted(() => ({
  exportSummaryCsv: vi.fn(),
  exportSummaryExcel: vi.fn(() => Promise.resolve()),
  exportSummaryPdf: vi.fn(),
  exportProposalCsv: vi.fn(),
  exportProposalExcel: vi.fn(() => Promise.resolve()),
  exportProposalPdf: vi.fn(() => Promise.resolve()),
}));

vi.mock('./hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./hooks')>();
  return {
    ...actual,
    useColumnDefs: () => ({ data: [] }),
    readColumnConfigFromStorage: () => undefined,
  };
});

vi.mock('./lib/export', () => ({
  exportSummaryCsv: mockState.exportSummaryCsv,
  exportSummaryExcel: mockState.exportSummaryExcel,
  exportSummaryPdf: mockState.exportSummaryPdf,
  exportProposalCsv: mockState.exportProposalCsv,
  exportProposalExcel: mockState.exportProposalExcel,
  exportProposalPdf: mockState.exportProposalPdf,
}));

vi.mock('./components/project/modals/FfeBudgetModal', () => ({
  FfeBudgetModal: ({ open }: { open: boolean }) =>
    open ? <div data-testid="ffe-budget-modal">FF&E budget modal</div> : null,
}));

vi.mock('./components/project/modals/ProposalBudgetModal', () => ({
  ProposalBudgetModal: ({ open }: { open: boolean }) =>
    open ? <div data-testid="proposal-budget-modal">Proposal budget modal</div> : null,
}));

const project: Project = {
  id: 'project-1',
  ownerUid: 'owner-1',
  name: 'Test Project',
  clientName: 'Client',
  companyName: 'Studio',
  projectLocation: 'Seattle',
  budgetMode: 'shared',
  budgetCents: 100_000,
  ffeBudgetCents: 50_000,
  proposalBudgetCents: 50_000,
  proposalStatus: 'in_progress',
  proposalStatusUpdatedAt: '2026-06-01T00:00:00Z',
  createdAt: '2026-06-01T00:00:00Z',
  updatedAt: '2026-06-01T00:00:00Z',
};

const roomsWithItems: RoomWithItems[] = [];
const proposalCategoriesWithItems: ProposalCategoryWithItems[] = [];

describe('BudgetPageActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders only direct budget-setting buttons in the sidebar body', () => {
    render(
      <BudgetPageActions
        project={project}
        roomsWithItems={roomsWithItems}
        proposalCategoriesWithItems={proposalCategoriesWithItems}
        layout="column"
      />,
    );

    expect(screen.getByRole('button', { name: 'FF&E Budget' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Proposal Budget' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /download csv/i })).not.toBeInTheDocument();
  });

  it('opens both budget setting modals from direct sidebar buttons', async () => {
    const user = userEvent.setup();

    render(
      <BudgetPageActions
        project={project}
        roomsWithItems={roomsWithItems}
        proposalCategoriesWithItems={proposalCategoriesWithItems}
        layout="column"
      />,
    );

    await user.click(screen.getByRole('button', { name: 'FF&E Budget' }));
    expect(screen.getByTestId('ffe-budget-modal')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Proposal Budget' }));
    expect(screen.getByTestId('proposal-budget-modal')).toBeInTheDocument();
  });

  it('renders budget-setting and download actions inside the options menu', async () => {
    const user = userEvent.setup();

    render(
      <BudgetOptionsMenu
        project={project}
        roomsWithItems={roomsWithItems}
        proposalCategoriesWithItems={proposalCategoriesWithItems}
      />,
    );

    await user.click(screen.getByRole('button', { name: /budget options/i }));
    expect(screen.getByRole('menuitem', { name: 'FF&E Budget' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Proposal Budget' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Download' })).toBeInTheDocument();

    await user.click(screen.getByRole('menuitem', { name: 'Download' }));
    await user.click(screen.getByRole('menuitem', { name: 'Download CSV' }));
    expect(mockState.exportSummaryCsv).toHaveBeenCalledTimes(1);
    expect(mockState.exportProposalCsv).toHaveBeenCalledTimes(1);
  });
});
